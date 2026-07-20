import { Input } from "@/components/ui/input";
import { Calculator } from "lucide-react";
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
import { Campo, Ast, Erro } from "@/components/simulacao/completa/campo";
import { cepValido, consultarCep, mascararCep } from "@/lib/cep";
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
    prazoMaximo,
    restricaoEspecial,
    aplicarEntradaSugerida,
    aplicarPorFinanciamento,
    aplicarPorEntrada,
    aplicarPorParcela,
    aplicarJogadaNumeros,
    definirPrazo,
    setSistemaAmortizacao,
    alternarFinanciarDespesas,
    definirPctDespesas,
    normalizarPctDespesas,
    pctDespesas,
    modoProposta,
  } = ctx;

  async function alterarCepImovel(valor: string) {
    const cep = mascararCep(valor);
    set("cep_imovel", cep);
    if (!cepValido(cep)) return;
    try {
      const endereco = await consultarCep(cep);
      if (endereco?.uf) set("uf", endereco.uf);
    } catch {
      // Mantém o CEP digitado; a UF pode ser preenchida manualmente.
    }
  }


  return (
    <section className="space-y-4">
      {restricaoEspecial.ativo && (
        <div className="rounded-lg border-l-4 border-amber-600 border-y border-r border-y-amber-600/50 border-r-amber-600/50 bg-amber-100 px-3 py-2 text-sm leading-relaxed text-amber-950 dark:bg-amber-950/60 dark:text-amber-50 dark:border-amber-400 dark:border-y-amber-400/60 dark:border-r-amber-400/60">
          <strong className="font-semibold">{restricaoEspecial.motivo}:</strong> financiamento máx.{" "}
          {Math.round(restricaoEspecial.ltvMax * 100)}% (entrada mín. de{" "}
          {Math.round((1 - restricaoEspecial.ltvMax) * 100)}%), prazo máx. de{" "}
          {restricaoEspecial.prazoMax} meses
          {restricaoEspecial.apenasBradesco ? ", operado apenas pelo Bradesco." : "."}
        </div>
      )}
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
        {f.produto === "home_equity" && (
          <div id="campo-cep-imovel">
            <Campo label={<>CEP do imóvel <Ast /></>}>
              <Input
                inputMode="numeric"
                autoComplete="postal-code"
                value={f.cep_imovel ?? ""}
                onChange={(e) => void alterarCepImovel(e.target.value)}
                placeholder="00000-000"
                aria-invalid={!!erros.cep_imovel}
              />
              <p className="text-xs text-muted-foreground">
                Necessário para cálculo da garantia e seguro em Home Equity.
              </p>
              <Erro erros={erros} campo="cep_imovel" />
            </Campo>
          </div>
        )}
      </div>

      <Separator className="border-border/60" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Valores da operação</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              set("valor_imovel", 0);
              set("valor_entrada", 0);
              set("valor_financiamento", 0);
              set("parcela_alvo", 0);
              set("fg_financiar_despesas", false);
              definirPctDespesas("0");
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive"
            title="Zera imóvel, entrada, financiamento e parcela desejada"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
            Limpar valores
          </button>
          <JogadaNumerosDialog
            valorImovelAtual={Number(f.valor_imovel) || 0}
            ltvMax={ltvMax}
            onAplicar={aplicarJogadaNumeros}
          />
        </div>
      </div>


      <div className="group relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] via-background to-background shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary via-primary/60 to-primary/20" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="flex flex-1 items-start gap-4">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md shadow-primary/20 ring-1 ring-primary/30">
              <Calculator className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold tracking-tight text-foreground">
                  Simular pelo valor da parcela
                </p>
                <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Cálculo reverso
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Informe a parcela desejada e o sistema ajusta automaticamente imóvel, entrada e financiamento.
              </p>
              <div className="flex items-start gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-2.5 py-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-3 w-3 shrink-0 text-amber-600 dark:text-amber-500">
                  <path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                </svg>
                <p className="text-[11px] leading-snug text-amber-700 dark:text-amber-400">
                  Valores estimados com taxa de referência — podem sofrer leve variação quando a simulação for enviada ao banco.
                </p>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-64">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Parcela desejada
            </label>
            <div className="relative">
              <CurrencyInput
                value={f.parcela_alvo}
                onChange={(v) => {
                  if (!f.simular_por_parcela) ctx.set("simular_por_parcela", true);
                  aplicarPorParcela(v);
                }}
                placeholder="Ex: 3.500,00"
                className="h-11 border-primary/30 bg-background pr-3 text-base font-semibold tracking-tight shadow-sm transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </div>
            <p className="mt-1.5 text-[10px] leading-tight text-muted-foreground">
              Digite para calcular o imóvel automaticamente
            </p>
          </div>
        </div>
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
            onChange={(v) => aplicarPorEntrada(v)}
            placeholder="Ex: 100.000,00"
          />
          {f.valor_imovel > 0 && (() => {
            const pctEntradaSugerida = Math.round((1 - ltvMax) * 100);
            const entradaSugerida = Math.round(f.valor_imovel * (1 - ltvMax));
            return (
              <p className="text-xs text-muted-foreground">
                Entrada sugerida ({pctEntradaSugerida}%):{" "}
                <span className="font-medium text-foreground">
                  {formatBRL(entradaSugerida)}
                </span>
                {f.valor_entrada !== entradaSugerida && (
                  <button
                    type="button"
                    onClick={aplicarEntradaSugerida}
                    className="ml-2 font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Aplicar
                  </button>
                )}
              </p>
            );
          })()}
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

        <Campo label="Valor a financiar (R$)">
          <CurrencyInput
            value={f.valor_financiamento}
            onChange={(v) => aplicarPorFinanciamento(v)}
            placeholder="Ex: 400.000,00"
          />
          <p className="text-xs text-muted-foreground">
            Ao digitar aqui, o imóvel e a entrada são preenchidos automaticamente
            considerando o teto do banco ({Math.round(ltvMax * 100)}%).
            {f.fg_financiar_despesas &&
              (f.valor_despesas_financiadas || 0) > 0 && (
                <>
                  {" "}Total com despesas:{" "}
                  <span className="font-medium text-foreground">
                    {formatBRL(
                      (f.valor_financiamento || 0) +
                        (Number(f.valor_despesas_financiadas) || 0),
                    )}
                  </span>
                </>
              )}
          </p>
        </Campo>

        <Campo label={<>Prazo (meses) <Ast /></>}>
          <Input
            type="number"
            min={60}
            max={prazoMaximo ?? 420}
            step={12}
            value={f.prazo || ""}
            onChange={(e) => set("prazo", Number(e.target.value))}
            onBlur={(e) => definirPrazo(Number(e.target.value))}
            onWheel={(e) => (e.target as HTMLInputElement).blur()}
            aria-invalid={!!erros.prazo}
          />
          {restricaoEspecial.ativo && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {restricaoEspecial.motivo}: máx. {restricaoEspecial.prazoMax} meses.
            </p>
          )}
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
              {!modoProposta && <SelectItem value="B">Ambos (SAC + PRICE)</SelectItem>}
            </SelectContent>
          </Select>
          {f.sistema_amortizacao === "B" && (
            <p className="mt-1 text-xs text-muted-foreground">
              Selecione bancos para SAC e PRICE separadamente. Uma simulação é gerada para cada
              sistema, cada uma com sua renda.
            </p>
          )}
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
