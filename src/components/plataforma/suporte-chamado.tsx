/**
 * Um chamado da Central de atendimento aos assinantes: cabeçalho, contexto com o prazo,
 * atendimento (situação, prioridade, atendente) e a conversa com a conta (anexos pela ponte
 * de mídias, notas internas, respostas, reações).
 *
 * `PainelChamado` é o espaço de trabalho (coluna da direita no monitor); no celular ele abre
 * dentro de `GavetaChamado`. A conversa é lida por `comunicacao.fio_do_chamado` e atualizada a
 * cada 20 s enquanto o chamado está aberto. Quem decide o que cada um pode fazer é o banco.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlarmClock,
  CheckCheck,
  CheckCircle2,
  CornerUpLeft,
  FileText,
  Hand,
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { Dado, Selo, type Tom } from "@/components/plataforma/kit";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { cn } from "@/lib/utils";
import {
  PRIORIDADES_CHAMADO,
  atribuirChamado,
  editarMensagemChamado,
  enviarMensagemChamado,
  lerFioChamado,
  listarAtendentes,
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

/** Situações como o dono pediu: novo, em atendimento, aguardando assinante, resolvido. */
export const STATUS_ROTULO: Record<StatusChamado, string> = {
  aberto: "Novo",
  em_atendimento: "Em atendimento",
  aguardando_cliente: "Aguardando assinante",
  resolvido: "Resolvido",
  fechado: "Encerrado",
};
export const STATUS_TOM: Record<StatusChamado, Tom> = {
  aberto: "marca",
  em_atendimento: "info",
  aguardando_cliente: "alerta",
  resolvido: "sucesso",
  fechado: "neutro",
};
export const PRIORIDADE_ROTULO: Record<PrioridadeChamado, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};
export const PRIORIDADE_TOM: Record<PrioridadeChamado, Tom> = {
  baixa: "neutro",
  normal: "neutro",
  alta: "alerta",
  urgente: "perigo",
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
const NINGUEM = "__fila__";

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

/** Prazo do chamado em uma frase e um tom (para a fila e o cabeçalho). */
export function prazoDoChamado(c: Chamado, agora = Date.now()): { texto: string; tom: Tom } {
  if (c.resolvido_em) return { texto: `Resolvido ${relativo(c.resolvido_em)}`, tom: "sucesso" };
  if (!c.sla_ate) return { texto: "Sem prazo", tom: "neutro" };
  if (c.atrasado) return { texto: `Prazo venceu ${relativo(c.sla_ate)}`, tom: "perigo" };
  const faltaMin = (new Date(c.sla_ate).getTime() - agora) / 60000;
  return { texto: `Prazo ${relativo(c.sla_ate)}`, tom: faltaMin < 120 ? "alerta" : "neutro" };
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

/** O chamado no celular: o mesmo painel dentro de uma gaveta. */
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
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="sr-only">
          <SheetTitle>{chamado?.assunto ?? "Chamado"}</SheetTitle>
          <SheetDescription>Conversa e atendimento do chamado</SheetDescription>
        </SheetHeader>
        {chamado && <PainelChamado chamado={chamado} podeAtender={podeAtender} />}
      </SheetContent>
    </Sheet>
  );
}

