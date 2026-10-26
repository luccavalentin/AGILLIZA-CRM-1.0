import { Link, createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  CalendarX,
  Copy,
  Link2,
  MessageCircle,
  Pencil,
  RotateCcw,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EstadoErro, EstadoVazio, ListaCarregando, Secao, Selo } from "@/components/plataforma/kit";
import { temFalha, useAcoesPost } from "@/components/automacoes/acoes-post";
import {
  MarcaRede,
  STATUS_DESTINO,
  SeloStatus,
  copiarTexto,
  dataHora,
  num,
  rotuloFormato,
  rotuloRede,
} from "@/components/automacoes/comum";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  carregarPostAgz,
  type DestinoPost,
  type PostDetalhe,
} from "@/lib/social/automacoes.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/automacoes/posts/$id")({
  head: () => ({ meta: [{ title: "Post — Automações — Agilliza" }] }),
  component: PaginaPost,
});

const pai = getRouteApi("/_authenticated/automacoes");

const TITULO: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando aprovação",
  agendado: "Post agendado",
  publicando: "Publicando…",
  publicado: "Post publicado",
  parcial: "Publicado em parte",
  falhou: "Falha na publicação",
  cancelado: "Post cancelado",
};

const EVENTO: Record<string, { rotulo: string; ponto: string }> = {
  post_criado: { rotulo: "Post criado", ponto: "bg-muted-foreground/40" },
  post_alterado: { rotulo: "Post editado", ponto: "bg-muted-foreground/40" },
  post_reagendado: { rotulo: "Reagendado", ponto: "bg-primary" },
  post_publicar_agora: { rotulo: "Mandado publicar agora", ponto: "bg-primary" },
  post_repetido: { rotulo: "Nova tentativa pedida", ponto: "bg-primary" },
  post_cancelado: { rotulo: "Cancelado", ponto: "bg-muted-foreground/40" },
  destino_publicado: { rotulo: "Publicado numa rede", ponto: "bg-success" },
  destino_nova_tentativa: {
    rotulo: "Erro passageiro, nova tentativa agendada",
    ponto: "bg-warning",
  },
  destino_falhou: { rotulo: "Falha ao publicar numa rede", ponto: "bg-destructive" },
  post_publicado: { rotulo: "Publicação concluída", ponto: "bg-success" },
  post_parcial: { rotulo: "Publicado em parte", ponto: "bg-warning" },
  post_falhou: { rotulo: "Publicação falhou", ponto: "bg-destructive" },
  cliente_aprovado: { rotulo: "Cliente aprovou", ponto: "bg-success" },
  cliente_ajustes: { rotulo: "Cliente pediu ajustes", ponto: "bg-warning" },
  cliente_comentario: { rotulo: "Cliente comentou", ponto: "bg-sky-500" },
};

