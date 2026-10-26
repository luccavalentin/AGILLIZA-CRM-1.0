/**
 * Agenda de tarefas no desenho das Tarefas do Agilliza Tech (C35): grupos por quando
 * (atrasadas, hoje, próximos 7 dias, mais adiante, sem data, concluídas) e os quatro
 * números do topo. Módulo puro — a tela e os testes usam a mesma regra.
 */
import type { TipoTarefa } from "./frase-tarefa";

export const TIPOS_TAREFA: Record<TipoTarefa, string> = {
  ligacao: "Ligação",
  visita: "Visita",
  reuniao: "Reunião",
  documento: "Documento",
  lembrete: "Lembrete",
  outro: "Outro",
};

export const LISTA_TIPOS_TAREFA = Object.keys(TIPOS_TAREFA) as TipoTarefa[];

export type Recorrencia = "diaria" | "semanal" | "mensal";
export const RECORRENCIAS: Record<Recorrencia, string> = {
  diaria: "Todo dia",
  semanal: "Toda semana",
  mensal: "Todo mês",
};

export function rotuloTipoTarefa(tipo: string | null | undefined): string {
  return TIPOS_TAREFA[(tipo ?? "lembrete") as TipoTarefa] ?? "Lembrete";
}

/** Campos mínimos que a agenda precisa de cada tarefa. */
export interface TarefaDaAgenda {
  id: string;
  status: string;
  prazo: string | null;
  concluida_em?: string | null;
  created_at?: string | null;
}

export type ChaveGrupo = "atrasadas" | "hoje" | "semana" | "depois" | "sem-data" | "feitas";

export interface GrupoAgenda<T> {
  chave: ChaveGrupo;
  rotulo: string;
  tom?: "perigo" | "marca";
  tarefas: T[];
}

/** Concluídas e canceladas aparecem por duas semanas, para a lista não crescer sem fim. */
export const DIAS_CONCLUIDAS_VISIVEIS = 14;

export function estaAberta(status: string): boolean {
  return status === "aberta" || status === "em_andamento";
}

function instante(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function fimDoDia(agora: Date): number {
  const d = new Date(agora);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Agrupa na ordem da agenda; grupos vazios saem da lista. */
export function agruparAgenda<T extends TarefaDaAgenda>(tarefas: T[], agora: Date): GrupoAgenda<T>[] {
  const ag = agora.getTime();
  const fimHoje = fimDoDia(agora);
  const fimSemana = fimHoje + 7 * 86_400_000;
  const corte = ag - DIAS_CONCLUIDAS_VISIVEIS * 86_400_000;

  const g: Record<ChaveGrupo, T[]> = {
    atrasadas: [],
    hoje: [],
    semana: [],
    depois: [],
    "sem-data": [],
    feitas: [],
  };
  for (const t of tarefas) {
    if (!estaAberta(t.status)) {
      const quando = instante(t.concluida_em) ?? instante(t.created_at) ?? ag;
      if (quando >= corte) g.feitas.push(t);
      continue;
    }
    const p = instante(t.prazo);
    if (p === null) g["sem-data"].push(t);
    else if (p < ag) g.atrasadas.push(t);
    else if (p <= fimHoje) g.hoje.push(t);
    else if (p <= fimSemana) g.semana.push(t);
    else g.depois.push(t);
  }
  const porPrazo = (a: T, b: T) =>
    (instante(a.prazo) ?? Number.MAX_SAFE_INTEGER) - (instante(b.prazo) ?? Number.MAX_SAFE_INTEGER);
  for (const k of ["atrasadas", "hoje", "semana", "depois"] as const) g[k].sort(porPrazo);
  g.feitas.sort(
    (a, b) =>
      (instante(b.concluida_em) ?? instante(b.created_at) ?? 0) -
      (instante(a.concluida_em) ?? instante(a.created_at) ?? 0),
  );

  const grupos: GrupoAgenda<T>[] = [
    { chave: "atrasadas", rotulo: "Atrasadas", tom: "perigo", tarefas: g.atrasadas },
    { chave: "hoje", rotulo: "Hoje", tom: "marca", tarefas: g.hoje },
    { chave: "semana", rotulo: "Próximos 7 dias", tarefas: g.semana },
    { chave: "depois", rotulo: "Mais adiante", tarefas: g.depois },
    { chave: "sem-data", rotulo: "Sem data", tarefas: g["sem-data"] },
    { chave: "feitas", rotulo: "Concluídas e canceladas", tarefas: g.feitas },
  ];
  return grupos.filter((x) => x.tarefas.length > 0);
}

export interface MetricasAgenda {
  atrasadas: number;
  hoje: number;
  semana: number;
  concluidasSemana: number;
}

/** Os quatro números do topo (mesmos da agenda do Agilliza Tech). */
export function metricasAgenda(tarefas: TarefaDaAgenda[], agora: Date): MetricasAgenda {
  const ag = agora.getTime();
  const inicioHoje = new Date(agora);
  inicioHoje.setHours(0, 0, 0, 0);
  const fimHoje = fimDoDia(agora);
  const fimSemana = ag + 7 * 86_400_000;
  const semanaAtras = ag - 7 * 86_400_000;
  const m: MetricasAgenda = { atrasadas: 0, hoje: 0, semana: 0, concluidasSemana: 0 };
  for (const t of tarefas) {
    const p = instante(t.prazo);
    if (estaAberta(t.status)) {
      if (p === null) continue;
      if (p < ag) m.atrasadas++;
      if (p >= inicioHoje.getTime() && p <= fimHoje) m.hoje++;
      if (p >= ag && p <= fimSemana) m.semana++;
    } else if (t.status === "concluida") {
      const c = instante(t.concluida_em);
      if (c !== null && c >= semanaAtras) m.concluidasSemana++;
    }
  }
  return m;
}
