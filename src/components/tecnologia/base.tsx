/**
 * Peças visuais da Gestão de Tecnologia: painel, indicador grande, pulso "ao vivo",
 * seletor segmentado, estados vazio/carregando/erro e formatação.
 *
 * Regras de marca: traço fino (borda 1px), azul #000F9F, Inter, sem 3D, sem degradê, sem
 * vidro. Celular primeiro: alvos de toque com 44 px, nada que role a página de lado.
 */
import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { mensagemDeErro } from "@/lib/erros/mensagem";

export type Tom = "ok" | "atencao" | "critico" | "neutro";

export const COR_TOM: Record<Tom, string> = {
  ok: "var(--success)",
  atencao: "var(--warning)",
  critico: "var(--destructive)",
  neutro: "var(--muted-foreground)",
};

/** Paleta dos gráficos (mesmos tokens do resto do Agilliza). */
export const COR = {
  primaria: "var(--chart-1)",
  secundaria: "var(--chart-2)",
  sucesso: "var(--chart-3)",
  alerta: "var(--chart-4)",
  falha: "var(--chart-5)",
  eixo: "var(--muted-foreground)",
  grade: "color-mix(in oklab, var(--border) 70%, transparent)",
};

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

const NUM = new Intl.NumberFormat("pt-BR");
const NUM1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export const fmtNum = (n: number | null | undefined) => (n == null ? "—" : NUM.format(n));
export const fmtNum1 = (n: number | null | undefined) => (n == null ? "—" : NUM1.format(n));
export const fmtMs = (n: number | null | undefined) =>
  n == null ? "—" : n >= 1000 ? `${NUM1.format(n / 1000)} s` : `${NUM.format(n)} ms`;
export const fmtPct = (n: number | null | undefined) => (n == null ? "—" : `${NUM1.format(n)}%`);
export const fmtReais = (n: number | null | undefined) =>
  n == null
    ? "—"
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

/** "agora", "há 3 min", "há 2 h", "há 4 dias" (relógio do navegador). */
export function ha(iso: string | null | undefined, agora = Date.now()): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.round((agora - t) / 1000));
  if (s < 45) return "agora";
  const min = Math.round(s / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const diaHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
export const dia = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

// ---------------------------------------------------------------------------
// Estrutura
// ---------------------------------------------------------------------------

export function Painel({
  titulo,
  descricao,
  icone,
  acoes,
  children,
  className,
  corpoClassName,
}: {
  titulo?: ReactNode;
  descricao?: ReactNode;
  icone?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
  corpoClassName?: string;
}) {
  return (
    <section
      className={cn("tec-cartao min-w-0 rounded-xl border border-border bg-card", className)}
    >
      {(titulo || acoes) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5">
          <div className="min-w-0 flex-1">
            {titulo && (
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {icone && <span className="text-[color:var(--realce)]">{icone}</span>}
                {titulo}
              </h2>
            )}
            {descricao && <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>}
          </div>
          {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
        </header>
      )}
      <div className={cn("p-4 sm:px-5", corpoClassName)}>{children}</div>
    </section>
  );
}

/** Cores dos blocos de ícone (degradê leve permitido nesta seção, a pedido do dono). */
export type CorBloco = "vermelho" | "azul" | "amarelo" | "roxo" | "verde" | "marca";
export const COR_BLOCO: Record<CorBloco, [string, string]> = {
  vermelho: ["#f87171", "#e5484d"],
  azul: ["#60a5fa", "#2f6fea"],
  amarelo: ["#fcd34d", "#f0a30a"],
  roxo: ["#a78bfa", "#7c4dee"],
  verde: ["#4ade80", "#1fa456"],
  marca: ["#3047f0", "#000f9f"],
};

/** Quadrado colorido com o ícone (cartões de indicador da central). */
export function BlocoIcone({
  cor,
  children,
  className,
}: {
  cor: CorBloco;
  children: ReactNode;
  className?: string;
}) {
  const [a, b] = COR_BLOCO[cor];
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-xl text-white [&_svg]:size-5",
        className,
      )}
      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
    >
      {children}
    </span>
  );
}

/** Indicador grande: o número que se lê de longe. Com `cor`, o ícone vai num bloco colorido. */
export function Kpi({
  rotulo,
  valor,
  unidade,
  rodape,
  tom = "neutro",
  icone,
  cor,
  carregando,
  children,
}: {
  rotulo: string;
  valor: ReactNode;
  unidade?: string;
  rodape?: ReactNode;
  tom?: Tom;
  icone?: ReactNode;
  cor?: CorBloco;
  carregando?: boolean;
  children?: ReactNode;
}) {
  const numero = carregando ? (
    <div className="mt-2 h-8 w-20 animate-pulse rounded-md bg-muted" />
  ) : (
    <p className="mt-1 flex items-baseline gap-1 text-[1.65rem] font-semibold leading-none tracking-tight text-foreground tabular-nums sm:text-[1.75rem]">
      {valor}
      {unidade && <span className="text-sm font-medium text-muted-foreground">{unidade}</span>}
    </p>
  );
  return (
    <div className="tec-cartao @container relative min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: tom === "neutro" ? "transparent" : COR_TOM[tom] }}
      />
      {cor ? (
        // Cartão estreito (2 colunas a 360 px, 6 a 1280 px) não tem espaço para ícone e número
        // lado a lado: "12.345" era cortado em "12.3". Abaixo de 170 px o ícone vai para cima.
        <div className="flex flex-col items-start gap-2 @min-[170px]:flex-row @min-[170px]:gap-3">
          <BlocoIcone cor={cor}>{icone}</BlocoIcone>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-xs font-medium leading-snug text-muted-foreground">
              {rotulo}
            </p>
            {numero}
            {rodape && <div className="mt-1.5 min-w-0 break-words text-xs text-muted-foreground">{rodape}</div>}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="line-clamp-2 text-xs font-medium leading-snug text-muted-foreground">
              {rotulo}
            </p>
            {icone && <span className="shrink-0 text-muted-foreground">{icone}</span>}
          </div>
          {numero}
          {rodape && <div className="mt-2 text-xs text-muted-foreground">{rodape}</div>}
        </>
      )}
      {children}
    </div>
  );
}

