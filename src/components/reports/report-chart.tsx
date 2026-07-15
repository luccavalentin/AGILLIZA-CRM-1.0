import {
  BarChart,
  Bar,
  Cell,
  LabelList,
  LineChart,
  Line,
  PieChart,
  Pie,
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
import { useIsMobile } from "@/hooks/use-mobile";

// Tokens do tema são valores HEX (não canais HSL), então referencie-os
// diretamente com var(--x) — envolver em hsl() produziria cor inválida.
const AXIS = "var(--muted-foreground)";
const GRID = "color-mix(in oklab, var(--border) 70%, transparent)";

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
  const size = 18;
  const left = -132;
  const textX = logo ? left + size + 8 : left;
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
        fontSize={12}
        fontWeight={500}
        fill="var(--foreground)"
      >
        {label}
      </text>
    </g>
  );
}

/** Gera ticks inteiros únicos e "redondos" de 0 até um máximo confortável. */
function niceIntTicks(max: number): number[] {
  const topo = Math.max(1, Math.ceil(max));
  const step = Math.max(1, Math.ceil(topo / 4));
  const fim = Math.ceil(topo / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= fim; v += step) ticks.push(v);
  return ticks;
}

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  boxShadow: "0 12px 32px -12px color-mix(in oklab, var(--foreground) 25%, transparent)",
  fontSize: 12,
  padding: "8px 12px",
};

const tooltipLabelStyle = { color: "var(--muted-foreground)", fontWeight: 500, marginBottom: 2 };
const tooltipItemStyle = { color: "var(--foreground)", fontWeight: 600 };

