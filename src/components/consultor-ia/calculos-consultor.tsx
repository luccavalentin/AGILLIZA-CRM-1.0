import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator, CircleAlert, Clock, Landmark, Percent, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ArtigoMarkdown } from "@/components/conhecimento/artigo-markdown";
import { obterParametrosConsultor } from "@/lib/consultor-ia/consultor-ia.functions";
import {
  brl,
  comprometimento,
  custosAquisicao,
  financiamentoMaximo,
  pct,
  simular,
  type SistemaAmortizacao,
} from "@/lib/consultor-ia/calculos";
import type { ResultadoFerramenta } from "@/lib/consultor-ia/ferramentas";

/** Cartões com as contas feitas pelo sistema para uma resposta (C18). */
export function CartoesCalculo({ calculos }: { calculos: ResultadoFerramenta[] }) {
  if (!calculos?.length) return null;
  return (
    <div className="grid gap-3">
      {calculos.map((c, i) => (
        <div
          key={i}
          className={
            c.tipo === "faltando"
              ? "rounded-2xl border border-warning/40 bg-warning/5 p-4"
              : "rounded-2xl border border-primary/15 bg-gradient-to-b from-primary/[0.04] to-transparent p-4 shadow-sm"
          }
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {c.tipo === "faltando" ? (
                <CircleAlert className="size-4 text-warning" />
              ) : (
                <Calculator className="size-4" />
              )}
            </span>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
              {c.titulo}
            </p>
            {c.tipo !== "faltando" && (
              <Badge variant="outline" className="ml-auto h-5 text-[10px]">
                Calculado pelo sistema
              </Badge>
            )}
          </div>
          {c.tipo === "simulacao" && (
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Kpi rotulo="1ª parcela" valor={brl(c.dados.primeira_parcela)} />
              <Kpi rotulo="Última" valor={brl(c.dados.ultima_parcela)} />
              <Kpi rotulo="Juros totais" valor={brl(c.dados.total_juros)} />
              <Kpi rotulo="Total pago" valor={brl(c.dados.total_pago)} />
            </div>
          )}
          <ArtigoMarkdown conteudo={c.markdown} variante="compacto" />
        </div>
      ))}
    </div>
  );
}

function Kpi({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {rotulo}
      </p>
      <p className="truncate text-sm font-semibold tabular-nums">{valor}</p>
    </div>
  );
}

const num = (s: string) => {
  const t = s.trim();
  if (!t) return NaN;
  return Number(
    /,\d{1,2}$/.test(t) || /\.\d{3}/.test(t)
      ? t.replace(/\./g, "").replace(",", ".")
      : t.replace(",", "."),
  );
};

/**
 * Calculadora sem IA, com os mesmos cálculos e parâmetros do Consultor: SAC/PRICE,
 * comprometimento e capacidade, custos (ITBI e cartório). "Perguntar ao Consultor" leva os
 * números para a conversa.
 */
