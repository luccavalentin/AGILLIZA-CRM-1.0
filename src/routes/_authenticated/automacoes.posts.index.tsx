import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, LayoutList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarraFiltros,
  CampoBusca,
  ChipsFiltro,
  EstadoErro,
  EstadoVazio,
  ListaCarregando,
  Secao,
  type OpcaoChip,
} from "@/components/plataforma/kit";
import { MenuAcoesPost } from "@/components/automacoes/acoes-post";
import {
  Miniatura,
  RedesDoPost,
  SeloStatus,
  dataHora,
  num,
  primeiraLinha,
} from "@/components/automacoes/comum";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { CONECTORES, REDES, type Rede } from "@/lib/social/catalogo";
import { listarPostsAgz, type SituacaoFiltro } from "@/lib/social/automacoes.functions";

const SITUACOES: { valor: SituacaoFiltro; rotulo: string; tom?: "perigo" }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "agendados", rotulo: "Agendados" },
  { valor: "publicados", rotulo: "Publicados" },
  { valor: "falhas", rotulo: "Com falha", tom: "perigo" },
  { valor: "rascunhos", rotulo: "Rascunhos" },
  { valor: "aprovacao", rotulo: "Em aprovação" },
  { valor: "cancelados", rotulo: "Cancelados" },
];

const PERIODOS = {
  tudo: { rotulo: "Qualquer data", de: null, ate: null },
  proximos30: { rotulo: "Próximos 30 dias", de: 0, ate: 30 },
  ultimos7: { rotulo: "Últimos 7 dias", de: -7, ate: 0 },
  ultimos30: { rotulo: "Últimos 30 dias", de: -30, ate: 0 },
  ultimos90: { rotulo: "Últimos 90 dias", de: -90, ate: 0 },
} as const;
type Periodo = keyof typeof PERIODOS;

type Busca = {
  situacao?: SituacaoFiltro;
  rede?: Rede;
  periodo?: Periodo;
  q?: string;
  pagina?: number;
};

const POR_PAGINA = 30;

