import { useEffect, useMemo, useState } from "react";
import { Dice5 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CurrencyInput } from "@/components/simulacao/currency-input";
import { formatBRL } from "@/lib/simulacao/format";

/**
 * "Jogada de números": infla o valor de compra e venda declarado para que o
 * percentual máximo financiável (LTV do banco) libere exatamente o valor que o
 * cliente precisa — a diferença vira o novo valor de entrada.
 *
 * Exemplo: imóvel de R$ 250 mil, cliente sem entrada, LTV 80%.
 *   valor ajustado = 250.000 / 0,8 = 312.500 (arredonda p/ 313.000)
 *   novo valor de entrada = 313.000 - 250.000 = 63.000
 *   financiamento liberado = 250.000
 *
 * Com "incluir custas" o divisor é reduzido pelo percentual de custas, inflando
 * mais o compra e venda para cobrir despesas de cartório/ITBI.
 *   Ex.: imóvel R$ 300 mil, sem entrada, LTV 80%, custas 5% → divisor 0,75.
 *   valor ajustado = 300.000 / 0,75 = 400.000
 *   novo valor de entrada = 400.000 - 300.000 = 100.000 | financiado 300.000
 */
export function JogadaNumerosDialog({
  valorImovelAtual,
  ltvMax,
  onAplicar,
}: {
  valorImovelAtual: number;
  /** LTV máximo do banco (0.8 = 80%). */
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
  const [ltvPct, setLtvPct] = useState(Math.round(ltvMax * 100));
  const [incluirCustas, setIncluirCustas] = useState(false);
  const [custasPct, setCustasPct] = useState(5);

  // Ao abrir, preenche com o valor atual do imóvel (cenário "financiar 100%").
  useEffect(() => {
    if (aberto) {
      setValorLiberar(valorImovelAtual || 0);
      setLtvPct(Math.round(ltvMax * 100));
      setIncluirCustas(false);
    }
  }, [aberto, valorImovelAtual, ltvMax]);

  // Marcar custas reduz o percentual da calculadora; desmarcar devolve.
  function alternarCustas(on: boolean) {
    setIncluirCustas(on);
    setLtvPct((p) => (on ? p - (Number(custasPct) || 0) : p + (Number(custasPct) || 0)));
  }

  // Alterar o percentual de custas reajusta o percentual da calculadora.
  function alterarCustas(novo: number) {
    if (incluirCustas) {
      setLtvPct((p) => p + (Number(custasPct) || 0) - (Number(novo) || 0));
    }
    setCustasPct(novo);
  }

  const calc = useMemo(() => {
    const liberar = Number(valorLiberar) || 0;
    const divisor = (Number(ltvPct) || 0) / 100;
    if (liberar <= 0 || divisor <= 0) {
      return { valorImovel: 0, entrada: 0, pctEntrada: 0, custas: 0, financiamentoBase: 0, valido: false };
    }
    // Arredonda o valor de compra e venda PARA CIMA no milhar. Arredondar para o
    // mais próximo podia baixar o valor abaixo do bruto necessário e fazer o
    // financiamento estourar o LTV do banco (o oposto do objetivo da jogada).
    const bruto = liberar / divisor;
    const valorImovel = Math.ceil(bruto / 1000) * 1000;
    const entrada = Math.max(0, valorImovel - liberar);
    const pctEntrada = valorImovel > 0 ? (entrada / valorImovel) * 100 : 0;
    // Parte do financiamento correspondente às custas (informada ao banco como
    // "custas financiadas"). Reduz a base para o total financiado seguir = liberar.
    const custas = incluirCustas ? Math.round(valorImovel * ((Number(custasPct) || 0) / 100)) : 0;
    const financiamentoBase = Math.max(0, liberar - custas);
    return { valorImovel, entrada, pctEntrada, custas, financiamentoBase, valido: true };
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
    setAberto(false);
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-md border border-primary/30 bg-gradient-to-br from-primary to-primary/80 px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm ring-1 ring-inset ring-white/10 transition-all hover:shadow-md hover:shadow-primary/25 hover:-translate-y-px active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          title="Ajusta os valores da operação para viabilizar a proposta"
        >
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" aria-hidden />
          <Dice5 className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
          Jogada de números
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Jogada de números</DialogTitle>
          <DialogDescription>
            Ajusta o valor de compra e venda para liberar o valor que o cliente precisa,
            transformando a diferença em entrada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Valor a liberar (financiamento) (R$)</Label>
            <CurrencyInput
              value={valorLiberar}
              onChange={setValorLiberar}
              placeholder="Ex: 250.000,00"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Percentual máximo financiável do banco (%)</Label>
            <input
              type="number"
              min={1}
              max={100}
              value={ltvPct}
              onChange={(e) => setLtvPct(Number(e.target.value))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm">Incluir custas</Label>
              <Switch checked={incluirCustas} onCheckedChange={alternarCustas} />
            </div>
            {incluirCustas && (
              <div className="space-y-1.5">
                <Label>Percentual de custas (%)</Label>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={custasPct}
                  onChange={(e) => alterarCustas(Number(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            )}
          </div>





          {calc.valido && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Valor de compra e venda ajustado</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatBRL(calc.valorImovel)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Novo valor de entrada ({Math.round(calc.pctEntrada)}%)
                </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatBRL(calc.entrada)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Financiamento liberado</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatBRL(Number(valorLiberar) || 0)}
                </span>
              </div>
              {incluirCustas && calc.custas > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Custas financiadas</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatBRL(calc.custas)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={aplicar} disabled={!calc.valido}>
            Aplicar à simulação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
