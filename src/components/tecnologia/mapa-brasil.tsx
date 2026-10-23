/**
 * Mapa do Brasil por UF — contorno dos estados (`lib/tecnologia/brasil-geo.ts`), em SVG puro.
 *
 * Cor por intensidade (5 degraus do azul da marca, misturados ao fundo do cartão — funciona
 * no tema escuro e no claro), ponto pulsando onde há gente online agora, toque/passar o
 * mouse para ver o estado, e zoom simples (+, −, voltar) centrado no estado escolhido.
 * Estados pequenos do litoral (RN, PB, PE, AL, SE, ES, RJ) e o DF levam o rótulo para fora,
 * com um fio, para continuarem legíveis no celular. Cabe em 360 px.
 */
import { useMemo, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALTURA,
  CAMINHO_UF,
  LARGURA,
  NOME_UF,
  ROTULO_UF,
  projetar,
} from "@/lib/tecnologia/brasil-geo";

export { NOME_UF };

const DEGRAUS = [22, 38, 55, 75, 100];

/** Escala pela raiz: com SP muito à frente, a escala linear apagaria o resto do país. */
function degrau(n: number, max: number): number {
  if (n <= 0 || max <= 0) return -1;
  return Math.min(4, Math.floor(Math.sqrt(n / max) * 4.999));
}

const ZOOM = [1, 1.7, 2.6];

