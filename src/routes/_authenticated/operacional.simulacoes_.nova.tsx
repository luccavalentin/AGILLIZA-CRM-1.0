import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SecaoCabecalho } from "@/components/simulacao/secao-cabecalho";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calculator, Home, CalendarDays, TrendingUp, Zap, FileText, Award } from "lucide-react";
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
import { listarBancosAtivos } from "@/lib/simulacao/simulacoes.functions";
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
  const [entradaTocada, setEntradaTocada] = useState(false);


  const { data: bancos } = useQuery({
    queryKey: ["bancos-ativos"],
    queryFn: () => listarBancosAtivos(),
  });

  // Entrada sugerida padrão de 20% do valor do imóvel.
  const entradaSugerida = Math.round((w.valor_imovel || 0) * 0.2);

  function set<K extends keyof WizardState>(k: K, v: WizardState[K]) {
    if (k === "valor_entrada") setEntradaTocada(true);
    setW((prev) => {
      const next = { ...prev, [k]: v };
      // Sugere 20% de entrada automaticamente enquanto o usuário não editar o campo manualmente.
      if (k === "valor_imovel" && !entradaTocada) {
        next.valor_entrada = Math.round((next.valor_imovel || 0) * 0.2);
      }
      if (k === "valor_imovel" || k === "valor_entrada") {
        next.valor_financiamento = Math.max(0, next.valor_imovel - next.valor_entrada);
      }
      if (k === "valor_financiamento") {
        next.valor_entrada = Math.max(0, next.valor_imovel - next.valor_financiamento);
        setEntradaTocada(true);
      }
      return next;
    });
  }

  function aplicarEntradaSugerida() {
    setEntradaTocada(true);
    setW((prev) => {
      const entrada = Math.round((prev.valor_imovel || 0) * 0.2);
      return {
        ...prev,
        valor_entrada: entrada,
        valor_financiamento: Math.max(0, prev.valor_imovel - entrada),
      };
    });
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

  // Melhor taxa (menor) entre os bancos ativos, usada para estimar a renda mínima.
  const melhorTaxaAno = useMemo(() => {
    if (!bancos || bancos.length === 0) return 0.1199;
    return Math.min(...bancos.map((b) => taxaAnoDeBanco(b.codigo_banco)));
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

  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-8">
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

      {/* Cabeçalho */}
      <div className="mb-5 flex items-center gap-4 rounded-xl border border-border/60 bg-gradient-to-br from-primary/5 via-card to-card p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
          <Calculator className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Simular financiamento
          </h1>
          <p className="text-sm text-muted-foreground">
            Informe os dados abaixo para estimar as condições entre os bancos parceiros.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Card className="overflow-hidden">
          <div className="space-y-5 p-5 md:p-6">
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

        <div className="space-y-1.5">
          <Label>
            Valor do crédito que precisa <span className="text-destructive">*</span>
          </Label>
          <CurrencyInput
            value={w.valor_financiamento}
            onChange={(v) => set("valor_financiamento", v)}
            placeholder="0,00"
          />
        </div>


        <div className="space-y-2">
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <div className="space-y-1.5">
          <Label>Renda familiar mensal (opcional)</Label>
          <CurrencyInput
            value={w.renda_familiar}
            onChange={(v) => set("renda_familiar", v)}
            placeholder="0,00"
          />
          <p className="text-xs text-muted-foreground">
            Informe para verificarmos se atende à renda mínima exigida.
          </p>
        </div>
          </div>
        </Card>


        {w.valor_financiamento > 0 && w.prazo_meses >= PRAZO_MIN && (
          <DicaRendaMinima
            valorFinanciamento={w.valor_financiamento}
            valorImovel={w.valor_imovel}
            prazoMeses={w.prazo_meses}
            taxaAno={melhorTaxaAno}
            sistema="S"
            rendaInformada={w.renda_familiar}
          />
        )}


        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
          <Button
            variant="default"
            className="h-12 gap-2 text-sm font-semibold"
            disabled={!valido}
            onClick={() => setMostrarRapida(true)}
          >
            <Zap className="h-4 w-4" /> Simulação rápida
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

        {mostrarRapida && (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Comparativo estimado</h3>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                SAC · {w.prazo_meses} meses
              </span>
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
                          "flex items-center justify-between rounded-lg border p-3.5 transition-colors",
                          melhor
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-border bg-card hover:bg-muted/30",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                              melhor
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {i + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-card-foreground">{c.nome_banco}</p>
                              {melhor && (
                                <Award className="h-3.5 w-3.5 text-emerald-500" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Taxa {formatPercent(c.taxa_ano)} a.a.
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
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
        )}
      </div>
    </div>

  );
}


