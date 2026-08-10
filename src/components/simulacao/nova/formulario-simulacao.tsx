import { Calculator } from "lucide-react";
import { useEffect, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/simulacao/currency-input";
import { DicaRendaMinima } from "@/components/simulacao/dica-renda-minima";
import { PRODUTOS, TIPOS_IMOVEL, USOS_IMOVEL, SITUACOES_IMOVEL } from "@/lib/simulacao/schemas";
import { UFS } from "@/lib/simulacao/format";
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
  aplicarPorFinanciamentoTotal: (v: number) => void;
  alternarFinanciarDespesas: (marcado: boolean) => void;
  financiamentoTotalExibido: number;
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
  aplicarPorFinanciamentoTotal,
  alternarFinanciarDespesas,
  financiamentoTotalExibido,
  aplicarPorParcela,
  definirPrazo,
  maxPrazoIdade,
  melhorTaxaAno,
}: Props) {
  const pctEntrada = Math.round((1 - ltvMax) * 100);
  const pctFin = Math.round(ltvMax * 100);
  const isPrice = w.sistema_amortizacao === "P";
  const rendaRef = useRef<HTMLDivElement>(null);
  const rendaInputRef = useRef<HTMLInputElement>(null);
  const jaFocou = useRef(false);

  useEffect(() => {
    if (isPrice && (!w.renda_familiar || w.renda_familiar <= 0) && !jaFocou.current) {
      jaFocou.current = true;
      setTimeout(() => {
        rendaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        rendaInputRef.current?.focus();
      }, 120);
    }
    if (!isPrice) jaFocou.current = false;
  }, [isPrice, w.renda_familiar]);

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
            onValueChange={(v) =>
              set("sistema_amortizacao", v as WizardState["sistema_amortizacao"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="S">SAC</SelectItem>
              <SelectItem value="P">PRICE</SelectItem>
              <SelectItem value="AMBOS">OverPrice (SAC e PRICE)</SelectItem>
            </SelectContent>
          </Select>
          {w.sistema_amortizacao !== "S" && (
            <p className="text-[10px] text-muted-foreground mt-1">
              * Itaú opera exclusivamente via tabela SAC.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>
            Tipo de imóvel <span className="text-destructive">*</span>
          </Label>
          <Select value={w.tipo_imovel} onValueChange={(v) => set("tipo_imovel", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_IMOVEL.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>
            Uso do imóvel <span className="text-destructive">*</span>
          </Label>
          <Select value={w.uso_imovel} onValueChange={(v) => set("uso_imovel", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {USOS_IMOVEL.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>
            Situação do imóvel <span className="text-destructive">*</span>
          </Label>
          <Select value={w.situacao_imovel} onValueChange={(v) => set("situacao_imovel", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {SITUACOES_IMOVEL.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>
            UF <span className="text-destructive">*</span>
          </Label>
          <Select value={w.uf} onValueChange={(v) => set("uf", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {UFS.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>
            Utiliza FGTS? <span className="text-destructive">*</span>
          </Label>
          <Select
            value={w.utiliza_fgts}
            onValueChange={(v) => set("utiliza_fgts", v as WizardState["utiliza_fgts"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="S">Sim</SelectItem>
              <SelectItem value="N">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={!!w.fg_financiar_despesas}
              onCheckedChange={(v) => alternarFinanciarDespesas(v === true)}
            />
            Financiar despesas (incluir custos no valor financiado)
          </label>
          {w.fg_financiar_despesas && (
            <div className="space-y-1.5 pt-1">
              <Label>Despesas a financiar (R$)</Label>
              <CurrencyInput
                value={w.valor_despesas_financiadas}
                onChange={(v) => set("valor_despesas_financiadas", v)}
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">
                Sugestão: 5% do valor do imóvel. Este valor entra no "Valor a financiar".
              </p>
            </div>
          )}
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
                    Informe a parcela desejada — o imóvel, a entrada e o financiamento são ajustados
                    automaticamente respeitando o teto do banco ({pctFin}%).
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
            value={financiamentoTotalExibido}
            onChange={(v) => aplicarPorFinanciamentoTotal(v)}
            placeholder="0,00"
          />
          <p className="text-xs text-muted-foreground">
            Ao digitar aqui, o imóvel e a entrada são preenchidos automaticamente considerando o
            teto do banco ({pctFin}%).
            {w.fg_financiar_despesas && (w.valor_despesas_financiadas || 0) > 0 && (
              <>
                {" "}
                Já inclui as despesas de{" "}
                <span className="font-medium text-foreground">
                  {formatBRL(w.valor_despesas_financiadas)}
                </span>{" "}
                (imóvel: {formatBRL(w.valor_financiamento)}).
              </>
            )}
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

        <div
          id="campo-renda-familiar"
          ref={rendaRef}
          className="space-y-4 md:col-span-2 scroll-mt-24 pt-2"
        >
          {w.valor_financiamento > 0 && w.prazo_meses >= PRAZO_MIN && (
            <DicaRendaMinima
              valorFinanciamento={w.valor_financiamento}
              valorImovel={w.valor_imovel}
              prazoMeses={w.prazo_meses}
              taxaAno={melhorTaxaAno}
              sistema={w.sistema_amortizacao}
              rendaInformada={
                w.sistema_amortizacao === "AMBOS" ? w.renda_familiar_price : w.renda_familiar
              }
            />
          )}
          {!(w.valor_financiamento > 0 && w.prazo_meses >= PRAZO_MIN) && (
            <p className="text-xs text-muted-foreground text-center">
              A renda mínima necessária será calculada automaticamente com base nos valores
              informados.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
