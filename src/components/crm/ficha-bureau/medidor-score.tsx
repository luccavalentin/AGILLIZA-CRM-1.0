import type { CSSProperties } from "react";
import "./ficha-bureau.css";

/**
 * Medidor de score (o mesmo da Consulta Ficha dos assinantes): arco de 0 a 1.000 e o
 * ponteiro que sobe até o valor. Ninguém precisa decorar faixa para ver que parou no verde.
 */
const MARCAS = [0, 250, 500, 750, 1000];

export function MedidorScore({
  score,
  legenda,
  id = "fb-arco",
}: {
  /** Já na escala 0–1.000 (`scoreNaEscala`). */
  score: number;
  legenda: string;
  /** Id do degradê; muda quando há dois medidores na mesma página. */
  id?: string;
}) {
  const valor = Math.max(0, Math.min(1000, score));
  const angulo = -90 + (valor / 1000) * 180;
  return (
    <div className="fb-medidor" role="img" aria-label={`Score ${valor} de 0 a 1.000 — ${legenda}`}>
      <svg viewBox="0 0 260 150" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" x2="1">
            <stop offset="0" style={{ stopColor: "var(--destructive)" }} />
            <stop offset="0.45" style={{ stopColor: "var(--warning)" }} />
            <stop offset="1" style={{ stopColor: "var(--success)" }} />
          </linearGradient>
        </defs>
        <path className="fb-medidor-trilho" d="M20 130 A110 110 0 0 1 240 130" />
        <path className="fb-medidor-arco" d="M20 130 A110 110 0 0 1 240 130" stroke={`url(#${id})`} />
        {MARCAS.map((v) => {
          const a = Math.PI * (1 - v / 1000);
          return (
            <text
              key={v}
              x={130 + 88 * Math.cos(a)}
              y={132 - 88 * Math.sin(a) + 4}
              textAnchor="middle"
              className="fb-medidor-marca"
            >
              {v}
            </text>
          );
        })}
        <g className="fb-ponteiro" style={{ "--ang": `${angulo}deg` } as CSSProperties}>
          <path d="M126 130 L130 40 L134 130 Z" />
          <circle cx="130" cy="130" r="10" />
          <circle cx="130" cy="130" r="4" className="fb-ponteiro-eixo" />
        </g>
      </svg>
      <div className="fb-medidor-leitura">
        <b>{valor}</b>
        <span>{legenda}</span>
      </div>
    </div>
  );
}
