import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Mic,
  Paperclip,
  Send,
  Smile,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { type ChatMensagem } from "@/lib/crm/chat-cliente.functions";
import { type ContextoResposta } from "@/lib/crm/respostas-rapidas";
import { RespostasRapidas } from "./respostas-rapidas";

type AbaId = "mensagem" | "nota" | "tarefa" | "retorno";

const TODAS_ABAS: { id: AbaId; label: string }[] = [
  { id: "mensagem", label: "Mensagem" },
  { id: "nota", label: "Nota interna" },
  { id: "tarefa", label: "Tarefa" },
  { id: "retorno", label: "Agendar retorno" },
];

const EMOJIS = [
  "😀","😁","😂","🤣","😊","😉","😍","🤩","😎","🤔",
  "👍","👏","🙏","🙌","💪","🔥","🎉","✅","❌","⚠️",
  "📎","📄","📞","📧","💰","🏠","🔑","⏰","📅","🚀",
];

export interface ComposerSubmitPayload {
  modo: AbaId;
  texto: string;
  /** Data/hora ISO para tarefa/retorno. */
  prazo?: string;
}

export function ChatComposer({
  respondendo,
  editando,
  cancelarComposer,
  contextoResposta,
  onEscolherResposta,
  fileRef,
  onAnexo,
  enviarArquivo,
  enviandoAnexo,
  enviarPending,
  salvarEdicaoPending,
  textareaRef,
  texto,
  onChangeTexto,
  onKeyDown,
  submeter,
  capabilities,
}: {
  respondendo: ChatMensagem | null;
  editando: ChatMensagem | null;
  cancelarComposer: () => void;
  contextoResposta: ContextoResposta;
  onEscolherResposta: (t: string) => void;
  fileRef: RefObject<HTMLInputElement | null>;
  onAnexo: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Envia um arquivo já em memória (usado pela gravação de áudio). */
  enviarArquivo?: (file: File) => Promise<void> | void;
  enviandoAnexo: boolean;
  enviarPending: boolean;
  salvarEdicaoPending: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  texto: string;
  onChangeTexto: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  submeter: (payload: ComposerSubmitPayload) => void;
  /** Recursos disponíveis (defaults: tudo habilitado). */
  capabilities?: {
    notaInterna?: boolean;
    tarefa?: boolean;
    retorno?: boolean;
    anexo?: boolean;
    respostasRapidas?: boolean;
    audio?: boolean;
  };
}) {
  const capNota = capabilities?.notaInterna ?? true;
  const capTarefa = capabilities?.tarefa ?? true;
  const capRetorno = capabilities?.retorno ?? true;
  const capAnexo = capabilities?.anexo ?? true;
  const capRespostas = capabilities?.respostasRapidas ?? true;
  const capAudio = capabilities?.audio ?? true;

  const ABAS = useMemo(
    () =>
      TODAS_ABAS.filter((t) => {
        if (t.id === "nota") return capNota;
        if (t.id === "tarefa") return capTarefa;
        if (t.id === "retorno") return capRetorno;
        return true;
      }),
    [capNota, capTarefa, capRetorno],
  );
  const [aba, setAba] = useState<AbaId>("mensagem");
  const [prazo, setPrazo] = useState<string>("");
  const [gravando, setGravando] = useState(false);
  const [enviandoAudio, setEnviandoAudio] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const docFileRef = useRef<HTMLInputElement>(null);

  // Ao alternar aba, limpa prazo se sair de tarefa/retorno
  useEffect(() => {
    if (aba !== "tarefa" && aba !== "retorno") setPrazo("");
  }, [aba]);

  const bloqueiaEnvio =
    enviarPending || salvarEdicaoPending || enviandoAnexo || enviandoAudio;

  const podeEnviar = useMemo(() => {
    if (bloqueiaEnvio) return false;
    if (!texto.trim()) return false;
    if ((aba === "tarefa" || aba === "retorno") && !prazo) return false;
    return true;
  }, [texto, aba, prazo, bloqueiaEnvio]);

  function fazerSubmit(modo: AbaId = aba) {
    if (!podeEnviar && !(modo === "mensagem" && texto.trim())) return;
    submeter({
      modo,
      texto: texto.trim(),
      prazo: prazo || undefined,
    });
  }

  function inserirEmoji(e: string) {
    const el = textareaRef.current;
    if (!el) {
      onChangeTexto(texto + e);
      return;
    }
    const start = el.selectionStart ?? texto.length;
    const end = el.selectionEnd ?? texto.length;
    const novo = texto.slice(0, start) + e + texto.slice(end);
    onChangeTexto(novo);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + e.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function iniciarGravacao() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Seu navegador não permite gravação de áudio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size === 0) return;
        const ext = mime === "audio/mp4" ? "m4a" : "webm";
        const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: mime });
        if (!enviarArquivo) return;
        setEnviandoAudio(true);
        try {
          await enviarArquivo(file);
        } finally {
          setEnviandoAudio(false);
        }
      };
      rec.start();
      recRef.current = rec;
      setGravando(true);
    } catch {
      toast.error("Não foi possível acessar o microfone.");
    }
  }

  function pararGravacao() {
    recRef.current?.stop();
    recRef.current = null;
    setGravando(false);
  }

  const isNota = aba === "nota";
  const placeholder = editando
    ? "Edite a mensagem…"
    : aba === "nota"
      ? "Escreva uma nota visível só para o time…"
      : aba === "tarefa"
        ? "Descreva a tarefa a ser feita…"
        : aba === "retorno"
          ? "Motivo do retorno agendado…"
          : "Digite sua mensagem…";

  return (
    <div
      className={cn(
        "border-t bg-card transition-colors",
        isNota ? "border-amber-500/40 bg-amber-500/[0.03]" : "border-border/60",
      )}
    >
      {/* Abas do compositor (só quando há mais de uma) */}
      {ABAS.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto px-2 pt-2 sm:px-3">
          {ABAS.map((t) => {
            const ativo = aba === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setAba(t.id)}
                className={cn(
                  "relative shrink-0 rounded-md px-2.5 py-2 text-xs font-medium transition-colors sm:px-3",
                  ativo
                    ? t.id === "nota"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {ativo && (
                  <span
                    className={cn(
                      "absolute inset-x-2 -bottom-px h-0.5 rounded-full",
                      t.id === "nota" ? "bg-amber-500" : "bg-primary",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      <div
        className={cn(
          "border-t",
          isNota ? "border-amber-500/30" : "border-border/50",
        )}
      >
        {/* Faixa de contexto por aba */}
        {isNota && (
          <div className="border-b border-amber-500/20 bg-amber-500/[0.06] px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
            Nota interna — visível somente para o time. O cliente não recebe.
          </div>
        )}
        {(aba === "tarefa" || aba === "retorno") && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border/50 bg-muted/30 px-3 py-2">
            <label className="text-xs font-medium text-muted-foreground">
              {aba === "retorno" ? "Data/hora do retorno" : "Prazo"}
            </label>
            <Input
              type="datetime-local"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className="h-8 w-auto text-xs"
            />
            {!prazo && (
              <span className="text-[11px] text-muted-foreground">
                Selecione uma data para habilitar.
              </span>
            )}
          </div>
        )}

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
        <input
          ref={docFileRef}
          type="file"
          accept="application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
          className="hidden"
          onChange={onAnexo}
        />

        <Textarea
          ref={textareaRef}
          value={texto}
          onChange={(e) => onChangeTexto(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={cn(
            "min-h-[3.25rem] max-h-40 min-w-0 resize-none rounded-none border-0 bg-transparent px-3 py-3 text-sm shadow-none focus-visible:ring-0 sm:px-4",
          )}
        />

        {/* Rodapé de ações */}
        <div className="flex min-w-0 items-center justify-between gap-2 px-2 pb-2.5 sm:px-3 sm:pb-3">
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {capRespostas && (
              <RespostasRapidas
                contexto={contextoResposta}
                onEscolher={onEscolherResposta}
              />
            )}
            {capAnexo && (
              <>
                <Button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={bloqueiaEnvio}
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
                  onClick={() => docFileRef.current?.click()}
                  disabled={bloqueiaEnvio}
                  size="icon"
                  variant="ghost"
                  className="size-9 shrink-0 rounded-lg text-muted-foreground"
                  title="Anexar documento"
                >
                  <FileText className="size-4" />
                </Button>
              </>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="hidden size-9 shrink-0 rounded-lg text-muted-foreground sm:inline-flex"
                  title="Inserir emoji"
                >
                  <Smile className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-2">
                <div className="grid grid-cols-6 gap-1">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => inserirEmoji(e)}
                      className="rounded-md py-1 text-xl hover:bg-muted"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {enviarArquivo && (
              <Button
                type="button"
                onClick={gravando ? pararGravacao : iniciarGravacao}
                disabled={enviandoAudio || enviarPending}
                size="icon"
                variant={gravando ? "destructive" : "ghost"}
                className={cn(
                  "hidden size-9 shrink-0 rounded-lg sm:inline-flex",
                  gravando
                    ? "animate-pulse"
                    : "text-muted-foreground",
                )}
                title={gravando ? "Parar gravação" : "Gravar áudio"}
              >
                {enviandoAudio ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : gravando ? (
                  <Square className="size-4" />
                ) : (
                  <Mic className="size-4" />
                )}
              </Button>
            )}
          </div>

          {/* Botão Enviar dividido */}
          <div className="flex shrink-0 overflow-hidden rounded-lg shadow-sm">
            <Button
              onClick={() => fazerSubmit()}
              disabled={!podeEnviar && !editando}
              variant={isNota ? "secondary" : "default"}
              className={cn(
                "h-10 w-10 gap-2 rounded-none rounded-l-lg px-0 sm:w-auto sm:px-4",
                isNota &&
                  "bg-amber-500 text-amber-50 hover:bg-amber-500/90 dark:bg-amber-600",
              )}
              title={
                editando
                  ? "Salvar edição"
                  : aba === "nota"
                    ? "Salvar nota interna"
                    : aba === "tarefa"
                      ? "Criar tarefa"
                      : aba === "retorno"
                        ? "Agendar retorno"
                        : "Enviar"
              }
            >
              {enviarPending || salvarEdicaoPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : editando ? (
                <Check className="size-4" />
              ) : (
                <Send className="size-4" />
              )}
              <span className="hidden sm:inline">
                {editando
                  ? "Salvar"
                  : aba === "nota"
                    ? "Salvar nota"
                    : aba === "tarefa"
                      ? "Criar tarefa"
                      : aba === "retorno"
                        ? "Agendar"
                        : "Enviar"}
              </span>
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant={isNota ? "secondary" : "default"}
                  className={cn(
                    "hidden h-10 w-8 rounded-none rounded-r-lg border-l border-primary-foreground/20 px-0 sm:inline-flex",
                    isNota &&
                      "bg-amber-500 text-amber-50 hover:bg-amber-500/90 dark:bg-amber-600",
                  )}
                  title="Outras opções de envio"
                >
                  <ChevronDown className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => fazerSubmit("mensagem")}
                  disabled={!texto.trim() || bloqueiaEnvio}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
                >
                  <Send className="size-3.5" /> Enviar como mensagem
                </button>
                <button
                  type="button"
                  onClick={() => fazerSubmit("nota")}
                  disabled={!texto.trim() || bloqueiaEnvio}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
                >
                  <FileText className="size-3.5" /> Salvar como nota interna
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </div>
  );
}
