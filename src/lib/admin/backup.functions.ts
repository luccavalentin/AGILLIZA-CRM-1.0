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
        const linhas = (data ?? []) as Record<string, unknown>[];
        const colunas =
          linhas.length > 0 ? Object.keys(linhas[0]) : [];
        tabelas.push({ label: g.label, tabela: g.tabela, colunas, linhas });
      } catch {
        // tabela sem correspondente_id ou inacessível — ignora
      }
    }

    return { geradoEm: new Date().toISOString(), tabelas };
  });
