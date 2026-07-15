import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Paperclip,
  Download,
  Trash2,
  Send,
  MessageCircle,
  User,
  Users,
  Tag,
  Clock,
  History,
  FileText,
  Layers,
} from "lucide-react";
import { getMinhaSessao } from "@/lib/session.functions";
import { PopOutPanel } from "@/components/shared/pop-out-panel";
import { Card } from "@/components/ui/card";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  obterDemanda,
  comentarDemanda,
  moverStatusDemanda,
  marcarDemandaLida,
  registrarAnexoDemanda,
  removerAnexoDemanda,
  urlAnexoDemanda,
  excluirDemanda,
  listarDemandas,
  type DemandaStatus,
} from "@/lib/operacional/demandas.functions";
import { TransferirDialog } from "@/components/operacional/transferir-dialog";
import { EditarDemandaDialog } from "@/components/operacional/editar-demanda-dialog";
import { SlaCountdown } from "@/components/operacional/sla-countdown";
import { ToneBadge } from "@/components/crm/tone-badge";
import { PRIORIDADE, statusDemanda } from "@/components/operacional/status";
import { Button } from "@/components/ui/button";
import { VisualizadorArquivo } from "@/components/comum/visualizador-arquivo";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useIncomingChatSound } from "@/hooks/use-chat-sound";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/operacional/demandas_/$id")({
  head: () => ({ meta: [{ title: "Demanda — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.demandas"),
  component: Pagina,
});

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { 
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {  hour: "2-digit", minute: "2-digit" });
}