/** Ponto de estado com pulsação sutil (parada para quem pede menos movimento). */
export function Pulso({ tom = "ok", vivo = true }: { tom?: Tom; vivo?: boolean }) {
  return (
    <span className="relative inline-flex size-2.5 shrink-0" aria-hidden>
      {vivo && (
        <span
          className="absolute inline-flex size-full animate-ping rounded-full opacity-50 motion-reduce:animate-none"
          style={{ background: COR_TOM[tom], animationDuration: "2s" }}
        />
      )}
      <span
        className="relative inline-flex size-2.5 rounded-full"
        style={{ background: COR_TOM[tom] }}
      />
    </span>
  );
}

/** Relógio da tela: re-renderiza a cada `intervaloMs` (para "há 5 s"). */
export function useAgora(intervaloMs = 1000): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => window.clearInterval(id);
  }, [intervaloMs]);
  return agora;
}

/** Selo "Ao vivo · atualizado há 5 s". A consulta pausa sozinha com a aba escondida. */
export function SeloAoVivo({
  atualizadoEm,
  atualizando,
  intervaloS,
  falhou,
  onAtualizar,
}: {
  atualizadoEm: number | null;
  atualizando: boolean;
  intervaloS?: number;
  /** A última leitura falhou: o selo fica vermelho ("sem resposta"). */
  falhou?: boolean;
  onAtualizar?: () => void;
}) {
  const agora = useAgora();
  const seg = atualizadoEm ? Math.max(0, Math.round((agora - atualizadoEm) / 1000)) : null;
  return (
    <button
      type="button"
      onClick={onAtualizar}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      title="Atualizar agora"
    >
      <Pulso tom={falhou ? "critico" : atualizando ? "atencao" : "ok"} vivo={!falhou} />
      <span className="text-foreground">Ao vivo</span>
      <span className="tabular-nums">
        {falhou ? "sem resposta" : seg == null ? "conectando…" : seg < 3 ? "agora" : `há ${seg} s`}
        {intervaloS ? ` · a cada ${intervaloS} s` : ""}
      </span>
      <RefreshCw
        className={cn("size-3.5", atualizando && "animate-spin motion-reduce:animate-none")}
      />
    </button>
  );
}

/** Seletor segmentado (janela, sistema…): rola dentro de si no celular, 44 px de toque. */
export function Segmentos<T extends string>({
  valor,
  opcoes,
  onChange,
  rotulo,
  className,
}: {
  valor: T;
  opcoes: { valor: T; rotulo: string }[];
  onChange: (v: T) => void;
  rotulo: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      className={cn(
        "no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-muted/50 p-1",
        className,
      )}
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
              "min-h-9 shrink-0 rounded-full px-3.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 max-sm:min-h-11",
              ativo
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-background hover:text-foreground",
            )}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

export function EstadoVazio({
  titulo,
  texto,
  icone,
  className,
}: {
  titulo: string;
  texto?: ReactNode;
  icone?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center px-4 py-10 text-center", className)}
    >
      <span className="grid size-11 place-items-center rounded-full border border-border bg-muted/50 text-muted-foreground">
        {icone ?? <Inbox className="size-5" />}
      </span>
      <p className="mt-3 text-sm font-medium text-foreground">{titulo}</p>
      {texto && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{texto}</p>}
    </div>
  );
}

export function EstadoErro({
  erro,
  alternativa,
  onTentar,
}: {
  erro: unknown;
  alternativa: string;
  onTentar?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-start gap-2 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>{mensagemDeErro(erro, alternativa)}</span>
      </p>
      {onTentar && (
        <button
          type="button"
          onClick={onTentar}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-card px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
        >
          <RefreshCw className="size-4" /> Tentar de novo
        </button>
      )}
    </div>
  );
}

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted/70", className)} />;
}

/** Barra horizontal fina (participação). */
export function BarraFina({ pct, cor = COR.primaria }: { pct: number; cor?: string }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <span
        className="block h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: cor }}
      />
    </span>
  );
}

/** Mini gráfico de barras (tendência) em SVG — leve para listas longas. */
export function MiniBarras({
  valores,
  cor = COR.primaria,
  className,
  rotulo,
}: {
  valores: number[];
  cor?: string;
  className?: string;
  rotulo?: string;
}) {
  const max = Math.max(1, ...valores);
  const n = Math.max(1, valores.length);
  return (
    <svg
      viewBox={`0 0 ${n * 4} 20`}
      preserveAspectRatio="none"
      className={cn("h-5 w-full", className)}
      role="img"
      aria-label={rotulo ?? "tendência"}
    >
      {valores.map((v, i) => {
        const h = v > 0 ? Math.max(2, (v / max) * 20) : 1;
        return (
          <rect
            key={i}
            x={i * 4 + 0.5}
            y={20 - h}
            width={3}
            height={h}
            rx={0.8}
            fill={v > 0 ? cor : "var(--border)"}
          />
        );
      })}
    </svg>
  );
}
