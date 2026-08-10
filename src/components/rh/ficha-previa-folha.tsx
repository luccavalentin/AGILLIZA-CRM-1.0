/**
 * Prévia da folha do funcionário — dentro da própria ficha.
 *
 * Monta automaticamente a base CLT da competência escolhida a partir do que
 * já está cadastrado (salário vigente, benefícios ativos com desconto,
 * adiantamentos, descontos e faltas não abonadas do mês) e mostra o líquido
 * estimado. O holerite definitivo é gerado pelo construtor CLT, já travado
 * neste funcionário.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calculator, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { YearPicker } from "@/components/rh/year-picker";
import { HoleriteBuilderDialog } from "@/components/rh/holerite-builder-dialog";
import { obterFuncionario } from "@/lib/rh/funcionarios.functions";
import {
  listarAdiantamentos,
  listarBeneficiosDoFuncionario,
  listarDescontos,
  listarOcorrencias,
} from "@/lib/rh/submodulos.functions";
import { calcularHolerite, ENTRADA_PADRAO } from "@/lib/rh/holerite-calc";
import { formatBRL } from "@/lib/financeiro/format";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function ultimoDia(ano: number, mes: number) {
  return new Date(ano, mes, 0).getDate();
}

export function FichaPreviaFolha({ funcionarioId }: { funcionarioId: string }) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());

  const fnFunc = useServerFn(obterFuncionario);
  const fnBen = useServerFn(listarBeneficiosDoFuncionario);
  const fnAdi = useServerFn(listarAdiantamentos);
  const fnDes = useServerFn(listarDescontos);
  const fnOco = useServerFn(listarOcorrencias);

  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia(ano, mes)).padStart(2, "0")}`;

  const qFunc = useQuery({
    queryKey: ["rh-funcionario", funcionarioId],
    queryFn: () => fnFunc({ data: { id: funcionarioId } }),
  });
  const qBen = useQuery({
    queryKey: ["rh-ficha-benef", funcionarioId],
    queryFn: () => fnBen({ data: { funcionario_id: funcionarioId } }),
  });
  const qAdi = useQuery({
    queryKey: ["rh-ficha-adi", funcionarioId, mes, ano],
    queryFn: () =>
      fnAdi({ data: { funcionario_id: funcionarioId, competencia_mes: mes, competencia_ano: ano } }),
  });
  const qDes = useQuery({
    queryKey: ["rh-ficha-desc", funcionarioId, mes, ano],
    queryFn: () =>
      fnDes({ data: { funcionario_id: funcionarioId, competencia_mes: mes, competencia_ano: ano } }),
  });
  const qOco = useQuery({
    queryKey: ["rh-ficha-oco-mes", funcionarioId, mes, ano],
    queryFn: () =>
      fnOco({ data: { funcionario_id: funcionarioId, tipo: "falta", desde: inicio, ate: fim } }),
  });

  const entrada = useMemo(() => {
    const salario = Number(qFunc.data?.salario_atual ?? 0);
    const beneficios = (qBen.data ?? []).filter(
      (b) => b.ativo && (!b.vigencia_fim || b.vigencia_fim >= inicio),
    );
    const descontoBeneficios = beneficios.reduce((s, b) => s + Number(b.desconto ?? 0), 0);
    const adiantamento = (qAdi.data ?? [])
      .filter((a: any) => a.status !== "cancelado")
      .reduce((s: number, a: any) => s + Number(a.valor ?? 0), 0);
    const outrosDescontos = (qDes.data ?? [])
      .filter((d: any) => d.status !== "cancelado")
      .reduce((s: number, d: any) => s + Number(d.valor ?? 0), 0);
    const faltas = (qOco.data ?? [])
      .filter((o) => !o.abonada)
      .reduce((s, o) => s + Number(o.dias ?? 1), 0);

    return {
      ...ENTRADA_PADRAO,
      salario_base: salario,
      faltas_dias: faltas,
      outros_descontos: outrosDescontos + descontoBeneficios,
      outros_descontos_desc: "Benefícios e descontos da competência",
      adiantamento,
      dependentes_ir: 0,
    };
  }, [qFunc.data, qBen.data, qAdi.data, qDes.data, qOco.data, inicio]);

  const calc = useMemo(() => calcularHolerite(entrada), [entrada]);
  const carregando =
    qFunc.isLoading || qBen.isLoading || qAdi.isLoading || qDes.isLoading || qOco.isLoading;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle className="text-base">Prévia da folha</CardTitle>
          <p className="text-xs text-muted-foreground">
            Cálculo CLT automático com salário vigente, benefícios, adiantamentos, descontos e
            faltas não abonadas da competência.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Mês</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="h-9 w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Ano</Label>
            <YearPicker value={ano} onChange={setAno} />
          </div>
          <HoleriteBuilderDialog
            funcionarioFixo={funcionarioId}
            trigger={
              <Button size="sm">
                <Calculator className="mr-2 h-3.5 w-3.5" /> Gerar holerite
              </Button>
            }
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {carregando ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Calculando…
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Bloco label="Proventos" valor={formatBRL(calc.total_proventos)} />
              <Bloco label="Descontos" valor={formatBRL(calc.total_descontos)} tone="danger" />
              <Bloco label="FGTS do mês" valor={formatBRL(calc.fgts)} />
              <Bloco label="Líquido estimado" valor={formatBRL(calc.liquido)} tone="success" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Lista titulo="Proventos" linhas={calc.proventos} />
              <Lista titulo="Descontos" linhas={calc.descontos} />
            </div>

            <p className="text-[11px] text-muted-foreground">
              Faltas não abonadas na competência: {entrada.faltas_dias} · Adiantamentos:{" "}
              {formatBRL(entrada.adiantamento)} · Base INSS {formatBRL(calc.base_inss)} · Base IRRF{" "}
              {formatBRL(calc.base_irrf)}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Bloco({
  label,
  valor,
  tone,
}: {
  label: string;
  valor: string;
  tone?: "success" | "danger";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={
          "mt-1 text-lg font-semibold tabular-nums " +
          (tone === "success"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "danger"
              ? "text-destructive"
              : "text-foreground")
        }
      >
        {valor}
      </div>
    </div>
  );
}

function Lista({
  titulo,
  linhas,
}: {
  titulo: string;
  linhas: { descricao: string; referencia?: string | null; valor: number }[];
}) {
  return (
    <div className="rounded-lg border border-border">
      <div className="border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {titulo}
      </div>
      {linhas.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">Nada lançado.</p>
      ) : (
        <ul className="divide-y divide-border">
          {linhas.map((l, i) => (
            <li key={`${l.descricao}-${i}`} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {l.descricao}
                {l.referencia ? (
                  <span className="ml-1 text-xs text-muted-foreground">({l.referencia})</span>
                ) : null}
              </span>
              <span className="tabular-nums">{formatBRL(l.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
