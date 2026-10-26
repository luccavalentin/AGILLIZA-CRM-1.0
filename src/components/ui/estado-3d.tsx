import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icone3D, type TomIcone3D } from "./icone-3d";

/**
 * Estados desenhados (vazio, erro e carregando) do Agilliza (C00), com o ícone 3D.
 *
 * @example
 *   <Estado3D icone={FileSearch} titulo="Nenhuma proposta no período"
 *     descricao="Amplie o período ou limpe os filtros." acao={<Button>Limpar</Button>} />
 *   <Estado3D tipo="erro" descricao={erro.message} acao={<Button onClick={refetch}>Tentar de novo</Button>} />
 *   <Estado3D tipo="carregando" titulo="Carregando indicadores" />
 */
export function Estado3D({
  tipo = "vazio",
  icone,
  tom,
  titulo,
  descricao,
  acao,
  compacto,
  className,
}: {
  tipo?: "vazio" | "erro" | "carregando";
  icone?: LucideIcon;
  tom?: TomIcone3D;
  titulo?: string;
  descricao?: ReactNode;
  acao?: ReactNode;
  /** Versão baixa, para dentro de cartões e listas. */
  compacto?: boolean;
  className?: string;
}) {
  const padrao = {
    vazio: { icone: Inbox, tom: "neutro" as TomIcone3D, titulo: "Nada por aqui ainda" },
    erro: {
      icone: AlertTriangle,
      tom: "perigo" as TomIcone3D,
      titulo: "Não foi possível carregar",
    },
    carregando: { icone: Loader2, tom: "marca" as TomIcone3D, titulo: "Carregando…" },
  }[tipo];
  return (
    <div
      className={cn("i3d-estado i3d-grupo", compacto && "i3d-estado-compacto", className)}
      role={tipo === "erro" ? "alert" : tipo === "carregando" ? "status" : undefined}
      aria-live={tipo === "carregando" ? "polite" : undefined}
      data-tipo={tipo}
    >
      <Icone3D
        icone={icone ?? padrao.icone}
        tom={tom ?? padrao.tom}
        tamanho={compacto ? "lg" : "xl"}
        className={tipo === "carregando" ? "i3d-girando" : undefined}
      />
      <div className="i3d-estado-texto">
        <p className="i3d-estado-titulo">{titulo ?? padrao.titulo}</p>
        {descricao && <p className="i3d-estado-descricao">{descricao}</p>}
      </div>
      {acao && <div className="i3d-estado-acao">{acao}</div>}
    </div>
  );
}
