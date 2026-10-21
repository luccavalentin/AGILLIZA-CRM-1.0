import { iniciaisDoNome } from "@/components/shared/iniciais";
export function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatarDia(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const mesmoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (mesmoDia(d, hoje)) return "Hoje";
  if (mesmoDia(d, ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function iniciais(nome?: string | null): string {
  return iniciaisDoNome(nome);
}

/**
 * Campo `datetime-local` <-> instante, sempre no horário de Brasília (UTC-03:00, sem
 * horário de verão desde 2019 — a mesma convenção de relatorios/shared.ts).
 *
 * O lembrete abria com `toISOString().slice(0, 16)` (hora UTC) e era salvo como hora
 * local: a cada "Salvar" adiantava 3 horas. O prazo de tarefa/retorno ia sem fuso e o
 * servidor (UTC) gravava 3 horas fora.
 */
const FUSO_BR = "-03:00";

/** "2026-10-21T14:30" (hora de Brasília) -> ISO em UTC. Vazio/ inválido -> null. */
export function datetimeLocalParaIso(valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)) return null;
  const comSegundos = v.length === 16 ? `${v}:00` : v;
  const d = new Date(`${comSegundos}${FUSO_BR}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO (qualquer fuso) -> "2026-10-21T14:30" no horário de Brasília, para o campo. */
export function isoParaDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Desloca para -03:00 e lê os campos em UTC: não depende do fuso do navegador.
  const br = new Date(d.getTime() - 3 * 3600_000);
  return br.toISOString().slice(0, 16);
}

export interface ChatClienteInfo {
  nome: string;
  documento?: string | null;
  email?: string | null;
  celular?: string | null;
  contexto?: string | null;
  /**
   * Thread aberta (dono da conversa). Vai junto quando a conversa é solta em janela
   * flutuante, para ela continuar na mesma thread (participante, visão supervisora).
   */
  atendenteId?: string;
  atendenteNome?: string;
}
