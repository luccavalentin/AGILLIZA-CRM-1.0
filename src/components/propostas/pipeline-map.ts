import type { PropostaStatus } from "@/lib/propostas/state-machine";
import { nomeEtapaFormularios, temEtapaFormularios } from "@/lib/bancos/etapas-banco";

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
 * Itaú e Santander têm ainda a etapa de formulários entre o crédito e os
 * documentos, com o nome do portal de cada um (ver `etapasDoBanco`).
 *
 * `auto` = etapa que a integração move sozinha. "Documentos" entra quando o
 * primeiro documento chega à integração (ver `documentos.server.ts`).
 */
export const ETAPAS_STEPPER = [
  { codigo: "simulacao", label: "Simulação", auto: false },
  { codigo: "credito", label: "Crédito", auto: true },
  { codigo: "formularios", label: "Formulários", auto: true },
  { codigo: "documentos", label: "Documentos", auto: true },
  { codigo: "engenharia", label: "Engenharia", auto: true },
  { codigo: "analise_juridica", label: "Análise Jurídica", auto: true },
  { codigo: "contrato_emitido", label: "Contrato Emitido", auto: true },
  { codigo: "registro", label: "Registro", auto: true },
] as const;

export type StepperCodigo = (typeof ETAPAS_STEPPER)[number]["codigo"];

export interface EtapaStepper {
  codigo: StepperCodigo;
  /** 1, 2, 3… na régua deste banco. */
  numero: number;
  label: string;
  auto: boolean;
}

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
  formularios: "formularios",
  aguardando_documentos: "documentos",
  engenharia_vistoria: "engenharia",
  analise_juridica: "analise_juridica",
  contrato_emitido: "contrato_emitido",
  registrado: "registro",
  // Legados granulares -> mapeiam para as etapas atuais.
  checklist_documentacao: "documentos",
  cadastro_complementar: "documentos",
  dossie_completo: "documentos",
  envio_documentos_banco: "documentos",
  vistoria_agendamento: "engenharia",
  vistoria_concluida: "engenharia",
  emissao_contrato: "analise_juridica",
};

export function etapaDoStatus(status: string): StepperCodigo {
  return MAPA[status as PropostaStatus] ?? "simulacao";
}

/**
 * A régua deste banco: Itaú e Santander com a etapa de formulários (no nome
 * do portal de cada um), Bradesco sem ela. Uma proposta que já está em
 * `formularios` sempre mostra a etapa, mesmo com o banco desconhecido.
 */
export function etapasDoBanco(nomeBanco?: string | null, status?: string | null): EtapaStepper[] {
  const comFormularios = temEtapaFormularios(nomeBanco) || status === "formularios";
  return ETAPAS_STEPPER.filter((e) => e.codigo !== "formularios" || comFormularios).map((e, i) => ({
    codigo: e.codigo,
    numero: i + 1,
    label: e.codigo === "formularios" ? nomeEtapaFormularios(nomeBanco) : e.label,
    auto: e.auto,
  }));
}

/** Índice (0-based) da etapa atual dentro da régua do banco. */
export function indiceEtapa(status: string, nomeBanco?: string | null): number {
  const cod = etapaDoStatus(status);
  return etapasDoBanco(nomeBanco, status).findIndex((e) => e.codigo === cod);
}
