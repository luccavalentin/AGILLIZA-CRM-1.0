/**
 * Descoberta automática do "drilldown" de um gráfico de relatório: identifica
 * qual coluna do detalhamento corresponde aos rótulos do gráfico, para que
 * clicar em uma barra/fatia abra exatamente as linhas que a compõem.
 */
import type { ReportCell, ReportChart, ReportColumn, ReportRow } from "@/lib/relatorios/shared";

const norm = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

/** Converte uma célula de data (ISO) no rótulo mensal usado nos gráficos: MM/AA. */
function rotuloMes(v: ReportCell): string | null {
  const s = String(v ?? "");
  const m = s.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[2]}/${m[1].slice(2)}`;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[2]}/${br[3].slice(2)}`;
  return null;
}

export interface ChartDrill {
  /** Coluna do detalhamento usada para separar as linhas. */
  key: string;
  /** Retorna as linhas que compõem um rótulo do gráfico. */
  filtrar: (label: string) => ReportRow[];
  /** Rótulos do gráfico que possuem linhas correspondentes. */
  cobertura: number;
}

/**
 * Tenta casar os rótulos do gráfico com os valores de alguma coluna das linhas.
 * Retorna `null` quando o gráfico é derivado (ex.: funil) e não tem coluna equivalente.
 */
export function resolverDrillGrafico(
  chart: ReportChart,
  columns: ReportColumn[],
  rows: ReportRow[],
): ChartDrill | null {
  if (!rows.length || !chart.dados.length) return null;
  const labels = chart.dados.map((d) => norm(d.label)).filter((l) => l && l !== "—");
  if (!labels.length) return null;

  let melhor: ChartDrill | null = null;

  for (const col of columns) {
    // 1) Correspondência direta pelo valor da célula.
    const direto = new Map<string, ReportRow[]>();
    for (const r of rows) {
      const k = norm(r[col.key]);
      if (!k) continue;
      const l = direto.get(k) ?? [];
      l.push(r);
      direto.set(k, l);
    }
    const cobDireta = labels.filter((l) => direto.has(l)).length / labels.length;
    if (cobDireta >= 0.6 && (!melhor || cobDireta > melhor.cobertura)) {
      melhor = {
        key: col.key,
        cobertura: cobDireta,
        filtrar: (label) => direto.get(norm(label)) ?? [],
      };
    }

    // 2) Correspondência por mês (gráficos de evolução: MM/AA).
    const porMes = new Map<string, ReportRow[]>();
    for (const r of rows) {
      const k = rotuloMes(r[col.key]);
      if (!k) continue;
      const l = porMes.get(k) ?? [];
      l.push(r);
      porMes.set(k, l);
    }
    if (porMes.size) {
      const cobMes = labels.filter((l) => porMes.has(l)).length / labels.length;
      if (cobMes >= 0.6 && (!melhor || cobMes > melhor.cobertura)) {
        melhor = {
          key: col.key,
          cobertura: cobMes,
          filtrar: (label) => porMes.get(String(label)) ?? [],
        };
      }
    }
  }

  return melhor;
}