function PaginaPost() {
  const { id } = Route.useParams();
  const estado = pai.useLoaderData();
  const podeEditar = usePermissao("marketing.automacoes", "edit");
  const carregarFn = useServerFn(carregarPostAgz);
  const q = useQuery({
    queryKey: ["automacoes", "post", id],
    queryFn: () => carregarFn({ data: { id } }),
    refetchInterval: (r) =>
      ["agendado", "publicando"].includes(r.state.data?.status ?? "") ? 15_000 : false,
  });
  const a = useAcoesPost();

  const voltar = (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="-ml-2 min-h-11 text-muted-foreground sm:min-h-8"
    >
      <Link to="/automacoes/posts">
        <ArrowLeft className="mr-1 size-4" /> Posts
      </Link>
    </Button>
  );
  if (q.isLoading)
    return (
      <div className="space-y-3">
        {voltar}
        <Secao>
          <ListaCarregando linhas={4} />
        </Secao>
      </div>
    );
  if (q.isError)
    return (
      <div className="space-y-3">
        {voltar}
        <Secao>
          <EstadoErro
            mensagem={mensagemDeErro(q.error, "Não foi possível abrir o post.")}
            onTentar={() => q.refetch()}
          />
        </Secao>
      </div>
    );
  const p = q.data;
  if (!p)
    return (
      <div className="space-y-3">
        {voltar}
        <Secao>
          <EstadoVazio titulo="Post não encontrado" descricao="Ele pode ter sido apagado." />
        </Secao>
      </div>
    );

  const editavel =
    p.status !== "cancelado" &&
    !p.destinos.some((d) => d.status === "publicando" || d.status === "publicado");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {voltar}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-lg font-medium tracking-tight sm:text-xl">
              {TITULO[p.status] ?? "Post"} <SeloStatus status={p.status} />
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarClock className="size-4 shrink-0" />
              {p.agendado_para
                ? new Date(p.agendado_para).toLocaleString("pt-BR", {
                    dateStyle: "full",
                    timeStyle: "short",
                  })
                : "Sem data definida"}
              {p.autor ? ` · criado por ${p.autor}` : ""}
            </p>
          </div>
          {podeEditar && (
            <div className="flex flex-wrap gap-2">
              {editavel && (
                <Button asChild className="min-h-11 sm:min-h-9">
                  <Link to="/automacoes/novo" search={{ post: p.id }}>
                    <Pencil className="mr-1.5 size-4" /> Editar
                  </Link>
                </Button>
              )}
              {p.status === "agendado" && (
                <Button
                  variant="outline"
                  className="min-h-11 sm:min-h-9"
                  disabled={a.publicar.isPending}
                  onClick={() => a.publicar.mutate(p.id)}
                >
                  <Send className="mr-1.5 size-4" /> Publicar agora
                </Button>
              )}
              {temFalha(p) && (
                <Button
                  variant="outline"
                  className="min-h-11 sm:min-h-9"
                  disabled={a.repetir.isPending}
                  onClick={() => a.repetir.mutate(p.id)}
                >
                  <RotateCcw className="mr-1.5 size-4" /> Tentar de novo
                </Button>
              )}
              <Button
                variant="outline"
                className="min-h-11 sm:min-h-9"
                disabled={a.duplicar.isPending}
                onClick={() => a.duplicar.mutate(p.id)}
              >
                <Copy className="mr-1.5 size-4" /> Duplicar
              </Button>
              {p.status !== "cancelado" && p.status !== "publicado" && (
                <Button
                  variant="ghost"
                  className="min-h-11 text-destructive hover:text-destructive sm:min-h-9"
                  disabled={a.cancelar.isPending}
                  onClick={() => {
                    if (window.confirm("Cancelar este post? O que já saiu nas redes continua lá."))
                      a.cancelar.mutate(p.id);
                  }}
                >
                  <CalendarX className="mr-1.5 size-4" /> Cancelar
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <Destinos p={p} />
          <Secao titulo="Conteúdo">
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
              {p.legenda || <span className="text-muted-foreground">Sem legenda</span>}
            </p>
            {p.midias.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {[...p.midias]
                  .sort((x, y) => x.posicao - y.posicao)
                  .map((m) => {
                    const url = p.urls?.[m.id];
                    if (!url)
                      return (
                        <span
                          key={m.id}
                          className="size-28 rounded-xl bg-secondary ring-1 ring-border sm:size-32"
                        />
                      );
                    return m.mime?.startsWith("video/") ? (
                      <video
                        key={m.id}
                        src={url}
                        controls
                        muted
                        className="size-28 rounded-xl bg-foreground object-cover ring-1 ring-border sm:size-32"
                      />
                    ) : (
                      <img
                        key={m.id}
                        src={url}
                        alt=""
                        className="size-28 rounded-xl object-cover ring-1 ring-border sm:size-32"
                      />
                    );
                  })}
              </div>
            )}
          </Secao>
        </div>
        <div className="min-w-0 space-y-4">
          <Aprovacao p={p} corretorUrl={estado.corretorUrl} />
          {p.link_url && (
            <Secao
              titulo="Link rastreado"
              descricao="Use na legenda, na bio ou nos stories: o clique e o lead que vierem dele ficam aqui."
            >
              <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2">
                <Link2 className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{p.link_url}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 sm:size-8"
                  aria-label="Copiar link rastreado"
                  onClick={() =>
                    copiarTexto(p.link_url!, (ok) =>
                      ok ? toast.success("Link copiado.") : toast.error("Não foi possível copiar."),
                    )
                  }
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg border p-2">
                  <dt className="text-xs text-muted-foreground">Cliques</dt>
                  <dd className="text-lg font-medium tabular-nums">{num(p.cliques ?? 0)}</dd>
                </div>
                <div className="rounded-lg border p-2">
                  <dt className="text-xs text-muted-foreground">Leads</dt>
                  <dd className="text-lg font-medium tabular-nums">{num(p.leads ?? 0)}</dd>
                </div>
              </dl>
            </Secao>
          )}
          <Historico p={p} />
        </div>
      </div>
    </div>
  );
}

function Metricas({ d }: { d: DestinoPost }) {
  const m = d.metricas;
  if (!m) return null;
  const itens = [
    ["Alcance", m.alcance],
    ["Visualizações", m.visualizacoes],
    ["Curtidas", m.curtidas],
    ["Comentários", m.comentarios],
    ["Compart.", m.compartilhamentos],
    ["Salvos", m.salvos],
  ].filter(([, v]) => v != null) as [string, number][];
  if (!itens.length) return null;
  return (
    <dl className="mt-2 flex flex-wrap gap-1.5">
      {itens.map(([r, v]) => (
        <div key={r} className="rounded-md bg-secondary/70 px-2 py-1 text-[11.5px]">
          <dt className="inline text-muted-foreground">{r} </dt>
          <dd className="inline font-medium tabular-nums">{num(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Destinos({ p }: { p: PostDetalhe }) {
  return (
    <Secao
      titulo="Redes"
      descricao="Cada rede sai sozinha, com tentativas e resultado próprios."
      semRespiro
    >
      {p.destinos.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Nenhuma rede escolhida ainda.</p>
      ) : (
        <ul className="divide-y">
          {p.destinos.map((d) => (
            <li key={d.id} className="flex items-start gap-3 px-4 py-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-card">
                <MarcaRede rede={d.rede} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 truncate text-sm font-medium">{d.conta}</p>
                  <Selo tom={STATUS_DESTINO[d.status]?.tom ?? "neutro"}>
                    {STATUS_DESTINO[d.status]?.rotulo ?? d.status}
                  </Selo>
                </div>
                <p className="text-xs text-muted-foreground">
                  {rotuloRede(d.rede)} · {rotuloFormato(d.rede, d.formato)}
                  {d.publicado_em ? ` · publicado ${dataHora(d.publicado_em)}` : ""}
                </p>
                {d.erro && d.status !== "publicado" && (
                  <p className="mt-2 rounded-lg bg-destructive/[0.06] px-3 py-2 text-xs text-destructive">
                    {d.erro}
                  </p>
                )}
                {d.status === "pendente" && (d.tentativas ?? 0) > 0 && d.proxima_tentativa_em && (
                  <p className="mt-1 text-xs text-warning-foreground">
                    Nova tentativa {dataHora(d.proxima_tentativa_em)}
                  </p>
                )}
                <Metricas d={d} />
              </div>
              {d.url && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="min-h-11 shrink-0 sm:min-h-8"
                >
                  <a href={d.url} target="_blank" rel="noreferrer">
                    Ver <ArrowUpRight className="ml-1 size-3.5" />
                  </a>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

function Aprovacao({ p, corretorUrl }: { p: PostDetalhe; corretorUrl: string }) {
  const link = p.token_aprovacao ? `${corretorUrl}/aprovar-post/${p.token_aprovacao}` : null;
  const msg = link
    ? `Olá! Segue o post para você aprovar${p.agendado_para ? ` (publicação ${dataHora(p.agendado_para)})` : ""}: ${link}`
    : "";
  return (
    <Secao titulo="Aprovação do cliente">
      {!link ? (
        <p className="text-sm text-muted-foreground">
          Para pedir aprovação, edite o post e use “Enviar para aprovação”. O cliente aprova pelo
          celular, sem criar conta.
        </p>
      ) : (
        <div className="space-y-3">
          {p.status === "aguardando_aprovacao" && (
            <p className="text-sm text-muted-foreground">
              Mande o link ao cliente: ele vê o post e aprova ou pede ajustes.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-h-11 flex-1 sm:min-h-9"
              onClick={() =>
                copiarTexto(link, (ok) =>
                  ok
                    ? toast.success("Link de aprovação copiado.")
                    : toast.error("Não foi possível copiar."),
                )
              }
            >
              <Copy className="mr-1.5 size-4" /> Copiar link
            </Button>
            <Button asChild variant="outline" className="min-h-11 flex-1 sm:min-h-9">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(msg)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="mr-1.5 size-4" /> WhatsApp
              </a>
            </Button>
          </div>
        </div>
      )}
      {p.comentarios.length > 0 && (
        <ul className="mt-4 space-y-2 border-t pt-3">
          {p.comentarios.map((c, i) => (
            <li
              key={i}
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                c.do_cliente ? "bg-secondary/70" : "bg-primary/[0.05]",
              )}
            >
              <p>
                <span className="font-medium">{c.autor}</span>
                {c.tipo === "aprovado" ? " aprovou" : c.tipo === "ajustes" ? " pediu ajustes" : ""}
                {c.corpo ? `: ${c.corpo}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{dataHora(c.em)}</p>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

function Historico({ p }: { p: PostDetalhe }) {
  const eventos = p.eventos ?? [];
  if (!eventos.length) return null;
  const rede = (dados: Record<string, unknown>) => {
    const d = p.destinos.find((x) => x.id === dados.destino);
    return d ? ` · ${rotuloRede(d.rede)}` : "";
  };
  return (
    <Secao titulo="Histórico">
      <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-border">
        {[...eventos].reverse().map((e, i) => {
          const info = EVENTO[e.tipo] ?? { rotulo: e.tipo, ponto: "bg-muted-foreground/40" };
          return (
            <li key={i} className="relative pl-6">
              <span
                className={cn(
                  "absolute left-0 top-1.5 size-[11px] rounded-full ring-[3px] ring-card",
                  info.ponto,
                )}
              />
              <p className="text-[13.5px]">
                {info.rotulo}
                <span className="text-muted-foreground">{rede(e.dados)}</span>
              </p>
              {typeof e.dados.erro === "string" && (
                <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">
                  {e.dados.erro}
                </p>
              )}
              {typeof e.dados.nome === "string" && (
                <p className="mt-0.5 text-xs text-muted-foreground">{e.dados.nome}</p>
              )}
              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground/80">
                {new Date(e.em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </p>
            </li>
          );
        })}
      </ol>
    </Secao>
  );
}
