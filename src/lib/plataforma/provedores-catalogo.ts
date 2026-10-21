/*
 * Catálogo dos provedores (copiado da Gestão do Corretor, apps/web/src/app/[portal]/credenciais/
 * catalogo.ts — manter os dois iguais enquanto o Corretor ainda tiver o arquivo).
 *
 * O que cada provedor pede, em um lugar só.
 *
 * Fora de `acoes.ts` porque um arquivo "use server" só pode exportar
 * função assíncrona — constante ali vira erro de build. E porque a tela
 * (componente de cliente) também lê daqui para desenhar os campos.
 */

export type ProvedorConhecido = "homefin" | "serasa" | "asaas" | "boavista" | "apifull" | "email";

export type CampoCredencial = {
  chave: string;
  rotulo: string;
  /** Segredo: campo de senha na tela, obrigatório, e só os últimos dígitos voltam. */
  segredo: boolean;
  /** Não é segredo, mas sem ele o provedor não funciona. */
  obrigatorio?: boolean;
  /**
   * Segredo que pode ficar em branco: vale quando o provedor aceita mais de um serviço e
   * basta um deles (ver `Provedor.exigeUmDe`).
   */
  opcional?: boolean;
  /** Texto de apoio debaixo do campo, no lugar do "opcional" padrão. */
  ajuda?: string;
  exemplo?: string;
  /** Conferência de formato antes de ir para o banco: a mensagem diz o que corrigir. */
  formato?: { regex: RegExp; mensagem: string };
};

export type Provedor = {
  rotulo: string;
  descricao: string;
  campos: readonly CampoCredencial[];
  baseExemplo: string;
  /**
   * Pelo menos um destes grupos precisa vir completo (todos os campos do grupo
   * preenchidos), e grupo começado tem de ser terminado. Ex.: e-mail pelo SendPulse
   * (ID + segredo) OU pelo Resend (chave).
   */
  exigeUmDe?: { grupos: readonly (readonly string[])[]; mensagem: string };
};

/** O campo é exigido sempre? Segredo é, salvo quando marcado como opcional. */
export const campoExigido = (c: CampoCredencial) => (c.segredo && !c.opcional) || !!c.obrigatorio;

/**
 * Confere os grupos de `exigeUmDe`. Devolve a mensagem do que falta, ou null.
 * `preenchido(chave)` diz se o campo veio com valor.
 */
export function faltaNoGrupo(p: Provedor, preenchido: (chave: string) => boolean): string | null {
  if (!p.exigeUmDe) return null;
  const rotulo = (k: string) => p.campos.find((c) => c.chave === k)?.rotulo ?? k;
  for (const g of p.exigeUmDe.grupos) {
    const feitos = g.filter(preenchido);
    if (feitos.length > 0 && feitos.length < g.length) {
      const falta = g
        .filter((k) => !preenchido(k))
        .map(rotulo)
        .join(" e ");
      return `Preencha também ${falta}.`;
    }
  }
  return p.exigeUmDe.grupos.some((g) => g.every(preenchido)) ? null : p.exigeUmDe.mensagem;
}

