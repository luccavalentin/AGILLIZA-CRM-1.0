// Respostas rápidas (templates) do chat — salvas por navegador (localStorage).
// Estilo "WhatsApp Business": mensagens prontas para agilizar o atendimento.
// Suportam variáveis dinâmicas relacionadas à proposta do cliente, ex.:
// {primeiro_nome}, {numero_proposta}, {nome_banco}, {etapa}, {empresa}.

const STORAGE_KEY = "agilliza:chat-respostas-rapidas-v2";
const EVENTO = "agilliza:chat-respostas-rapidas-change";

export interface RespostaRapida {
  id: string;
  titulo: string;
  texto: string;
}

/** Variáveis disponíveis para uso nas respostas rápidas. */
export const VARIAVEIS_RESPOSTA = [
  { chave: "primeiro_nome", rotulo: "Primeiro nome do cliente" },
  { chave: "numero_proposta", rotulo: "Número da proposta" },
  { chave: "nome_banco", rotulo: "Banco da proposta" },
  { chave: "etapa", rotulo: "Etapa atual da esteira" },
  { chave: "empresa", rotulo: "Nome da sua empresa" },
] as const;

/** Contexto do cliente usado para preencher as variáveis. */
export interface ContextoResposta {
  primeiro_nome?: string | null;
  numero_proposta?: string | null;
  nome_banco?: string | null;
  etapa?: string | null;
  /** Nome da empresa do usuário (parâmetros da empresa). */
  empresa?: string | null;
}

/** Substitui placeholders {chave} pelos valores do contexto do cliente. */
export function aplicarVariaveis(texto: string, ctx?: ContextoResposta): string {
  // Defaults para quando um dado ainda não existe, evitando frases quebradas como
  // "está em análise no." quando o banco não foi definido. Sem artigo: os modelos já
  // trazem "ao"/"no" antes da variável ("junto ao o banco" saía assim).
  const PADROES: Record<string, string> = {
    nome_banco: "banco",
    etapa: "em andamento",
    empresa: "de atendimento",
  };
  const mapa: Record<string, string | null | undefined> = {
    primeiro_nome: ctx?.primeiro_nome,
    numero_proposta: ctx?.numero_proposta,
    nome_banco: ctx?.nome_banco,
    etapa: ctx?.etapa,
    empresa: ctx?.empresa,
  };
  const substituido = texto.replace(/\{(\w+)\}/g, (bruto, chave: string) => {
    if (!(chave in mapa)) return bruto;
    const valor = mapa[chave];
    if (valor != null && String(valor).trim()) return String(valor);
    // Placeholder conhecido, porém sem valor: usa um padrão amigável quando
    // houver, senão remove o token para não vazar "{numero_proposta}" cru.
    return PADROES[chave] ?? "";
  });
  // Limpa resíduos de tokens removidos (espaços duplos e espaço antes de pontuação).
  return substituido
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

const PADRAO: RespostaRapida[] = [
  {
    id: "saudacao-proposta",
    titulo: "Saudação",
    texto:
      "Olá, {primeiro_nome}. Aqui é da equipe {empresa}, cuidando da sua proposta {numero_proposta}. Como podemos ajudar?",
  },
  {
    id: "atualizacao-proposta",
    titulo: "Atualização da proposta",
    texto:
      'Olá, {primeiro_nome}. Temos novidades sobre a sua proposta {numero_proposta}: ela está agora na etapa "{etapa}". Seguimos acompanhando.',
  },
  {
    id: "documentos-proposta",
    titulo: "Pedir documentos",
    texto:
      "Olá, {primeiro_nome}. Para dar andamento à sua proposta {numero_proposta} junto ao {nome_banco}, precisamos de alguns documentos. Pode nos enviar por aqui?",
  },
  {
    id: "em-analise-banco",
    titulo: "Em análise no banco",
    texto:
      "{primeiro_nome}, a sua proposta {numero_proposta} está em análise no {nome_banco}. Assim que houver retorno, avisamos por aqui.",
  },
  {
    id: "aprovacao",
    titulo: "Boa notícia / aprovação",
    texto:
      'Boa notícia, {primeiro_nome}: sua proposta {numero_proposta} avançou para a etapa "{etapa}". Em breve trazemos os próximos passos.',
  },
  {
    id: "agradecimento",
    titulo: "Agradecimento",
    texto:
      "Obrigado pelo contato, {primeiro_nome}. Qualquer dúvida sobre a proposta {numero_proposta}, estamos à disposição.",
  },
];

export function getRespostasRapidas(): RespostaRapida[] {
  if (typeof window === "undefined") return PADRAO;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return PADRAO;
    const parsed = JSON.parse(raw) as RespostaRapida[];
    if (!Array.isArray(parsed)) return PADRAO;
    // Listas salvas antes trazem a marca fixa no modelo de saudação.
    return parsed.map((r) =>
      typeof r?.texto === "string" && r.texto.includes("equipe Agilliza")
        ? { ...r, texto: r.texto.replace(/equipe Agilliza/g, "equipe {empresa}") }
        : r,
    );
  } catch {
    return PADRAO;
  }
}

export function setRespostasRapidas(lista: RespostaRapida[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
    window.dispatchEvent(new CustomEvent(EVENTO));
  } catch {
    /* ignore */
  }
}

export function subscribeRespostasRapidas(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", cb);
  };
}