export const Route = createFileRoute("/_authenticated/automacoes/posts/")({
  head: () => ({ meta: [{ title: "Posts — Automações — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>): Busca => ({
    situacao: SITUACOES.some((x) => x.valor === s.situacao)
      ? (s.situacao as SituacaoFiltro)
      : undefined,
    rede: typeof s.rede === "string" && s.rede in REDES ? (s.rede as Rede) : undefined,
    periodo:
      typeof s.periodo === "string" && s.periodo in PERIODOS ? (s.periodo as Periodo) : undefined,
    q: typeof s.q === "string" ? s.q.slice(0, 120) : undefined,
    pagina:
      Number.isInteger(Number(s.pagina)) && Number(s.pagina) > 1 ? Number(s.pagina) : undefined,
  }),
  component: PaginaPosts,
});

function intervalo(p: Periodo) {
  const x = PERIODOS[p];
  if (x.de === null) return { de: null, ate: null };
  const agora = Date.now();
  return {
    de: new Date(agora + x.de * 86_400_000).toISOString(),
    ate: new Date(agora + x.ate * 86_400_000 + (x.ate === 0 ? 60_000 : 0)).toISOString(),
  };
}

function PaginaPosts() {
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const podeEditar = usePermissao("marketing.automacoes", "edit");
  const situacao = busca.situacao ?? "todos";
  const periodo = busca.periodo ?? "tudo";
  const pagina = busca.pagina ?? 1;
  const [texto, setTexto] = useState(busca.q ?? "");
  // Busca enquanto digita, com uma pausa curta (não uma consulta por tecla).
  useEffect(() => {
    const t = setTimeout(() => {
      if ((busca.q ?? "") !== texto.trim())
        void navigate({
          search: (s) => ({ ...s, q: texto.trim() || undefined, pagina: undefined }),
          replace: true,
        });
    }, 350);
    return () => clearTimeout(t);
  }, [texto, busca.q, navigate]);

  const listarFn = useServerFn(listarPostsAgz);
  const { de, ate } = intervalo(periodo);
  const q = useQuery({
    queryKey: ["automacoes", "lista", situacao, busca.rede ?? null, periodo, busca.q ?? "", pagina],
    queryFn: () =>
      listarFn({
        data: {
          situacao,
          rede: busca.rede ?? null,
          de,
          ate,
          busca: busca.q ?? "",
          limite: POR_PAGINA,
          pular: (pagina - 1) * POR_PAGINA,
        },
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
  const c = q.data?.contagens;
  const opcoes: OpcaoChip<SituacaoFiltro>[] = SITUACOES.map((s) => ({
    valor: s.valor,
    rotulo: s.rotulo,
    contagem: c ? (c[s.valor] ?? 0) : null,
    tom: s.tom,
  }));
  const total = q.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const redesDoFiltro = [...new Set(CONECTORES.flatMap((x) => x.redes))].filter(
    (r) => r !== "teste",
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-medium tracking-tight text-foreground sm:text-xl">
          Posts
        </h2>
        {podeEditar && (
          <Button asChild className="min-h-11 sm:min-h-9">
            <Link to="/automacoes/novo">
              <Plus className="mr-1.5 size-4" /> Criar post
            </Link>
          </Button>
        )}
      </div>

      <BarraFiltros>
        <ChipsFiltro
          rotulo="Situação"
          opcoes={opcoes}
          valor={situacao}
          onChange={(v) =>
            void navigate({
              search: (s) => ({ ...s, situacao: v === "todos" ? undefined : v, pagina: undefined }),
            })
          }
          className="md:flex-1"
        />
        <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
          <Select
            value={busca.rede ?? "todas"}
            onValueChange={(v) =>
              void navigate({
                search: (s) => ({
                  ...s,
                  rede: v === "todas" ? undefined : (v as Rede),
                  pagina: undefined,
                }),
              })
            }
          >
            <SelectTrigger className="h-11 md:h-10 md:w-44" aria-label="Rede">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as redes</SelectItem>
              {redesDoFiltro.map((r) => (
                <SelectItem key={r} value={r}>
                  {REDES[r].rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={periodo}
            onValueChange={(v) =>
              void navigate({
                search: (s) => ({
                  ...s,
                  periodo: v === "tudo" ? undefined : (v as Periodo),
                  pagina: undefined,
                }),
              })
            }
          >
            <SelectTrigger className="h-11 md:h-10 md:w-44" aria-label="Período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIODOS) as Periodo[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PERIODOS[p].rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <CampoBusca
          valor={texto}
          onChange={setTexto}
          placeholder="Buscar na legenda"
          rotulo="Buscar posts pela legenda"
        />
      </BarraFiltros>

      <Secao semRespiro>
        {q.isError ? (
          <EstadoErro
            mensagem={mensagemDeErro(q.error, "Não foi possível carregar os posts.")}
            onTentar={() => q.refetch()}
          />
        ) : q.isLoading ? (
          <ListaCarregando linhas={6} />
        ) : !q.data?.itens.length ? (
          <EstadoVazio
            icone={<LayoutList />}
            titulo="Nenhum post encontrado"
            descricao={
              busca.q
                ? "Tente outra palavra ou troque os filtros."
                : "Os posts criados, agendados e publicados aparecem nesta lista."
            }
            acao={
              podeEditar ? (
                <Button asChild className="min-h-11 sm:min-h-9">
                  <Link to="/automacoes/novo">
                    <Plus className="mr-1.5 size-4" /> Criar post
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1fr)_140px_180px_140px_150px_44px] gap-4 border-b bg-secondary/50 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid">
              <span>Post</span>
              <span>Redes</span>
              <span>Data</span>
              <span>Resultado</span>
              <span>Situação</span>
              <span />
            </div>
            <ul className="divide-y">
              {q.data.itens.map((p) => {
                const alcance = p.destinos.reduce((s, d) => s + (d.metricas?.alcance ?? 0), 0);
                const curtidas = p.destinos.reduce((s, d) => s + (d.metricas?.curtidas ?? 0), 0);
                const temMetrica = p.destinos.some((d) => d.metricas);
                const quando = p.publicado_em ?? p.agendado_para;
                return (
                  <li
                    key={p.id}
                    className="relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-secondary/40 md:grid md:grid-cols-[minmax(0,1fr)_140px_180px_140px_150px_44px] md:items-center md:gap-4"
                  >
                    <Link
                      to="/automacoes/posts/$id"
                      params={{ id: p.id }}
                      className="flex min-w-0 flex-1 items-start gap-3 after:absolute after:inset-0 md:items-center"
                    >
                      <Miniatura
                        capa={p.capa}
                        className="size-14 rounded-[10px] ring-1 ring-border md:size-12"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 break-words text-sm leading-snug md:line-clamp-1">
                          {primeiraLinha(p.legenda) || (
                            <span className="text-muted-foreground">Sem legenda</span>
                          )}
                        </span>
                        <span className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground md:hidden">
                          <span className="truncate tabular-nums">{dataHora(quando)}</span>
                          <RedesDoPost post={p} />
                          <span className="ml-auto">
                            <SeloStatus status={p.status} />
                          </span>
                        </span>
                        {p.origem === "automacao" && (
                          <span className="mt-1 hidden text-[11px] text-muted-foreground md:block">
                            Pronto pela automação
                          </span>
                        )}
                      </span>
                    </Link>
                    <span className="hidden md:block">
                      <RedesDoPost post={p} tamanho="size-[18px]" />
                    </span>
                    <span className="hidden text-[13px] tabular-nums text-foreground md:block">
                      {dataHora(quando)}
                    </span>
                    <span className="hidden text-xs text-muted-foreground md:block">
                      {temMetrica ? (
                        <>
                          <span className="font-medium tabular-nums text-foreground">
                            {num(alcance)}
                          </span>{" "}
                          alcance · <span className="tabular-nums">{num(curtidas)}</span> curt.
                        </>
                      ) : p.cliques != null ? (
                        `${num(p.cliques)} clique(s)`
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className="hidden md:block">
                      <SeloStatus status={p.status} />
                    </span>
                    <span className="relative z-10 -mr-2 md:mr-0">
                      <MenuAcoesPost post={p} podeEditar={podeEditar} />
                    </span>
                  </li>
                );
              })}
            </ul>
            {paginas > 1 && (
              <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5 text-sm text-muted-foreground">
                <span className="tabular-nums">
                  {num(total)} posts · página {pagina} de {paginas}
                </span>
                <span className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-11 sm:size-8"
                    disabled={pagina <= 1}
                    aria-label="Página anterior"
                    onClick={() =>
                      void navigate({
                        search: (s) => ({ ...s, pagina: pagina - 1 > 1 ? pagina - 1 : undefined }),
                      })
                    }
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-11 sm:size-8"
                    disabled={pagina >= paginas}
                    aria-label="Próxima página"
                    onClick={() => void navigate({ search: (s) => ({ ...s, pagina: pagina + 1 }) })}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </span>
              </div>
            )}
          </>
        )}
      </Secao>
    </div>
  );
}
