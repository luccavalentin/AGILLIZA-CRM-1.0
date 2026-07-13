import { useState, type RefObject } from "react";
import {
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Mic,
  Paperclip,
  Send,
  Smile,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { type ChatMensagem } from "@/lib/crm/chat-cliente.functions";
import { type ContextoResposta } from "@/lib/crm/respostas-rapidas";
import { RespostasRapidas } from "./respostas-rapidas";

const ABAS = [
  { id: "mensagem", label: "Mensagem", ativa: true },
  { id: "nota", label: "Nota interna", ativa: false },
  { id: "tarefa", label: "Tarefa", ativa: false },
  { id: "retorno", label: "Agendar retorno", ativa: false },
] as const;

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
  const [aba, setAba] = useState<(typeof ABAS)[number]["id"]>("mensagem");

  return (
    <div className="border-t border-border/60 bg-card">
      {/* Abas do compositor */}
      <div className="flex items-center gap-1 px-3 pt-2">
        {ABAS.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={!t.ativa}
            onClick={() => t.ativa && setAba(t.id)}
            title={t.ativa ? undefined : "Em breve"}
            className={cn(
              "relative rounded-md px-3 py-2 text-xs font-medium transition-colors",
              aba === t.id
                ? "text-primary"
                : t.ativa
                  ? "text-muted-foreground hover:text-foreground"
                  : "cursor-not-allowed text-muted-foreground/40",
            )}
          >
            {t.label}
            {aba === t.id && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      <div className="border-t border-border/50">
        {/* Barra de resposta/edição */}
        {(respondendo || editando) && (
          <div className="flex items-center gap-2 bg-muted/40 px-3 py-2">
            <div
              className={cn(
                "flex-1 rounded-lg border-l-2 px-2 py-1 text-xs",
                editando
                  ? "border-amber-500 bg-amber-500/5"
                  : "border-primary bg-primary/5",
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

        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
          className="hidden"
          onChange={onAnexo}
        />

        <Textarea
          ref={textareaRef}
          value={texto}
          onChange={(e) => onChangeTexto(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            editando ? "Edite a mensagem…" : "Digite sua mensagem…"
          }
          className="min-h-[3.25rem] max-h-40 resize-none rounded-none border-0 bg-transparent px-4 py-3 text-sm shadow-none focus-visible:ring-0"
        />

        {/* Rodapé de ações */}
        <div className="flex items-center justify-between gap-2 px-3 pb-3">
          <div className="flex items-center gap-1">
            <RespostasRapidas
              contexto={contextoResposta}
              onEscolher={onEscolherResposta}
            />
            <Button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={enviandoAnexo || enviarPending}
              size="icon"
              variant="ghost"
              className="size-9 shrink-0 rounded-lg text-muted-foreground"
              title="Anexar imagem ou documento"
            >
              {enviandoAnexo ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Paperclip className="size-4" />
              )}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled
              className="size-9 shrink-0 rounded-lg text-muted-foreground/50"
              title="Modelos de documento (em breve)"
            >
              <FileText className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled
              className="hidden size-9 shrink-0 rounded-lg text-muted-foreground/50 sm:inline-flex"
              title="Emojis (em breve)"
            >
              <Smile className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled
              className="hidden size-9 shrink-0 rounded-lg text-muted-foreground/50 sm:inline-flex"
              title="Áudio (em breve)"
            >
              <Mic className="size-4" />
            </Button>
          </div>

          {/* Botão Enviar dividido */}
          <div className="flex shrink-0 overflow-hidden rounded-lg shadow-sm">
            <Button
              onClick={submeter}
              disabled={enviarPending || salvarEdicaoPending || !texto.trim()}
              className="h-10 gap-2 rounded-none rounded-l-lg px-4"
              title={editando ? "Salvar edição" : "Enviar"}
            >
              {enviarPending || salvarEdicaoPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : editando ? (
                <Check className="size-4" />
              ) : (
                <Send className="size-4" />
              )}
              {editando ? "Salvar" : "Enviar"}
            </Button>
            <Button
              type="button"
              disabled
              className="h-10 w-8 rounded-none rounded-r-lg border-l border-primary-foreground/20 px-0"
              title="Enviar com Enter"
            >
              <ChevronDown className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
