import type { Tone } from "@/components/crm/tone-badge";
import type { PropostaStatus } from "@/lib/propostas/state-machine";

/** Mapa oficial de status da proposta -> tom + rótulo (00b-tons-cores). */
export const STATUS_PROPOSTA: Record<PropostaStatus, { tone: Tone; label: string }> = {
  rascunho: { tone: "muted", label: "Simulação" },
  enviada_banco: { tone: "info", label: "Enviado p/ aprovação de crédito" },
  em_analise_credito: { tone: "info", label: "Enviado p/ aprovação de crédito" },
  credito_aprovado: { tone: "success", label: "Crédito aprovado" },
  checklist_documentacao: { tone: "info", label: "Checklist de documentação" },
  cadastro_complementar: { tone: "info", label: "Cadastro complementar" },
  dossie_completo: { tone: "info", label: "Dossiê de documentação" },
  formularios: { tone: "info", label: "Formulários" },
  envio_documentos_banco: { tone: "warning", label: "Envio de docs. ao banco" },
  vistoria_agendamento: { tone: "warning", label: "Vistoria — agendamento" },
  vistoria_concluida: { tone: "warning", label: "Vistoria concluída" },
  emissao_contrato: { tone: "info", label: "Emissão de contrato" },
  contrato_emitido: { tone: "success", label: "Contrato emitido" },
  credito_recusado: { tone: "danger", label: "Crédito recusado" },
  erro_envio: { tone: "danger", label: "Erro no envio" },
  cancelada: { tone: "danger", label: "Cancelada" },
  // Legados.
  aguardando_documentos: { tone: "info", label: "Aguardando documentos" },
  engenharia_vistoria: { tone: "warning", label: "Engenharia / vistoria" },
  analise_juridica: { tone: "warning", label: "Análise jurídica" },
  registrado: { tone: "success", label: "Registrado" },
};

export function statusProposta(status: string): { tone: Tone; label: string } {
  return STATUS_PROPOSTA[status as PropostaStatus] ?? { tone: "muted", label: status };
}
