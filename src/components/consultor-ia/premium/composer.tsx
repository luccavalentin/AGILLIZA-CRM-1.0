import { useState, useRef, useEffect } from "react";
import { ArrowUp, Bot, Sparkles, Zap, BookMarked, Cpu, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ConsultorComposerProps {
  pergunta: string;
  setPergunta: (p: string) => void;
  onEnviar: () => void;
  streaming: boolean;
}

export function ConsultorComposer({ pergunta, setPergunta, onEnviar, streaming }: ConsultorComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onEnviar();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [pergunta]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-6">
      <div className="relative group rounded-[1.5rem] border border-border bg-card p-1 shadow-xl shadow-black/5 transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
        <Textarea
          ref={textareaRef}
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte qualquer coisa ao Consultor de IA..."
          disabled={streaming}
          className="max-h-40 min-h-[52px] w-full resize-none border-0 bg-transparent px-4 py-4 text-[15px] font-medium leading-relaxed placeholder:text-muted-foreground/50 focus-visible:ring-0 shadow-none custom-scrollbar"
        />
        <div className="flex items-center justify-between px-2 pb-1">
          <div className="flex gap-1">
            {/* Espaço para futuras ações de anexo */}
          </div>
          <Button
            size="icon"
            onClick={onEnviar}
            disabled={!pergunta.trim() || streaming}
            className={cn(
              "size-9 shrink-0 rounded-xl bg-primary transition-all hover:scale-105",
              !pergunta.trim() && "opacity-50 hover:scale-100"
            )}
          >
            {streaming ? (
              <Zap className="size-4 animate-pulse text-white/70" />
            ) : (
              <ArrowUp className="size-4 text-white" />
            )}
          </Button>
        </div>
      </div>
      <p className="mt-3 text-center text-[10px] text-muted-foreground/60">
        O Consultor IA pode apresentar informações imprecisas. Verifique sempre os dados importantes.
      </p>
    </div>
  );
}

export const SUGESTOES = [
  { icone: Cpu, titulo: "SAC x PRICE", prompt: "Qual a diferença entre SAC e PRICE?" },
  { icone: Zap, titulo: "FGTS habitacional", prompt: "Como funciona o uso de FGTS no financiamento?" },
  { icone: BookMarked, titulo: "Documentação", prompt: "Quais documentos são obrigatórios na proposta?" },
  { icone: Sparkles, titulo: "Produtos bancários", prompt: "O Santander opera Home Equity?" },
];
