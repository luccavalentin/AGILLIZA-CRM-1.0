/**
 * Agrupamento dos status de proposta em categorias de alto nível,
 * usado nos cards-resumo/filtro da listagem de propostas.
 */
import type { PropostaStatus } from "./state-machine";

export type GrupoProposta =
  | "rascunho"
  | "enviadas"
  | "andamento"
  | "contrato"
  | "encerradas";

/** Config de cada grupo (rótulo + tom para o card). */
export const GRUPOS_PROPOSTA: Array<{
  id: GrupoProposta;
  label: string;
  tone: "muted" | "info" | "warning" | "success" | "danger";
}> = [
  { id: "rascunho", label: "Em rascunho", tone: "muted" },
  { id: "enviadas", label: "Em análise", tone: "info" },
  { id: "andamento", label: "Em andamento", tone: "warning" },
  { id: "contrato", label: "Contrato emitido", tone: "success" },
  { id: "encerradas", label: "Canceladas / recusadas", tone: "danger" },
];

/** Mapa status -> grupo. */
export function grupoDoStatus(status: string | null | undefined): GrupoProposta {
  const s = (status ?? "") as PropostaStatus;
  switch (s) {
    case "rascunho":
    case "erro_envio":
      return "rascunho";
    case "enviada_banco":
    case "em_analise_credito":
      return "enviadas";
    case "credito_aprovado":
    case "checklist_documentacao":
    case "cadastro_complementar":
    case "dossie_completo":
    case "formularios":
    case "envio_documentos_banco":
    case "vistoria_agendamento":
    case "vistoria_concluida":
    case "emissao_contrato":
    case "aguardando_documentos":
    case "engenharia_vistoria":
    case "analise_juridica":
      return "andamento";
    case "contrato_emitido":
    case "registrado":
      return "contrato";
    case "cancelada":
    case "credito_recusado":
      return "encerradas";
    default:
      return "andamento";
  }
}
