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

export type ProvedorConhecido =
  | "homefin"
  | "serasa"
  | "spc"
  | "asaas"
  | "boavista"
  | "apifull"
  | "email"
  | "meta"
  | "linkedin"
  | "tiktok"
  | "google";

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
  /*
   * Bureaus oficiais (SPC Brasil e Serasa Experian): contrato da AgillizaTech, revendido às
   * licenças como a APIFull. Os dois exigem contrato comercial e homologação antes da
   * produção; até lá ficam cadastrados e desligados aqui, prontos para ativar.
   */
  serasa: {
    rotulo: "Serasa Experian (API oficial)",
    descricao:
      "Consulta de ficha pelo contrato direto com a Serasa (Crednet, Concentre, Relato, Top Score). Exige contrato comercial; a homologação dá um login de teste de 90 dias. Cobrada por consulta.",
    campos: [
      {
        chave: "SERASA_CLIENT_ID",
        rotulo: "Client ID",
        segredo: true,
        ajuda:
          "Entregue pelo comercial da Serasa depois da homologação (portal developer.serasaexperian.com.br).",
      },
      { chave: "SERASA_CLIENT_SECRET", rotulo: "Client Secret", segredo: true },
      {
        chave: "SERASA_PRODUTO",
        rotulo: "Produto contratado",
        segredo: false,
        obrigatorio: true,
        exemplo: "Crednet PF / Concentre PF Top Score / Relato",
        ajuda:
          "O relatório que o contrato libera. Complementos (Renda Estimada etc.) vão no campo abaixo.",
      },
      {
        chave: "SERASA_COMPLEMENTOS",
        rotulo: "Complementos contratados (opcional)",
        segredo: false,
        exemplo: "Renda Estimada, Capacidade de Pagamento",
      },
    ],
    baseExemplo: "https://api.serasaexperian.com.br (homologação: uat-api.serasaexperian.com.br)",
  },
  spc: {
    rotulo: "SPC Brasil (API oficial)",
    descricao:
      "Consulta de ficha pelo contrato direto com o SPC Brasil (SPC Mix Mais, Score, Renda Presumida). Exige contrato e o IP fixo do servidor liberado pelo SPC. Cobrada por consulta.",
    campos: [
      {
        chave: "SPC_OPERADOR",
        rotulo: "Código do operador",
        segredo: true,
        ajuda: "O operador cadastrado no SPC para o acesso por Web Service.",
      },
      {
        chave: "SPC_SENHA_WS",
        rotulo: "Senha do Web Service",
        segredo: true,
        ajuda: "A senha do meio de acesso Web Service (não é a senha do portal do SPC).",
      },
      {
        chave: "SPC_PRODUTO",
        rotulo: "Código do produto",
        segredo: false,
        obrigatorio: true,
        exemplo: "323 (SPC Mix Mais)",
        formato: {
          regex: /^\d{1,6}\b/,
          mensagem: "Comece pelo código numérico do produto, ex.: 323.",
        },
      },
      {
        chave: "SPC_PRODUTO_SCORE",
        rotulo: "Código do produto de score (opcional)",
        segredo: false,
      },
      {
        chave: "SPC_ASSOCIADO",
        rotulo: "Código do associado / CDL (opcional)",
        segredo: false,
      },
    ],
    baseExemplo: "https://api.spcbrasil.com.br (homologação: treinamento.spcbrasil.com.br)",
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
    rotulo: "APIFull (Serasa Premium e SPC Brasil)",
    descricao:
      "Consultas Serasa Premium e SPC Brasil vendidas às licenças com créditos pré-pagos. O MESMO token serve aos dois produtos. O saldo é pré-pago na conta da APIFull; sem o token, os pedidos pagos esperam na fila e um incidente é aberto.",
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
  /*
   * Apps oficiais das redes sociais (Automações). Os campos têm o NOME DA VARIÁVEL DE AMBIENTE
   * que o Agilliza Tech (web e worker) lê: a chave cadastrada aqui vale primeiro; sem ela, o
   * servidor usa o ambiente. Endereço de retorno a cadastrar no app de cada rede:
   * https://agillizatech.com.br/api/social/retorno/<meta|linkedin|tiktok|youtube|google_business>.
   */
  meta: {
    rotulo: "Meta (Facebook e Instagram)",
    descricao:
      "Publicação nas Páginas do Facebook e nos perfis profissionais do Instagram (fotos, carrossel, Reels e Stories) e as métricas. App em developers.facebook.com com o produto Login do Facebook para Empresas.",
    campos: [
      {
        chave: "META_APP_ID",
        rotulo: "ID do app",
        segredo: true,
        ajuda:
          "Painel do app › Configurações › Básico. Retorno a cadastrar: https://agillizatech.com.br/api/social/retorno/meta. Permissões: pages_show_list, pages_read_engagement, pages_manage_posts, business_management, instagram_basic, instagram_content_publish, instagram_manage_comments, instagram_manage_insights e read_insights.",
      },
      { chave: "META_APP_SECRET", rotulo: "Chave secreta do app", segredo: true },
      {
        chave: "META_LOGIN_CONFIG_ID",
        rotulo: "ID da configuração do Login para Empresas (opcional)",
        segredo: false,
        ajuda:
          "Com o Login do Facebook para Empresas, a configuração substitui a lista de permissões.",
      },
      {
        chave: "META_GRAPH_VERSION",
        rotulo: "Versão da Graph API (opcional)",
        segredo: false,
        exemplo: "v26.0",
        formato: { regex: /^v\d{2}\.\d$/, mensagem: "A versão da Graph API é no formato v26.0." },
      },
    ],
    baseExemplo: "https://graph.facebook.com",
  },
  linkedin: {
    rotulo: "LinkedIn",
    descricao:
      "Publicação no perfil e nas páginas de empresa (texto, fotos e vídeo). App em linkedin.com/developers com Sign In with LinkedIn (OpenID) e Share on LinkedIn; páginas de empresa pedem o Community Management API.",
    campos: [
      {
        chave: "LINKEDIN_CLIENT_ID",
        rotulo: "Client ID",
        segredo: true,
        ajuda:
          "Aba Auth do app. Retorno: https://agillizatech.com.br/api/social/retorno/linkedin. Permissões: openid, profile, w_member_social; com Community Management: w_organization_social, r_organization_social, rw_organization_admin.",
      },
      { chave: "LINKEDIN_CLIENT_SECRET", rotulo: "Client Secret", segredo: true },
      {
        chave: "LINKEDIN_API_VERSION",
        rotulo: "Versão da API (opcional)",
        segredo: false,
        exemplo: "202610",
        formato: {
          regex: /^\d{6}$/,
          mensagem: "A versão do LinkedIn é no formato AAAAMM (ex.: 202610).",
        },
      },
      {
        chave: "LINKEDIN_COMMUNITY_MANAGEMENT",
        rotulo: "Páginas de empresa liberadas? (opcional)",
        segredo: false,
        exemplo: "true",
        ajuda:
          "Escreva true quando o LinkedIn aprovar o Community Management API (publicar nas páginas de empresa).",
        formato: { regex: /^(true|false)$/, mensagem: "Escreva true ou false." },
      },
    ],
    baseExemplo: "https://api.linkedin.com",
  },
  tiktok: {
    rotulo: "TikTok",
    descricao:
      "Publicação direta de vídeos e carrossel de fotos pela Content Posting API. App em developers.tiktok.com com Login Kit e Content Posting API (Direct Post exige a auditoria do TikTok).",
    campos: [
      {
        chave: "TIKTOK_CLIENT_KEY",
        rotulo: "Client key",
        segredo: true,
        ajuda:
          "Retorno: https://agillizatech.com.br/api/social/retorno/tiktok. Escopos: user.info.basic, user.info.profile, video.publish (e user.info.stats para seguidores).",
      },
      { chave: "TIKTOK_CLIENT_SECRET", rotulo: "Client secret", segredo: true },
      {
        chave: "TIKTOK_PULL_FROM_URL",
        rotulo: "Puxar o vídeo pelo link (opcional)",
        segredo: false,
        exemplo: "false",
        ajuda:
          "true só depois de verificar o domínio de mídia no TikTok; sem isso o vídeo vai por envio direto.",
        formato: { regex: /^(true|false)$/, mensagem: "Escreva true ou false." },
      },
      {
        chave: "TIKTOK_ESCOPO_ESTATISTICAS",
        rotulo: "Pedir seguidores da conta? (opcional)",
        segredo: false,
        exemplo: "true",
        ajuda:
          "true quando o escopo user.info.stats estiver aprovado no app (sem aprovação, o login falha).",
        formato: { regex: /^(true|false)$/, mensagem: "Escreva true ou false." },
      },
    ],
    baseExemplo: "https://open.tiktokapis.com",
  },
  google: {
    rotulo: "Google (YouTube e Meu Negócio)",
    descricao:
      "Vídeos e Shorts no YouTube e novidades, eventos e ofertas no Perfil da Empresa no Google. Projeto em console.cloud.google.com com as APIs YouTube Data, YouTube Analytics e Business Profile.",
    campos: [
      {
        chave: "GOOGLE_CLIENT_ID",
        rotulo: "ID do cliente OAuth",
        segredo: true,
        ajuda:
          "Credenciais › ID do cliente OAuth (aplicativo da Web). Retornos: https://agillizatech.com.br/api/social/retorno/youtube e https://agillizatech.com.br/api/social/retorno/google_business. Escopos: youtube.upload, youtube.readonly, yt-analytics.readonly e business.manage.",
      },
      { chave: "GOOGLE_CLIENT_SECRET", rotulo: "Chave secreta do cliente", segredo: true },
    ],
    baseExemplo: "https://www.googleapis.com",
  },
};
