/**
 * Aba "Auditoria" de Gestão de sistemas › Auditoria e LGPD (pedido do dono, 26/10/2026):
 * quem mudou o quê, quando e em qual conta de assinante. Mesma consulta de antes
 * (`lerAuditoriaPlataforma`); só a tela mudou de lugar e de desenho.
 */
import { useState } from "react";
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
  ShieldCheck,
  Table as TableIcon,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dado,
  EstadoErro,
  EstadoVazio,
  FaixaIndicadores,
  IconeGestao,
  Indicador,
  ListaCarregando,
  Secao,
  Selo,
  type Tom,
} from "@/components/plataforma/kit";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { RodapePaginas } from "@/components/plataforma/paginacao";
import {
  POR_PAGINA_AUDITORIA,
  lerAuditoriaPlataforma,
  type EventoAuditoria,
} from "@/lib/plataforma/auditoria.functions";

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
/** Tom do selo por ação: exclusão e destruição pedem atenção; revelação é informação. */
const TOM_ACAO: Record<string, Tom> = {
  insert: "sucesso",
  update: "marca",
  delete: "perigo",
  "lgpd.chaves_destruidas": "perigo",
  revelar: "alerta",
  "dado_sensivel.exibido": "alerta",
  login: "info",
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

export function AbaAuditoria() {
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
    <div className="space-y-5">
      <FaixaIndicadores>
        <Indicador
          icone={<ScrollText />}
          rotulo="Registros"
          valor={linhas.length.toLocaleString("pt-BR")}
          detalhe={`nesta página · últimos ${filtros.dias} dia(s)`}
          carregando={q.isLoading}
        />
        <Indicador
          icone={<Pencil />}
          rotulo="Alterações"
          valor={escritas.toLocaleString("pt-BR")}
          detalhe="inserções, edições e exclusões"
          carregando={q.isLoading}
        />
        <Indicador
          icone={<Users />}
          rotulo="Pessoas envolvidas"
          valor={atores.toLocaleString("pt-BR")}
          detalhe="nos registros listados"
          carregando={q.isLoading}
        />
        <Indicador
          icone={<TableIcon />}
          rotulo="Tabelas tocadas"
          valor={entidades.length.toLocaleString("pt-BR")}
          detalhe={entidades[0] ? `${entidades[0].entidade} lidera` : "no período"}
          carregando={q.isLoading}
        />
      </FaixaIndicadores>

      <Secao
        titulo="Filtros"
        descricao="Combine os filtros; o painel ao lado também filtra com um toque."
        icone={<Search />}
        acoes={
          <>
            {temFiltro && (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11 sm:min-h-8"
                onClick={() => {
                  setFiltros(FILTROS_INICIAIS);
                  setBusca("");
                }}
              >
                <X className="mr-1 size-4" /> Limpar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 sm:min-h-8"
              onClick={() => q.refetch()}
              disabled={q.isFetching}
            >
              <RefreshCw className={`mr-1.5 size-4 ${q.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </>
        }
      >
        <div data-tour="plataforma-auditoria-filtros" className="space-y-3">
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              trocar("q", busca.trim());
            }}
          >
            <div className="min-w-0 space-y-1 sm:w-96">
              <Label htmlFor="aud-busca">Buscar</Label>
              <Input
                id="aud-busca"
                className="text-base sm:text-sm"
                placeholder="Tabela ou id do registro…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                maxLength={120}
              />
            </div>
            <Button type="submit" variant="secondary" className="min-h-11 sm:min-h-10">
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
            <div className="min-w-0 space-y-1">
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
        </div>
      </Secao>

      <div data-tour="plataforma-auditoria-registros" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Secao
          titulo="Registros"
          descricao="Do mais recente para o mais antigo. Toque em um registro para ver o que mudou."
          semRespiro
        >
          {q.isError ? (
            <EstadoErro
              mensagem={mensagemDeErro(q.error, "Não foi possível ler a auditoria da plataforma.")}
              onTentar={() => q.refetch()}
            />
          ) : q.isLoading ? (
            <ListaCarregando linhas={6} />
          ) : !linhas.length ? (
            <EstadoVazio
              icone={<ScrollText />}
              titulo="Nenhum registro no período"
              descricao="Nada foi alterado nesta janela de tempo, ou os filtros estão restritos demais."
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {linhas.map((l) => {
                const Ic = ICONE_ACAO[l.acao] ?? Code;
                const tom = TOM_ACAO[l.acao] ?? "neutro";
                return (
                  <li key={`${l.id}-${l.criado_em}`}>
                    <button
                      type="button"
                      onClick={() => setAberto(l)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/[0.03] focus-visible:bg-primary/[0.04] focus-visible:outline-none"
                    >
                      <IconeGestao icone={<Ic />} tom={tom} tamanho="sm" className="mt-0.5" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <Selo tom={tom}>{rotuloAcao(l.acao)}</Selo>
                          <span className="min-w-0 break-all font-mono text-xs font-medium">
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
        </Secao>

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
          <p className="flex items-start gap-2 rounded-[14px] border border-border/80 bg-primary/[0.03] p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            Nenhum registro pode ser alterado depois de gravado. Nos campos sensíveis, os valores de
            antes e depois chegam mascarados. A auditoria do próprio Agilliza fica em Configurações
            gerais › Auditoria e logs.
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
    <Secao titulo={titulo} descricao={descricao}>
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
                className={`grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-primary/[0.04] sm:min-h-0 ${
                  i.ativo ? "bg-primary/[0.07] ring-1 ring-primary/25" : ""
                }`}
              >
                <span className={`truncate ${i.mono ? "font-mono" : ""}`}>{i.rotulo}</span>
                <span className="font-medium tabular-nums">{i.total.toLocaleString("pt-BR")}</span>
                <span className="col-span-2 mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
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
    </Secao>
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
        <Selo tom={TOM_ACAO[l.acao] ?? "neutro"}>{rotuloAcao(l.acao)}</Selo>
        <Selo tom="marca">{rotuloAtor(l)}</Selo>
        <Selo>{l.conta ?? (l.ator_tipo === "plataforma" ? "Gestão da plataforma" : "sem conta")}</Selo>
      </div>

      <Secao titulo="Contexto">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Dado rotulo="Conta">{l.conta ?? "—"}</Dado>
          <Dado rotulo="Registro">
            <span className="break-all font-mono text-xs">{l.entidade_id ?? "—"}</span>
          </Dado>
          <Dado rotulo="Origem (IP)">{l.ip ?? "—"}</Dado>
          <Dado rotulo="Tipo de ator">
            {l.ator_tipo ? (TIPO_ATOR[l.ator_tipo] ?? l.ator_tipo) : "—"}
          </Dado>
        </dl>
      </Secao>

      {chaves.length > 0 && (
        <Secao
          titulo="O que mudou"
          descricao={
            antesObj && depoisObj
              ? "Antes e depois, só os campos que mudaram."
              : antesObj
                ? "O registro como estava antes de sair."
                : "O registro como entrou."
          }
        >
          <ul className="divide-y divide-border/70 text-xs">
            {chaves.map((k) => (
              <li key={k} className="grid gap-1 py-2">
                <span className="font-mono font-medium">{k}</span>
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="break-all rounded bg-destructive/[0.08] px-1.5 py-0.5 line-through decoration-destructive/40">
                    {k in antes ? valor(antes[k]) : "—"}
                  </span>
                  <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="break-all rounded bg-success/10 px-1.5 py-0.5">
                    {k in depois ? valor(depois[k]) : "—"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {detalhes && (
        <Secao titulo="Detalhes">
          <dl className="grid gap-3 sm:grid-cols-2">
            {Object.entries(detalhes).map(([k, v]) => (
              <Dado key={k} rotulo={k.replace(/_/g, " ")}>
                <span className="break-words">{valor(v)}</span>
              </Dado>
            ))}
          </dl>
        </Secao>
      )}

      <details className="rounded-[14px] border border-border/80 p-3">
        <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground sm:min-h-0">
          <Code className="size-4" aria-hidden /> Ver o registro bruto
        </summary>
        <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">
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
