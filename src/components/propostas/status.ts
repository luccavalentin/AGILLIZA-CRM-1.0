import type { Tone } from "@/components/crm/tone-badge";
import type { PropostaStatus } from "@/lib/propostas/state-machine";

/** Mapa oficial de status da proposta -> tom + rótulo (00b-tons-cores). */
export const STATUS_PROPOSTA: Record<PropostaStatus, { tone: Tone; label: string }> = {
  rascunho: { tone: "muted", label: "Simulação" },
  aguardando_envio: { tone: "info", label: "Aguardando envio" },
  enviada_banco: { tone: "info", label: "Enviado p/ aprovação de crédito" },
  em_analise_credito: { tone: "info", label: "Enviado p/ aprovação de crédito" },
  credito_aprovado: { tone: "success", label: "Crédito aprovado" },
  aguardando_documentos: { tone: "info", label: "Coleta de documentos" },
  engenharia_vistoria: { tone: "warning", label: "Engenharia / vistoria" },
  analise_juridica: { tone: "warning", label: "Análise jurídica" },
  contrato_emitido: { tone: "success", label: "Contrato emitido" },
  credito_recusado: { tone: "danger", label: "Crédito recusado" },
  erro_envio: { tone: "danger", label: "Erro no envio" },
  cancelada: { tone: "danger", label: "Cancelada" },
  // Legados granulares (mantidos p/ compatibilidade com dados/relatórios antigos).
  checklist_documentacao: { tone: "info", label: "Coleta de documentos" },
  cadastro_complementar: { tone: "info", label: "Coleta de documentos" },
  dossie_completo: { tone: "info", label: "Coleta de documentos" },
  formularios: { tone: "info", label: "Coleta de documentos" },
  envio_documentos_banco: { tone: "info", label: "Coleta de documentos" },
  vistoria_agendamento: { tone: "warning", label: "Engenharia / vistoria" },
  vistoria_concluida: { tone: "warning", label: "Engenharia / vistoria" },
  emissao_contrato: { tone: "warning", label: "Análise jurídica" },
  registrado: { tone: "success", label: "Registrado" },
};

export function statusProposta(status: string): { tone: Tone; label: string } {
  return STATUS_PROPOSTA[status as PropostaStatus] ?? { tone: "muted", label: status };
}
