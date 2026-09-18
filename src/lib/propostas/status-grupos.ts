/**
 * Agrupamento dos status de proposta em categorias de alto nível,
 * usado nos cards-resumo/filtro da listagem de propostas.
 */
import type { PropostaStatus } from "./state-machine";

export type GrupoProposta = "enviadas" | "aprovadas" | "recusadas" | "canceladas";

/** Config de cada grupo (rótulo + tom para o card). */
export const GRUPOS_PROPOSTA: Array<{
  id: GrupoProposta;
  label: string;
  tone: "muted" | "info" | "warning" | "success" | "danger";
}> = [
  { id: "enviadas", label: "Enviadas", tone: "info" },
  { id: "aprovadas", label: "Aprovadas", tone: "success" },
  { id: "recusadas", label: "Recusadas", tone: "warning" },
  { id: "canceladas", label: "Canceladas", tone: "danger" },
];

/**
 * Status de cada grupo, para filtrar no banco em vez de na página. A lista sai
 * do próprio `grupoDoStatus`, então não há como os dois divergirem.
 */
export function statusDoGrupo(grupo: GrupoProposta): PropostaStatus[] {
  return TODOS_OS_STATUS.filter((s) => grupoDoStatus(s) === grupo);
}

const TODOS_OS_STATUS: PropostaStatus[] = [
  "rascunho",
  "enviada_banco",
  "em_analise_credito",
  "credito_aprovado",
  "credito_condicionado",
  "credito_recusado",
  "checklist_documentacao",
  "cadastro_complementar",
  "dossie_completo",
  "formularios",
  "envio_documentos_banco",
  "vistoria_agendamento",
  "vistoria_concluida",
  "emissao_contrato",
  "contrato_emitido",
  "erro_envio",
  "aguardando_envio",
  "cancelada",
  "aguardando_documentos",
  "engenharia_vistoria",
  "analise_juridica",
  "registrado",
];

/** Mapa status -> grupo. Retorna null para status que não se encaixam. */
export function grupoDoStatus(status: string | null | undefined): GrupoProposta | null {
  const s = (status ?? "") as PropostaStatus;
  switch (s) {
    // Enviadas ao banco (em trânsito / em análise, ainda sem decisão).
    case "enviada_banco":
    case "em_analise_credito":
      return "enviadas";
    // Aprovadas (crédito aprovado em diante, incluindo contrato).
    // O condicionado entra aqui: o crédito saiu, ainda que com exigências.
    case "credito_aprovado":
    case "credito_condicionado":
    case "checklist_documentacao":
    case "cadastro_complementar":
    case "dossie_completo":
    case "formularios":
    case "envio_documentos_banco":
    case "vistoria_agendamento":
    case "vistoria_concluida":
    case "emissao_contrato":
    case "contrato_emitido":
    case "aguardando_documentos":
    case "engenharia_vistoria":
    case "analise_juridica":
    case "registrado":
      return "aprovadas";
    // Recusadas pelo banco.
    case "credito_recusado":
      return "recusadas";
    // Canceladas.
    case "cancelada":
      return "canceladas";
    // rascunho / erro_envio não entram em nenhum grupo.
    default:
      return null;
  }
}
