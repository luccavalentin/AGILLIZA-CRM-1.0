import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Code,
  Eye,
  LogIn,
  Pencil,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  Table as TableIcon,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { AdminHero } from "@/components/admin/admin-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { assertModuloPermitido } from "@/lib/route-guards";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { RodapePaginas } from "@/components/plataforma/paginacao";
import {
  POR_PAGINA_AUDITORIA,
  lerAuditoriaPlataforma,
  type EventoAuditoria,
} from "@/lib/plataforma/auditoria.functions";

export const Route = createFileRoute("/_authenticated/plataforma/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria da plataforma — Plataforma — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.auditoria"),
  component: Pagina,
});

const TODOS = "__todos__";

const ICONE_ACAO: Record<string, LucideIcon> = {
  insert: Plus,
  update: Pencil,
  delete: Trash2,
  login: LogIn,
  revelar: Eye,
  "dado_sensivel.exibido": Eye,
};
const ACAO: Record<string, string> = {
  insert: "Inserção",
  update: "Edição",
  delete: "Exclusão",
  login: "Entrada",
  revelar: "Revelação",
  "dado_sensivel.exibido": "Dado sensível exibido",
  "lgpd.chaves_destruidas": "Chaves destruídas (LGPD)",
};
const TIPO_ATOR: Record<string, string> = {
  plataforma: "Gestão da plataforma",
  corretor: "Corretor",
  imobiliaria: "Imobiliária",
  parceiro: "Parceiro",
  cliente: "Cliente",
  sistema: "Sistema",
};

interface Filtros {
  q: string;
  acao: string;
  entidade: string;
  conta: string;
  ator: string;
  dias: number;
}
const FILTROS_INICIAIS: Filtros = { q: "", acao: "", entidade: "", conta: "", ator: "", dias: 7 };

const rotuloAcao = (a: string) => ACAO[a] ?? a;
const rotuloAtor = (l: EventoAuditoria) =>
  l.ator ?? (l.ator_tipo ? (TIPO_ATOR[l.ator_tipo] ?? l.ator_tipo) : "Sistema");

/** Data e hora em pt-BR, no fuso de Brasília. */
function dataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Valor de campo legível: texto e número como estão, objeto em uma linha. */
const valor = (v: unknown) =>
  v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

const comoObjeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

