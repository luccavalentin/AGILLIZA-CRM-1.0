import { useMemo, useState } from "react";
import { Calculator, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CurrencyInput } from "@/components/simulacao/currency-input";
import { formatBRL } from "@/lib/simulacao/format";

/**
 * Modo reverso de simulação: usuário informa o valor que quer financiar e
 * o percentual máximo do banco; o componente calcula o valor de compra e venda
 * necessário e a entrada equivalente, aplicando na simulação em curso.
 *
 * Reaproveita o mesmo cálculo/`aplicarJogadaNumeros` da Jogada de números,
 * mas em versão inline (não modal) para ficar visível como um modo alternativo.
 */
export function SimularPorFinanciamento({
  ltvMax,
  onAplicar,
}: {
  ltvMax: number;
  onAplicar: (dados: {
    valorImovel: number;
    valorEntrada: number;
    valorFinanciamento: number;
    financiaCustas: boolean;
    valorCustas: number;
  }) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [valorLiberar, setValorLiberar] = useState(0);
  const [ltvPct, setLtvPct] = useState(Math.round((ltvMax || 0.8) * 100));
  const [incluirCustas, setIncluirCustas] = useState(false);
  const [custasPct, setCustasPct] = useState(5);

  const calc = useMemo(() => {
    const liberar = Number(valorLiberar) || 0;
    const pct = incluirCustas ? Math.max(0, ltvPct - custasPct) : ltvPct;
    const divisor = pct / 100;
    if (liberar <= 0 || divisor <= 0) {
      return { valorImovel: 0, entrada: 0, custas: 0, financiamentoBase: 0, valido: false };
    }
    const bruto = liberar / divisor;
    const valorImovel = Math.ceil(bruto / 1000) * 1000;
    const entrada = Math.max(0, valorImovel - liberar);
    const custas = incluirCustas ? Math.round(valorImovel * ((Number(custasPct) || 0) / 100)) : 0;
    const financiamentoBase = Math.max(0, liberar - custas);
    return { valorImovel, entrada, custas, financiamentoBase, valido: true };
  }, [valorLiberar, ltvPct, incluirCustas, custasPct]);

  function aplicar() {
    if (!calc.valido) return;
    onAplicar({
      valorImovel: calc.valorImovel,
      valorEntrada: calc.entrada,
      valorFinanciamento: calc.financiamentoBase,
      financiaCustas: incluirCustas,
      valorCustas: calc.custas,
    });
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Calculator className="h-4 w-4 text-primary" />
          Simular pelo valor a financiar
          <span className="text-xs font-normal text-muted-foreground">
            (informe quanto quer financiar; o sistema calcula imóvel e entrada)
          </span>
        </span>
        {aberto ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {aberto && (
        <div className="space-y-4 border-t border-border/60 p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Valor a financiar (R$)</Label>
              <CurrencyInput
                value={valorLiberar}
                onChange={setValorLiberar}
                placeholder="Ex: 250.000,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>% máximo financiável do banco</Label>
              <input
                type="number"
                min={1}
                max={100}
                value={ltvPct}
                onChange={(e) => setLtvPct(Number(e.target.value))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/60 px-3 py-2">
            <Label className="text-sm">Incluir custas no financiamento</Label>
            <div className="flex items-center gap-3">
              {incluirCustas && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={custasPct}
                    onChange={(e) => setCustasPct(Number(e.target.value))}
                    className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm tabular-nums"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              )}
              <Switch checked={incluirCustas} onCheckedChange={setIncluirCustas} />
            </div>
          </div>

          {calc.valido && (
            <div className="grid grid-cols-1 gap-2 rounded-md border border-border bg-background p-3 text-sm md:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Valor do imóvel</p>
                <p className="font-semibold tabular-nums text-foreground">
                  {formatBRL(calc.valorImovel)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor de entrada</p>
                <p className="font-semibold tabular-nums text-foreground">
                  {formatBRL(calc.entrada)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Financiamento</p>
                <p className="font-semibold tabular-nums text-foreground">
                  {formatBRL(Number(valorLiberar) || 0)}
                </p>
              </div>
              {incluirCustas && calc.custas > 0 && (
                <div className="md:col-span-3">
                  <p className="text-xs text-muted-foreground">
                    Custas financiadas:{" "}
                    <span className="font-medium text-foreground">{formatBRL(calc.custas)}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={aplicar} disabled={!calc.valido}>
              Aplicar à simulação
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
