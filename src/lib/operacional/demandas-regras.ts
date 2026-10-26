/**
 * Regras puras das Demandas (C36): rótulos, transições de situação e estado do prazo.
 * A decisão de verdade é do banco (migração 20261027040001: demanda_transicao_permitida,
 * demanda_mudar_status, demanda_distribuir); aqui fica a mesma tabela para a tela não
 * oferecer o que o banco vai recusar.
 */

export type DemandaStatus = "aberta" | "em_andamento" | "aguardando" | "concluida" | "cancelada";
export type DemandaPrioridade = "p1" | "p2" | "p3";
export type DemandaOrigem = "interno" | "assinante" | "vinculado";
export type DemandaEscopo = "minhas" | "criadas" | "equipe" | "sem_responsavel";

export const STATUS_DEMANDA_ORDEM: DemandaStatus[] = [
  "aberta",
  "em_andamento",
  "aguardando",
  "concluida",
  "cancelada",
];

export const ROTULO_STATUS_DEMANDA: Record<DemandaStatus, string> = {
  aberta: "Nova",
  em_andamento: "Em andamento",
  aguardando: "Aguardando solicitante",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

/** Rótulo curto (colunas do kanban e chips). */
export const ROTULO_STATUS_CURTO: Record<DemandaStatus, string> = {
  aberta: "Nova",
  em_andamento: "Em andamento",
  aguardando: "Aguardando",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const ROTULO_ORIGEM: Record<DemandaOrigem, string> = {
  interno: "Interno",
  assinante: "Assinante",
  vinculado: "Vinculado",
};

export const ROTULO_PRIORIDADE_DEMANDA: Record<DemandaPrioridade, string> = {
  p1: "Urgente",
  p2: "Normal",
  p3: "Baixa",
};

/** Tipos padrão (o correspondente ajusta nome e prazo em Configuração). */
export const TIPOS_DEMANDA_PADRAO: { codigo: string; nome: string }[] = [
  { codigo: "consulta_ficha", nome: "Consulta de ficha" },
  { codigo: "simulacao", nome: "Simulação" },
  { codigo: "proposta", nome: "Proposta" },
  { codigo: "documentacao", nome: "Documentação" },
  { codigo: "matricula", nome: "Matrícula" },
  { codigo: "duvida", nome: "Dúvida" },
  { codigo: "outro", nome: "Outro" },
];

/** Nome do tipo (tipos antigos, como "diversos", aparecem como "Outro"). */
export function nomeTipoDemanda(
  codigo: string | null | undefined,
  tipos?: { codigo: string; nome: string }[],
): string {
  if (!codigo) return "Outro";
  const achado = (tipos ?? TIPOS_DEMANDA_PADRAO).find((t) => t.codigo === codigo);
  if (achado) return achado.nome;
  const padrao = TIPOS_DEMANDA_PADRAO.find((t) => t.codigo === codigo);
  return padrao?.nome ?? "Outro";
}

/** Por que a demanda está com quem está (histórico e cartão). */
export const ROTULO_MOTIVO_ATRIBUICAO: Record<string, string> = {
  escolhido: "Escolhido por quem criou",
  analista_da_conta: "Analista da conta",
  fila: "Fila justa",
  assumida: "Assumiu",
  reatribuida: "Reatribuída",
  assumida_na_fila_de_propostas: "Assumiu a proposta",
};

const TRANSICOES: Record<DemandaStatus, DemandaStatus[]> = {
  aberta: ["em_andamento", "aguardando", "concluida", "cancelada"],
  em_andamento: ["aguardando", "concluida", "cancelada"],
  aguardando: ["em_andamento", "concluida", "cancelada"],
  concluida: ["em_andamento"],
  cancelada: ["aberta"],
};

/** Mesma tabela de `public.demanda_transicao_permitida`. */
export function transicaoDemandaPermitida(de: DemandaStatus, para: DemandaStatus): boolean {
  return de === para || (TRANSICOES[de]?.includes(para) ?? false);
}

export function proximosStatus(de: DemandaStatus): DemandaStatus[] {
  return TRANSICOES[de] ?? [];
}

/** Concluir/cancelar exigem a ação "encerrar"; cancelar exige motivo. */
export function exigeEncerrar(para: DemandaStatus): boolean {
  return para === "concluida" || para === "cancelada";
}

export type EstadoPrazo = "encerrada" | "sem_prazo" | "atrasada" | "vencendo" | "no_prazo";

/** Janela de "vencendo" (igual à da Central no banco: 4 horas). */
export const JANELA_VENCENDO_MS = 4 * 3600_000;

export function estadoPrazo(
  prazoIso: string | null | undefined,
  status: DemandaStatus,
  agora: Date = new Date(),
): EstadoPrazo {
  if (status === "concluida" || status === "cancelada") return "encerrada";
  if (!prazoIso) return "sem_prazo";
  const prazo = new Date(prazoIso).getTime();
  if (Number.isNaN(prazo)) return "sem_prazo";
  const resta = prazo - agora.getTime();
  if (resta < 0) return "atrasada";
  if (resta < JANELA_VENCENDO_MS) return "vencendo";
  return "no_prazo";
}

/** "faltam 3h", "atrasada há 2d", "vence em 40min". */
export function textoPrazo(
  prazoIso: string | null | undefined,
  status: DemandaStatus,
  agora: Date = new Date(),
): string {
  const estado = estadoPrazo(prazoIso, status, agora);
  if (estado === "encerrada") return ROTULO_STATUS_CURTO[status];
  if (estado === "sem_prazo" || !prazoIso) return "Sem prazo";
  const diff = new Date(prazoIso).getTime() - agora.getTime();
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60_000);
  const duracao =
    min < 60
      ? `${Math.max(min, 1)}min`
      : min < 48 * 60
        ? `${Math.round(min / 60)}h`
        : `${Math.round(min / 1440)}d`;
  return diff < 0 ? `Atrasada há ${duracao}` : `Vence em ${duracao}`;
}

/** Fração do prazo já consumida (0–1, limitada), para a barrinha do cartão. */
export function consumoPrazo(
  inicioIso: string | null | undefined,
  prazoIso: string | null | undefined,
  agora: Date = new Date(),
): number | null {
  if (!inicioIso || !prazoIso) return null;
  const ini = new Date(inicioIso).getTime();
  const fim = new Date(prazoIso).getTime();
  if (Number.isNaN(ini) || Number.isNaN(fim) || fim <= ini) return null;
  return Math.min(1, Math.max(0, (agora.getTime() - ini) / (fim - ini)));
}

/** Validação do motivo (reatribuir/devolver), igual ao banco: 5 a 500 letras. */
export function motivoValido(m: string | null | undefined): boolean {
  const t = (m ?? "").trim();
  return t.length >= 5 && t.length <= 500;
}