function Pagina() {
  const lerFn = useServerFn(lerAuditoriaPlataforma);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<EventoAuditoria | null>(null);
  // A página vale para os filtros em que foi escolhida: mudou o filtro, volta para a primeira.
  const [paginaDe, setPaginaDe] = useState({ filtros, pagina: 1 });
  const pagina = paginaDe.filtros === filtros ? paginaDe.pagina : 1;

  const q = useQuery({
    queryKey: ["plataforma-auditoria", filtros, pagina],
    queryFn: () =>
      lerFn({
        data: {
          q: filtros.q || null,
          acao: filtros.acao || null,
          entidade: filtros.entidade || null,
          conta: filtros.conta || null,
          ator: filtros.ator || null,
          dias: filtros.dias,
          pagina,
        },
      }),
    placeholderData: (anterior) => anterior,
  });

  const linhas = q.data?.linhas ?? [];
  const entidades = q.data?.entidades ?? [];
  const pessoas = q.data?.pessoas ?? [];
  const contas = q.data?.contas ?? [];

  const escritas = linhas.filter((l) => l.acao !== "select").length;
  const atores = new Set(linhas.map((l) => l.ator).filter(Boolean)).size;
  const porAcao = [...new Set(linhas.map((l) => l.acao))]
    .map((a) => ({ acao: a, total: linhas.filter((l) => l.acao === a).length }))
    .sort((a, b) => b.total - a.total);
  // As ações conhecidas ficam sempre no filtro; as que aparecem no período entram junto.
  const opcoesAcao = [...new Set([...Object.keys(ACAO), ...porAcao.map((a) => a.acao)])].sort();

  const trocar = <K extends keyof Filtros>(k: K, v: Filtros[K]) =>
    setFiltros((f) => ({ ...f, [k]: v }));
  // Clicar no painel lateral liga o filtro; clicar de novo desliga.
  const alternar = (k: "acao" | "entidade" | "ator", v: string) =>
    setFiltros((f) => ({ ...f, [k]: f[k] === v ? "" : v }));
  const temFiltro =
    Boolean(filtros.q || filtros.acao || filtros.entidade || filtros.conta || filtros.ator) ||
    filtros.dias !== 7;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        secao="Gestão de sistemas"
        icon={<ScrollText className="h-5 w-5" />}
        titulo="Auditoria da plataforma"
        descricao="Quem mudou o quê, quando e em qual conta de assinante. O registro não pode ser alterado depois de gravado. A auditoria do próprio Agilliza fica em Administração › Auditoria."
        acoes={
          <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`mr-2 size-4 ${q.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      />

      {q.isError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(q.error, "Não foi possível ler a auditoria da plataforma.")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metrica
          icone={<ScrollText className="size-4" />}
          rotulo="Registros"
          valor={linhas.length}
          detalhe={`nesta página · últimos ${filtros.dias} dia(s)`}
          carregando={q.isLoading}
        />
        <Metrica
          icone={<Pencil className="size-4" />}
          rotulo="Alterações"
          valor={escritas}
          detalhe="inserções, edições e exclusões"
          carregando={q.isLoading}
        />
        <Metrica
          icone={<Users className="size-4" />}
          rotulo="Pessoas envolvidas"
          valor={atores}
          detalhe="nos registros listados"
          carregando={q.isLoading}
        />
        <Metrica
          icone={<TableIcon className="size-4" />}
          rotulo="Tabelas tocadas"
          valor={entidades.length}
          detalhe={entidades[0] ? `${entidades[0].entidade} lidera` : "no período"}
          carregando={q.isLoading}
        />
      </div>

      <section
        aria-label="Filtros da auditoria"
        className="space-y-3 rounded-lg border border-border bg-card p-4"
      >
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            trocar("q", busca.trim());
          }}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor="aud-busca">Buscar</Label>
            <Input
              id="aud-busca"
              placeholder="Tabela ou id do registro…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              maxLength={120}
            />
          </div>
          <Button type="submit" variant="secondary">
            <Search className="mr-2 size-4" /> Buscar
          </Button>
        </form>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Filtro
            id="aud-acao"
            rotulo="Ação"
            valor={filtros.acao}
            todos="Todas as ações"
            onChange={(v) => trocar("acao", v)}
            opcoes={opcoesAcao.map((a) => ({ valor: a, rotulo: rotuloAcao(a) }))}
          />
          <Filtro
            id="aud-tabela"
            rotulo="Tabela"
            valor={filtros.entidade}
            todos="Todas as tabelas"
            onChange={(v) => trocar("entidade", v)}
            opcoes={entidades.map((e) => ({
              valor: e.entidade,
              rotulo: `${e.entidade} (${e.total})`,
            }))}
          />
          <Filtro
            id="aud-pessoa"
            rotulo="Pessoa"
            valor={filtros.ator}
            todos="Todas as pessoas"
            onChange={(v) => trocar("ator", v)}
            opcoes={pessoas.map((p) => ({
              valor: p.id,
              rotulo: `${p.nome ?? "sem nome"} (${p.total})`,
            }))}
          />
          <Filtro
            id="aud-conta"
            rotulo="Conta"
            valor={filtros.conta}
            todos="Todas as contas"
            onChange={(v) => trocar("conta", v)}
            opcoes={contas.map((c) => ({ valor: c.id, rotulo: c.nome }))}
          />
          <div className="space-y-1">
            <Label htmlFor="aud-periodo">Período</Label>
            <Select value={String(filtros.dias)} onValueChange={(v) => trocar("dias", Number(v))}>
              <SelectTrigger id="aud-periodo" aria-label="Período">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Últimas 24 horas</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {temFiltro && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFiltros(FILTROS_INICIAIS);
              setBusca("");
            }}
          >
            <X className="mr-1 size-4" /> Limpar filtros
          </Button>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 rounded-lg border border-border bg-card">
          <header className="border-b border-border p-4">
            <h2 className="font-semibold">Registros</h2>
            <p className="text-sm text-muted-foreground">
              Do mais recente para o mais antigo. Toque em um registro para ver o que mudou.
            </p>
          </header>
          {q.isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : !linhas.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum registro no período. Nada foi alterado nesta janela de tempo, ou os filtros
              estão restritos demais.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {linhas.map((l) => {
                const Ic = ICONE_ACAO[l.acao] ?? Code;
                return (
                  <li key={`${l.id}-${l.criado_em}`}>
                    <button
                      type="button"
                      onClick={() => setAberto(l)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    >
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Ic className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge variant={l.acao === "delete" ? "destructive" : "secondary"}>
                            {rotuloAcao(l.acao)}
                          </Badge>
                          <span className="min-w-0 break-all font-mono text-xs font-semibold">
                            {l.entidade}
                          </span>
                        </span>
                        <span className="mt-0.5 block break-words text-xs text-muted-foreground">
                          {rotuloAtor(l)}
                          {l.conta
                            ? ` · ${l.conta}`
                            : l.ator_tipo === "plataforma"
                              ? " · Gestão da plataforma"
                              : ""}
                          {l.ip ? ` · ${l.ip}` : ""}
                        </span>
                        <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground sm:hidden">
                          {dataHora(l.criado_em)}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
                        {dataHora(l.criado_em)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <RodapePaginas
            pagina={pagina}
            porPagina={POR_PAGINA_AUDITORIA}
            quantidade={linhas.length}
            temMais={q.data?.temMais}
            carregando={q.isFetching}
            onPagina={(p) => setPaginaDe({ filtros, pagina: p })}
          />
        </section>

        <div className="min-w-0 space-y-4">
          <Barras
            titulo="Tabelas mais tocadas"
            descricao="No período. Toque para filtrar."
            vazio="Nenhuma tabela foi tocada no período."
            itens={entidades.slice(0, 10).map((e) => ({
              chave: e.entidade,
              rotulo: e.entidade,
              total: e.total,
              ativo: filtros.entidade === e.entidade,
              mono: true,
            }))}
            onEscolher={(v) => alternar("entidade", v)}
          />
          <Barras
            titulo="Quem mais mexeu"
            descricao="Pessoas com registro no período. Toque para ver só as dela."
            vazio="Nenhuma pessoa registrada no período — só o sistema."
            itens={pessoas.slice(0, 10).map((p) => ({
              chave: p.id,
              rotulo: p.nome ?? "sem nome",
              total: p.total,
              ativo: filtros.ator === p.id,
            }))}
            onEscolher={(v) => alternar("ator", v)}
          />
          <Barras
            titulo="Por ação"
            descricao="Nos registros listados. Toque para filtrar."
            vazio="Nenhuma ação nos registros listados."
            itens={porAcao.map((a) => ({
              chave: a.acao,
              rotulo: rotuloAcao(a.acao),
              total: a.total,
              ativo: filtros.acao === a.acao,
            }))}
            onEscolher={(v) => alternar("acao", v)}
          />
          <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Nenhum registro pode ser alterado depois de gravado. Nos campos sensíveis, os valores de
            antes e depois chegam mascarados.
          </p>
        </div>
      </div>

      <Sheet open={!!aberto} onOpenChange={(v) => !v && setAberto(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {aberto && (
            <>
              <SheetHeader>
                <SheetTitle className="break-words">
                  {rotuloAcao(aberto.acao)} em <span className="font-mono">{aberto.entidade}</span>
                </SheetTitle>
                <SheetDescription>
                  {dataHora(aberto.criado_em)} · {rotuloAtor(aberto)}
                </SheetDescription>
              </SheetHeader>
              <Detalhe l={aberto} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Metrica({
  icone,
  rotulo,
  valor: v,
  detalhe,
  carregando,
}: {
  icone: ReactNode;
  rotulo: string;
  valor: number;
  detalhe?: string;
  carregando: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-3 md:p-4">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        {icone} {rotulo}
      </p>
      {carregando ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <p className="mt-1 text-2xl font-bold tabular-nums">{v.toLocaleString("pt-BR")}</p>
      )}
      {detalhe && <p className="truncate text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

function Filtro({
  id,
  rotulo,
  valor: v,
  todos,
  opcoes,
  onChange,
}: {
  id: string;
  rotulo: string;
  valor: string;
  todos: string;
  opcoes: { valor: string; rotulo: string }[];
  onChange: (v: string) => void;
}) {
  // O valor escolhido continua na lista mesmo se sumir das opções do período.
  const lista =
    v && !opcoes.some((o) => o.valor === v) ? [{ valor: v, rotulo: v }, ...opcoes] : opcoes;
  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={id}>{rotulo}</Label>
      <Select value={v || TODOS} onValueChange={(x) => onChange(x === TODOS ? "" : x)}>
        <SelectTrigger id={id} aria-label={rotulo} className="min-w-0">
          <SelectValue placeholder={todos} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>{todos}</SelectItem>
          {lista.map((o) => (
            <SelectItem key={o.valor} value={o.valor}>
              {o.rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Barras({
  titulo,
  descricao,
  vazio,
  itens,
  onEscolher,
}: {
  titulo: string;
  descricao: string;
  vazio: string;
  itens: { chave: string; rotulo: string; total: number; ativo: boolean; mono?: boolean }[];
  onEscolher: (chave: string) => void;
}) {
  const maior = Math.max(1, ...itens.map((i) => i.total));
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      <p className="mb-3 text-xs text-muted-foreground">{descricao}</p>
      {!itens.length ? (
        <p className="text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="space-y-1.5">
          {itens.map((i) => (
            <li key={i.chave}>
              <button
                type="button"
                onClick={() => onEscolher(i.chave)}
                aria-pressed={i.ativo}
                className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-muted/60 ${
                  i.ativo ? "bg-primary/10 ring-1 ring-primary/30" : ""
                }`}
              >
                <span className={`truncate ${i.mono ? "font-mono" : ""}`}>{i.rotulo}</span>
                <b className="tabular-nums">{i.total.toLocaleString("pt-BR")}</b>
                <span className="col-span-2 mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary/70"
                    style={{ width: `${(i.total / maior) * 100}%` }}
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Detalhe({ l }: { l: EventoAuditoria }) {
  const antesObj = comoObjeto(l.antes);
  const depoisObj = comoObjeto(l.depois);
  const antes = antesObj ?? {};
  const depois = depoisObj ?? {};
  // Na edição, só os campos que mudaram; na inserção e na exclusão, o registro inteiro.
  const chaves = [...new Set([...Object.keys(antes), ...Object.keys(depois)])].filter(
    (k) => !(antesObj && depoisObj) || valor(antes[k]) !== valor(depois[k]),
  );
  const detalhesObj = comoObjeto(l.detalhes);
  const detalhes = detalhesObj && Object.keys(detalhesObj).length > 0 ? detalhesObj : null;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <Badge>{rotuloAtor(l)}</Badge>
        <Badge variant="outline">
          {l.conta ?? (l.ator_tipo === "plataforma" ? "Gestão da plataforma" : "sem conta")}
        </Badge>
      </div>

      <section className="rounded-lg border border-border p-3">
        <h3 className="mb-2 text-sm font-semibold">Contexto</h3>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Par rotulo="Conta">{l.conta ?? "—"}</Par>
          <Par rotulo="Registro">
            <span className="break-all font-mono text-xs">{l.entidade_id ?? "—"}</span>
          </Par>
          <Par rotulo="Origem (IP)">{l.ip ?? "—"}</Par>
          <Par rotulo="Tipo de ator">
            {l.ator_tipo ? (TIPO_ATOR[l.ator_tipo] ?? l.ator_tipo) : "—"}
          </Par>
        </dl>
      </section>

      {chaves.length > 0 && (
        <section className="rounded-lg border border-border p-3">
          <h3 className="text-sm font-semibold">O que mudou</h3>
          <p className="mb-2 text-xs text-muted-foreground">
            {antesObj && depoisObj
              ? "Antes e depois, só os campos que mudaram."
              : antesObj
                ? "O registro como estava antes de sair."
                : "O registro como entrou."}
          </p>
          <ul className="divide-y divide-border text-xs">
            {chaves.map((k) => (
              <li key={k} className="grid gap-1 py-2">
                <span className="font-mono font-semibold">{k}</span>
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="break-all rounded bg-destructive/10 px-1.5 py-0.5 line-through decoration-destructive/40">
                    {k in antes ? valor(antes[k]) : "—"}
                  </span>
                  <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="break-all rounded bg-emerald-500/10 px-1.5 py-0.5">
                    {k in depois ? valor(depois[k]) : "—"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {detalhes && (
        <section className="rounded-lg border border-border p-3">
          <h3 className="mb-2 text-sm font-semibold">Detalhes</h3>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {Object.entries(detalhes).map(([k, v]) => (
              <Par key={k} rotulo={k.replace(/_/g, " ")}>
                <span className="break-words">{valor(v)}</span>
              </Par>
            ))}
          </dl>
        </section>
      )}

      <details className="rounded-lg border border-border p-3">
        <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <Code className="size-4" aria-hidden /> Ver o registro bruto
        </summary>
        <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/50 p-2 text-xs">
          {JSON.stringify(
            {
              acao: l.acao,
              entidade: l.entidade,
              entidade_id: l.entidade_id,
              ator_tipo: l.ator_tipo,
              antes: l.antes,
              depois: l.depois,
              detalhes: l.detalhes,
            },
            null,
            2,
          )}
        </pre>
      </details>

      <p className="text-xs text-muted-foreground">
        Colunas sensíveis já saem mascaradas da própria trigger de auditoria — o valor em claro
        nunca chega a esta tela.
      </p>
    </div>
  );
}

function Par({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}
