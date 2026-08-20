import { Bot, User, ThumbsUp, ThumbsDown, Copy, BookMarked, TriangleAlert } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EbookFaqButton } from "@/components/consultor-ia/ebook-faq-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ConsultorMessageProps {
  message: any;
  onFonteClick: (id: string) => void;
  onAvaliar: (v: { mensagem_id: string; avaliacao: "util" | "nao_util" }) => void;
  onSugerirConteudo: (texto: string) => void;
  listaMensagens: any[];
}

export function ConsultorMessage({
  message,
  onFonteClick,
  onAvaliar,
  onSugerirConteudo,
  listaMensagens,
}: ConsultorMessageProps) {
  const isUser = message.papel === "usuario";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.conteudo);
    toast.success("Copiado para a área de transferência.");
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-8">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-card border border-border/40 px-5 py-3 text-sm font-medium leading-relaxed text-foreground shadow-sm">
          {message.conteudo}
        </div>
      </div>
    );
  }

  return (
    <div className="group mb-12 flex items-start gap-5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/30">
        <Bot className="size-5" />
      </div>
      
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Consultor IA</span>
          {message.sem_resposta && (
            <Badge variant="outline" className="h-5 gap-1 border-amber-500/20 bg-amber-500/5 text-[9px] font-bold uppercase text-amber-600">
              <TriangleAlert className="size-2.5" />
              Conhecimento Geral
            </Badge>
          )}
        </div>

        <div className="text-[15px] leading-relaxed text-brand-azul-noite/90 selection:bg-primary/10">
          <Markdown conteudo={message.conteudo} />
        </div>

        {message.fontes_usadas?.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">Fontes:</span>
            {message.fontes_usadas.map((f: any) => (
              <button 
                key={f.id} 
                onClick={() => onFonteClick(f.id)}
                className="inline-flex items-center gap-1 rounded-full border border-primary/10 bg-primary/[0.03] px-2.5 py-0.5 text-[10px] font-medium text-primary transition-all hover:bg-primary/10 hover:border-primary/20"
              >
                <BookMarked className="size-2.5" />
                {f.titulo}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 opacity-0 transition-all duration-300 group-hover:opacity-100">
          <div className="flex items-center rounded-lg border border-border/40 bg-card/50 p-0.5 shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-md text-muted-foreground hover:text-primary"
              onClick={handleCopy}
              title="Copiar resposta"
            >
              <Copy className="size-3.5" />
            </Button>
            <div className="mx-0.5 h-3 w-[1px] bg-border/40" />
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "size-7 rounded-md text-muted-foreground",
                message.avaliacao === "util" && "text-emerald-600 bg-emerald-50"
              )}
              onClick={() => onAvaliar({ mensagem_id: message.id, avaliacao: "util" })}
              title="Útil"
            >
              <ThumbsUp className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "size-7 rounded-md text-muted-foreground",
                message.avaliacao === "nao_util" && "text-destructive bg-destructive/5"
              )}
              onClick={() => onAvaliar({ mensagem_id: message.id, avaliacao: "nao_util" })}
              title="Não útil"
            >
              <ThumbsDown className="size-3.5" />
            </Button>
          </div>

          <EbookFaqButton
            pergunta={
              [...listaMensagens.slice(0, listaMensagens.findIndex((x) => x.id === message.id))]
                .reverse()
                .find((x) => x.papel === "usuario")?.conteudo ?? message.conteudo
            }
            resposta={message.conteudo}
          />

          {message.sem_resposta && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 rounded-lg text-[10px] font-semibold border-primary/20 text-primary hover:bg-primary hover:text-white"
              onClick={() => {
                const idx = listaMensagens.findIndex((x) => x.id === message.id);
                const anterior = [...listaMensagens.slice(0, idx)]
                  .reverse()
                  .find((x) => x.papel === "usuario");
                onSugerirConteudo(anterior?.conteudo ?? "");
              }}
            >
              Sugerir para a base
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
