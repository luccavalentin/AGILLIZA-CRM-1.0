import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  Bookmark,
  CalendarClock,
  CheckCircle2,
  Eye,
  Heart,
  MessageCircle,
  MousePointerClick,
  Printer,
  Share2,
  Timer,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EstadoErro,
  EstadoVazio,
  FaixaIndicadores,
  Indicador,
  ListaCarregando,
  Secao,
  Selo,
} from "@/components/plataforma/kit";
import { Barras, BarraH, Linha } from "@/components/automacoes/graficos";
import {
  MarcaRede,
  Miniatura,
  compacto,
  dataCurta,
  num,
  primeiraLinha,
  rotuloRede,
} from "@/components/automacoes/comum";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  metricasContaAgz,
  relatorioPublicacaoAgz,
  type MetricaConta,
  type PostDoRelatorio,
  type RelatorioPublicacao,
} from "@/lib/social/automacoes.functions";
import { cn } from "@/lib/utils";

const PERIODOS = [7, 30, 90] as const;
const DIA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Busca = { dias?: number };

export const Route = createFileRoute("/_authenticated/automacoes/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Automações — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>): Busca => ({
    dias: PERIODOS.includes(Number(s.dias) as 7) ? Number(s.dias) : undefined,
  }),
  component: PaginaRelatorios,
});

