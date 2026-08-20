import type { PropostaStatus } from "@/lib/propostas/state-machine";

/**
 * Etapas fixas do stepper da ficha da proposta (ciclo da oportunidade).
 * `auto` = etapa que avança automaticamente pela integração bancária (API).
 * As demais são concluídas/movidas manualmente pelo usuário.
 */
export const ETAPAS_STEPPER = [
  { codigo: "simulacao", numero: 1, label: "Simulação", auto: false },
  { codigo: "credito_enviado", numero: 2, label: "Enviado p/ aprovação de...", auto: true },
  { codigo: "credito_aprovado", numero: 3, label: "Crédito aprovado", auto: true },
  { codigo: "coleta_documentos", numero: 4, label: "Coleta de documentos", auto: false },
  { codigo: "engenharia_vistoria", numero: 5, label: "Engenharia / vistoria", auto: false },
  { codigo: "analise_juridica", numero: 6, label: "Análise jurídica", auto: false },
  { codigo: "contrato", numero: 7, label: "Contrato emitido", auto: false },
] as const;

export type StepperCodigo = (typeof ETAPAS_STEPPER)[number]["codigo"];

/** propostas.status -> etapa do stepper. */
const MAPA: Record<PropostaStatus, StepperCodigo> = {
  rascunho: "simulacao",
  aguardando_envio: "simulacao",
  erro_envio: "simulacao",
  cancelada: "simulacao",
  enviada_banco: "credito_enviado",
  em_analise_credito: "credito_enviado",
  credito_aprovado: "credito_aprovado",
  credito_recusado: "credito_enviado",
  aguardando_documentos: "coleta_documentos",
  engenharia_vistoria: "engenharia_vistoria",
  analise_juridica: "analise_juridica",
  contrato_emitido: "contrato",
  // Legados granulares -> mapeiam para as macro-etapas do fluxo novo.
  checklist_documentacao: "coleta_documentos",
  cadastro_complementar: "coleta_documentos",
  dossie_completo: "coleta_documentos",
  formularios: "coleta_documentos",
  envio_documentos_banco: "coleta_documentos",
  vistoria_agendamento: "engenharia_vistoria",
  vistoria_concluida: "engenharia_vistoria",
  emissao_contrato: "analise_juridica",
  registrado: "contrato",
};

export function etapaDoStatus(status: string): StepperCodigo {
  return MAPA[status as PropostaStatus] ?? "simulacao";
}

/** Índice (0-based) da etapa atual dentro de ETAPAS_STEPPER. */
export function indiceEtapa(status: string): number {
  const cod = etapaDoStatus(status);
  return ETAPAS_STEPPER.findIndex((e) => e.codigo === cod);
}
