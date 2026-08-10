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
        content: "Inteligência especialista em crédito imobiliário, com sofisticação Agilliza.",
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
    mutationFn: (v: { pergunta: string; observacao?: string }) => sugerirConteudoBase({ data: v }),
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
    <div className="relative flex min-h-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Background futurista ultra-premium seguindo os tons da Agilliza */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background: `
            radial-gradient(circle at 0% 0%, color-mix(in oklab, var(--primary) 12%, transparent) 0%, transparent 40%),
            radial-gradient(circle at 100% 100%, color-mix(in oklab, var(--primary) 8%, transparent) 0%, transparent 40%),
            radial-gradient(circle at 50% 50%, color-mix(in oklab, var(--primary) 3%, transparent) 0%, transparent 60%)
          `,
        }}
      />

      {/* Textura de grade sutil para ar tecnológico */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(var(--primary) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <header className="relative z-10 mx-auto w-full max-w-5xl py-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="group relative">
            <div className="absolute -inset-2 rounded-[2rem] bg-gradient-to-tr from-primary/30 to-primary/5 opacity-0 blur-2xl transition duration-700 group-hover:opacity-100" />
            <div className="relative flex size-16 items-center justify-center rounded-[1.2rem] bg-card shadow-[0_15px_40px_-12px_rgba(0,15,159,0.15)] ring-1 ring-primary/10 transition-transform duration-500 group-hover:scale-105">
              <Bot className="size-8 text-primary" />
              <div className="absolute -bottom-1 -right-1 size-5 rounded-full border-[3px] border-card bg-emerald-500 shadow-lg" />
            </div>
          </div>

          <div className="space-y-1.5">
            <h1 className="bg-gradient-to-b from-primary to-brand-azul-noite bg-clip-text text-2xl font-extrabold tracking-tight text-transparent sm:text-3xl">
              Consultor IA
            </h1>
            <p className="mx-auto max-w-2xl text-sm font-medium text-muted-foreground/80">
              A inteligência moderna da Agilliza para o mercado imobiliário.
            </p>
          </div>

          <Button
            onClick={novaConversa}
            variant="outline"
            className="group/btn h-10 gap-2 rounded-full border-primary/15 bg-card px-6 text-sm font-semibold text-primary transition-all hover:border-primary/40 hover:bg-primary hover:text-white hover:shadow-[0_10px_20px_-10px_rgba(0,15,159,0.3)]"
          >
            <MessageSquarePlus className="size-5 transition-transform group-hover/btn:rotate-12" />
            Nova conversa
          </Button>
        </div>
      </header>

      <div className="relative z-10 grid min-h-[600px] flex-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden flex-col overflow-hidden rounded-3xl border border-border/40 bg-card/40 shadow-xl backdrop-blur-xl lg:flex">
          <div className="space-y-3 border-b border-border/40 p-5">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
              Histórico
            </h3>
            <div className="relative group">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50 transition-colors group-focus-within:text-primary" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar conversa..."
                className="h-10 rounded-xl border-border/40 bg-background/50 pl-9 text-sm focus-visible:ring-1 focus-visible:ring-primary/30"
              />
            </div>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-3 custom-scrollbar">
            {conversasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground/60">
                <MessageSquarePlus className="mb-2 size-6 opacity-20" />
                <p className="text-xs font-medium">
                  {busca ? "Nada encontrado." : "Nenhuma conversa ainda."}
                </p>
              </div>
            ) : (
              conversasFiltradas.map((c) => {
                const ativa = conversaId === c.id;
                return (
                  <div
                    key={c.id}
                    className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all border border-transparent ${
                      ativa
                        ? "bg-primary/5 border-primary/20 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <MessageSquarePlus
                      className={`size-4 shrink-0 ${ativa ? "text-primary" : "text-muted-foreground/40"}`}
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left font-semibold"
                      onClick={() => setConversaId(c.id)}
                    >
                      {c.titulo}
                    </button>
                    <button
                      type="button"
                      aria-label="Excluir conversa"
                      className={`transition-opacity ${ativa ? "opacity-80 hover:opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                      onClick={() => excluir.mutate(c.id)}
                    >
                      <Trash2
                        className={`size-3.5 ${ativa ? "text-primary" : "text-muted-foreground/60 hover:text-destructive"}`}
                      />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <section className="relative flex flex-col overflow-hidden rounded-[2rem] border border-primary/10 bg-card/60 shadow-[0_30px_70px_-20px_rgba(0,15,159,0.12)] backdrop-blur-2xl">
          <div className="flex-1 space-y-8 overflow-y-auto px-6 py-10 custom-scrollbar">
            {!conversaId && !streaming ? (
              <div className="mx-auto flex max-w-2xl flex-col items-center py-12 text-center">
                <div className="relative mb-10">
                  <div className="absolute -inset-8 rounded-full bg-primary/15 blur-3xl" />
                  <div className="relative flex size-24 items-center justify-center rounded-[2rem] bg-card shadow-[0_25px_50px_-12px_rgba(0,15,159,0.2)] ring-1 ring-primary/10">
                    <Bot className="size-12 text-primary" />
                  </div>
                </div>

                <h2 className="text-2xl font-extrabold tracking-tight text-brand-azul-noite sm:text-3xl">
                  Como posso potencializar seus negócios hoje?
                </h2>
                <p className="mt-4 text-base font-medium text-muted-foreground/70">
                  Especialista em regras bancárias, FGTS, documentação e toda a jornada do crédito
                  imobiliário Agilliza.
                </p>

                <div className="mt-14 grid w-full gap-5 sm:grid-cols-2">
                  {SUGESTOES.map((s) => {
                    const Icone = s.icone;
                    return (
                      <button
                        key={s.prompt}
                        type="button"
                        onClick={() => enviar(s.prompt)}
                        className="group relative flex flex-col items-start gap-4 rounded-3xl border border-primary/5 bg-card/40 p-6 text-left transition-all hover:border-primary/30 hover:bg-card hover:shadow-[0_20px_40px_-15px_rgba(0,15,159,0.1)]"
                      >
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/5 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:scale-110">
                          <Icone className="size-6" />
                        </div>
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-primary/60 transition-colors group-hover:text-primary">
                            {s.titulo}
                          </h4>
                          <p className="text-[15px] font-semibold text-foreground/80 transition-colors group-hover:text-brand-azul-noite">
                            {s.prompt}
                          </p>
                        </div>
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
                <div key={m.id} className="mb-6 flex justify-end">
                  <div className="max-w-[85%] rounded-[1.5rem] rounded-br-md bg-primary px-6 py-4 text-[15px] font-semibold leading-relaxed text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/25">
                    {m.conteudo}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="mb-10 flex items-start gap-5">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-card shadow-md ring-1 ring-primary/10">
                    <Bot className="size-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-4">
                    {m.sem_resposta ? (
                      <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                        <TriangleAlert className="size-3.5" />
                        Conhecimento Geral
                      </div>
                    ) : null}
                    <div className="rounded-[1.5rem] rounded-tl-md border border-primary/5 bg-card/50 p-7 shadow-sm transition-all hover:shadow-md">
                      <Markdown
                        conteudo={m.conteudo}
                        className="text-[15.5px] leading-relaxed text-brand-azul-noite/90"
                      />
                    </div>

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
                          [
                            ...lista.slice(
                              0,
                              lista.findIndex((x) => x.id === m.id),
                            ),
                          ]
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

          <footer className="relative z-20 border-t border-primary/5 bg-card/40 px-6 py-8 backdrop-blur-xl">
            <div className="mx-auto max-w-4xl">
              <div className="relative group">
                {/* Glow de foco no input */}
                <div className="absolute -inset-1.5 rounded-[1.8rem] bg-primary/5 opacity-0 blur-xl transition duration-500 group-focus-within:opacity-100" />

                <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-[1.5rem] border border-primary/10 bg-card p-2 shadow-[0_10px_40px_-15px_rgba(0,15,159,0.08)] transition-all group-focus-within:border-primary/30 group-focus-within:shadow-[0_20px_50px_-15px_rgba(0,15,159,0.12)] sm:flex-row">
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
                    rows={1}
                    placeholder="Sua pergunta técnica aqui..."
                    disabled={streaming}
                    className="max-h-60 min-h-[48px] flex-1 resize-none border-0 bg-transparent px-4 py-3 text-base font-semibold text-brand-azul-noite focus-visible:ring-0 placeholder:text-muted-foreground/40 shadow-none"
                  />
                  <div className="flex w-full items-center justify-between gap-3 px-2 pb-1 sm:w-auto sm:pb-0">
                    <Button
                      size="icon"
                      onClick={() => enviar()}
                      disabled={!pergunta.trim() || streaming}
                      className="size-11 shrink-0 rounded-2xl bg-primary shadow-lg shadow-primary/25 transition-all hover:scale-105 hover:bg-brand-azul-escuro disabled:scale-100 disabled:bg-muted/60 disabled:shadow-none"
                    >
                      {streaming ? (
                        <Zap className="size-5 animate-pulse text-white/50" />
                      ) : (
                        <ArrowUp className="size-5 text-white" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </footer>
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
