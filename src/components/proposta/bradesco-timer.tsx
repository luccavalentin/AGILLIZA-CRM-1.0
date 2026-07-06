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
  className,
}: {
  enviadoEm: string | null | undefined;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!enviadoEm) return null;
  const inicio = new Date(enviadoEm).getTime();
  if (Number.isNaN(inicio)) return null;

  const restante = inicio + RETORNO_MS - now;
  const expirado = restante <= 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm",
        className,
      )}
    >
      <Clock className={cn("h-5 w-5 shrink-0 text-warning-foreground", !expirado && "animate-pulse")} />
      {expirado ? (
        <p className="text-warning-foreground">
          O tempo mínimo do Bradesco foi atingido — o retorno pode chegar a qualquer momento.
        </p>
      ) : (
        <p className="text-warning-foreground">
          O Bradesco tem o tempo mínimo de 15 minutos para retorno. Aguarde:{" "}
          <span className="font-semibold tabular-nums">{fmt(restante)}</span>
        </p>
      )}
    </div>
  );
}
