import { Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/simulacao/format";

const CARD_TONE: Record<
  "muted" | "info" | "warning" | "success" | "danger",
  { dot: string; value: string }
> = {
  info: { dot: "bg-primary", value: "text-foreground" },
  muted: { dot: "bg-muted-foreground/50", value: "text-foreground" },
  warning: { dot: "bg-amber-500/80", value: "text-foreground" },
  success: { dot: "bg-emerald-600/80", value: "text-foreground" },
  danger: { dot: "bg-rose-600/70", value: "text-foreground" },
};

export function StatusCard({
  ativo,
  label,
  count,
  volume,
  tone,
  loading,
  onClick,
}: {
  ativo: boolean;
  label: string;
  count: number;
  volume: number;
  tone: "muted" | "info" | "warning" | "success" | "danger";
  loading: boolean;
  onClick: () => void;
}) {
  const t = CARD_TONE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border bg-card p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${
        ativo
          ? "border-primary/40 bg-primary/[0.03] ring-1 ring-primary/20 shadow-sm"
          : "border-border/60 hover:border-primary/25 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`inline-block size-1.5 shrink-0 rounded-full ${t.dot}`} />
        <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-10" />
      ) : (
        <p className={`mt-2 text-2xl font-semibold tabular-nums leading-none ${t.value}`}>
          {count}
        </p>
      )}
      {loading ? (
        <Skeleton className="mt-2.5 h-3 w-16" />
      ) : (
        <p
          className="mt-2 truncate text-[11px] tabular-nums text-muted-foreground"
          title={formatBRL(volume)}
        >
          {formatBRL(volume)}
        </p>
      )}
    </button>
  );
}

export function VolumeCard({ volume, loading }: { volume: number; loading: boolean }) {
  return (
    <div className="group relative col-span-2 overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary to-primary/85 p-4 text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 sm:col-span-1 lg:col-span-1 xl:col-span-2">
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary-foreground/10 blur-2xl transition-opacity duration-300 group-hover:opacity-80" />
      <div className="flex items-center gap-2">
        <Wallet className="h-3.5 w-3.5 shrink-0 text-primary-foreground/80" />
        <p className="truncate text-[11px] font-medium uppercase tracking-wider text-primary-foreground/80">
          Volume financiado
        </p>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-6 w-24 bg-primary-foreground/20" />
      ) : (
        <p className="mt-2 text-lg font-semibold tabular-nums leading-tight break-words sm:text-xl">
          {formatBRL(volume)}
        </p>
      )}
    </div>
  );
}
