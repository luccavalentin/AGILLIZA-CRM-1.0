import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const RETORNO_MS = 15 * 60 * 1000; // 15 minutos

/** Detecta se o nome do banco é Bradesco (sem acento, minúsculo). */
export function isBradesco(nome: string | null | undefined): boolean {
  if (!nome) return false;
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .includes("bradesco");
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const seg = s % 60;
  return `${String(m).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
}

/**
 * Aviso de tempo mínimo de retorno do Bradesco (15 minutos após o envio).
 * Exibe um cronômetro regressivo; ao zerar, informa que o retorno pode chegar.
 */
export function BradescoRetornoTimer({
  enviadoEm,
  retornado,
  className,
}: {
  enviadoEm: string | null | undefined;
  /** Já houve retorno do banco (crédito aprovado/recusado). Some com a faixa. */
  retornado?: boolean;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (retornado) return null;
  if (!enviadoEm) return null;
  const inicio = new Date(enviadoEm).getTime();
  if (Number.isNaN(inicio)) return null;

  const restante = inicio + RETORNO_MS - now;
  const expirado = restante <= 0;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center space-y-4 rounded-xl border border-primary/20 bg-gradient-to-b from-card to-muted/30 p-8 text-center shadow-lg transition-all duration-500",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground/80">
        <Clock className={cn("h-4 w-4", !expirado && "animate-pulse text-primary")} />
        {expirado ? "Tempo estimado atingido" : "Aguardando retorno Bradesco"}
      </div>

      {expirado ? (
        <div className="space-y-2">
          <div className="text-4xl font-black tracking-tighter text-primary/40 animate-pulse">
            00:00
          </div>
          <p className="max-w-md text-sm font-medium text-foreground">
            O tempo mínimo foi atingido — o retorno pode chegar a qualquer momento.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <div className="text-6xl font-black tracking-tighter tabular-nums text-primary drop-shadow-[0_0_15px_rgba(var(--primary),0.3)]">
              {fmt(restante)}
            </div>
            <div className="absolute -inset-4 -z-10 rounded-full bg-primary/5 blur-3xl" />
          </div>
          <p className="max-w-xs text-sm font-medium text-muted-foreground">
            O banco Bradesco requer um tempo mínimo de 15 minutos para processar a análise inicial.
          </p>
        </div>
      )}
    </div>
  );
}