/** O que cada provedor pede. Espelha as `VARIAVEIS_*` das integrações. */
export const CATALOGO: Record<ProvedorConhecido, Provedor> = {
  homefin: {
    rotulo: "Integração bancária",
    descricao: "Simulação e proposta nos bancos. Sem ela, nada vai para o banco.",
    campos: [
      {
        chave: "secretId",
        rotulo: "Chave da API",
        segredo: true,
        ajuda: "O Secret ID recebido do provedor da integração bancária.",
      },
      {
        chave: "secretKey",
        rotulo: "Segredo da API",
        segredo: true,
        ajuda: "O Secret Key recebido do provedor da integração bancária.",
      },
    ],
    // O endereço padrão fica no servidor (BASE_HOMEFIN_PADRAO): a tela não mostra o provedor.
    baseExemplo: "Endereço padrão do servidor",
  },
  serasa: {
    rotulo: "Serasa Experian",
    descricao: "Consulta de ficha (score, pendências, protestos). Cobrada por consulta.",
    campos: [
      { chave: "SERASA_CLIENT_ID", rotulo: "Client ID", segredo: true },
      { chave: "SERASA_CLIENT_SECRET", rotulo: "Client Secret", segredo: true },
      { chave: "SERASA_PRODUTO", rotulo: "Produto contratado", segredo: false },
    ],
    baseExemplo: "https://api.serasaexperian.com.br",
  },
  asaas: {
    rotulo: "Asaas (cobrança)",
    descricao:
      "Pix, boleto e cartão. Sem ela a conta não recebe o que pagar, e o crédito só entra com a Agilliza baixando a fatura à mão.",
    campos: [
      { chave: "ASAAS_API_KEY", rotulo: "Chave de API", segredo: true },
      { chave: "ASAAS_WEBHOOK_TOKEN", rotulo: "Segredo do webhook", segredo: true },
    ],
    baseExemplo: "https://api.asaas.com/v3",
  },
  boavista: {
    rotulo: "Boa Vista (SCPC)",
    descricao: "Consulta de ficha pelo contrato da Boa Vista. Cobrada por consulta.",
    campos: [
      { chave: "BOAVISTA_USUARIO", rotulo: "Usuário", segredo: true },
      { chave: "BOAVISTA_SENHA", rotulo: "Senha", segredo: true },
      { chave: "BOAVISTA_PRODUTO", rotulo: "Produto contratado", segredo: false },
    ],
    baseExemplo: "https://api.boavistaservicos.com.br",
  },
  apifull: {
    rotulo: "APIFull (Serasa Premium)",
    descricao:
      "Consulta Serasa Premium vendida por unidade às licenças. O saldo é pré-pago na conta da APIFull; sem o token, os pedidos pagos esperam na fila e um incidente é aberto.",
    campos: [{ chave: "APIFULL_TOKEN", rotulo: "Token da conta (Bearer)", segredo: true }],
    baseExemplo: "https://api.apifull.com.br",
  },
  /*
   * O e-mail é lido pelo worker da fila, não pelo app: é ele que manda o link
   * de nova senha, a confirmação de cadastro, o convite de equipe, o código
   * do cliente e os avisos de pagamento e de licença. Remetente e endereço
   * público ficam aqui junto da chave — não são segredo, mas sem eles o e-mail
   * sai sem assinatura ou com link para lugar nenhum.
   *
   * Dois provedores, e basta um: o SendPulse (ID + segredo da API, o escolhido)
   * ou o Resend (chave). Com os dois preenchidos, o worker usa o SendPulse.
   */
  email: {
    rotulo: "E-mail transacional (SendPulse ou Resend)",
    descricao:
      "Nova senha, confirmação de cadastro, convite de equipe, código de acesso do cliente, recibo de pagamento e lembretes de vencimento. Sem ela, nenhum desses e-mails sai.",
    campos: [
      {
        chave: "SENDPULSE_API_ID",
        rotulo: "ID da API (SendPulse)",
        segredo: true,
        opcional: true,
        ajuda: "No SendPulse: Configurações da conta → API → ID. Preencha junto com o segredo.",
      },
      {
        chave: "SENDPULSE_API_SECRET",
        rotulo: "Segredo da API (SendPulse)",
        segredo: true,
        opcional: true,
        ajuda: "No SendPulse: Configurações da conta → API → Secret.",
      },
      {
        chave: "EMAIL_REMETENTE",
        rotulo: "Remetente (e-mail verificado no provedor)",
        segredo: false,
        obrigatorio: true,
        exemplo: "AgillizaTech <nao-responda@agillizatech.com.br>",
        ajuda:
          "Um endereço já verificado como remetente no SendPulse (ou de domínio verificado no Resend). Sem nome, os e-mails saem como AgillizaTech.",
        formato: {
          regex: /^([^<>@]*<[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+>|[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+)$/,
          mensagem:
            "O remetente precisa ser um e-mail, ou nome e e-mail: AgillizaTech <nao-responda@agillizatech.com.br>.",
        },
      },
      {
        chave: "APP_URL_PUBLICA",
        rotulo: "Endereço público do sistema",
        segredo: false,
        obrigatorio: true,
        exemplo: "https://app.agillizatech.com.br",
        ajuda: "O começo dos links dos e-mails (nova senha, convite, confirmação, renovar).",
        formato: {
          regex: /^https:\/\/[\w.-]+(:\d+)?\/?$/,
          mensagem:
            "O endereço público precisa começar com https:// e não ter caminho depois do domínio.",
        },
      },
      {
        chave: "RESEND_API_KEY",
        rotulo: "Chave de API do Resend (opcional)",
        segredo: true,
        opcional: true,
        ajuda: "Só se for usar o Resend no lugar do SendPulse.",
      },
    ],
    exigeUmDe: {
      grupos: [["SENDPULSE_API_ID", "SENDPULSE_API_SECRET"], ["RESEND_API_KEY"]],
      mensagem: "Preencha o ID e o segredo da API do SendPulse (ou a chave do Resend).",
    },
    baseExemplo: "Padrão do provedor (api.sendpulse.com ou api.resend.com)",
  },
};
