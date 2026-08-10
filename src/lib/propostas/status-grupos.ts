/**
 * Agrupamento dos status de proposta em categorias de alto nível,
 * usado nos cards-resumo/filtro da listagem de propostas.
 */
import type { PropostaStatus } from "./state-machine";

export type GrupoProposta =
  | "enviadas"
  | "aprovadas"
  | "recusadas"
  | "canceladas";

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

/** Mapa status -> grupo. Retorna null para status que não se encaixam. */
export function grupoDoStatus(status: string | null | undefined): GrupoProposta | null {
  const s = (status ?? "") as PropostaStatus;
  switch (s) {
    // Enviadas ao banco (em trânsito / em análise, ainda sem decisão).
    case "enviada_banco":
    case "em_analise_credito":
      return "enviadas";
    // Aprovadas (crédito aprovado em diante, incluindo contrato).
    case "credito_aprovado":
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

