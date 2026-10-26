import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlarmClock,
  CalendarRange,
  Hourglass,
  Network,
  Search,
  Sigma,
  Wallet,
  X,
} from "lucide-react";
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
import { BancoLogo } from "@/components/bancos/banco-logo";
import { cn } from "@/lib/utils";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL } from "@/lib/financeiro/format";
import { listarAnalistasDaFila } from "@/lib/plataforma/fila.functions";
import { ROTULO_PROPOSTA_ASSINANTE } from "@/lib/plataforma/rotulos-proposta-assinante";
import {
  listarPropostasDoGrupo,
  listarUsuariosDaConta,
} from "@/lib/plataforma/filtro-base.functions";
import type { AlvoDoFiltro, ContaFiltro } from "@/lib/plataforma/filtro-base";
import { PropostasAssinantesInterativas } from "@/components/plataforma/fila-assinantes/lista";
import {
  BANCOS_ASSINANTES,
  CHAVES_URL_PAINEL,
  chipsAtivos,
  FILTROS_VAZIOS,
  lerFiltrosDaUrl,
  normalizarFiltros,
  paramsDosFiltros,
  payloadDosFiltros,
  semFiltro,
  type Aceite,
  type FiltrosPainel,
} from "./filtros";

const ALTO = "h-11 md:h-10";
const TODOS = "__todos__";

/** Filtros do painel na URL (?situacao=&banco=…), sem mexer no resto do endereço. */
function useFiltrosNaUrl(): [FiltrosPainel, (f: FiltrosPainel) => void] {
  const router = useRouter();
  const search = useRouterState({ select: (s) => s.location.search }) as Record<string, unknown>;
  const chave = CHAVES_URL_PAINEL.map((k) => String(search?.[k] ?? "")).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filtros = useMemo(() => lerFiltrosDaUrl(search), [chave]);
  const definir = useCallback(
    (f: FiltrosPainel) => {
      const atual = router.state.location;
      const limpo: Record<string, unknown> = { ...(atual.search as Record<string, unknown>) };
      for (const k of CHAVES_URL_PAINEL) delete limpo[k];
      void router.navigate({
        to: atual.pathname,
        search: { ...limpo, ...paramsDosFiltros(f) } as never,
        replace: true,
      } as never);
    },
    [router],
  );
  return [filtros, definir];
}

/**
 * Propostas de um grupo do Agilliza Tech no desenho da Gestão de propostas de lá (C30):
 * indicadores, situações com contagem, filtros (situação, banco, período, responsável, analista,
 * aceite, busca), chips ativos, paginação no servidor e as MESMAS ações da fila (ver, assumir,
 * levar ao Agilliza e enviar ao banco, designar, devolver, acompanhar).
 */
