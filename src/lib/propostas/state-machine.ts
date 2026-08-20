/**
 * Máquina de estados da proposta (módulo puro — cliente e servidor).
 * A UI só oferece botões de transições válidas; o servidor revalida.
 *
 * Fluxo (etapas da oportunidade):
 *  1  Simulação                          -> rascunho / erro_envio
 *  2  Enviado para aprovação de crédito  -> enviada_banco / em_analise_credito   (AUTOMÁTICO via API)
 *  3  Crédito aprovado (banco)           -> credito_aprovado                      (AUTOMÁTICO via retorno da API)
 *  4  Coleta de documentos               -> aguardando_documentos                 (manual)
 *  5  Engenharia / vistoria              -> engenharia_vistoria                   (manual)
 *  6  Análise jurídica                   -> analise_juridica                      (manual)
 *  7  Contrato emitido                   -> contrato_emitido                      (manual)
 *
 * Status granulares antigos (checklist_documentacao, cadastro_complementar,
 * dossie_completo, formularios, envio_documentos_banco, vistoria_agendamento,
 * vistoria_concluida, emissao_contrato, registrado) foram descontinuados e são
 * mantidos apenas como LEGADOS: encaminham para o fluxo novo, sem aparecer na UI.
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
  | "aguardando_envio"
  | "cancelada"
  // Status legados (mantidos para compatibilidade com dados/relatórios antigos).
  | "aguardando_documentos"
  | "engenharia_vistoria"
  | "analise_juridica"
  | "registrado";

/** Transições permitidas por status. `cancelada` é permitida de quase qualquer estado. */
export const TRANSICOES: Record<PropostaStatus, PropostaStatus[]> = {
  rascunho: ["aguardando_envio", "enviada_banco", "erro_envio", "cancelada"],
  aguardando_envio: ["enviada_banco", "erro_envio", "cancelada"],
  erro_envio: ["aguardando_envio", "enviada_banco", "cancelada"],
  enviada_banco: [
    "em_analise_credito",
    "credito_aprovado",
    "credito_recusado",
    "erro_envio",
    "cancelada",
  ],
  em_analise_credito: ["credito_aprovado", "credito_recusado", "cancelada"],
  credito_aprovado: ["aguardando_documentos", "cancelada"],
  aguardando_documentos: ["engenharia_vistoria", "cancelada"],
  engenharia_vistoria: ["analise_juridica", "cancelada"],
  analise_juridica: ["contrato_emitido", "cancelada"],
  contrato_emitido: [],
  credito_recusado: [],
  cancelada: [],
  // Legados granulares -> encaminham para o fluxo novo simplificado.
  checklist_documentacao: ["aguardando_documentos", "cancelada"],
  cadastro_complementar: ["aguardando_documentos", "cancelada"],
  dossie_completo: ["aguardando_documentos", "cancelada"],
  formularios: ["aguardando_documentos", "cancelada"],
  envio_documentos_banco: ["engenharia_vistoria", "cancelada"],
  vistoria_agendamento: ["analise_juridica", "cancelada"],
  vistoria_concluida: ["analise_juridica", "cancelada"],
  emissao_contrato: ["contrato_emitido", "cancelada"],
  registrado: [],
};

/** Ordem de progressão do fluxo (usada para não retroceder o status). */
export const ORDEM_STATUS: PropostaStatus[] = [
  "rascunho",
  "aguardando_envio",
  "erro_envio",
  "enviada_banco",
  "em_analise_credito",
  "credito_aprovado",
  "aguardando_documentos",
  "engenharia_vistoria",
  "analise_juridica",
  "contrato_emitido",
];

export function transicaoPermitida(de: PropostaStatus, para: PropostaStatus): boolean {
  if (!de) return false;
  const validas = TRANSICOES[de] ?? [];
  return validas.includes(para);
}

/** Status que ainda aceitam edição dos dados da proposta. */
export const STATUS_EDITAVEIS: PropostaStatus[] = ["rascunho", "aguardando_documentos"];

export const STATUS_TERMINAIS: PropostaStatus[] = [
  "contrato_emitido",
  "registrado",
  "credito_recusado",
  "cancelada",
];
