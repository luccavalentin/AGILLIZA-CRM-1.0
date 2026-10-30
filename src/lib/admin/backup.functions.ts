import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { todasAsLinhas } from "@/lib/paginar";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

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
  .middleware([exigirPermissao(["admin.backup", "view"])])
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
  .middleware([exigirPermissao(["admin.backup", "create"])])
  .validator((data) =>
    z.object({ retencaoDias: z.number().int().min(1).max(365) }).parse(data),
  )
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

export const listarBackups = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["admin.backup", "view"])])
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
  .middleware([exigirPermissao(["admin.backup", "create"])])
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
      for (const g of GRUPOS_EXPORT) {
        const { count, error: erroContagem } = await consultaDoGrupo(supabase, g, corr, "id", {
          count: "exact",
          head: true,
        });
        if (erroContagem) continue;
        const n = count ?? 0;
        manifesto[g.tabela] = n;
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
  .middleware([exigirPermissao(["admin.backup", "create"])])
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
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

/**
 * Tabelas do backup completo (uma aba por tabela no Excel; INSERTs no SQL).
 *
 * Antes eram 19 grupos e só 15 saíam: as tabelas-filhas (endereços, imóveis,
 * interações, documentos do cliente) não têm `correspondente_id`, a consulta
 * falhava e a aba sumia sem aviso — e RH, configurações do financeiro e os
 * detalhes de propostas/simulações/tarefas/demandas nem estavam na lista
 * (QA 20/10). Agora a filha é filtrada pelo correspondente da tabela-mãe
 * (`via`) e o que falhar volta em `tabelasComFalha` para a tela avisar.
 *
 * Ordem = ordem de restauração do SQL: mães antes das filhas. Ficam de fora,
 * de propósito, segredos (credenciais de banco, chaves de API) e caches.
 */
export interface GrupoExport {
  label: string;
  tabela: string;
  /** Tabela-mãe que carrega o `correspondente_id` e a coluna que aponta para ela. */
  via?: { mae: string; coluna: string };
  /** Colunas exportadas quando a tabela tem coluna fechada ao SELECT (ex.: salário no RH). */
  colunas?: string;
}

const doCliente = { mae: "clientes", coluna: "cliente_id" };
const daProposta = { mae: "propostas", coluna: "proposta_id" };
const daSimulacao = { mae: "simulacoes", coluna: "simulacao_id" };
const daTarefa = { mae: "tasks", coluna: "task_id" };
const daDemanda = { mae: "demandas", coluna: "demanda_id" };

export const GRUPOS_EXPORT: GrupoExport[] = [
  // Administração / cadastros-base
  { label: "Parâmetros da Empresa", tabela: "parametros_globais" },
  { label: "Papéis de Acesso", tabela: "access_levels" },
  { label: "Tipos de Pessoa", tabela: "tipos_pessoa" },
  { label: "Usuários (Perfis)", tabela: "profiles" },
  { label: "Detalhes de Parceiros", tabela: "parceiro_detalhes" },
  { label: "Feriados", tabela: "feriados" },
  { label: "SLA — Configurações", tabela: "sla_configuracoes" },
  { label: "SLA — Catálogo", tabela: "sla_catalogo_itens" },
  { label: "Regras de Notificação", tabela: "notificacao_regras" },
  { label: "Configurações de Módulos", tabela: "configuracoes_modulos" },
  { label: "Base do Consultor IA", tabela: "consultor_ia_base" },
  { label: "Relatórios Salvos", tabela: "report_saved_filters" },
  // CRM
  { label: "Clientes", tabela: "clientes" },
  { label: "Endereços de Clientes", tabela: "cliente_enderecos", via: doCliente },
  { label: "Imóveis de Clientes", tabela: "cliente_imoveis", via: doCliente },
  { label: "Pastas de Documentos", tabela: "cliente_documento_pastas" },
  { label: "Documentos de Clientes", tabela: "cliente_documentos", via: doCliente },
  { label: "Interações de Clientes", tabela: "cliente_interacoes", via: doCliente },
  { label: "Histórico de Clientes", tabela: "cliente_historico", via: doCliente },
  { label: "Vendedores do Cliente", tabela: "cliente_vendedores", via: doCliente },
  { label: "Parceiros do Cliente", tabela: "cliente_parceiros" },
  { label: "Mensagens do App Cliente", tabela: "cliente_app_mensagens" },
  { label: "Etiquetas do Chat", tabela: "crm_chat_etiquetas" },
  { label: "Arquivos e Pastas", tabela: "arquivos_nos" },
  // Operacional
  { label: "Simulações", tabela: "simulacoes" },
  { label: "Simulações — Bancos", tabela: "simulacao_bancos", via: daSimulacao },
  { label: "Simulações — Histórico", tabela: "simulacao_historico", via: daSimulacao },
  { label: "Simulações — Participantes", tabela: "simulacao_participantes", via: daSimulacao },
  { label: "Propostas", tabela: "propostas" },
  { label: "Propostas — Bancos", tabela: "proposta_bancos", via: daProposta },
  { label: "Propostas — Envolvidos", tabela: "proposta_envolvidos", via: daProposta },
  { label: "Propostas — Histórico", tabela: "proposta_historico", via: daProposta },
  { label: "Propostas — Follow-ups", tabela: "proposta_followups", via: daProposta },
  { label: "Documentos de Propostas", tabela: "proposta_documentos" },
  { label: "Tarefas", tabela: "tasks" },
  { label: "Etiquetas de Tarefas", tabela: "task_tags" },
  { label: "Tarefas — Comentários", tabela: "task_comments", via: daTarefa },
  { label: "Tarefas — Participantes", tabela: "task_participants", via: daTarefa },
  { label: "Tarefas — Histórico", tabela: "task_history", via: daTarefa },
  { label: "Demandas", tabela: "demandas" },
  { label: "Demandas — Mensagens", tabela: "demanda_mensagens", via: daDemanda },
  { label: "Demandas — Participantes", tabela: "demanda_participantes", via: daDemanda },
  { label: "Demandas — Anexos", tabela: "demanda_anexos", via: daDemanda },
  { label: "Demandas — Histórico", tabela: "demanda_historico", via: daDemanda },
  { label: "Matrículas", tabela: "matricula_solicitacoes" },
  { label: "Matrículas — Créditos", tabela: "matricula_creditos" },
  { label: "Conciliações", tabela: "conciliacao_lotes" },
  { label: "Pedidos de Compra", tabela: "purchase_requests" },
  { label: "Leituras Scan IA", tabela: "scan_ia_leituras" },
  // Financeiro
  { label: "Categorias Financeiras", tabela: "financial_categories" },
  { label: "Centros de Custo", tabela: "financial_cost_centers" },
  { label: "Formas de Pagamento", tabela: "financial_payment_methods" },
  { label: "Contas a Receber", tabela: "financial_receivables" },
  { label: "Contas a Pagar", tabela: "financial_payables" },
  { label: "Contas a Pagar — Histórico", tabela: "financial_payable_history" },
  { label: "Fluxo de Caixa", tabela: "fluxo_caixa" },
  { label: "Regras de Repasse", tabela: "comissao_regras" },
  { label: "Regras de Comissão", tabela: "comissao_regras_usuario" },
  { label: "Comissões", tabela: "comissoes" },
  { label: "Comissões de Usuários", tabela: "comissoes_usuario" },
  // RH
  { label: "RH — Departamentos", tabela: "rh_departamentos" },
  { label: "RH — Cargos", tabela: "rh_cargos" },
  { label: "RH — Tipos de Benefício", tabela: "rh_beneficios_tipos" },
  // Salário e banco ficam fora do SELECT direto (migração 20261027060002): o backup leva a ficha sem eles.
  {
    label: "RH — Funcionários",
    tabela: "rh_funcionarios",
    colunas:
      "id, correspondente_id, numero, status, nome, nome_social, cpf, rg, rg_orgao, rg_uf, data_nascimento, sexo, estado_civil, nacionalidade, naturalidade, nome_mae, nome_pai, email_pessoal, telefone, foto_url, cep, logradouro, numero_endereco, complemento, bairro, cidade, uf, cargo_id, departamento_id, gestor_id, centro_custo_id, tipo_contrato, matricula, ctps_numero, ctps_serie, ctps_uf, pis, data_admissao, fim_experiencia, data_demissao, motivo_demissao, jornada_horas_semanais, jornada_descricao, email_corporativo, observacoes, criador_id, ativo, deletado_em, created_at, updated_at, user_id, dia_pagamento_salario, dia_pagamento_adiantamento, gerar_contas_pagar_automatico",
  },
  { label: "RH — Dependentes", tabela: "rh_dependentes" },
  { label: "RH — Benefícios", tabela: "rh_funcionario_beneficios" },
  { label: "RH — Histórico", tabela: "rh_funcionario_historico" },
  { label: "RH — Alterações Salariais", tabela: "rh_alteracoes_salariais" },
  { label: "RH — Documentos", tabela: "rh_documentos" },
  { label: "RH — Checklist CLT", tabela: "rh_documentos_checklist" },
  { label: "RH — Férias", tabela: "rh_ferias" },
  { label: "RH — Ocorrências", tabela: "rh_ocorrencias" },
  { label: "RH — Adiantamentos", tabela: "rh_adiantamentos" },
  { label: "RH — Lançamentos da folha", tabela: "rh_lancamentos" },
  { label: "RH — Competências", tabela: "rh_folha_competencias" },
  { label: "RH — Itens da Folha", tabela: "rh_folha_itens" },
  { label: "RH — Desligamentos", tabela: "rh_desligamentos" },
  { label: "RH — Tabelas da folha (próprias)", tabela: "rh_tabelas_fiscais" },
  { label: "RH — Holerites", tabela: "rh_holerites" },
];

/**
 * Consulta de um grupo no escopo do correspondente. A filha entra com um
 * `!inner` na mãe (`_mae`), filtrado pelo correspondente dela.
 */
function consultaDoGrupo(
  supabase: any,
  g: GrupoExport,
  corr: string,
  colunas: string,
  opcoes?: { count: "exact"; head: boolean },
): any {
  if (!g.via) {
    return supabase.from(g.tabela).select(colunas, opcoes).eq("correspondente_id", corr);
  }
  return supabase
    .from(g.tabela)
    .select(`${colunas}, _mae:${g.via.mae}!${g.via.coluna}!inner(correspondente_id)`, opcoes)
    .eq("_mae.correspondente_id", corr);
}

export interface TabelaExportada {
  label: string;
  tabela: string;
  colunas: string[];
  linhas: Record<string, string | number | boolean | null>[];
}

export interface BackupCompleto {
  geradoEm: string;
  tabelas: TabelaExportada[];
  /** Tabelas que não puderam ser lidas — a tela avisa em vez de esconder. */
  tabelasComFalha: string[];
}

/** Retorna TODOS os dados do sistema (escopo do correspondente) para exportação em Excel. */
export const exportarBackupCompleto = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["admin.backup", "create"])])
  .handler(async ({ context }): Promise<BackupCompleto> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const tabelas: TabelaExportada[] = [];
    const tabelasComFalha: string[] = [];
    for (const g of GRUPOS_EXPORT) {
      try {
        // Paginado: `.limit(5000)` devolvia as primeiras 1.000 linhas e o
        // backup saía pela metade, sem nenhum aviso (QA 19/09/2026).
        const { data, error } = await todasAsLinhas(() =>
          consultaDoGrupo(supabase, g, corr, g.colunas ?? "*").order("id"),
        );
        if (error) {
          tabelasComFalha.push(g.label);
          continue;
        }
        const brutas = (data ?? []) as Record<string, unknown>[];
        const colunas = brutas.length > 0 ? Object.keys(brutas[0]).filter((k) => k !== "_mae") : [];
        const linhas: Record<string, string | number | boolean | null>[] = brutas.map((r) => {
          const o: Record<string, string | number | boolean | null> = {};
          for (const k of colunas) {
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
        tabelasComFalha.push(g.label);
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

    return { geradoEm: agora, tabelas, tabelasComFalha };
  });
