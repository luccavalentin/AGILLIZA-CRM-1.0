import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface BackupLista {
  id: string;
  status: string;
  tamanho_bytes: number | null;
  manifesto: Record<string, number> | null;
  erro: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
  created_at: string;
}

async function correspondenteDoUsuario(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.correspondente_id ?? null;
}

const RETENCAO_PADRAO = 2;

/** Lê a quantidade de dias de retenção de backup do correspondente (padrão: 2). */
async function retencaoDias(supabase: any, corr: string): Promise<number> {
  const { data } = await supabase
    .from("parametros_globais")
    .select("backup_retencao_dias")
    .eq("correspondente_id", corr)
    .maybeSingle();
  const n = Number(data?.backup_retencao_dias);
  return Number.isFinite(n) && n > 0 ? n : RETENCAO_PADRAO;
}

/** Remove registros de backup mais antigos que a janela de retenção configurada. */
async function purgarExpirados(supabase: any, corr: string, dias: number): Promise<void> {
  const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("backup_jobs")
    .delete()
    .eq("correspondente_id", corr)
    .lt("created_at", limite);
}

/** Indica se o usuário pode configurar a retenção de backup. */
async function podeConfigurar(supabase: any, userId: string): Promise<boolean> {
  const { data: temTudo } = await supabase.rpc("has_any_role", {
    _user_id: userId,
    _roles: ["admin", "correspondente"],
  });
  if (temTudo) return true;
  const { data: perfil } = await supabase
    .from("profiles")
    .select("nivel_acesso_id")
    .eq("id", userId)
    .maybeSingle();
  if (!perfil?.nivel_acesso_id) return false;
  const { data: row } = await supabase
    .from("permissions")
    .select("permitido")
    .eq("nivel_acesso_id", perfil.nivel_acesso_id)
    .eq("modulo", "admin.backup")
    .eq("acao", "configurar")
    .eq("permitido", true)
    .maybeSingle();
  return !!row;
}

export interface ConfigBackup {
  retencaoDias: number;
  podeConfigurar: boolean;
}

/** Retorna a configuração de retenção e se o usuário pode alterá-la. */
export const obterConfigBackup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConfigBackup> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) return { retencaoDias: RETENCAO_PADRAO, podeConfigurar: false };
    const [dias, pode] = await Promise.all([
      retencaoDias(supabase, corr),
      podeConfigurar(supabase, userId),
    ]);
    return { retencaoDias: dias, podeConfigurar: pode };
  });

/** Salva a janela de retenção de backup (somente usuários com permissão). */
export const salvarConfigBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ retencaoDias: z.number().int().min(1).max(365) }).parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");
    if (!(await podeConfigurar(supabase, userId))) {
      throw new Error("Sem permissão para configurar o backup.");
    }
    const { data: existente } = await supabase
      .from("parametros_globais")
      .select("id")
      .eq("correspondente_id", corr)
      .maybeSingle();
    if (existente?.id) {
      const { error } = await supabase
        .from("parametros_globais")
        .update({ backup_retencao_dias: data.retencaoDias })
        .eq("id", existente.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("parametros_globais")
        .insert({ correspondente_id: corr, backup_retencao_dias: data.retencaoDias });
      if (error) throw error;
    }
    // Aplica a nova janela imediatamente.
    await purgarExpirados(supabase, corr, data.retencaoDias);
    return { ok: true };
  });


// Tabelas incluídas no manifesto do backup lógico (escopo por correspondente).
const TABELAS_BACKUP = [
  "clientes",
  "cliente_documentos",
  "cliente_enderecos",
  "cliente_imoveis",
  "cliente_interacoes",
  "simulacoes",
  "propostas",
  "proposta_documentos",
  "comissoes",
  "financial_receivables",
  "financial_payables",
  "tasks",
  "demandas",
  "scan_ia_leituras",
];

export const listarBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BackupLista[]> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) return [];

    // Retenção: remove registros além da janela configurada (padrão 2 dias).
    await purgarExpirados(supabase, corr, await retencaoDias(supabase, corr));

    const { data, error } = await supabase
      .from("backup_jobs")
      .select("id, status, tamanho_bytes, manifesto, erro, iniciado_em, concluido_em, created_at")
      .eq("correspondente_id", corr)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []) as BackupLista[];
  });


