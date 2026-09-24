import type { PropostaStatus } from "@/lib/propostas/state-machine";

/**
 * Etapas do stepper da ficha da proposta.
 *
 * São as MESMAS etapas da integração, com os mesmos nomes e na mesma ordem
 * (Simulação, Crédito, Engenharia, Análise Jurídica, Contrato Emitido,
 * Registro), para que a régua daqui acompanhe exatamente o que o provedor
 * move. Antes eram sete, com nomes nossos: "Enviado p/ aprovação" e "Crédito
 * aprovado" partiam a etapa Crédito em duas, "Coleta de documentos" não existe
 * lá e Registro faltava. O detalhe do crédito (enviado, aprovado,
 * condicionado, recusado) continua no rótulo do status.
 *
 * `auto` = etapa que a integração move sozinha.
 */
export const ETAPAS_STEPPER = [
  { codigo: "simulacao", numero: 1, label: "Simulação", auto: false },
  { codigo: "credito", numero: 2, label: "Crédito", auto: true },
  { codigo: "engenharia", numero: 3, label: "Engenharia", auto: true },
  { codigo: "analise_juridica", numero: 4, label: "Análise Jurídica", auto: true },
  { codigo: "contrato_emitido", numero: 5, label: "Contrato Emitido", auto: true },
  { codigo: "registro", numero: 6, label: "Registro", auto: true },
] as const;

export type StepperCodigo = (typeof ETAPAS_STEPPER)[number]["codigo"];

/** propostas.status -> etapa do stepper. */
const MAPA: Record<PropostaStatus, StepperCodigo> = {
  rascunho: "simulacao",
  aguardando_envio: "simulacao",
  erro_envio: "simulacao",
  cancelada: "simulacao",
  // Tudo que é crédito ocupa a etapa Crédito, como no provedor: enviado, em
  // análise, aprovado, condicionado, recusado e a coleta de documentos que
  // acontece dentro dela.
  enviada_banco: "credito",
  em_analise_credito: "credito",
  credito_aprovado: "credito",
  credito_condicionado: "credito",
  credito_recusado: "credito",
  aguardando_documentos: "credito",
  engenharia_vistoria: "engenharia",
  analise_juridica: "analise_juridica",
  contrato_emitido: "contrato_emitido",
  registrado: "registro",
  // Legados granulares -> mapeiam para as etapas do provedor.
  checklist_documentacao: "credito",
  cadastro_complementar: "credito",
  dossie_completo: "credito",
  formularios: "credito",
  envio_documentos_banco: "credito",
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
