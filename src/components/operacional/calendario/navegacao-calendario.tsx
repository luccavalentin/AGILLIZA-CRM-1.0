import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeletorMesAno } from "./seletor-mes-ano";
import { MESES } from "./utils";

export type VisaoCalendario = "dia" | "semana" | "mes" | "ano";

const ORDEM: VisaoCalendario[] = ["dia", "semana", "mes", "ano"];
const ROTULO: Record<VisaoCalendario, string> = {
  dia: "Dia",
  semana: "Semana",
  mes: "Mês",
  ano: "Ano",
};

interface NavegacaoCalendarioProps {
  ref: Date;
  hoje: Date;
  visao: VisaoCalendario;
  onChange: (d: Date) => void;
  onVisaoChange: (v: VisaoCalendario) => void;
}

function inicioSemana(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}

function fimSemana(d: Date): Date {
  const x = inicioSemana(d);
  x.setDate(x.getDate() + 6);
  return x;
}

function fmtDia(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function tituloAtual(ref: Date, visao: VisaoCalendario): string {
  if (visao === "dia") {
    return ref.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }
  if (visao === "semana") {
    const ini = inicioSemana(ref);
    const fim = fimSemana(ref);
    return `${fmtDia(ini)} – ${fmtDia(fim)}`;
  }
  if (visao === "ano") return String(ref.getFullYear());
  return `${MESES[ref.getMonth()]} ${ref.getFullYear()}`;
}

function passo(ref: Date, visao: VisaoCalendario, dir: 1 | -1): Date {
  const d = new Date(ref);
  if (visao === "dia") d.setDate(d.getDate() + dir);
  else if (visao === "semana") d.setDate(d.getDate() + 7 * dir);
  else if (visao === "mes") d.setMonth(d.getMonth() + dir, 1);
  else d.setFullYear(d.getFullYear() + dir, 0, 1);
  return d;
}

/** Cabeçalho de navegação com controles de zoom (dia/semana/mês/ano). */
export function NavegacaoCalendario({
  ref,
  hoje,
  visao,
  onChange,
  onVisaoChange,
}: NavegacaoCalendarioProps) {
  const idx = ORDEM.indexOf(visao);
  const podeZoomOut = idx < ORDEM.length - 1;
  const podeZoomIn = idx > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {visao === "mes" ? (
          <SeletorMesAno ref={ref} onChange={onChange} />
        ) : (
          <span className="px-2 py-1 text-base font-medium capitalize text-foreground">
            {tituloAtual(ref, visao)}
          </span>
        )}
        <span className="hidden rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline-block">
          {ROTULO[visao]}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          title="Aproximar (dia)"
          disabled={!podeZoomIn}
          onClick={() => onVisaoChange(ORDEM[idx - 1])}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          title="Afastar (ano)"
          disabled={!podeZoomOut}
          onClick={() => onVisaoChange(ORDEM[idx + 1])}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="mx-1 hidden h-5 w-px bg-border/60 sm:inline-block" />
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onChange(passo(ref, visao, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => onChange(new Date(hoje))}>
          Hoje
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onChange(passo(ref, visao, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