export function MapaBrasil({
  porUf,
  online,
  rotuloValor = "pessoas",
}: {
  /** Intensidade (cor) por UF. */
  porUf: Record<string, number>;
  /** Quem está online agora por UF: ponto pulsando. */
  online?: Record<string, number>;
  rotuloValor?: string;
}) {
  const [foco, setFoco] = useState<string | null>(null);
  const [nivel, setNivel] = useState(0);
  const max = Math.max(0, ...Object.keys(CAMINHO_UF).map((uf) => porUf[uf] ?? 0));

  const viewBox = useMemo(() => {
    const z = ZOOM[nivel];
    if (z === 1) return `0 0 ${LARGURA} ${ALTURA}`;
    const centro =
      foco && ROTULO_UF[foco] ? projetar(ROTULO_UF[foco].em) : [LARGURA * 0.62, ALTURA * 0.52];
    const w = LARGURA / z;
    const h = ALTURA / z;
    const x = Math.min(Math.max(centro[0] - w / 2, 0), LARGURA - w);
    const y = Math.min(Math.max(centro[1] - h / 2, 0), ALTURA - h);
    return `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
  }, [nivel, foco]);

  const escalaTexto = 1 / ZOOM[nivel];
  const ufs = Object.keys(CAMINHO_UF);

  return (
    <figure className="mx-auto w-full max-w-[560px]">
      <div className="mb-1 flex justify-end gap-1.5">
        <BotaoMapa
          rotulo="Aproximar"
          onClick={() => setNivel((n) => Math.min(ZOOM.length - 1, n + 1))}
          desativado={nivel === ZOOM.length - 1}
        >
          <Plus className="size-4" />
        </BotaoMapa>
        <BotaoMapa
          rotulo="Afastar"
          onClick={() => setNivel((n) => Math.max(0, n - 1))}
          desativado={nivel === 0}
        >
          <Minus className="size-4" />
        </BotaoMapa>
        <BotaoMapa
          rotulo="Ver o Brasil inteiro"
          onClick={() => {
            setNivel(0);
            setFoco(null);
          }}
          desativado={nivel === 0 && !foco}
        >
          <RotateCcw className="size-3.5" />
        </BotaoMapa>
      </div>
      <svg
        viewBox={viewBox}
        className="h-auto w-full touch-manipulation"
        role="img"
        aria-label={`Mapa do Brasil com ${rotuloValor} por estado`}
      >
        {ufs.map((uf) => {
          const n = porUf[uf] ?? 0;
          const d = degrau(n, max);
          const ativo = foco === uf;
          return (
            <path
              key={uf}
              d={CAMINHO_UF[uf]}
              tabIndex={0}
              role="button"
              aria-label={`${NOME_UF[uf]}: ${n} ${rotuloValor}${online?.[uf] ? `, ${online[uf]} online agora` : ""}`}
              onMouseEnter={() => setFoco(uf)}
              onFocus={() => setFoco(uf)}
              onClick={() => setFoco(uf)}
              className="cursor-pointer outline-none transition-[fill] duration-300"
              style={{
                fill:
                  d < 0
                    ? "var(--muted)"
                    : `color-mix(in oklab, var(--realce) ${DEGRAUS[d]}%, var(--card))`,
              }}
              stroke={ativo ? "var(--foreground)" : "var(--card)"}
              strokeWidth={(ativo ? 1.6 : 0.9) * escalaTexto}
              strokeLinejoin="round"
            />
          );
        })}
        {/* Fios dos rótulos de fora */}
        {ufs.map((uf) => {
          const r = ROTULO_UF[uf];
          if (!r?.fora) return null;
          const [x1, y1] = projetar(r.em);
          const [x2, y2] = projetar(r.fora);
          return (
            <line
              key={`f-${uf}`}
              x1={x1}
              y1={y1}
              x2={x2 - 6 * escalaTexto}
              y2={y2 - 2 * escalaTexto}
              stroke="var(--muted-foreground)"
              strokeOpacity={0.45}
              strokeWidth={0.6 * escalaTexto}
            />
          );
        })}
        {/* Pontos ao vivo */}
        {online &&
          ufs.map((uf) => {
            if (!online[uf]) return null;
            const [x, y] = projetar(ROTULO_UF[uf].em);
            const rr = 3.2 * escalaTexto;
            return (
              <g key={`p-${uf}`} pointerEvents="none">
                <circle cx={x} cy={y} r={rr} fill="var(--success)" className="tec-pulso" />
                <circle
                  cx={x}
                  cy={y}
                  r={rr}
                  fill="var(--success)"
                  stroke="var(--card)"
                  strokeWidth={0.8 * escalaTexto}
                />
              </g>
            );
          })}
        {/* Siglas */}
        {ufs.map((uf) => {
          const r = ROTULO_UF[uf];
          const [x, y] = projetar(r.fora ?? r.em);
          const d = degrau(porUf[uf] ?? 0, max);
          const temPonto = Boolean(online?.[uf]) && !r.fora;
          return (
            <text
              key={`t-${uf}`}
              x={x}
              y={y + (temPonto ? 11 : 3.5) * escalaTexto}
              textAnchor={r.fora ? "start" : "middle"}
              fontSize={10.5 * escalaTexto}
              fontWeight={600}
              pointerEvents="none"
              className="select-none"
              fill={!r.fora && d >= 3 ? "#ffffff" : "var(--foreground)"}
              fillOpacity={d < 0 ? 0.55 : 0.92}
            >
              {uf}
            </text>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[11px] text-muted-foreground">
        <span className={cn("min-h-4 font-medium", foco ? "text-foreground" : "")}>
          {foco
            ? `${NOME_UF[foco]}: ${(porUf[foco] ?? 0).toLocaleString("pt-BR")} ${rotuloValor}${
                online?.[foco] ? ` · ${online[foco]} online agora` : ""
              }`
            : "Toque num estado para ver os números"}
        </span>
        <span className="flex items-center gap-2">
          {online && (
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-success" /> online agora
            </span>
          )}
          <span className="flex items-center gap-1" aria-hidden>
            <span>menos</span>
            {DEGRAUS.map((p) => (
              <span
                key={p}
                className="size-3 rounded-[3px]"
                style={{ background: `color-mix(in oklab, var(--realce) ${p}%, var(--card))` }}
              />
            ))}
            <span>mais</span>
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

function BotaoMapa({
  rotulo,
  onClick,
  desativado,
  children,
}: {
  rotulo: string;
  onClick: () => void;
  desativado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      onClick={onClick}
      disabled={desativado}
      className="grid size-11 place-items-center rounded-lg border border-border bg-card text-foreground shadow-sm transition-colors hover:border-[color:var(--realce)] disabled:opacity-40 lg:size-8"
    >
      {children}
    </button>
  );
}
