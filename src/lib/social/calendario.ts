/**
 * Contas do calendário das Automações (sem tela): grade do mês e da semana, chave do dia,
 * agrupamento dos posts e o horário mantido ao arrastar para outro dia. Domingo abre a semana,
 * como no Postei.
 */
import { chaveDoDia } from "./datas-br";

export type VisaoCalendario = "mes" | "semana" | "agenda";

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const somarDias = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const inicioDaSemana = (d: Date) => somarDias(inicioDoDia(d), -d.getDay());
export const inicioDoMes = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const mesmoDia = (a: Date, b: Date) => chaveDoDia(a) === chaveDoDia(b);
export const mesmoMes = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

/** Dias da grade do mês: começa no domingo; tira a 6ª semana quando ela é toda do mês seguinte. */
export function gradeDoMes(base: Date): Date[] {
  const ini = inicioDaSemana(inicioDoMes(base));
  const dias = Array.from({ length: 42 }, (_, i) => somarDias(ini, i));
  return mesmoMes(dias[35]!, base) ? dias : dias.slice(0, 35);
}

export function diasDaSemana(base: Date): Date[] {
  const ini = inicioDaSemana(base);
  return Array.from({ length: 7 }, (_, i) => somarDias(ini, i));
}

export function diasDoMes(base: Date): Date[] {
  const n = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  return Array.from({ length: n }, (_, i) => new Date(base.getFullYear(), base.getMonth(), i + 1));
}

/** Período a buscar no banco: a grade inteira com folga (o fuso agrupa no navegador). */
export function periodoDaVisao(base: Date, visao: VisaoCalendario): { de: Date; ate: Date } {
  if (visao === "semana") {
    const ini = inicioDaSemana(base);
    return { de: somarDias(ini, -1), ate: somarDias(ini, 8) };
  }
  const g = gradeDoMes(base);
  return { de: somarDias(g[0]!, -1), ate: somarDias(g[g.length - 1]!, 2) };
}

/** Agrupa por dia (fuso do navegador) os posts com data; sem data ficam de fora. */
export function porDia<T extends { agendado_para: string | null }>(posts: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const p of posts) {
    if (!p.agendado_para) continue;
    const k = chaveDoDia(new Date(p.agendado_para));
    m.set(k, [...(m.get(k) ?? []), p]);
  }
  for (const lista of m.values())
    lista.sort((a, b) => Date.parse(a.agendado_para!) - Date.parse(b.agendado_para!));
  return m;
}

/** Novo horário ao arrastar o post para outro dia: mesmo horário, outro dia. */
export function moverParaDia(original: string, dia: Date): Date {
  const o = new Date(original);
  return new Date(
    dia.getFullYear(),
    dia.getMonth(),
    dia.getDate(),
    o.getHours(),
    o.getMinutes(),
    0,
    0,
  );
}

/** "2026-10-26" → Date local (meio-dia, para não virar o dia anterior em fuso nenhum). */
export function lerDia(s: string | undefined | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [a, m, d] = s.split("-").map(Number);
  const r = new Date(a!, m! - 1, d!, 12);
  return Number.isNaN(r.getTime()) ? null : r;
}

/** Só post que ainda não começou a sair muda de dia (as mesmas regras do banco). */
export function podeArrastar(p: { status: string; destinos?: { status: string }[] }): boolean {
  if (!["rascunho", "aguardando_aprovacao", "agendado"].includes(p.status)) return false;
  return !(p.destinos ?? []).some((d) => d.status === "publicando" || d.status === "publicado");
}
