/**
 * Lembrete de tarefa antes do prazo (C35): antecedências oferecidas na tela e o rótulo.
 * O aviso sai pela rotina do banco (`tarefas_enviar_lembretes`, uma vez por tarefa).
 */
export const OPCOES_LEMBRETE: number[] = [0, 10, 30, 60, 120, 1440];
export const LEMBRETE_MAXIMO = 10080; // 7 dias

export function rotuloLembrete(min: number | null | undefined): string {
  if (min === null || min === undefined) return "Sem lembrete";
  if (!Number.isFinite(min) || min < 0 || min > LEMBRETE_MAXIMO) return "Sem lembrete";
  if (min === 0) return "Na hora do prazo";
  if (min < 60) return `${min} min antes`;
  if (min < 1440) return `${Math.round((min / 60) * 10) / 10} h antes`.replace(".", ",");
  const d = Math.round((min / 1440) * 10) / 10;
  return `${String(d).replace(".", ",")} dia${d > 1 ? "s" : ""} antes`;
}

/** Valor do campo da tela → minutos (ou null). Entrada torta vira "sem lembrete". */
export function lembreteDoCampo(v: string | null | undefined): number | null {
  if (!v || v === "nenhum") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= LEMBRETE_MAXIMO ? n : null;
}

/** Quando o aviso sai (null = sem lembrete ou sem prazo). */
export function momentoDoLembrete(prazoIso: string | null | undefined, min: number | null | undefined): Date | null {
  if (!prazoIso || min === null || min === undefined) return null;
  const t = new Date(prazoIso).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t - min * 60_000);
}
