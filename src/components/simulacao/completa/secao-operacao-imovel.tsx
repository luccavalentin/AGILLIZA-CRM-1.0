import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/simulacao/currency-input";
import { JogadaNumerosDialog } from "@/components/simulacao/jogada-numeros-dialog";
import { SimularPorFinanciamento } from "@/components/simulacao/simular-por-financiamento";
import { Campo, Ast, Erro } from "@/components/simulacao/completa/campo";
import { formatBRL } from "@/lib/simulacao/format";
import { formatarMeses } from "@/lib/simulacao/prazo";
import {
  TIPOS_IMOVEL,
  USOS_IMOVEL,
  SITUACOES_IMOVEL,
  PRODUTOS,
} from "@/lib/simulacao/schemas";
import { UFS } from "@/lib/simulacao/format";
import type { SimulacaoCompletaCtx } from "@/lib/simulacao/use-simulacao-completa";

export function SecaoOperacaoImovel({ ctx }: { ctx: SimulacaoCompletaCtx }) {
  const {
    f,
    set,
    erros,
    ltvMax,
    financiamentoMaximo,
    entradaMinima,
    entradaMinimaEfetiva,
    financiamentoExcedido,
    maxPrazoIdade,
    aplicarEntradaSugerida,
    aplicarJogadaNumeros,
    definirPrazo,
    setSistemaAmortizacao,
    alternarFinanciarDespesas,
    definirPctDespesas,
    normalizarPctDespesas,
    pctDespesas,
  } = ctx;

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Campo label={<>Produto <Ast /></>}>
          <Select value={f.produto} onValueChange={(v) => set("produto", v)}>
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
        </Campo>
        <Campo label={<>Tipo de imóvel <Ast /></>}>
          <Select value={f.tipo_imovel} onValueChange={(v) => set("tipo_imovel", v)}>
            <SelectTrigger aria-invalid={!!erros.tipo_imovel}>
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
          <Erro erros={erros} campo="tipo_imovel" />
        </Campo>
        <Campo label={<>Uso do imóvel <Ast /></>}>
          <Select value={f.uso_imovel} onValueChange={(v) => set("uso_imovel", v)}>
            <SelectTrigger aria-invalid={!!erros.uso_imovel}>
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
          <Erro erros={erros} campo="uso_imovel" />
        </Campo>
        <Campo label={<>Situação do imóvel <Ast /></>}>
          <Select value={f.situacao_imovel} onValueChange={(v) => set("situacao_imovel", v)}>
            <SelectTrigger aria-invalid={!!erros.situacao_imovel}>
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
          <Erro erros={erros} campo="situacao_imovel" />
        </Campo>
        <Campo label={<>UF <Ast /></>}>
          <Select value={f.uf} onValueChange={(v) => set("uf", v)}>
            <SelectTrigger aria-invalid={!!erros.uf}>
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
          <Erro erros={erros} campo="uf" />
        </Campo>
      </div>

      <Separator className="border-border/60" />

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Valores da operação</p>
        <JogadaNumerosDialog
          valorImovelAtual={Number(f.valor_imovel) || 0}
          ltvMax={ltvMax}
          onAplicar={aplicarJogadaNumeros}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Campo label={<>Valor do imóvel (R$) <Ast /></>}>
          <CurrencyInput
            value={f.valor_imovel}
            onChange={(v) => set("valor_imovel", v)}
            placeholder="Ex: 500.000,00"
          />
          <Erro erros={erros} campo="valor_imovel" />
        </Campo>
        <Campo label={<>Valor de entrada (R$) <Ast /></>}>
          <CurrencyInput
            value={f.valor_entrada}
            onChange={(v) => set("valor_entrada", v)}
            placeholder="Ex: 100.000,00"
          />
          {f.valor_imovel > 0 && (
            <p className="text-xs text-muted-foreground">
              Entrada sugerida (20%):{" "}
              <span className="font-medium text-foreground">
                {formatBRL(Math.round(f.valor_imovel * 0.2))}
              </span>
              {f.valor_entrada !== Math.round(f.valor_imovel * 0.2) && (
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
          {financiamentoExcedido && (
            <p className="text-xs font-medium text-destructive">
              {f.fg_financiar_despesas ? (
                <>
                  Financiamento + despesas não pode passar de {Math.round(ltvMax * 100)}% do
                  imóvel ({formatBRL(financiamentoMaximo)}). Informe uma entrada de pelo menos{" "}
                  {formatBRL(entradaMinimaEfetiva)}.
                </>
              ) : (
                <>
                  O banco financia no máximo {Math.round(ltvMax * 100)}% do imóvel (
                  {formatBRL(financiamentoMaximo)}). Informe uma entrada de pelo menos{" "}
                  {formatBRL(entradaMinima)}.
                </>
              )}
            </p>
          )}
        </Campo>

        <Campo label="Valor total do financiamento (R$)">
          <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-semibold tabular-nums text-foreground">
            {formatBRL(
              (f.valor_financiamento || 0) +
                (f.fg_financiar_despesas ? Number(f.valor_despesas_financiadas) || 0 : 0),
            )}
          </div>
        </Campo>

        <Campo label={<>Prazo (meses) <Ast /></>}>
          <Input
            type="number"
            min={60}
            max={maxPrazoIdade ?? 420}
            step={12}
            value={f.prazo || ""}
            onChange={(e) => set("prazo", Number(e.target.value))}
            onBlur={(e) => definirPrazo(Number(e.target.value))}
            onWheel={(e) => (e.target as HTMLInputElement).blur()}
            aria-invalid={!!erros.prazo}
          />
          {maxPrazoIdade != null && (
            <p className="mt-1 text-xs text-muted-foreground">
              Máximo para a idade: {maxPrazoIdade} meses ({formatarMeses(maxPrazoIdade)})
            </p>
          )}
          <Erro erros={erros} campo="prazo" />
        </Campo>
        <Campo label={<>Utiliza FGTS? <Ast /></>}>
          <Select value={f.utiliza_fgts} onValueChange={(v) => set("utiliza_fgts", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="S">Sim</SelectItem>
              <SelectItem value="N">Não</SelectItem>
            </SelectContent>
          </Select>
        </Campo>
        <Campo label={<>Sistema de amortização <Ast /></>}>
          <Select value={f.sistema_amortizacao} onValueChange={setSistemaAmortizacao}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="S">SAC</SelectItem>
              <SelectItem value="P">PRICE</SelectItem>
            </SelectContent>
          </Select>
        </Campo>
        <Campo label="Financiar despesas?">
          <label className="flex items-center gap-2 py-2 text-sm text-foreground">
            <Checkbox
              checked={!!f.fg_financiar_despesas}
              onCheckedChange={(v) => alternarFinanciarDespesas(v === true)}
            />
            Incluir as despesas no valor financiado
          </label>
        </Campo>
        {f.fg_financiar_despesas && (
          <Campo label="Despesas a financiar (% do valor do imóvel)">
            <div className="relative">
              <Input
                inputMode="decimal"
                className="pr-8 tabular-nums"
                placeholder="1 a 5"
                value={pctDespesas ? String(pctDespesas).replace(".", ",") : ""}
                onChange={(e) => definirPctDespesas(e.target.value)}
                onBlur={normalizarPctDespesas}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
            <p className="mt-2 mb-1 text-xs text-muted-foreground">
              Mínimo 1% e máximo 5% do valor do imóvel. Ajuste o valor abaixo se necessário.
            </p>
            <CurrencyInput
              value={f.valor_despesas_financiadas ?? 0}
              onChange={(v) => set("valor_despesas_financiadas", v)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Total financiado:{" "}
              {formatBRL((f.valor_financiamento || 0) + (f.valor_despesas_financiadas || 0))}
            </p>
          </Campo>
        )}
      </div>
    </section>
  );
}
