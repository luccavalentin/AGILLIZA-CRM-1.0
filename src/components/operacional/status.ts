import type { Tone } from "@/components/crm/tone-badge";

export type Prioridade = "p1" | "p2" | "p3";

/** Rótulo + barra de prioridade (00b-tons-cores). */
export const PRIORIDADE: Record<Prioridade, { label: string; bar: string }> = {
  p1: { label: "P1", bar: "bg-destructive" },
  p2: { label: "P2", bar: "bg-warning" },
  p3: { label: "P3", bar: "bg-muted-foreground" },
};

export const STATUS_TAREFA: Record<string, { tone: Tone; label: string }> = {
  aberta: { tone: "info", label: "Aberta" },
  em_andamento: { tone: "warning", label: "Em andamento" },
  concluida: { tone: "success", label: "Concluída" },
  cancelada: { tone: "muted", label: "Cancelada" },
};

export const STATUS_DEMANDA: Record<string, { tone: Tone; label: string }> = {
  aberta: { tone: "info", label: "Aberta" },
  em_andamento: { tone: "warning", label: "Em andamento" },
  aguardando: { tone: "warning", label: "Aguardando" },
  concluida: { tone: "success", label: "Concluída" },
  cancelada: { tone: "muted", label: "Cancelada" },
};

export const TONE_BAR: Record<Tone, string> = {
  success: "bg-success",
  info: "bg-primary",
  warning: "bg-warning",
  danger: "bg-destructive",
  muted: "bg-muted-foreground",
};

export function statusTarefa(s: string) {
  return STATUS_TAREFA[s] ?? { tone: "muted" as Tone, label: s };
}
export function statusDemanda(s: string) {
  return STATUS_DEMANDA[s] ?? { tone: "muted" as Tone, label: s };
}
