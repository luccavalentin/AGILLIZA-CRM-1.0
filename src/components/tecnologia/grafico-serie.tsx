/**
 * Gráfico de série temporal da Gestão de Tecnologia (recharts, já usado no Agilliza).
 *
 * Eixos discretos, grade horizontal tracejada fina, linhas de 1,75 px com preenchimento
 * sólido bem leve (sem degradê), dica com o horário e os valores alinhados. Redimensiona
 * com o contêiner — no celular fica com 200 px de altura e menos marcas no eixo.
 */
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { COR } from "./base";

export interface SerieDef {
  chave: string;
  rotulo: string;
  cor: string;
  tipo?: "linha" | "area" | "barra";
  formatar?: (v: number) => string;
  eixo?: "esq" | "dir";
}

const fmtPadrao = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function Dica({
  active,
  payload,
  label,
  series,
  rotuloX,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number | null; color: string }[];
  label?: string;
  series: SerieDef[];
  rotuloX: (v: string) => string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="min-w-[180px] rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{rotuloX(label)}</p>
      <ul className="space-y-1">
        {series.map((s) => {
          const p = payload.find((x) => x.dataKey === s.chave);
          const v = p?.value;
          return (
            <li key={s.chave} className="flex items-center justify-between gap-4 text-xs">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="h-0.5 w-3 rounded-full" style={{ background: s.cor }} />
                {s.rotulo}
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {v == null ? "—" : (s.formatar ?? fmtPadrao)(v)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function GraficoSerie<T extends object>({
  dados,
  chaveX,
  series,
  rotuloX,
  rotuloDica,
  altura = "h-[200px] sm:h-[240px]",
  limite,
  dominioY,
  vazio,
}: {
  dados: T[];
  chaveX: keyof T & string;
  series: SerieDef[];
  rotuloX: (v: string) => string;
  rotuloDica?: (v: string) => string;
  /** Classes de altura (celular / maior). */
  altura?: string;
  /** Linha de referência (ex.: limite de alerta). */
  limite?: { valor: number; rotulo: string };
  dominioY?: [number | "auto", number | "auto"];
  vazio?: React.ReactNode;
}) {
  if (!dados.length) return <>{vazio ?? null}</>;
  const temDir = series.some((s) => s.eixo === "dir");
  return (
    <div className={`w-full min-w-0 ${altura}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={dados}
          margin={{ top: 8, right: temDir ? 4 : 8, bottom: 0, left: -12 }}
        >
          <CartesianGrid vertical={false} stroke={COR.grade} strokeDasharray="3 4" />
          <XAxis
            dataKey={chaveX}
            tickFormatter={rotuloX}
            tick={{ fill: COR.eixo, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: COR.grade }}
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="esq"
            tick={{ fill: COR.eixo, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={50}
            allowDecimals={false}
            domain={dominioY ?? [0, "auto"]}
            tickFormatter={(v: number) =>
              v >= 1000
                ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
                : v.toLocaleString("pt-BR")
            }
          />
          {temDir && (
            <YAxis
              yAxisId="dir"
              orientation="right"
              tick={{ fill: COR.eixo, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={40}
              domain={[0, "auto"]}
            />
          )}
          <Tooltip
            cursor={{ stroke: COR.eixo, strokeOpacity: 0.35, strokeDasharray: "3 3" }}
            content={<Dica series={series} rotuloX={rotuloDica ?? rotuloX} />}
          />
          {limite && (
            <ReferenceLine
              yAxisId="esq"
              y={limite.valor}
              stroke={COR.falha}
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              label={{
                value: limite.rotulo,
                position: "insideTopRight",
                fill: COR.falha,
                fontSize: 10,
              }}
            />
          )}
          {series.map((s) =>
            s.tipo === "barra" ? (
              <Bar
                key={s.chave}
                yAxisId={s.eixo ?? "esq"}
                dataKey={s.chave}
                fill={s.cor}
                radius={[2, 2, 0, 0]}
                maxBarSize={14}
                isAnimationActive={false}
              />
            ) : s.tipo === "area" ? (
              <Area
                key={s.chave}
                yAxisId={s.eixo ?? "esq"}
                type="monotone"
                dataKey={s.chave}
                stroke={s.cor}
                strokeWidth={1.75}
                fill={s.cor}
                fillOpacity={0.08}
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 0 }}
                connectNulls
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={s.chave}
                yAxisId={s.eixo ?? "esq"}
                type="monotone"
                dataKey={s.chave}
                stroke={s.cor}
                strokeWidth={1.75}
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 0 }}
                connectNulls
                isAnimationActive={false}
              />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Legenda horizontal dos gráficos (quebra linha no celular). */
export function Legenda({ series }: { series: Pick<SerieDef, "rotulo" | "cor">[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {series.map((s) => (
        <li key={s.rotulo} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-0.5 w-3 rounded-full" style={{ background: s.cor }} />
          {s.rotulo}
        </li>
      ))}
    </ul>
  );
}