/** Espaço de trabalho de um chamado. */
export function PainelChamado({ chamado: c, podeAtender }: { chamado: Chamado; podeAtender: boolean }) {
  const prazo = prazoDoChamado(c);
  return (
    <div className="flex min-w-0 flex-col">
      <header className="space-y-2 border-b border-border/70 px-4 py-3.5 pr-12 sm:pr-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">{c.codigo}</span>
          <Selo tom={STATUS_TOM[c.status]} ponto={c.status === "em_atendimento"}>
            {STATUS_ROTULO[c.status] ?? c.status}
          </Selo>
          <Selo tom={PRIORIDADE_TOM[c.prioridade]}>{PRIORIDADE_ROTULO[c.prioridade] ?? c.prioridade}</Selo>
          <Selo tom={prazo.tom}>
            <AlarmClock className="mr-0.5 inline size-3" /> {prazo.texto}
          </Selo>
        </div>
        <h2 className="break-words text-base font-semibold leading-snug text-foreground">{c.assunto}</h2>
        <p className="text-xs text-muted-foreground">
          {c.conta ?? "Sem conta"} · {c.autor ?? "—"} ({PERFIL_ROTULO[c.perfil] ?? c.perfil}) ·{" "}
          {CATEGORIA_ROTULO[c.categoria] ?? c.categoria}
        </p>
      </header>
      <div className="space-y-4 p-4">
        <Contexto c={c} />
        {podeAtender && <Atendimento key={c.id + c.status + c.prioridade + (c.atribuido_a ?? "")} c={c} />}
        <Conversa c={c} podeAtender={podeAtender} />
      </div>
    </div>
  );
}

function Contexto({ c }: { c: Chamado }) {
  const primeira = c.primeira_resposta_em
    ? Math.round((new Date(c.primeira_resposta_em).getTime() - new Date(c.criado_em).getTime()) / 60000)
    : null;
  return (
    <section className="space-y-3 rounded-xl border border-border/80 p-3.5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dado rotulo="Recebido">{dataHora(c.criado_em)}</Dado>
        <Dado rotulo={c.resolvido_em ? "Resolvido" : "Prazo do plano"}>
          <span className={c.atrasado ? "font-medium text-destructive" : undefined}>
            {c.resolvido_em ? dataHora(c.resolvido_em) : c.sla_ate ? dataHora(c.sla_ate) : "—"}
          </span>
        </Dado>
        <Dado rotulo="1ª resposta">
          {primeira == null ? (
            <span className="text-muted-foreground">ainda não</span>
          ) : primeira < 60 ? (
            `${Math.max(0, primeira)} min`
          ) : (
            `${Math.round(primeira / 60)} h`
          )}
        </Dado>
        <Dado rotulo="Responsável">{c.responsavel ?? <span className="text-muted-foreground">na fila</span>}</Dado>
      </dl>
      {c.descricao && (
        <p className="whitespace-pre-wrap break-words rounded-lg bg-secondary/50 p-3 text-sm">{c.descricao}</p>
      )}
      {c.url && <p className="break-all font-mono text-[11px] text-muted-foreground">{c.url}</p>}
      {c.ultimo_erro && (
        <p className="break-all rounded-lg border border-destructive/25 bg-destructive/[0.05] px-2.5 py-1.5 font-mono text-[11px] text-destructive">
          {c.ultimo_erro}
        </p>
      )}
      {c.avaliacao != null && <Selo tom="info">Avaliação da conta: {c.avaliacao} de 5</Selo>}
    </section>
  );
}

