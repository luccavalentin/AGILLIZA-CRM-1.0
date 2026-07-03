import { useEffect, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlaCountdownProps {
  inicio: string;
  prazo: string | null;
  concluida?: boolean;
  className?: string;
}

function fmt(ms: number): string {
  const neg = ms < 0;
  const s = Math.abs(Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const d = Math.floor(h / 24);
  const base = d > 0 ? `${d}d ${h % 24}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return neg ? `-${base}` : base;
}

/** Countdown de SLA em horas úteis — tons conforme % consumido (00b-tons-cores). */
export function SlaCountdown({ inicio, prazo, concluida, className }: SlaCountdownProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!prazo) return <span className={cn("text-xs text-muted-foreground", className)}>Sem SLA</span>;

  const ini = new Date(inicio).getTime();
  const fim = new Date(prazo).getTime();
  const total = Math.max(fim - ini, 1);
  const consumido = (now - ini) / total; // 0..1+
  const restante = fim - now;

  if (concluida) {
    return <span className={cn("inline-flex items-center gap-1 text-xs text-success tabular-nums", className)}>
      <Clock className="h-3.5 w-3.5" /> Concluída no prazo
    </span>;
  }

  let cls = "text-success";
  let pulse = false;
  let Icon = Clock;
  if (consumido >= 1) {
    cls = "text-destructive font-semibold";
    Icon = AlertTriangle;
  } else if (consumido >= 0.75) {
    cls = "text-warning";
    pulse = true;
  } else if (consumido >= 0.25) {
    cls = "text-warning";
  }

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs tabular-nums", cls, pulse && "animate-pulse", className)}>
      <Icon className="h-3.5 w-3.5" />
      {consumido >= 1 ? `SLA estourado ${fmt(restante)}` : `${fmt(restante)} restantes`}
    </span>
  );
}
