/**
 * Estado inicial, tipos e constantes do hook `useSimulacaoCompleta`.
 *
 * Extraído para manter o hook principal enxuto sem alterar nenhum
 * comportamento — este módulo é puramente declarativo (constantes/tipos)
 * e não deve conter lógica que dependa de estado do componente.
 */
import { PADROES_CADASTRO } from "@/lib/crm/padroes-cadastro";

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
// Padrão único do cadastro (ver `padroes-cadastro.ts`) — simulação e CRM não
// podem divergir no e-mail que vai para o banco.
export const EMAIL_PADRAO = PADROES_CADASTRO.email;

export const ESTADO_INICIAL: Form = {
  produto: "financiamento_imobiliario",
  /** PF ou PJ. Em PJ o único banco que opera é o Bradesco. */
  tipo_pessoa: "PF",
  /** Faturamento anual — só coletado e enviado quando a modalidade é PJ. */
  faturamento_empresa: 0,
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

/**
 * Campos que um rascunho pode trazer. Lista explícita porque `Form` é um
 * registro livre: sem ela, ou nada entrava (o estado inicial não declara
 * `sexo`) ou qualquer chave estranha entraria.
 */
const CAMPOS_DO_RASCUNHO = [
  "cliente_id",
  "tipo_pessoa",
  "nome_cliente",
  "cpf_cnpj",
  "email",
  "celular",
  "data_nascimento",
  "sexo",
  "estado_civil",
  "regime_casamento",
  "renda_total",
  "possui_conjuge",
  "compoe_renda",
  "compoe_renda_conjuge",
  "nome_conjuge",
  "cpf_conjuge",
  "renda_conjuge",
  "data_nascimento_conjuge",
  "email_conjuge",
  "celular_conjuge",
  "sexo_conjuge",
  "estado_civil_conjuge",
  "produto",
  "uf",
  "cep_imovel",
  "tipo_imovel",
  "uso_imovel",
  "situacao_imovel",
  "utiliza_fgts",
  "valor_imovel",
  "valor_entrada",
  "valor_financiamento",
  "prazo",
  "sistema_amortizacao",
] as const;

/**
 * Rascunho deixado por outra tela (ficha do cliente, simulação rápida) no
 * `sessionStorage`, aplicado sobre o estado inicial.
 *
 * Quem grava o rascunho existia desde sempre e `envio.ts` já o limpava depois
 * de enviar — mas ninguém o LIA: abrir "Nova simulação" pela ficha do cliente
 * trazia a tela em branco e o operador redigitava tudo, inclusive sexo e
 * regime de casamento. Só copiamos chaves conhecidas do formulário, para um
 * rascunho antigo ou estranho não injetar campo inválido.
 */
export function estadoInicialComRascunho(): Form {
  if (typeof sessionStorage === "undefined") return ESTADO_INICIAL;
  let bruto: string | null = null;
  try {
    bruto = sessionStorage.getItem("simulacao_wizard");
  } catch {
    return ESTADO_INICIAL;
  }
  if (!bruto) return ESTADO_INICIAL;
  // Consumido uma vez: sem isto, abrir a tela de novo no mesmo dia ressuscitaria
  // um rascunho abandonado por cima de uma simulação nova.
  try {
    sessionStorage.removeItem("simulacao_wizard");
  } catch {
    /* storage indisponível: seguimos com o que já foi lido */
  }
  let dados: Record<string, unknown>;
  try {
    dados = JSON.parse(bruto) as Record<string, unknown>;
  } catch {
    return ESTADO_INICIAL;
  }
  const next: Record<string, unknown> = { ...ESTADO_INICIAL };
  for (const chave of CAMPOS_DO_RASCUNHO) {
    const valor = dados[chave];
    if (valor === null || valor === undefined || valor === "") continue;
    next[chave] = valor;
  }
  return next as Form;
}
