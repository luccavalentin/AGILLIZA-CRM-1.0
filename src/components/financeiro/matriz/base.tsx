/**
 * Peças comuns das telas do financeiro da matriz: página, métricas tabulares, chips de
 * situação com cor de significado (azul previsto, âmbar pendente, verde recebido/pago,
 * vermelho só para alerta), estados vazio/carregando/erro, filtro de período e tabela
 * que vira cartões em 375 px.
 */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Icone3D } from "@/components/ui/icone-3d";
import { Indicador3D } from "@/components/ui/indicador-3d";
import { Estado3D } from "@/components/ui/estado-3d";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import { isoLocal } from "@/lib/financeiro/cliente";
import "./financeiro.css";

export type Tom = "marca" | "sucesso" | "alerta" | "perigo" | "neutro" | "info" | "violeta";

const COR: Record<Tom, string> = {
  marca: "var(--primary)",
  sucesso: "var(--success)",
  alerta: "var(--warning)",
  perigo: "var(--destructive)",
  neutro: "var(--muted-foreground)",
  info: "color-mix(in oklab, var(--primary) 70%, #3ba4ff)",
  violeta: "#6d4bd8",
};

export function corDoTom(t: Tom) {
  return COR[t];
}

export function PaginaFin({
  titulo,
  descricao,
  icone: Icone,
  acoes,
  children,
}: {
  titulo: string;
  descricao: string;
  icone: LucideIcon;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
      <header className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="flex min-w-0 items-start gap-3">
          <Icone3D icone={Icone} tamanho="lg" tom="marca" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Financeiro da matriz</p>
            <h1 className="text-balance break-words text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{titulo}</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{descricao}</p>
          </div>
        </div>
        {acoes && <div data-tour="financeiro-acoes" className="flex flex-wrap items-center gap-2 md:justify-end">{acoes}</div>}
      </header>
      {children}
    </div>
  );
}

export function Metricas({ children, colunas = 4 }: { children: ReactNode; colunas?: 2 | 3 | 4 | 5 }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3",
        colunas === 3 && "lg:grid-cols-3",
        colunas === 4 && "lg:grid-cols-4",
        colunas === 5 && "md:grid-cols-3 xl:grid-cols-5",
      )}
    >
      {children}
    </div>
  );
}

/** Indicador do financeiro: o `Indicador3D` da base, com a cor de significado de cada número. */
export function Metrica({
  rotulo,
  valor,
  ajuda,
  tom = "neutro",
  icone,
  onClick,
  ativo,
  natureza,
}: {
  rotulo: string;
  valor: string;
  ajuda?: string;
  tom?: Tom;
  icone?: LucideIcon;
  onClick?: () => void;
  ativo?: boolean;
  natureza?: string;
}) {
  return (
    <Indicador3D
      icone={icone}
      tom={tom}
      rotulo={rotulo}
      valor={<span className="font-mono tabular-nums">{valor}</span>}
      detalhe={ajuda}
      natureza={natureza}
      onClick={onClick}
      className={cn("fin-metrica min-w-0", ativo && "ring-2 ring-primary/25")}
    />
  );
}

