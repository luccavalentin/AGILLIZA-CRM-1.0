import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  RotateCcw,
  FileText,
  Calculator,
  Plus,
  Send,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarPropostas, criarProposta } from "@/lib/propostas/propostas.functions";
import { listarSimulacoes } from "@/lib/simulacao/simulacoes.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BancosProposta } from "@/components/proposta/bancos-proposta";
import { StatusBancosProposta } from "@/components/proposta/status-bancos-proposta";
import { SimulacaoStatusBadge } from "@/components/simulacao/status-badge";
import { BancosSimulados } from "@/components/simulacao/bancos-simulados";
import { formatBRL } from "@/lib/simulacao/format";
import { corDoBanco } from "@/lib/bancos/cores";

/** Primeiro e último dia do mês atual como intervalo ISO (filtro padrão). */
function intervaloMesAtual(): { inicio: string; fim: string } {
  const agora = new Date();
  const primeiro = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const ultimo = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { inicio: iso(primeiro), fim: iso(ultimo) };
}

export const Route = createFileRoute("/_authenticated/operacional/propostas_/enviar")({
  head: () => ({ meta: [{ title: "Nova Proposta — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.propostas"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar esta tela.</div>
  ),
});

const headCell =
  "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

function Pagina() {
  const router = useRouter();
  const padrao = useMemo(() => intervaloMesAtual(), []);
  const [aba, setAba] = useState<"propostas" | "simulacoes">("propostas");
  const [escopo, setEscopo] = useState<"todas" | "minhas">("minhas");
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState("");
  const [dataInicio, setDataInicio] = useState(padrao.inicio);
  const [dataFim, setDataFim] = useState(padrao.fim);

  // Busca ao vivo: filtra conforme o usuário digita (com debounce).
  useEffect(() => {
    const t = setTimeout(() => setBusca(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  function limparFiltros() {
    setQ("");
    setBusca("");
    setDataInicio(padrao.inicio);
    setDataFim(padrao.fim);
    setEscopo("minhas");
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 p-3 sm:space-y-6 sm:p-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit rounded-lg text-muted-foreground"
        onClick={() =>
          router.history.canGoBack()
            ? router.history.back()
            : router.navigate({ to: "/operacional/propostas" })
        }
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/[0.06] via-card to-card p-5 shadow-sm sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md ring-1 ring-primary/25 transition-transform duration-300 hover:scale-105">
              <Plus className="h-5 w-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Nova Proposta
              </h1>
              <p className="truncate text-sm text-muted-foreground">
                Envie ao banco a partir de uma simulação ou origine uma nova.
              </p>
            </div>
          </div>
          <Button
            onClick={() => router.navigate({ to: "/operacional/propostas/nova" })}
            className="group col-span-2 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/80 font-semibold shadow-md ring-1 ring-primary/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 hover:brightness-105 active:translate-y-0 sm:col-auto"
          >
            <Plus className="mr-1.5 h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />{" "}
            Gerar Nova Proposta
          </Button>
        </div>
      </div>

      {/* Abas Propostas / Simulações */}
      <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)} className="space-y-4">
        <TabsList className="h-11 rounded-xl">
          <TabsTrigger value="propostas" className="rounded-lg transition-all data-[state=active]:shadow-sm">
            <FileText className="mr-1.5 h-4 w-4" /> Propostas
          </TabsTrigger>
          <TabsTrigger value="simulacoes" className="rounded-lg transition-all data-[state=active]:shadow-sm">
            <Calculator className="mr-1.5 h-4 w-4" /> Simulações
          </TabsTrigger>
        </TabsList>

        {/* Filtros compartilhados */}
        <Card className="rounded-2xl border-border/60 p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Tabs value={escopo} onValueChange={(v) => setEscopo(v as typeof escopo)}>
              <TabsList className="h-11 rounded-xl">
                <TabsTrigger value="todas" className="rounded-lg">
                  Gerais
                </TabsTrigger>
                <TabsTrigger value="minhas" className="rounded-lg">
                  Minhas
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 rounded-xl pl-9 shadow-sm"
                placeholder="Número, cliente ou documento"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">De</Label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="h-11 w-[9.5rem] rounded-xl"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Até</Label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="h-11 w-[9.5rem] rounded-xl"
              />
            </div>
            <Button variant="ghost" className="h-11 rounded-xl" onClick={limparFiltros}>
              <RotateCcw className="mr-1 h-4 w-4" /> Limpar
            </Button>
          </div>
        </Card>

        <TabsContent value="propostas">
          <AbaPropostas escopo={escopo} busca={busca} dataInicio={dataInicio} dataFim={dataFim} />
        </TabsContent>
        <TabsContent value="simulacoes">
          <AbaSimulacoes escopo={escopo} busca={busca} dataInicio={dataInicio} dataFim={dataFim} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type FiltroProps = {
  escopo: "todas" | "minhas";
  busca: string;
  dataInicio: string;
  dataFim: string;
};

function AbaPropostas({ escopo, busca, dataInicio, dataFim }: FiltroProps) {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["propostas-hub", escopo, busca, dataInicio, dataFim],
    queryFn: () =>
      listarPropostas({
        data: {
          escopo,
          q: busca || undefined,
          data_inicio: dataInicio ? `${dataInicio}T00:00:00` : undefined,
          data_fim: dataFim ? `${dataFim}T23:59:59` : undefined,
          pagina: 1,
          porPagina: 100,
        },
      }),
  });

  const itens = data?.itens ?? [];

  return (
    <>
      {/* Cards mobile */}
      <div className="space-y-3 md:hidden">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="rounded-2xl border-border/60 p-4 shadow-sm">
              <Skeleton className="mb-2 h-5 w-32" />
              <Skeleton className="h-4 w-40" />
            </Card>
          ))}
        {!isLoading && itens.length === 0 && (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            texto="Nenhuma proposta no período."
          />
        )}
        {!isLoading &&
          itens.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer rounded-2xl border-border/60 p-4 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.025]"
              onClick={() =>
                router.navigate({ to: "/operacional/propostas/$id", params: { id: p.id } })
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-semibold tabular-nums text-foreground">
                    {p.numero_proposta}
                  </span>
                  {p.numero_proposta_banco && (
                    <p className="mt-0.5 truncate text-xs tabular-nums text-muted-foreground">
                      Nº banco {p.numero_proposta_banco}
                    </p>
                  )}
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {p.nome_cliente ?? "—"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-3 ring-1 ring-border/50">
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {formatBRL(p.valor_financiamento)}
                </span>
                <BancosProposta bancos={p.bancos} />
              </div>
              <div className="mt-3">
                <StatusBancosProposta bancos={p.bancos} fallbackStatus={p.status} />
              </div>
            </Card>
          ))}
      </div>

      {/* Tabela desktop */}
      <Card className="hidden overflow-x-auto rounded-2xl border-border/60 shadow-sm md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
              <TableHead className={headCell}>Número</TableHead>
              <TableHead className={headCell}>Cliente</TableHead>
              <TableHead className={headCell}>Bancos</TableHead>
              <TableHead className={`text-right ${headCell}`}>R$ Financiamento</TableHead>
              <TableHead className={headCell}>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-8 w-full rounded-lg" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && itens.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5}>
                  <EmptyState
                    icon={<FileText className="h-6 w-6" />}
                    texto="Nenhuma proposta no período."
                  />
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              itens.map((p) => (
                <TableRow
                  key={p.id}
                  className="group relative cursor-pointer transition-colors hover:bg-primary/[0.03]"
                  onClick={() =>
                    router.navigate({ to: "/operacional/propostas/$id", params: { id: p.id } })
                  }
                >
                  <TableCell className="relative">
                    <span className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 rounded-r-full bg-primary transition-transform duration-200 group-hover:scale-y-100" />
                    <div className="font-medium tabular-nums text-foreground transition-colors group-hover:text-primary">
                      {p.numero_proposta}
                    </div>
                    {p.numero_proposta_banco && (
                      <div className="text-[11px] text-muted-foreground">
                        Nº banco {p.numero_proposta_banco}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {p.nome_cliente ?? "—"}
                  </TableCell>
                  <TableCell>
                    <BancosProposta bancos={p.bancos} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-foreground">
                    {formatBRL(p.valor_financiamento)}
                  </TableCell>
                  <TableCell>
                    <StatusBancosProposta bancos={p.bancos} fallbackStatus={p.status} />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function AbaSimulacoes({ escopo, busca, dataInicio, dataFim }: FiltroProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const criar = useServerFn(criarProposta);
  const [convertendo, setConvertendo] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["simulacoes-hub", escopo, busca, dataInicio, dataFim],
    queryFn: () =>
      listarSimulacoes({
        data: {
          escopo,
          q: busca || undefined,
          desde: dataInicio || undefined,
          ate: dataFim || undefined,
          pagina: 1,
          porPagina: 100,
        },
      }),
  });

  const itens = data?.itens ?? [];

  async function converter(id: string, bancoId: string | null) {
    if (!bancoId) {
      toast.error("Banco inválido para envio.");
      return;
    }
    const chave = `${id}:${bancoId}`;
    setConvertendo(chave);
    try {
      const res = await criar({ data: { simulacao_id: id, banco_id: bancoId } });
      toast.success(`Proposta ${res.numero_proposta} criada.`);
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
      router.navigate({
        to: "/operacional/propostas/$id",
        params: { id: res.proposta_id },
        search: { complementar: 1 },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a proposta.");
    } finally {
      setConvertendo(null);
    }
  }

  function BotoesEnvio({ s }: { s: (typeof itens)[number] }) {
    const enviaveis = s.bancos.filter((b) => b.status_banco === "simulada" && b.banco_id);
    if (enviaveis.length === 0) {
      return <span className="text-xs text-muted-foreground">Nenhum banco simulado</span>;
    }
    return (
      <div className="flex flex-wrap justify-end gap-1.5">
        {enviaveis.map((b) => {
          const chave = `${s.id}:${b.banco_id}`;
          return (
            <Button
              key={b.id}
              size="sm"
              variant="secondary"
              className="group/btn rounded-lg border border-border/60 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary hover:text-primary-foreground hover:shadow-md active:translate-y-0"
              disabled={convertendo !== null}
              onClick={() => converter(s.id, b.banco_id)}
            >
              {convertendo === chave ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
              )}
              {b.nome_banco ?? "Banco"}
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {/* Cards mobile */}
      <div className="space-y-3 md:hidden">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="rounded-2xl border-border/60 p-4 shadow-sm">
              <Skeleton className="mb-2 h-5 w-32" />
              <Skeleton className="h-4 w-40" />
            </Card>
          ))}
        {!isLoading && itens.length === 0 && (
          <EmptyState
            icon={<Calculator className="h-6 w-6" />}
            texto="Nenhuma simulação no período."
            acao={
              <Button asChild size="sm" className="rounded-xl">
                <Link to="/operacional/propostas/nova">
                  Gerar Nova Proposta
                </Link>
              </Button>
            }
          />
        )}
        {!isLoading &&
          itens.map((s) => (
            <Card
              key={s.id}
              className="cursor-pointer rounded-2xl border-border/60 p-4 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.025]"
              onClick={() =>
                router.navigate({ to: "/operacional/simulacoes/$id", params: { id: s.id } })
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-semibold tabular-nums text-foreground">
                    {s.numero_simulacao}
                  </span>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {s.nome_cliente ?? "—"}
                  </p>
                </div>
                <SimulacaoStatusBadge status={s.status} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-3 ring-1 ring-border/50">
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {formatBRL(s.valor_imovel)}
                </span>
                <BancosSimulados bancos={s.bancos} />
              </div>
              <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                <BotoesEnvio s={s} />
              </div>
            </Card>
          ))}
      </div>

      {/* Tabela desktop */}
      <Card className="hidden overflow-x-auto rounded-2xl border-border/60 shadow-sm md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
              <TableHead className={headCell}>Número</TableHead>
              <TableHead className={headCell}>Cliente</TableHead>
              <TableHead className={headCell}>Bancos simulados</TableHead>
              <TableHead className={`text-right ${headCell}`}>Valor imóvel</TableHead>
              <TableHead className={headCell}>Status</TableHead>
              <TableHead className={`w-56 text-right ${headCell}`}>Enviar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-8 w-full rounded-lg" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && itens.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6}>
                  <EmptyState
                    icon={<Calculator className="h-6 w-6" />}
                    texto="Nenhuma simulação no período."
                    acao={
                      <Button asChild size="sm" className="rounded-xl">
                        <Link to="/operacional/propostas/nova">
                          Gerar Nova Proposta
                        </Link>
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              itens.map((s) => (
                <TableRow
                  key={s.id}
                  className="group relative cursor-pointer transition-colors hover:bg-primary/[0.03]"
                  onClick={() =>
                    router.navigate({ to: "/operacional/simulacoes/$id", params: { id: s.id } })
                  }
                >
                  <TableCell className="relative font-medium tabular-nums text-foreground">
                    <span className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 rounded-r-full bg-primary transition-transform duration-200 group-hover:scale-y-100" />
                    <span className="transition-colors group-hover:text-primary">
                      {s.numero_simulacao}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {s.nome_cliente ?? "—"}
                  </TableCell>
                  <TableCell>
                    <BancosSimulados bancos={s.bancos} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">
                    {formatBRL(s.valor_imovel)}
                  </TableCell>
                  <TableCell>
                    <SimulacaoStatusBadge status={s.status} />
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <BotoesEnvio s={s} />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function EmptyState({
  icon,
  texto,
  acao,
}: {
  icon: React.ReactNode;
  texto: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
        {icon}
      </div>
      <p className="text-sm text-muted-foreground">{texto}</p>
      {acao}
    </div>
  );
}
