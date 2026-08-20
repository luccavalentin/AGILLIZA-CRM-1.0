import { Check, CircleDashed } from "lucide-react";

export function AutoItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-sm">
      {ok ? (
        <Check className="size-4 shrink-0 text-success" />
      ) : (
        <CircleDashed className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      {!ok && <span className="text-xs text-muted-foreground">(preencher no cadastro)</span>}
    </div>
  );
}
