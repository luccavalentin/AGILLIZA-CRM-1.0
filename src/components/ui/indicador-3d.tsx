import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icone3D, tomIcone3D, type TomIcone3D, type TomLegado } from "./icone-3d";

/**
 * Cartão de indicador do Agilliza (C00): o "Metrica" dos portais dos assinantes.
 *
 * Papel branco, fio de 1 px, ícone 3D do tom no canto, rótulo curto, número em 500
 * tabular e uma linha de contexto (variação no período e/ou detalhe). Quando leva a
 * algum lugar (`link` ou `onClick`), ganha a seta que corre e o ícone inclina.
 *
 * @example
 *   <Indicador3D icone={Send} rotulo="Propostas enviadas" valor="128"
 *     variacao={{ pct: 12, sobe: true, bom: true }} detalhe="vs. 30 dias antes"
 *     link={{ to: "/operacional/propostas", search: { status: "enviada" } }} />
 */
export interface Variacao {
  /** Percentual absoluto (12 = 12%). `null` = sem base anterior ("novo"). */
  pct: number | null;
  /** Direção do movimento. `undefined` = estável. */
  sobe?: boolean;
  /** Subir é bom? (contratos sim, recusas não). Define verde ou vermelho. */
  bom?: boolean;
}

export function VariacaoSelo({ v, className }: { v: Variacao; className?: string }) {
  if (v.pct === null) {
    return (
      <span
        className={cn("i3d-variacao i3d-variacao-neutra", className)}
        title="Sem base no período anterior"
      >
        novo
      </span>
    );
  }
  const estavel = v.sobe === undefined || v.pct === 0;
  const positivo = estavel ? null : v.sobe === (v.bom ?? true);
  const Icone = estavel ? Minus : v.sobe ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "i3d-variacao",
        positivo === null
          ? "i3d-variacao-neutra"
          : positivo
            ? "i3d-variacao-boa"
            : "i3d-variacao-ruim",
        className,
      )}
      title="Comparado ao período anterior de mesma duração"
    >
      <Icone aria-hidden className="size-3" />
      {estavel
        ? "estável"
        : `${v.sobe ? "+" : "−"}${v.pct.toLocaleString("pt-BR", { maximumFractionDigits: v.pct < 10 ? 1 : 0 })}%`}
    </span>
  );
}

export function Indicador3D({
  icone,
  tom = "marca",
  rotulo,
  valor,
  detalhe,
  variacao,
  natureza,
  link,
  onClick,
  carregando,
  destaque,
  className,
}: {
  icone?: LucideIcon;
  tom?: TomIcone3D | TomLegado;
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  variacao?: Variacao;
  /** Natureza do número ("quantidade", "R$", "ms"), discreta ao lado do rótulo. */
  natureza?: string;
  link?: { to: string; search?: Record<string, unknown>; params?: Record<string, string> };
  onClick?: () => void;
  carregando?: boolean;
  /** Cartão principal da faixa: borda e ícone um pouco maiores. */
  destaque?: boolean;
  className?: string;
}) {
  const clicavel = !!link || !!onClick;
  const corpo = (
    <>
      <span className="i3d-indicador-topo">
        {icone && <Icone3D icone={icone} tom={tomIcone3D(tom)} tamanho={destaque ? "lg" : "md"} />}
        <span className="i3d-indicador-rotulo">
          {rotulo}
          {natureza && <small>{natureza}</small>}
        </span>
        {clicavel && (
          <span className="i3d-indicador-seta" aria-hidden>
            <ChevronRight className="size-3.5" />
          </span>
        )}
      </span>
      {carregando ? (
        <span className="i3d-indicador-esqueleto" aria-label="Carregando" />
      ) : (
        <span className="i3d-indicador-valor" title={typeof valor === "string" ? valor : undefined}>
          {valor}
        </span>
      )}
      {(variacao || detalhe) && !carregando && (
        <span className="i3d-indicador-rodape">
          {variacao && <VariacaoSelo v={variacao} />}
          {detalhe && <span className="i3d-indicador-detalhe">{detalhe}</span>}
        </span>
      )}
    </>
  );
  const classe = cn("i3d-indicador i3d-grupo", destaque && "i3d-indicador-destaque", className);
  if (link) {
    return (
      <Link
        to={link.to as never}
        search={link.search as never}
        params={link.params as never}
        className={classe}
        aria-label={`${rotulo}: abrir a lista`}
      >
        {corpo}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classe} data-depth="off">
        {corpo}
      </button>
    );
  }
  return <div className={classe}>{corpo}</div>;
}