export const moeda = (v: number | null | undefined) => formatBRL(Number(v ?? 0));
export const dataBR = (v: string | null | undefined) => (v ? formatData(v) : "—");
export const pct = (v: number | null | undefined, casas = 2) =>
  `${Number(v ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;

export interface DefChip {
  rotulo: string;
  tom: Tom;
}

export const SITUACAO_BANCO: Record<string, DefChip> = {
  previsto: { rotulo: "Previsto", tom: "info" },
  a_receber: { rotulo: "A receber", tom: "alerta" },
  parcial: { rotulo: "Parcial", tom: "alerta" },
  recebido: { rotulo: "Recebido", tom: "sucesso" },
  divergente: { rotulo: "Divergente", tom: "perigo" },
  contestado: { rotulo: "Contestado", tom: "perigo" },
  cancelado: { rotulo: "Cancelado", tom: "neutro" },
};

export const SITUACAO_PARTICIPANTE: Record<string, DefChip> = {
  prevista: { rotulo: "Prevista", tom: "info" },
  aguardando_confirmacao: { rotulo: "Aguardando banco", tom: "neutro" },
  aprovada: { rotulo: "Aprovada p/ pagar", tom: "alerta" },
  parcial: { rotulo: "Paga em parte", tom: "alerta" },
  paga: { rotulo: "Paga", tom: "sucesso" },
  contestada: { rotulo: "Contestada", tom: "perigo" },
  ajustada: { rotulo: "Ajustada", tom: "info" },
  cancelada: { rotulo: "Cancelada", tom: "neutro" },
};

export const SITUACAO_REPASSE: Record<string, DefChip> = {
  a_pagar: { rotulo: "Previsto", tom: "info" },
  aguardando_base: { rotulo: "Aguardando banco", tom: "neutro" },
  aprovada: { rotulo: "Aprovado p/ pagar", tom: "alerta" },
  parcial: { rotulo: "Pago em parte", tom: "alerta" },
  paga: { rotulo: "Pago", tom: "sucesso" },
  cancelada: { rotulo: "Cancelado", tom: "neutro" },
};

export const SITUACAO_CONTA: Record<string, DefChip> = {
  aberta: { rotulo: "Em aberto", tom: "alerta" },
  atrasada: { rotulo: "Vencida", tom: "perigo" },
  parcial: { rotulo: "Paga em parte", tom: "alerta" },
  paga: { rotulo: "Paga", tom: "sucesso" },
  cancelada: { rotulo: "Cancelada", tom: "neutro" },
  estornada: { rotulo: "Estornada", tom: "neutro" },
  rascunho: { rotulo: "Rascunho", tom: "info" },
};

export function Chip({ def, className }: { def: DefChip | undefined; className?: string }) {
  const d = def ?? { rotulo: "—", tom: "neutro" as Tom };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        className,
      )}
      style={{ color: COR[d.tom], background: `color-mix(in oklab, ${COR[d.tom]} 12%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: COR[d.tom] }} />
      {d.rotulo}
    </span>
  );
}

export function Carregando({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="space-y-2" aria-busy>
      {Array.from({ length: linhas }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function Vazio({ titulo, descricao, acao, icone }: { titulo: string; descricao?: string; acao?: ReactNode; icone?: LucideIcon }) {
  return <Estado3D tipo="vazio" icone={icone} titulo={titulo} descricao={descricao} acao={acao} />;
}

export function Erro({ erro, onTentar }: { erro: unknown; onTentar?: () => void }) {
  const msg = erro instanceof Error ? erro.message : "Não foi possível carregar.";
  return (
    <Estado3D
      tipo="erro"
      compacto
      descricao={msg}
      acao={
        onTentar && (
          <Button size="sm" variant="outline" onClick={onTentar} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
          </Button>
        )
      }
    />
  );
}

const PRESETS: { rotulo: string; calc: () => { de: string; ate: string } }[] = [
  {
    rotulo: "Este mês",
    calc: () => {
      const h = new Date();
      return { de: isoLocal(new Date(h.getFullYear(), h.getMonth(), 1)), ate: isoLocal(new Date(h.getFullYear(), h.getMonth() + 1, 0)) };
    },
  },
  {
    rotulo: "90 dias",
    calc: () => {
      const h = new Date();
      return { de: isoLocal(new Date(h.getFullYear(), h.getMonth(), h.getDate() - 89)), ate: isoLocal(h) };
    },
  },
  {
    rotulo: "Próx. 90",
    calc: () => {
      const h = new Date();
      return { de: isoLocal(h), ate: isoLocal(new Date(h.getFullYear(), h.getMonth(), h.getDate() + 89)) };
    },
  },
  {
    rotulo: "Ano",
    calc: () => {
      const a = new Date().getFullYear();
      return { de: `${a}-01-01`, ate: `${a}-12-31` };
    },
  },
];

export function FiltroPeriodo({
  de,
  ate,
  onChange,
}: {
  de: string;
  ate: string;
  onChange: (p: { de: string; ate: string }) => void;
}) {
  return (
    <div data-tour="financeiro-periodo" className="flex flex-wrap items-center gap-2">
      {/* Celular: as duas datas dividem a largura do cartão (nunca encostam na borda). */}
      <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:flex sm:w-auto">
        <Input type="date" value={de} onChange={(e) => onChange({ de: e.target.value, ate })} className="h-9 w-full min-w-0 sm:w-[9.5rem]" aria-label="De" />
        <span className="text-xs text-muted-foreground">até</span>
        <Input type="date" value={ate} onChange={(e) => onChange({ de, ate: e.target.value })} className="h-9 w-full min-w-0 sm:w-[9.5rem]" aria-label="Até" />
      </div>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <Button key={p.rotulo} type="button" size="sm" variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => onChange(p.calc())}>
            {p.rotulo}
          </Button>
        ))}
      </div>
    </div>
  );
}

