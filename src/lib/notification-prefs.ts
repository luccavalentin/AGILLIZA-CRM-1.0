// Preferências de notificação por tipo, salvas por navegador (localStorage).
// Válidas em qualquer portal. Cada tipo pode ser ligado/desligado e ter som.

export type TipoNotificacao =
  | "chat"
  | "tarefas"
  | "propostas"
  | "crm"
  | "financeiro"
  | "sistema"
  | "retorno_proposta"
  | "retorno_simulacao";


export interface PrefTipo {
  /** Exibir a notificação (piscar menu / badge / toast). */
  ativo: boolean;
  /** Tocar som ao receber. */
  som: boolean;
}

export interface NotificationPrefs {
  /** Chave-mestra: desliga tudo quando false. */
  ativo: boolean;
  tipos: Record<TipoNotificacao, PrefTipo>;
}

export const TIPOS_NOTIFICACAO: {
  id: TipoNotificacao;
  label: string;
  descricao: string;
}[] = [
  {
    id: "chat",
    label: "Mensagens de chat",
    descricao: "Novas mensagens de clientes e conversas internas.",
  },
  {
    id: "tarefas",
    label: "Tarefas e demandas",
    descricao: "Atribuições, prazos (SLA) e atualizações de demandas.",
  },
  {
    id: "propostas",
    label: "Propostas",
    descricao: "Mudanças de status e retorno do banco.",
  },
  {
    id: "crm",
    label: "CRM e clientes",
    descricao: "Novos clientes, interações e movimentações na esteira.",
  },
  {
    id: "financeiro",
    label: "Financeiro",
    descricao: "Contas, comissões e lançamentos.",
  },
  {
    id: "sistema",
    label: "Sistema",
    descricao: "Avisos gerais e comunicados da plataforma.",
  },
  {
    id: "retorno_proposta",
    label: "Retorno de proposta",
    descricao: "Alertas visuais e sonoros quando o banco responde uma proposta.",
  },
  {
    id: "retorno_simulacao",
    label: "Retorno de simulação",
    descricao: "Alertas quando uma simulação automática ou comparativo é concluído.",
  },
];


const STORAGE_KEY = "agilliza:notif-prefs";

const PADRAO: NotificationPrefs = {
  ativo: true,
  tipos: {
    chat: { ativo: true, som: true },
    tarefas: { ativo: true, som: true },
    propostas: { ativo: true, som: false },
    crm: { ativo: true, som: false },
    financeiro: { ativo: true, som: false },
    sistema: { ativo: true, som: false },
    retorno_proposta: { ativo: true, som: true },
    retorno_simulacao: { ativo: true, som: true },

  },
};

const EVENTO = "agilliza:notif-prefs-change";

function clone(p: NotificationPrefs): NotificationPrefs {
  return { ativo: p.ativo, tipos: { ...p.tipos } };
}

/** Lê as preferências atuais (com fallback para o padrão). */
export function getNotificationPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return clone(PADRAO);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(PADRAO);
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    const tipos = { ...PADRAO.tipos };
    if (parsed.tipos) {
      for (const t of TIPOS_NOTIFICACAO) {
        const v = parsed.tipos[t.id];
        if (v) tipos[t.id] = { ativo: !!v.ativo, som: !!v.som };
      }
    }
    return { ativo: parsed.ativo !== false, tipos };
  } catch {
    return clone(PADRAO);
  }
}

/** Salva as preferências e notifica ouvintes. */
export function setNotificationPrefs(prefs: NotificationPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent(EVENTO));
  } catch {
    /* ignore */
  }
}

/** Verdadeiro se o tipo deve ser exibido (piscar/toast). */
export function tipoAtivo(tipo: TipoNotificacao): boolean {
  const p = getNotificationPrefs();
  return p.ativo && p.tipos[tipo]?.ativo !== false;
}

/** Verdadeiro se o tipo deve tocar som. */
export function tipoComSom(tipo: TipoNotificacao): boolean {
  const p = getNotificationPrefs();
  return p.ativo && p.tipos[tipo]?.ativo !== false && p.tipos[tipo]?.som === true;
}

/** Assina mudanças nas preferências (retorna função de limpeza). */
export function subscribeNotificationPrefs(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Mapeia o `tipo` bruto de uma notificação para uma categoria de preferência. */
export function categoriaDeTipo(tipo: string | null | undefined): TipoNotificacao {
  const t = (tipo ?? "").toLowerCase();
  if (t.includes("chat") || t.includes("mensagem")) return "chat";
  if (t.includes("tarefa") || t.includes("demanda") || t.includes("sla")) return "tarefas";
  if (t.includes("retorno_proposta")) return "retorno_proposta";
  if (t.includes("retorno_simulacao")) return "retorno_simulacao";
  if (t.includes("proposta") || t.includes("envio") || t.includes("banco")) return "propostas";

  if (t.includes("cliente") || t.includes("interacao") || t.includes("cadastro") || t.includes("crm"))
    return "crm";
  if (
    t.includes("financ") ||
    t.includes("pagar") ||
    t.includes("receber") ||
    t.includes("comiss") ||
    t.includes("contrato")
  )
    return "financeiro";
  return "sistema";
}
