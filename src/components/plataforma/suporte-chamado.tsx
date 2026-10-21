/**
 * Gaveta de um chamado do suporte da plataforma: contexto, atendimento (situação,
 * prioridade, assumir, encerrar) e a conversa com a conta.
 *
 * A conversa é lida por `comunicacao.fio_do_chamado` e atualizada a cada 20 s enquanto
 * a gaveta está aberta (sem tempo real). Quem decide o que cada um pode fazer é o banco.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCheck,
  CornerUpLeft,
  FileText,
  Loader2,
  Lock,
  Paperclip,
  Pencil,
  RefreshCw,
  Send,
  SmilePlus,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  PRIORIDADES_CHAMADO,
  STATUS_CHAMADO,
  editarMensagemChamado,
  enviarMensagemChamado,
  lerFioChamado,
  marcarChamadoLido,
  mudarChamado,
  reagirMensagemChamado,
  removerMensagemChamado,
  type AnexoMensagem,
  type Chamado,
  type MensagemChamado,
  type PrioridadeChamado,
  type StatusChamado,
} from "@/lib/plataforma/suporte.functions";
import { enviarAnexoSuporte } from "@/lib/plataforma/midias.functions";

export const STATUS_ROTULO: Record<StatusChamado, string> = {
  aberto: "Aberto",
  em_atendimento: "Em atendimento",
  aguardando_cliente: "Aguardando o cliente",
  resolvido: "Resolvido",
  fechado: "Fechado",
};
export const STATUS_TOM: Record<StatusChamado, "default" | "secondary" | "outline"> = {
  aberto: "default",
  em_atendimento: "secondary",
  aguardando_cliente: "outline",
  resolvido: "outline",
  fechado: "outline",
};
export const PRIORIDADE_ROTULO: Record<PrioridadeChamado, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};
export const CATEGORIA_ROTULO: Record<string, string> = {
  duvida: "Dúvida",
  erro: "Erro",
  financeiro: "Financeiro",
  sugestao: "Sugestão",
  integracao: "Integração",
  lgpd: "LGPD",
  outro: "Outro",
};
export const PERFIL_ROTULO: Record<string, string> = {
  corretor: "corretor",
  imobiliaria: "imobiliária",
  parceiro: "parceiro",
  cliente: "cliente",
  plataforma: "plataforma",
};

const EMOJIS = ["👍", "✅", "👀", "🙏", "❗"];

/** "20/10/2026 14:30" a partir de um instante ISO. */
export function dataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** "em 3 h", "há 2 dia(s)" — relativo ao relógio do navegador. */
export function relativo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const min = Math.round((t - Date.now()) / 60000);
  const abs = Math.abs(min);
  const txt =
    abs < 1
      ? "agora"
      : abs < 60
        ? `${abs} min`
        : abs < 1440
          ? `${Math.round(abs / 60)} h`
          : `${Math.round(abs / 1440)} dia(s)`;
  if (txt === "agora") return txt;
  return min > 0 ? `em ${txt}` : `há ${txt}`;
}

