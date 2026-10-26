/** Formatos que as funções fin_* do banco devolvem (migrações 2026102705000*). */

export type Natureza = "comissao_banco" | "comissao_participante" | "conta_pagar" | "conta_receber" | "repasse_assinante";

export type SituacaoBanco = "previsto" | "a_receber" | "parcial" | "recebido" | "divergente" | "contestado" | "cancelado";
export type SituacaoParticipante =
  | "prevista"
  | "aguardando_confirmacao"
  | "aprovada"
  | "parcial"
  | "paga"
  | "contestada"
  | "ajustada"
  | "cancelada";
export type Papel = "originou" | "atendeu" | "participou";
export type BaseParticipante = "valor_financiado" | "valor_contrato" | "comissao_banco";

export interface ComissaoBanco {
  id: string;
  proposta_id: string | null;
  numero_proposta: string | null;
  proposta_status: string | null;
  cliente: string | null;
  banco: string | null;
  produto: string | null;
  contrato: string | null;
  base: number;
  percentual: number;
  previsto: number;
  informado: number | null;
  recebido: number;
  diferenca: number | null;
  situacao: SituacaoBanco;
  previsao_recebimento: string | null;
  origem: "gatilho" | "manual" | "migracao";
  sem_regra: boolean;
  criado_em: string;
}

export interface ListaComissoesBanco {
  itens: ComissaoBanco[];
  totais: {
    quantidade: number;
    previsto: number;
    informado: number;
    recebido: number;
    a_receber: number;
    divergentes: number;
    contestadas: number;
    vencidas: number;
  };
}

export interface ComissaoParticipante {
  id: string;
  proposta_id: string | null;
  numero_proposta: string | null;
  pessoa_id: string;
  pessoa: string | null;
  pessoa_tipo: string | null;
  papel: Papel | null;
  tipo_vinculo: string;
  gatilho: string;
  banco: string | null;
  produto: string | null;
  base_calculo: BaseParticipante;
  base: number;
  percentual: number;
  tipo_valor: "percentual" | "fixo";
  valor: number;
  valor_original: number | null;
  pago: number;
  saldo: number;
  situacao: SituacaoParticipante;
  vencimento: string | null;
  origem: string;
  regra_individual: boolean;
  contestacao_motivo: string | null;
  ajuste_motivo: string | null;
  criado_em: string;
}

export interface ListaComissoesParticipantes {
  itens: ComissaoParticipante[];
  totais: { quantidade: number; previstas: number; aguardando: number; aprovadas: number; pagas: number; contestadas: number };
}

export interface ContaFin {
  id: string;
  numero: string | null;
  descricao: string;
  contraparte: string | null;
  vencimento: string;
  valor: number;
  valor_pago: number;
  status: "aberta" | "parcial" | "paga" | "atrasada" | "cancelada" | "estornada";
  recorrencia: string;
  parcela_numero: number | null;
  parcelas: number | null;
  categoria_id: string | null;
  cost_center_id: string | null;
  payment_method_id: string | null;
  rascunho: boolean;
  linha_digitavel: string | null;
  fornecedor_id: string | null;
  proposta_id: string | null;
  origem_tipo: string | null;
  observacao: string | null;
  created_at: string;
  vencida: boolean;
  categoria: string | null;
  centro_custo: string | null;
}

export interface ListaContas {
  itens: ContaFin[];
  totais: {
    abertas: number;
    abertas_qtd: number;
    vencidas: number;
    vencidas_qtd: number;
    pagas: number;
    recorrentes_qtd: number;
    rascunhos_qtd: number;
  };
}

export interface ItemCadastro {
  id: string;
  nome: string;
  ativo: boolean;
  tipo?: "despesa" | "receita";
}
export interface ContaBancaria {
  id: string;
  apelido: string;
  banco_codigo: string | null;
  banco_nome: string | null;
  agencia: string | null;
  conta: string | null;
  ativo: boolean;
}
export interface Fornecedor {
  id: string;
  nome: string;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  categoria_id: string | null;
  ativo: boolean;
}
export interface RegraBanco {
  id: string;
  banco_nome: string | null;
  produto: string | null;
  faixa_min: number;
  faixa_max: number | null;
  tipo: "percentual" | "fixo";
  valor: number;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  ativo: boolean;
}
export interface RegraParticipante {
  id: string;
  usuario_id: string | null;
  pessoa: string | null;
  tipo_vinculo: string;
  gatilho: string;
  base_calculo: BaseParticipante;
  percentual: number;
  tipo_valor: "percentual" | "fixo";
  valor_fixo: number | null;
  papel: Papel | null;
  operacao: string | null;
  banco_nome: string | null;
  produto: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  ativo: boolean;
  exige_recebimento_banco: boolean;
  encerrada_em: string | null;
  observacao: string | null;
}
export interface Parametros {
  gatilho_comissao_banco: "contrato_emitido" | "registrado";
  dias_previsao_recebimento: number;
  dias_vencimento_comissao: number;
  tolerancia_divergencia: number;
  dias_janela_conciliacao: number;
}
export interface Pessoa {
  id: string;
  nome: string;
  tipo: "sistema" | "portal_parceiro" | string;
  ativo: boolean;
}

