import { Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { corDoBanco } from "@/lib/bancos/cores";

/**
 * Marca visual (badge) do banco: quadrado arredondado na cor oficial da marca
 * com a inicial do banco. Escalável (SVG), responsivo e adaptável a qualquer
 * tamanho. Não reproduz o logotipo oficial — é uma marca-monograma derivada
 * da cor institucional de cada banco.
 */

/** Normaliza para casar a inicial correta. */
function normalizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Iniciais exibidas no badge por banco. */
function iniciaisDoBanco(nome: string): string {
  const n = normalizar(nome);
  if (n.includes("santander")) return "S";
  if (n.includes("itau")) return "I";
  if (n.includes("bradesco")) return "B";
  if (n.includes("banco do brasil") || /\bbb\b/.test(n)) return "BB";
  if (n.includes("caixa") || n.includes("cef")) return "CX";
  if (n.includes("inter")) return "IN";
  if (n.includes("sicredi")) return "SC";
  if (n.includes("sicoob")) return "SB";
  if (n.includes("safra")) return "SF";
  if (n.includes("banrisul")) return "BR";
  if (n.includes("nubank") || n.startsWith("nu ")) return "NU";
  if (n.includes("c6")) return "C6";
  if (n.includes("pan")) return "PN";
  // fallback: duas primeiras letras significativas
  const limpo = n.replace(/banco|s\.?a\.?|financeira/g, "").trim();
  return (limpo.slice(0, 2) || "?").toUpperCase();
}

const TAMANHOS = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40,
} as const;

export type BancoLogoSize = keyof typeof TAMANHOS;

export function BancoLogo({
  nome,
  size = "md",
  className,
  title,
}: {
  nome: string | null | undefined;
  size?: BancoLogoSize;
  className?: string;
  title?: string;
}) {
  const px = TAMANHOS[size];

  if (!nome) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-md bg-muted text-muted-foreground",
          className,
        )}
        style={{ width: px, height: px }}
        aria-hidden
      >
        <Landmark style={{ width: px * 0.6, height: px * 0.6 }} />
      </span>
    );
  }

  const cor = corDoBanco(nome);
  const iniciais = iniciaisDoBanco(nome);
  const fontSize = iniciais.length > 1 ? px * 0.42 : px * 0.56;

  return (
    <span
      role="img"
      aria-label={title ?? `Logo ${nome}`}
      title={title ?? nome}
      className={cn("inline-flex shrink-0 select-none", className)}
      style={{ width: px, height: px }}
    >
      <svg
        viewBox="0 0 40 40"
        width={px}
        height={px}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="0" y="0" width="40" height="40" rx="10" fill={cor} />
        <text
          x="20"
          y="21"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          fontWeight="700"
          fontSize={(fontSize / px) * 40}
          fill="#ffffff"
        >
          {iniciais}
        </text>
      </svg>
    </span>
  );
}