function Atendimento({ c }: { c: Chamado }) {
  const qc = useQueryClient();
  const mudarFn = useServerFn(mudarChamado);
  const atribuirFn = useServerFn(atribuirChamado);
  const atendentesFn = useServerFn(listarAtendentes);
  const atendentes = useQuery({
    queryKey: ["plataforma-suporte", "atendentes"],
    queryFn: () => atendentesFn(),
    staleTime: 60_000,
  });
  const recarregar = () => qc.invalidateQueries({ queryKey: ["plataforma-suporte"] });

  const mudar = useMutation({
    mutationFn: (dados: { status?: StatusChamado; prioridade?: PrioridadeChamado; aviso: string }) =>
      mudarFn({ data: { id: c.id, status: dados.status ?? null, prioridade: dados.prioridade ?? null } }),
    onSuccess: (_r, dados) => {
      toast.success(dados.aviso);
      recarregar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível atualizar o chamado.")),
  });
  const atribuir = useMutation({
    mutationFn: (atendente: string | null) => atribuirFn({ data: { id: c.id, atendente } }),
    onSuccess: (_r, atendente) => {
      toast.success(atendente ? "Chamado atribuído." : "Chamado devolvido à fila.");
      recarregar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível atribuir o chamado.")),
  });
  const eu = atendentes.data?.find((a) => a.eu);
  const encerrado = c.status === "resolvido" || c.status === "fechado";
  const ocupado = mudar.isPending || atribuir.isPending;

  return (
    <section className="space-y-3 rounded-xl border border-border/80 p-3.5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)]">
        <div className="space-y-1">
          <Label htmlFor={`sup-atend-${c.id}`} className="text-xs text-muted-foreground">
            Atendente
          </Label>
          <div className="flex gap-2">
            <Select
              value={c.atribuido_a ?? NINGUEM}
              onValueChange={(v) => atribuir.mutate(v === NINGUEM ? null : v)}
              disabled={ocupado}
            >
              <SelectTrigger id={`sup-atend-${c.id}`} aria-label="Atendente do chamado" className="min-w-0 flex-1">
                <SelectValue placeholder="Na fila" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NINGUEM}>Na fila (sem atendente)</SelectItem>
                {c.atribuido_a && !(atendentes.data ?? []).some((a) => a.id === c.atribuido_a) && (
                  <SelectItem value={c.atribuido_a}>{c.responsavel ?? "Responsável atual"}</SelectItem>
                )}
                {(atendentes.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome}
                    {a.eu ? " (você)" : ""} · {a.abertos} aberto(s)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {eu && c.atribuido_a !== eu.id && (
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 shrink-0 sm:min-h-9"
                disabled={ocupado}
                onClick={() => atribuir.mutate(eu.id)}
              >
                <Hand className="mr-1.5 size-4" /> Assumir
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`sup-prio-${c.id}`} className="text-xs text-muted-foreground">
            Prioridade
          </Label>
          <Select
            value={c.prioridade}
            onValueChange={(v) =>
              mudar.mutate({
                prioridade: v as PrioridadeChamado,
                aviso: `Prioridade ${PRIORIDADE_ROTULO[v as PrioridadeChamado].toLowerCase()}.`,
              })
            }
            disabled={ocupado}
          >
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
      <div>
        <p className="mb-1.5 text-xs text-muted-foreground">Situação</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Situação do chamado">
          {(["aberto", "em_atendimento", "aguardando_cliente", "resolvido"] as StatusChamado[]).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={c.status === s}
              disabled={ocupado || c.status === s}
              onClick={() => mudar.mutate({ status: s, aviso: `Situação: ${STATUS_ROTULO[s].toLowerCase()}.` })}
              className={cn(
                "min-h-11 rounded-full border px-3 text-sm transition-colors sm:min-h-8",
                c.status === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-secondary/60 disabled:opacity-60",
              )}
            >
              {STATUS_ROTULO[s]}
            </button>
          ))}
        </div>
      </div>
      {!encerrado && (
        <div className="flex flex-wrap gap-2 border-t border-border/70 pt-3">
          <Button
            size="sm"
            className="min-h-11 sm:min-h-9"
            disabled={ocupado}
            onClick={() => mudar.mutate({ status: "resolvido", aviso: "Chamado resolvido." })}
          >
            <CheckCircle2 className="mr-1.5 size-4" /> Marcar como resolvido
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="min-h-11 sm:min-h-9"
            disabled={ocupado}
            onClick={() => mudar.mutate({ status: "fechado", aviso: "Chamado encerrado." })}
          >
            Encerrar sem resolver
          </Button>
        </div>
      )}
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
    <section className="rounded-xl border border-border/80 bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3.5 py-2.5">
        <h3 className="text-sm font-semibold">Conversa com a conta</h3>
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
            Nenhuma mensagem ainda. O pedido da conta está acima.
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
            Responder à conta muda a situação para “Aguardando assinante” e, se o chamado estiver
            na fila, atribui a você. Anexos: imagem, PDF ou áudio, até 25 MB cada. Ctrl+Enter envia.
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
          <span>{dataHora(m.criado_em)}</span>
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
