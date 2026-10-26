/**
 * Kit visual das telas de Gestão de sistemas e Configurações gerais (frente a2, 26/10/2026).
 *
 * Um lugar só para o que se repetia em cada tela (e cada uma desenhava de um jeito):
 * cabeçalho com ícone, faixa de indicadores, barra de filtros com chips, selos de
 * situação, seções e os estados vazio, carregando e erro.
 *
 * Ícone do cabeçalho, dos indicadores e dos estados: `IconeGestao`, o ponto único que desenha
 * a peça 3D do sistema (`Icone3D` da frente a1). O cabeçalho usa o `AdminHero`, que já a desenha.
 */
import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw, Search, X } from "lucide-react";
import { AdminHero } from "@/components/admin/admin-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Icone3D, type TamanhoIcone3D } from "@/components/ui/icone-3d";
import { cn } from "@/lib/utils";

export type Tom = "neutro" | "marca" | "sucesso" | "alerta" | "perigo" | "info";

const TAMANHO_3D: Record<"sm" | "md" | "lg", TamanhoIcone3D> = { sm: "sm", md: "md", lg: "xl" };

/**
 * Ícone da gestão: a peça 3D do sistema (`Icone3D`, frente a1 — `docs/visual-3d.md`).
 * Ponto único: todas as telas de Gestão de sistemas e Configurações gerais passam por aqui.
 */
export function IconeGestao({
  icone,
  tom = "marca",
  tamanho = "md",
  className,
}: {
  icone: ReactNode;
  tom?: Tom;
  tamanho?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <Icone3D tom={tom} tamanho={TAMANHO_3D[tamanho]} className={cn("shrink-0", className)}>
      {icone}
    </Icone3D>
  );
}

/** Cabeçalho das telas da gestão: seção (trilha), título, descrição e ações. */
export function CabecalhoGestao({
  secao = "Gestão de sistemas",
  titulo,
  descricao,
  icone,
  acoes,
}: {
  secao?: string;
  titulo: string;
  descricao?: string;
  icone: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <AdminHero
      secao={secao}
      titulo={titulo}
      descricao={descricao}
      icon={icone}
      acoes={acoes}
    />
  );
}

/**
 * Moldura padrão das páginas (largura e ritmo vertical). O respiro lateral é o do `<main>`
 * do shell (12 px no celular, 24 px no monitor): somar outro aqui deixava 28 px em 375 px.
 */
