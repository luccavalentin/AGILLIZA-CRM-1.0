/**
 * Mapa do Brasil por UF em grade de quadrados (cartograma).
 *
 * Cada estado é um quadrado do mesmo tamanho, na posição aproximada dele no mapa: o
 * número de usuários fica legível em todos — no mapa geográfico, o DF e Sergipe sumiriam.
 * SVG puro, sem biblioteca; cabe em 360 px (6 colunas). Intensidade em 5 degraus de azul
 * sólido da marca (sem degradê); texto inverte para branco nos degraus escuros.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";

/** [coluna, linha] de cada UF na grade 6 × 9. */
const GRADE: Record<string, [number, number]> = {
  RR: [1, 0],
  AP: [3, 0],
  AM: [1, 1],
  PA: [2, 1],
  MA: [3, 1],
  CE: [4, 1],
  RN: [5, 1],
  AC: [0, 2],
  RO: [1, 2],
  TO: [2, 2],
  PI: [3, 2],
  PE: [4, 2],
  PB: [5, 2],
  MT: [1, 3],
  GO: [2, 3],
  BA: [3, 3],
  AL: [4, 3],
  MS: [1, 4],
  DF: [2, 4],
  MG: [3, 4],
  SE: [4, 4],
  SP: [2, 5],
  RJ: [3, 5],
  ES: [4, 5],
  PR: [2, 6],
  SC: [2, 7],
  RS: [2, 8],
};

export const NOME_UF: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

/** 5 degraus da cor da marca (opacidade sobre o fundo do cartão — cor sólida, sem degradê). */
const DEGRAUS = [0.1, 0.25, 0.45, 0.7, 1];

function degrau(n: number, max: number): number {
  if (n <= 0 || max <= 0) return -1;
  return Math.min(4, Math.floor((n / max) * 4.999));
}

const LADO = 46;
const VAO = 4;

export function MapaBrasil({
  porUf,
  rotuloValor = "usuários",
}: {
  porUf: Record<string, number>;
  rotuloValor?: string;
}) {
  const [foco, setFoco] = useState<string | null>(null);
  const max = Math.max(0, ...Object.keys(GRADE).map((uf) => porUf[uf] ?? 0));
  const largura = 6 * LADO + 5 * VAO;
  const altura = 9 * LADO + 8 * VAO;
  const ufFoco = foco && GRADE[foco] ? foco : null;

  return (
    <figure className="mx-auto w-full max-w-[340px]">
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Mapa do Brasil com ${rotuloValor} por estado`}
      >
        {Object.entries(GRADE).map(([uf, [c, l]]) => {
          const n = porUf[uf] ?? 0;
          const d = degrau(n, max);
          const x = c * (LADO + VAO);
          const y = l * (LADO + VAO);
          const escuro = d >= 3;
          const ativo = ufFoco === uf;
          return (
            <g
              key={uf}
              tabIndex={0}
              role="button"
              aria-label={`${NOME_UF[uf]}: ${n} ${rotuloValor}`}
              onMouseEnter={() => setFoco(uf)}
              onMouseLeave={() => setFoco(null)}
              onFocus={() => setFoco(uf)}
              onBlur={() => setFoco(null)}
              onClick={() => setFoco((f) => (f === uf ? null : uf))}
              className="cursor-pointer outline-none"
            >
              <rect
                x={x + 0.5}
                y={y + 0.5}
                width={LADO - 1}
                height={LADO - 1}
                rx={7}
                fill={d < 0 ? "var(--card)" : "var(--primary)"}
                fillOpacity={d < 0 ? 1 : DEGRAUS[d]}
                stroke={ativo ? "var(--foreground)" : d < 0 ? "var(--border)" : "var(--primary)"}
                strokeOpacity={ativo ? 0.9 : d < 0 ? 1 : 0.35}
                strokeWidth={ativo ? 1.5 : 1}
              />
              <text
                x={x + LADO / 2}
                y={y + 19}
                textAnchor="middle"
                className="select-none"
                fontSize={11}
                fontWeight={600}
                fill={escuro ? "var(--primary-foreground)" : "var(--foreground)"}
                fillOpacity={d < 0 ? 0.45 : 1}
              >
                {uf}
              </text>
              <text
                x={x + LADO / 2}
                y={y + 34}
                textAnchor="middle"
                className="select-none tabular-nums"
                fontSize={10.5}
                fill={escuro ? "var(--primary-foreground)" : "var(--muted-foreground)"}
                fillOpacity={d < 0 ? 0.6 : 0.95}
              >
                {n > 0 ? n.toLocaleString("pt-BR") : "·"}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className={cn("min-h-4 font-medium", ufFoco ? "text-foreground" : "")}>
          {ufFoco
            ? `${NOME_UF[ufFoco]}: ${(porUf[ufFoco] ?? 0).toLocaleString("pt-BR")} ${rotuloValor}`
            : "Toque num estado para ver o nome"}
        </span>
        <span className="flex items-center gap-1" aria-hidden>
          <span>menos</span>
          {DEGRAUS.map((o) => (
            <span
              key={o}
              className="size-3 rounded-[3px] border border-primary/30"
              style={{ background: "var(--primary)", opacity: o }}
            />
          ))}
          <span>mais</span>
        </span>
      </figcaption>
    </figure>
  );
}
