import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck2,
  CalendarClock,
  Clock3,
  DollarSign,
  Download,
  FileSpreadsheet,
  Repeat,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import { obterKpisRh } from "@/lib/rh/dashboard.functions";
import { obterControleFerias } from "@/lib/rh/ferias-controle.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/rh/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios · RH — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.relatorios"),
  component: RelatoriosRhPage,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso?: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

function RelatoriosRhPage() {
  const fn = useServerFn(obterKpisRh);
  const fnFerias = useServerFn(obterControleFerias);
  const { data, isLoading } = useQuery({ queryKey: ["rh-kpis"], queryFn: () => fn() });
  const ferias = useQuery({ queryKey: ["rh-ferias-controle"], queryFn: () => fnFerias() });
  const [exportando, setExportando] = useState(false);

  const admissoes = (data?.admissoesUltimos12 ?? []).map((m) => ({
    mes: m.mes.slice(5),
    total: m.total,
  }));
  const quadro = data?.quadroPorDepartamento ?? [];

  const criticos = useMemo(
    () =>
      (ferias.data?.itens ?? [])
        .filter((i) => i.dias_vencidos > 0 || i.dias_a_vencer > 0)
        .slice(0, 25),
    [ferias.data],
  );

  const linhasFerias = useMemo(
    () =>
      (ferias.data?.itens ?? []).map((i) => ({
        nome: i.nome,
        cargo: i.cargo_nome ?? "—",
        departamento: i.departamento_nome ?? "—",
        admissao: i.data_admissao,
        tempo_casa: `${Math.floor(i.tempo_casa_meses / 12)}a ${i.tempo_casa_meses % 12}m`,
        saldo: i.saldo_dias,
        vencidos: i.dias_vencidos,
        avos: `${i.avos_proporcionais}/12`,
        limite: i.proximo_vencimento ?? "",
        provisao: i.provisao,
      })),
    [ferias.data],
  );

  const colunas = [
    { key: "nome", label: "Funcionário" },
    { key: "cargo", label: "Cargo" },
    { key: "departamento", label: "Departamento" },
    { key: "admissao", label: "Admissão", format: "date" as const },
    { key: "tempo_casa", label: "Tempo de casa" },
    { key: "saldo", label: "Saldo (dias)", format: "int" as const, align: "right" as const },
    { key: "vencidos", label: "Vencidos", format: "int" as const, align: "right" as const },
    { key: "avos", label: "Proporcional" },
    { key: "limite", label: "Conceder até", format: "date" as const },
    { key: "provisao", label: "Provisão", format: "brl" as const, align: "right" as const },
  ];

  const meta = [
    `Emitido em ${new Date().toLocaleString("pt-BR")}`,
    `${linhasFerias.length} funcionários`,
  ];

  const exportarExcel = async () => {
    if (linhasFerias.length === 0) return toast.error("Nada para exportar.");
    setExportando(true);
    try {
      const { exportXLSX } = await import("@/lib/relatorios/report-xlsx");
      await exportXLSX(
        "relatorio-ferias-clt",
        "Gestão de Pessoas — Controle de férias (CLT)",
        meta,
        colunas,
        linhasFerias,
      );
      toast.success("Planilha gerada.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao exportar.");
    } finally {
      setExportando(false);
    }
  };

  const exportarPDF = async () => {
    if (linhasFerias.length === 0) return toast.error("Nada para exportar.");
    setExportando(true);
    try {
      const { exportPDF } = await import("@/lib/relatorios/report-pdf");
      exportPDF(
        "Controle de férias (CLT)",
        "Períodos aquisitivos apurados a partir da data de admissão de cada colaborador.",
        meta,
        [
          {
            label: "Com férias vencidas",
            valor: String(ferias.data?.resumo.comFeriasVencidas ?? 0),
          },
          { label: "Vencem em 90 dias", valor: String(ferias.data?.resumo.aVencer90 ?? 0) },
          { label: "Saldo de dias", valor: String(ferias.data?.resumo.diasSaldoTotal ?? 0) },
          { label: "Provisão", valor: brl(ferias.data?.resumo.provisaoTotal ?? 0) },
        ],
        colunas,
        linhasFerias,
        "relatorio-ferias-clt",
      );
      toast.success("PDF gerado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao exportar.");
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground md:text-2xl">
            Relatórios de Gestão de Pessoas
          </h1>
          <p className="text-xs text-muted-foreground">
            Quadro, custo, movimentações e controle de férias apurado pela data de admissão.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportarExcel} disabled={exportando}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button size="sm" onClick={exportarPDF} disabled={exportando}>
            <Download className="mr-2 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          titulo="Quadro ativo"
          valor={String((data?.ativos ?? 0) + (data?.experiencia ?? 0))}
          detalhe={`${data?.experiencia ?? 0} em experiência`}
          loading={isLoading}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          titulo="Em férias / afastados"
          valor={String((data?.ferias ?? 0) + (data?.afastados ?? 0))}
          detalhe={`${data?.ferias ?? 0} em férias`}
          loading={isLoading}
        />
        <KpiCard
          icon={<Clock3 className="h-4 w-4" />}
          titulo="Tempo médio de casa"
          valor={`${Math.floor((data?.tempoMedioCasaMeses ?? 0) / 12)}a ${(data?.tempoMedioCasaMeses ?? 0) % 12}m`}
          detalhe="Quadro ativo"
          loading={isLoading}
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          titulo="Custo mensal estimado"
          valor={brl(data?.custoMensalEstimado ?? 0)}
          detalhe="Salários vigentes"
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          titulo="Férias vencidas"
          valor={String(data?.feriasVencidas ?? 0)}
          detalhe="Colaboradores"
          tone="danger"
          loading={ferias.isLoading}
        />
        <KpiCard
          icon={<CalendarClock className="h-4 w-4" />}
          titulo="Vencem em 90 dias"
          valor={String(data?.feriasAVencer90 ?? 0)}
          detalhe="Programar concessão"
          tone="warning"
          loading={ferias.isLoading}
        />
        <KpiCard
          icon={<CalendarCheck2 className="h-4 w-4" />}
          titulo="Saldo de dias"
          valor={String(data?.feriasSaldoDias ?? 0)}
          detalhe="Adquiridos não gozados"
          loading={ferias.isLoading}
        />
        <KpiCard
          icon={<Repeat className="h-4 w-4" />}
          titulo="Turnover do mês"
          valor={`${(data?.turnoverMes ?? 0).toLocaleString("pt-BR")}%`}
          detalhe={`${data?.admissoesMes ?? 0} admissões · ${data?.desligamentosMes ?? 0} desligamentos`}
          loading={isLoading}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Prioridades de férias</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead className="hidden md:table-cell">Admissão</TableHead>
                  <TableHead className="text-center">Saldo</TableHead>
                  <TableHead className="hidden sm:table-cell">Conceder até</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Provisão</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ferias.isLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Carregando…
                    </TableCell>
                  </TableRow>
                )}
                {!ferias.isLoading && criticos.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Nenhuma pendência de férias no momento.
                    </TableCell>
                  </TableRow>
                )}
                {criticos.map((i) => (
                  <TableRow key={i.funcionario_id}>
                    <TableCell className="font-medium">
                      {i.nome}
                      <div className="text-[11px] text-muted-foreground">
                        {[i.cargo_nome, i.departamento_nome].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">
                      {dataBR(i.data_admissao)}
                    </TableCell>
                    <TableCell className="text-center font-semibold">{i.saldo_dias}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs">
                      {dataBR(i.proximo_vencimento)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right text-xs">
                      {brl(i.provisao)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[11px]",
                          i.dias_vencidos > 0
                            ? "bg-destructive/15 text-destructive"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {i.dias_vencidos > 0 ? "Vencida" : "A vencer"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/*
        Gráficos de admissões x desligamentos e quadro por departamento foram
        removidos a pedido: a empresa é pequena e os números cabem nos KPIs
        acima e nos relatórios detalhados abaixo.
      */}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Relatórios detalhados</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <RelLink
            to="/rh/funcionarios"
            titulo="Quadro de funcionários"
            desc="Lista completa com filtros por cargo, departamento e status."
          />
          <RelLink
            to="/rh/ferias"
            titulo="Controle de férias (CLT)"
            desc="Períodos aquisitivos, saldos e prazos de concessão."
          />
          <RelLink
            to="/rh/faltas-ocorrencias"
            titulo="Faltas e ocorrências"
            desc="Registros por competência e funcionário."
          />
          <RelLink
            to="/rh/previa-folha"
            titulo="Prévia da folha"
            desc="Consolidado mensal com fechamento e envio ao financeiro."
          />
          <RelLink
            to="/rh/holerites"
            titulo="Holerites"
            desc="Geração e histórico de recibos de pagamento."
          />
          <RelLink
            to="/rh/adiantamentos"
            titulo="Adiantamentos e descontos"
            desc="Lançamentos por competência."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon,
  titulo,
  valor,
  detalhe,
  loading,
  tone,
}: {
  icon: React.ReactNode;
  titulo: string;
  valor: string;
  detalhe: string;
  loading?: boolean;
  tone?: "danger" | "warning";
}) {
  return (
    <Card
      className={cn(
        tone === "danger" && "border-destructive/30",
        tone === "warning" && "border-amber-500/30",
      )}
    >
      <CardContent className="p-4">
        <div
          className={cn(
            "mb-1 flex items-center gap-2 text-xs text-muted-foreground",
            tone === "danger" && "text-destructive",
            tone === "warning" && "text-amber-600 dark:text-amber-400",
          )}
        >
          {icon}
          <span>{titulo}</span>
        </div>
        <div className="text-xl font-semibold text-foreground md:text-2xl">
          {loading ? "…" : valor}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{detalhe}</div>
      </CardContent>
    </Card>
  );
}

function RelLink({ to, titulo, desc }: { to: string; titulo: string; desc: string }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-muted/40"
    >
      <BarChart3 className="mt-0.5 h-4 w-4 text-primary" />
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground group-hover:text-primary">{titulo}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </Link>
  );
}
