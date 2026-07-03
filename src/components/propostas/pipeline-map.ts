import type { PropostaStatus } from "@/lib/propostas/state-machine";

/** Etapas fixas do stepper da ficha da proposta (modelo do banco). */
export const ETAPAS_STEPPER = [
  { codigo: "simulacao", label: "Simulação" },
  { codigo: "credito", label: "Crédito" },
  { codigo: "engenharia", label: "Engenharia" },
  { codigo: "juridica", label: "Análise Jurídica" },
  { codigo: "contrato", label: "Contrato Emitido" },
  { codigo: "registro", label: "Registro" },
] as const;

export type StepperCodigo = (typeof ETAPAS_STEPPER)[number]["codigo"];

/** propostas.status -> etapa do stepper. */
const MAPA: Record<PropostaStatus, StepperCodigo> = {
  rascunho: "simulacao",
  enviada_banco: "simulacao",
  erro_envio: "simulacao",
  em_analise_credito: "credito",
  credito_aprovado: "credito",
  credito_recusado: "credito",
  aguardando_documentos: "credito",
  engenharia_vistoria: "engenharia",
  analise_juridica: "juridica",
  contrato_emitido: "contrato",
  registrado: "registro",
  cancelada: "simulacao",
};

export function etapaDoStatus(status: string): StepperCodigo {
  return MAPA[status as PropostaStatus] ?? "simulacao";
}

/** Índice (0-based) da etapa atual dentro de ETAPAS_STEPPER. */
export function indiceEtapa(status: string): number {
  const cod = etapaDoStatus(status);
  return ETAPAS_STEPPER.findIndex((e) => e.codigo === cod);
}
