import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Heart,
  Link2,
  Loader2,
  MessageCircle,
  Plus,
  RotateCcw,
  Send,
  Share2,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { CONECTORES, REDES, type Conector } from "@/lib/social/catalogo";
import {
  cancelarPostAgz,
  carregarPostAgz,
  linkConectarRedeAgz,
  listarRedesAgz,
  postsDoPeriodoAgz,
  relatorioAgz,
  removerRedeAgz,
  repetirFalhasAgz,
  type PostDetalhe,
  type PostResumo,
  type RedeConectada,
  type StatusPost,
} from "@/lib/social/automacoes.functions";
import { cn } from "@/lib/utils";
import { CompositorAgz } from "./compositor";
import { MarcaRede } from "./marca-rede";

type Tom =
  "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "soft";

const STATUS_POST: Record<StatusPost, { rotulo: string; tom: Tom; ponto: string }> = {
  rascunho: { rotulo: "Rascunho", tom: "outline", ponto: "bg-muted-foreground/50" },
  aguardando_aprovacao: { rotulo: "Aguardando aprovação", tom: "warning", ponto: "bg-warning" },
  agendado: { rotulo: "Agendado", tom: "soft", ponto: "bg-primary" },
  publicando: { rotulo: "Publicando", tom: "info", ponto: "bg-sky-500" },
  publicado: { rotulo: "Publicado", tom: "success", ponto: "bg-success" },
  parcial: { rotulo: "Publicado em parte", tom: "warning", ponto: "bg-warning" },
  falhou: { rotulo: "Falhou", tom: "destructive", ponto: "bg-destructive" },
  cancelado: { rotulo: "Cancelado", tom: "outline", ponto: "bg-muted-foreground/30" },
};

const STATUS_DESTINO: Record<string, { rotulo: string; tom: Tom }> = {
  pendente: { rotulo: "Na fila", tom: "soft" },
  publicando: { rotulo: "Publicando", tom: "info" },
  publicado: { rotulo: "Publicado", tom: "success" },
  falhou: { rotulo: "Falhou", tom: "destructive" },
  cancelado: { rotulo: "Cancelado", tom: "outline" },
};

const ERROS_LOGIN: Record<string, string> = {
  sessao: "O login da rede expirou. Tente de novo.",
  recusado: "A permissão foi negada na rede. Para conectar, aceite todas as permissões pedidas.",
  indisponivel: "Esta rede ainda não está liberada para conexão.",
  sem_contas:
    "O login não trouxe nenhuma conta que possa publicar (no Instagram, use conta profissional ligada a uma Página).",
  falhou: "Não foi possível concluir a conexão com a rede. Tente de novo em instantes.",
};

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const inicioDoMes = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const num = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("pt-BR");

