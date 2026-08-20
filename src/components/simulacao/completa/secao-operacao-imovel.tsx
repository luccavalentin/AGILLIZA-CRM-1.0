import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calculator, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { limitesLtv } from "@/lib/simulacao/renda";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CurrencyInput } from "@/components/simulacao/currency-input";
import { JogadaNumerosDialog } from "@/components/simulacao/jogada-numeros-dialog";
import { Campo, Ast, Erro } from "@/components/simulacao/completa/campo";
import { cepValido, consultarCep, mascararCep } from "@/lib/cep";
import { formatBRL } from "@/lib/simulacao/format";
import { formatarMeses, PRAZO_MIN, ajustarPrazoPorIdade } from "@/lib/simulacao/prazo";
import { TIPOS_IMOVEL, USOS_IMOVEL, SITUACOES_IMOVEL, PRODUTOS } from "@/lib/simulacao/schemas";
import { UFS } from "@/lib/simulacao/format";
import { DicaRendaMinima } from "@/components/simulacao/dica-renda-minima";
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
    prazoMaximoEfetivo,
    motivoLimitador,
    limitadorPrazo,
    restricaoEspecial,
    prazoMinOperacional,
    mensagemPrazoInviavel,
    aplicarEntradaSugerida,
    aplicarPorFinanciamento,
    aplicarPorFinanciamentoTotal,
    financiamentoTotalExibido,
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
    isHomeEquity,
    confirmarAjustePrazo,
    avaliarPrazoComConfirmacao,
    aplicarAjustePrazo,
    cancelarAjustePrazo,
    melhorTaxaAno,
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
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm transition-colors hover:border-primary/30">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div className="flex-1 space-y-0.5">
            <p className="text-sm font-semibold leading-none text-foreground">
              Restrições para {restricaoEspecial.motivo}
            </p>
            <p className="text-[13px] text-muted-foreground leading-snug">
              Financiamento máx.{" "}
              <span className="font-semibold text-foreground">
                {Math.round(restricaoEspecial.ltvMax * 100)}%
              </span>{" "}
              (entrada mín. de {Math.round((1 - restricaoEspecial.ltvMax) * 100)}%), prazo máx. de{" "}
              <span className="font-semibold text-foreground">
                {restricaoEspecial.prazoMax} meses
              </span>
              {restricaoEspecial.apenasBradesco ? ", operado apenas pelo Bradesco" : ""}.
            </p>
          </div>
        </div>
      )}
      {f.produto === "home_equity" && (
        <div className="rounded-lg border border-destructive/40 border-l-4 border-l-destructive bg-[color-mix(in_oklab,var(--destructive)_12%,var(--card))] px-3 py-2 text-sm leading-relaxed text-foreground">
          <strong className="font-semibold text-destructive">
            Home Equity temporariamente indisponível:
          </strong>{" "}
          a API HomeFin ainda não processa simulações e propostas deste produto. Você pode registrar
          a simulação, mas o envio aos bancos não estará disponível.
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Campo
          label={
            <>
              Produto <Ast />
            </>
          }
        >
          <Select
            value={f.produto}
            onValueChange={(v) => {
              set("produto", v);
              if (v === "home_equity") {
                toast.warning("Home Equity está temporariamente indisponível na API HomeFin.", {
                  description: "O envio aos bancos para este produto ainda não é suportado.",
                });
              }
            }}
          >
            <SelectTrigger aria-invalid={!!erros.produto}>
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
          <Erro erros={erros} campo="produto" />
        </Campo>

        <Campo
          label={
            <>
              Tipo de imóvel <Ast />
            </>
          }
        >
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
        <Campo
          label={
            <>
              Uso do imóvel <Ast />
            </>
          }
        >
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
        <Campo
          label={
            <>
              Situação do imóvel <Ast />
            </>
          }
        >
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
        <Campo
          label={
            <>
              UF <Ast />
            </>
          }
        >
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
            <Campo
              label={
                <>
                  CEP do imóvel <Ast />
                </>
              }
            >
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
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
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
                Informe a parcela desejada e o sistema ajusta automaticamente imóvel, entrada e
                financiamento.
              </p>
              <div className="flex items-start gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-2.5 py-1.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 h-3 w-3 shrink-0 text-amber-600 dark:text-amber-500"
                >
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                </svg>
                <p className="text-[11px] leading-snug text-amber-700 dark:text-amber-400">
                  Valores estimados com taxa de referência — podem sofrer leve variação quando a
                  simulação for enviada ao banco.
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
        <Campo
          label={
            <>
              Valor do imóvel (R$) <Ast />
            </>
          }
        >
          <CurrencyInput
            value={f.valor_imovel}
            onChange={(v) => set("valor_imovel", v)}
            placeholder="Ex: 500.000,00"
          />
          <Erro erros={erros} campo="valor_imovel" />
        </Campo>
        <Campo
          label={
            <>
              Valor de entrada (R$) <Ast />
            </>
          }
        >
          <CurrencyInput
            value={f.valor_entrada}
            onChange={(v) => aplicarPorEntrada(v)}
            placeholder="Ex: 100.000,00"
          />
          {f.valor_imovel > 0 &&
            (() => {
              const pctEntradaSugerida = Math.round((1 - ltvMax) * 100);
              const { entradaMinima } = limitesLtv(f.valor_imovel, ltvMax);

              // Comparação em centavos para o botão sumir quando aplicado
              const atualCentavos = Math.round(f.valor_entrada * 100);
              const sugeridaCentavos = Math.round(entradaMinima * 100);

              return (
                <p className="text-xs text-muted-foreground">
                  Entrada sugerida ({pctEntradaSugerida}%):{" "}
                  <span className="font-medium text-foreground">{formatBRL(entradaMinima)}</span>
                  {atualCentavos !== sugeridaCentavos && (
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
                  Financiamento + despesas não pode passar de {Math.round(ltvMax * 100)}% do imóvel
                  ({formatBRL(financiamentoMaximo)}). Informe uma entrada de pelo menos{" "}
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
            value={financiamentoTotalExibido}
            onChange={(v) => aplicarPorFinanciamentoTotal(v)}
            placeholder="Ex: 400.000,00"
          />
          <p className="text-xs text-muted-foreground">
            Ao digitar aqui, o imóvel e a entrada são preenchidos automaticamente considerando o
            teto do banco ({Math.round(ltvMax * 100)}%).
            {f.fg_financiar_despesas && (f.valor_despesas_financiadas || 0) > 0 && (
              <>
                {" "}
                Já inclui as despesas financiadas de{" "}
                <span className="font-medium text-foreground">
                  {formatBRL(Number(f.valor_despesas_financiadas) || 0)}
                </span>{" "}
                (imóvel: {formatBRL(Number(f.valor_financiamento) || 0)}).
              </>
            )}
          </p>

        </Campo>

        {/* DicaRendaMinima removida desta seção para evitar confusão, pois a informação já existe no dado do cliente e o ajuste é feito automaticamente se necessário. */}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Prazo Principal */}
          <Campo
            label={
              <div className="flex items-center gap-2 text-foreground font-semibold">
                Prazo Principal (meses) <Ast />
              </div>
            }
          >
            <div className="flex flex-col gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={prazoMinOperacional > 0 ? prazoMinOperacional : 60}
                max={prazoMaximoEfetivo}
                step={1}
                value={f.prazo || ""}
                onChange={(e) => ctx.definirPrazo("prazo", e.target.value)}
                onBlur={() => ctx.handlePrazoBlur("prazo")}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                placeholder="Ex.: 360"
                className={cn(
                  "h-10 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                  Number(f.prazo) > prazoMaximoEfetivo &&
                    "border-destructive focus-visible:ring-destructive text-destructive"
                )}
                aria-invalid={!!erros.prazo}
              />

              {prazoMaximoEfetivo < 420 ? (
                <div className="flex items-start gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 animate-in fade-in slide-in-from-top-1">
                  <Info className="h-3.5 w-3.5 shrink-0 text-amber-600 mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[11px] font-bold text-amber-700 leading-tight">
                      Prazo máximo pela idade: {prazoMaximoEfetivo} meses
                    </p>
                    <p className="text-[10px] text-amber-600/90 leading-tight font-medium">
                      ({formatarMeses(prazoMaximoEfetivo)})
                    </p>
                    {motivoLimitador === "idade" && limitadorPrazo && (
                      <p className="text-[10px] text-amber-600/90 leading-tight">
                        Limitado por {limitadorPrazo.nome} ({limitadorPrazo.vinculo},{" "}
                        {limitadorPrazo.idadeAnos} anos)
                      </p>
                    )}
                    {motivoLimitador === "operacao" && (
                      <p className="text-[10px] text-amber-600/90 leading-tight">
                        Limitado para esta operação (Terreno/Comercial).
                      </p>
                    )}
                    {motivoLimitador === "produto" && (
                      <p className="text-[10px] text-amber-600/90 leading-tight">
                        Limitado para o produto Home Equity.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground/80">
                  Máximo da operação: 420 meses
                </p>
              )}
            </div>
            {prazoMinOperacional > 0 && (
              <p className="mt-1 text-xs text-muted-foreground font-medium">
                Este banco já exigiu no mínimo {prazoMinOperacional} meses nesta modalidade.
              </p>
            )}
            <Erro erros={erros} campo="prazo" />
          </Campo>

          {/* Segundo Prazo */}
          <Campo
            label={
              <div className="text-foreground font-semibold">
                Segundo Prazo (Comparativo)
              </div>
            }
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={prazoMinOperacional > 0 ? prazoMinOperacional : 60}
                  max={prazoMaximoEfetivo}
                  step={1}
                  value={f.prazo_2 || ""}
                  onChange={(e) => ctx.definirPrazo("prazo_2", e.target.value)}
                  onBlur={() => ctx.handlePrazoBlur("prazo_2")}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  placeholder="Opcional"
                  className={cn(
                    "h-10 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                    Number(f.prazo_2) > prazoMaximoEfetivo &&
                      "border-destructive focus-visible:ring-destructive text-destructive"
                  )}
                  aria-invalid={!!erros.prazo_2}
                />
                {f.prazo_2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => set("prazo_2", null)}
                    className="h-10 px-3 text-muted-foreground hover:text-destructive"
                  >
                    Limpar
                  </Button>
                )}
              </div>

              {f.prazo_2 && Number(f.prazo_2) > prazoMaximoEfetivo ? (
                <p className="text-[10px] font-bold text-destructive">
                  Ajustado para o máximo de {prazoMaximoEfetivo} meses.
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Gera uma segunda simulação com prazo diferente para comparação.
                </p>
              )}
            </div>
            <Erro erros={erros} campo="prazo_2" />
          </Campo>
        </div>


        <Campo
          label={
            <>
              Utiliza FGTS? <Ast />
            </>
          }
        >
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
        <Campo
          label={
            <>
              Sistema de amortização <Ast />
            </>
          }
        >
          <Select value={f.sistema_amortizacao} onValueChange={setSistemaAmortizacao}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="S">SAC</SelectItem>
              <SelectItem value="P">PRICE</SelectItem>
              {!modoProposta && <SelectItem value="B">OverPrice (SAC + PRICE)</SelectItem>}
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
              onCheckedChange={() => alternarFinanciarDespesas()}
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
              Total a financiar (já exibido no campo acima):{" "}
              {formatBRL((f.valor_financiamento || 0) + (f.valor_despesas_financiadas || 0))}
            </p>
          </Campo>
        )}
      </div>

      <AlertDialog open={!!confirmarAjustePrazo} onOpenChange={(open) => !open && cancelarAjustePrazo()}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              {confirmarAjustePrazo?.titulo || "Ajuste de prazo"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
              {confirmarAjustePrazo?.descricao}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 sm:flex-col-reverse gap-2">
            <AlertDialogCancel className="w-full sm:mt-0" onClick={cancelarAjustePrazo}>
              Corrigir manualmente
            </AlertDialogCancel>
            <AlertDialogAction
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              onClick={aplicarAjustePrazo}
            >
              {confirmarAjustePrazo?.acaoAutomatico ? "Ajustar automaticamente" : "Entendido"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
