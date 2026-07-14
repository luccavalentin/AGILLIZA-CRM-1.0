import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calculator, TrendingUp, FileText, Award, Download } from "lucide-react";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { assertModuloPermitido } from "@/lib/route-guards";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { formatBRL, formatPercent } from "@/lib/simulacao/format";
import { listarBancosAtivos, taxasReferenciaBancos } from "@/lib/simulacao/simulacoes.functions";
import { compararBancosRapido, taxaAnoDeBanco } from "@/lib/simulacao/simulacao-rapida";
import { toast } from "sonner";
import {
  ajustarPrazoPorIdade,
  prazoMaximoPorIdade,
  formatarMeses,
} from "@/lib/simulacao/prazo";


export const Route = createFileRoute("/_authenticated/operacional/simulacoes_/nova")({
  head: () => ({ meta: [{ title: "Nova simulação — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.simulacoes"),
  validateSearch: (search: Record<string, unknown>): { modo?: "rapida" } => ({
    modo: search.modo === "rapida" ? "rapida" : undefined,
  }),
  component: Pagina,
});

const PRAZO_MIN = 60;
const PRAZO_MAX = 420;

interface WizardState {
  produto: "financiamento_imobiliario" | "home_equity";
  valor_imovel: number;
  valor_entrada: number;
  valor_financiamento: number;
  possui_imovel_escolhido: boolean | null;
  data_nascimento: string;
  prazo_meses: number;
  renda_familiar: number;
}

function Pagina() {
  const router = useRouter();

  const [w, setW] = useState<WizardState>({
    produto: "financiamento_imobiliario",
    valor_imovel: 0,
    valor_entrada: 0,
    valor_financiamento: 0,
    possui_imovel_escolhido: null,
    data_nascimento: "",
    prazo_meses: 360,
    renda_familiar: 0,
  });
  const [mostrarRapida, setMostrarRapida] = useState(false);
  // Rastreia os dois últimos campos editados entre imóvel/entrada/financiamento.
  // O terceiro campo é o que será recalculado automaticamente.
  type CampoValor = "valor_imovel" | "valor_entrada" | "valor_financiamento";
  const [ultimosEditados, setUltimosEditados] = useState<CampoValor[]>([]);
  const entradaTocada = ultimosEditados.includes("valor_entrada");
  const resultadoRef = useRef<HTMLDivElement>(null);
  const jaBaixou = useRef(false);


  const { data: bancos } = useQuery({
    queryKey: ["bancos-ativos"],
    queryFn: () => listarBancosAtivos(),
  });

  // Entrada sugerida padrão de 20% do valor do imóvel.
  const entradaSugerida = Math.round((w.valor_imovel || 0) * 0.2);

  // Percentual padrão de entrada (mercado SFH): 20% do imóvel.
  const PCT_ENTRADA_PADRAO = 0.2;

  /**
   * Recalcula o campo alvo aplicando a invariante `imóvel = entrada + financiamento`.
   * Quando não há dois campos ancorados, usa a regra padrão de 20% de entrada.
   */
  function recomputarTerceiro(
    valores: { valor_imovel: number; valor_entrada: number; valor_financiamento: number },
    editado: CampoValor,
    outroAncora: CampoValor | undefined,
  ): { valor_imovel: number; valor_entrada: number; valor_financiamento: number } {
    const { valor_imovel, valor_entrada, valor_financiamento } = valores;
    const alvo = (["valor_imovel", "valor_entrada", "valor_financiamento"] as CampoValor[]).find(
      (c) => c !== editado && c !== outroAncora,
    )!;

    // Sem segunda âncora → aplica a regra padrão de 20%.
    if (!outroAncora) {
      if (editado === "valor_imovel") {
        return {
          valor_imovel,
          valor_entrada: Math.round(valor_imovel * PCT_ENTRADA_PADRAO),
          valor_financiamento: Math.round(valor_imovel * (1 - PCT_ENTRADA_PADRAO)),
        };
      }
      if (editado === "valor_entrada") {
        const imovel = Math.round(valor_entrada / PCT_ENTRADA_PADRAO);
        return { valor_imovel: imovel, valor_entrada, valor_financiamento: Math.max(0, imovel - valor_entrada) };
      }
      const imovel = Math.round(valor_financiamento / (1 - PCT_ENTRADA_PADRAO));
      return { valor_imovel: imovel, valor_entrada: Math.max(0, imovel - valor_financiamento), valor_financiamento };
    }

    // Duas âncoras → deriva o terceiro pela invariante.
    if (alvo === "valor_financiamento") {
      return { valor_imovel, valor_entrada, valor_financiamento: Math.max(0, valor_imovel - valor_entrada) };
    }
    if (alvo === "valor_entrada") {
      return { valor_imovel, valor_entrada: Math.max(0, valor_imovel - valor_financiamento), valor_financiamento };
    }
    // alvo === "valor_imovel"
    return { valor_imovel: Math.max(0, valor_entrada + valor_financiamento), valor_entrada, valor_financiamento };
  }

  function set<K extends keyof WizardState>(k: K, v: WizardState[K]) {
    setW((prev) => {
      const next = { ...prev, [k]: v };
      if (k === "valor_imovel" || k === "valor_entrada" || k === "valor_financiamento") {
        const campo = k as CampoValor;
        // Só conta como âncora se o outro campo tem valor real (> 0).
        // Um campo tocado e zerado não deve travar o cálculo pela invariante.
        const outroAncora = ultimosEditados
          .filter((c) => c !== campo && (next[c] as number) > 0)[0];
        const recalc = recomputarTerceiro(
          {
            valor_imovel: next.valor_imovel,
            valor_entrada: next.valor_entrada,
            valor_financiamento: next.valor_financiamento,
          },
          campo,
          outroAncora,
        );
        next.valor_imovel = recalc.valor_imovel;
        next.valor_entrada = recalc.valor_entrada;
        next.valor_financiamento = recalc.valor_financiamento;
        // Atualiza histórico: o campo editado vira o mais recente; mantém apenas 2.
        // Se o valor foi zerado, remove do histórico.
        setUltimosEditados((old) => {
          const semAtual = old.filter((c) => c !== campo);
          if ((v as number) > 0) return [campo, ...semAtual].slice(0, 2);
          return semAtual;
        });
      }
      return next;
    });
  }

  function aplicarEntradaSugerida() {
    setW((prev) => {
      const entrada = Math.round((prev.valor_imovel || 0) * PCT_ENTRADA_PADRAO);
      return {
        ...prev,
        valor_entrada: entrada,
        valor_financiamento: Math.max(0, prev.valor_imovel - entrada),
      };
    });
    setUltimosEditados(["valor_entrada", "valor_imovel"]);
  }

  const maxPrazoIdade = useMemo(
    () => prazoMaximoPorIdade(w.data_nascimento),
    [w.data_nascimento],
  );

  const valido =
    w.valor_imovel > 0 &&
    w.valor_financiamento > 0 &&
    w.data_nascimento !== "" &&
    w.prazo_meses >= PRAZO_MIN &&
    w.prazo_meses <= (maxPrazoIdade ?? PRAZO_MAX);

  const comparativo = useMemo(() => {
    if (!bancos || !mostrarRapida) return [];
    return compararBancosRapido(
      bancos.map((b) => ({
        banco_id: b.id,
        codigo_banco: b.codigo_banco,
        nome_banco: b.nome_banco,
        taxa_ano: taxaAnoDeBanco(b.codigo_banco),
      })),
      { valor_financiamento: w.valor_financiamento, prazo_meses: w.prazo_meses, sistema: "S" },
    );
  }, [bancos, mostrarRapida, w.valor_financiamento, w.prazo_meses]);

  // Taxa mais conservadora entre os bancos ativos, usada para estimar a maior renda mínima.
  const melhorTaxaAno = useMemo(() => {
    if (!bancos || bancos.length === 0) return 0.1199;
    return Math.max(...bancos.map((b) => taxaAnoDeBanco(b.codigo_banco)));
  }, [bancos]);

  /** Aplica o prazo digitado, ajustando automaticamente pela regra de idade. */
  function definirPrazo(valor: number) {
    if (!Number.isFinite(valor) || valor <= 0) {
      set("prazo_meses", 0);
      return;
    }
    const { prazo, ajustado, mensagem } = ajustarPrazoPorIdade(valor, w.data_nascimento);
    if (ajustado && mensagem) toast.warning(mensagem);
    set("prazo_meses", prazo);
  }

  // Reajusta o prazo se a data de nascimento reduzir o máximo permitido.
  useEffect(() => {
    if (maxPrazoIdade != null && w.prazo_meses > maxPrazoIdade) {
      const { mensagem } = ajustarPrazoPorIdade(w.prazo_meses, w.data_nascimento);
      if (mensagem) toast.warning(mensagem);
      set("prazo_meses", maxPrazoIdade);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxPrazoIdade]);


  function irParaCompleta() {
    sessionStorage.setItem("simulacao_wizard", JSON.stringify({ ...w, prazo: w.prazo_meses }));
    router.navigate({ to: "/operacional/simulacoes/completa" });
  }

  const [baixando, setBaixando] = useState(false);

  async function baixarSimulacao() {
    if (comparativo.length === 0) return;
    setBaixando(true);
    try {
      const { baixarSimulacaoDetalhadaPDF } = await import("@/lib/simulacao/simulacao-pdf");
      baixarSimulacaoDetalhadaPDF({
        simulacao: {
          numero_simulacao: null,
          nome_cliente: null,
          produto: w.produto,
          valor_imovel: w.valor_imovel,
          valor_financiamento: w.valor_financiamento,
          valor_entrada: w.valor_entrada,
          prazo: w.prazo_meses,
          sistema_amortizacao: "S",
          created_at: new Date().toISOString(),
        },
        bancos: comparativo.map((c) => ({
          nome_banco: c.nome_banco,
          status_banco: "simulada",
          valor_parcela: c.resultado.primeira_parcela,
          taxa_juros_ano: c.taxa_ano * 100,
          prazo_pagamento_max: w.prazo_meses,
          valor_financiamento_max: w.valor_financiamento,
        })),
      });
    } catch {
      toast.error("Não foi possível gerar o PDF da simulação.");
    } finally {
      setBaixando(false);
    }
  }

  /** Dispara a simulação rápida: exibe, rola até o resultado e baixa o PDF automaticamente. */
  function simularRapida() {
    jaBaixou.current = false;
    setMostrarRapida(true);
  }

  // Ao gerar o comparativo, rola até o resultado e baixa a simulação automaticamente.
  useEffect(() => {
    if (!mostrarRapida || comparativo.length === 0 || jaBaixou.current) return;
    jaBaixou.current = true;
    const t = setTimeout(() => {
      resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      void baixarSimulacao();
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarRapida, comparativo.length]);


  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-6 lg:p-8">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 mb-4 w-fit text-muted-foreground"
        onClick={() =>
          router.history.canGoBack()
            ? router.history.back()
            : router.navigate({ to: "/operacional/simulacoes" })
        }
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      <div
        className={cn(
          "grid gap-4 lg:gap-6",
          mostrarRapida
            ? "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start"
            : "mx-auto max-w-3xl",
        )}
      >
        <div className="flex min-w-0 flex-col gap-4">
        <Card className="overflow-hidden">
          {/* Cabeçalho integrado ao cartão */}
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


        <div className="space-y-2 md:col-span-2">
          <Label>Você já possui o imóvel escolhido?</Label>
          <RadioGroup
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            value={
              w.possui_imovel_escolhido == null ? "" : w.possui_imovel_escolhido ? "sim" : "nao"
            }
            onValueChange={(v) => set("possui_imovel_escolhido", v === "sim")}
          >
            <label
              htmlFor="pie-sim"
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm transition-colors",
                w.possui_imovel_escolhido === true
                  ? "border-primary/50 bg-primary/5"
                  : "border-border hover:bg-muted/40",
              )}
            >
              <RadioGroupItem value="sim" id="pie-sim" />
              <span className="font-normal">Sim, já tenho um imóvel escolhido</span>
            </label>
            <label
              htmlFor="pie-nao"
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm transition-colors",
                w.possui_imovel_escolhido === false
                  ? "border-primary/50 bg-primary/5"
                  : "border-border hover:bg-muted/40",
              )}
            >
              <RadioGroupItem value="nao" id="pie-nao" />
              <span className="font-normal">Não, ainda estou pesquisando</span>
            </label>
          </RadioGroup>
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
              {maxPrazoIdade != null &&
                ` · limite para a idade: ${formatarMeses(maxPrazoIdade)}`}
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




        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
          <Button
            variant="default"
            className="h-12 gap-2 text-sm font-semibold"
            disabled={!valido}
            onClick={simularRapida}
          >
            Simulação rápida
          </Button>
          <Button
            variant="secondary"
            className="h-12 gap-2 text-sm font-semibold"
            disabled={!valido}
            onClick={() => irParaCompleta()}
          >
            <FileText className="h-4 w-4" /> Simulação completa
          </Button>
        </div>
        </div>

        {mostrarRapida && (
          <div className="min-w-0 lg:sticky lg:top-4">
          <Card ref={resultadoRef} className="scroll-mt-4 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Comparativo estimado</h3>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  SAC · {w.prazo_meses} meses
                </span>
              </div>
              {comparativo.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={baixarSimulacao}
                  disabled={baixando}
                >
                  <Download className="h-3.5 w-3.5" />
                  {baixando ? "Gerando…" : "Baixar simulação"}
                </Button>
              )}
            </div>
            <div className="p-5">
              {comparativo.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nenhum banco habilitado. Ative bancos em Configurações → Bancos.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {comparativo.map((c, i) => {
                    const melhor = i === 0 && comparativo.length > 1;
                    return (
                      <div
                        key={c.banco_id}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors",
                          melhor
                            ? "border-primary/30 bg-primary/5"
                            : "border-border bg-card hover:bg-muted/30",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="relative shrink-0">
                            <BancoLogo nome={c.nome_banco} size="xl" />
                            <span
                              className={cn(
                                "absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ring-2 ring-card",
                                melhor
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {i + 1}
                            </span>
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold leading-tight text-card-foreground break-words">
                                {c.nome_banco}
                              </p>
                              {melhor && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                  <Award className="h-3 w-3" /> Melhor taxa
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Taxa {formatPercent(c.taxa_ano)} a.a.
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
                            1ª parcela
                          </p>
                          <p className="tabular-nums text-base font-semibold text-card-foreground">
                            {formatBRL(c.resultado.primeira_parcela)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
          </div>
        )}
      </div>
    </div>

  );
}


