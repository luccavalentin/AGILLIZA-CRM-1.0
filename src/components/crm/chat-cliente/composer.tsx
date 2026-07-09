import { type RefObject } from "react";
import { Check, Loader2, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { type ChatMensagem } from "@/lib/crm/chat-cliente.functions";
import { type ContextoResposta } from "@/lib/crm/respostas-rapidas";
import { RespostasRapidas } from "./respostas-rapidas";

export function ChatComposer({
  respondendo,
  editando,
  cancelarComposer,
  contextoResposta,
  onEscolherResposta,
  fileRef,
  onAnexo,
  enviandoAnexo,
  enviarPending,
  salvarEdicaoPending,
  textareaRef,
  texto,
  onChangeTexto,
  onKeyDown,
  submeter,
}: {
  respondendo: ChatMensagem | null;
  editando: ChatMensagem | null;
  cancelarComposer: () => void;
  contextoResposta: ContextoResposta;
  onEscolherResposta: (t: string) => void;
  fileRef: RefObject<HTMLInputElement | null>;
  onAnexo: (e: React.ChangeEvent<HTMLInputElement>) => void;
  enviandoAnexo: boolean;
  enviarPending: boolean;
  salvarEdicaoPending: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  texto: string;
  onChangeTexto: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  submeter: () => void;
}) {
  return (
    <>
      {/* Barra de resposta/edição acima do composer */}
      {(respondendo || editando) && (
        <div className="flex items-center gap-2 border-t bg-muted/40 px-3 py-2">
          <div
            className={cn(
              "flex-1 rounded-lg border-l-2 px-2 py-1 text-xs",
              editando ? "border-amber-500 bg-amber-500/5" : "border-primary bg-primary/5",
            )}
          >
            <span className="block font-semibold text-foreground">
              {editando ? "Editando mensagem" : "Respondendo"}
            </span>
            <span className="line-clamp-1 text-muted-foreground">
              {(editando ?? respondendo)?.mensagem || "Anexo"}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground"
            onClick={cancelarComposer}
            title="Cancelar"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2 border-t bg-muted/30 p-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
          className="hidden"
          onChange={onAnexo}
        />
        <RespostasRapidas contexto={contextoResposta} onEscolher={onEscolherResposta} />
        <Button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={enviandoAnexo || enviarPending}
          size="icon"
          variant="outline"
          className="h-11 w-11 shrink-0 rounded-xl"
          title="Anexar imagem ou documento"
        >
          {enviandoAnexo ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </Button>
        <Textarea
          ref={textareaRef}
          value={texto}
          onChange={(e) => onChangeTexto(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={editando ? "Edite a mensagem…" : "Escreva uma mensagem para o cliente…"}
          className="min-h-[44px] max-h-32 resize-none rounded-xl bg-background"
        />
        <Button
          onClick={submeter}
          disabled={enviarPending || salvarEdicaoPending || !texto.trim()}
          size="icon"
          className="h-11 w-11 shrink-0 rounded-xl shadow-sm"
          title={editando ? "Salvar edição" : "Enviar"}
        >
          {enviarPending || salvarEdicaoPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : editando ? (
            <Check className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </>
  );
}
