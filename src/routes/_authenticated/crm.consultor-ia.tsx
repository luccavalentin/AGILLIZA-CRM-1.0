import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUp,
  BookMarked,
  Bot,
  Command,
  Cpu,
  MessageSquarePlus,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Markdown } from "@/components/ui/markdown";
import { EbookFaqButton } from "@/components/consultor-ia/ebook-faq-dialog";
import { assertModuloPermitido } from "@/lib/route-guards";

import { supabase } from "@/integrations/supabase/client";
import {
  avaliarRespostaConsultor,
  excluirConversaConsultor,
  listarConversasConsultor,
  listarMensagensConsultor,
  obterItemBase,
  sugerirConteudoBase,
  type FonteCitada,
} from "@/lib/consultor-ia/consultor-ia.functions";

export const Route = createFileRoute("/_authenticated/crm/consultor-ia")({
  head: () => ({
    meta: [
      { title: "Consultor IA — Agilliza" },
      {
        name: "description",
        content:
          "Assistente de financiamento imobiliário com respostas fundamentadas na base de conhecimento da equipe.",
      },
      { property: "og:title", content: "Consultor IA — Agilliza" },
      {
        property: "og:description",
        content: "Inteligência aplicada ao crédito imobiliário, com fontes rastreáveis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: ConsultorIaPage,
});

const SUGESTOES = [
  {
    icone: Cpu,
    titulo: "SAC x PRICE",
    prompt: "Qual a diferença entre SAC e PRICE?",
  },
  {
    icone: Zap,
    titulo: "FGTS no financiamento",
    prompt: "Como funciona o uso de FGTS no financiamento habitacional?",
  },
  {
    icone: BookMarked,
    titulo: "Documentação obrigatória",
    prompt: "Quais documentos são obrigatórios para o comprador na proposta?",
  },
  {
    icone: Sparkles,
    titulo: "Produtos por banco",
    prompt: "O Santander opera Home Equity?",
  },
];

function ConsultorIaPage() {
  const qc = useQueryClient();
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [pergunta, setPergunta] = useState("");
  const [busca, setBusca] = useState("");
  const [fonteAberta, setFonteAberta] = useState<string | null>(null);
  const [sugerindo, setSugerindo] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversas } = useQuery({
    queryKey: ["consultor-ia-conversas"],
    queryFn: () => listarConversasConsultor(),
  });

  const { data: mensagens, isLoading: carregandoMsgs } = useQuery({
    queryKey: ["consultor-ia-mensagens", conversaId],
    queryFn: () => listarMensagensConsultor({ data: { conversa_id: conversaId! } }),
    enabled: !!conversaId,
  });

  const { data: fonteDetalhe } = useQuery({
    queryKey: ["consultor-ia-fonte", fonteAberta],
    queryFn: () => obterItemBase({ data: { id: fonteAberta! } }),
    enabled: !!fonteAberta,
  });

  const [streaming, setStreaming] = useState(false);
  const [parcial, setParcial] = useState("");
  const [perguntaPendente, setPerguntaPendente] = useState<string | null>(null);

  async function perguntarStream(texto: string) {
    setStreaming(true);
    setParcial("");
    setPerguntaPendente(texto);
    try {
      const { data: sessao } = await supabase.auth.getSession();
      const token = sessao.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");

      const resp = await fetch("/api/consultor-ia/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversa_id: conversaId, pergunta: texto }),
      });
      if (!resp.ok || !resp.body) throw new Error("Falha ao consultar a IA.");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let idConversa = conversaId;
      let erro: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const linhas = buffer.split("\n");
        buffer = linhas.pop() ?? "";
        for (const linha of linhas) {
          if (!linha.trim()) continue;
          let ev: any;
          try {
            ev = JSON.parse(linha);
          } catch {
            continue;
          }
          if (ev.tipo === "conversa") {
            idConversa = ev.conversa_id;
            if (!conversaId) setConversaId(ev.conversa_id);
          } else if (ev.tipo === "texto") {
            setParcial(ev.texto);
          } else if (ev.tipo === "erro") {
            erro = ev.mensagem;
          }
        }
      }

      if (erro) throw new Error(erro);
      await qc.invalidateQueries({ queryKey: ["consultor-ia-mensagens", idConversa] });
      await qc.invalidateQueries({ queryKey: ["consultor-ia-conversas"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao consultar a IA.");
    } finally {
      setStreaming(false);
      setParcial("");
      setPerguntaPendente(null);
      inputRef.current?.focus();
    }
  }

  const avaliar = useMutation({
    mutationFn: (v: { mensagem_id: string; avaliacao: "util" | "nao_util" }) =>
      avaliarRespostaConsultor({ data: v }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["consultor-ia-mensagens", conversaId] });
      toast.success("Obrigado pelo retorno.");
    },
  });

  const excluir = useMutation({
    mutationFn: (id: string) => excluirConversaConsultor({ data: { id } }),
    onSuccess: async () => {
      setConversaId(null);
      await qc.invalidateQueries({ queryKey: ["consultor-ia-conversas"] });
      toast.success("Conversa excluída.");
    },
  });

  const enviarSugestao = useMutation({
    mutationFn: (v: { pergunta: string; observacao?: string }) =>
      sugerirConteudoBase({ data: v }),
    onSuccess: () => {
      setSugerindo(null);
      setObservacao("");
      toast.success("Sugestão enviada para quem administra a base.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao enviar sugestão."),
  });

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens?.length, parcial, streaming]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversaId]);

  const lista = useMemo(() => mensagens ?? [], [mensagens]);
  const conversasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const todas = conversas ?? [];
    return termo ? todas.filter((c) => c.titulo.toLowerCase().includes(termo)) : todas;
  }, [conversas, busca]);

  function enviar(texto?: string) {
    const t = (texto ?? pergunta).trim();
    if (!t || streaming) return;
    setPergunta("");
    void perguntarStream(t);
  }

  function novaConversa() {
    setConversaId(null);
    setPergunta("");
    inputRef.current?.focus();
  }

  return (
    <div className="relative flex min-h-full flex-col gap-5">
      {/* Aura tecnológica de fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-10 h-64 opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(45% 60% at 15% 0%, color-mix(in oklab, var(--primary) 22%, transparent) 0%, transparent 70%), radial-gradient(35% 55% at 85% 10%, color-mix(in oklab, var(--primary) 14%, transparent) 0%, transparent 70%)",
        }}
      />

      <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(to right, color-mix(in oklab, var(--primary) 12%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--primary) 12%, transparent) 1px, transparent 1px)",
            backgroundSize: "38px 38px",
            maskImage: "radial-gradient(70% 100% at 20% 0%, black, transparent)",
          }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <Bot className="size-5" />
              <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-emerald-500" />
            </span>
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
                Consultor IA
                <Badge
                  variant="secondary"
                  className="gap-1 rounded-full border border-primary/20 bg-primary/10 text-[10px] font-medium uppercase tracking-wider text-primary"
                >
                  <Sparkles className="size-3" />
                  RAG · fontes rastreáveis
                </Badge>
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Inteligência especialista em crédito imobiliário brasileiro — respostas
                fundamentadas na base mantida pela equipe, com citação de origem.
              </p>
            </div>
          </div>
          <Button onClick={novaConversa} className="gap-2 rounded-xl shadow-sm">
            <MessageSquarePlus className="size-4" />
            Nova conversa
          </Button>
        </div>
      </header>

      <div className="relative grid min-h-[560px] flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm backdrop-blur lg:flex">
          <div className="space-y-2.5 border-b border-border/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Histórico
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar conversa"
                className="h-8 rounded-lg pl-8 text-xs"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {conversasFiltradas.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                {busca ? "Nada encontrado." : "Nenhuma conversa ainda."}
              </p>
            ) : (
              conversasFiltradas.map((c) => {
                const ativa = conversaId === c.id;
                return (
                  <div
                    key={c.id}
                    className={`group relative flex items-center gap-1 rounded-xl px-2.5 py-2 text-sm transition-all ${
                      ativa
                        ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_25%,transparent)]"
                        : "hover:bg-muted/70"
                    }`}
                  >
                    <span
                      className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-opacity ${
                        ativa ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left"
                      onClick={() => setConversaId(c.id)}
                    >
                      {c.titulo}
                    </button>
                    <button
                      type="button"
                      aria-label="Excluir conversa"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => excluir.mutate(c.id)}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <section className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm backdrop-blur">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
            {!conversaId && !streaming ? (
              <div className="mx-auto max-w-2xl py-10 text-center">
                <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <Sparkles className="size-6" />
                </span>
                <h2 className="text-lg font-semibold tracking-tight">Como posso ajudar hoje?</h2>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
                  Regras de bancos, FGTS, SFH/SFI, documentação, engenharia, jurídico e etapas da
                  esteira — com fonte citada em cada resposta.
                </p>
                <div className="mt-6 grid gap-2.5 text-left sm:grid-cols-2">
                  {SUGESTOES.map((s) => {
                    const Icone = s.icone;
                    return (
                      <button
                        key={s.prompt}
                        type="button"
                        onClick={() => enviar(s.prompt)}
                        className="group flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[0.05] hover:shadow-md"
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                          <Icone className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold">{s.titulo}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {s.prompt}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {carregandoMsgs && conversaId ? (
              <div className="space-y-3">
                <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
                <Skeleton className="h-24 w-3/4 rounded-2xl" />
              </div>
            ) : null}

            {lista.map((m) =>
              m.papel === "usuario" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-sm shadow-primary/20">
                    {m.conteudo}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                    <Bot className="size-4" />
                  </span>
                  <div className="min-w-0 max-w-[92%] flex-1">
                    {m.sem_resposta ? (
                      <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                        <TriangleAlert className="size-3.5" />
                        Conhecimento geral da IA — não consta na base da empresa
                      </p>
                    ) : null}
                    <Markdown
                      conteudo={m.conteudo}
                      className="text-sm leading-relaxed text-foreground"
                    />

                    {m.fontes_usadas.length > 0 ? (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Fontes
                        </span>
                        {m.fontes_usadas.map((f: FonteCitada) => (
                          <button key={f.id} type="button" onClick={() => setFonteAberta(f.id)}>
                            <Badge
                              variant="outline"
                              className="cursor-pointer gap-1 rounded-full border-primary/25 bg-primary/[0.06] text-[11px] font-normal text-primary transition-colors hover:bg-primary/15"
                            >
                              <BookMarked className="size-3" />
                              {f.categoria} — {f.titulo}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-2 flex items-center gap-1 opacity-70 transition-opacity hover:opacity-100">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 rounded-lg"
                        aria-label="Resposta útil"
                        onClick={() => avaliar.mutate({ mensagem_id: m.id, avaliacao: "util" })}
                      >
                        <ThumbsUp
                          className={`size-3.5 ${m.avaliacao === "util" ? "text-primary" : "text-muted-foreground"}`}
                        />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 rounded-lg"
                        aria-label="Resposta não útil"
                        onClick={() => avaliar.mutate({ mensagem_id: m.id, avaliacao: "nao_util" })}
                      >
                        <ThumbsDown
                          className={`size-3.5 ${m.avaliacao === "nao_util" ? "text-destructive" : "text-muted-foreground"}`}
                        />
                      </Button>
                      <EbookFaqButton
                        pergunta={
                          [...lista.slice(0, lista.findIndex((x) => x.id === m.id))]
                            .reverse()
                            .find((x) => x.papel === "usuario")?.conteudo ?? m.conteudo
                        }
                        resposta={m.conteudo}
                      />
                      {m.sem_resposta ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-1 h-7 rounded-lg text-[11px]"
                          onClick={() => {
                            const idx = lista.findIndex((x) => x.id === m.id);
                            const anterior = [...lista.slice(0, idx)]
                              .reverse()
                              .find((x) => x.papel === "usuario");
                            setSugerindo(anterior?.conteudo ?? "");
                          }}
                        >
                          Sugerir conteúdo para a base
                        </Button>
                      ) : null}

                    </div>
                  </div>
                </div>
              ),
            )}

            {perguntaPendente ? (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-sm shadow-primary/20">
                  {perguntaPendente}
                </div>
              </div>
            ) : null}

            {streaming ? (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <Bot className="size-4 animate-pulse" />
                </span>
                <div className="min-w-0 max-w-[92%] flex-1">
                  {parcial ? (
                    <>
                      <Markdown
                        conteudo={parcial}
                        className="text-sm leading-relaxed text-foreground"
                      />
                      <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary align-text-bottom" />
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex gap-1">
                        <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-primary" />
                      </span>
                      Analisando a base de conhecimento…
                    </span>
                  )}
                </div>
              </div>
            ) : null}
            <div ref={fimRef} />
          </div>

          <div className="border-t border-border/60 bg-background/40 p-3 sm:p-4">
            <div className="group relative rounded-2xl border border-border/70 bg-card shadow-sm transition-all focus-within:border-primary/50 focus-within:shadow-lg focus-within:shadow-primary/10">
              <Textarea
                ref={inputRef}
                value={pergunta}
                onChange={(e) => setPergunta(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviar();
                  }
                }}
                rows={2}
                placeholder="Pergunte ao consultor sobre bancos, FGTS, documentação, esteira…"
                disabled={streaming}
                className="max-h-40 min-h-[56px] resize-none border-0 bg-transparent pr-14 text-sm shadow-none focus-visible:ring-0"
              />
              <Button
                size="icon"
                onClick={() => enviar()}
                disabled={streaming || !pergunta.trim()}
                aria-label="Enviar pergunta"
                className="absolute bottom-2.5 right-2.5 size-9 rounded-xl shadow-md shadow-primary/25"
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Command className="size-3" />
              Enter envia · Shift + Enter quebra linha · respostas podem citar fontes internas
            </p>
          </div>
        </section>
      </div>

      <Dialog open={!!fonteAberta} onOpenChange={(o) => !o && setFonteAberta(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{fonteDetalhe?.titulo ?? "Fonte"}</DialogTitle>
            <DialogDescription>{fonteDetalhe?.categoria}</DialogDescription>
          </DialogHeader>
          {fonteDetalhe ? (
            <Markdown conteudo={fonteDetalhe.conteudo} className="text-sm" />
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={sugerindo !== null} onOpenChange={(o) => !o && setSugerindo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sugerir conteúdo para a base</DialogTitle>
            <DialogDescription>
              A pergunta será enviada para quem administra a base de conhecimento revisar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={sugerindo ?? ""} onChange={(e) => setSugerindo(e.target.value)} />
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Observação (opcional)"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSugerindo(null)}>
              Cancelar
            </Button>
            <Button
              disabled={enviarSugestao.isPending || !(sugerindo ?? "").trim()}
              onClick={() =>
                enviarSugestao.mutate({
                  pergunta: (sugerindo ?? "").trim(),
                  observacao: observacao.trim() || undefined,
                })
              }
            >
              Enviar sugestão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
