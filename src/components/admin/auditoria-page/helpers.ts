import {
  Activity,
  FileEdit,
  FilePlus2,
  KeyRound,
  Send,
  Trash2,
  UserCog,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { AuditoriaLinha } from "@/lib/admin/auditoria.functions";

export const TODOS = "__todos__";

/**
 * Mapeia o nome interno da entidade (tabela / recurso) para o nome da tela
 * correspondente no sistema, para exibição amigável na Auditoria.
 */
export const ENTIDADE_LABEL: Record<string, string> = {
  clientes: "CRM · Clientes",
  cliente: "CRM · Clientes",
  cliente_documentos: "CRM · Documentos do cliente",
  cliente_documento_pastas: "CRM · Pastas de documentos",
  cliente_interacoes: "CRM · Interações",
  cliente_pipeline: "CRM · Esteira",
  propostas: "Operacional · Propostas",
  proposta_bancos: "Operacional · Propostas (Banco)",
  proposta_documentos: "Operacional · Documentos da proposta",
  simulacoes: "Operacional · Simulações",
  simulacao_bancos: "Operacional · Simulações (Banco)",
  tasks: "Operacional · Tarefas",
  demandas: "Operacional · Demandas",
  profiles: "Administração · Pessoas",
  access_levels: "Administração · Papéis de acesso",
  permissions: "Administração · Permissões",
  tipos_pessoa: "Administração · Tipos de pessoa",
  banco_credenciais: "Administração · Bancos",
  admin_api_integrations: "Administração · APIs de IA",
  parametros_globais: "Administração · Parâmetros",
  financial_payables: "Financeiro · Contas a pagar",
  financial_receivables: "Financeiro · Contas a receber",
  comissao_regras: "Financeiro · Regras de repasse",
  comissao_regras_usuario: "Financeiro · Regras de comissão",
  comissoes: "Financeiro · Repasses",
  comissoes_usuario: "Financeiro · Comissões",
};

export function rotuloEntidade(entidade: string | null | undefined): string {
  if (!entidade) return "—";
  return ENTIDADE_LABEL[entidade] ?? entidade.replace(/[._]/g, " ");
}


export interface Filtros {
  dataInicio: string;
  dataFim: string;
  userId: string;
  acao: string;
  entidade: string;
  busca: string;
}

export const FILTROS_VAZIOS: Filtros = {
  dataInicio: "",
  dataFim: "",
  userId: "",
  acao: "",
  entidade: "",
  busca: "",
};

export type Tom = "criar" | "atualizar" | "excluir" | "enviar" | "seguranca" | "neutro";

export const TOM_CLASSES: Record<Tom, { chip: string; dot: string; ring: string }> = {
  criar: {
    chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/25",
  },
  atualizar: {
    chip: "bg-primary/12 text-primary",
    dot: "bg-primary",
    ring: "ring-primary/25",
  },
  excluir: {
    chip: "bg-destructive/12 text-destructive",
    dot: "bg-destructive",
    ring: "ring-destructive/25",
  },
  enviar: {
    chip: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
    dot: "bg-sky-500",
    ring: "ring-sky-500/25",
  },
  seguranca: {
    chip: "bg-amber-500/12 text-amber-600 dark:text-amber-500",
    dot: "bg-amber-500",
    ring: "ring-amber-500/25",
  },
  neutro: {
    chip: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
    ring: "ring-border",
  },
};

export function classificar(acao: string): { tom: Tom; Icone: LucideIcon } {
  const a = acao.toLowerCase();
  if (a.includes("resetar_senha") || a.includes("habilitar_login") || a.includes("permiss"))
    return { tom: "seguranca", Icone: KeyRound };
  if (a.includes("excluir") || a.includes("desativar"))
    return { tom: "excluir", Icone: Trash2 };
  if (a.includes("enviar")) return { tom: "enviar", Icone: Send };
  if (a.includes("criar") || a.includes("anexar") || a.includes("cadastr") || a.includes("ativar"))
    return {
      tom: "criar",
      Icone: a.includes("pessoa") || a.includes("cliente") ? UserPlus : FilePlus2,
    };
  if (a.includes("atualizar") || a.includes("editar") || a.includes("renomear") || a.includes("personalizar"))
    return {
      tom: "atualizar",
      Icone: a.includes("pessoa") || a.includes("cliente") ? UserCog : FileEdit,
    };
  return { tom: "neutro", Icone: Activity };
}

export function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function chaveDia(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function isHoje(iso: string): boolean {
  const d = new Date(iso);
  const h = new Date();
  return (
    d.getDate() === h.getDate() &&
    d.getMonth() === h.getMonth() &&
    d.getFullYear() === h.getFullYear()
  );
}

export function diffPayload(
  anterior: unknown,
  novo: unknown,
): { campo: string; de: string; para: string }[] {
  const a = (anterior && typeof anterior === "object" ? anterior : {}) as Record<string, unknown>;
  const n = (novo && typeof novo === "object" ? novo : {}) as Record<string, unknown>;
  const chaves = [...new Set([...Object.keys(a), ...Object.keys(n)])].sort();
  const fmt = (v: unknown) =>
    v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return chaves
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(n[k]))
    .map((k) => ({ campo: k, de: fmt(a[k]), para: fmt(n[k]) }));
}

export function exportarCsv(registros: AuditoriaLinha[]): void {
  const cabecalho = [
    "Data/Hora",
    "Usuário",
    "Ação",
    "Descrição",
    "Entidade",
    "ID Entidade",
    "IP",
    "Navegador",
  ];
  const escapar = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const linhas = registros.map((r) =>
    [
      fmtDataHora(r.created_at),
      r.ator_nome ?? "",
      r.acao_label,
      r.descricao ?? "",
      r.entidade ?? "",
      r.entidade_id ?? "",
      r.ip ?? "",
      r.user_agent ?? "",
    ]
      .map(escapar)
      .join(","),
  );
  const csv = "\ufeff" + [cabecalho.map(escapar).join(","), ...linhas].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
