/**
 * Gatilhos de comissão — espelham EXATAMENTE as etapas do funil (Kanban) das
 * propostas, na ordem em que o sistema executa o fluxo automaticamente:
 *
 *  1 Simulação
 *  2 Enviado p/ aprovação de crédito
 *  3 Em análise de crédito
 *  4 Crédito aprovado  /  Crédito recusado
 *  5 Coleta de documentos
 *  6 Engenharia / vistoria
 *  7 Análise jurídica
 *  8 Contrato emitido
 *
 * Os grupos abaixo são exibidos categorizados; dentro de "Etapas do funil" a
 * ordem é a do Kanban (o fluxo real), e os demais grupos ficam em ordem
 * alfabética.
 */

export interface GatilhoComissao {
  valor: string;
  rotulo: string;
  descricao?: string;
}

/** Etapas do funil, na ordem do Kanban (amarradas à máquina de estados). */
export const GATILHOS_FUNIL: GatilhoComissao[] = [
  { valor: "rascunho", rotulo: "Simulação", descricao: "Proposta criada a partir da simulação" },
  {
    valor: "enviada_banco",
    rotulo: "Enviado p/ aprovação de crédito",
    descricao: "Envio automático ao banco",
  },
  { valor: "em_analise_credito", rotulo: "Em análise de crédito", descricao: "Retorno do banco" },
  { valor: "credito_aprovado", rotulo: "Crédito aprovado", descricao: "Retorno do banco" },
  { valor: "credito_recusado", rotulo: "Crédito recusado", descricao: "Retorno do banco" },
  { valor: "aguardando_documentos", rotulo: "Coleta de documentos" },
  { valor: "engenharia_vistoria", rotulo: "Engenharia / vistoria" },
  { valor: "analise_juridica", rotulo: "Análise jurídica" },
  { valor: "contrato_emitido", rotulo: "Contrato emitido" },
];

/** Encerramentos e lançamentos fora do funil (ordem alfabética). */
export const GATILHOS_OUTROS: GatilhoComissao[] = [
  { valor: "manual", rotulo: "Lançamento manual" },
  { valor: "cancelada", rotulo: "Proposta cancelada" },
].sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));

/**
 * Etapas granulares descontinuadas — não aparecem no seletor, mas continuam
 * sendo traduzidas para exibir regras/lançamentos antigos.
 */
export const GATILHOS_LEGADOS: GatilhoComissao[] = [
  { valor: "checklist_documentacao", rotulo: "Checklist de documentação (legado)" },
  { valor: "cadastro_complementar", rotulo: "Cadastro complementar (legado)" },
  { valor: "dossie_completo", rotulo: "Dossiê completo (legado)" },
  { valor: "formularios", rotulo: "Formulários (legado)" },
  { valor: "envio_documentos_banco", rotulo: "Envio de documentos ao banco (legado)" },
  { valor: "vistoria_agendamento", rotulo: "Vistoria agendada (legado)" },
  { valor: "vistoria_concluida", rotulo: "Vistoria concluída (legado)" },
  { valor: "emissao_contrato", rotulo: "Emissão de contrato (legado)" },
  { valor: "registrado", rotulo: "Registrado em cartório (legado)" },
];

/** Grupos exibidos no seletor (categorizados). */
export const GRUPOS_GATILHOS_COMISSAO: { titulo: string; itens: GatilhoComissao[] }[] = [
  { titulo: "Etapas do funil (ordem do Kanban)", itens: GATILHOS_FUNIL },
  { titulo: "Outros", itens: GATILHOS_OUTROS },
];

/** Lista completa (inclui legados) — usada para validação e rótulos. */
export const GATILHOS_COMISSAO: GatilhoComissao[] = [
  ...GATILHOS_FUNIL,
  ...GATILHOS_OUTROS,
  ...GATILHOS_LEGADOS,
];

export function rotuloGatilho(valor: string | null | undefined): string {
  if (!valor) return "—";
  return GATILHOS_COMISSAO.find((g) => g.valor === valor)?.rotulo ?? valor;
}
