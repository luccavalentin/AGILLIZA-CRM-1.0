import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileSpreadsheet, Plus, Trash2, GitCompare, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { NovaConciliacaoDialog } from "@/components/conciliacao/nova-conciliacao-dialog";
import { ComparadorPlanilhasDialog } from "@/components/conciliacao/comparador-planilhas-dialog";
import { ComparativoConsolidado } from "@/components/conciliacao/comparativo-consolidado";
import { MultiSelect } from "@/components/conciliacao/multi-select";
import { RESULTADO_LABEL, type ResultadoConciliacao } from "@/lib/conciliacao/tipos";
import {
  excluirLoteConciliacao,
  listarLotesConciliacao,
  resumoConciliacao,
} from "@/lib/conciliacao/conciliacao.functions";
import { BANCOS_CONCILIACAO } from "@/lib/conciliacao/bancos";

export const Route = createFileRoute("/_authenticated/relatorios/comparativos")({
  head: () => ({
    meta: [
      { title: "Comparativo de dados — Agilliza" },
      {
        name: "description",
        content:
          "Cruze o relatório oficial do banco contra as propostas do sistema e veja divergências, ausências e conferências em segundos.",
      },
      { property: "og:title", content: "Comparativo de dados — Agilliza" },
      {
        property: "og:description",
        content:
          "Cruze o relatório oficial do banco contra as propostas do sistema e veja divergências, ausências e conferências em segundos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => s,
  component: Pagina,
});

function mesAtual(): string {
  return new Date().toISOString().slice(0, 7);
}

function fmtPeriodo(v: string): string {
  const [a, m] = v.slice(0, 7).split("-");
  return `${m}/${a}`;
}

function Pagina() {
  const qc = useQueryClient();
  const listar = useServerFn(listarLotesConciliacao);
  const resumo = useServerFn(resumoConciliacao);
  const excluir = useServerFn(excluirLoteConciliacao);

  const [periodo, setPeriodo] = useState(mesAtual());
  const [bancos, setBancos] = useState<string[]>([]);
  const [aberto, setAberto] = useState(false);
  const [comparador, setComparador] = useState(false);
  const [lotesSelecionados, setLotesSelecionados] = useState<string[]>([]);
  const [resultados, setResultados] = useState<ResultadoConciliacao[]>([]);

  const filtros = { periodo: periodo || null, banco: null };

  const { data: todosLotes = [] } = useQuery({
    queryKey: ["conciliacao-lotes", filtros],
    queryFn: () => listar({ data: filtros }),
  });

  /** Lotes visíveis conforme os bancos escolhidos (vazio = todos). */
  const lotes = useMemo(
    () => (bancos.length ? todosLotes.filter((l) => bancos.includes(l.banco_nome)) : todosLotes),
    [todosLotes, bancos],
  );

  /** Lotes efetivamente considerados no detalhamento/exportação. */
  const lotesAtivos = useMemo(
    () =>
      lotesSelecionados.length ? lotes.filter((l) => lotesSelecionados.includes(l.id)) : lotes,
    [lotes, lotesSelecionados],
  );

  const { data: resumos = [] } = useQuery({
    queryKey: ["conciliacao-resumo", periodo],
    queryFn: () => resumo({ data: { periodo: periodo || null } }),
  });

  const resumosVisiveis = useMemo(
    () => (bancos.length ? resumos.filter((r) => bancos.includes(r.banco_nome)) : resumos),
    [resumos, bancos],
  );

  const totais = useMemo(
    () =>
      resumosVisiveis.reduce(
        (acc, r) => ({
          total: acc.total + r.total,
          conferidas: acc.conferidas + r.conferidas,
          divergentes: acc.divergentes + r.divergentes,
          ausentes_sistema: acc.ausentes_sistema + r.ausentes_sistema,
          ausentes_banco: acc.ausentes_banco + r.ausentes_banco,
        }),
        { total: 0, conferidas: 0, divergentes: 0, ausentes_sistema: 0, ausentes_banco: 0 },
      ),
    [resumosVisiveis],
  );

  /** Lotes agrupados por banco, para leitura organizada. */
  const lotesPorBanco = useMemo(() => {
    const mapa = new Map<string, typeof lotes>();
    for (const l of lotes) {
      const atual = mapa.get(l.banco_nome) ?? [];
      atual.push(l);
      mapa.set(l.banco_nome, atual);
    }
    return Array.from(mapa.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [lotes]);

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["conciliacao-lotes"] });
    qc.invalidateQueries({ queryKey: ["conciliacao-resumo"] });
  }

  const filtrosAtivos =
    periodo !== mesAtual() ||
    bancos.length > 0 ||
    resultados.length > 0 ||
    lotesSelecionados.length > 0;

  function limpar() {
    setPeriodo(mesAtual());
    setBancos([]);
    setResultados([]);
    setLotesSelecionados([]);
    toast.success("Filtros limpos.");
  }

  async function remover(id: string) {
    try {
      await excluir({ data: { loteId: id } });
      setLotesSelecionados((p) => p.filter((x) => x !== id));
      invalidar();
      toast.success("Lote removido.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover.");
    }
  }

  const kpis: {
    label: string;
    valor: number;
    tone: string;
    filtro: ResultadoConciliacao | null;
  }[] = [
    {
      label: "Linhas conciliadas",
      valor: totais.total,
      tone: "bg-muted-foreground/40",
      filtro: null,
    },
    { label: "Conferidas", valor: totais.conferidas, tone: "bg-emerald-500", filtro: "conferido" },
    { label: "Divergentes", valor: totais.divergentes, tone: "bg-amber-500", filtro: "divergente" },
    {
      label: "Ausentes no sistema",
      valor: totais.ausentes_sistema,
      tone: "bg-red-500",
      filtro: "ausente_no_sistema",
    },
    {
      label: "Ausentes no banco",
      valor: totais.ausentes_banco,
      tone: "bg-sky-500",
      filtro: "ausente_no_banco",
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Relatórios · Comparativos
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Comparativo de dados</h1>
          <p className="text-sm text-muted-foreground">
            Faça o upload do relatório oficial do banco. O sistema cruza contra as propostas
            existentes e aponta divergências — sem criar ou alterar nada.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Destaque: cruzar planilhas com o sistema é a ação principal da tela. */}
          <Button
            size="lg"
            onClick={() => setComparador(true)}
            className="shadow-md transition-transform hover:scale-[1.02]"
          >
            <GitCompare className="h-4 w-4" />
            Cruzar planilhas com o sistema
          </Button>
          <Button variant="outline" onClick={() => setAberto(true)}>
            <Plus className="h-4 w-4" />
            Novo comparativo
          </Button>
        </div>

      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Mês de referência
          </label>
          <Input
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="h-9 w-44"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Banco</label>
          <MultiSelect
            className="w-64"
            placeholder="Todos os bancos"
            valores={bancos}
            onChange={setBancos}
            opcoes={BANCOS_CONCILIACAO.map((b) => ({
              value: b.label,
              label: b.label,
              icone: <BancoLogo nome={b.label} size="sm" />,
            }))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Resultado
          </label>
          <MultiSelect
            className="w-56"
            placeholder="Todos os resultados"
            valores={resultados}
            onChange={(v) => setResultados(v as ResultadoConciliacao[])}
            opcoes={(
              [
                "conferido",
                "divergente",
                "ausente_no_sistema",
                "ausente_no_banco",
              ] as ResultadoConciliacao[]
            ).map((r) => ({ value: r, label: RESULTADO_LABEL[r] }))}
          />
        </div>
        {filtrosAtivos && (
          <Button variant="ghost" className="h-9" onClick={limpar}>
            <Eraser className="h-4 w-4" />
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map((k) => {
          const ativo = k.filtro ? resultados.includes(k.filtro) : resultados.length === 0;
          const aplicar = () => {
            if (!k.filtro) return setResultados([]);
            setResultados(
              resultados.includes(k.filtro)
                ? resultados.filter((r) => r !== k.filtro)
                : [...resultados, k.filtro],
            );
          };
          return (
            <Card
              key={k.label}
              role="button"
              tabIndex={0}
              onClick={aplicar}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  aplicar();
                }
              }}
              className={`relative cursor-pointer overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
                ativo ? "border-primary ring-1 ring-primary/30" : ""
              }`}
              title={`Ver ${k.label.toLowerCase()}`}
            >
              <span className={`absolute inset-y-0 left-0 w-[2px] ${k.tone}`} />
              <div className="font-mono text-2xl font-semibold tabular-nums">{k.valor}</div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {k.label}
              </div>
            </Card>
          );
        })}
      </div>

      {resumosVisiveis.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Por banco
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {resumosVisiveis.map((r) => (
              <Card
                key={r.banco_nome}
                role="button"
                tabIndex={0}
                onClick={() =>
                  setBancos(
                    bancos.includes(r.banco_nome)
                      ? bancos.filter((b) => b !== r.banco_nome)
                      : [...bancos, r.banco_nome],
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setBancos(
                      bancos.includes(r.banco_nome)
                        ? bancos.filter((b) => b !== r.banco_nome)
                        : [...bancos, r.banco_nome],
                    );
                  }
                }}
                className={`cursor-pointer p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
                  bancos.includes(r.banco_nome) ? "border-primary ring-1 ring-primary/30" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <BancoLogo nome={r.banco_nome} size="md" />
                    {r.banco_nome}
                  </span>
                  <span className="font-mono text-sm tabular-nums">{r.percentual_conferido}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-muted">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${Math.min(100, r.percentual_conferido)}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {r.total} linhas · {r.divergentes} divergentes · {r.ausentes_sistema} ausentes no
                  sistema
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Lotes enviados
        </h2>
        {lotes.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <FileSpreadsheet className="h-6 w-6 opacity-50" />
            <p className="text-sm text-muted-foreground">
              Nenhum comparativo neste período. Envie o relatório do banco para começar.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {lotesPorBanco.map(([nomeBanco, lista]) => (
              <div key={nomeBanco} className="space-y-2">
                <div className="flex items-center gap-2">
                  <BancoLogo nome={nomeBanco} size="sm" />
                  <span className="text-xs font-medium">{nomeBanco}</span>
                  <span className="text-[11px] text-muted-foreground">{lista.length} lote(s)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {lista.map((l) => {
                    const ativo = lotesSelecionados.includes(l.id);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() =>
                          setLotesSelecionados(
                            ativo
                              ? lotesSelecionados.filter((x) => x !== l.id)
                              : [...lotesSelecionados, l.id],
                          )
                        }
                        className={`group flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                          ativo ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        }`}
                      >
                        <div>
                          <div className="text-sm font-medium">
                            {fmtPeriodo(l.periodo_referencia)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {l.total_linhas} linhas · {l.total_divergentes} divergentes ·{" "}
                            {new Date(l.enviado_em).toLocaleString("pt-BR")}
                          </div>
                        </div>
                        <Trash2
                          className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-60 hover:!opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            void remover(l.id);
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {lotesAtivos.length > 0 && (
        <ComparativoConsolidado
          lotes={lotesAtivos}
          resultados={resultados}
          onResultadosChange={setResultados}
          periodoLabel={fmtPeriodo(periodo || mesAtual())}
        />
      )}

      <ComparadorPlanilhasDialog open={comparador} onOpenChange={setComparador} />

      <NovaConciliacaoDialog
        open={aberto}
        onOpenChange={setAberto}
        periodoPadrao={periodo || mesAtual()}
        onConcluido={(id) => {
          setLotesSelecionados([id]);
          invalidar();
        }}
      />
    </div>
  );
}