function tamanhoLegivel(bytes: number): string {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function novaChave(): string | null {
  try {
    return crypto.randomUUID();
  } catch {
    return null;
  }
}

export function GavetaChamado({
  chamado,
  podeAtender,
  onFechar,
}: {
  chamado: Chamado | null;
  podeAtender: boolean;
  onFechar: () => void;
}) {
  return (
    <Sheet open={!!chamado} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {chamado && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6 break-words">{chamado.assunto}</SheetTitle>
              <SheetDescription>
                {chamado.codigo} · {chamado.conta ?? "sem conta"} ·{" "}
                {CATEGORIA_ROTULO[chamado.categoria] ?? chamado.categoria}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <Contexto c={chamado} />
              {podeAtender && <Atendimento key={chamado.id + chamado.status} c={chamado} />}
              <Conversa c={chamado} podeAtender={podeAtender} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Contexto({ c }: { c: Chamado }) {
  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Badge variant={STATUS_TOM[c.status] ?? "secondary"}>
          {STATUS_ROTULO[c.status] ?? c.status}
        </Badge>
        <Badge variant={c.prioridade === "urgente" ? "destructive" : "outline"}>
          Prioridade {PRIORIDADE_ROTULO[c.prioridade]?.toLowerCase() ?? c.prioridade}
        </Badge>
        {c.atrasado && <Badge variant="destructive">Fora do SLA</Badge>}
        {c.avaliacao != null && <Badge variant="secondary">Nota {c.avaliacao} de 5</Badge>}
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Aberto por</dt>
          <dd className="break-words">
            {c.autor ?? "—"} ({PERFIL_ROTULO[c.perfil] ?? c.perfil})
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Responsável</dt>
          <dd>{c.responsavel ?? "ninguém ainda"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Recebido</dt>
          <dd>{dataHora(c.criado_em)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            {c.resolvido_em ? "Resolvido" : "Prazo (SLA do plano)"}
          </dt>
          <dd className={c.atrasado ? "font-medium text-destructive" : undefined}>
            {c.resolvido_em
              ? dataHora(c.resolvido_em)
              : c.sla_ate
                ? `${dataHora(c.sla_ate)} (${relativo(c.sla_ate)})`
                : "—"}
          </dd>
        </div>
      </dl>
      {c.descricao && (
        <p className="mt-3 whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-3 text-sm">
          {c.descricao}
        </p>
      )}
      {c.url && <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{c.url}</p>}
      {c.ultimo_erro && (
        <p className="mt-2 break-all rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 font-mono text-xs text-destructive">
          {c.ultimo_erro}
        </p>
      )}
    </section>
  );
}

function Atendimento({ c }: { c: Chamado }) {
  const qc = useQueryClient();
  const mudarFn = useServerFn(mudarChamado);
  const [status, setStatus] = useState<StatusChamado>(c.status);
  const [prioridade, setPrioridade] = useState<PrioridadeChamado>(c.prioridade);

  const mudar = useMutation({
    mutationFn: (dados: {
      status?: StatusChamado;
      prioridade?: PrioridadeChamado;
      assumir?: boolean;
      aviso: string;
    }) =>
      mudarFn({
        data: {
          id: c.id,
          status: dados.status ?? null,
          prioridade: dados.prioridade ?? null,
          assumir: dados.assumir,
        },
      }),
    onSuccess: (_r, dados) => {
      toast.success(dados.aviso);
      qc.invalidateQueries({ queryKey: ["plataforma-suporte"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível atualizar o chamado.")),
  });
  const encerrado = c.status === "resolvido" || c.status === "fechado";

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-3">
      <h3 className="text-sm font-semibold">Atendimento</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`sup-status-${c.id}`}>Situação</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusChamado)}>
            <SelectTrigger id={`sup-status-${c.id}`} aria-label="Situação do chamado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_CHAMADO.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_ROTULO[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`sup-prio-${c.id}`}>Prioridade</Label>
          <Select value={prioridade} onValueChange={(v) => setPrioridade(v as PrioridadeChamado)}>
            <SelectTrigger id={`sup-prio-${c.id}`} aria-label="Prioridade do chamado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORIDADES_CHAMADO.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORIDADE_ROTULO[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={mudar.isPending || (status === c.status && prioridade === c.prioridade)}
          onClick={() => mudar.mutate({ status, prioridade, aviso: "Chamado atualizado." })}
        >
          Salvar
        </Button>
        {!c.responsavel && (
          <Button
            size="sm"
            variant="outline"
            disabled={mudar.isPending}
            onClick={() => mudar.mutate({ assumir: true, aviso: "Você assumiu o chamado." })}
          >
            Assumir o chamado
          </Button>
        )}
        {!encerrado && (
          <Button
            size="sm"
            variant="outline"
            disabled={mudar.isPending}
            onClick={() =>
              mudar.mutate({ status: "resolvido", aviso: "Chamado marcado como resolvido." })
            }
          >
            Marcar como resolvido
          </Button>
        )}
        {c.status !== "fechado" && (
          <Button
            size="sm"
            variant="ghost"
            disabled={mudar.isPending}
            onClick={() => mudar.mutate({ status: "fechado", aviso: "Chamado encerrado." })}
          >
            Encerrar
          </Button>
        )}
      </div>
    </section>
  );
}

function Conversa({ c, podeAtender }: { c: Chamado; podeAtender: boolean }) {
  const qc = useQueryClient();
  const lerFn = useServerFn(lerFioChamado);
  const lidoFn = useServerFn(marcarChamadoLido);
  const enviarFn = useServerFn(enviarMensagemChamado);
  const [texto, setTexto] = useState("");
  const [interno, setInterno] = useState(false);
  const [respondendo, setRespondendo] = useState<MensagemChamado | null>(null);
  const [anexos, setAnexos] = useState<AnexoMensagem[]>([]);
  const [subindo, setSubindo] = useState(0);
  const seletor = useRef<HTMLInputElement | null>(null);
  const enviarAnexoFn = useServerFn(enviarAnexoSuporte);
  const chave = useRef<string | null>(novaChave());

  /** Sobe cada arquivo na hora da escolha, não no envio (como no Corretor). */
  const escolherArquivos = async (lista: FileList | null) => {
    if (!lista?.length) return;
    for (const arquivo of Array.from(lista).slice(0, 10 - anexos.length)) {
      if (arquivo.size > 25 * 1024 * 1024) {
        toast.error(`${arquivo.name} passa de 25 MB.`);
        continue;
      }
      setSubindo((n) => n + 1);
      try {
        const forma = new FormData();
        forma.append("arquivo", arquivo);
        forma.append("destino", "anexo_suporte");
        const r = await enviarAnexoFn({ data: forma });
        setAnexos((a) => [
          ...a,
          { id: r.id, nome: r.nome, tipo: r.tipo, tamanho: r.tamanho, url: r.url },
        ]);
      } catch (e) {
        toast.error(mensagemDeErro(e, "Não foi possível enviar o arquivo."));
      } finally {
        setSubindo((n) => n - 1);
      }
    }
    if (seletor.current) seletor.current.value = "";
  };
  const fim = useRef<HTMLDivElement | null>(null);

  const q = useQuery({
    queryKey: ["plataforma-suporte", "fio", c.id],
    queryFn: () => lerFn({ data: { id: c.id } }),
    refetchInterval: 20_000,
  });
  const mensagens = q.data?.mensagens ?? [];

  // Visto de leitura: ao abrir e quando chega mensagem nova. Só de quem atende: quem apenas
  // consulta a fila não pode fazer a conta achar que a equipe já leu. Falha aqui não
  // atrapalha a conversa (o visto volta na próxima mensagem).
  const qtd = mensagens.length;
  useEffect(() => {
    if (!qtd) return;
    if (podeAtender) lidoFn({ data: { id: c.id } }).catch(() => undefined);
    fim.current?.scrollIntoView({ block: "end" });
  }, [c.id, qtd, lidoFn, podeAtender]);

  const enviar = useMutation({
    mutationFn: () =>
      enviarFn({
        data: {
          chamadoId: c.id,
          corpo: texto,
          anexos: anexos.map(({ id, nome, tipo, tamanho }) => ({ id, nome, tipo, tamanho })),
          interno,
          respondeA: respondendo?.id ?? null,
          chave: chave.current,
        },
      }),
    onSuccess: () => {
      toast.success(interno ? "Nota interna registrada." : "Resposta enviada.");
      setTexto("");
      setAnexos([]);
      setRespondendo(null);
      chave.current = novaChave();
      qc.invalidateQueries({ queryKey: ["plataforma-suporte"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível enviar a mensagem.")),
  });

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border p-3">
        <h3 className="text-sm font-semibold">Conversa</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => q.refetch()}
          disabled={q.isFetching}
          aria-label="Atualizar conversa"
        >
          <RefreshCw className={`size-4 ${q.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="max-h-[55vh] space-y-3 overflow-y-auto p-3">
        {q.isLoading && <Skeleton className="h-24" />}
        {q.isError && (
          <p className="text-sm text-destructive">
            {mensagemDeErro(q.error, "Não foi possível carregar a conversa.")}
          </p>
        )}
        {!q.isLoading && !q.isError && mensagens.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma mensagem ainda. A descrição do chamado está acima.
          </p>
        )}
        {mensagens.map((m) => (
          <Mensagem
            key={m.id}
            m={m}
            chamadoId={c.id}
            podeAtender={podeAtender}
            onResponder={() => setRespondendo(m)}
          />
        ))}
        <div ref={fim} />
      </div>

      {podeAtender && (
        <div className="space-y-2 border-t border-border p-3">
          {respondendo && (
            <div className="flex items-start justify-between gap-2 rounded-md border-l-2 border-primary bg-muted/50 px-2 py-1 text-xs">
              <span className="min-w-0 break-words">
                Respondendo a <b>{respondendo.autor ?? "—"}</b>:{" "}
                {(respondendo.corpo ?? "anexo").slice(0, 140)}
              </span>
              <button
                type="button"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => setRespondendo(null)}
                aria-label="Cancelar resposta"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
          <Label htmlFor={`sup-msg-${c.id}`} className="sr-only">
            Mensagem
          </Label>
          <Textarea
            id={`sup-msg-${c.id}`}
            rows={3}
            placeholder={
              interno
                ? "Nota interna — só a equipe da plataforma vê"
                : `Responder para ${c.autor ?? "a conta"}`
            }
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && texto.trim()) enviar.mutate();
            }}
            className={interno ? "border-amber-400 bg-amber-50/60 dark:bg-amber-950/20" : ""}
          />
          {anexos.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Arquivos que vão na mensagem">
              {anexos.map((a) => (
                <li
                  key={a.id}
                  className="flex max-w-full items-center gap-1 rounded border border-border bg-muted/50 px-2 py-0.5 text-xs"
                >
                  <FileText className="size-3.5 shrink-0" />
                  <span className="min-w-0 truncate">{a.nome}</span>
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setAnexos((l) => l.filter((x) => x.id !== a.id))}
                    aria-label={`Tirar ${a.nome}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input
                ref={seletor}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,audio/*"
                className="sr-only"
                id={`sup-anexo-${c.id}`}
                onChange={(e) => void escolherArquivos(e.target.files)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={subindo > 0 || anexos.length >= 10}
                onClick={() => seletor.current?.click()}
                aria-label="Anexar arquivo"
              >
                {subindo > 0 ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Paperclip className="size-4" />
                )}
              </Button>
              <Switch
                id={`sup-interno-${c.id}`}
                checked={interno}
                onCheckedChange={setInterno}
                aria-label="Nota interna"
              />
              <Label htmlFor={`sup-interno-${c.id}`} className="text-xs font-normal">
                Nota interna (a conta não vê)
              </Label>
            </div>
            <Button
              size="sm"
              disabled={enviar.isPending || subindo > 0 || (!texto.trim() && anexos.length === 0)}
              onClick={() => enviar.mutate()}
            >
              <Send className="mr-1.5 size-4" /> {interno ? "Registrar nota" : "Enviar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Responder ao cliente muda a situação para “Aguardando o cliente” e, se o chamado não
            tiver responsável, atribui a você. Anexos: imagem, PDF ou áudio, até 25 MB cada.
          </p>
        </div>
      )}
    </section>
  );
}

function Mensagem({
  m,
  chamadoId,
  podeAtender,
  onResponder,
}: {
  m: MensagemChamado;
  chamadoId: string;
  podeAtender: boolean;
  onResponder: () => void;
}) {
  const qc = useQueryClient();
  const editarFn = useServerFn(editarMensagemChamado);
  const removerFn = useServerFn(removerMensagemChamado);
  const reagirFn = useServerFn(reagirMensagemChamado);
  const [editando, setEditando] = useState(false);
  const [corpo, setCorpo] = useState(m.corpo ?? "");
  const [emojis, setEmojis] = useState(false);
  const recarregar = () =>
    qc.invalidateQueries({ queryKey: ["plataforma-suporte", "fio", chamadoId] });

  const editar = useMutation({
    mutationFn: () => editarFn({ data: { id: m.id, corpo } }),
    onSuccess: () => {
      setEditando(false);
      recarregar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível editar.")),
  });
  const reagir = useMutation({
    mutationFn: (emoji: string) => reagirFn({ data: { id: m.id, emoji } }),
    onSuccess: () => {
      setEmojis(false);
      recarregar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível reagir.")),
  });

  const daEquipe = m.lado === "correspondente";
  const reacoes = Object.entries(m.reacoes ?? {}).filter(([, quem]) => quem.length > 0);

  return (
    <div className={`flex ${daEquipe ? "justify-end" : "justify-start"}`}>
      <div
        className={`w-full max-w-[92%] rounded-lg border px-3 py-2 text-sm sm:max-w-[80%] ${
          m.interno
            ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
            : daEquipe
              ? "border-primary/20 bg-primary/5"
              : "border-border bg-muted/40"
        }`}
      >
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{m.autor ?? "—"}</span>
          <span>{daEquipe ? "equipe" : "conta"}</span>
          {m.interno && (
            <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400">
              <Lock className="size-3" /> nota interna
            </span>
          )}
          <span>{m.criado_em}</span>
          {m.editado && !m.removido && <span>(editada)</span>}
          {m.meu && m.lida && (
            <span className="inline-flex items-center gap-0.5" title="Lida">
              <CheckCheck className="size-3.5 text-sky-600" aria-label="Lida" />
            </span>
          )}
        </div>

        {m.responde_a && (
          <p className="mb-1 break-words rounded border-l-2 border-primary/50 bg-background/60 px-2 py-0.5 text-xs text-muted-foreground">
            {m.responde_autor ?? "—"}: {m.responde_corpo ?? "anexo"}
          </p>
        )}

        {m.removido ? (
          <p className="italic text-muted-foreground">Mensagem removida.</p>
        ) : editando ? (
          <div className="space-y-2">
            <Label htmlFor={`sup-edit-${m.id}`} className="sr-only">
              Editar mensagem
            </Label>
            <Textarea
              id={`sup-edit-${m.id}`}
              rows={3}
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={editar.isPending || !corpo.trim()}
                onClick={() => editar.mutate()}
              >
                Salvar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditando(false);
                  setCorpo(m.corpo ?? "");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          m.corpo && <p className="whitespace-pre-wrap break-words">{m.corpo}</p>
        )}

        {!m.removido && m.anexos.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {m.anexos.map((a) => (
              <li key={a.id} className="space-y-1">
                {a.url && a.tipo.startsWith("image/") && (
                  <a href={a.url} target="_blank" rel="noreferrer" className="block">
                    <img
                      src={a.url}
                      alt={a.nome}
                      loading="lazy"
                      className="max-h-48 max-w-full rounded border border-border object-contain"
                    />
                  </a>
                )}
                {a.url && (m.tipo === "audio" || a.tipo.startsWith("audio/")) && (
                  <audio controls preload="none" src={a.url} className="w-full max-w-xs">
                    Seu navegador não toca este áudio.
                  </audio>
                )}
                <div
                  className="flex min-w-0 items-center gap-1.5 rounded border border-border bg-background/70 px-2 py-1 text-xs"
                  title={a.url ? undefined : "Arquivo indisponível no momento."}
                >
                  <FileText className="size-3.5 shrink-0" />
                  {a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate text-primary underline-offset-2 hover:underline"
                    >
                      {m.tipo === "audio" ? "Recado de voz" : a.nome}
                    </a>
                  ) : (
                    <span className="min-w-0 flex-1 truncate">
                      {m.tipo === "audio" ? "Recado de voz" : a.nome}
                    </span>
                  )}
                  <span className="shrink-0 text-muted-foreground">
                    {m.tipo === "audio" && m.duracao_ms
                      ? `${Math.round(m.duracao_ms / 1000)} s`
                      : tamanhoLegivel(a.tamanho)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {reacoes.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {reacoes.map(([emoji, quem]) => (
              <button
                key={emoji}
                type="button"
                disabled={!podeAtender || reagir.isPending}
                onClick={() => reagir.mutate(emoji)}
                className="rounded-full border border-border bg-background px-1.5 text-xs disabled:cursor-default"
                aria-label={`Reação ${emoji}: ${quem.length}`}
              >
                {emoji} {quem.length}
              </button>
            ))}
          </div>
        )}

        {podeAtender && !m.removido && !editando && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onResponder}>
              <CornerUpLeft className="mr-1 size-3.5" /> Responder
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setEmojis((v) => !v)}
              aria-label="Reagir"
            >
              <SmilePlus className="size-3.5" />
            </Button>
            {emojis &&
              EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="rounded px-1 text-base hover:bg-muted"
                  disabled={reagir.isPending}
                  onClick={() => reagir.mutate(e)}
                  aria-label={`Reagir com ${e}`}
                >
                  {e}
                </button>
              ))}
            {m.meu && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setEditando(true)}
                  aria-label="Editar mensagem"
                >
                  <Pencil className="size-3.5" />
                </Button>
                <ConfirmDelete
                  titulo="Remover mensagem?"
                  descricao="O conteúdo sai da conversa; fica o registro de que houve uma mensagem removida."
                  confirmarLabel="Remover"
                  trigger={
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-destructive"
                      aria-label="Remover mensagem"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  }
                  onConfirm={async () => {
                    try {
                      await removerFn({ data: { id: m.id } });
                      recarregar();
                    } catch (e) {
                      toast.error(mensagemDeErro(e, "Não foi possível remover."));
                      throw e;
                    }
                  }}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
