/**
 * Estado dos filtros da Consulta simulações (C28, 26/10/2026) — regras puras, testáveis.
 *
 * Os filtros principais moram na URL (`?q=`, `?de=`, `?ate=`, `?resp=`, `?escopo=`): voltar,
 * recarregar e compartilhar o endereço mantêm a consulta. Valor torto na URL nunca vira filtro.
 * As datas são do calendário de São Paulo (o mesmo do servidor de `listarSimulacoes`).
 */

export type Escopo = "todas" | "minhas";
export type PresetPeriodo = "hoje" | "7d" | "30d" | "mes";

export interface FiltrosSimulacoes {
  q: string;
  de: string;
  ate: string;
  /** "todos" ou o id do responsável. */
  resp: string;
  escopo: Escopo;
}

export const FILTROS_VAZIOS: FiltrosSimulacoes = {
  q: "",
  de: "",
  ate: "",
  resp: "todos",
  escopo: "todas",
};

/** Chaves da URL que pertencem a esta barra (as do filtro de base ficam de fora). */
export const CHAVES_FILTROS = ["q", "de", "ate", "resp", "escopo"] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "AAAA-MM-DD" de verdade (2026-02-31 não passa). */
export function dataValida(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [a, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return (
    a >= 2000 &&
    a <= 2100 &&
    dt.getUTCFullYear() === a &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Período em ordem: se vier invertido (de > até), troca em vez de devolver lista vazia. */
export function periodoEmOrdem(de: string, ate: string): { de: string; ate: string } {
  const d = dataValida(de) ? de : "";
  const a = dataValida(ate) ? ate : "";
  if (d && a && d > a) return { de: a, ate: d };
  return { de: d, ate: a };
}

export function lerFiltrosDaUrl(search: Record<string, unknown> | null | undefined): FiltrosSimulacoes {
  const s = search ?? {};
  const q = typeof s.q === "string" ? s.q.slice(0, 120) : typeof s.q === "number" ? String(s.q) : "";
  const { de, ate } = periodoEmOrdem(String(s.de ?? ""), String(s.ate ?? ""));
  const resp = typeof s.resp === "string" && UUID.test(s.resp) ? s.resp.toLowerCase() : "todos";
  const escopo: Escopo = s.escopo === "minhas" ? "minhas" : "todas";
  return { q, de, ate, resp, escopo };
}

/** Parâmetros de URL (sem os valores padrão, para o endereço ficar limpo). */
export function paramsDosFiltros(f: FiltrosSimulacoes): Partial<Record<(typeof CHAVES_FILTROS)[number], string>> {
  const { de, ate } = periodoEmOrdem(f.de, f.ate);
  const q = f.q.trim();
  return {
    ...(q ? { q } : {}),
    ...(de ? { de } : {}),
    ...(ate ? { ate } : {}),
    ...(f.resp !== "todos" && UUID.test(f.resp) ? { resp: f.resp } : {}),
    ...(f.escopo === "minhas" ? { escopo: "minhas" } : {}),
  };
}

/** Hoje no calendário de São Paulo ("AAAA-MM-DD"). */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  return agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

/** Período de um atalho, contando o dia de hoje (São Paulo). */
export function periodoDoPreset(p: PresetPeriodo, agora: Date = new Date()): { de: string; ate: string } {
  const hoje = hojeEmSaoPaulo(agora);
  switch (p) {
    case "hoje":
      return { de: hoje, ate: hoje };
    case "7d":
      return { de: somarDias(hoje, -6), ate: hoje };
    case "30d":
      return { de: somarDias(hoje, -29), ate: hoje };
    case "mes":
      return { de: `${hoje.slice(0, 8)}01`, ate: hoje };
  }
}

/** Qual atalho corresponde ao período (para destacar o botão), ou null. */
export function presetDoPeriodo(de: string, ate: string, agora: Date = new Date()): PresetPeriodo | null {
  for (const p of ["hoje", "7d", "30d", "mes"] as const) {
    const r = periodoDoPreset(p, agora);
    if (r.de === de && r.ate === ate) return p;
  }
  return null;
}

export const ROTULO_PRESET: Record<PresetPeriodo, string> = {
  hoje: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  mes: "Este mês",
};

function dataBR(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a.slice(2)}`;
}

/** Rótulo curto do período ("7 dias", "10/10/26 – 20/10/26", "desde 10/10/26"). */
export function rotuloPeriodo(de: string, ate: string, agora: Date = new Date()): string | null {
  const o = periodoEmOrdem(de, ate);
  if (!o.de && !o.ate) return null;
  const p = o.de && o.ate ? presetDoPeriodo(o.de, o.ate, agora) : null;
  if (p) return ROTULO_PRESET[p];
  if (o.de && o.ate) return o.de === o.ate ? dataBR(o.de) : `${dataBR(o.de)} – ${dataBR(o.ate)}`;
  return o.de ? `desde ${dataBR(o.de)}` : `até ${dataBR(o.ate)}`;
}

/** Quantos filtros estão aplicados (busca, período, responsável, "Minhas", excluídas). */
export function contarFiltrosAtivos(f: FiltrosSimulacoes, verExcluidas = false): number {
  const o = periodoEmOrdem(f.de, f.ate);
  return (
    (f.q.trim() ? 1 : 0) +
    (o.de || o.ate ? 1 : 0) +
    (f.escopo === "todas" && f.resp !== "todos" ? 1 : 0) +
    (f.escopo === "minhas" ? 1 : 0) +
    (verExcluidas ? 1 : 0)
  );
}

/** Parâmetros enviados a `listarSimulacoes` (os mesmos de antes da barra nova). */
export function paramsDaConsulta(f: FiltrosSimulacoes, busca: string) {
  const o = periodoEmOrdem(f.de, f.ate);
  return {
    escopo: f.escopo,
    q: busca.trim() || undefined,
    desde: o.de || undefined,
    ate: o.ate || undefined,
    responsavel: f.escopo === "todas" && f.resp !== "todos" ? f.resp : undefined,
  };
}