function dataHora(iso: string | null): string {
  if (!iso) return "Sem data";
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function copiar(texto: string) {
  void navigator.clipboard.writeText(texto).then(
    () => toast.success("Link copiado."),
    () => toast.error("Não foi possível copiar."),
  );
}

/**
 * Automações › painel do Agilliza: a AgillizaTech agenda e publica nas próprias redes.
 * Calendário do mês, resultados, redes conectadas e o detalhe de cada post.
 */
export function PainelAutomacoes({
  conectores,
  corretorUrl,
  podeEditar,
  retorno,
  aoLimparRetorno,
}: {
  conectores: Conector[];
  corretorUrl: string;
  podeEditar: boolean;
  retorno: { conectadas?: string; erro?: string };
  aoLimparRetorno: () => void;
}) {
  const [aba, setAba] = useState<"calendario" | "resultados" | "redes">(
    retorno.conectadas || retorno.erro ? "redes" : "calendario",
  );
  const [mes, setMes] = useState(() => inicioDoMes(new Date()));
  const [diaSel, setDiaSel] = useState<string>(() => chaveDia(new Date()));
  const [compositor, setCompositor] = useState<{ aberto: boolean; post: PostDetalhe | null }>({
    aberto: false,
    post: null,
  });
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const redesFn = useServerFn(listarRedesAgz);
  const postsFn = useServerFn(postsDoPeriodoAgz);
  const qc = useQueryClient();

  const redes = useQuery({ queryKey: ["agz-social-redes"], queryFn: () => redesFn() });
  const periodo = useMemo(() => {
    const de = new Date(mes.getFullYear(), mes.getMonth(), -6);
    const ate = new Date(mes.getFullYear(), mes.getMonth() + 1, 7);
    return { de: de.toISOString(), ate: ate.toISOString() };
  }, [mes]);
  // A publicação acontece no servidor: a tela confere de 20 em 20 segundos.
  const posts = useQuery({
    queryKey: ["agz-social-posts", periodo.de],
    queryFn: () => postsFn({ data: periodo }),
    refetchInterval: 20_000,
  });

  // Volta do login da rede: avisa uma vez e limpa o endereço.
  useEffect(() => {
    if (!retorno.conectadas && !retorno.erro) return;
    if (retorno.erro) toast.error(ERROS_LOGIN[retorno.erro] ?? ERROS_LOGIN.falhou);
    else toast.success(`${retorno.conectadas} conta(s) conectada(s).`);
    aoLimparRetorno();
  }, [retorno.conectadas, retorno.erro, aoLimparRetorno]);

  const lista = useMemo(() => posts.data ?? [], [posts.data]);
  const semData = lista.filter((p) => !p.agendado_para);
  const porDia = useMemo(() => {
    const m = new Map<string, PostResumo[]>();
    for (const p of lista) {
      if (!p.agendado_para) continue;
      const k = chaveDia(new Date(p.agendado_para));
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    for (const v of m.values()) v.sort((a, b) => a.agendado_para!.localeCompare(b.agendado_para!));
    return m;
  }, [lista]);

  const dias = useMemo(() => {
    const inicio = new Date(mes);
    inicio.setDate(1 - mes.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      return d;
    });
  }, [mes]);
  const hoje = chaveDia(new Date());
  const doDia = porDia.get(diaSel) ?? [];
  const contas = redes.data ?? [];

  const atualizar = () => {
    void qc.invalidateQueries({ queryKey: ["agz-social-posts"] });
    void qc.invalidateQueries({ queryKey: ["agz-social-redes"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Automações"
          className="flex w-full gap-1 rounded-lg border bg-muted/40 p-1 sm:w-auto"
        >
          {(
            [
              ["calendario", "Calendário", CalendarDays],
              ["resultados", "Resultados", BarChart3],
              ["redes", `Redes${contas.length ? ` (${contas.length})` : ""}`, Share2],
            ] as const
          ).map(([id, rotulo, Icone]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={aba === id}
              onClick={() => setAba(id)}
              className={cn(
                "flex h-11 flex-1 items-center sm:h-9 justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-sm sm:px-3 font-medium text-muted-foreground transition-colors sm:flex-none",
                aba === id && "bg-background text-foreground shadow-xs",
              )}
            >
              <Icone className="hidden h-4 w-4 sm:block" /> {rotulo}
            </button>
          ))}
        </div>
        {podeEditar && (
          <Button
            className="w-full sm:w-auto"
            onClick={() => setCompositor({ aberto: true, post: null })}
          >
            <Plus className="h-4 w-4" /> Novo post
          </Button>
        )}
      </div>

      {aba === "calendario" && (
        <section
          aria-label="Calendário de posts"
          className="rounded-xl border bg-card p-3 shadow-sm sm:p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Mês anterior"
              className="size-11 sm:size-9"
              onClick={() => setMes((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-base font-semibold">
              {maiuscula(mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }))}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Próximo mês"
              className="size-11 sm:size-9"
              onClick={() => setMes((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 overflow-hidden rounded-lg border bg-border gap-px">
            {DIAS.map((d) => (
              <div
                key={d}
                className="bg-muted/50 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {d}
              </div>
            ))}
            {dias.map((d) => {
              const k = chaveDia(d);
              const doCal = porDia.get(k) ?? [];
              const fora = d.getMonth() !== mes.getMonth();
              return (
                <div
                  key={k}
                  role="button"
                  tabIndex={0}
                  aria-label={`${d.toLocaleDateString("pt-BR")}: ${doCal.length} post(s)`}
                  aria-pressed={diaSel === k}
                  onClick={() => setDiaSel(k)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setDiaSel(k)}
                  className={cn(
                    "min-h-14 cursor-pointer bg-card p-1 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring sm:min-h-24 sm:p-1.5",
                    fora && "bg-muted/20 text-muted-foreground/60",
                    diaSel === k && "ring-2 ring-inset ring-primary",
                  )}
                >
                  <span
                    className={cn(
                      "inline-grid h-6 w-6 place-items-center rounded-full text-xs tabular-nums",
                      k === hoje && "bg-primary font-semibold text-primary-foreground",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {/* Celular: pontinhos por status. Tela grande: hora + redes + legenda. */}
                  <div className="mt-0.5 flex flex-wrap gap-0.5 sm:hidden">
                    {doCal.slice(0, 4).map((p) => (
                      <span
                        key={p.id}
                        className={cn("h-1.5 w-1.5 rounded-full", STATUS_POST[p.status].ponto)}
                      />
                    ))}
                  </div>
                  <div className="mt-1 hidden space-y-1 sm:block">
                    {doCal.slice(0, 3).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetalheId(p.id);
                        }}
                        className="flex w-full items-center gap-1 rounded-md border bg-background px-1.5 py-1 text-left text-[11px] hover:border-primary"
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            STATUS_POST[p.status].ponto,
                          )}
                        />
                        <span className="tabular-nums text-muted-foreground">
                          {hora(p.agendado_para!)}
                        </span>
                        <span className="hidden shrink-0 gap-0.5 lg:flex">
                          {p.destinos.slice(0, 3).map((x) => (
                            <MarcaRede key={x.id} rede={x.rede} className="h-3 w-3" />
                          ))}
                        </span>
                        <span className="min-w-0 truncate">{p.legenda || "Sem legenda"}</span>
                      </button>
                    ))}
                    {doCal.length > 3 && (
                      <span className="block text-[11px] text-muted-foreground">
                        +{doCal.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">
              {(() => {
                const [a, m, dd] = diaSel.split("-").map(Number);
                return maiuscula(
                  new Date(a!, m!, dd!).toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                  }),
                );
              })()}
            </p>
            {posts.isLoading ? (
              <Skeleton className="h-14 w-full" />
            ) : doDia.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Nenhum post neste dia.
              </p>
            ) : (
              <ul className="space-y-2">
                {doDia.map((p) => (
                  <LinhaPost key={p.id} post={p} aoAbrir={() => setDetalheId(p.id)} />
                ))}
              </ul>
            )}
          </div>

          {semData.length > 0 && (
            <div className="mt-4 space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Rascunhos sem data</p>
              <ul className="space-y-2">
                {semData.map((p) => (
                  <LinhaPost key={p.id} post={p} aoAbrir={() => setDetalheId(p.id)} />
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {aba === "resultados" && <Resultados />}

      {aba === "redes" && (
        <Redes
          redes={contas}
          carregando={redes.isLoading}
          conectores={conectores}
          podeEditar={podeEditar}
          aoMudar={atualizar}
        />
      )}

      {compositor.aberto && (
        <CompositorAgz
          aberto
          redes={contas}
          post={compositor.post}
          aoFechar={() => setCompositor({ aberto: false, post: null })}
          aoSalvar={(id) => {
            setCompositor({ aberto: false, post: null });
            atualizar();
            setDetalheId(id);
          }}
        />
      )}

      {detalheId && (
        <DetalhePost
          id={detalheId}
          corretorUrl={corretorUrl}
          podeEditar={podeEditar}
          aoFechar={() => setDetalheId(null)}
          aoEditar={(post) => {
            setDetalheId(null);
            setCompositor({ aberto: true, post });
          }}
          aoMudar={atualizar}
        />
      )}
    </div>
  );
}

function LinhaPost({ post, aoAbrir }: { post: PostResumo; aoAbrir: () => void }) {
  const st = STATUS_POST[post.status];
  return (
    <li>
      <button
        type="button"
        onClick={aoAbrir}
        className="flex min-h-12 w-full items-center gap-3 rounded-lg border bg-background px-3 py-2 text-left hover:border-primary"
      >
        {post.agendado_para && (
          <span className="w-11 shrink-0 text-sm font-medium tabular-nums">
            {hora(post.agendado_para)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{post.legenda || "Sem legenda"}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1">
            {post.destinos.map((x) => (
              <MarcaRede key={x.id} rede={x.rede} className="h-3.5 w-3.5" />
            ))}
            {/* Celular: o status vai para a linha de baixo, a legenda fica com a largura toda. */}
            <Badge variant={st.tom} className="ml-1 sm:hidden">
              {st.rotulo}
            </Badge>
          </span>
        </span>
        <Badge variant={st.tom} className="hidden shrink-0 sm:inline-flex">
          {st.rotulo}
        </Badge>
      </button>
    </li>
  );
}

function Redes({
  redes,
  carregando,
  conectores,
  podeEditar,
  aoMudar,
}: {
  redes: RedeConectada[];
  carregando: boolean;
  conectores: Conector[];
  podeEditar: boolean;
  aoMudar: () => void;
}) {
  const removerFn = useServerFn(removerRedeAgz);
  const linkFn = useServerFn(linkConectarRedeAgz);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const disponiveis = CONECTORES.filter((c) => conectores.includes(c.id));
  const futuras = CONECTORES.filter((c) => !conectores.includes(c.id) && c.id !== "teste");

  async function remover(r: RedeConectada) {
    if (
      !window.confirm(
        `Desconectar ${r.nome} (${REDES[r.rede].rotulo})? Os posts agendados para ela serão cancelados.`,
      )
    )
      return;
    setOcupado(r.id);
    try {
      await removerFn({ data: { id: r.id } });
      toast.success("Rede desconectada.");
      aoMudar();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível desconectar."));
    } finally {
      setOcupado(null);
    }
  }

  async function conectar(c: Conector) {
    setOcupado(c);
    try {
      const { url } = await linkFn({ data: { conector: c } });
      window.location.href = url;
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível abrir a conexão com a rede."));
      setOcupado(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">Contas conectadas</h2>
        {carregando ? (
          <Skeleton className="mt-3 h-14 w-full" />
        ) : redes.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nenhuma rede conectada. Conecte as redes da AgillizaTech para publicar e agendar.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {redes.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted/60">
                  <MarcaRede rede={r.rede} />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm font-medium">{r.nome}</b>
                  <small className="block truncate text-xs text-muted-foreground">
                    {REDES[r.rede].rotulo}
                    {r.usuario ? ` · ${r.usuario}` : ""}
                  </small>
                </span>
                {r.status === "ativa" ? (
                  <Badge variant="success" className="shrink-0">
                    Conectada
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="shrink-0">
                    {r.status === "expirada"
                      ? "Reconecte"
                      : r.status === "revogada"
                        ? "Desconectada"
                        : "Com erro"}
                  </Badge>
                )}
                {podeEditar && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Desconectar ${r.nome}`}
                    className="size-11 shrink-0 sm:size-9"
                    disabled={ocupado === r.id}
                    onClick={() => void remover(r)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">Conectar uma rede</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A conexão é feita no site oficial de cada rede. A AgillizaTech não pede nem guarda a
          senha.
        </p>
        <ul className="mt-3 space-y-2">
          {disponiveis.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={!podeEditar || ocupado !== null}
                onClick={() => void conectar(c.id)}
                className="flex min-h-14 w-full items-center gap-3 rounded-lg border bg-background px-3 py-2 text-left hover:border-primary disabled:opacity-60"
              >
                <span className="flex shrink-0 gap-1">
                  {c.redes.map((r) => (
                    <MarcaRede key={r} rede={r} className="h-6 w-6" />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-sm font-medium">{c.rotulo}</b>
                  <small className="block text-xs text-muted-foreground">{c.descricao}</small>
                </span>
                {ocupado === c.id && <Loader2 className="h-4 w-4 animate-spin" />}
              </button>
            </li>
          ))}
          {futuras.map((c) => (
            <li key={c.id}>
              <div
                aria-disabled
                className="flex min-h-14 items-center gap-3 rounded-lg border border-dashed px-3 py-2 opacity-60"
              >
                <span className="flex shrink-0 gap-1">
                  {c.redes.map((r) => (
                    <MarcaRede key={r} rede={r} className="h-6 w-6" />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-sm font-medium">{c.rotulo}</b>
                  <small className="block text-xs text-muted-foreground">
                    Em liberação junto à rede
                  </small>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const PERIODOS = [7, 30, 90] as const;

/** Resultados do período: dados oficiais de cada rede e os cliques e leads dos links rastreados. */
function Resultados() {
  const relFn = useServerFn(relatorioAgz);
  const [dias, setDias] = useState<number>(30);
  const rel = useQuery({
    queryKey: ["agz-social-relatorio", dias],
    queryFn: () => {
      const ate = new Date();
      const de = new Date(ate.getTime() - dias * 86_400_000);
      return relFn({ data: { de: de.toISOString(), ate: ate.toISOString() } });
    },
  });
  const t = rel.data?.totais;
  const cards = [
    { rotulo: "Posts publicados", valor: t?.publicados, Icone: Send },
    { rotulo: "Alcance", valor: t?.alcance, Icone: Eye },
    { rotulo: "Curtidas", valor: t?.curtidas, Icone: Heart },
    { rotulo: "Comentários", valor: t?.comentarios, Icone: MessageCircle },
    { rotulo: "Cliques nos links", valor: t?.cliques, Icone: Link2 },
    { rotulo: "Leads", valor: t?.leads, Icone: UserPlus },
  ];

  return (
    <section aria-label="Resultados das redes" className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Resultados</h2>
        <div
          role="tablist"
          aria-label="Período"
          className="flex gap-1 rounded-lg border bg-muted/40 p-1"
        >
          {PERIODOS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={dias === p}
              onClick={() => setDias(p)}
              className={cn(
                "h-11 rounded-md px-3 text-sm text-muted-foreground sm:h-8",
                dias === p && "bg-background font-medium text-foreground shadow-xs",
              )}
            >
              {p} dias
            </button>
          ))}
        </div>
      </div>

      {rel.isError ? (
        <p className="mt-3 text-sm text-destructive">
          {mensagemDeErro(rel.error, "Não foi possível carregar os resultados.")}
        </p>
      ) : (
        <>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {cards.map(({ rotulo, valor, Icone }) => (
              <li key={rotulo} className="rounded-lg border bg-background p-3">
                <Icone className="h-4 w-4 text-muted-foreground" />
                <span className="mt-2 block text-xl font-semibold tabular-nums">
                  {rel.isLoading ? "…" : num(valor)}
                </span>
                <span className="block text-xs text-muted-foreground">{rotulo}</span>
              </li>
            ))}
          </ul>

          {rel.data && rel.data.por_rede.length > 0 && (
            <ul className="mt-4 space-y-2 sm:hidden" aria-label="Por rede">
              {rel.data.por_rede.map((r) => (
                <li key={r.rede} className="rounded-lg border bg-background p-3">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <MarcaRede rede={r.rede} className="h-4 w-4" />
                    {REDES[r.rede]?.rotulo ?? r.rede}
                    {r.falhas ? (
                      <small className="ml-auto text-xs font-normal text-destructive">
                        {r.falhas} falha(s)
                      </small>
                    ) : null}
                  </span>
                  <dl className="mt-2 grid grid-cols-4 gap-1 text-center">
                    {(
                      [
                        ["Posts", r.publicados],
                        ["Alcance", r.alcance],
                        ["Curtidas", r.curtidas],
                        ["Coment.", r.comentarios],
                      ] as const
                    ).map(([rotulo, valor]) => (
                      <div key={rotulo} className="flex flex-col-reverse">
                        <dt className="text-[11px] text-muted-foreground">{rotulo}</dt>
                        <dd className="text-sm font-semibold tabular-nums">{num(valor)}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          )}
          {rel.data && rel.data.por_rede.length > 0 && (
            <div className="mt-4 hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 font-medium">Rede</th>
                    <th className="py-2 text-right font-medium">Posts</th>
                    <th className="py-2 text-right font-medium">Alcance</th>
                    <th className="py-2 text-right font-medium">Curtidas</th>
                    <th className="py-2 text-right font-medium">Coment.</th>
                  </tr>
                </thead>
                <tbody>
                  {rel.data.por_rede.map((r) => (
                    <tr key={r.rede} className="border-b last:border-0">
                      <td className="py-2">
                        <span className="flex items-center gap-2">
                          <MarcaRede rede={r.rede} className="h-4 w-4" />
                          {REDES[r.rede]?.rotulo ?? r.rede}
                        </span>
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {num(r.publicados)}
                        {r.falhas ? (
                          <small className="text-destructive"> · {r.falhas} falha(s)</small>
                        ) : null}
                      </td>
                      <td className="py-2 text-right tabular-nums">{num(r.alcance)}</td>
                      <td className="py-2 text-right tabular-nums">{num(r.curtidas)}</td>
                      <td className="py-2 text-right tabular-nums">{num(r.comentarios)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rel.data && rel.data.por_rede.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Nenhum post publicado neste período ainda.
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Alcance e engajamento vêm das próprias redes e são atualizados a cada 6 horas. Cliques e
            leads vêm do link rastreado de cada post para o site.
          </p>
        </>
      )}
    </section>
  );
}

function DetalhePost({
  id,
  corretorUrl,
  podeEditar,
  aoFechar,
  aoEditar,
  aoMudar,
}: {
  id: string;
  corretorUrl: string;
  podeEditar: boolean;
  aoFechar: () => void;
  aoEditar: (p: PostDetalhe) => void;
  aoMudar: () => void;
}) {
  const carregarFn = useServerFn(carregarPostAgz);
  const cancelarFn = useServerFn(cancelarPostAgz);
  const repetirFn = useServerFn(repetirFalhasAgz);
  const q = useQuery({
    queryKey: ["agz-social-post", id],
    queryFn: () => carregarFn({ data: { id } }),
  });
  const [ocupado, setOcupado] = useState(false);
  const post = q.data;

  async function acao(fn: () => Promise<unknown>, sucesso: string) {
    setOcupado(true);
    try {
      await fn();
      toast.success(sucesso);
      aoMudar();
      await q.refetch();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível."));
    } finally {
      setOcupado(false);
    }
  }

  const editavel =
    !!post &&
    podeEditar &&
    !post.destinos.some((d) => d.status === "publicando" || d.status === "publicado") &&
    post.status !== "cancelado";
  // A página de aprovação é do Corretor (quem aprova não tem login).
  const linkAprovacao = post?.token_aprovacao
    ? `${corretorUrl}/aprovar-post/${post.token_aprovacao}`
    : null;

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post</DialogTitle>
          <DialogDescription>
            {post?.agendado_para
              ? `Publicação: ${dataHora(post.agendado_para)}`
              : post
                ? "Rascunho sem data"
                : "Carregando…"}
          </DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !post ? (
          <p className="text-sm text-muted-foreground">Post não encontrado.</p>
        ) : (
          <div className="space-y-4">
            <Badge variant={STATUS_POST[post.status].tom}>{STATUS_POST[post.status].rotulo}</Badge>
            {post.legenda && (
              <p className="whitespace-pre-wrap break-words text-sm">{post.legenda}</p>
            )}

            <ul className="space-y-2">
              {post.destinos.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2"
                >
                  <MarcaRede rede={d.rede} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm font-medium">{d.conta}</b>
                    <small className="block break-words text-xs text-muted-foreground">
                      {REDES[d.rede]?.formatos.find((f) => f.id === d.formato)?.rotulo ?? d.formato}
                      {d.erro ? ` · ${d.erro}` : ""}
                      {d.metricas?.alcance != null ? ` · ${num(d.metricas.alcance)} alcance` : ""}
                      {d.metricas?.curtidas != null
                        ? ` · ${num(d.metricas.curtidas)} curtidas`
                        : ""}
                    </small>
                  </span>
                  <Badge variant={STATUS_DESTINO[d.status]?.tom ?? "outline"} className="shrink-0">
                    {STATUS_DESTINO[d.status]?.rotulo ?? d.status}
                  </Badge>
                  {d.url && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Ver na rede"
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-md hover:bg-muted sm:h-8 sm:w-8"
                    >
                      <Link2 className="h-4 w-4" />
                    </a>
                  )}
                </li>
              ))}
            </ul>

            {linkAprovacao && post.status === "aguardando_aprovacao" && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <p className="font-medium">Aguardando aprovação</p>
                <p className="mt-0.5 text-muted-foreground">
                  Mande este link para quem aprova: vê o post e aprova pelo celular, sem criar
                  conta.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => copiar(linkAprovacao)}
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar link de aprovação
                </Button>
              </div>
            )}

            {post.link_url && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
                <span className="min-w-0 flex-1">
                  <small className="block text-xs text-muted-foreground">
                    Link rastreado do post (use na legenda, na bio ou nos stories)
                  </small>
                  <b className="block truncate text-sm font-medium">{post.link_url}</b>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Copiar link rastreado"
                  onClick={() => copiar(post.link_url!)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
            {post.cliques !== null && (
              <p className="text-sm text-muted-foreground">
                <b className="text-foreground">{num(post.cliques)}</b> clique(s) ·{" "}
                <b className="text-foreground">{num(post.leads)}</b> lead(s) vindos deste post
              </p>
            )}

            {post.comentarios.length > 0 && (
              <div>
                <p className="text-sm font-medium">Conversa da aprovação</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {post.comentarios.map((c, i) => (
                    <li key={i}>
                      <b>{c.autor}</b>
                      {c.tipo === "aprovado"
                        ? " aprovou"
                        : c.tipo === "ajustes"
                          ? " pediu ajustes"
                          : ""}
                      {c.corpo ? `: ${c.corpo}` : ""}
                      <small className="text-muted-foreground"> · {dataHora(c.em)}</small>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {post && podeEditar && (
          <DialogFooter>
            {post.destinos.some((d) => d.status === "falhou") && (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={ocupado}
                onClick={() =>
                  void acao(
                    () => repetirFn({ data: { id: post.id } }),
                    "As redes que falharam voltaram para a fila.",
                  )
                }
              >
                <RotateCcw className="h-4 w-4" /> Tentar de novo
              </Button>
            )}
            {post.status !== "cancelado" && post.status !== "publicado" && (
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={ocupado}
                onClick={() =>
                  void acao(() => cancelarFn({ data: { id: post.id } }), "Post cancelado.")
                }
              >
                <X className="h-4 w-4" /> Cancelar post
              </Button>
            )}
            {editavel && (
              <Button className="w-full sm:w-auto" onClick={() => aoEditar(post)}>
                Editar
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
