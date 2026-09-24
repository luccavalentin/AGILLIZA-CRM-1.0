import type { PropostaStatus } from "@/lib/propostas/state-machine";

/**
 * Etapas do stepper da ficha da proposta.
 *
 * São as etapas da integração, com os mesmos nomes e na mesma ordem
 * (Simulação, Crédito, Engenharia, Análise Jurídica, Contrato Emitido,
 * Registro), mais "Documentos", que é só nossa: lá "Envio de Documentos" é
 * atividade da Engenharia, e a coleta precisa aparecer antes de o provedor
 * abrir aquela etapa. O detalhe do crédito (enviado, aprovado, condicionado,
 * recusado) continua no rótulo do status.
 *
 * `auto` = etapa que a integração move sozinha. "Documentos" entra quando o
 * primeiro documento chega à integração (ver `documentos.server.ts`).
 */
export const ETAPAS_STEPPER = [
  { codigo: "simulacao", numero: 1, label: "Simulação", auto: false },
  { codigo: "credito", numero: 2, label: "Crédito", auto: true },
  { codigo: "documentos", numero: 3, label: "Documentos", auto: true },
  { codigo: "engenharia", numero: 4, label: "Engenharia", auto: true },
  { codigo: "analise_juridica", numero: 5, label: "Análise Jurídica", auto: true },
  { codigo: "contrato_emitido", numero: 6, label: "Contrato Emitido", auto: true },
  { codigo: "registro", numero: 7, label: "Registro", auto: true },
] as const;

export type StepperCodigo = (typeof ETAPAS_STEPPER)[number]["codigo"];

/** propostas.status -> etapa do stepper. */
const MAPA: Record<PropostaStatus, StepperCodigo> = {
  rascunho: "simulacao",
  aguardando_envio: "simulacao",
  erro_envio: "simulacao",
  cancelada: "simulacao",
  // Tudo que é crédito ocupa a etapa Crédito, como no provedor: enviado, em
  // análise, aprovado, condicionado e recusado.
  enviada_banco: "credito",
  em_analise_credito: "credito",
  credito_aprovado: "credito",
  credito_condicionado: "credito",
  credito_recusado: "credito",
  aguardando_documentos: "documentos",
  engenharia_vistoria: "engenharia",
  analise_juridica: "analise_juridica",
  contrato_emitido: "contrato_emitido",
  registrado: "registro",
  // Legados granulares -> mapeiam para as etapas atuais.
  checklist_documentacao: "documentos",
  cadastro_complementar: "documentos",
  dossie_completo: "documentos",
  formularios: "documentos",
  envio_documentos_banco: "documentos",
  vistoria_agendamento: "engenharia",
  vistoria_concluida: "engenharia",
  emissao_contrato: "analise_juridica",
};

export function etapaDoStatus(status: string): StepperCodigo {
  return MAPA[status as PropostaStatus] ?? "simulacao";
}

/** Índice (0-based) da etapa atual dentro de ETAPAS_STEPPER. */
export function indiceEtapa(status: string): number {
  const cod = etapaDoStatus(status);
  return ETAPAS_STEPPER.findIndex((e) => e.codigo === cod);
}
