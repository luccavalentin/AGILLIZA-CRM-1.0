/**
 * Ficha única de bureau de crédito.
 *
 * SPC e Serasa não têm API pública: o acesso sai de um contrato, e cada
 * fornecedor (Serasa Experian, SPC Brasil/CDL, ou um agregador como Assertiva,
 * BigDataCorp, Neoway) devolve um formato diferente.
 *
 * Este é o formato do Agilliza. Cada fornecedor entra como um adaptador que
 * traduz a resposta dele para cá, e a tela nunca conhece o fornecedor — trocar
 * de contrato não mexe em uma linha de interface.
 */

export type SituacaoCadastral = "regular" | "pendente" | "suspensa" | "cancelada" | "desconhecida";

export interface RestricaoBureau {
  /** SPC, Serasa, protesto, cheque sem fundo, ação judicial… */
  origem: string;
  tipo: string;
  descricao: string | null;
  valor: number | null;
  /** Quem apontou a restrição (o credor). */
  credor: string | null;
  data: string | null;
  /** Praça/cartório, quando protesto. */
  local: string | null;
}

export interface ConsultaAnterior {
  data: string;
  empresa: string | null;
  segmento: string | null;
}

export interface ParticipacaoEmpresa {
  cnpj: string;
  razaoSocial: string;
  participacao: number | null;
  situacao: string | null;
}

export interface ContatoBureau {
  tipo: "telefone" | "email" | "endereco";
  valor: string;
  origem: string | null;
}

export interface ScoreBureau {
  /** 0 a 1000 na maioria dos fornecedores. */
  valor: number;
  /** Escala usada, para a tela não assumir 0-1000. */
  maximo: number;
  faixa: "muito_baixo" | "baixo" | "medio" | "alto" | "muito_alto" | null;
  /** Probabilidade de inadimplência em 12 meses, quando o fornecedor informa. */
  probabilidadeInadimplencia: number | null;
  modelo: string | null;
}

export interface FichaBureau {
  documento: string;
  tipoPessoa: "F" | "J";
  nome: string | null;
  nascimentoOuFundacao: string | null;
  situacaoCadastral: SituacaoCadastral;
  score: ScoreBureau | null;

  restricoes: RestricaoBureau[];
  /** Soma das restrições em aberto. */
  totalRestricoes: number;
  valorTotalRestricoes: number;

  consultasAnteriores: ConsultaAnterior[];
  participacoes: ParticipacaoEmpresa[];
  contatos: ContatoBureau[];

  /** Renda presumida, quando o fornecedor devolve. */
  rendaPresumida: number | null;

  /** Quando a consulta foi feita e por qual fornecedor. */
  consultadoEm: string;
  provedor: string;
  // A resposta crua do fornecedor NÃO entra aqui: a ficha atravessa a
  // fronteira servidor→cliente e o payload precisa ser serializável e
  // previsível. Quando houver adaptador, o cru é gravado no histórico pelo
  // próprio adaptador, sem passar pela tela.
}

export interface ParametrosConsulta {
  documento: string;
  /** Finalidade da consulta — exigida pela LGPD e pelos contratos de bureau. */
  finalidade: string;
  clienteId?: string | null;
}

/**
 * Contrato que todo fornecedor precisa cumprir. Adicionar um bureau novo é
 * escrever um arquivo em `provedores/` que exporte isto.
 */
export interface ProvedorBureau {
  chave: string;
  nome: string;
  consultar(params: ParametrosConsulta, credenciais: Record<string, string>): Promise<FichaBureau>;
}

/** Erro de bureau com causa identificada, para a tela explicar o que fazer. */
export type CodigoErroBureau =
  | "sem_provedor"
  | "sem_credenciais"
  | "documento_invalido"
  | "nao_encontrado"
  | "sem_saldo"
  | "recusado"
  | "indisponivel";

export class ErroBureau extends Error {
  constructor(
    public readonly codigo: CodigoErroBureau,
    mensagem?: string,
  ) {
    super(mensagem ?? mensagemErroBureau(codigo));
    this.name = "ErroBureau";
  }
}

export function mensagemErroBureau(codigo: CodigoErroBureau): string {
  switch (codigo) {
    case "sem_provedor":
      return "Nenhum bureau configurado. Cadastre o fornecedor em Administração · Integrações.";
    case "sem_credenciais":
      return "O bureau está cadastrado mas sem credenciais. Informe as chaves em Administração · Integrações.";
    case "documento_invalido":
      return "CPF ou CNPJ inválido.";
    case "nao_encontrado":
      return "O bureau não encontrou registro para este documento.";
    case "sem_saldo":
      return "Consulta recusada por saldo ou limite de contrato esgotado no fornecedor.";
    case "recusado":
      return "O fornecedor recusou a consulta. Verifique as credenciais e a finalidade informada.";
    default:
      return "O bureau não respondeu. Tente novamente em alguns instantes.";
  }
}
