/**
 * Peças comuns dos relatórios gerenciais do ecossistema (C47): estado do filtro global na URL,
 * barra de filtros (o mesmo "Sua base | Assinantes" das outras telas + Ecossistema inteiro,
 * período, Minha/Geral, banco e responsável), navegação entre os relatórios, cartões, funil,
 * ranking e tabela com o caminho até a lista de origem. Visual do Painel geral (painel-geral.css).
 */
import { useCallback, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarRange,
  Globe2,
  Landmark,
  LayoutDashboard,
  ListFilter,
  Percent,
  RotateCcw,
  SlidersHorizontal,
  UserRound,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icone3D, type TomIcone3D } from "@/components/ui/icone-3d";
import { Estado3D } from "@/components/ui/estado-3d";
import { SubNavegacao } from "@/components/ui/sub-navegacao";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { FiltroBase } from "@/components/crm/filtro-base/filtro-base";
import { useFiltroBase, type UsoFiltroBase } from "@/components/crm/filtro-base/use-filtro-base";
import { SeletorBusca } from "@/components/visao-geral/seletor-busca";
import { getOpcoesAgilliza } from "@/lib/relatorios/producao-ecossistema.functions";
import { getRelatorioAgilliza, getRelatorioContas } from "@/lib/relatorios/ecossistema.functions";
import { usePermissao } from "@/hooks/use-permissao";
import { PERIODOS_PRODUCAO, type PeriodoProducao } from "@/lib/relatorios/producao-ecossistema";
import {
  BANCOS_RELATORIO,
  FILTROS_RELATORIO_PADRAO,
  filtrosRelatorioParaUrl,
  funil,
  intervaloDoRelatorio,
  lerFiltrosRelatorio,
  nomeDoBanco,
  planoDeLeitura,
  rotuloDoRecorte,
  valorMetrica,
  type BlocoEco,
  type FiltrosRelatorio,
  type LinhaAgrupada,
  type LinkOrigem,
  type Medidas,
  type Metrica,
} from "@/lib/relatorios/ecossistema";
import "@/components/visao-geral/painel-geral.css";

// --------------------------------------------------------------- formatos --

