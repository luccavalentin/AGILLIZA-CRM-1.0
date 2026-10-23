import { useDeferredValue, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock3, Filter, Globe, Plug, Search, TerminalSquare, Workflow, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  EstadoErro,
  EstadoVazio,
  Esqueleto,
  Painel,
  Pulso,
  SeloAoVivo,
  Segmentos,
  fmtMs,
  fmtNum,
  type Tom,
} from "@/components/tecnologia/base";
import { cn } from "@/lib/utils";
import { useClasseTema } from "@/components/tecnologia/tema";
import { FONTES_LOG, lerLogs, type LinhaLogUnificado } from "@/lib/tecnologia/tecnologia.functions";

export const Route = createFileRoute("/_authenticated/tecnologia/logs")({
  head: () => ({ meta: [{ title: "Logs — Gestão de Tecnologia — Agilliza" }] }),
  component: Logs,
});

type Fonte = (typeof FONTES_LOG)[number];
type Periodo = "1h" | "6h" | "24h" | "3d" | "7d" | "14d";

const FONTE: Record<Fonte, { rotulo: string; icone: typeof Globe }> = {
  requisicao: { rotulo: "Requisições", icone: Globe },
  provedor: { rotulo: "Provedores", icone: Plug },
  rotina: { rotulo: "Rotinas", icone: Workflow },
};
const NIVEL: Record<LinhaLogUnificado["nivel"], { rotulo: string; tom: Tom }> = {
  erro: { rotulo: "erro", tom: "critico" },
  aviso: { rotulo: "aviso", tom: "atencao" },
  info: { rotulo: "ok", tom: "ok" },
};
const TODAS = "__todas__";

interface Filtros {
  fontes: Fonte[];
  periodo: Periodo;
  tenant: string | null;
  rota: string;
  codigo: string;
  soErro: boolean;
}

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

