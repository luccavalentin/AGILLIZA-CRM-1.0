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
  entradaSugerida: number;
  aplicarEntradaSugerida: () => void;
  definirPrazo: (valor: number) => void;
  maxPrazoIdade: number | null | undefined;
  melhorTaxaAno: number;
}

export function FormularioSimulacao({
  w,
  set,
  entradaSugerida,
  aplicarEntradaSugerida,
  definirPrazo,
  maxPrazoIdade,
  melhorTaxaAno,
}: Props) {
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
        <div className="space-y-1.5 md:col-span-2">
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
          <Label>
            Valor do imóvel que deseja financiar <span className="text-destructive">*</span>
          </Label>
          <CurrencyInput
            value={w.valor_imovel}
            onChange={(v) => set("valor_imovel", v)}
            placeholder="0,00"
          />
        </div>

        <div className="space-y-1.5">
          <Label>
            Valor da entrada <span className="text-destructive">*</span>
          </Label>
          <CurrencyInput
            value={w.valor_entrada}
            onChange={(v) => set("valor_entrada", v)}
            placeholder="0,00"
          />
          {w.valor_imovel > 0 && (
            <p className="text-xs text-muted-foreground">
              Entrada sugerida (20%):{" "}
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
            Valor do crédito que precisa <span className="text-destructive">*</span>
          </Label>
          <CurrencyInput
            value={w.valor_financiamento}
            onChange={(v) => set("valor_financiamento", v)}
            placeholder="0,00"
          />
        </div>

        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 md:col-span-2">
          <div className="space-y-1.5">
            <Label>
              Informe sua data de nascimento <span className="text-destructive">*</span>
            </Label>
            <Input
              type="date"
              value={w.data_nascimento}
              onChange={(e) => set("data_nascimento", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Em quantos meses irá financiar <span className="text-destructive">*</span>
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
              sistema="S"
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