export const brl = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const brlCurto = (v: number) => {
  const a = Math.abs(v || 0);
  if (a >= 1e9) return `R$ ${(v / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} bi`;
  if (a >= 1e6) return `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (a >= 1e4) return `R$ ${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return brl(v);
};
export const int = (v: number) => (v || 0).toLocaleString("pt-BR");
export const pct = (v: number | null) =>
  v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
export const dias = (v: number | null) =>
  v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${v === 1 ? "dia" : "dias"}`;
export const dataBr = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;

/** Valor formatado de uma métrica (simples ou derivada). */
export function formatarMetrica(t: Medidas, m: Metrica): string {
  const v = valorMetrica(t, m);
  if (m === "aprovacao" || m === "conversao") return pct(v);
  if (m === "dias_ate_contrato") return dias(v);
  if (m === "valor_proposto" || m === "valor_contratado" || m === "ticket_medio") return v === null ? "—" : brl(v);
  return int(v ?? 0);
}

// ------------------------------------------------------- estado do filtro --

export interface UsoFiltrosRelatorio {
  filtros: FiltrosRelatorio;
  intervalo: ReturnType<typeof intervaloDoRelatorio>;
  definir: (parcial: Partial<FiltrosRelatorio>) => void;
  limpar: () => void;
  usoBase: UsoFiltroBase;
  rotulo: string;
}

/** Filtro global dos relatórios na URL (link compartilhável, voltar e recarregar mantêm). */
export function useFiltrosRelatorio(): UsoFiltrosRelatorio {
  const router = useRouter();
  const search = useRouterState({ select: (s) => s.location.search }) as Record<string, unknown>;
  const usoBase = useFiltroBase();
  const filtros = useMemo<FiltrosRelatorio>(() => {
    const f = lerFiltrosRelatorio(search);
    return { ...f, base: usoBase.filtro, visao: usoBase.pode ? f.visao : "recorte" };
  }, [search, usoBase.filtro, usoBase.pode]);
  const intervalo = useMemo(() => intervaloDoRelatorio(filtros), [filtros]);

  const navegar = useCallback(
    (f: FiltrosRelatorio) => {
      const atual = router.state.location;
      const resto: Record<string, unknown> = { ...(atual.search as Record<string, unknown>) };
      for (const k of ["visao", "base", "origem", "conta", "escopo", "periodo", "de", "ate", "banco", "usuario"]) {
        delete resto[k];
      }
      const novos = Object.fromEntries(
        Object.entries(filtrosRelatorioParaUrl(f)).filter(([, v]) => v !== undefined),
      );
      void router.navigate({ to: atual.pathname, search: { ...resto, ...novos } as never, replace: true } as never);
    },
    [router],
  );
  const definir = useCallback(
    (parcial: Partial<FiltrosRelatorio>) => navegar({ ...filtros, ...parcial }),
    [filtros, navegar],
  );
  const limpar = useCallback(() => navegar(FILTROS_RELATORIO_PADRAO), [navegar]);
  return { filtros, intervalo, definir, limpar, usoBase, rotulo: rotuloDoRecorte(filtros, usoBase.conta) };
}

export interface DadosEcossistema {
  agilliza: BlocoEco | null;
  tech: BlocoEco | null;
  escopo: "minha" | "geral";
  avisos: string[];
}

/**
 * As duas pontas do relatório em paralelo: a operação do Agilliza (sempre que o recorte a inclui)
 * e as contas do Agilliza Tech pela ponte (só para quem tem a permissão das contas — o servidor
 * confere de novo). O resultado só aparece quando as duas que valem chegaram.
 */
export function useRelatorioEcossistema(filtros: FiltrosRelatorio) {
  const agFn = useServerFn(getRelatorioAgilliza);
  const ctFn = useServerFn(getRelatorioContas);
  const contas = usePermissao("saas.contas", "view");
  const fila = usePermissao("saas.fila", "view");
  const licencas = usePermissao("saas.licencas", "view");
  const plano = planoDeLeitura(filtros, contas || fila || licencas);
  const ag = useQuery({
    queryKey: ["relatorio-eco-agilliza", filtros],
    queryFn: () => agFn({ data: filtros as never }),
    staleTime: 60_000,
  });
  const ct = useQuery({
    queryKey: ["relatorio-eco-contas", filtros],
    queryFn: () => ctFn({ data: filtros as never }),
    enabled: !!plano.tech,
    staleTime: 60_000,
  });
  const pronto = !!ag.data && (!plano.tech || !!ct.data);
  const data = useMemo<DadosEcossistema | undefined>(
    () =>
      pronto
        ? {
            agilliza: ag.data!.bloco,
            tech: plano.tech ? (ct.data?.bloco ?? null) : null,
            escopo: ag.data!.escopo,
            avisos: [...ag.data!.avisos, ...(plano.tech ? (ct.data?.avisos ?? []) : [])],
          }
        : undefined,
    [pronto, ag.data, ct.data, plano.tech],
  );
  return {
    data,
    isLoading: ag.isLoading || (!!plano.tech && ct.isLoading),
    error: ag.error ?? (plano.tech ? ct.error : null),
    refetch: () => Promise.all([ag.refetch(), plano.tech ? ct.refetch() : Promise.resolve()]),
  };
}

/** Parâmetros de URL que levam o MESMO filtro de um relatório para outro. */
export function searchDoFiltro(f: FiltrosRelatorio): Record<string, string> {
  return Object.fromEntries(
    Object.entries(filtrosRelatorioParaUrl(f)).filter((e): e is [string, string] => e[1] !== undefined),
  );
}

// --------------------------------------------------------------- navegação --

const RELATORIOS = [
  { to: "/relatorios/gerencial", rotulo: "Gerencial", icone: LayoutDashboard },
  { to: "/relatorios/operacional", rotulo: "Operacionais", icone: Workflow, tom: "violeta" as TomIcone3D },
  { to: "/relatorios/financeiros", rotulo: "Financeiro", icone: Wallet, tom: "sucesso" as TomIcone3D },
  { to: "/relatorios/comerciais", rotulo: "Produção e comissões", icone: Percent, tom: "ciano" as TomIcone3D },
  { to: "/relatorios/personalizados", rotulo: "Personalizados", icone: SlidersHorizontal, tom: "neutro" as TomIcone3D },
];

export function NavegacaoRelatorios() {
  return <SubNavegacao rotulo="Relatórios gerenciais" itens={RELATORIOS} />;
}

// ---------------------------------------------------------------- filtros --

export function Segmentado<T extends string>({
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string;
  valor: T;
  opcoes: { id: T; texto: string; icone: LucideIcon; dica?: string }[];
  aoMudar: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="pg-segmentado">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={valor === o.id}
          title={o.dica}
          data-depth="off"
          onClick={() => aoMudar(o.id)}
        >
          <o.icone aria-hidden className="size-3.5" />
          {o.texto}
        </button>
      ))}
    </div>
  );
}

function Campo({ rotulo, children, className }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("pg-filtro", className)}>
      <span className="pg-filtro-rotulo">{rotulo}</span>
      {children}
    </div>
  );
}

/**
 * Barra do filtro global. `soPeriodo` para relatórios que só existem no Agilliza (financeiro):
 * o recorte de base não se aplica e some.
 */
export function BarraFiltros({
  uso,
  soPeriodo = false,
  semPessoa = false,
}: {
  uso: UsoFiltrosRelatorio;
  soPeriodo?: boolean;
  semPessoa?: boolean;
}) {
  const { filtros: f, definir, limpar, usoBase } = uso;
  const opcoesFn = useServerFn(getOpcoesAgilliza);
  const opcoes = useQuery({
    queryKey: ["relatorios-eco-opcoes-agilliza"],
    queryFn: () => opcoesFn(),
    staleTime: 5 * 60_000,
    enabled: !semPessoa && !soPeriodo,
  });
  const ativo = JSON.stringify(searchDoFiltro(f)) !== JSON.stringify(searchDoFiltro(FILTROS_RELATORIO_PADRAO));

  return (
    <div data-tour="relatorios-filtros" className="pg-filtros" aria-label="Filtros do relatório">
      {!soPeriodo && usoBase.pode && (
        <Campo rotulo="Abrangência">
          <Segmentado
            rotulo="Abrangência"
            valor={f.visao}
            aoMudar={(visao) => definir({ visao })}
            opcoes={[
              { id: "recorte", texto: "Recorte", icone: ListFilter, dica: "Sua base ou assinantes, como nas outras telas" },
              { id: "ecossistema", texto: "Ecossistema", icone: Globe2, dica: "Agilliza, vinculados e todos os assinantes" },
            ]}
          />
        </Campo>
      )}
      {!soPeriodo && usoBase.pode && f.visao === "recorte" && (
        <Campo rotulo="Base" className="min-w-0">
          <FiltroBase uso={usoBase} />
        </Campo>
      )}
      <Campo rotulo="Período">
        <Select value={f.periodo} onValueChange={(v) => definir({ periodo: v as PeriodoProducao })}>
          <SelectTrigger className="h-9 w-full rounded-[10px] sm:w-[190px]" aria-label="Período">
            <CalendarRange className="mr-1 size-3.5 text-muted-foreground" aria-hidden />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODOS_PRODUCAO.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Campo>
      {f.periodo === "custom" && (
        <Campo rotulo="De / até">
          <div className="flex min-w-0 items-center gap-2">
            <Input
              type="date"
              aria-label="Data inicial"
              className="h-9 w-[150px] min-w-0"
              value={f.de ?? ""}
              onChange={(e) => e.target.value && definir({ de: e.target.value })}
            />
            <Input
              type="date"
              aria-label="Data final"
              className="h-9 w-[150px] min-w-0"
              value={f.ate ?? ""}
              onChange={(e) => e.target.value && definir({ ate: e.target.value })}
            />
          </div>
        </Campo>
      )}
      {!soPeriodo && (
        <Campo rotulo="Visão">
          <Segmentado
            rotulo="Visão"
            valor={f.escopo}
            aoMudar={(escopo) => definir({ escopo })}
            opcoes={[
              { id: "geral", texto: "Geral", icone: Users },
              { id: "minha", texto: "Minha", icone: UserRound, dica: "O que é seu e as contas da sua carteira" },
            ]}
          />
        </Campo>
      )}
      {!soPeriodo && (
        <Campo rotulo="Banco">
          <Select value={f.banco ?? "todos"} onValueChange={(v) => definir({ banco: v === "todos" ? undefined : v })}>
            <SelectTrigger className="h-9 w-full rounded-[10px] sm:w-[170px]" aria-label="Banco">
              <Landmark className="mr-1 size-3.5 text-muted-foreground" aria-hidden />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os bancos</SelectItem>
              {BANCOS_RELATORIO.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  <span className="inline-flex items-center gap-2">
                    <BancoLogo nome={b.nome} size="xs" />
                    {b.nome}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
      )}
      {!soPeriodo && !semPessoa && opcoes.data?.podeGeral && (
        <Campo rotulo="Responsável (Agilliza)">
          <SeletorBusca
            rotulo="Responsável"
            valor={f.usuario?.startsWith("a:") ? f.usuario : undefined}
            opcoes={(opcoes.data?.usuarios ?? []).map((u) => ({ id: u.id, nome: u.nome }))}
            aoEscolher={(id) => definir({ usuario: id })}
            vazio="Ninguém com esse nome"
            todos="Todos"
            icone={<UserRound className="size-3.5" />}
            className="w-full sm:w-[200px]"
          />
        </Campo>
      )}
      {ativo && (
        <Button type="button" variant="ghost" size="sm" className="pg-limpar h-9 gap-1.5 text-xs" onClick={limpar}>
          <RotateCcw className="size-3.5" aria-hidden />
          Limpar
        </Button>
      )}
    </div>
  );
}

/** Linha de contexto: o que está sendo mostrado e de onde vêm os números. */
export function Contexto({ uso, extra }: { uso: UsoFiltrosRelatorio; extra?: string }) {
  const { intervalo, filtros } = uso;
  return (
    <p className="pg-resumo">
      <BarChart3 className="size-3.5 shrink-0" aria-hidden />
      <span>
        <b className="font-medium text-foreground">{uso.rotulo}</b> · {dataBr(intervalo.de)} a {dataBr(intervalo.ate)}
        {filtros.banco ? ` · ${nomeDoBanco(filtros.banco)}` : ""}
        {filtros.escopo === "minha" ? " · Minha" : ""} · comparado a {dataBr(intervalo.anteriorDe)}–
        {dataBr(intervalo.anteriorAte)}
        {extra ? ` · ${extra}` : ""}
      </span>
    </p>
  );
}

export function Avisos({ avisos }: { avisos: string[] }) {
  if (!avisos.length) return null;
  return (
    <ul className="space-y-1.5" aria-live="polite">
      {avisos.map((a) => (
        <li
          key={a}
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-amber-900"
        >
          {a}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- cartões --

export function Cartao({
  titulo,
  subtitulo,
  icone,
  tom,
  acao,
  children,
  className,
}: {
  titulo: string;
  subtitulo?: string;
  icone: LucideIcon;
  tom?: TomIcone3D;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("pg-cartao", className)}>
      <header className="pg-cartao-cab">
        <Icone3D icone={icone} tom={tom ?? "marca"} tamanho="sm" />
        <div className="min-w-0 flex-1">
          <h2>{titulo}</h2>
          {subtitulo && <p>{subtitulo}</p>}
        </div>
        {acao}
      </header>
      {children}
    </section>
  );
}

/** Funil completo do ecossistema (simulações → registrados), com conversão e link por etapa. */
export function Funil({ t, link }: { t: Medidas; link: (etapa: string) => LinkOrigem }) {
  const etapas = funil(t);
  const topo = Math.max(1, ...etapas.map((e) => e.valor));
  return (
    <ol className="pg-funil">
      {etapas.map((e) => {
        const l = link(e.chave);
        return (
          <li key={e.chave}>
            <Link to={l.to as never} search={l.search as never} className="pg-funil-linha group" aria-label={`${e.rotulo}: abrir a lista`}>
              <span className="group-hover:text-foreground">{e.rotulo}</span>
              <b>{int(e.valor)}</b>
            </Link>
            <div className="pg-funil-trilho" aria-hidden>
              <span style={{ width: `${e.valor ? Math.max(3, (e.valor / topo) * 100) : 0}%` }} />
            </div>
            {e.conversao !== null || e.chave !== "simulacoes" ? (
              <small>{e.conversao === null ? "sem base na etapa anterior" : `${pct(e.conversao)} da etapa anterior`}</small>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Ranking com barra, avatar e números; cada linha pode levar à lista. */
export function Ranking({
  linhas,
  vazio,
  tipo,
  link,
}: {
  linhas: LinhaAgrupada[];
  vazio: string;
  tipo: "usuario" | "conta" | "banco";
  link?: (l: LinhaAgrupada) => LinkOrigem | null;
}) {
  if (!linhas.length) return <Estado3D compacto icone={Users} titulo={vazio} />;
  const medida: keyof Medidas = linhas.some((l) => l.totais.contratos)
    ? "contratos"
    : linhas.some((l) => l.totais.propostas)
      ? "propostas"
      : "simulacoes";
  const max = Math.max(1, ...linhas.map((l) => l.totais[medida]));
  return (
    <ol className="pg-ranking">
      {linhas.map((l, i) => {
        const destino = link?.(l) ?? null;
        const iniciais = l.rotulo
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p[0]?.toUpperCase())
          .join("");
        const nome = (
          <span className="pg-ranking-nome">
            <b title={l.rotulo}>{l.rotulo}</b>
            {l.detalhe && <small title={l.detalhe}>{l.detalhe}</small>}
            <span className="pg-ranking-barra" aria-hidden>
              <span style={{ width: `${l.totais[medida] ? Math.max(4, (l.totais[medida] / max) * 100) : 0}%` }} />
            </span>
          </span>
        );
        return (
          <li key={l.chave || `sem-${i}`}>
            <span className="pg-ranking-pos" aria-label={`${i + 1}º`}>
              {i + 1}
            </span>
            {tipo === "banco" ? (
              <BancoLogo nome={l.rotulo} size="md" />
            ) : (
              <span className={cn("pg-ranking-avatar", tipo === "conta" && "pg-ranking-avatar-conta")}>
                {iniciais || "?"}
              </span>
            )}
            {destino ? (
              <Link to={destino.to as never} search={destino.search as never} className="min-w-0 hover:underline">
                {nome}
              </Link>
            ) : (
              nome
            )}
            <span className="pg-ranking-num pg-ranking-sec">
              <b>{int(l.totais.contratos)}</b>
              <small>contratos</small>
            </span>
            <span className="pg-ranking-num pg-ranking-sec">
              <b>{int(l.totais.propostas)}</b>
              <small>propostas</small>
            </span>
            <span className="pg-ranking-num pg-ranking-valor" title={brl(l.totais.valor_contratado)}>
              <b>{brlCurto(l.totais.valor_contratado)}</b>
              <small className="pg-so-computador">financiado</small>
              <small className="pg-so-celular">
                {int(l.totais.contratos)} {l.totais.contratos === 1 ? "contrato" : "contratos"}
              </small>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export interface Coluna<T> {
  chave: string;
  rotulo: string;
  alinhar?: "esquerda" | "direita";
  valor: (l: T) => ReactNode;
  /** Classe extra (ex.: esconder no celular). */
  className?: string;
}

/** Tabela leve, rolável só por dentro no celular (a página nunca rola de lado). */
export function Tabela<T>({ colunas, linhas, chave, vazio }: { colunas: Coluna<T>[]; linhas: T[]; chave: (l: T, i: number) => string; vazio: string }) {
  if (!linhas.length) return <Estado3D compacto icone={ListFilter} titulo={vazio} />;
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            {colunas.map((c) => (
              <th
                key={c.chave}
                scope="col"
                className={cn(
                  "border-b border-[var(--pg-borda,#eceef2)] px-2.5 py-2 text-[11px] font-medium text-muted-foreground",
                  c.alinhar === "direita" ? "text-right" : "text-left",
                  c.className,
                )}
              >
                {c.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={chave(l, i)} className="transition-colors hover:bg-muted/60">
              {colunas.map((c) => (
                <td
                  key={c.chave}
                  className={cn(
                    "border-b border-[var(--pg-borda,#eceef2)] px-2.5 py-2 tabular-nums",
                    c.alinhar === "direita" ? "text-right" : "text-left",
                    c.className,
                  )}
                >
                  {c.valor(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Link discreto para a lista de origem de um número. */
export function NumeroComLink({ valor, link }: { valor: ReactNode; link: LinkOrigem | null }) {
  if (!link) return <>{valor}</>;
  return (
    <Link to={link.to as never} search={link.search as never} className="font-medium text-primary hover:underline">
      {valor}
    </Link>
  );
}

export function CarregandoOuErro({
  carregando,
  erro,
  tentar,
}: {
  carregando: boolean;
  erro: unknown;
  tentar: () => void;
}) {
  if (carregando) return <Estado3D tipo="carregando" titulo="Montando o relatório" descricao="Somando o ecossistema no período." />;
  if (erro)
    return (
      <Estado3D
        tipo="erro"
        descricao={(erro as Error)?.message || "Tente de novo em instantes."}
        acao={
          <Button type="button" variant="outline" onClick={tentar}>
            Tentar de novo
          </Button>
        }
      />
    );
  return null;
}
