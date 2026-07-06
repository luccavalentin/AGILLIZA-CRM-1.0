import type { PropostaStatus } from "@/lib/propostas/state-machine";

/**
 * Etapas fixas do stepper da ficha da proposta (ciclo da oportunidade).
 * `auto` = etapa que avança automaticamente pela integração bancária (API).
 * As demais são concluídas/movidas manualmente pelo usuário.
 * `numero` = rótulo exibido (segue a numeração de negócio, que pula o 9).
 */
export const ETAPAS_STEPPER = [
  { codigo: "simulacao", numero: 1, label: "Simulação", auto: false },
  { codigo: "credito_enviado", numero: 2, label: "Enviado p/ aprovação de crédito", auto: true },
  { codigo: "credito_aprovado", numero: 3, label: "Crédito aprovado", auto: true },
  { codigo: "checklist", numero: 4, label: "Checklist de documentação", auto: false },
  { codigo: "cadastro_complementar", numero: 5, label: "Cadastro complementar", auto: false },
  { codigo: "dossie", numero: 6, label: "Dossiê de documentação", auto: false },
  { codigo: "formularios", numero: 7, label: "Formulários", auto: false },
  { codigo: "envio_docs", numero: 8, label: "Envio de docs. ao banco", auto: false },
  { codigo: "vistoria_agenda", numero: 10, label: "Vistoria — agendamento", auto: false },
  { codigo: "vistoria_ok", numero: 11, label: "Vistoria concluída", auto: false },
  { codigo: "emissao_contrato", numero: 12, label: "Emissão de contrato", auto: false },
  { codigo: "contrato", numero: 13, label: "Contrato emitido", auto: false },
] as const;

export type StepperCodigo = (typeof ETAPAS_STEPPER)[number]["codigo"];

/** propostas.status -> etapa do stepper. */
const MAPA: Record<PropostaStatus, StepperCodigo> = {
  rascunho: "simulacao",
  erro_envio: "simulacao",
  cancelada: "simulacao",
  enviada_banco: "credito_enviado",
  em_analise_credito: "credito_enviado",
  credito_aprovado: "credito_aprovado",
  credito_recusado: "credito_aprovado",
  checklist_documentacao: "checklist",
  cadastro_complementar: "cadastro_complementar",
  dossie_completo: "dossie",
  formularios: "formularios",
  envio_documentos_banco: "envio_docs",
  vistoria_agendamento: "vistoria_agenda",
  vistoria_concluida: "vistoria_ok",
  emissao_contrato: "emissao_contrato",
  contrato_emitido: "contrato",
  // Legados.
  aguardando_documentos: "checklist",
  engenharia_vistoria: "vistoria_agenda",
  analise_juridica: "emissao_contrato",
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
