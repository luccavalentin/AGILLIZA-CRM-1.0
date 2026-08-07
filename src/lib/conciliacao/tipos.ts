/** Tipos compartilhados do módulo de Conciliação Bancária (client-safe). */

export type ResultadoConciliacao =
  | "conferido"
  | "divergente"
  | "ausente_no_sistema"
  | "ausente_no_banco";

export const RESULTADO_LABEL: Record<ResultadoConciliacao, string> = {
  conferido: "Conferido",
  divergente: "Divergente",
  ausente_no_sistema: "Ausente no sistema",
  ausente_no_banco: "Ausente no banco",
};

export const RESULTADO_TONE: Record<ResultadoConciliacao, string> = {
  conferido: "text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  divergente: "text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10",
  ausente_no_sistema: "text-red-600 dark:text-red-400 border-red-500/40 bg-red-500/10",
  ausente_no_banco: "text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10",
};

export interface ConciliacaoLote {
  id: string;
  banco_nome: string;
  periodo_referencia: string;
  nome_arquivo: string;
  enviado_por: string | null;
  enviado_por_nome?: string | null;
  enviado_em: string;
  total_linhas: number;
  total_conferidas: number;
  total_divergentes: number;
  total_ausentes_sistema: number;
  total_ausentes_banco: number;
}

export interface ConciliacaoItem {
  id: string;
  lote_id: string;
  numero_proposta_banco: string | null;
  nome_cliente_banco: string | null;
  cpf_banco: string | null;
  status_banco: string | null;
  valor_financiamento_banco: number | null;
  data_envio_banco: string | null;
  data_emissao_banco: string | null;
  data_assinatura_banco: string | null;
  produto_banco: string | null;
  proposta_id: string | null;
  proposta_banco_id: string | null;
  status_sistema: string | null;
  valor_financiamento_sistema: number | null;
  numero_proposta_sistema: string | null;
  resultado: ResultadoConciliacao;
  detalhe_divergencia: string | null;
}

export interface ResumoBanco {
  banco_nome: string;
  total: number;
  conferidas: number;
  divergentes: number;
  ausentes_sistema: number;
  ausentes_banco: number;
  percentual_conferido: number;
}
