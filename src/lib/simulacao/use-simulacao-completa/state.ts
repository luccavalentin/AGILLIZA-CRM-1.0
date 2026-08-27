/**
 * Estado inicial, tipos e constantes do hook `useSimulacaoCompleta`.
 *
 * Extraído para manter o hook principal enxuto sem alterar nenhum
 * comportamento — este módulo é puramente declarativo (constantes/tipos)
 * e não deve conter lógica que dependa de estado do componente.
 */

export type Form = Record<string, any>;

export interface Banco {
  id: string;
  nome_banco?: string | null;
  codigo_banco?: number | string | null;
  flag_padrao?: boolean | null;
}

export interface OpcoesHook {
  duplicar?: string;
  modoProposta: boolean;
}

/**
 * E-mail pré-preenchido em cadastros de titular e cônjuge para agilizar
 * testes e operação com atendimento centralizado. O usuário pode alterar
 * livremente.
 */
export const EMAIL_PADRAO = "thiago@agilliza.net.br";

export const ESTADO_INICIAL: Form = {
  produto: "financiamento_imobiliario",
  /** PF ou PJ. Em PJ o único banco que opera é o Bradesco. */
  tipo_pessoa: "PF",
  tipo_imovel: "",
  uso_imovel: "",
  situacao_imovel: "",
  uf: "",
  cep_imovel: "",
  valor_imovel: 0,
  valor_entrada: 0,
  valor_financiamento: 0,
  simular_por_parcela: false,
  parcela_alvo: 0,

  prazo: 360,
  prazo_2: null as number | null,
  utiliza_fgts: "N",
  fg_financiar_despesas: false,
  valor_despesas_financiadas: 0,
  sistema_amortizacao: "S",
  nome_cliente: "",
  cpf_cnpj: "",
  renda_total: 0,
  renda_price: 0,
  data_nascimento: "",
  estado_civil: "",
  email: EMAIL_PADRAO,
  celular: "",
  possui_conjuge: false,
  regime_casamento: "",
  // Composição de renda é derivada do estado civil/cônjuge — começa desligada.
  compoe_renda: false,
  compoe_renda_conjuge: false,
  bancos_ids: [] as string[],
  bancos_sac_ids: [] as string[],
  bancos_price_ids: [] as string[],
  participantes: [] as any[],
  possui_participantes: false,
  /**
   * Testagem automática de CPFs: repete a simulação com cada proponente apto
   * (cônjuge e participantes) na posição de titular, para comparar as taxas.
   * Multiplica as consultas ao banco — por isso começa desligada.
   */
  testar_cpfs: false,

  consentimento_lgpd: false,
  consentimento_scr: false,
  download_automatico: true,
  email_verificado_em: null,
};