function MobileBarList({
  chart,
  colorByBank,
  fmt,
}: {
  chart: ReportChart;
  colorByBank: boolean;
  fmt: (v: number) => string;
}) {
  const maxValor = Math.max(1, ...chart.dados.map((d) => Number(d.valor) || 0));
  return (
    <div className="flex h-full min-h-[8rem] flex-col justify-center gap-3 overflow-hidden py-1">
      {chart.dados.map((d) => {
        const valor = Number(d.valor) || 0;
        const logo = colorByBank ? logoUrlDoBanco(d.label) : undefined;
        const cor = colorByBank
          ? corDoBanco(d.label)
          : "linear-gradient(90deg, color-mix(in oklab, var(--primary) 55%, transparent), var(--primary))";
        return (
          <div key={d.label} className="min-w-0 space-y-1.5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                {logo && (
                  <img
                    src={logo}
                    alt=""
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 object-contain"
                    loading="lazy"
                  />
                )}
                <span className="truncate">{d.label}</span>
              </span>
              <span className="shrink-0 font-mono font-semibold tabular-nums text-foreground">
                {fmt(valor)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(4, (valor / maxValor) * 100)}%`, background: cor }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Renderiza um gráfico de relatório/painel conforme o tipo. */
export function ReportChartView({
  chart,
  colorByBank = false,
}: {
  chart: ReportChart;
  /** Colore cada barra com a cor de marca do banco correspondente ao rótulo. */
  colorByBank?: boolean;
}) {
  const isMobile = useIsMobile();
  const fmt = chart.moeda
    ? (v: number) => formatBRL(Number(v))
    : (v: number) => Number(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const allowDecimals = Boolean(chart.moeda);

  if (chart.dados.length === 0) {
    return (
      <div className="flex h-full min-h-[8rem] items-center justify-center rounded-lg border border-dashed border-border/70 text-sm text-muted-foreground">
        Sem dados no período.
      </div>
    );
  }

  if (chart.tipo === "donut") {
    const paleta = [
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
      "color-mix(in oklab, var(--chart-1) 55%, var(--chart-4))",
      "color-mix(in oklab, var(--chart-2) 55%, var(--chart-5))",
      "color-mix(in oklab, var(--chart-3) 55%, var(--foreground) 15%)",
    ];
    const total = chart.dados.reduce((s, d) => s + (Number(d.valor) || 0), 0);
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 4, right: 4, bottom: isMobile ? 4 : 4, left: 4 }}>
          <Pie
            data={chart.dados}
            dataKey="valor"
            nameKey="label"
            cx="50%"
            cy={isMobile ? "42%" : "50%"}
            innerRadius="58%"
            outerRadius="86%"
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
          >
            {chart.dados.map((d, i) => (
              <Cell
                key={i}
                fill={colorByBank ? corDoBanco(d.label) : paleta[i % paleta.length]}
              />
            ))}
            <LabelList
              dataKey="valor"
              position="outside"
              formatter={(v: number) =>
                total ? `${Math.round((Number(v) / total) * 100)}%` : ""
              }
              style={{ fontSize: 11, fontWeight: 600, fill: "var(--foreground)" }}
            />
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(v: number, n: string) => [fmt(v), n]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="circle"
            layout={isMobile ? "horizontal" : "vertical"}
            align={isMobile ? "center" : "right"}
            verticalAlign={isMobile ? "bottom" : "middle"}
          />
        </PieChart>
      </ResponsiveContainer>
    );

  }



  if (chart.tipo === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chart.dados} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="lineFill1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: AXIS }}
            stroke={GRID}
            tickLine={false}
            axisLine={false}
            dy={6}
          />
          <YAxis
            tick={{ fontSize: 11, fill: AXIS }}
            stroke={GRID}
            width={56}
            tickLine={false}
            axisLine={false}
            allowDecimals={allowDecimals}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(v: number) => fmt(v)}
            cursor={{ stroke: GRID, strokeWidth: 1 }}
          />
          {chart.serie2 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          <Line
            type="monotone"
            dataKey="valor"
            name={chart.serie1 ?? "Total"}
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          {chart.serie2 && (
            <Line
              type="monotone"
              dataKey="valor2"
              name={chart.serie2}
              stroke="var(--chart-3)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chart.tipo === "barh" || chart.tipo === "funnel") {
    if (isMobile) {
      return <MobileBarList chart={chart} colorByBank={colorByBank} fmt={fmt} />;
    }

    const maxValor = Math.max(0, ...chart.dados.map((d) => Number(d.valor) || 0));
    const intTicks = !allowDecimals ? niceIntTicks(maxValor) : undefined;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chart.dados}
          layout="vertical"
          margin={{ top: 4, right: 44, bottom: 4, left: 0 }}
          barCategoryGap="28%"
        >
          <defs>
            <linearGradient id="barhFill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.85} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid horizontal={false} strokeDasharray="4 4" stroke={GRID} />
          <XAxis
            type="number"
            hide
            allowDecimals={allowDecimals}
            {...(intTicks ? { domain: [0, intTicks[intTicks.length - 1]] } : {})}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={colorByBank ? <BankYAxisTick /> : { fontSize: 12, fill: "var(--foreground)" }}
            stroke={AXIS}
            width={colorByBank ? 144 : 116}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(v: number) => fmt(v)}
            cursor={{ fill: "color-mix(in oklab, var(--muted) 55%, transparent)" }}
          />
          <Bar dataKey="valor" radius={[6, 6, 6, 6]} fill="url(#barhFill)" maxBarSize={26}>
            {chart.dados.map((d, i) => (
              <Cell key={i} fill={colorByBank ? corDoBanco(d.label) : "url(#barhFill)"} />
            ))}
            <LabelList
              dataKey="valor"
              position="right"
              formatter={(v: number) => fmt(v)}
              style={{ fontSize: 11, fontWeight: 600, fill: "var(--foreground)" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chart.dados} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="barvFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={1} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.75} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: AXIS }}
          stroke={GRID}
          tickLine={false}
          axisLine={false}
          dy={6}
        />
        <YAxis
          tick={{ fontSize: 11, fill: AXIS }}
          stroke={GRID}
          width={56}
          tickLine={false}
          axisLine={false}
          tickFormatter={fmt}
          allowDecimals={allowDecimals}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          formatter={(v: number) => fmt(v)}
          cursor={{ fill: "color-mix(in oklab, var(--muted) 55%, transparent)" }}
        />
        <Bar dataKey="valor" radius={[6, 6, 0, 0]} fill="url(#barvFill)" maxBarSize={48}>
          {chart.dados.map((d, i) => (
            <Cell key={i} fill={colorByBank ? corDoBanco(d.label) : "url(#barvFill)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
