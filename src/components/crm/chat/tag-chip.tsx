import { cn } from "@/lib/utils";
import type { ChatEtiqueta } from "@/lib/crm/chat-gestao.functions";

export function TagChip({
  etiqueta,
  onRemove,
}: {
  etiqueta: ChatEtiqueta;
  onRemove?: () => void;
}) {
  return (
    <span className={cn("chat-tag", `chat-tag-${etiqueta.cor}`)}>
      {etiqueta.nome}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-70 hover:opacity-100"
          aria-label={`Remover ${etiqueta.nome}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
