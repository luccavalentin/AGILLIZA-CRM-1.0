import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Download, FileSpreadsheet, FileText, Palmtree, Repeat, Stethoscope, Users } from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import { obterKpisRh } from "@/lib/rh/dashboard.functions";
import { obterControleFerias } from "@/lib/rh/ferias-controle.functions";
import { listarFuncionarios } from "@/lib/rh/funcionarios.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { LinhaEstadoLista } from "@/components/rh/estado-lista";
import { usePermissao } from "@/hooks/use-permissao";
import { CONTRATO_LABEL, STATUS_FUNCIONARIO_LABEL } from "@/lib/rh/rotulos";
import type { ReportColumn, ReportRow } from "@/lib/relatorios/shared";

export const Route = createFileRoute("/_authenticated/rh/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios · RH — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.relatorios"),
  component: RelatoriosRhPage,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso?: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

type Rel = "quadro" | "ferias";

function RelatoriosRhPage() {
  const fn = useServerFn(obterKpisRh);
  const fnFerias = useServerFn(obterControleFerias);
  const fnFunc = useServerFn(listarFuncionarios);
  const podeExportar = usePermissao("rh.relatorios", "export");
  const verSalario = usePermissao("rh.salarios", "view");
  const [rel, setRel] = useState<Rel>("quadro");
  const [exportando, setExportando] = useState(false);

  const kpis = useQuery({ queryKey: ["rh-kpis"], queryFn: () => fn() });
  const ferias = useQuery({ queryKey: ["rh-ferias-controle"], queryFn: () => fnFerias() });
  const quadro = useQuery({
    queryKey: ["rh-funcionarios", "relatorio"],
    queryFn: () => fnFunc({ data: { incluir_desligados: true } }),
  });
  const d = kpis.data;

  // Salário e provisão só entram para quem vê salário (o servidor já manda vazio para os demais).
  const comValores = verSalario && (ferias.data?.resumo.comValores ?? false);
  const colunasQuadro: ReportColumn[] = useMemo(
    () => [
      { key: "numero", label: "Nº" },
      { key: "nome", label: "Colaborador" },
      { key: "cargo", label: "Cargo" },
      { key: "departamento", label: "Departamento" },
      { key: "contrato", label: "Contrato" },
      { key: "situacao", label: "Situação" },
      { key: "admissao", label: "Admissão", format: "date" },
      ...(verSalario ? [{ key: "salario", label: "Salário", format: "brl" as const, align: "right" as const, footer: "sum" as const }] : []),
    ],
    [verSalario],
  );
  const linhasQuadro: ReportRow[] = useMemo(
    () =>
      (quadro.data ?? []).map((f) => ({
        numero: f.numero,
        nome: f.nome,
        cargo: f.cargo_nome ?? "—",
        departamento: f.departamento_nome ?? "—",
        contrato: CONTRATO_LABEL[f.tipo_contrato] ?? f.tipo_contrato,
        situacao: STATUS_FUNCIONARIO_LABEL[f.status] ?? f.status,
        admissao: f.data_admissao,
        ...(verSalario ? { salario: f.salario_atual ?? 0 } : {}),
      })),
    [quadro.data, verSalario],
  );
  const colunasFerias: ReportColumn[] = useMemo(
    () => [
      { key: "nome", label: "Colaborador" },
      { key: "cargo", label: "Cargo" },
      { key: "admissao", label: "Admissão", format: "date" },
      { key: "saldo", label: "Saldo (dias)", format: "int", align: "right" },
      { key: "vencidos", label: "Vencidos", format: "int", align: "right" },
      { key: "avos", label: "Proporcional" },
      { key: "limite", label: "Conceder até", format: "date" },
      ...(comValores ? [{ key: "provisao", label: "Provisão", format: "brl" as const, align: "right" as const, footer: "sum" as const }] : []),
    ],
    [comValores],
  );
  const linhasFerias: ReportRow[] = useMemo(
    () =>
      (ferias.data?.itens ?? []).map((i) => ({
        nome: i.nome,
        cargo: i.cargo_nome ?? "—",
        admissao: i.data_admissao,
        saldo: i.saldo_dias,
        vencidos: i.dias_vencidos,
        avos: `${i.avos_proporcionais}/12`,
        limite: i.proximo_vencimento ?? "",
        ...(comValores ? { provisao: i.provisao } : {}),
      })),
    [ferias.data, comValores],
  );

  const atual =
    rel === "quadro"
      ? { titulo: "Quadro de colaboradores", arquivo: "rh-quadro", colunas: colunasQuadro, linhas: linhasQuadro }
      : { titulo: "Controle de férias (CLT)", arquivo: "rh-ferias", colunas: colunasFerias, linhas: linhasFerias };
  const meta = [`Emitido em ${new Date().toLocaleString("pt-BR")}`, `${atual.linhas.length} registro(s)`];

  async function exportar(formato: "csv" | "xlsx" | "pdf") {
    if (atual.linhas.length === 0) return toast.error("Nada para exportar.");
    setExportando(true);
    try {
      if (formato === "csv") {
        const { exportCSV } = await import("@/lib/relatorios/report-docx");
        exportCSV(atual.colunas, atual.linhas, atual.arquivo);
      } else if (formato === "xlsx") {
        const { exportXLSX } = await import("@/lib/relatorios/report-xlsx");
        await exportXLSX(atual.arquivo, `Gestão de Pessoas — ${atual.titulo}`, meta, atual.colunas, atual.linhas);
      } else {
        const { exportPDF } = await import("@/lib/relatorios/report-pdf");
        exportPDF(atual.titulo, "Gestão de Pessoas e RH", meta, [], atual.colunas, atual.linhas, atual.arquivo);
      }
      toast.success("Arquivo gerado.");
    } catch (e) {
      toast.error(mensagemDeErro(e, "Falha ao exportar."));
    } finally {
      setExportando(false);
    }
  }

  const q = rel === "quadro" ? quadro : ferias;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground md:text-[22px]">Relatórios de Gestão de Pessoas</h1>
        <p className="text-sm text-muted-foreground">
          Quadro e férias exportáveis (CSV, Excel, PDF). Salário e provisão só aparecem para quem vê salários.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Users} titulo="Headcount" valor={String(d?.headcount ?? 0)} detalhe={`${d?.desligados ?? 0} desligados no histórico`} />
        <Kpi icon={Repeat} titulo="Turnover 12 meses" valor={`${(d?.turnover12 ?? 0).toLocaleString("pt-BR")}%`} detalhe={`${d?.admissoes12 ?? 0} admissões · ${d?.desligamentos12 ?? 0} saídas`} />
        <Kpi icon={Stethoscope} titulo="Absenteísmo do mês" valor={`${(d?.absenteismoMes ?? 0).toLocaleString("pt-BR")}%`} detalhe={`${d?.faltasDiasMes ?? 0} falta(s) · ${d?.atestadosDiasMes ?? 0} atestado(s)`} />
        <Kpi icon={AlertTriangle} titulo="Férias vencidas" valor={String(d?.feriasVencidas ?? 0)} detalhe={`${d?.feriasAVencer90 ?? 0} vencem em 90 dias`} alerta={(d?.feriasVencidas ?? 0) > 0} />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={rel === "quadro" ? "default" : "outline"} onClick={() => setRel("quadro")}>
              <Users className="mr-1.5 h-4 w-4" /> Quadro
            </Button>
            <Button size="sm" variant={rel === "ferias" ? "default" : "outline"} onClick={() => setRel("ferias")}>
              <Palmtree className="mr-1.5 h-4 w-4" /> Férias
            </Button>
          </div>
          {podeExportar && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => exportar("csv")} disabled={exportando}>
                <FileText className="mr-1.5 h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportar("xlsx")} disabled={exportando}>
                <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel
              </Button>
              <Button size="sm" onClick={() => exportar("pdf")} disabled={exportando}>
                <Download className="mr-1.5 h-4 w-4" /> PDF
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <CardTitle className="px-4 pb-2 text-base">{atual.titulo}</CardTitle>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {atual.colunas.map((c) => (
                    <TableHead key={c.key} className={c.align === "right" ? "text-right" : ""}>
                      {c.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {atual.linhas.slice(0, 200).map((l, i) => (
                  <TableRow key={i}>
                    {atual.colunas.map((c) => {
                      const v = l[c.key];
                      const txt =
                        c.format === "brl" ? brl(Number(v ?? 0)) : c.format === "date" ? dataBR(v as string) : String(v ?? "—");
                      return (
                        <TableCell key={c.key} className={cn("text-sm", c.align === "right" && "text-right tabular-nums")}>
                          {c.key === "vencidos" && Number(v) > 0 ? (
                            <Badge variant="secondary" className="bg-destructive/15 text-destructive">
                              {txt}
                            </Badge>
                          ) : (
                            txt
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {atual.linhas.length === 0 && (
                  <LinhaEstadoLista colSpan={atual.colunas.length} q={q} vazio="Nada para mostrar." />
                )}
              </TableBody>
            </Table>
          </div>
          {atual.linhas.length > 200 && (
            <p className="px-4 py-2 text-xs text-muted-foreground">
              Mostrando 200 de {atual.linhas.length}. A exportação traz todos.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-2 sm:grid-cols-3">
        <Atalho to="/rh/folha" titulo="Folha mensal" desc="Lançamentos, prévia, fechamento e holerites." />
        <Atalho to="/rh/ferias" titulo="Férias" desc="Programação, aprovação e vencimentos." />
        <Atalho to="/rh/documentos" titulo="Documentos" desc="Vencidos e a vencer." />
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  titulo,
  valor,
  detalhe,
  alerta,
}: {
  icon: typeof Users;
  titulo: string;
  valor: string;
  detalhe: string;
  alerta?: boolean;
}) {
  return (
    <Card className={cn(alerta && "border-destructive/30")}>
      <CardContent className="p-4">
        <div className={cn("mb-1 flex items-center gap-2 text-xs text-muted-foreground", alerta && "text-destructive")}>
          <Icon className="h-4 w-4" />
          <span className="truncate">{titulo}</span>
        </div>
        <div className="text-xl font-semibold text-foreground">{valor}</div>
        <div className="mt-1 truncate text-xs text-muted-foreground">{detalhe}</div>
      </CardContent>
    </Card>
  );
}

function Atalho({ to, titulo, desc }: { to: string; titulo: string; desc: string }) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-border/60 bg-card p-3 transition-colors hover:border-primary/50 hover:bg-muted/40"
    >
      <div className="text-sm font-medium text-foreground group-hover:text-primary">{titulo}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </Link>
  );
}
