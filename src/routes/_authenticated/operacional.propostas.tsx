import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Search,
  FileText,
  KanbanSquare,
  RotateCcw,
  Layers,
  Wallet,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarPropostas, excluirProposta } from "@/lib/propostas/propostas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { formatBRL } from "@/lib/simulacao/format";

/** Primeiro e último dia do mês atual como intervalo ISO (para o filtro padrão). */
function intervaloMesAtual(): { inicio: string; fim: string } {
  const agora = new Date();
  const primeiro = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const ultimo = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { inicio: iso(primeiro), fim: iso(ultimo) };
}

export const Route = createFileRoute("/_authenticated/operacional/propostas")({
  head: () => ({ meta: [{ title: "Propostas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.propostas"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar as propostas.</div>
  ),
});

function Pagina() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const excluir = useServerFn(excluirProposta);
  const padrao = useMemo(() => intervaloMesAtual(), []);
  const [escopo, setEscopo] = useState<"todas" | "minhas">("todas");
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState("");
  const [dataInicio, setDataInicio] = useState(padrao.inicio);
  const [dataFim, setDataFim] = useState(padrao.fim);

  // Busca ao vivo: filtra conforme o usuário digita (com debounce).
  useEffect(() => {
    const t = setTimeout(() => setBusca(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading } = useQuery({
    queryKey: ["propostas", escopo, busca, dataInicio, dataFim],
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
  const totalItens = itens.length;
  const volumeTotal = useMemo(
    () => itens.reduce((acc, p) => acc + (p.valor_financiamento ?? 0), 0),
    [itens],
  );

  function limparFiltros() {
    setQ("");
    setBusca("");
    setDataInicio(padrao.inicio);
    setDataFim(padrao.fim);
    setEscopo("todas");
  }

  async function handleExcluir(id: string) {
    try {
      await excluir({ data: { id } });
      toast.success("Proposta excluída.");
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
    } catch {
      toast.error("Não foi possível excluir a proposta.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 p-3 sm:space-y-6 sm:p-6">
      {/* Cabeçalho */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm ring-1 ring-primary/20">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Propostas
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              Oportunidades enviadas ao banco.
            </p>
          </div>
        </div>
        <div className="col-span-2 flex gap-2 sm:col-auto">
          <Button asChild variant="secondary" className="h-11 flex-1 rounded-xl sm:flex-none">
            <Link to="/operacional/propostas/kanban">
              <KanbanSquare className="mr-1.5 h-4 w-4" /> Kanban
            </Link>
          </Button>
          <Button
            asChild
            className="h-11 flex-1 rounded-xl bg-gradient-to-br from-primary to-primary/80 font-semibold shadow-md ring-1 ring-primary/20 transition-all hover:shadow-lg hover:brightness-105 sm:flex-none"
          >
            <Link to="/operacional/propostas/enviar">
              <Plus className="mr-1.5 h-4 w-4" /> Nova proposta
            </Link>
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="flex items-center gap-3 rounded-2xl border-border/60 p-4 shadow-sm">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <Layers className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Propostas</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="text-xl font-semibold tabular-nums text-foreground">{totalItens}</p>
            )}
          </div>
        </Card>
        <Card className="flex items-center gap-3 rounded-2xl border-border/60 p-4 shadow-sm">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/15 dark:text-emerald-400">
            <Wallet className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Volume financiado</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-6 w-24" />
            ) : (
              <p className="truncate text-xl font-semibold tabular-nums text-foreground">
                {formatBRL(volumeTotal)}
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="rounded-2xl border-border/60 p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Tabs value={escopo} onValueChange={(v) => setEscopo(v as "todas" | "minhas")}>
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

      {/* Lista mobile (cards) */}
      <div className="space-y-3 md:hidden">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="rounded-2xl border-border/60 p-4 shadow-sm">
              <div className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-9 w-full rounded-xl" />
              </div>
            </Card>
          ))}
        {!isLoading && totalItens === 0 && (
          <Card className="rounded-2xl border-border/60 px-5 py-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <FileText className="h-6 w-6" />
            </div>
            <p className="mb-4 text-sm text-muted-foreground">Nenhuma proposta encontrada.</p>
            <Button asChild size="sm" className="rounded-xl">
              <Link to="/operacional/propostas/enviar">Nova proposta</Link>
            </Button>
          </Card>
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
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums text-foreground">
                      {p.numero_proposta_banco ?? p.numero_proposta}
                    </span>
                    {p.numero_proposta_banco && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Interno {p.numero_proposta}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {p.nome_cliente ?? "—"}
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <ConfirmDelete
                    titulo="Excluir proposta"
                    descricao={`A proposta ${p.numero_proposta} será removida permanentemente. Um registro completo será mantido nos Logs de auditoria.`}
                    onConfirm={() => handleExcluir(p.id)}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-3 ring-1 ring-border/50">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Financiamento
                  </p>
                  <p className="truncate text-sm font-semibold tabular-nums text-foreground">
                    {formatBRL(p.valor_financiamento)}
                  </p>
                </div>
                <BancosProposta bancos={p.bancos} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <StatusBancosProposta bancos={p.bancos} fallbackStatus={p.status} />
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            </Card>
          ))}
      </div>

      {/* Tabela desktop */}
      <Card className="hidden overflow-hidden rounded-2xl border-border/60 shadow-sm md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Bancos</TableHead>
              <TableHead className="text-right">R$ Financiamento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-8 w-full rounded-lg" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && totalItens === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6}>
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                      <FileText className="h-6 w-6" />
                    </div>
                    <p className="text-sm text-muted-foreground">Nenhuma proposta encontrada.</p>
                    <Button asChild size="sm" className="rounded-xl">
                      <Link to="/operacional/propostas/enviar">Nova proposta</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              itens.map((p) => (
                <TableRow
                  key={p.id}
                  className="group cursor-pointer"
                  onClick={() =>
                    router.navigate({ to: "/operacional/propostas/$id", params: { id: p.id } })
                  }
                >
                  <TableCell>
                    <div className="font-medium tabular-nums text-foreground">
                      {p.numero_proposta_banco ?? p.numero_proposta}
                    </div>
                    {p.numero_proposta_banco && (
                      <div className="text-[11px] text-muted-foreground">
                        Interno {p.numero_proposta}
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
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <ConfirmDelete
                      titulo="Excluir proposta"
                      descricao={`A proposta ${p.numero_proposta} será removida permanentemente. Um registro completo será mantido nos Logs de auditoria.`}
                      onConfirm={() => handleExcluir(p.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
