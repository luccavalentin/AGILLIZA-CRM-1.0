import { SITUACOES_BANCO } from "@/lib/propostas/propostas.functions";

export type SituacaoBanco = (typeof SITUACOES_BANCO)[number];

export const SITUACAO_BANCO_LABEL: Record<SituacaoBanco, string> = {
  nao_enviado: "Não enviado",
  em_analise: "Em análise de crédito",
  condicionado: "Aprovado com condições",
  aprovado: "Crédito aprovado",
  recusado: "Crédito recusado",
  cancelado: "Cancelado",
};

export const SITUACAO_BANCO_TONE: Record<
  SituacaoBanco,
  "success" | "danger" | "warning" | "info" | "muted"
> = {
  nao_enviado: "muted",
  em_analise: "info",
  condicionado: "warning",
  aprovado: "success",
  recusado: "danger",
  cancelado: "muted",
};
