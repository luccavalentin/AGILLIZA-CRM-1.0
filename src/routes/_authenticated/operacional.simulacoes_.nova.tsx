import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";

import { Button } from "@/components/ui/button";
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
import { ToneBadge } from "@/components/crm/tone-badge";
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

  const valido =
    w.valor_imovel > 0 &&
    w.valor_financiamento > 0 &&
    w.data_nascimento !== "" &&
    w.prazo_meses >= PRAZO_MIN &&
    w.prazo_meses <= PRAZO_MAX;

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

  const maxPrazoIdade = useMemo(
    () => prazoMaximoPorIdade(w.data_nascimento),
    [w.data_nascimento],
  );

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
    <div className="mx-auto w-full max-w-3xl p-6 md:p-10">
      {/* Wizard */}
      <div className="flex flex-col gap-5">
        <h1 className="text-lg font-semibold text-foreground">Simular financiamento</h1>

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
            className="flex flex-col gap-2 sm:flex-row sm:gap-6"
            value={
              w.possui_imovel_escolhido == null ? "" : w.possui_imovel_escolhido ? "sim" : "nao"
            }
            onValueChange={(v) => set("possui_imovel_escolhido", v === "sim")}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="sim" id="pie-sim" />
              <Label htmlFor="pie-sim" className="font-normal">
                Sim, já tenho um imóvel escolhido
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="nao" id="pie-nao" />
              <Label htmlFor="pie-nao" className="font-normal">
                Não, ainda estou pesquisando
              </Label>
            </div>
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

        <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
          <Button
            variant="default"
            className="h-12"
            disabled={!valido}
            onClick={() => setMostrarRapida(true)}
          >
            Simulação rápida
          </Button>
          <Button
            variant="secondary"
            className="h-12"
            disabled={!valido}
            onClick={() => irParaCompleta()}
          >
            Simulação completa
          </Button>
        </div>

        {mostrarRapida && (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Comparativo estimado</h3>
              <span className="text-xs text-muted-foreground">
                Sistema SAC · {w.prazo_meses} meses
              </span>
            </div>
            {comparativo.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum banco habilitado. Ative bancos em Configurações → Bancos.
              </p>
            )}
            <div className="space-y-2">
              {comparativo.map((c, i) => (
                <div
                  key={c.banco_id}
                  className="flex items-center justify-between rounded-md border border-border bg-card p-3"
                >
                  <div>
                    <p className="font-medium text-card-foreground">{c.nome_banco}</p>
                    <p className="text-xs text-muted-foreground">
                      Taxa {formatPercent(c.taxa_ano)} a.a.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums font-semibold text-card-foreground">
                      {formatBRL(c.resultado.primeira_parcela)}
                    </p>
                    {i === 0 && <ToneBadge tone="success">Melhor taxa</ToneBadge>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
