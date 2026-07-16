import { Calculator } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/simulacao/currency-input";
import { DicaRendaMinima } from "@/components/simulacao/dica-renda-minima";
import { PRODUTOS } from "@/lib/simulacao/schemas";
import { formatBRL } from "@/lib/simulacao/format";
import { formatarMeses } from "@/lib/simulacao/prazo";
import type { WizardState } from "./use-wizard-simulacao";
import { PRAZO_MIN, PRAZO_MAX } from "./use-wizard-simulacao";

interface Props {
  w: WizardState;
  set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
  ltvMax: number;
  entradaSugerida: number;
  aplicarEntradaSugerida: () => void;
  aplicarValorImovel: (v: number) => void;
  aplicarPorEntrada: (v: number) => void;
  aplicarPorFinanciamento: (v: number) => void;
  aplicarPorParcela: (v: number) => void;
  definirPrazo: (valor: number) => void;
  maxPrazoIdade: number | null | undefined;
  melhorTaxaAno: number;
}

export function FormularioSimulacao({
  w,
  set,
  ltvMax,
  entradaSugerida,
  aplicarEntradaSugerida,
  aplicarValorImovel,
  aplicarPorEntrada,
  aplicarPorFinanciamento,
  aplicarPorParcela,
  definirPrazo,
  maxPrazoIdade,
  melhorTaxaAno,
}: Props) {
  const pctEntrada = Math.round((1 - ltvMax) * 100);
  const pctFin = Math.round(ltvMax * 100);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-4 border-b border-border/60 bg-gradient-to-br from-primary/5 via-card to-card p-5 md:p-6">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
          <Calculator className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Simular financiamento
          </h1>
          <p className="text-sm text-muted-foreground">
            Informe os dados abaixo para estimar as condições entre os bancos parceiros.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-5 gap-y-4 p-5 md:p-6 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Produto</Label>
          <Select
            value={w.produto}
            onValueChange={(v) => set("produto", v as WizardState["produto"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUTOS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Sistema de amortização</Label>
          <Select
            value={w.sistema_amortizacao}
            onValueChange={(v) => set("sistema_amortizacao", v as WizardState["sistema_amortizacao"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="S">SAC</SelectItem>
              <SelectItem value="P">PRICE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Simular pelo valor da parcela (cálculo reverso) */}
        <div className="md:col-span-2">
          <div className="group relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] via-background to-background shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary via-primary/60 to-primary/20" />
            <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm ring-1 ring-primary/30">
                  <Calculator className="h-4 w-4" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold tracking-tight text-foreground">
                      Simular pelo valor da parcela
                    </p>
                    <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Cálculo reverso
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Informe a parcela desejada — o imóvel, a entrada e o financiamento são
                    ajustados automaticamente respeitando o teto do banco ({pctFin}%).
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-56">
                <Label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Parcela desejada
                </Label>
                <CurrencyInput
                  value={w.parcela_alvo}
                  onChange={(v) => {
                    set("parcela_alvo", v);
                    aplicarPorParcela(v);
                  }}
                  placeholder="Ex: 3.500,00"
                  className="h-11 border-primary/30 bg-background text-base font-semibold tracking-tight"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>
            Valor do imóvel <span className="text-destructive">*</span>
          </Label>
          <CurrencyInput
            value={w.valor_imovel}
            onChange={(v) => aplicarValorImovel(v)}
            placeholder="0,00"
          />
        </div>

        <div className="space-y-1.5">
          <Label>
            Valor da entrada <span className="text-destructive">*</span>
          </Label>
          <CurrencyInput
            value={w.valor_entrada}
            onChange={(v) => aplicarPorEntrada(v)}
            placeholder="0,00"
          />
          {w.valor_imovel > 0 && (
            <p className="text-xs text-muted-foreground">
              Entrada sugerida ({pctEntrada}%):{" "}
              <span className="font-medium text-foreground">{formatBRL(entradaSugerida)}</span>
              {w.valor_entrada !== entradaSugerida && (
                <button
                  type="button"
                  onClick={aplicarEntradaSugerida}
                  className="ml-2 font-medium text-primary underline-offset-2 hover:underline"
                >
                  Aplicar
                </button>
              )}
            </p>
          )}
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label>
            Valor a financiar <span className="text-destructive">*</span>
          </Label>
          <CurrencyInput
            value={w.valor_financiamento}
            onChange={(v) => aplicarPorFinanciamento(v)}
            placeholder="0,00"
          />
          <p className="text-xs text-muted-foreground">
            Ao digitar aqui, o imóvel e a entrada são preenchidos automaticamente considerando o
            teto do banco ({pctFin}%).
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>
            Data de nascimento <span className="text-destructive">*</span>
          </Label>
          <Input
            type="date"
            value={w.data_nascimento}
            onChange={(e) => set("data_nascimento", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>
            Prazo (meses) <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            min={PRAZO_MIN}
            max={maxPrazoIdade ?? PRAZO_MAX}
            step={12}
            placeholder="360 meses"
            value={w.prazo_meses || ""}
            onChange={(e) => set("prazo_meses", Number(e.target.value))}
            onBlur={(e) => definirPrazo(Number(e.target.value))}
            onWheel={(e) => (e.target as HTMLInputElement).blur()}
          />
          <p className="text-xs text-muted-foreground">
            {w.prazo_meses > 0
              ? `Equivale a ${(w.prazo_meses / 12).toFixed(1).replace(".0", "")} anos · mín. ${PRAZO_MIN} / máx. ${maxPrazoIdade ?? PRAZO_MAX} meses`
              : `Entre ${PRAZO_MIN} e ${maxPrazoIdade ?? PRAZO_MAX} meses`}
            {maxPrazoIdade != null && ` · limite para a idade: ${formatarMeses(maxPrazoIdade)}`}
          </p>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>Renda familiar mensal (opcional)</Label>
          <CurrencyInput
            value={w.renda_familiar}
            onChange={(v) => set("renda_familiar", v)}
            placeholder="0,00"
          />
          {w.valor_financiamento > 0 && w.prazo_meses >= PRAZO_MIN ? (
            <DicaRendaMinima
              valorFinanciamento={w.valor_financiamento}
              valorImovel={w.valor_imovel}
              prazoMeses={w.prazo_meses}
              taxaAno={melhorTaxaAno}
              sistema={w.sistema_amortizacao}
              rendaInformada={w.renda_familiar}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Informe para verificarmos se atende à renda mínima exigida.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
