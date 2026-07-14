import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  MoreHorizontal,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import {
  listarContas,
  listarConfigs,
  excluirConta,
  resumoContas,
  type ContaTipo,
} from "@/lib/financeiro/financeiro.functions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContaStatusBadge } from "@/components/financeiro/status-badge";
import { NovaContaDialog } from "@/components/financeiro/nova-conta-dialog";
import { BaixarDialog } from "@/components/financeiro/baixar-dialog";
import { EstornarDialog } from "@/components/financeiro/estornar-dialog";
import { ContaDrawer } from "@/components/financeiro/conta-drawer";
import { formatBRL, formatData } from "@/lib/financeiro/format";


const STATUS_OPCOES = ["aberta", "parcial", "paga", "atrasada", "cancelada", "estornada"];

function AcoesMenu({
  conta,
  tipo,
  onDetalhe,
  onBaixar,
  onEstornar,
  onCancelar,
  onExcluir,
}: {
  conta: any;
  tipo: ContaTipo;
  onDetalhe: () => void;
  onBaixar: () => void;
  onEstornar: () => void;
  onCancelar: () => void;
  onExcluir: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onDetalhe}>Ver detalhes</DropdownMenuItem>
        {conta.status !== "paga" &&
          conta.status !== "cancelada" &&
          conta.status !== "estornada" && (
            <DropdownMenuItem onClick={onBaixar}>
              {tipo === "pagar" ? "Baixar" : "Confirmar recebimento"}
            </DropdownMenuItem>
          )}
        {conta.status !== "estornada" && conta.valor_pago > 0 && (
          <DropdownMenuItem className="text-destructive" onClick={onEstornar}>
            Estornar
          </DropdownMenuItem>
        )}
        {conta.status !== "cancelada" && conta.status !== "estornada" && (
          <DropdownMenuItem className="text-destructive" onClick={onCancelar}>
            Cancelar
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="text-destructive" onClick={onExcluir}>
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


export function ContasPage({ tipo }: { tipo: ContaTipo }) {
  const titulo = tipo === "pagar" ? "Contas a pagar" : "Contas a receber";
  const [status, setStatus] = useState<string>("");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [contraparte, setContraparte] = useState("");
  const [busca, setBusca] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const [baixarConta, setBaixarConta] = useState<any>(null);
  const [estorno, setEstorno] = useState<{ id: string; acao: "estornar" | "cancelar" } | null>(
    null,
  );
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [excluirAlvo, setExcluirAlvo] = useState<{ id: string; numero: string } | null>(null);

  const queryClient = useQueryClient();
  const excluir = useServerFn(excluirConta);

  async function handleExcluir() {
    if (!excluirAlvo) return;
    try {
      await excluir({ data: { tipo, id: excluirAlvo.id } });
      toast.success("Conta excluída.");
      queryClient.invalidateQueries({ queryKey: ["fin-contas"] });
    } catch {
      toast.error("Não foi possível excluir a conta.");
    } finally {
      setExcluirAlvo(null);
    }
  }

  const { data: cfg } = useQuery({ queryKey: ["fin-configs"], queryFn: () => listarConfigs() });
  const { data, isLoading } = useQuery({
    queryKey: ["fin-contas", tipo, status, categoriaId, busca, de, ate],
    queryFn: () =>
      listarContas({
        data: {
          tipo,
          status: status || undefined,
          categoria_id: categoriaId || undefined,
          contraparte: busca || undefined,
          de: de || undefined,
          ate: ate || undefined,
          pagina: 1,
          porPagina: 50,
        },
      }),
  });

  const { data: resumo } = useQuery({
    queryKey: ["fin-contas-resumo", tipo, status, categoriaId, busca, de, ate],
    queryFn: () =>
      resumoContas({
        data: {
          tipo,
          status: status || undefined,
          categoria_id: categoriaId || undefined,
          contraparte: busca || undefined,
          de: de || undefined,
          ate: ate || undefined,
        },
      }),
  });

  const temFiltro = !!(de || ate || status || categoriaId || busca);

  const recebe = tipo === "receber";
  const kpis = [
    {
      label: "Total no período",
      valor: resumo?.totalValor ?? 0,
      qtd: resumo?.totalQtd ?? 0,
      icon: Wallet,
      tint: "text-primary",
      ring: "bg-primary/10",
    },
    {
      label: recebe ? "A receber" : "A pagar",
      valor: resumo?.abertoValor ?? 0,
      qtd: resumo?.abertoQtd ?? 0,
      icon: recebe ? ArrowDownCircle : ArrowUpCircle,
      tint: "text-amber-600 dark:text-amber-400",
      ring: "bg-amber-500/10",
    },
    {
      label: recebe ? "Recebido" : "Pago",
      valor: resumo?.pagoValor ?? 0,
      qtd: resumo?.pagoQtd ?? 0,
      icon: CheckCircle2,
      tint: "text-emerald-600 dark:text-emerald-400",
      ring: "bg-emerald-500/10",
    },
    {
      label: "Em atraso",
      valor: resumo?.atrasadoValor ?? 0,
      qtd: resumo?.atrasadoQtd ?? 0,
      icon: AlertTriangle,
      tint: "text-rose-600 dark:text-rose-400",
      ring: "bg-rose-500/10",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-none space-y-6 p-3 sm:p-4 md:p-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-gradient-to-br from-primary/[0.06] via-card to-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            {recebe ? <ArrowDownCircle className="h-6 w-6" /> : <ArrowUpCircle className="h-6 w-6" />}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {titulo}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tipo === "pagar"
                ? "Fornecedores, parceiros, impostos e despesas."
                : "Comissões, taxas e outros recebimentos."}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <NovaContaDialog tipo={tipo} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {k.label}
                </span>
                <span className={cn("grid h-8 w-8 place-items-center rounded-lg", k.ring, k.tint)}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className={cn("mt-3 text-lg font-semibold tabular-nums sm:text-xl", k.tint)}>
                {formatBRL(k.valor)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {k.qtd} {k.qtd === 1 ? "conta" : "contas"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Status</span>
            <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {STATUS_OPCOES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Categoria</span>
            <Select
              value={categoriaId || "all"}
              onValueChange={(v) => setCategoriaId(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {(cfg?.categorias ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Vencimento de</span>
            <Input
              type="date"
              className="w-36 sm:w-40"
              value={de}
              onChange={(e) => setDe(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">até</span>
            <Input
              type="date"
              className="w-36 sm:w-40"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
            />
          </div>
          <form
            className="flex flex-1 flex-col gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              setBusca(contraparte);
            }}
          >
            <span className="text-xs text-muted-foreground">
              {tipo === "pagar" ? "Fornecedor" : "Pagador"}
            </span>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="w-full pl-9 sm:w-56"
                  placeholder={tipo === "pagar" ? "Buscar fornecedor" : "Buscar pagador"}
                  value={contraparte}
                  onChange={(e) => setContraparte(e.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary">
                Filtrar
              </Button>
            </div>
          </form>
          {temFiltro && (
            <Button
              variant="ghost"
              onClick={() => {
                setDe("");
                setAte("");
                setStatus("");
                setCategoriaId("");
                setContraparte("");
                setBusca("");
              }}
            >
              Limpar
            </Button>
          )}
        </div>
      </div>


      {/* Tabela (desktop) */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-muted/60 hover:bg-muted/60">
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Número
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Descrição
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {tipo === "pagar" ? "Fornecedor" : "Pagador"}
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Categoria
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Vencimento
                </TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Valor
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    <TableCell colSpan={8} className="py-3">
                      <div className="h-6 w-full animate-pulse rounded bg-muted" />
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && (data?.itens.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="flex flex-col items-center gap-3 py-14 text-center">
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
                        <Wallet className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-foreground">Nenhuma conta encontrada</p>
                      <p className="text-xs text-muted-foreground">
                        Ajuste os filtros ou cadastre uma nova conta.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {data?.itens.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer border-b border-border/60 transition-colors hover:bg-primary/[0.04]"
                  onClick={() => setDetalheId(c.id)}
                >
                  <TableCell className="font-medium tabular-nums text-primary">{c.numero}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{c.descricao}</TableCell>
                  <TableCell>{c.contraparte ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.categoria_nome ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{formatData(c.vencimento)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatBRL(c.valor)}
                  </TableCell>
                  <TableCell>
                    <ContaStatusBadge status={c.status_efetivo} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <AcoesMenu
                      conta={c}
                      tipo={tipo}
                      onDetalhe={() => setDetalheId(c.id)}
                      onBaixar={() => setBaixarConta(c)}
                      onEstornar={() => setEstorno({ id: c.id, acao: "estornar" })}
                      onCancelar={() => setEstorno({ id: c.id, acao: "cancelar" })}
                      onExcluir={() => setExcluirAlvo({ id: c.id, numero: c.numero ?? "" })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Cartões (mobile) */}
      <div className="space-y-3 md:hidden">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={`mk-${i}`} className="h-24 animate-pulse rounded-xl border border-border bg-muted/50" />
          ))}
        {!isLoading && (data?.itens.length ?? 0) === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-12 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
              <Wallet className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Nenhuma conta encontrada</p>
          </div>
        )}
        {data?.itens.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-border bg-card p-4 shadow-sm active:bg-primary/[0.04]"
            onClick={() => setDetalheId(c.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{c.descricao}</p>
                <p className="mt-0.5 text-xs tabular-nums text-primary">{c.numero}</p>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <AcoesMenu
                  conta={c}
                  tipo={tipo}
                  onDetalhe={() => setDetalheId(c.id)}
                  onBaixar={() => setBaixarConta(c)}
                  onEstornar={() => setEstorno({ id: c.id, acao: "estornar" })}
                  onCancelar={() => setEstorno({ id: c.id, acao: "cancelar" })}
                  onExcluir={() => setExcluirAlvo({ id: c.id, numero: c.numero ?? "" })}
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <ContaStatusBadge status={c.status_efetivo} />
              <span className="text-base font-semibold tabular-nums text-foreground">
                {formatBRL(c.valor)}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatData(c.vencimento)}
              </span>
              {c.contraparte && <span className="truncate">{c.contraparte}</span>}
            </div>
          </div>
        ))}
      </div>


      <BaixarDialog
        tipo={tipo}
        conta={baixarConta}
        open={!!baixarConta}
        onOpenChange={(o) => !o && setBaixarConta(null)}
      />
      <EstornarDialog
        tipo={tipo}
        acao={estorno?.acao ?? "estornar"}
        contaId={estorno?.id ?? null}
        open={!!estorno}
        onOpenChange={(o) => !o && setEstorno(null)}
      />
      <ContaDrawer
        tipo={tipo}
        contaId={detalheId}
        open={!!detalheId}
        onOpenChange={(o) => !o && setDetalheId(null)}
      />

      <AlertDialog open={!!excluirAlvo} onOpenChange={(o) => !o && setExcluirAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta</AlertDialogTitle>
            <AlertDialogDescription>
              A conta {excluirAlvo?.numero} será removida permanentemente. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleExcluir();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
