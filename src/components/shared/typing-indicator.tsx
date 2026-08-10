import { cn } from "@/lib/utils";

/**
 * Indicador animado de "está digitando…" para bolhas de chat.
 * Usa apenas tokens semânticos, funciona em modo claro e escuro.
 */
export function TypingIndicator({
  nome,
  lado = "cliente",
  className,
}: {
  nome?: string | null;
  lado?: "cliente" | "time";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-end gap-2",
        lado === "time" ? "justify-end" : "justify-start",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-2xl px-3.5 py-2.5 shadow-sm",
          lado === "time"
            ? "rounded-br-md bg-primary/90 text-primary-foreground"
            : "rounded-bl-md border border-border/60 bg-card text-foreground",
        )}
      >
        {nome && (
          <span className="mr-0.5 text-[11px] font-medium text-muted-foreground">
            {nome} está digitando
          </span>
        )}
        <span className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "size-1.5 animate-bounce rounded-full",
                lado === "time" ? "bg-primary-foreground/70" : "bg-muted-foreground/60",
              )}
              style={{ animationDelay: `${i * 150}ms`, animationDuration: "1s" }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
