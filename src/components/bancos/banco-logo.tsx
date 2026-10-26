import { forwardRef } from "react";
import { Landmark, type LucideIcon, type LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";
import { corDoBanco } from "@/lib/bancos/cores";
import bradescoLogo from "@/assets/brand/bradesco.svg";
import itauLogo from "@/assets/brand/itau.svg";
import santanderLogo from "@/assets/brand/santander.svg";
import caixaLogo from "@/assets/brand/caixa.svg";
import caixaSimbolo from "@/assets/brand/caixa-simbolo.svg";
import interLogo from "@/assets/brand/inter.svg";
import interSimbolo from "@/assets/brand/inter-simbolo.svg";

/**
 * Marca visual do banco.
 *
 * Arquivos OFICIAIS (src/assets/brand, os mesmos do Agilliza Tech em apps/web/public/bancos):
 * Itaú, Bradesco, Santander, Caixa e Inter. Caixa e Inter têm marca larga; nos lugares
 * quadrados (selo, menu lateral, gráfico) entra o símbolo recortado do próprio arquivo
 * oficial (o X da Caixa, os raios do Inter), sem redesenho. Banco sem arquivo aparece por
 * um monograma na cor institucional.
 */

/** Normaliza para casar o banco correto. */
function normalizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

type IdBanco = "itau" | "bradesco" | "santander" | "caixa" | "inter";

/** Banco com arquivo oficial no projeto, pelo nome (ou texto que contenha o nome). */
export function idBancoComLogo(nome: string | null | undefined): IdBanco | null {
  if (!nome) return null;
  const n = normalizar(nome);
  if (n.includes("santander")) return "santander";
  if (n.includes("itau")) return "itau";
  if (n.includes("bradesco")) return "bradesco";
  if (/\bcaixa\b|\bcef\b|caixa\.gov/.test(n)) return "caixa";
  // "inter" solto: "Interno", "Internet" não são o Banco Inter.
  if (/\binter\b|bancointer/.test(n)) return "inter";
  return null;
}

/** Arquivo para lugares quadrados (selo, menu, gráfico). */
const SIMBOLO: Record<IdBanco, string> = {
  itau: itauLogo,
  bradesco: bradescoLogo,
  santander: santanderLogo,
  caixa: caixaSimbolo,
  inter: interSimbolo,
};
/** Marca completa (cabeçalhos, cartões, PDF). */
const MARCA: Record<IdBanco, string> = {
  itau: itauLogo,
  bradesco: bradescoLogo,
  santander: santanderLogo,
  caixa: caixaLogo,
  inter: interLogo,
};

/** Logotipo oficial para lugar quadrado. */
export function logoUrlDoBanco(nome: string | null | undefined): string | null {
  const id = idBancoComLogo(nome);
  return id ? SIMBOLO[id] : null;
}

/** Marca completa oficial (larga, para cabeçalho/cartão). */
export function marcaUrlDoBanco(nome: string | null | undefined): string | null {
  const id = idBancoComLogo(nome);
  return id ? MARCA[id] : null;
}

/** Alias interno mantido por compatibilidade. */
function logoOficial(nome: string): string | null {
  return logoUrlDoBanco(nome);
}

/** Iniciais exibidas no badge por banco (fallback). */
function iniciaisDoBanco(nome: string): string {
  const n = normalizar(nome);
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
  xs: 18,
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

  const logo = logoOficial(nome);

  // Logo oficial: exibido dentro de um quadro claro arredondado (estilo "app
  // icon"), preservando as cores da marca em tema claro e escuro.
  if (logo) {
    return (
      <span
        role="img"
        aria-label={title ?? `Logo ${nome}`}
        title={title ?? nome}
        className={cn(
          "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-black/5",
          className,
        )}
        style={{ width: px, height: px, padding: Math.max(1, px * 0.12) }}
      >
        <img
          src={logo}
          alt={title ?? `Logo ${nome}`}
          className="h-full w-full object-contain"
          draggable={false}
        />
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
      <svg viewBox="0 0 40 40" width={px} height={px} xmlns="http://www.w3.org/2000/svg">
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

/**
 * Marca completa do banco (logotipo largo, altura fixa, largura proporcional) num selo
 * branco discreto, para cabeçalhos e cartões. Sem arquivo oficial: selo com o nome.
 */
export function BancoMarca({
  nome,
  altura = 22,
  className,
  semFundo,
}: {
  nome: string;
  /** Altura do logotipo em px. */
  altura?: number;
  className?: string;
  /** Sem o selo branco (fundo já claro). */
  semFundo?: boolean;
}) {
  const marca = marcaUrlDoBanco(nome);
  if (!marca) {
    return (
      <span
        className={cn("inline-flex items-center gap-1.5 text-sm font-semibold text-foreground", className)}
      >
        <BancoLogo nome={nome} size="sm" />
        {nome}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center",
        !semFundo && "rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-black/5",
        className,
      )}
      title={nome}
    >
      <img
        src={marca}
        alt={`Logo ${nome}`}
        draggable={false}
        className="w-auto max-w-[9rem] object-contain"
        style={{ height: altura }}
      />
    </span>
  );
}

/**
 * Ícone do menu lateral com o símbolo oficial do banco (mesma assinatura de um ícone do
 * lucide: o menu passa `className` com o tamanho). Quem chama guarda o resultado num valor
 * de módulo — não crie a cada render.
 */
export function iconeDeBanco(nome: string): LucideIcon {
  const Icone = forwardRef<SVGSVGElement, LucideProps>(function IconeBanco({ className }, _ref) {
    const logo = logoUrlDoBanco(nome);
    if (!logo) return <Landmark className={className} />;
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-white p-px ring-1 ring-black/10",
          className,
        )}
        aria-hidden
      >
        <img src={logo} alt="" className="h-full w-full object-contain" draggable={false} />
      </span>
    );
  });
  Icone.displayName = `IconeBanco(${nome})`;
  return Icone as unknown as LucideIcon;
}