export function PaginaGestao({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full min-w-0 max-w-[1400px] space-y-5", className)}>{children}</div>;
}

/** Faixa de indicadores: 2 colunas no celular, até 4 (ou 5) no monitor. */
export function FaixaIndicadores({ children, colunas = 4 }: { children: ReactNode; colunas?: 3 | 4 | 5 }) {
  return (
    <div
      data-tour="indicadores"
      className={cn(
        "grid grid-cols-2 gap-3",
        // Número ímpar de indicadores no celular: o último ocupa a linha inteira (sem buraco).
        "max-lg:[&>*:last-child:nth-child(odd)]:col-span-2",
        colunas === 3 && "lg:grid-cols-3",
        colunas === 4 && "lg:grid-cols-4",
        colunas === 5 && "lg:grid-cols-3 xl:grid-cols-5",
      )}
    >
      {children}
    </div>
  );
}

export function Indicador({
  rotulo,
  valor,
  detalhe,
  icone,
  tom = "marca",
  carregando,
  onClick,
  ativo,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  icone?: ReactNode;
  tom?: Tom;
  carregando?: boolean;
  /** Indicador clicável vira filtro (ex.: "Atrasados"). */
  onClick?: () => void;
  ativo?: boolean;
}) {
  const Corpo = onClick ? "button" : "div";
  return (
    <Corpo
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? !!ativo : undefined}
      className={cn(
        "i3d-grupo group flex min-h-[92px] min-w-0 flex-col justify-start rounded-[14px] border border-border/80 bg-card p-3.5 text-left shadow-[0_1px_2px_rgb(16_24_40/0.04)] sm:p-4",
        onClick &&
          "transition-shadow hover:shadow-[0_6px_16px_-10px_rgb(0_10_112/0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
        ativo && "border-primary/40 ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[11px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
          {rotulo}
        </p>
        {icone && <IconeGestao icone={icone} tom={tom} tamanho="sm" />}
      </div>
      {carregando ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <p className="mt-1.5 break-words text-[clamp(1.2rem,1rem+0.8vw,1.6rem)] font-medium leading-tight tracking-tight tabular-nums text-foreground">
          {valor}
        </p>
      )}
      {detalhe && <p className="mt-0.5 text-xs text-muted-foreground">{detalhe}</p>}
    </Corpo>
  );
}

/** Barra de filtros acima das listas. */
export function BarraFiltros({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-tour="filtros"
      className={cn(
        "flex flex-col gap-2.5 rounded-[14px] border border-border/80 bg-card p-3 shadow-[0_1px_2px_rgb(16_24_40/0.04)] md:flex-row md:flex-wrap md:items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CampoBusca({
  valor,
  onChange,
  placeholder,
  rotulo,
  className,
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder: string;
  rotulo: string;
  className?: string;
}) {
  return (
    <label className={cn("relative block min-w-0 md:w-72 lg:w-80", className)}>
      <span className="sr-only">{rotulo}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-10 pl-9 pr-9 text-base sm:text-sm"
        placeholder={placeholder}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
      {valor && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
          aria-label="Limpar busca"
        >
          <X className="size-3.5" />
        </button>
      )}
    </label>
  );
}

export interface OpcaoChip<T extends string> {
  valor: T;
  rotulo: string;
  contagem?: number | null;
  tom?: Tom;
}

/** Chips de filtro com contagem (rola na horizontal dentro do próprio trilho no celular). */
export function ChipsFiltro<T extends string>({
  opcoes,
  valor,
  onChange,
  rotulo,
  className,
}: {
  opcoes: OpcaoChip<T>[];
  valor: T;
  onChange: (v: T) => void;
  rotulo: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      className={cn("-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]", className)}
    >
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onChange(o.valor)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors sm:min-h-8",
              ativo
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-primary/[0.04]",
            )}
          >
            {o.rotulo}
            {o.contagem != null && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums",
                  ativo ? "bg-white/20" : o.tom === "perigo" && o.contagem > 0 ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground",
                )}
              >
                {o.contagem}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const TOM_SELO: Record<Tom, string> = {
  neutro: "border-border bg-secondary text-muted-foreground",
  marca: "border-primary/20 bg-primary/[0.07] text-primary",
  sucesso: "border-success/25 bg-success/10 text-success-texto",
  alerta: "border-warning/40 bg-warning/15 text-warning-foreground",
  perigo: "border-destructive/25 bg-destructive/[0.08] text-destructive",
  info: "border-sky-500/25 bg-sky-500/10 text-sky-800",
};

/** Selo de situação: etiqueta com fio, tom só por significado; `ponto` para estado vivo. */
export function Selo({
  tom = "neutro",
  ponto,
  children,
  className,
}: {
  tom?: Tom;
  ponto?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        TOM_SELO[tom],
        className,
      )}
    >
      {ponto && <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Bloco de conteúdo com título (cartão). */
export function Secao({
  titulo,
  descricao,
  icone,
  acoes,
  children,
  className,
  semRespiro,
}: {
  titulo?: ReactNode;
  descricao?: ReactNode;
  icone?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Conteúdo encostado na borda (tabelas e listas). */
  semRespiro?: boolean;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-[14px] border border-border/80 bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]",
        className,
      )}
    >
      {(titulo || acoes) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border/70 px-4 py-3">
          <div className="flex min-w-0 items-start gap-2.5">
            {icone && <IconeGestao icone={icone} tamanho="sm" />}
            <div className="min-w-0">
              {titulo && <h2 className="text-[15px] font-semibold leading-6 text-foreground">{titulo}</h2>}
              {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
            </div>
          </div>
          {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
        </header>
      )}
      <div className={cn(!semRespiro && "p-4")}>{children}</div>
    </section>
  );
}

/** Par rótulo/valor das gavetas de detalhe. */
export function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function EstadoVazio({
  icone,
  titulo,
  descricao,
  acao,
  className,
}: {
  icone?: ReactNode;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <IconeGestao icone={icone ?? <Inbox />} tom="neutro" tamanho="lg" />
      <p className="mt-3 text-sm font-medium text-foreground">{titulo}</p>
      {descricao && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

export function EstadoErro({
  mensagem,
  onTentar,
  className,
}: {
  mensagem: string;
  onTentar?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      <IconeGestao icone={<AlertTriangle />} tom="perigo" tamanho="lg" />
      <p className="mt-3 max-w-md text-sm text-destructive">{mensagem}</p>
      {onTentar && (
        <Button variant="outline" size="sm" className="mt-4 min-h-11 sm:min-h-8" onClick={onTentar}>
          <RefreshCw className="mr-1.5 size-4" /> Tentar de novo
        </Button>
      )}
    </div>
  );
}

export function ListaCarregando({ linhas = 5, className }: { linhas?: number; className?: string }) {
  return (
    <div className={cn("space-y-2 p-4", className)} aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

/** Duração em minutos → "12 min", "3 h 05", "2 d 4 h". */
export function formatarMinutos(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return "—";
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  if (m < 60 * 24) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
  }
  const d = Math.floor(m / (60 * 24));
  const h = Math.floor((m % (60 * 24)) / 60);
  return h ? `${d} d ${h} h` : `${d} d`;
}

/** Iniciais de um nome (avatar). */
export function iniciaisDe(nome: string | null | undefined): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return ((partes[0][0] ?? "") + (partes.length > 1 ? (partes[partes.length - 1][0] ?? "") : "")).toUpperCase();
}

export function Avatar({ nome, tamanho = "md" }: { nome: string | null | undefined; tamanho?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full bg-primary/[0.08] font-medium text-primary ring-1 ring-inset ring-primary/15",
        tamanho === "sm" ? "size-7 text-[11px]" : "size-9 text-xs",
      )}
    >
      {iniciaisDe(nome)}
    </span>
  );
}
