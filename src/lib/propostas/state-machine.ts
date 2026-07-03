/**
 * Máquina de estados da proposta (módulo puro — cliente e servidor).
 * A UI só oferece botões de transições válidas; o servidor revalida.
 */
export type PropostaStatus =
  | "rascunho"
  | "enviada_banco"
  | "em_analise_credito"
  | "credito_aprovado"
  | "credito_recusado"
  | "aguardando_documentos"
  | "engenharia_vistoria"
  | "analise_juridica"
  | "contrato_emitido"
  | "registrado"
  | "erro_envio"
  | "cancelada";

/** Transições permitidas por status. `cancelada` é permitida de quase qualquer estado. */
export const TRANSICOES: Record<PropostaStatus, PropostaStatus[]> = {
  rascunho: ["enviada_banco", "erro_envio", "cancelada"],
  erro_envio: ["enviada_banco", "cancelada"],
  enviada_banco: ["em_analise_credito", "erro_envio", "cancelada"],
  em_analise_credito: ["credito_aprovado", "credito_recusado", "cancelada"],
  credito_aprovado: ["aguardando_documentos", "engenharia_vistoria", "cancelada"],
  aguardando_documentos: ["engenharia_vistoria", "cancelada"],
  engenharia_vistoria: ["analise_juridica", "cancelada"],
  analise_juridica: ["contrato_emitido", "cancelada"],
  contrato_emitido: ["registrado"],
  registrado: [],
  credito_recusado: [],
  cancelada: [],
};

export function transicaoPermitida(de: PropostaStatus, para: PropostaStatus): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}

/** Status que ainda aceitam edição dos dados da proposta. */
export const STATUS_EDITAVEIS: PropostaStatus[] = ["rascunho", "aguardando_documentos"];

export const STATUS_TERMINAIS: PropostaStatus[] = ["registrado", "credito_recusado", "cancelada"];
