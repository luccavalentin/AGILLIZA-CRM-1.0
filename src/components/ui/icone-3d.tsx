import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ícone 3D do Agilliza (pedido do dono de 26/10/2026, item C00: "elementos 3D igual dos
 * demais portais, profissional e sofisticado").
 *
 * É o mesmo objeto dos portais dos assinantes no Agilliza Tech (`.b3d` em
 * apps/web/src/components/shell/padrao-agilliza.css): uma peça pequena com face em
 * degradê da cor do tom, uma lateral mais escura que dá espessura e uma sombra colorida
 * no chão. Pequeno e contido (20 a 48 px), sem brinquedo. Inclina de leve quando o
 * cartão que o contém é apontado (classe `i3d-grupo` no pai) e fica parado para quem
 * pediu menos movimento (`prefers-reduced-motion`).
 *
 * CSS no bloco "Sistema 3D do Agilliza" de src/styles.css. Guia de uso: docs/visual-3d.md.
 *
 * @example
 *   <Icone3D icone={Wallet} tom="sucesso" tamanho="md" />
 *   <Icone3D tom="marca"><MeuGlifo /></Icone3D>
 */
export type TomIcone3D =
  "marca" | "sucesso" | "alerta" | "perigo" | "info" | "neutro" | "violeta" | "ciano";

export type TamanhoIcone3D = "xs" | "sm" | "md" | "lg" | "xl";

/** Lado real de cada tamanho, em px (também usado pelo CSS). */
export const LADO_ICONE_3D: Record<TamanhoIcone3D, number> = {
  xs: 20,
  sm: 24,
  md: 30,
  lg: 38,
  xl: 48,
};

/** Tom antigo dos painéis (`brand`, `success`...) para o tom do ícone 3D. */
export type TomLegado = "brand" | "success" | "warning" | "danger" | "neutral" | "info";
const DE_LEGADO: Record<TomLegado, TomIcone3D> = {
  brand: "marca",
  success: "sucesso",
  warning: "alerta",
  danger: "perigo",
  neutral: "neutro",
  info: "info",
};
export function tomIcone3D(tom: TomLegado | TomIcone3D | undefined): TomIcone3D {
  if (!tom) return "marca";
  return (DE_LEGADO as Record<string, TomIcone3D>)[tom] ?? (tom as TomIcone3D);
}

export function Icone3D({
  icone: Glifo,
  tom = "marca",
  tamanho = "md",
  className,
  style,
  children,
  rotulo,
}: {
  /** Glifo lucide. */
  icone?: LucideIcon;
  tom?: TomIcone3D;
  tamanho?: TamanhoIcone3D;
  className?: string;
  style?: CSSProperties;
  /** Glifo próprio (qualquer `<svg>`) no lugar do lucide. */
  children?: ReactNode;
  /** Texto para leitor de tela; sem ele o ícone é decorativo (`aria-hidden`). */
  rotulo?: string;
}) {
  return (
    <span
      className={cn("i3d", `i3d-${tamanho}`, `i3d-${tom}`, className)}
      style={style}
      data-icone-3d=""
      role={rotulo ? "img" : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
    >
      <span className="i3d-sombra" />
      <span className="i3d-lado" />
      <span className="i3d-face">{children ?? (Glifo ? <Glifo strokeWidth={1.75} /> : null)}</span>
    </span>
  );
}
