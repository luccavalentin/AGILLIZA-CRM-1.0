/**
 * Gráficos dos Relatórios (desenho do Postei, cores do Agilliza): barras de série única com
 * dica ao passar o mouse ou tocar, barra horizontal com a marca da rede e linha de série para
 * as métricas da conta. Leves e prontos para a impressão (Exportar PDF).
 */
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Dado = { rotulo: string; valor: number; dica: string };

export function Barras({
  dados,
  denso = false,
  vazio = "Sem publicações no período",
}: {
  dados: Dado[];
  denso?: boolean;
  vazio?: string;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  // Topo do eixo sempre par: o tique do meio fica inteiro.
  const max = Math.max(2, Math.ceil(Math.max(...dados.map((d) => d.valor), 0) / 2) * 2);
  const tiques = [max, max / 2, 0];
  const nada = dados.every((d) => d.valor === 0);
  const fino = !denso && dados.length > 8;
  const n = dados.length;
  return (
    <div
      className="relative"
      role="img"
      aria-label={dados.map((d) => d.dica).join("; ")}
      onPointerLeave={(e) => e.pointerType === "mouse" && setAtivo(null)}
    >
      <div className="flex h-44 gap-2.5 sm:h-48 sm:gap-3">
        <div
          className="flex flex-col justify-between pb-6 text-right text-[11px] tabular-nums text-muted-foreground"
          aria-hidden
        >
          {tiques.map((t, i) => (
            <span key={i}>
              {t.toLocaleString("pt-BR", { notation: t >= 10_000 ? "compact" : "standard" })}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div
            className="absolute inset-x-0 bottom-6 top-0 flex flex-col justify-between"
            aria-hidden
          >
            {tiques.map((_, i) => (
              <span
                key={i}
                className={cn("h-px", i === tiques.length - 1 ? "bg-border" : "bg-border/60")}
              />
            ))}
          </div>
          <div
            className={cn(
              "relative flex h-full items-end",
              denso ? "gap-[2px]" : "gap-1.5 sm:gap-2",
            )}
          >
            {dados.map((d, i) => {
              const on = ativo === i;
              const lado =
                i < n * 0.25 ? "left-0" : i >= n * 0.75 ? "right-0" : "left-1/2 -translate-x-1/2";
              return (
                <div
                  key={i}
                  className="relative flex h-full min-w-0 flex-1 cursor-default flex-col justify-end"
                  onPointerEnter={(e) => e.pointerType === "mouse" && setAtivo(i)}
                  onClick={() => setAtivo((a) => (a === i ? null : i))}
                >
                  <div className="relative flex flex-1 items-end pb-6">
                    <div
                      className={cn(
                        "w-full rounded-t-[4px] transition-colors",
                        on ? "bg-primary" : "bg-primary/75",
                        d.valor === 0 && "!bg-transparent",
                      )}
                      style={{ height: `${(d.valor / max) * 100}%`, minHeight: d.valor ? 3 : 0 }}
                    />
                  </div>
                  <span
                    aria-hidden
                    className={cn(
                      "absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10.5px] text-muted-foreground",
                      fino && (n - 1 - i) % 2 === 1 && "max-sm:invisible",
                    )}
                  >
                    {d.rotulo}
                  </span>
                  {on && (
                    <span
                      className={cn(
                        "pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs text-background shadow-lg",
                        lado,
                      )}
                    >
                      {d.dica}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {nada && (
        <p className="absolute inset-0 grid place-items-center pb-6 text-[13px] text-muted-foreground">
          {vazio}
        </p>
      )}
    </div>
  );
}

/** Barra horizontal com identidade pelo ícone + nome (nunca só pela cor). */
export function BarraH({
  icone,
  rotulo,
  valor,
  max,
  extra,
}: {
  icone: ReactNode;
  rotulo: string;
  valor: number;
  max: number;
  extra?: string;
}) {
  return (
    <div className="flex items-center gap-3" title={`${rotulo}: ${valor}`}>
      {icone}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3 text-[13px]">
          <span className="min-w-0 break-words">{rotulo}</span>
          <span className="shrink-0 font-medium tabular-nums">
            {valor.toLocaleString("pt-BR")}
            {extra && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">{extra}</span>
            )}
          </span>
        </div>
        <div className="mt-1.5 h-2 rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.max(4, (valor / Math.max(1, max)) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** Linha de uma série diária (seguidores, alcance…), com pontos nulos ignorados. */
export function Linha({
  pontos,
  altura = 120,
  rotulo,
}: {
  pontos: { dia: string; valor: number | null }[];
  altura?: number;
  rotulo: string;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const validos = pontos.map((p, i) => ({ ...p, i })).filter((p) => p.valor != null) as {
    dia: string;
    valor: number;
    i: number;
  }[];
  if (validos.length < 2)
    return (
      <p
        className="grid place-items-center text-[13px] text-muted-foreground"
        style={{ height: altura }}
      >
        Poucos dias coletados ainda.
      </p>
    );
  const min = Math.min(...validos.map((p) => p.valor));
  const max = Math.max(...validos.map((p) => p.valor));
  const faixa = max - min || 1;
  const w = 600;
  const h = altura;
  const x = (i: number) => (i / Math.max(1, pontos.length - 1)) * w;
  const y = (v: number) => h - 8 - ((v - min) / faixa) * (h - 16);
  const caminho = validos
    .map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.valor).toFixed(1)}`)
    .join(" ");
  const area = `${caminho} L${x(validos[validos.length - 1]!.i).toFixed(1)},${h} L${x(validos[0]!.i).toFixed(1)},${h} Z`;
  const sel = ativo != null ? validos.find((p) => p.i === ativo) : null;
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height: h }}
        role="img"
        aria-label={`${rotulo}: de ${validos[0]!.valor.toLocaleString("pt-BR")} a ${validos[validos.length - 1]!.valor.toLocaleString("pt-BR")}`}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGElement).getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left) / r.width) * (pontos.length - 1));
          setAtivo(Math.max(0, Math.min(pontos.length - 1, i)));
        }}
        onPointerLeave={() => setAtivo(null)}
      >
        <path d={area} className="fill-primary/[0.08]" />
        <path
          d={caminho}
          className="fill-none stroke-primary"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        {sel && (
          <line
            x1={x(sel.i)}
            x2={x(sel.i)}
            y1={0}
            y2={h}
            className="stroke-border"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {sel && (
        <span
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-xs text-background"
          style={{ left: `${(sel.i / Math.max(1, pontos.length - 1)) * 100}%` }}
        >
          {new Date(`${sel.dia}T12:00:00`).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          })}
          : {sel.valor.toLocaleString("pt-BR")}
        </span>
      )}
      <div className="mt-1 flex justify-between text-[10.5px] text-muted-foreground">
        <span>
          {new Date(`${pontos[0]!.dia}T12:00:00`).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          })}
        </span>
        <span>
          {new Date(`${pontos[pontos.length - 1]!.dia}T12:00:00`).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