function fmtDia(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const mesmoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (mesmoDia(d, hoje)) return "Hoje";
  if (mesmoDia(d, ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", {  day: "2-digit", month: "long", year: "numeric" });
}

function iniciaisChat(nome?: string | null): string {
  if (!nome) return "?";
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

const STATUS_OPCOES: DemandaStatus[] = [
  "aberta",
  "em_andamento",
  "aguardando",
  "concluida",
  "cancelada",
];

function InfoCell({
  icon: Icon,
  rotulo,
  valor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  rotulo: string;
  valor: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 bg-card px-4 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-foreground">{valor}</p>
      </div>
    </div>
  );
}


function Pagina() {
  const { id } = useParams({ from: "/_authenticated/operacional/demandas_/$id" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [corpo, setCorpo] = useState("");
  const [visivelCliente] = useState(false);
  const comentarFn = useServerFn(comentarDemanda);
  const moverFn = useServerFn(moverStatusDemanda);
  const lidaFn = useServerFn(marcarDemandaLida);
  const registrarAnexoFn = useServerFn(registrarAnexoDemanda);
  const removerAnexoFn = useServerFn(removerAnexoDemanda);
  const urlAnexoFn = useServerFn(urlAnexoDemanda);
  const excluirFn = useServerFn(excluirDemanda);
  const [excluindo, setExcluindo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviandoMsg, setEnviandoMsg] = useState(false);
  const [arquivoChat, setArquivoChat] = useState<File | null>(null);
  const [visualizando, setVisualizando] = useState<{ url: string; nome: string } | null>(null);

  async function enviarMensagem() {
    const texto = corpo.trim();
    if (!texto && !arquivoChat) return;
    setEnviandoMsg(true);
    try {
      let anexo_path: string | undefined;
      let anexo_nome: string | undefined;
      let anexo_tamanho: number | undefined;
      if (arquivoChat) {
        const path = `${id}/chat/${Date.now()}-${arquivoChat.name.replace(/[^\w.\-]/g, "_")}`;
        const { error } = await supabase.storage.from("demanda-anexos").upload(path, arquivoChat);
        if (error) throw error;
        anexo_path = path;
        anexo_nome = arquivoChat.name;
        anexo_tamanho = arquivoChat.size;
      }
      await comentarFn({
        data: {
          demanda_id: id,
          corpo: texto,
          visivel_cliente: visivelCliente,
          anexo_path,
          anexo_nome,
          anexo_tamanho,
        },
      });
      setCorpo("");
      setArquivoChat(null);
      invalidar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar mensagem.");
    } finally {
      setEnviandoMsg(false);
    }
  }


  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviando(true);
    try {
      const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("demanda-anexos").upload(path, file);
      if (error) throw error;
      await registrarAnexoFn({
        data: { demanda_id: id, nome: file.name, storage_path: path, tamanho: file.size },
      });
      invalidar();
      toast.success("Anexo enviado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload.");
    } finally {
      setEnviando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function baixarAnexo(storage_path: string, nome: string) {
    try {
      const { url } = await urlAnexoFn({ data: { storage_path } });
      setVisualizando({ url, nome });
    } catch {
      toast.error("Falha ao gerar link do anexo.");
    }
  }

  const { data } = useQuery({
    queryKey: ["demanda", id],
    queryFn: () => obterDemanda({ data: { id } }),
  });

  // Pilha de demandas (navegação lateral)
  const [escopoPilha, setEscopoPilha] = useState<"minhas" | "equipe">("equipe");
  const { data: pilha } = useQuery({
    queryKey: ["demandas", "pilha", escopoPilha],
    queryFn: () => listarDemandas({ data: { escopo: escopoPilha } }),
  });

  async function excluir() {
    setExcluindo(true);
    try {
      await excluirFn({ data: { id } });
      toast.success("Demanda excluída.");
      qc.invalidateQueries({ queryKey: ["demandas"] });
      navigate({ to: "/operacional/demandas" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir.");
    } finally {
      setExcluindo(false);
    }
  }


  useEffect(() => {
    lidaFn({ data: { demanda_id: id } }).catch(() => {});
  }, [id, lidaFn]);

  useEffect(() => {
    const canal = supabase
      .channel(`demanda:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "demanda_mensagens", filter: `demanda_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["demanda", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [id, qc]);

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["demanda", id] });
    qc.invalidateQueries({ queryKey: ["demandas"] });
  }

  const { data: sessao } = useQuery({
    queryKey: ["minha-sessao"],
    queryFn: () => getMinhaSessao(),
  });
  const meuId = sessao?.profile?.id ?? null;

  useIncomingChatSound(
    (data?.mensagens ?? []).map((m: any) => ({ id: m.id, mine: m.autor_id === meuId })),
    id,
  );

  const d = data?.demanda;
  if (!d) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  const perm = data?.permissoes;

  return (
    <div className="mx-auto max-w-[1400px] p-4 md:p-6">
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Pilha de demandas */}
        <aside className="flex flex-col rounded-2xl border border-border/70 bg-card shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Layers className="h-4 w-4 text-muted-foreground" /> Demandas
            </h2>
            <div className="flex rounded-lg border border-border/60 p-0.5">
              {(["equipe", "minhas"] as const).map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setEscopoPilha(op)}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-medium capitalize transition-colors",
                    escopoPilha === op
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {op === "equipe" ? "Geral" : "Minhas"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
            {(pilha ?? []).length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                Nenhuma demanda.
              </p>
            ) : (
              (pilha ?? []).map((item) => {
                const ativo = item.id === id;
                return (
                  <Link
                    key={item.id}
                    to="/operacional/demandas/$id"
                    params={{ id: item.id }}
                    className={cn(
                      "block rounded-xl border px-3 py-2.5 transition-colors",
                      ativo
                        ? "border-primary/50 bg-primary/[0.06] ring-1 ring-primary/20"
                        : "border-border/60 bg-background hover:border-primary/40 hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-block h-1.5 w-4 shrink-0 rounded-full",
                          PRIORIDADE[item.prioridade as "p1"].bar,
                        )}
                      />
                      <span className="truncate font-mono text-[10px] text-muted-foreground">
                        {item.numero}
                      </span>
                      <ToneBadge tone={statusDemanda(item.status).tone}>
                        {statusDemanda(item.status).label}
                      </ToneBadge>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">
                      {item.titulo}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.nome_responsavel ?? "Sem responsável"}
                    </p>
                  </Link>
                );
              })
            )}
          </div>
        </aside>

        {/* Conteúdo da demanda */}
        <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/operacional/demandas">
            <ArrowLeft className="mr-1 h-4 w-4" /> Demandas
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {perm?.pode_editar && (
            <EditarDemandaDialog
              demanda={{
                id: d.id,
                titulo: d.titulo,
                descricao: d.descricao ?? null,
                prioridade: d.prioridade,
                sla_horas: d.sla_horas ?? null,
              }}
              onSalva={invalidar}
            />
          )}
          {perm?.pode_transferir && (
            <TransferirDialog demandaId={id} onTransferida={invalidar} />
          )}
          {perm?.pode_excluir && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir demanda?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. A demanda {d.numero} e seu histórico serão
                    removidos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={excluir}
                    disabled={excluindo}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {excluindo ? "Excluindo…" : "Excluir"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Select
            value={d.status}
            onValueChange={async (v) => {
              await moverFn({ data: { id, status: v as DemandaStatus } });
              invalidar();
              toast.success("Status atualizado.");
            }}
            disabled={!perm?.pode_mover_status}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPCOES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusDemanda(s).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>


      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border/60 bg-muted/30 px-5 py-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-background px-2 py-0.5 font-mono text-xs text-muted-foreground ring-1 ring-border/60">
              {d.numero}
            </span>
            <ToneBadge tone={statusDemanda(d.status).tone}>
              {statusDemanda(d.status).label}
            </ToneBadge>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-background px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border/60">
              <span
                className={cn(
                  "inline-block h-1.5 w-5 rounded-full",
                  PRIORIDADE[d.prioridade as "p1"].bar,
                )}
              />
              {PRIORIDADE[d.prioridade as "p1"].label}
            </span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{d.titulo}</h1>
          {d.descricao && (
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {d.descricao}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-px bg-border/60 md:grid-cols-4">
          <InfoCell icon={User} rotulo="Responsável" valor={data?.nome_responsavel ?? "—"} />
          <InfoCell icon={Users} rotulo="Cliente" valor={d.clientes?.nome ?? "—"} />
          <InfoCell
            icon={Tag}
            rotulo="Tipo"
            valor={d.tipo === "simulacao" ? "Simulação" : d.tipo === "diversos" ? "Diversos" : d.tipo}
          />
          <div className="flex items-start gap-2.5 bg-card px-4 py-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Prazo (SLA)</p>
              <div className="mt-0.5 text-sm font-medium text-foreground">
                <SlaCountdown
                  inicio={d.sla_inicio}
                  prazo={d.prazo_sla}
                  concluida={d.status === "concluida"}
                  concluidaEm={d.concluida_em}
                />
              </div>
            </div>
          </div>
        </div>

        {d.dados_simulacao && (
          <div className="border-t border-border/60 px-5 py-4">
            <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-3.5">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
                <FileText className="h-3.5 w-3.5" /> Dados da simulação
              </p>
              <p className="whitespace-pre-wrap text-sm text-foreground">{d.dados_simulacao}</p>
            </div>
          </div>
        )}
      </div>


      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Mensagens */}
        <PopOutPanel title={`Mensagens · ${d.numero}`} className="h-[32rem] lg:col-span-2">
          <Card className="flex h-full flex-col overflow-hidden border-border/60 shadow-sm">
            <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageCircle className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">Mensagens</p>
                <p className="truncate text-xs text-muted-foreground">
                  Conversa da demanda {d.numero}
                </p>
              </div>
            </div>

            <div className="chat-surface flex-1 space-y-1 overflow-y-auto p-4">
              {(data?.mensagens ?? []).length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MessageCircle className="size-7" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Nenhuma mensagem ainda</p>
                    <p className="text-xs text-muted-foreground">
                      Escreva a primeira mensagem desta demanda.
                    </p>
                  </div>
                </div>
              ) : (
                (data?.mensagens ?? []).map((m: any, i: number) => {
                  const meu = meuId != null && m.autor_id === meuId;
                  const lista = data?.mensagens ?? [];
                  const anterior = lista[i - 1];
                  const proxima = lista[i + 1];
                  const mostrarDia =
                    !anterior || fmtDia(anterior.created_at) !== fmtDia(m.created_at);
                  const mesmoAutorAntes = !mostrarDia && anterior?.autor_id === m.autor_id;
                  const mesmoAutorDepois =
                    proxima?.autor_id === m.autor_id &&
                    fmtDia(proxima?.created_at ?? "") === fmtDia(m.created_at);
                  return (
                    <div key={m.id}>
                      {mostrarDia && (
                        <div className="my-3 flex items-center justify-center">
                          <span className="rounded-full bg-background/80 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground shadow-sm ring-1 ring-border/50 backdrop-blur">
                            {fmtDia(m.created_at)}
                          </span>
                        </div>
                      )}
                      <div
                        className={cn(
                          "flex items-end gap-2",
                          meu ? "justify-end" : "justify-start",
                          mesmoAutorAntes ? "mt-0.5" : "mt-2",
                        )}
                      >
                        {!meu &&
                          (mesmoAutorDepois ? (
                            <span className="size-7 shrink-0" />
                          ) : (
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary/50 text-[10px] font-semibold text-primary-foreground shadow-sm">
                              {iniciaisChat(m.nome_autor)}
                            </span>
                          ))}
                        <div
                          className={cn(
                            "chat-bubble max-w-[80%] px-3.5 py-2 text-sm",
                            meu
                              ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
                              : "rounded-2xl rounded-bl-md border border-chat-them-border bg-chat-them text-chat-them-foreground",
                            mesmoAutorAntes && (meu ? "rounded-tr-md" : "rounded-tl-md"),
                          )}
                        >
                          {!mesmoAutorAntes && (
                            <div className="mb-0.5 flex items-center gap-2">
                              <span
                                className={cn(
                                  "text-[11px] font-semibold",
                                  meu ? "text-primary-foreground/90" : "text-primary",
                                )}
                              >
                                {meu ? "Você" : (m.nome_autor ?? "—")}
                              </span>
                              <ToneBadge tone={m.visivel_cliente ? "info" : "muted"}>
                                {m.visivel_cliente ? "Cliente" : "Interno"}
                              </ToneBadge>
                            </div>
                          )}
                          {m.corpo && (
                            <p className="whitespace-pre-wrap break-words leading-relaxed">
                              {m.corpo}
                            </p>
                          )}
                          {m.anexo_path && (
                            <button
                              type="button"
                              onClick={() => baixarAnexo(m.anexo_path, m.anexo_nome ?? "arquivo")}
                              className={cn(
                                "mt-1.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                                meu
                                  ? "bg-primary-foreground/15 hover:bg-primary-foreground/25"
                                  : "bg-muted hover:bg-muted/70",
                              )}
                            >
                              <Paperclip className="h-4 w-4 shrink-0" />
                              <span className="min-w-0 flex-1 truncate font-medium">
                                {m.anexo_nome ?? "arquivo"}
                              </span>
                              <Download className="h-3.5 w-3.5 shrink-0" />
                            </button>
                          )}
                          <p
                            className={cn(
                              "mt-1 text-right text-[10px]",
                              meu ? "text-primary-foreground/70" : "text-muted-foreground",
                            )}
                          >
                            {fmtHora(m.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>


            <div className="space-y-2.5 border-t border-border/60 bg-gradient-to-b from-muted/20 to-muted/40 p-3.5">
              {arquivoChat && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {arquivoChat.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setArquivoChat(null)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2 rounded-2xl border border-border/70 bg-background p-1.5 shadow-sm transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
                <input
                  ref={chatFileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setArquivoChat(f);
                    if (chatFileRef.current) chatFileRef.current.value = "";
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  onClick={() => chatFileRef.current?.click()}
                  title="Anexar arquivo"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Textarea
                  value={corpo}
                  onChange={(e) => setCorpo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviarMensagem();
                    }
                  }}
                  placeholder="Escreva uma mensagem…"
                  className="min-h-[40px] max-h-32 resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                />
                <Button
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-xl shadow-sm"
                  disabled={(!corpo.trim() && !arquivoChat) || enviandoMsg}
                  onClick={enviarMensagem}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </PopOutPanel>


        {/* Sidebar: Anexos + Histórico de auditoria */}
        <div className="space-y-6">
          {/* Anexos */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Paperclip className="h-4 w-4 text-muted-foreground" /> Anexos
                {(data?.anexos ?? []).length > 0 && (
                  <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                    {(data?.anexos ?? []).length}
                  </span>
                )}
              </h2>
              <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
              <Button
                variant="outline"
                size="sm"
                disabled={enviando}
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="mr-1 h-3.5 w-3.5" /> {enviando ? "Enviando…" : "Anexar"}
              </Button>
            </div>
            <div className="space-y-2 p-3">
              {(data?.anexos ?? []).length === 0 ? (
                <p className="px-1 py-4 text-center text-sm text-muted-foreground">
                  Nenhum anexo.
                </p>
              ) : (
                (data?.anexos ?? []).map((a: any) => (
                  <div
                    key={a.id}
                    className="group flex items-center gap-2.5 rounded-xl border border-border/60 bg-background p-2.5 text-sm transition-colors hover:border-primary/40"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{a.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.nome_autor ?? "—"}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => baixarAnexo(a.storage_path, a.nome)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={async () => {
                        await removerAnexoFn({ data: { id: a.id } });
                        invalidar();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Histórico (auditoria) */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <History className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Histórico</h2>
            </div>
            <div className="max-h-80 overflow-y-auto p-4">
              {(data?.historico ?? []).length === 0 ? (
                <p className="text-center text-xs text-muted-foreground">Sem registros.</p>
              ) : (
                <ol className="relative space-y-3 border-l border-border/60 pl-4">
                  {(data?.historico ?? []).map((h: any) => (
                    <li key={h.id} className="relative">
                      <span className="absolute -left-[21px] top-1 size-2 rounded-full bg-primary/60 ring-2 ring-card" />
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-medium text-foreground">
                          {h.nome_ator ?? "Sistema"}
                        </span>
                        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                          {fmtData(h.created_at)}
                        </span>
                      </div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {h.acao}
                      </p>
                      {h.acao === "transferida" && (
                        <p className="mt-0.5 text-xs">
                          <span className="text-muted-foreground line-through">
                            {h.nome_anterior ?? "—"}
                          </span>
                          {" → "}
                          <span className="text-primary">{h.nome_novo ?? "—"}</span>
                        </p>
                      )}
                      {h.motivo && (
                        <p className="mt-1 rounded-md bg-muted/60 px-2 py-1 text-xs text-foreground">
                          {h.motivo}
                        </p>
                      )}
                      {h.detalhe && h.acao !== "transferida" && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{h.detalhe}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>

      <VisualizadorArquivo
        arquivo={visualizando}
        open={!!visualizando}
        onOpenChange={(o: boolean) => !o && setVisualizando(null)}
      />
    </div>

  );
}
