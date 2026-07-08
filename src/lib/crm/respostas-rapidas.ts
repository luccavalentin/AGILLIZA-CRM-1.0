// Respostas rápidas (templates) do chat — salvas por navegador (localStorage).
// Estilo "WhatsApp Business": mensagens prontas para agilizar o atendimento.

const STORAGE_KEY = "agilliza:chat-respostas-rapidas";
const EVENTO = "agilliza:chat-respostas-rapidas-change";

export interface RespostaRapida {
  id: string;
  titulo: string;
  texto: string;
}

const PADRAO: RespostaRapida[] = [
  {
    id: "saudacao",
    titulo: "Saudação",
    texto: "Olá! Aqui é da equipe. Como podemos te ajudar hoje?",
  },
  {
    id: "documentos",
    titulo: "Pedir documentos",
    texto:
      "Para darmos andamento, poderia nos enviar os documentos solicitados? Assim que recebermos, seguimos com a análise.",
  },
  {
    id: "em-analise",
    titulo: "Em análise",
    texto:
      "Sua proposta está em análise pelo banco. Assim que tivermos um retorno, avisaremos por aqui.",
  },
  {
    id: "agradecimento",
    titulo: "Agradecimento",
    texto: "Obrigado pelo contato! Qualquer dúvida, estamos à disposição.",
  },
];

export function getRespostasRapidas(): RespostaRapida[] {
  if (typeof window === "undefined") return PADRAO;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return PADRAO;
    const parsed = JSON.parse(raw) as RespostaRapida[];
    if (!Array.isArray(parsed)) return PADRAO;
    return parsed;
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