/** Gera um snapshot lógico: contagem por tabela do escopo do correspondente. */
export const criarBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ id: string; status: string }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const { data: job, error } = await supabase
      .from("backup_jobs")
      .insert({
        correspondente_id: corr,
        status: "processando",
        criador_id: userId,
        iniciado_em: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;

    try {
      const manifesto: Record<string, number> = {};
      let total = 0;
      for (const tabela of TABELAS_BACKUP) {
        const { count } = await (supabase.from(tabela as never) as any)
          .select("id", { count: "exact", head: true })
          .eq("correspondente_id", corr);
        const n = count ?? 0;
        manifesto[tabela] = n;
        total += n;
      }

      await supabase
        .from("backup_jobs")
        .update({
          status: "concluido",
          manifesto,
          tamanho_bytes: total * 1024, // estimativa
          concluido_em: new Date().toISOString(),
        })
        .eq("id", job.id);

      return { id: job.id, status: "concluido" };
    } catch (e: any) {
      const msg = e?.message ? String(e.message).slice(0, 500) : "Falha no backup.";
      await supabase
        .from("backup_jobs")
        .update({ status: "erro", erro: msg, concluido_em: new Date().toISOString() })
        .eq("id", job.id);
      return { id: job.id, status: "erro" };
    }
  });

/** Exclui um registro de backup do histórico. */
export const excluirBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");
    const { error } = await supabase
      .from("backup_jobs")
      .delete()
      .eq("id", data.id)
      .eq("correspondente_id", corr);
    if (error) throw new Error("Não foi possível excluir o backup.");
    return { ok: true };
  });

// Grupos de tabelas exportadas no backup completo (planilha por tabela).
export const GRUPOS_EXPORT: { label: string; tabela: string }[] = [
  { label: "Clientes", tabela: "clientes" },
  { label: "Endereços de Clientes", tabela: "cliente_enderecos" },
  { label: "Imóveis de Clientes", tabela: "cliente_imoveis" },
  { label: "Documentos de Clientes", tabela: "cliente_documentos" },
  { label: "Interações de Clientes", tabela: "cliente_interacoes" },
  { label: "Simulações", tabela: "simulacoes" },
  { label: "Propostas", tabela: "propostas" },
  { label: "Documentos de Propostas", tabela: "proposta_documentos" },
  { label: "Comissões", tabela: "comissoes" },
  { label: "Contas a Receber", tabela: "financial_receivables" },
  { label: "Contas a Pagar", tabela: "financial_payables" },
  { label: "Categorias Financeiras", tabela: "financial_categories" },
  { label: "Centros de Custo", tabela: "financial_cost_centers" },
  { label: "Fluxo de Caixa", tabela: "fluxo_caixa" },
  { label: "Tarefas", tabela: "tasks" },
  { label: "Demandas", tabela: "demandas" },
  { label: "Matrículas", tabela: "matricula_solicitacoes" },
  { label: "Leituras Scan IA", tabela: "scan_ia_leituras" },
  { label: "Usuários (Perfis)", tabela: "profiles" },
];

export interface TabelaExportada {
  label: string;
  tabela: string;
  colunas: string[];
  linhas: Record<string, string | number | boolean | null>[];
}

export interface BackupCompleto {
  geradoEm: string;
  tabelas: TabelaExportada[];
}

/** Retorna TODOS os dados do sistema (escopo do correspondente) para exportação em Excel. */
export const exportarBackupCompleto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BackupCompleto> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const tabelas: TabelaExportada[] = [];
    for (const g of GRUPOS_EXPORT) {
      try {
        const { data, error } = await (supabase.from(g.tabela as never) as any)
          .select("*")
          .eq("correspondente_id", corr)
          .limit(5000);
        if (error) continue;
        const brutas = (data ?? []) as Record<string, unknown>[];
        const colunas = brutas.length > 0 ? Object.keys(brutas[0]) : [];
        const linhas: Record<string, string | number | boolean | null>[] = brutas.map((r) => {
          const o: Record<string, string | number | boolean | null> = {};
          for (const k of Object.keys(r)) {
            const v = r[k];
            if (v === null || v === undefined) o[k] = null;
            else if (typeof v === "object") o[k] = JSON.stringify(v);
            else if (typeof v === "boolean" || typeof v === "number") o[k] = v;
            else o[k] = String(v);
          }
          return o;
        });
        tabelas.push({ label: g.label, tabela: g.tabela, colunas, linhas });
      } catch {
        // tabela sem correspondente_id ou inacessível — ignora
      }
    }

    // Registra o backup no histórico (retido pela janela configurada).
    const manifesto: Record<string, number> = {};
    let totalRegistros = 0;
    for (const t of tabelas) {
      manifesto[t.tabela] = t.linhas.length;
      totalRegistros += t.linhas.length;
    }
    const agora = new Date().toISOString();
    try {
      await supabase.from("backup_jobs").insert({
        correspondente_id: corr,
        status: "concluido",
        criador_id: userId,
        manifesto,
        tamanho_bytes: totalRegistros * 1024,
        iniciado_em: agora,
        concluido_em: agora,
      });
      await purgarExpirados(supabase, corr, await retencaoDias(supabase, corr));
    } catch {
      // não bloqueia a exportação caso o registro falhe
    }

    return { geradoEm: agora, tabelas };
  });