function PaginaRelatorios() {
  const busca = Route.useSearch();
  const dias = busca.dias ?? 30;
  const relFn = useServerFn(relatorioPublicacaoAgz);
  const contaFn = useServerFn(metricasContaAgz);
  const rel = useQuery({
    queryKey: ["automacoes", "relatorio", dias],
    queryFn: () => relFn({ data: { dias } }),
    placeholderData: keepPreviousData,
  });
  const contas = useQuery({
    queryKey: ["automacoes", "metricas-conta", dias],
    queryFn: () => contaFn({ data: { dias } }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4 print:space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto min-w-0">
          <h2 className="text-lg font-medium tracking-tight sm:text-xl">Relatórios</h2>
          <p className="text-sm text-muted-foreground">
            Resultado das redes e da publicação nos últimos {dias} dias.
          </p>
        </div>
        <nav
          aria-label="Período"
          className="inline-flex rounded-[11px] border bg-secondary p-0.5 print:hidden"
        >
          {PERIODOS.map((d) => (
            <Link
              key={d}
              to="/automacoes/relatorios"
              search={{ dias: d === 30 ? undefined : d }}
              aria-current={d === dias ? "page" : undefined}
              className={cn(
                "inline-flex h-11 items-center rounded-[9px] px-4 text-sm font-medium sm:h-8 sm:px-3 sm:text-[13px]",
                d === dias
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {d} dias
            </Link>
          ))}
        </nav>
        <Button
          variant="outline"
          className="min-h-11 print:hidden sm:min-h-9"
          onClick={() => window.print()}
          title="Imprimir ou salvar como PDF"
        >
          <Printer className="mr-1.5 size-4" /> Exportar PDF
        </Button>
      </div>

      {rel.isError ? (
        <Secao>
          <EstadoErro
            mensagem={mensagemDeErro(rel.error, "Não foi possível carregar o relatório.")}
            onTentar={() => rel.refetch()}
          />
        </Secao>
      ) : rel.isLoading || !rel.data ? (
        <Secao>
          <ListaCarregando linhas={6} />
        </Secao>
      ) : (
        <>
          <Engajamento r={rel.data} />
          <ContasNasRedes
            carregando={contas.isLoading}
            erro={contas.error}
            contas={contas.data?.contas ?? []}
            dias={dias}
          />
          <Publicacao r={rel.data} dias={dias} />
          <TabelaPosts posts={rel.data.posts} />
        </>
      )}
    </div>
  );
}

function Engajamento({ r }: { r: RelatorioPublicacao }) {
  const e = r.engajamento;
  const interacoes = e.curtidas + e.comentarios + e.compartilhamentos + e.salvos;
  const taxa = e.alcance ? (interacoes / e.alcance) * 100 : null;
  return (
    <section className="space-y-2">
      <h3 className="text-[15px] font-semibold">Resultado dos posts</h3>
      <FaixaIndicadores colunas={4}>
        <Indicador
          rotulo="Alcance"
          valor={compacto(e.alcance)}
          icone={<Eye />}
          detalhe="pessoas alcançadas"
        />
        <Indicador
          rotulo="Visualizações"
          valor={compacto(e.visualizacoes)}
          icone={<BarChart3 />}
          tom="info"
        />
        <Indicador
          rotulo="Interações"
          valor={compacto(interacoes)}
          icone={<Heart />}
          tom="sucesso"
          detalhe={
            taxa != null
              ? `${taxa.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do alcance`
              : undefined
          }
        />
        <Indicador
          rotulo="Cliques e leads"
          valor={`${num(e.cliques)} · ${num(e.leads)}`}
          icone={<MousePointerClick />}
          tom="marca"
          detalhe="do link rastreado"
        />
      </FaixaIndicadores>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Curtidas", e.curtidas, Heart],
          ["Comentários", e.comentarios, MessageCircle],
          ["Compartilhamentos", e.compartilhamentos, Share2],
          ["Salvos", e.salvos, Bookmark],
        ].map(([r0, v, I]) => {
          const Icone = I as typeof Heart;
          return (
            <div
              key={r0 as string}
              className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2"
            >
              <Icone className="size-4 text-muted-foreground" />
              <span className="truncate text-xs text-muted-foreground">{r0 as string}</span>
              <span className="ml-auto text-sm font-medium tabular-nums">
                {compacto(v as number)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Números oficiais de cada rede, atualizados a cada 6 horas
        {e.ultima_coleta
          ? ` (última coleta ${new Date(e.ultima_coleta).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })})`
          : ""}
        .{" "}
        {e.com_metricas < r.publicados
          ? `${r.publicados - e.com_metricas} publicação(ões) ainda sem números.`
          : ""}
      </p>
    </section>
  );
}

const SITUACAO: Record<
  string,
  { tom: "neutro" | "sucesso" | "alerta" | "perigo" | "info"; texto: string }
> = {
  pendente: { tom: "neutro", texto: "A primeira coleta sai em até 24 horas depois de conectar." },
  ok: { tom: "sucesso", texto: "" },
  parcial: {
    tom: "info",
    texto: "Parte dos números depende de uma permissão extra. Reconecte a rede para liberar tudo.",
  },
  sem_permissao: {
    tom: "alerta",
    texto:
      "Reconecte a rede para liberar as métricas da conta (a permissão de leitura não foi dada).",
  },
  indisponivel: {
    tom: "neutro",
    texto: "Esta rede não informa números da conta para este tipo de perfil.",
  },
  erro: { tom: "perigo", texto: "A última coleta falhou; o sistema tenta de novo sozinho." },
};

function ContasNasRedes({
  carregando,
  erro,
  contas,
  dias,
}: {
  carregando: boolean;
  erro: unknown;
  contas: MetricaConta[];
  dias: number;
}) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <Secao
      titulo="Contas nas redes"
      descricao={`Seguidores, crescimento e alcance da conta, dia a dia (${dias} dias).`}
      icone={<Users />}
    >
      {erro ? (
        <EstadoErro
          mensagem={mensagemDeErro(erro, "Não foi possível carregar as métricas das contas.")}
        />
      ) : carregando ? (
        <ListaCarregando linhas={2} />
      ) : contas.length === 0 ? (
        <EstadoVazio
          icone={<Users />}
          titulo="Nenhuma rede conectada"
          descricao="Conecte as redes para acompanhar seguidores e alcance."
          acao={
            <Button asChild className="min-h-11 sm:min-h-9">
              <Link to="/automacoes/redes">Conectar rede</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {contas.map((c) => (
            <CartaoConta
              key={c.id}
              c={c}
              aberto={sel === c.id}
              alternar={() => setSel((s) => (s === c.id ? null : c.id))}
            />
          ))}
        </div>
      )}
    </Secao>
  );
}

function CartaoConta({
  c,
  aberto,
  alternar,
}: {
  c: MetricaConta;
  aberto: boolean;
  alternar: () => void;
}) {
  const crescimento =
    c.seguidores != null && c.seguidores_inicio != null ? c.seguidores - c.seguidores_inicio : null;
  const s = SITUACAO[c.situacao] ?? SITUACAO.erro!;
  const [serie, setSerie] = useState<"seguidores" | "alcance" | "impressoes" | "visualizacoes">(
    "seguidores",
  );
  const temNumero = c.seguidores != null || c.alcance != null || c.visualizacoes != null;
  return (
    <article className="min-w-0 rounded-xl border bg-card p-3.5 break-inside-avoid">
      <header className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border">
          <MarcaRede rede={c.rede} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{c.nome}</p>
          <p className="truncate text-xs text-muted-foreground">
            {rotuloRede(c.rede)}
            {c.usuario ? ` · ${c.usuario}` : ""}
          </p>
        </div>
        {c.situacao !== "ok" && (
          <Selo tom={s.tom}>
            {c.situacao === "pendente"
              ? "Aguardando coleta"
              : c.situacao === "sem_permissao"
                ? "Sem permissão"
                : c.situacao === "parcial"
                  ? "Parcial"
                  : c.situacao === "indisponivel"
                    ? "Indisponível"
                    : "Erro"}
          </Selo>
        )}
      </header>
      {!temNumero ? (
        <p className="mt-3 rounded-lg bg-secondary/60 px-3 py-2.5 text-[13px] text-muted-foreground">
          {c.aviso || s.texto}
          {c.situacao === "sem_permissao" && (
            <Link to="/automacoes/redes" className="ml-1 font-medium text-primary hover:underline">
              Reconectar
            </Link>
          )}
        </p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Seguidores
              </dt>
              <dd className="text-lg font-medium tabular-nums">{compacto(c.seguidores)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Crescimento
              </dt>
              <dd
                className={cn(
                  "text-lg font-medium tabular-nums",
                  crescimento != null && crescimento < 0
                    ? "text-destructive"
                    : crescimento
                      ? "text-success"
                      : "",
                )}
              >
                {crescimento == null
                  ? "—"
                  : `${crescimento > 0 ? "+" : ""}${crescimento.toLocaleString("pt-BR")}`}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Alcance</dt>
              <dd className="text-lg font-medium tabular-nums">{compacto(c.alcance)}</dd>
            </div>
          </dl>
          <dl className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
            {[
              ["Novos seguidores", c.novos_seguidores],
              ["Impressões", c.impressoes],
              ["Visualizações", c.visualizacoes],
              ["Visitas ao perfil", c.visitas_perfil],
              ["Cliques no site", c.cliques_site],
              ["Publicações", c.publicacoes],
            ]
              .filter(([, v]) => v != null)
              .map(([r, v]) => (
                <div key={r as string} className="rounded-md bg-secondary/70 px-2 py-1">
                  <dt className="inline text-muted-foreground">{r as string} </dt>
                  <dd className="inline font-medium tabular-nums">{num(v as number)}</dd>
                </div>
              ))}
          </dl>
          {(c.aviso || c.situacao === "parcial") && (
            <p className="mt-2 text-xs text-muted-foreground">{c.aviso || s.texto}</p>
          )}
          <button
            type="button"
            onClick={alternar}
            className="mt-2 min-h-11 text-xs font-medium text-primary hover:underline sm:min-h-0 print:hidden"
          >
            {aberto ? "Esconder o gráfico" : "Ver dia a dia"}
          </button>
          {aberto && (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-1">
                {(["seguidores", "alcance", "impressoes", "visualizacoes"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSerie(k)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs",
                      serie === k ? "border-primary bg-primary text-primary-foreground" : "bg-card",
                    )}
                  >
                    {
                      {
                        seguidores: "Seguidores",
                        alcance: "Alcance",
                        impressoes: "Impressões",
                        visualizacoes: "Visualizações",
                      }[k]
                    }
                  </button>
                ))}
              </div>
              <Linha
                rotulo={serie}
                pontos={c.serie.map((d) => ({ dia: d.dia, valor: d[serie] }))}
              />
            </div>
          )}
          {c.coletado_em && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Coletado {dataCurta(c.coletado_em)}
            </p>
          )}
        </>
      )}
    </article>
  );
}

function Publicacao({ r, dias }: { r: RelatorioPublicacao; dias: number }) {
  const total = r.publicados + r.falhas;
  const taxa = total ? Math.round((r.publicados / total) * 100) : null;
  const lead =
    r.antecedencia_media_h == null
      ? null
      : r.antecedencia_media_h >= 48
        ? `${Math.round(r.antecedencia_media_h / 24)} dias`
        : `${Math.round(r.antecedencia_media_h)} h`;
  const melhorDia = [...r.por_dia_semana].sort((a, b) => b.n - a.n)[0];
  const melhorHora = [...r.por_hora].sort((a, b) => b.n - a.n)[0];
  const maxRede = Math.max(1, ...r.por_rede.map((x) => x.publicados));
  return (
    <section className="space-y-3">
      <h3 className="text-[15px] font-semibold">Publicação</h3>
      <FaixaIndicadores colunas={4}>
        <Indicador
          rotulo="Publicações"
          valor={num(r.publicados)}
          icone={<CheckCircle2 />}
          tom="sucesso"
          detalhe="posts que foram ao ar em cada rede"
        />
        <Indicador
          rotulo="Taxa de sucesso"
          valor={taxa == null ? "—" : `${taxa}%`}
          icone={<BarChart3 />}
          tom={r.falhas ? "alerta" : "sucesso"}
          detalhe={r.falhas ? `${r.falhas} falha(s) no período` : "nenhuma falha no período"}
        />
        <Indicador
          rotulo="Na fila"
          valor={num(r.na_fila)}
          icone={<CalendarClock />}
          detalhe="agendados à frente"
        />
        <Indicador
          rotulo="Antecedência média"
          valor={lead ?? "—"}
          icone={<Timer />}
          tom="neutro"
          detalhe="entre criar e publicar"
        />
      </FaixaIndicadores>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Secao titulo="Publicações por semana" descricao="Últimas 12 semanas">
          <Barras
            dados={r.semanal.map((w) => ({
              rotulo: `${w.semana.slice(8, 10)}/${w.semana.slice(5, 7)}`,
              valor: w.n,
              dica: `Semana de ${w.semana.slice(8, 10)}/${w.semana.slice(5, 7)}: ${w.n}`,
            }))}
          />
        </Secao>
        <Secao titulo="Por rede" descricao={`Últimos ${dias} dias`}>
          {r.por_rede.length ? (
            <div className="space-y-3.5">
              {r.por_rede.map((x) => (
                <BarraH
                  key={x.rede}
                  icone={<MarcaRede rede={x.rede} className="size-5" />}
                  rotulo={rotuloRede(x.rede)}
                  valor={x.publicados}
                  max={maxRede}
                  extra={
                    x.falhas
                      ? `· ${x.falhas} falha(s)`
                      : x.alcance
                        ? `· ${compacto(x.alcance)} alcance`
                        : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              Ainda não há publicações neste período.
            </p>
          )}
        </Secao>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Secao
          titulo="Dias com mais publicações"
          descricao={melhorDia?.n ? `Dia mais ativo: ${DIA[melhorDia.dia]}` : undefined}
        >
          <Barras
            dados={r.por_dia_semana.map((d) => ({
              rotulo: DIA[d.dia]!,
              valor: d.n,
              dica: `${DIA[d.dia]}: ${d.n}`,
            }))}
          />
        </Secao>
        <Secao
          titulo="Horários de publicação"
          descricao={melhorHora?.n ? `Pico às ${melhorHora.hora}h` : undefined}
        >
          <Barras
            denso
            dados={r.por_hora.map((h) => ({
              rotulo: h.hora % 6 === 0 ? `${h.hora}h` : "",
              valor: h.n,
              dica: `${h.hora}h: ${h.n}`,
            }))}
          />
        </Secao>
        <Secao titulo="Fila dos próximos 14 dias" descricao="Publicações agendadas por dia">
          <Barras
            vazio="Nada agendado"
            dados={r.fila.map((f) => ({
              rotulo: f.dia.slice(8, 10),
              valor: f.n,
              dica: `${f.dia.slice(8, 10)}/${f.dia.slice(5, 7)}: ${f.n}`,
            }))}
          />
        </Secao>
      </div>
    </section>
  );
}

const interacoes = (p: PostDoRelatorio) =>
  (p.curtidas ?? 0) + (p.comentarios ?? 0) + (p.compartilhamentos ?? 0) + (p.salvos ?? 0);

function TabelaPosts({ posts }: { posts: PostDoRelatorio[] }) {
  const [ordem, setOrdem] = useState<"data" | "melhores">("melhores");
  const lista = [...posts].sort((a, b) =>
    ordem === "data"
      ? Date.parse(b.publicado_em) - Date.parse(a.publicado_em)
      : interacoes(b) - interacoes(a) || (b.alcance ?? 0) - (a.alcance ?? 0),
  );
  return (
    <Secao
      titulo="Resultado por post"
      descricao="Alcance, visualizações e interações de cada post publicado no período."
      semRespiro
      acoes={
        <div className="inline-flex rounded-[10px] border bg-secondary p-0.5 print:hidden">
          {(
            [
              ["melhores", "Melhores"],
              ["data", "Mais recentes"],
            ] as const
          ).map(([k, r]) => (
            <button
              key={k}
              type="button"
              onClick={() => setOrdem(k)}
              aria-pressed={ordem === k}
              className={cn(
                "h-9 rounded-[8px] px-3 text-[13px] font-medium sm:h-7",
                ordem === k ? "bg-card shadow-sm ring-1 ring-border" : "text-muted-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      }
    >
      {lista.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
          Nenhum post publicado neste período.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b bg-secondary/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Post</th>
                <th className="px-2 py-2.5 text-right font-medium">Alcance</th>
                <th className="px-2 py-2.5 text-right font-medium">Visualiz.</th>
                <th className="px-2 py-2.5 text-right font-medium">Curtidas</th>
                <th className="px-2 py-2.5 text-right font-medium">Coment.</th>
                <th className="px-2 py-2.5 text-right font-medium">Compart.</th>
                <th className="px-2 py-2.5 text-right font-medium">Salvos</th>
                <th className="px-2 py-2.5 text-right font-medium">Cliques</th>
                <th className="px-4 py-2.5 text-right font-medium">Leads</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.map((p) => (
                <tr key={p.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-2.5">
                    <Link
                      to="/automacoes/posts/$id"
                      params={{ id: p.id }}
                      className="flex min-w-0 items-center gap-2.5 hover:text-primary"
                    >
                      <Miniatura capa={p.capa} className="size-9 rounded-md ring-1 ring-border" />
                      <span className="min-w-0">
                        <span className="block max-w-[280px] truncate">
                          {primeiraLinha(p.legenda) || "Sem legenda"}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {dataCurta(p.publicado_em)}
                          <span className="flex -space-x-0.5">
                            {p.redes.map((r) => (
                              <MarcaRede key={r} rede={r} className="size-3.5" />
                            ))}
                          </span>
                        </span>
                      </span>
                    </Link>
                  </td>
                  {[
                    p.alcance,
                    p.visualizacoes,
                    p.curtidas,
                    p.comentarios,
                    p.compartilhamentos,
                    p.salvos,
                    p.cliques,
                  ].map((v, i) => (
                    <td key={i} className="px-2 py-2.5 text-right tabular-nums">
                      {num(v)}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {p.leads ? (
                      <span className="inline-flex items-center gap-1 font-medium text-success-texto">
                        <UserPlus className="size-3.5" />
                        {num(p.leads)}
                      </span>
                    ) : (
                      num(p.leads)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Secao>
  );
}