export function CalculadoraConsultor({
  aberta,
  onAbertaChange,
  onPerguntar,
}: {
  aberta: boolean;
  onAbertaChange: (v: boolean) => void;
  onPerguntar: (texto: string) => void;
}) {
  const params = useQuery({
    queryKey: ["consultor-ia-parametros"],
    queryFn: () => obterParametrosConsultor(),
    enabled: aberta,
  });
  const [valor, setValor] = useState("400000");
  const [taxa, setTaxa] = useState("");
  const [anos, setAnos] = useState("30");
  const [sistema, setSistema] = useState<SistemaAmortizacao>("SAC");
  const [renda, setRenda] = useState("12000");
  const [imovel, setImovel] = useState("500000");
  const [municipio, setMunicipio] = useState("");

  const taxaEfetiva = taxa.trim() ? num(taxa) : (params.data?.taxa_referencia_anual ?? NaN);

  const sim = useMemo(() => {
    try {
      return simular(sistema, num(valor), taxaEfetiva, Math.round(num(anos) * 12));
    } catch (e) {
      return e instanceof Error ? e.message : "Dados inválidos.";
    }
  }, [valor, taxaEfetiva, anos, sistema]);

  const cap = useMemo(() => {
    if (!params.data) return null;
    try {
      return financiamentoMaximo(
        num(renda),
        taxaEfetiva,
        Math.round(num(anos) * 12),
        sistema,
        params.data.comprometimento_max_percentual,
      );
    } catch (e) {
      return e instanceof Error ? e.message : "Dados inválidos.";
    }
  }, [renda, taxaEfetiva, anos, sistema, params.data]);

  const custos = useMemo(() => {
    if (!params.data) return null;
    try {
      return custosAquisicao(num(imovel), params.data, municipio || null);
    } catch (e) {
      return e instanceof Error ? e.message : "Dados inválidos.";
    }
  }, [imovel, municipio, params.data]);

  return (
    <Sheet open={aberta} onOpenChange={onAbertaChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calculator className="size-5 text-primary" /> Calculadora do Consultor
          </SheetTitle>
          <SheetDescription>
            Contas exatas com os parâmetros da sua conta. Sem seguros (MIP/DFI) e tarifas, que
            variam por banco.
          </SheetDescription>
        </SheetHeader>
        {params.isLoading ? (
          <Skeleton className="mt-6 h-64 w-full" />
        ) : (
          <Tabs defaultValue="parcela" className="mt-5">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="parcela">
                <Landmark className="mr-1 size-3.5" /> Parcela
              </TabsTrigger>
              <TabsTrigger value="renda">
                <Percent className="mr-1 size-3.5" /> Renda
              </TabsTrigger>
              <TabsTrigger value="custos">
                <Receipt className="mr-1 size-3.5" /> Custos
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Campo
                rotulo="Taxa efetiva (% a.a.)"
                valor={taxa}
                onChange={setTaxa}
                dica={
                  params.data?.taxa_referencia_anual != null && !taxa
                    ? `Referência da conta: ${pct(params.data.taxa_referencia_anual)}`
                    : "Informe a taxa do banco"
                }
              />
              <Campo rotulo="Prazo (anos)" valor={anos} onChange={setAnos} />
              <div className="col-span-2 flex gap-2">
                {(["SAC", "PRICE"] as const).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={sistema === s ? "default" : "outline"}
                    onClick={() => setSistema(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            <TabsContent value="parcela" className="mt-4 space-y-3">
              <Campo rotulo="Valor a financiar (R$)" valor={valor} onChange={setValor} />
              {typeof sim === "string" ? (
                <p className="text-sm text-muted-foreground">{sim}</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Kpi rotulo="1ª parcela" valor={brl(sim.primeira_parcela)} />
                    <Kpi rotulo="Última" valor={brl(sim.ultima_parcela)} />
                    <Kpi rotulo="Juros totais" valor={brl(sim.total_juros)} />
                    <Kpi rotulo="Total pago" valor={brl(sim.total_pago)} />
                  </div>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" /> {sim.meses} meses · {pct(sim.taxa_mensal, 4)} ao
                    mês
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      onPerguntar(
                        `Analise esta simulação ${sim.sistema}: financiamento de ${brl(sim.valor_financiado)}, taxa de ${pct(sim.taxa_anual)} a.a., prazo de ${sim.meses} meses. Compare com o ${sim.sistema === "SAC" ? "PRICE" : "SAC"} e diga o que recomendar ao cliente.`,
                      )
                    }
                  >
                    Perguntar ao Consultor sobre esta simulação
                  </Button>
                </>
              )}
            </TabsContent>

            <TabsContent value="renda" className="mt-4 space-y-3">
              <Campo rotulo="Renda bruta familiar (R$)" valor={renda} onChange={setRenda} />
              {cap === null ? null : typeof cap === "string" ? (
                <p className="text-sm text-muted-foreground">{cap}</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Kpi
                    rotulo={`Parcela máx. (${pct(params.data!.comprometimento_max_percentual)})`}
                    valor={brl(cap.parcela_maxima)}
                  />
                  <Kpi rotulo="Financiamento máx." valor={brl(cap.valor_maximo)} />
                </div>
              )}
              {typeof sim !== "string" && num(renda) > 0 && (
                <p className="text-sm">
                  A 1ª parcela da simulação ({brl(sim.primeira_parcela)}) compromete{" "}
                  <strong>{pct(comprometimento(sim.primeira_parcela, num(renda)))}</strong> da
                  renda.
                </p>
              )}
            </TabsContent>

            <TabsContent value="custos" className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo="Valor do imóvel (R$)" valor={imovel} onChange={setImovel} />
                <Campo rotulo="Município (opcional)" valor={municipio} onChange={setMunicipio} />
              </div>
              {custos === null ? null : typeof custos === "string" ? (
                <p className="text-sm text-muted-foreground">{custos}</p>
              ) : (
                <ArtigoMarkdown
                  variante="compacto"
                  conteudo={`| Item | Valor |\n|:--|--:|\n| ITBI (${pct(custos.itbi_percentual)} — ${custos.itbi_origem}) | ${brl(custos.itbi)} |\n| Escritura e registro (${pct(custos.cartorio_percentual)}) | ${brl(custos.cartorio)} |\n| Avaliação do banco | ${brl(custos.avaliacao_banco)} |\n| Certidões | ${brl(custos.certidoes)} |\n| **Total** | **${brl(custos.total)}** |`}
                />
              )}
              <p className="text-xs text-muted-foreground">
                Alíquotas e valores vêm dos parâmetros da conta (Base de conhecimento › Parâmetros
                de cálculo).
              </p>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Campo({
  rotulo,
  valor,
  onChange,
  dica,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  dica?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{rotulo}</Label>
      <Input inputMode="decimal" value={valor} onChange={(e) => onChange(e.target.value)} />
      {dica && <p className="text-[11px] text-muted-foreground">{dica}</p>}
    </div>
  );
}
