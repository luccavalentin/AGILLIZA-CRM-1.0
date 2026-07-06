import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ReportChart } from "@/lib/relatorios/shared";
import { formatBRL } from "@/lib/simulacao/format";

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

/** Renderiza um gráfico de relatório/painel conforme o tipo. */
export function ReportChartView({ chart }: { chart: ReportChart }) {
  const fmt = chart.moeda
    ? (v: number) => formatBRL(Number(v))
    : (v: number) => Number(v).toLocaleString("pt-BR");

  if (chart.dados.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Sem dados no período.
      </div>
    );
  }

  if (chart.tipo === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chart.dados}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={56} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
          {chart.serie2 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          <Line
            type="monotone"
            dataKey="valor"
            name={chart.serie1 ?? "Total"}
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={false}
          />
          {chart.serie2 && (
            <Line
              type="monotone"
              dataKey="valor2"
              name={chart.serie2}
              stroke="var(--chart-3)"
              strokeWidth={2}
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chart.tipo === "barh" || chart.tipo === "funnel") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chart.dados} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={fmt}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            width={110}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
          <Bar dataKey="valor" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chart.dados}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis
          tick={{ fontSize: 11 }}
          stroke="hsl(var(--muted-foreground))"
          width={56}
          tickFormatter={fmt}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
        <Bar dataKey="valor" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