function Logs() {
  const [f, setF] = useState<Filtros>({
    fontes: [...FONTES_LOG],
    periodo: "24h",
    tenant: null,
    rota: "",
    codigo: "",
    soErro: true,
  });
  const [busca, setBusca] = useState("");
  const [gaveta, setGaveta] = useState(false);
  const classeTema = useClasseTema();
  const buscaAdiada = useDeferredValue(busca.trim());
  const rotaAdiada = useDeferredValue(f.rota.trim());
  const codigoAdiado = useDeferredValue(f.codigo.trim());

  const lerFn = useServerFn(lerLogs);
  const q = useQuery({
    queryKey: [
      "tecnologia",
      "logs",
      f.fontes,
      f.periodo,
      f.tenant,
      rotaAdiada,
      codigoAdiado,
      buscaAdiada,
      f.soErro,
    ],
    queryFn: () =>
      lerFn({
        data: {
          fontes: f.fontes,
          periodo: f.periodo,
          tenant: f.tenant,
          rota: rotaAdiada,
          codigo: codigoAdiado,
          busca: buscaAdiada,
          soErro: f.soErro,
        },
      }),
    refetchInterval: 20_000,
    placeholderData: (a) => a,
  });
  const linhas = q.data?.linhas ?? [];
  const ativos =
    (f.fontes.length < FONTES_LOG.length ? 1 : 0) +
    (f.tenant ? 1 : 0) +
    (f.rota ? 1 : 0) +
    (f.codigo ? 1 : 0) +
    (f.soErro ? 0 : 1);
  const contagem = {
    erro: linhas.filter((l) => l.nivel === "erro").length,
    aviso: linhas.filter((l) => l.nivel === "aviso").length,
  };

  const filtros = <PainelFiltros f={f} setF={setF} contas={q.data?.contas ?? []} />;

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Logs</h2>
          <p className="text-xs text-muted-foreground">
            Requisições com erro, chamadas aos provedores e rotinas numa linha do tempo só (até 14
            dias).
          </p>
        </div>
        <SeloAoVivo
          atualizadoEm={q.dataUpdatedAt || null}
          atualizando={q.isFetching}
          falhou={q.isError}
          intervaloS={20}
          onAtualizar={() => q.refetch()}
        />
      </div>

      <div className="flex gap-2">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            maxLength={80}
            placeholder="Buscar erro, rota ou rotina"
            className="h-11 pl-9"
          />
        </label>
        <button
          type="button"
          onClick={() => setGaveta(true)}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-foreground lg:hidden"
        >
          <Filter className="size-4" /> Filtros
          {ativos > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">
              {ativos}
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <Painel titulo="Filtros" icone={<Filter className="size-4" />}>
            {filtros}
          </Painel>
        </aside>

        <Sheet open={gaveta} onOpenChange={setGaveta}>
          <SheetContent
            side="bottom"
            className={`${classeTema} max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-card text-foreground`}
          >
            <SheetHeader>
              <SheetTitle>Filtros dos logs</SheetTitle>
            </SheetHeader>
            <div className="mt-4 pb-4">{filtros}</div>
            <button
              type="button"
              onClick={() => setGaveta(false)}
              className="mb-2 min-h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground"
            >
              Ver {fmtNum(linhas.length)} registro(s)
            </button>
          </SheetContent>
        </Sheet>

        <div className="min-w-0 space-y-3">
          {q.isError && (
            <EstadoErro
              erro={q.error}
              alternativa="Não foi possível ler os logs."
              onTentar={() => q.refetch()}
            />
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              <strong className="font-semibold text-foreground tabular-nums">
                {fmtNum(linhas.length)}
              </strong>{" "}
              registro(s){linhas.length >= 300 ? " (os 300 mais recentes)" : ""}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Pulso tom="critico" vivo={false} /> {fmtNum(contagem.erro)} erro(s)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Pulso tom="atencao" vivo={false} /> {fmtNum(contagem.aviso)} aviso(s)
            </span>
          </div>
          {q.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Esqueleto key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : !linhas.length ? (
            <Painel>
              <EstadoVazio
                icone={<TerminalSquare className="size-5" />}
                titulo="Nada registrado com esses filtros"
                texto={
                  f.soErro
                    ? "Sem erros no período. Desligue “Só erros” para ver também o que deu certo."
                    : "Amplie o período ou limpe os filtros."
                }
              />
            </Painel>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-border bg-card">
              <li
                aria-hidden
                className="hidden border-b border-border bg-muted/40 px-4 py-2 text-[11px] font-medium text-muted-foreground xl:grid xl:grid-cols-[132px_104px_minmax(0,1fr)_64px_72px_minmax(0,180px)] xl:gap-3"
              >
                <span>Quando</span>
                <span>Fonte</span>
                <span>Rota / chamada</span>
                <span>Código</span>
                <span>Duração</span>
                <span>Conta</span>
              </li>
              {linhas.map((l, i) => (
                <LinhaLog key={`${l.fonte}-${l.criado_em}-${i}`} l={l} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function LinhaLog({ l }: { l: LinhaLogUnificado }) {
  const F = FONTE[l.fonte];
  const n = NIVEL[l.nivel];
  const codigo =
    l.status != null ? `${l.status}${l.codigo ? ` · ${l.codigo}` : ""}` : (l.codigo ?? "—");
  return (
    <li className="border-b border-border px-4 py-2.5 last:border-b-0 xl:grid xl:grid-cols-[132px_104px_minmax(0,1fr)_64px_72px_minmax(0,180px)] xl:items-center xl:gap-3">
      <div className="flex items-center justify-between gap-2 xl:contents">
        <span className="flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground xl:text-xs">
          <Pulso tom={n.tom} vivo={false} />
          {quando(l.criado_em)}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground xl:text-xs">
          <F.icone className="size-3.5" /> {F.rotulo}
        </span>
      </div>
      <p className="mt-1 truncate font-mono text-xs text-foreground xl:mt-0" title={l.rota ?? ""}>
        {l.rota ?? "—"}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground xl:contents xl:text-xs">
        <span
          className={cn("tabular-nums", l.nivel === "erro" && "font-semibold text-destructive")}
        >
          {codigo}
        </span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Clock3 className="size-3 xl:hidden" />
          {fmtMs(l.duracao_ms)}
        </span>
        <span className="truncate">{l.conta ?? "—"}</span>
      </div>
      {l.detalhe && (
        <p className="mt-1 line-clamp-2 break-words text-[11px] text-muted-foreground xl:col-span-6 xl:mt-1">
          {l.detalhe}
        </p>
      )}
    </li>
  );
}

function PainelFiltros({
  f,
  setF,
  contas,
}: {
  f: Filtros;
  setF: (fn: (f: Filtros) => Filtros) => void;
  contas: { id: string; nome: string }[];
}) {
  const classeTema = useClasseTema();
  const alternarFonte = (fonte: Fonte) =>
    setF((x) => {
      const tem = x.fontes.includes(fonte);
      const fontes = tem ? x.fontes.filter((y) => y !== fonte) : [...x.fontes, fonte];
      return { ...x, fontes: fontes.length ? fontes : x.fontes };
    });
  return (
    <div className="space-y-4">
      <fieldset className="min-w-0">
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Fontes</legend>
        <div className="flex flex-wrap gap-1.5">
          {FONTES_LOG.map((fonte) => {
            const ativo = f.fontes.includes(fonte);
            const F = FONTE[fonte];
            return (
              <button
                key={fonte}
                type="button"
                aria-pressed={ativo}
                onClick={() => alternarFonte(fonte)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-medium lg:min-h-9",
                  ativo
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <F.icone className="size-3.5" /> {F.rotulo}
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="min-w-0">
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Período</legend>
        <Segmentos
          rotulo="Período"
          valor={f.periodo}
          onChange={(periodo) => setF((x) => ({ ...x, periodo }))}
          opcoes={[
            { valor: "1h", rotulo: "1 h" },
            { valor: "6h", rotulo: "6 h" },
            { valor: "24h", rotulo: "24 h" },
            { valor: "3d", rotulo: "3 d" },
            { valor: "7d", rotulo: "7 d" },
            { valor: "14d", rotulo: "14 d" },
          ]}
        />
      </fieldset>
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-foreground">
        Só erros e avisos
        <Switch checked={f.soErro} onCheckedChange={(soErro) => setF((x) => ({ ...x, soErro }))} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Licença (conta)</span>
        <Select
          value={f.tenant ?? TODAS}
          onValueChange={(v) => setF((x) => ({ ...x, tenant: v === TODAS ? null : v }))}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent className={classeTema}>
            <SelectItem value={TODAS}>Todas as contas</SelectItem>
            {contas.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Rota, endpoint ou rotina</span>
        <Input
          value={f.rota}
          maxLength={120}
          onChange={(e) => setF((x) => ({ ...x, rota: e.target.value }))}
          placeholder="/corretor/clientes, homefin…"
          className="h-11 font-mono text-xs"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Código</span>
        <Input
          value={f.codigo}
          maxLength={40}
          onChange={(e) => setF((x) => ({ ...x, codigo: e.target.value }))}
          placeholder="500, 429, interno, erro…"
          className="h-11 font-mono text-xs"
        />
      </label>
      <button
        type="button"
        onClick={() =>
          setF(() => ({
            fontes: [...FONTES_LOG],
            periodo: "24h",
            tenant: null,
            rota: "",
            codigo: "",
            soErro: true,
          }))
        }
        className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <X className="size-3.5" /> Limpar filtros
      </button>
    </div>
  );
}
