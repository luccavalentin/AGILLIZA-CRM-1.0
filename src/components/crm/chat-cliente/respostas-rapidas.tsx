import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getRespostasRapidas,
  setRespostasRapidas,
  subscribeRespostasRapidas,
  aplicarVariaveis,
  VARIAVEIS_RESPOSTA,
  type RespostaRapida,
  type ContextoResposta,
} from "@/lib/crm/respostas-rapidas";

/** Popover de respostas rápidas (templates) — editáveis, salvas no navegador. */
export function RespostasRapidas({
  onEscolher,
  contexto,
}: {
  onEscolher: (texto: string) => void;
  contexto?: ContextoResposta;
}) {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<RespostaRapida[]>([]);
  const [gerenciando, setGerenciando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formTitulo, setFormTitulo] = useState("");
  const [formTexto, setFormTexto] = useState("");
  const formTextoRef = useRef<HTMLTextAreaElement>(null);

  function inserirVariavel(chave: string) {
    const el = formTextoRef.current;
    const token = `{${chave}}`;
    if (!el) {
      setFormTexto((prev) => (prev ? `${prev} ${token}` : token));
      return;
    }
    const start = el.selectionStart ?? formTexto.length;
    const end = el.selectionEnd ?? formTexto.length;
    const novo = formTexto.slice(0, start) + token + formTexto.slice(end);
    setFormTexto(novo);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  useEffect(() => {
    setLista(getRespostasRapidas());
    return subscribeRespostasRapidas(() => setLista(getRespostasRapidas()));
  }, []);

  function limparForm() {
    setEditandoId(null);
    setFormTitulo("");
    setFormTexto("");
  }

  function salvar() {
    const titulo = formTitulo.trim();
    const texto = formTexto.trim();
    if (!titulo || !texto) return;
    let proxima: RespostaRapida[];
    if (editandoId) {
      proxima = lista.map((r) => (r.id === editandoId ? { ...r, titulo, texto } : r));
    } else {
      proxima = [...lista, { id: crypto.randomUUID(), titulo, texto }];
    }
    setLista(proxima);
    setRespostasRapidas(proxima);
    limparForm();
  }

  function editar(r: RespostaRapida) {
    setEditandoId(r.id);
    setFormTitulo(r.titulo);
    setFormTexto(r.texto);
    setGerenciando(true);
  }

  function remover(id: string) {
    const proxima = lista.filter((r) => r.id !== id);
    setLista(proxima);
    setRespostasRapidas(proxima);
    if (editandoId === id) limparForm();
  }

  return (
    <Popover
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (!v) {
          setGerenciando(false);
          limparForm();
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-11 w-11 shrink-0 rounded-xl"
          title="Respostas rápidas"
        >
          <MessageSquareText className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="z-[70] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl p-0 shadow-xl"
        collisionPadding={12}
      >
        <div className="flex items-center justify-between border-b bg-gradient-to-r from-primary/10 via-card to-card px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <MessageSquareText className="size-3.5" />
            </span>
            <div className="leading-tight">
              <span className="block text-sm font-semibold text-foreground">Respostas rápidas</span>
              <span className="block text-[10px] text-muted-foreground">
                Personalizadas com os dados da proposta
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant={gerenciando ? "secondary" : "ghost"}
            size="sm"
            className="h-auto px-2 py-1 text-xs"
            onClick={() => {
              setGerenciando((v) => !v);
              if (gerenciando) limparForm();
            }}
          >
            {gerenciando ? "Concluir" : "Gerenciar"}
          </Button>
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto p-2">
          {lista.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Nenhuma resposta rápida cadastrada.
              <br />
              Use “Gerenciar” para criar a primeira.
            </p>
          )}
          {lista.map((r) => {
            const preview = aplicarVariaveis(r.texto, contexto);
            return (
              <div
                key={r.id}
                className="group/resp flex items-start gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left disabled:cursor-default"
                  onClick={() => {
                    if (gerenciando) return;
                    onEscolher(preview);
                    setAberto(false);
                  }}
                  disabled={gerenciando}
                >
                  <span className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <span className="size-1.5 rounded-full bg-primary/70" />
                    {r.titulo}
                  </span>
                  <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                    {preview}
                  </span>
                </button>
                {gerenciando && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => editar(r)}
                      aria-label="Editar"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remover(r.id)}
                      aria-label="Remover"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {gerenciando && (
          <div className="space-y-2 border-t bg-muted/20 p-3">
            <p className="text-xs font-medium text-foreground">
              {editandoId ? "Editar resposta" : "Nova resposta"}
            </p>
            <Input
              value={formTitulo}
              onChange={(e) => setFormTitulo(e.target.value)}
              placeholder="Título (ex.: Atualização da proposta)"
              className="h-8 text-xs"
            />
            <Textarea
              ref={formTextoRef}
              value={formTexto}
              onChange={(e) => setFormTexto(e.target.value)}
              placeholder="Ex.: Olá {primeiro_nome}, temos novidades sobre a sua proposta {numero_proposta}…"
              className="min-h-[60px] resize-none text-xs"
            />
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Inserir variável
              </p>
              <div className="flex flex-wrap gap-1">
                {VARIAVEIS_RESPOSTA.map((v) => (
                  <button
                    key={v.chave}
                    type="button"
                    onClick={() => inserirVariavel(v.chave)}
                    title={v.rotulo}
                    className="rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/15"
                  >
                    {`{${v.chave}}`}
                  </button>
                ))}
              </div>
            </div>
            {formTexto.trim() && (
              <div className="rounded-lg border border-border/60 bg-background p-2">
                <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Prévia
                </p>
                <p className="text-xs leading-snug text-foreground">
                  {aplicarVariaveis(formTexto, contexto)}
                </p>
              </div>
            )}
            <div className="flex gap-2">
              {editandoId && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={limparForm}
                >
                  Cancelar
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                className="flex-1"
                onClick={salvar}
                disabled={!formTitulo.trim() || !formTexto.trim()}
              >
                {editandoId ? (
                  "Salvar"
                ) : (
                  <>
                    <Plus className="mr-1 size-4" /> Adicionar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