export interface Coluna<T> {
  chave: string;
  rotulo: string;
  alinhar?: "direita" | "centro";
  render: (l: T) => ReactNode;
  /** Some no cartão do celular (fica só na tabela). */
  soDesktop?: boolean;
  className?: string;
}

/** Tabela no computador; cartões empilhados em 375 px (sem rolagem lateral). */
export function TabelaFin<T extends { id: string }>({
  linhas,
  colunas,
  titulo,
  acoes,
  selecionados,
  onSelecionar,
  onAbrir,
}: {
  linhas: T[];
  colunas: Coluna<T>[];
  /** Título do cartão no celular. */
  titulo: (l: T) => ReactNode;
  acoes?: (l: T) => ReactNode;
  selecionados?: Set<string>;
  onSelecionar?: (id: string, marcado: boolean) => void;
  onAbrir?: (l: T) => void;
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              {onSelecionar && <th className="w-10 px-3 py-2.5" />}
              {colunas.map((c) => (
                <th
                  key={c.chave}
                  className={cn(
                    "px-3 py-2.5 text-left font-medium",
                    c.alinhar === "direita" && "text-right",
                    c.alinhar === "centro" && "text-center",
                  )}
                >
                  {c.rotulo}
                </th>
              ))}
              {acoes && <th className="w-12 px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {linhas.map((l) => (
              <tr
                key={l.id}
                className={cn("transition-colors hover:bg-muted/30", onAbrir && "cursor-pointer")}
                onClick={onAbrir ? () => onAbrir(l) : undefined}
              >
                {onSelecionar && (
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--primary)]"
                      checked={selecionados?.has(l.id) ?? false}
                      onChange={(e) => onSelecionar(l.id, e.target.checked)}
                      aria-label="Selecionar"
                    />
                  </td>
                )}
                {colunas.map((c) => (
                  <td
                    key={c.chave}
                    className={cn(
                      "px-3 py-2.5 align-middle",
                      c.alinhar === "direita" && "text-right font-mono tabular-nums",
                      c.alinhar === "centro" && "text-center",
                      c.className,
                    )}
                  >
                    {c.render(l)}
                  </td>
                ))}
                {acoes && (
                  <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    {acoes(l)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden">
        {linhas.map((l) => (
          <li
            key={l.id}
            className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm"
            onClick={onAbrir ? () => onAbrir(l) : undefined}
          >
            <div className="flex items-start gap-2">
              {onSelecionar && (
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--primary)]"
                  checked={selecionados?.has(l.id) ?? false}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onSelecionar(l.id, e.target.checked)}
                  aria-label="Selecionar"
                />
              )}
              <div className="min-w-0 flex-1 text-sm font-semibold text-foreground">{titulo(l)}</div>
              {acoes && <div onClick={(e) => e.stopPropagation()}>{acoes(l)}</div>}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {colunas
                .filter((c) => !c.soDesktop)
                .map((c) => (
                  <div key={c.chave} className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{c.rotulo}</dt>
                    <dd className={cn("truncate text-xs text-foreground", c.alinhar === "direita" && "font-mono tabular-nums")}>
                      {c.render(l)}
                    </dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Abas simples em pílula (situações), roláveis no celular. */
export function Pilulas<T extends string>({
  valor,
  opcoes,
  onChange,
}: {
  valor: T;
  opcoes: { valor: T; rotulo: string; contador?: number }[];
  onChange: (v: T) => void;
}) {
  return (
    <div data-tour="financeiro-situacoes" className="-mx-1 flex flex-wrap gap-1.5 px-1">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            valor === o.valor
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
        >
          {o.rotulo}
          {o.contador != null && o.contador > 0 && (
            <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums", valor === o.valor ? "bg-white/20" : "bg-muted")}>
              {o.contador}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