export function PainelPropostasGrupo({
  alvo,
  conta,
}: {
  alvo: AlvoDoFiltro;
  conta: ContaFiltro | null;
}) {
  const [filtros, definir] = useFiltrosNaUrl();
  const mudar = (parcial: Partial<FiltrosPainel>) => definir({ ...filtros, pagina: 1, ...parcial });

  // Busca com debounce: a URL só muda quando a pessoa para de digitar.
  const [q, setQ] = useState(filtros.termo);
  useEffect(() => setQ(filtros.termo), [filtros.termo]);
  useEffect(() => {
    if (q.trim() === filtros.termo) return;
    const t = setTimeout(() => mudar({ termo: q.trim() }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const podeFila = usePermissao("saas.fila", "view");
  const listarFn = useServerFn(listarPropostasDoGrupo);
  const analistasFn = useServerFn(listarAnalistasDaFila);
  const usuariosFn = useServerFn(listarUsuariosDaConta);

  const payload = payloadDosFiltros(filtros, alvo);
  const consulta = useQuery({
    queryKey: ["plataforma-fila", "grupo", payload],
    queryFn: () => listarFn({ data: payload! }),
    enabled: !!payload,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const analistas = useQuery({
    queryKey: ["plataforma-fila", "analistas"],
    queryFn: () => analistasFn(),
    enabled: podeFila,
    staleTime: 5 * 60_000,
  });
  const usuarios = useQuery({
    queryKey: ["plataforma-conta-usuarios", alvo.licenca],
    queryFn: () => usuariosFn({ data: { licenca: alvo.licenca! } }),
    enabled: !!alvo.licenca,
    staleTime: 5 * 60_000,
  });

  const r = consulta.data;
  const porPagina = r?.porPagina ?? 50;
  const total = r?.total ?? 0;
  const nomes = {
    usuarios: Object.fromEntries((usuarios.data ?? []).map((u) => [u.id, u.nome])),
    analistas: Object.fromEntries((analistas.data ?? []).map((u) => [u.id, u.nome])),
  };
  const chips = chipsAtivos(filtros, nomes);
  const situacoes = r?.situacoes ?? {};
  const totalSituacoes = Object.values(situacoes).reduce((a, b) => a + Number(b || 0), 0);

  return (
    <div className="space-y-4">
      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
        <Indicador icone={Sigma} rotulo="Propostas" valor={r ? String(total) : undefined} detalhe="com estes filtros" />
        <Indicador
          icone={Hourglass}
          rotulo="Esperando analista"
          valor={r ? String(r.pendentes) : undefined}
          detalhe={filtros.aceite === "pendentes" ? "filtrando" : "toque para filtrar"}
          destaque={(r?.pendentes ?? 0) > 0}
          onClick={() => mudar({ aceite: filtros.aceite === "pendentes" ? "todas" : "pendentes" })}
          ativo={filtros.aceite === "pendentes"}
        />
        <Indicador
          icone={AlarmClock}
          rotulo="Prazo estourado"
          valor={r ? String(r.atrasadas) : undefined}
          detalhe="antes do envio ao banco"
          alerta={(r?.atrasadas ?? 0) > 0}
        />
        <Indicador icone={Wallet} rotulo="Volume financiado" valor={r ? formatBRL(r.volume) : undefined} detalhe="pedido nas propostas" />
      </div>

      {/* Situações com contagem (rolam dentro da faixa no celular, nunca a página) */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Situação">
        <div className="flex w-max gap-1.5">
          <ChipSituacao ativo={!filtros.status} rotulo="Todas" n={totalSituacoes} onClick={() => mudar({ status: null })} />
          {Object.keys(ROTULO_PROPOSTA_ASSINANTE)
            .filter((s) => Number(situacoes[s] ?? 0) > 0 || filtros.status === s)
            .map((s) => (
              <ChipSituacao
                key={s}
                ativo={filtros.status === s}
                rotulo={ROTULO_PROPOSTA_ASSINANTE[s]}
                n={Number(situacoes[s] ?? 0)}
                onClick={() => mudar({ status: filtros.status === s ? null : s })}
              />
            ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-3 shadow-sm sm:p-4">
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
          <div className="relative md:col-span-2 xl:col-span-1">
            <Label htmlFor="propostas-grupo-busca" className="sr-only">
              Buscar proposta
            </Label>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="propostas-grupo-busca"
              className={cn(ALTO, "rounded-xl pl-9")}
              placeholder="Código, cliente, nº no banco ou ID H."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={filtros.banco ?? TODOS} onValueChange={(v) => mudar({ banco: v === TODOS ? null : v })}>
            <SelectTrigger className={cn(ALTO, "rounded-xl")} aria-label="Banco">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os bancos</SelectItem>
              {BANCOS_ASSINANTES.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  <span className="inline-flex items-center gap-2">
                    <BancoLogo nome={b.nome} size="xs" /> {b.nome}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filtros.analista ?? TODOS}
            onValueChange={(v) => mudar({ analista: v === TODOS ? null : v })}
            disabled={!podeFila}
          >
            <SelectTrigger className={cn(ALTO, "rounded-xl")} aria-label="Analista">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os analistas</SelectItem>
              <SelectItem value="sem">Sem analista</SelectItem>
              {(analistas.data ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filtros.usuario ?? TODOS}
            onValueChange={(v) => mudar({ usuario: v === TODOS ? null : v })}
            disabled={!alvo.licenca}
          >
            <SelectTrigger
              className={cn(ALTO, "rounded-xl")}
              aria-label="Responsável na conta"
              title={alvo.licenca ? undefined : "Escolha um assinante para filtrar pelo responsável"}
            >
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>{alvo.licenca ? "Todos da conta" : "Responsável (escolha a conta)"}</SelectItem>
              {(usuarios.data ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Label className="col-span-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:col-span-1">
              <CalendarRange className="size-3.5" /> Criadas
            </Label>
            <Input
              type="date"
              aria-label="Criadas desde"
              className={cn(ALTO, "rounded-xl sm:w-40")}
              value={filtros.de ?? ""}
              max={filtros.ate ?? undefined}
              onChange={(e) => mudar({ de: e.target.value || null })}
            />
            <Input
              type="date"
              aria-label="Criadas até"
              className={cn(ALTO, "rounded-xl sm:w-40")}
              value={filtros.ate ?? ""}
              min={filtros.de ?? undefined}
              onChange={(e) => mudar({ ate: e.target.value || null })}
            />
          </div>
          <div role="tablist" aria-label="Aceite" className="grid grid-cols-3 gap-1 rounded-xl bg-muted/70 p-1 md:inline-grid">
            {(
              [
                ["todas", "Todas"],
                ["pendentes", "Esperando"],
                ["minhas", "Minhas"],
              ] as [Aceite, string][]
            ).map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filtros.aceite === id}
                onClick={() => mudar({ aceite: id })}
                className={cn(
                  "inline-flex h-9 items-center justify-center rounded-lg px-3 text-[13px] font-medium transition-colors",
                  filtros.aceite === id
                    ? "bg-background text-primary shadow-sm ring-1 ring-primary/15"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
            {chips.map((c) => (
              <button
                key={c.chave}
                type="button"
                onClick={() => definir(semFiltro(filtros, c.chave))}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/15 transition-colors hover:bg-primary/12"
                aria-label={`Tirar o filtro ${c.rotulo}`}
              >
                <span className="truncate">{c.rotulo}</span>
                <X className="size-3 shrink-0" />
              </button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => {
                setQ("");
                definir(FILTROS_VAZIOS);
              }}
            >
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      <PropostasAssinantesInterativas
        propostas={r?.itens ?? []}
        carregando={consulta.isLoading}
        erro={consulta.isError ? mensagemDeErro(consulta.error, "Não foi possível carregar as propostas.") : null}
        vazio={
          chips.length > 0
            ? "Nenhuma proposta com estes filtros."
            : alvo.licenca
              ? `${conta?.nome ?? "Esta conta"} ainda não enviou propostas.`
              : "Nenhuma proposta por aqui ainda."
        }
        mostrarConta={!alvo.licenca}
      />

      <Paginacao
        pagina={normalizarFiltros(filtros).pagina}
        total={total}
        porPagina={porPagina}
        carregando={consulta.isFetching}
        onPagina={(p) => definir({ ...filtros, pagina: p })}
      />
    </div>
  );
}

/** "Sua base": as propostas das contas vinculadas, abaixo da lista do Agilliza. */
export function SecaoPropostasVinculadas({ termo }: { termo: string }) {
  const listarFn = useServerFn(listarPropostasDoGrupo);
  const [pagina, setPagina] = useState(1);
  useEffect(() => setPagina(1), [termo]);
  const payload = payloadDosFiltros(
    { ...FILTROS_VAZIOS, termo, pagina },
    { grupo: "vinculados", licenca: null, semNoAgilliza: true },
  );
  const consulta = useQuery({
    queryKey: ["plataforma-fila", "vinculados", payload],
    queryFn: () => listarFn({ data: payload! }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const total = consulta.data?.total ?? 0;
  if (!consulta.isLoading && !consulta.isError && total === 0) return null;
  return (
    <section className="space-y-3 border-t border-border/60 pt-5" aria-label="Propostas de corretores vinculados">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary ring-1 ring-inset ring-primary/12">
            <Network className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">Propostas de corretores vinculados</h2>
            <p className="truncate text-xs text-muted-foreground">
              Enviadas pelas contas do Agilliza Tech que fazem parte da sua base.
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
          {consulta.data ? total : "—"}
        </span>
      </div>
      <PropostasAssinantesInterativas
        propostas={consulta.data?.itens ?? []}
        carregando={consulta.isLoading}
        erro={consulta.isError ? mensagemDeErro(consulta.error, "Não foi possível carregar as propostas dos vinculados.") : null}
        vazio="Nenhuma proposta dos vinculados."
      />
      <Paginacao
        pagina={pagina}
        total={total}
        porPagina={consulta.data?.porPagina ?? 50}
        carregando={consulta.isFetching}
        onPagina={setPagina}
      />
    </section>
  );
}

function Paginacao({
  pagina,
  total,
  porPagina,
  carregando,
  onPagina,
}: {
  pagina: number;
  total: number;
  porPagina: number;
  carregando: boolean;
  onPagina: (p: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (total <= porPagina) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card px-3 py-2.5 text-sm shadow-sm sm:justify-end">
      <Button variant="outline" className={ALTO} disabled={pagina <= 1 || carregando} onClick={() => onPagina(pagina - 1)}>
        Anterior
      </Button>
      <span className="text-xs text-muted-foreground tabular-nums sm:px-2 sm:text-sm">
        Página {Math.min(pagina, paginas)} de {paginas}
      </span>
      <Button
        variant="outline"
        className={ALTO}
        disabled={pagina >= paginas || carregando}
        onClick={() => onPagina(pagina + 1)}
      >
        Próxima
      </Button>
    </div>
  );
}

function ChipSituacao({ ativo, rotulo, n, onClick }: { ativo: boolean; rotulo: string; n: number; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativo}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-all",
        ativo
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border/70 bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
      )}
    >
      {rotulo}
      <span
        className={cn(
          "rounded-full px-1.5 text-[11px] tabular-nums",
          ativo ? "bg-primary-foreground/20" : "bg-muted text-foreground/70",
        )}
      >
        {n}
      </span>
    </button>
  );
}

function Indicador({
  icone: Icone,
  rotulo,
  valor,
  detalhe,
  destaque,
  alerta,
  ativo,
  onClick,
}: {
  icone: typeof Sigma;
  rotulo: string;
  valor?: string;
  detalhe?: string;
  destaque?: boolean;
  alerta?: boolean;
  ativo?: boolean;
  onClick?: () => void;
}) {
  const Corpo = onClick ? "button" : "div";
  return (
    <Corpo
      {...(onClick ? { type: "button" as const, onClick, "aria-pressed": !!ativo } : {})}
      className={cn(
        "group relative flex min-w-0 items-start gap-2.5 overflow-hidden rounded-2xl border bg-card p-3 text-left shadow-sm transition-all sm:p-4",
        onClick && "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        alerta ? "border-destructive/40" : ativo || destaque ? "border-primary/30" : "border-border/60",
      )}
    >
      <span className="absolute left-0 top-0 h-full w-[3px] rounded-r bg-primary/50" aria-hidden />
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset",
          alerta ? "bg-destructive/10 text-destructive ring-destructive/15" : "bg-primary/10 text-primary ring-primary/15",
        )}
      >
        <Icone className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</span>
        {valor === undefined ? (
          <Skeleton className="mt-1.5 h-6 w-14" />
        ) : (
          <span className="mt-0.5 block break-words text-lg font-semibold tabular-nums text-foreground sm:text-xl">{valor}</span>
        )}
        {detalhe && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{detalhe}</span>}
      </span>
    </Corpo>
  );
}
