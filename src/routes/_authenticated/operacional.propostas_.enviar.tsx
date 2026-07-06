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
} from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarPropostas, criarProposta } from "@/lib/propostas/propostas.functions";
import { listarSimulacoes } from "@/lib/simulacao/simulacoes.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function Pagina() {
  const router = useRouter();
  const padrao = useMemo(() => intervaloMesAtual(), []);
  const [aba, setAba] = useState<"propostas" | "simulacoes">("propostas");
  const [escopo, setEscopo] = useState<"todas" | "minhas">("todas");
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState("");
  const [dataInicio, setDataInicio] = useState(padrao.inicio);
  const [dataFim, setDataFim] = useState(padrao.fim);

  function limparFiltros() {
    setQ("");
    setBusca("");
    setDataInicio(padrao.inicio);
    setDataFim(padrao.fim);
    setEscopo("todas");
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
        onClick={() =>
          router.history.canGoBack()
            ? router.history.back()
            : router.navigate({ to: "/operacional/propostas" })
        }
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      {/* Cabeçalho + ação principal */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Nova Proposta</h1>
          <p className="text-sm text-muted-foreground">
            Consulte suas propostas e simulações ou gere uma nova proposta do zero.
          </p>
        </div>
        <Button
          size="lg"
          onClick={() =>
            router.navigate({
              to: "/operacional/simulacoes/completa",
              search: { origem: "proposta" },
            })
          }
        >
          <Sparkles className="mr-2 h-4 w-4" /> Gerar Nova Proposta
        </Button>
      </div>

      {/* Destaque do fluxo */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Como funciona</p>
            <p>
              Ao clicar em <strong>Gerar Nova Proposta</strong>, você preenche a simulação completa
              e pode <strong>enviar direto ao banco</strong> — a proposta é criada automaticamente
              com o banco vencedor.
            </p>
          </div>
        </div>
      </div>

      {/* Abas Propostas / Simulações */}
      <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="propostas">
            <FileText className="mr-1 h-4 w-4" /> Propostas
          </TabsTrigger>
          <TabsTrigger value="simulacoes">
            <Calculator className="mr-1 h-4 w-4" /> Simulações
          </TabsTrigger>
        </TabsList>

        {/* Filtros compartilhados */}
        <div className="flex flex-wrap items-end gap-3">
          <Tabs value={escopo} onValueChange={(v) => setEscopo(v as typeof escopo)}>
            <TabsList>
              <TabsTrigger value="todas">Gerais</TabsTrigger>
              <TabsTrigger value="minhas">Minhas</TabsTrigger>
            </TabsList>
          </Tabs>
          <form
            className="flex flex-1 items-center gap-2 min-w-[220px]"
            onSubmit={(e) => {
              e.preventDefault();
              setBusca(q);
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Número, cliente ou documento"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary">
              Buscar
            </Button>
          </form>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-[9.5rem]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-[9.5rem]"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={limparFiltros}>
            <RotateCcw className="mr-1 h-4 w-4" /> Limpar
          </Button>
        </div>

        <TabsContent value="propostas">
          <AbaPropostas
            escopo={escopo}
            busca={busca}
            dataInicio={dataInicio}
            dataFim={dataFim}
          />
        </TabsContent>
        <TabsContent value="simulacoes">
          <AbaSimulacoes
            escopo={escopo}
            busca={busca}
            dataInicio={dataInicio}
            dataFim={dataFim}
          />
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

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Bancos</TableHead>
            <TableHead className="text-right">R$ Financiamento</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                Carregando…
              </TableCell>
            </TableRow>
          )}
          {!isLoading && (data?.itens.length ?? 0) === 0 && (
            <TableRow>
              <TableCell colSpan={5}>
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Nenhuma proposta no período.</p>
                </div>
              </TableCell>
            </TableRow>
          )}
          {data?.itens.map((p) => (
            <TableRow
              key={p.id}
              className="cursor-pointer"
              onClick={() =>
                router.navigate({ to: "/operacional/propostas/$id", params: { id: p.id } })
              }
            >
              <TableCell>
                <div className="font-medium tabular-nums">
                  {p.numero_proposta_banco ?? p.numero_proposta}
                </div>
                {p.numero_proposta_banco && (
                  <div className="text-[11px] text-muted-foreground">
                    Interno {p.numero_proposta}
                  </div>
                )}
              </TableCell>
              <TableCell>{p.nome_cliente ?? "—"}</TableCell>
              <TableCell>
                <BancosProposta bancos={p.bancos} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatBRL(p.valor_financiamento)}
              </TableCell>
              <TableCell>
                <StatusBancosProposta bancos={p.bancos} fallbackStatus={p.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
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

  async function converter(id: string) {
    setConvertendo(id);
    try {
      const res = await criar({ data: { simulacao_id: id } });
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

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Bancos simulados</TableHead>
            <TableHead className="text-right">Valor imóvel</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-40 text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                Carregando…
              </TableCell>
            </TableRow>
          )}
          {!isLoading && (data?.itens.length ?? 0) === 0 && (
            <TableRow>
              <TableCell colSpan={6}>
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <Calculator className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Nenhuma simulação no período.</p>
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/operacional/simulacoes/completa" search={{ origem: "proposta" }}>
                      Gerar Nova Proposta
                    </Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
          {data?.itens.map((s) => (
            <TableRow
              key={s.id}
              className="cursor-pointer"
              onClick={() =>
                router.navigate({ to: "/operacional/simulacoes/$id", params: { id: s.id } })
              }
            >
              <TableCell className="font-medium">{s.numero_simulacao}</TableCell>
              <TableCell>{s.nome_cliente ?? "—"}</TableCell>
              <TableCell>
                <BancosSimulados bancos={s.bancos} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatBRL(s.valor_imovel)}
              </TableCell>
              <TableCell>
                <SimulacaoStatusBadge status={s.status} />
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={convertendo === s.id}
                  onClick={() => converter(s.id)}
                >
                  {convertendo === s.id ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-1 h-4 w-4" />
                  )}
                  Enviar proposta
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
