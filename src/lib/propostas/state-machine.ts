/**
 * Máquina de estados da proposta (módulo puro — cliente e servidor).
 * A UI só oferece botões de transições válidas; o servidor revalida.
 *
 * Fluxo (etapas da oportunidade):
 *  1  Simulação                          -> rascunho / erro_envio
 *  2  Enviado para aprovação de crédito  -> enviada_banco / em_analise_credito   (AUTOMÁTICO via API)
 *  3  Crédito aprovado (banco)           -> credito_aprovado                      (AUTOMÁTICO via retorno da API)
 *  4  Checklist de documentação          -> checklist_documentacao                (manual)
 *  5  Cadastro complementar              -> cadastro_complementar                 (manual)
 *  6  Dossiê de documentação completa    -> dossie_completo                       (manual)
 *  7  Formulários                        -> formularios                          (manual)
 *  8  Envio de documentos ao banco       -> envio_documentos_banco               (manual)
 *  10 Vistoria — agendamento             -> vistoria_agendamento                 (manual)
 *  11 Vistoria concluída                 -> vistoria_concluida                   (manual)
 *  12 Emissão de contrato                -> emissao_contrato                     (manual)
 *  13 Contrato emitido                   -> contrato_emitido                     (manual)
 */
export type PropostaStatus =
  | "rascunho"
  | "enviada_banco"
  | "em_analise_credito"
  | "credito_aprovado"
  | "credito_recusado"
  | "checklist_documentacao"
  | "cadastro_complementar"
  | "dossie_completo"
  | "formularios"
  | "envio_documentos_banco"
  | "vistoria_agendamento"
  | "vistoria_concluida"
  | "emissao_contrato"
  | "contrato_emitido"
  | "erro_envio"
  | "cancelada"
  // Status legados (mantidos para compatibilidade com dados/relatórios antigos).
  | "aguardando_documentos"
  | "engenharia_vistoria"
  | "analise_juridica"
  | "registrado";

/** Transições permitidas por status. `cancelada` é permitida de quase qualquer estado. */
export const TRANSICOES: Record<PropostaStatus, PropostaStatus[]> = {
  rascunho: ["enviada_banco", "erro_envio", "cancelada"],
  erro_envio: ["enviada_banco", "cancelada"],
  enviada_banco: ["em_analise_credito", "credito_aprovado", "credito_recusado", "erro_envio", "cancelada"],
  em_analise_credito: ["credito_aprovado", "credito_recusado", "cancelada"],
  credito_aprovado: ["checklist_documentacao", "cancelada"],
  checklist_documentacao: ["cadastro_complementar", "cancelada"],
  cadastro_complementar: ["dossie_completo", "cancelada"],
  dossie_completo: ["formularios", "cancelada"],
  formularios: ["envio_documentos_banco", "cancelada"],
  envio_documentos_banco: ["vistoria_agendamento", "cancelada"],
  vistoria_agendamento: ["vistoria_concluida", "cancelada"],
  vistoria_concluida: ["emissao_contrato", "cancelada"],
  emissao_contrato: ["contrato_emitido", "cancelada"],
  contrato_emitido: [],
  credito_recusado: [],
  cancelada: [],
  // Legados -> encaminham para o fluxo novo.
  aguardando_documentos: ["checklist_documentacao", "cancelada"],
  engenharia_vistoria: ["vistoria_concluida", "cancelada"],
  analise_juridica: ["emissao_contrato", "cancelada"],
  registrado: [],
};

/** Ordem de progressão do fluxo (usada para não retroceder o status). */
export const ORDEM_STATUS: PropostaStatus[] = [
  "rascunho",
  "erro_envio",
  "enviada_banco",
  "em_analise_credito",
  "credito_aprovado",
  "checklist_documentacao",
  "cadastro_complementar",
  "dossie_completo",
  "formularios",
  "envio_documentos_banco",
  "vistoria_agendamento",
  "vistoria_concluida",
  "emissao_contrato",
  "contrato_emitido",
];

export function transicaoPermitida(de: PropostaStatus, para: PropostaStatus): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}

/** Status que ainda aceitam edição dos dados da proposta. */
export const STATUS_EDITAVEIS: PropostaStatus[] = [
  "rascunho",
  "checklist_documentacao",
  "cadastro_complementar",
  "aguardando_documentos",
];

export const STATUS_TERMINAIS: PropostaStatus[] = [
  "contrato_emitido",
  "registrado",
  "credito_recusado",
  "cancelada",
];
