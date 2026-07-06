import {
  BarChart,
  Bar,
  Cell,
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
import { corDoBanco } from "@/lib/bancos/cores";
import { logoUrlDoBanco } from "@/components/bancos/banco-logo";

/** Tick do eixo Y que exibe o logo do banco ao lado do nome. */
function BankYAxisTick(props: {
  x?: number;
  y?: number;
  width?: number;
  payload?: { value?: string };
}) {
  const { x = 0, y = 0, payload } = props;
  const label = String(payload?.value ?? "");
  const logo = logoUrlDoBanco(label);
  const size = 16;
  const left = -128;
  const textX = logo ? left + size + 6 : left;
  return (
    <g transform={`translate(${x},${y})`}>
      {logo && (
        <image
          href={logo}
          x={left}
          y={-size / 2}
          width={size}
          height={size}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
      <text
        x={textX}
        y={0}
        dy={4}
        textAnchor="start"
        fontSize={11}
        fill="hsl(var(--muted-foreground))"
      >
        {label}
      </text>
    </g>
  );
}

/** Gera ticks inteiros únicos e "redondos" de 0 até um máximo confortável. */
function niceIntTicks(max: number): number[] {
  const topo = Math.max(1, Math.ceil(max));
  // Passo inteiro que resulta em ~4 divisões, sempre >= 1.
  const step = Math.max(1, Math.ceil(topo / 4));
  const fim = Math.ceil(topo / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= fim; v += step) ticks.push(v);
  return ticks;
}



const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

/** Renderiza um gráfico de relatório/painel conforme o tipo. */
export function ReportChartView({
  chart,
  colorByBank = false,
}: {
  chart: ReportChart;
  /** Colore cada barra com a cor de marca do banco correspondente ao rótulo. */
  colorByBank?: boolean;
}) {
  const fmt = chart.moeda
    ? (v: number) => formatBRL(Number(v))
    : (v: number) => Number(v).toLocaleString("pt-BR");
  // Contagens não têm casas decimais; valores monetários mantêm o formato BRL.
  const allowDecimals = Boolean(chart.moeda);

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
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            width={56}
            allowDecimals={allowDecimals}
          />
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
    // Para contagens (sem decimais), gera ticks inteiros únicos e evita que o
    // recharts arredonde ticks fracionários em números repetidos (ex.: 1 1 2 2).
    const maxValor = Math.max(0, ...chart.dados.map((d) => Number(d.valor) || 0));
    const intTicks = !allowDecimals ? niceIntTicks(maxValor) : undefined;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chart.dados} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={fmt}
            allowDecimals={allowDecimals}
            {...(intTicks
              ? { ticks: intTicks, domain: [0, intTicks[intTicks.length - 1]] }
              : {})}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={colorByBank ? <BankYAxisTick /> : { fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            width={colorByBank ? 136 : 110}
          />

          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
          <Bar dataKey="valor" radius={[0, 4, 4, 0]} fill="var(--chart-1)">
            {chart.dados.map((d, i) => (
              <Cell
                key={i}
                fill={colorByBank ? corDoBanco(d.label) : "var(--chart-1)"}
              />
            ))}
          </Bar>
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
          allowDecimals={allowDecimals}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
        <Bar dataKey="valor" radius={[4, 4, 0, 0]} fill="var(--chart-1)">
          {chart.dados.map((d, i) => (
            <Cell
              key={i}
              fill={colorByBank ? corDoBanco(d.label) : "var(--chart-1)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
