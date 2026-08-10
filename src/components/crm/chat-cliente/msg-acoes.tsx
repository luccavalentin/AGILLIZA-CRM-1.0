import { useState } from "react";
import { Copy, MoreVertical, Pencil, Reply, SmilePlus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Emojis oferecidos no seletor de reações (Fase 6). */
export const EMOJIS_REACAO = ["👍", "❤️", "😂", "😮", "😢", "🎉"] as const;

/** Menu de ações que aparece ao passar o mouse sobre a mensagem. */
export function MsgAcoes({
  lado,
  onReply,
  onEdit,
  onCopy,
  onDelete,
  onReagir,
}: {
  lado: "time" | "cliente" | "internet" | "correspondente";
  onReply?: () => void;
  onEdit?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
  onReagir?: (emoji: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0.5 self-center",
        (lado === "time" || lado === "correspondente") ? "order-first" : "",
      )}
    >
      {/* Reagir rápido — abre o seletor de emojis */}
      {onReagir && (
        <Popover open={aberto} onOpenChange={setAberto}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Reagir"
              title="Reagir"
              className="hidden size-7 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-primary group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 sm:flex"
            >
              <SmilePlus className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align={(lado === "time" || lado === "correspondente") ? "end" : "start"}
            className="z-[140] w-auto rounded-full border border-border/60 bg-background/95 p-1 shadow-lg"
            style={{ zIndex: 140 }}
          >
            <div className="flex items-center gap-0.5">
              {EMOJIS_REACAO.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    onReagir(e);
                    setAberto(false);
                  }}
                  className="rounded-full px-1.5 py-1 text-lg leading-none transition-transform hover:scale-125"
                  aria-label={`Reagir com ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
      {/* Resposta rápida — 1 clique, sem abrir menu */}
      {onReply && (
        <button
          type="button"
          onClick={onReply}
          aria-label="Responder"
          title="Responder"
          className="hidden size-7 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-primary group-hover:opacity-100 focus:opacity-100 sm:flex"
        >
          <Reply className="size-4" />
        </button>
      )}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex size-6 shrink-0 items-center justify-center self-center rounded-full text-muted-foreground opacity-60 transition-opacity hover:bg-muted hover:opacity-100 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
            aria-label="Mais ações da mensagem"
          >
            <MoreVertical className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={(lado === "time" || lado === "correspondente") ? "end" : "start"}
          side={(lado === "time" || lado === "correspondente") ? "left" : "right"}
          sideOffset={8}
          collisionPadding={16}
          className="z-[140] w-40 shadow-xl"
          style={{ zIndex: 140 }}
        >
          {onReply && (
            <DropdownMenuItem onClick={onReply}>
              <Reply className="mr-2 size-4" /> Responder
            </DropdownMenuItem>
          )}
          {onCopy && (
            <DropdownMenuItem onClick={onCopy}>
              <Copy className="mr-2 size-4" /> Copiar
            </DropdownMenuItem>
          )}
          {onEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 size-4" /> Editar
            </DropdownMenuItem>
          )}
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" /> Excluir
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
