import type { Tone } from "@/components/crm/tone-badge";
import type { PropostaStatus } from "@/lib/propostas/state-machine";

/** Mapa oficial de status da proposta -> tom + rótulo (00b-tons-cores). */
export const STATUS_PROPOSTA: Record<PropostaStatus, { tone: Tone; label: string }> = {
  rascunho: { tone: "muted", label: "Rascunho" },
  enviada_banco: { tone: "info", label: "Enviada ao banco" },
  em_analise_credito: { tone: "info", label: "Em análise de crédito" },
  aguardando_documentos: { tone: "info", label: "Aguardando documentos" },
  credito_aprovado: { tone: "success", label: "Crédito aprovado" },
  engenharia_vistoria: { tone: "warning", label: "Engenharia / vistoria" },
  analise_juridica: { tone: "warning", label: "Análise jurídica" },
  contrato_emitido: { tone: "success", label: "Contrato emitido" },
  registrado: { tone: "success", label: "Registrado" },
  credito_recusado: { tone: "danger", label: "Crédito recusado" },
  erro_envio: { tone: "danger", label: "Erro no envio" },
  cancelada: { tone: "danger", label: "Cancelada" },
};

export function statusProposta(status: string): { tone: Tone; label: string } {
  return STATUS_PROPOSTA[status as PropostaStatus] ?? { tone: "muted", label: status };
}
