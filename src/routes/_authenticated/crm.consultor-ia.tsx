import { createFileRoute } from "@tanstack/react-router";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bot,
  PanelRight,
  PanelLeftOpen,
  X,
  ChevronRight,
  ShieldCheck,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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
import { assertModuloPermitido } from "@/lib/route-guards";
import { Markdown } from "@/components/ui/markdown";
import { ConfirmDelete } from "@/components/shared/confirm-delete";

// Novos Componentes Premium
import { ConsultorSidebar } from "@/components/consultor-ia/premium/sidebar";
import { ConsultorMessage } from "@/components/consultor-ia/premium/message";
import { ConsultorComposer, SUGESTOES } from "@/components/consultor-ia/premium/composer";
import { CalculadoraConsultor, CartoesCalculo } from "@/components/consultor-ia/calculos-consultor";
import type { ResultadoFerramenta } from "@/lib/consultor-ia/ferramentas";

export const Route = createFileRoute("/_authenticated/crm/consultor-ia")({
  head: () => ({
    meta: [
      { title: "Consultor IA — Agilliza" },
      {
        name: "description",
        content: "Assistente especialista em financiamento imobiliário.",
      },
      { property: "og:title", content: "Consultor IA — Agilliza" },
      { property: "og:type", content: "website" },
    ],
  }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: ConsultorIaPage,
});

function ConsultorIaPage() {
  const qc = useQueryClient();
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [pergunta, setPergunta] = useState("");
  const [busca, setBusca] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [contextoOpen, setContextoOpen] = useState(false);

  const [fonteAberta, setFonteAberta] = useState<string | null>(null);
  const [sugerindo, setSugerindo] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [parcial, setParcial] = useState("");
  const [perguntaPendente, setPerguntaPendente] = useState<string | null>(null);
  const [calculosParciais, setCalculosParciais] = useState<ResultadoFerramenta[]>([]);
  const [calculadoraAberta, setCalculadoraAberta] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Celular: o histórico começa fechado (antes ocupava a tela inteira e escondia a conversa).
  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);
  const fecharHistoricoNoCelular = () => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const conversasQuery = useQuery({
    queryKey: ["consultor-ia-conversas"],
    queryFn: () => listarConversasConsultor(),
  });
  const conversas = conversasQuery.data;

  const {
    data: mensagens,
    isLoading: carregandoMsgs,
    isError: erroMsgs,
    error: erroMsgsDetalhe,
    refetch: recarregarMsgs,
  } = useQuery({
    queryKey: ["consultor-ia-mensagens", conversaId],
    queryFn: () => listarMensagensConsultor({ data: { conversa_id: conversaId! } }),
    enabled: !!conversaId,
  });

  const {
    data: fonteDetalhe,
    isLoading: carregandoFonte,
    isError: erroFonte,
  } = useQuery({
    queryKey: ["consultor-ia-fonte", fonteAberta],
    queryFn: () => obterItemBase({ data: { id: fonteAberta! } }),
    enabled: !!fonteAberta,
  });

  const mensagensProcessadas = useMemo(() => mensagens ?? [], [mensagens]);

  async function perguntarStream(texto: string) {
    setStreaming(true);
    setParcial("");
    setCalculosParciais([]);
    setPerguntaPendente(texto);

    // A pergunta aparece na hora via perguntaPendente; a lista é recarregada no fim.
    try {
      const { data: sessao } = await supabase.auth.getSession();
      const token = sessao.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");

      const resp = await fetch("/api/consultor-ia/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversa_id: conversaId, pergunta: texto }),
      });
      if (resp.status === 403) throw new Error("Você não tem permissão para usar o Consultor IA.");
      if (resp.status === 400) throw new Error("Pergunta inválida. Use até 4.000 caracteres.");
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
          } else if (ev.tipo === "calculos") {
            setCalculosParciais(Array.isArray(ev.calculos) ? ev.calculos : []);
          } else if (ev.tipo === "texto") {
            // Injeta created_at no objeto de streaming para evitar quebra se a UI formatar data do parcial
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
      toast.error(mensagemDeErro(e, "Falha ao consultar a IA."));
    } finally {
      setStreaming(false);
      setParcial("");
      setCalculosParciais([]);
      setPerguntaPendente(null);
    }
  }

  const avaliar = useMutation({
    mutationFn: (v: { mensagem_id: string; avaliacao: "util" | "nao_util" }) =>
      avaliarRespostaConsultor({ data: v }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["consultor-ia-mensagens", conversaId] });
      toast.success("Obrigado pelo retorno.");
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível registrar a avaliação.")),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => excluirConversaConsultor({ data: { id } }),
    onSuccess: async () => {
      setConversaId(null);
      await qc.invalidateQueries({ queryKey: ["consultor-ia-conversas"] });
      toast.success("Conversa excluída.");
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível excluir a conversa.")),
  });

  const enviarSugestao = useMutation({
    mutationFn: (v: { pergunta: string; observacao?: string }) => sugerirConteudoBase({ data: v }),
    onSuccess: () => {
      setSugerindo(null);
      setObservacao("");
      toast.success("Sugestão enviada com sucesso.");
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Falha ao enviar sugestão.")),
  });

  // Hook para scroll automático
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: "smooth" });
      }
    }
  }, [mensagensProcessadas, parcial, streaming, perguntaPendente]);

  function handleEnviar(texto?: string) {
    const t = (texto ?? pergunta).trim();
    if (!t || streaming) return;
    setPergunta("");
    void perguntarStream(t);
  }

  const conversaAtiva = useMemo(
    () => conversas?.find((c) => c.id === conversaId),
    [conversas, conversaId],
  );

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">
      <ConsultorSidebar
        conversas={conversas ?? []}
        conversaId={conversaId}
        busca={busca}
        setBusca={setBusca}
        setConversaId={(id) => {
          setConversaId(id);
          fecharHistoricoNoCelular();
        }}
        onNovaConversa={() => {
          setConversaId(null);
          setPergunta("");
          fecharHistoricoNoCelular();
        }}
        onExcluir={(id) => excluir.mutate(id)}
        isOpen={sidebarOpen}
        toggle={() => setSidebarOpen(!sidebarOpen)}
        erro={
          conversasQuery.isError
            ? mensagemDeErro(conversasQuery.error, "Não foi possível carregar o histórico.")
            : null
        }
        onTentarDeNovo={() => void conversasQuery.refetch()}
      />

      <main className="relative flex flex-1 flex-col overflow-hidden">
        {/* Header Superior Limpo */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/40 px-3 backdrop-blur-md md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-muted-foreground md:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Mostrar histórico"
                title="Mostrar histórico"
              >
                <PanelLeftOpen className="size-5" />
              </Button>
            )}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
              <Bot className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-foreground">
                {conversaAtiva ? conversaAtiva.titulo : "Consultor de IA"}
              </h1>
              <p className="text-[10px] font-medium text-muted-foreground">
                Especialista em crédito imobiliário · contas calculadas pelo sistema
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-xl"
              data-tour="consultor-ia-calculadora"
              onClick={() => setCalculadoraAberta(true)}
              title="Calculadora: SAC/PRICE, renda e custos"
            >
              <Calculator className="size-4" />
              <span className="hidden sm:inline">Calculadora</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`size-9 text-muted-foreground transition-all ${contextoOpen ? "text-primary bg-primary/5" : ""}`}
              onClick={() => setContextoOpen(!contextoOpen)}
              title="Informações da conversa"
              aria-label="Informações da conversa"
              aria-pressed={contextoOpen}
            >
              <PanelRight className="size-5" />
            </Button>
          </div>
        </header>

        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="mx-auto w-full max-w-3xl px-3 py-6 md:px-6 md:py-10">
            {!conversaId && !streaming ? (
              <div className="flex flex-col items-center py-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="relative mb-10">
                  <div className="absolute -inset-10 rounded-full bg-primary/5 blur-3xl" />
                  <div className="relative flex size-20 items-center justify-center rounded-3xl bg-card shadow-2xl ring-1 ring-primary/10">
                    <Bot className="size-10 text-primary" />
                  </div>
                </div>

                <h2 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
                  Como posso ajudar?
                </h2>
                <p className="mt-4 text-sm font-medium text-muted-foreground/60 max-w-md">
                  Use o Consultor de IA para analisar informações, esclarecer dúvidas técnicas e
                  apoiar suas decisões de crédito imobiliário.
                </p>

                <div className="mt-12 grid w-full grid-cols-1 gap-4 sm:grid-cols-2" data-tour="consultor-ia-sugestoes">
                  {SUGESTOES.map((s) => (
                    <button
                      key={s.prompt}
                      type="button"
                      onClick={() => handleEnviar(s.prompt)}
                      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:bg-primary/[0.02] hover:shadow-lg hover:shadow-black/5"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary transition-all group-hover:bg-primary group-hover:text-white">
                        <s.icone className="size-5" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary">
                          {s.titulo}
                        </h4>
                        <p className="truncate text-xs font-semibold text-foreground/80 mt-0.5">
                          {s.prompt}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {carregandoMsgs && <Skeleton className="h-40 w-full rounded-2xl" />}
                {erroMsgs && (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <p className="text-sm text-destructive">
                      {mensagemDeErro(erroMsgsDetalhe, "Não foi possível carregar a conversa.")}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => void recarregarMsgs()}>
                      Tentar de novo
                    </Button>
                  </div>
                )}

                {mensagensProcessadas.map((m) => (
                  <ConsultorMessage
                    key={m.id}
                    message={m}
                    onFonteClick={setFonteAberta}
                    onAvaliar={(v) => avaliar.mutate(v)}
                    onSugerirConteudo={setSugerindo}
                    listaMensagens={mensagensProcessadas}
                  />
                ))}

                {perguntaPendente && (
                  <div className="flex justify-end mb-8">
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-card border border-border/40 px-5 py-3 text-sm font-medium text-foreground shadow-sm">
                      {perguntaPendente}
                    </div>
                  </div>
                )}

                {streaming && (
                  <div className="flex items-start gap-5 mb-12">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/30">
                      <Bot className="size-5 animate-pulse" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-4">
                      <CartoesCalculo calculos={calculosParciais} />
                      <div className="text-[15px] leading-relaxed text-foreground/90">
                        {parcial ? (
                          <>
                            <Markdown conteudo={parcial} />
                            <span className="ml-1 inline-block h-4 w-[2px] animate-pulse bg-primary align-middle" />
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground italic">
                            Analisando informações...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <ConsultorComposer
          pergunta={pergunta}
          setPergunta={setPergunta}
          onEnviar={handleEnviar}
          streaming={streaming}
        />
        <CalculadoraConsultor
          aberta={calculadoraAberta}
          onAbertaChange={setCalculadoraAberta}
          onPerguntar={(t) => {
            setCalculadoraAberta(false);
            handleEnviar(t);
          }}
        />
      </main>

      {/* Painel de Contexto (Direita) */}
      {contextoOpen && (
        <aside className="fixed inset-y-0 right-0 z-40 w-[min(300px,85vw)] shrink-0 border-l border-border/40 bg-card backdrop-blur-xl animate-in slide-in-from-right-4 duration-300 md:static md:z-auto md:w-[300px] md:bg-card/20">
          <div className="flex h-16 items-center justify-between border-b border-border/40 px-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
              Informações
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground md:hidden"
              onClick={() => setContextoOpen(false)}
              aria-label="Fechar informações"
            >
              <X className="size-4" />
            </Button>
          </div>
          <ScrollArea className="h-full">
            <div className="p-6 space-y-8">
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                  <ShieldCheck className="size-3" />
                  Privacidade
                </div>
                <p className="text-[10px] leading-relaxed text-muted-foreground/60">
                  Só você vê suas conversas. As perguntas são enviadas ao provedor de IA configurado
                  pela conta para gerar a resposta.
                </p>
              </section>

              <Separator className="bg-border/40" />

              {/* Antes havia "Exportar histórico" e "Limpar conversa" sem ação nenhuma. */}
              {conversaId && (
                <div className="flex flex-col gap-2">
                  <ConfirmDelete
                    titulo="Excluir conversa"
                    descricao="A conversa e as respostas do Consultor IA serão apagadas."
                    onConfirm={async () => {
                      await excluir.mutateAsync(conversaId);
                    }}
                    trigger={
                      <Button
                        variant="ghost"
                        className="justify-start text-xs font-semibold text-muted-foreground hover:text-destructive"
                      >
                        Excluir conversa
                      </Button>
                    }
                  />
                </div>
              )}
            </div>
          </ScrollArea>
        </aside>
      )}

      {/* Diálogos Originais Preservados */}
      <Dialog open={!!fonteAberta} onOpenChange={(o) => !o && setFonteAberta(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{fonteDetalhe?.titulo ?? "Fonte"}</DialogTitle>
            <DialogDescription>{fonteDetalhe?.categoria}</DialogDescription>
          </DialogHeader>
          {carregandoFonte ? (
            <Skeleton className="h-24 w-full" />
          ) : erroFonte ? (
            <p className="text-sm text-destructive">Não foi possível abrir esta fonte.</p>
          ) : fonteDetalhe ? (
            <Markdown conteudo={fonteDetalhe.conteudo} className="text-sm" />
          ) : (
            <p className="text-sm text-muted-foreground">
              Este conteúdo não está mais na base de conhecimento.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={sugerindo !== null} onOpenChange={(o) => !o && setSugerindo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sugerir para a base</DialogTitle>
            <DialogDescription>A pergunta será enviada para revisão da Agilliza.</DialogDescription>
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