export interface Cadastros {
  parametros: Parametros;
  categorias: ItemCadastro[];
  centros: ItemCadastro[];
  formas: ItemCadastro[];
  contas_bancarias: ContaBancaria[];
  fornecedores: Fornecedor[] | null;
  regras_banco: RegraBanco[] | null;
  regras_participantes: RegraParticipante[] | null;
  pessoas: Pessoa[] | null;
  bancos: string[];
  produtos: string[];
}

export interface BaixaDetalhe {
  id: string;
  valor: number;
  data: string;
  forma: string | null;
  documento: string | null;
  observacao: string | null;
  origem: string;
  conta: string | null;
  registrado_por: string | null;
  registrado_em: string;
  estornada_em: string | null;
  estorno_motivo: string | null;
  anexo: { id: string; nome: string; caminho: string } | null;
  conciliada: boolean;
}

export interface EventoTrilha {
  acao: string;
  quando: string;
  quem: string | null;
  motivo: string | null;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  entidade: string;
}

export interface DetalheLancamento {
  item: Record<string, unknown>;
  descricao: string | null;
  baixas: BaixaDetalhe[];
  anexos: { id: string; nome: string; caminho: string; tipo: string | null; enviado_em: string; enviado_por: string | null }[];
  trilha: EventoTrilha[] | null;
}

export interface Painel {
  periodo: { de: string; ate: string };
  bancos: {
    quantidade: number;
    previsto: number;
    informado: number;
    recebido: number;
    a_receber: number;
    divergentes: number;
    divergente_valor: number;
    contestadas: number;
    vencidas_qtd: number;
    vencidas_valor: number;
    por_situacao: Record<string, number>;
    por_banco: { banco: string; previsto: number; recebido: number }[];
  } | null;
  participantes: {
    quantidade: number;
    previstas: number;
    aguardando: number;
    aprovadas: number;
    pagas: number;
    contestadas: number;
    por_pessoa: { pessoa: string; valor: number; pago: number }[];
  } | null;
  despesas: {
    abertas: number;
    vencidas: number;
    vencidas_qtd: number;
    pagas: number;
    recorrentes_qtd: number;
    rascunhos_qtd: number;
    por_categoria: { categoria: string; valor: number }[];
  } | null;
  receitas: { abertas: number; vencidas: number; recebidas: number } | null;
  fluxo: { mes: string; natureza: Natureza; previsto: number; realizado: number }[];
  alertas: {
    sem_previsao: number | null;
    sem_regra: number | null;
    vencidas_sem_recebimento: number | null;
    divergencias: number | null;
    soma_excedida: number | null;
    contestacoes: number | null;
    rascunhos: number | null;
    despesas_vencidas: number | null;
    extrato_pendente: number | null;
    repasses_visiveis: boolean;
  };
}

export interface Extrato {
  id: string;
  conta: string;
  conta_bancaria_id: string;
  arquivo: string;
  formato: "ofx" | "csv";
  periodo_de: string | null;
  periodo_ate: string | null;
  total: number;
  novas: number;
  duplicadas: number;
  importado_em: string;
  importado_por: string | null;
  pendentes: number;
  conciliadas: number;
}

export interface SugestaoConciliacao {
  tipo: "baixa" | Natureza;
  alvo_id: string;
  natureza: Natureza;
  valor: number;
  data: string | null;
  descricao: string | null;
  pontos: number;
  sinais: string[];
}

export interface LinhaExtrato {
  id: string;
  data: string;
  valor: number;
  descricao: string;
  documento: string | null;
  situacao: "pendente" | "conciliada" | "ignorada" | "duplicada";
  ignorada_motivo: string | null;
  conciliacao: {
    id: string;
    baixa_id: string;
    criou_baixa: boolean;
    natureza: Natureza;
    alvo_id: string;
    descricao: string | null;
    confirmado_em: string;
    confirmado_por: string | null;
  } | null;
}

export interface DetalheExtrato {
  linhas: LinhaExtrato[];
  sugestoes: { linha_id: string; sugestoes: SugestaoConciliacao[] }[];
}

export interface Demonstrativo {
  pessoa: { id: string; nome: string | null; email: string | null };
  itens: {
    id: string;
    proposta: string | null;
    banco: string | null;
    produto: string | null;
    papel: Papel | null;
    base: number;
    percentual: number;
    valor: number;
    pago: number;
    situacao: SituacaoParticipante;
    vencimento: string | null;
    criado_em: string;
    contestacao_motivo: string | null;
    pagamentos: { data: string; valor: number; forma: string | null }[];
  }[];
  totais: { previsto: number; a_pagar: number; pago: number };
}

export interface ItemAuditoria {
  id: number;
  entidade: string;
  entidade_id: string | null;
  acao: string;
  quando: string;
  quem: string | null;
  motivo: string | null;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
}

export type LinhaRelatorio = Record<string, unknown> & {
  origem: { tipo: string; id: string; proposta_id?: string | null };
};
