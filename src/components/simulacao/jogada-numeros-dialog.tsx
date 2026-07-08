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
 *   entrada de fachada = 400.000 - 300.000 = 100.000 | financiado 300.000
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
    }
  }, [aberto, valorImovelAtual, ltvMax]);

  const calc = useMemo(() => {
    const liberar = Number(valorLiberar) || 0;
    const ltv = (Number(ltvPct) || 0) / 100;
    // Com custas, reduz o divisor pelo percentual informado (ex.: 80% - 5% = 75%),
    // inflando ainda mais o compra e venda para cobrir cartório/ITBI.
    const custas = incluirCustas ? (Number(custasPct) || 0) / 100 : 0;
    const divisor = ltv - custas;
    if (liberar <= 0 || divisor <= 0) {
      return { valorImovel: 0, entrada: 0, pctEntrada: 0, valido: false };
    }
    // Arredonda o valor de compra e venda PARA CIMA no milhar. Arredondar para o
    // mais próximo podia baixar o valor abaixo do bruto necessário e fazer o
    // financiamento estourar o LTV do banco (o oposto do objetivo da jogada).
    const bruto = liberar / divisor;
    const valorImovel = Math.ceil(bruto / 1000) * 1000;
    const entrada = Math.max(0, valorImovel - liberar);
    const pctEntrada = valorImovel > 0 ? (entrada / valorImovel) * 100 : 0;
    return { valorImovel, entrada, pctEntrada, valido: true };
  }, [valorLiberar, ltvPct, incluirCustas, custasPct]);


  function aplicar() {
    if (!calc.valido) return;
    onAplicar({
      valorImovel: calc.valorImovel,
      valorEntrada: calc.entrada,
      valorFinanciamento: Number(valorLiberar) || 0,
    });
    setAberto(false);
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Dice5 className="mr-1 h-4 w-4" /> Jogada de números
        </Button>
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
            <p className="text-xs text-muted-foreground">
              Quanto o cliente precisa financiar (ex.: o valor real do imóvel, sem entrada).
            </p>
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
            <p className="text-xs text-muted-foreground">
              LTV do banco. Normalmente 80% (financiamento) ou 60% (home equity).
            </p>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Incluir custas</Label>
                <p className="text-xs text-muted-foreground">
                  Infla mais o compra e venda para cobrir cartório e ITBI.
                </p>
              </div>
              <Switch checked={incluirCustas} onCheckedChange={setIncluirCustas} />
            </div>
            {incluirCustas && (
              <div className="space-y-1.5">
                <Label>Percentual de custas (%)</Label>
                <input
                  type="number"
                  min={0}
                  max={ltvPct - 1}
                  value={custasPct}
                  onChange={(e) => setCustasPct(Number(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  Reduz o divisor (ex.: 80% − 5% = 75%). Normalmente ~5%.
                </p>
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
