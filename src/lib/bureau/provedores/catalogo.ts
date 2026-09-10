/**
 * Fornecedores de bureau suportados e o que cada um exige para autenticar.
 *
 * A tela de Integrações monta o formulário a partir daqui: escolher o
 * fornecedor já mostra exatamente quais chaves pedir. Adicionar um bureau
 * novo é acrescentar uma entrada nesta lista e um adaptador ao lado.
 */

export interface CampoCredencial {
  chave: string;
  rotulo: string;
  /** `true` mascara o valor na tela e nunca o devolve ao navegador. */
  segredo: boolean;
  ajuda?: string;
}

export interface ProvedorCatalogo {
  chave: string;
  nome: string;
  descricao: string;
  baseUrlPadrao: string | null;
  campos: CampoCredencial[];
  /** Adaptador escrito? Enquanto não houver contrato, nenhum está. */
  implementado: boolean;
}

export const PROVEDORES_BUREAU: ProvedorCatalogo[] = [
  {
    chave: "serasa",
    nome: "Serasa Experian",
    descricao: "Contrato direto com a Serasa. Autenticação OAuth2 (client credentials).",
    baseUrlPadrao: "https://api.serasaexperian.com.br",
    campos: [
      { chave: "client_id", rotulo: "Client ID", segredo: false },
      { chave: "client_secret", rotulo: "Client Secret", segredo: true },
      {
        chave: "produto",
        rotulo: "Produto contratado",
        segredo: false,
        ajuda: "Código do relatório contratado (ex.: RELATORIO_BASICO, CONCENTRE).",
      },
    ],
    implementado: false,
  },
  {
    chave: "spc",
    nome: "SPC Brasil (CDL)",
    descricao: "Contrato direto com o SPC Brasil pela CDL da sua praça.",
    baseUrlPadrao: "https://api.spcbrasil.org",
    campos: [
      { chave: "usuario", rotulo: "Usuário", segredo: false },
      { chave: "senha", rotulo: "Senha", segredo: true },
      { chave: "codigo_associado", rotulo: "Código do associado", segredo: false },
    ],
    implementado: false,
  },
  {
    chave: "assertiva",
    nome: "Assertiva Soluções",
    descricao: "Agregador: entrega SPC e Serasa na mesma consulta.",
    baseUrlPadrao: "https://api.assertivasolucoes.com.br",
    campos: [
      { chave: "client_id", rotulo: "Client ID", segredo: false },
      { chave: "client_secret", rotulo: "Client Secret", segredo: true },
    ],
    implementado: false,
  },
  {
    chave: "bigdatacorp",
    nome: "BigDataCorp",
    descricao: "Agregador com ficha ampla (restrições, societário, contatos).",
    baseUrlPadrao: "https://plataforma.bigdatacorp.com.br",
    campos: [
      { chave: "access_token", rotulo: "AccessToken", segredo: true },
      { chave: "token_id", rotulo: "TokenId", segredo: false },
    ],
    implementado: false,
  },
  {
    chave: "generico",
    nome: "Outro fornecedor (REST)",
    descricao:
      "Qualquer bureau REST. Informe a URL e o cabeçalho de autenticação; o mapeamento da resposta é feito sob medida.",
    baseUrlPadrao: null,
    campos: [
      {
        chave: "auth_header",
        rotulo: "Cabeçalho de autenticação",
        segredo: false,
        ajuda: "Ex.: Authorization",
      },
      { chave: "auth_valor", rotulo: "Valor do cabeçalho", segredo: true },
    ],
    implementado: false,
  },
];

export function provedorDoCatalogo(chave: string): ProvedorCatalogo | null {
  return PROVEDORES_BUREAU.find((p) => p.chave === chave) ?? null;
}
