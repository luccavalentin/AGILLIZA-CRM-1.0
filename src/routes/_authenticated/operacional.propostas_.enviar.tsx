import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Search, Loader2, Send } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarSimulacoesElegiveis,
  criarProposta,
} from "@/lib/propostas/propostas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/simulacao/format";

export const Route = createFileRoute("/_authenticated/operacional/propostas_/enviar")({
  head: () => ({ meta: [{ title: "Nova Oportunidade — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.propostas"),
  component: Pagina,
});

type Modo = "simulacao" | "manual";

function Pagina() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("simulacao");
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState("");
  const [simSelecionada, setSimSelecionada] = useState<any | null>(null);
  const [bancoSel, setBancoSel] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const { data: simulacoes, isLoading } = useQuery({
    queryKey: ["simulacoes-elegiveis", busca],
    queryFn: () => listarSimulacoesElegiveis({ data: { q: busca || undefined } }),
    enabled: modo === "simulacao",
  });

  async function criar() {
    setEnviando(true);
    try {
      let res;
      if (modo === "simulacao") {
        if (!simSelecionada) {
          toast.error("Selecione uma simulação.");
          return;
        }
        // simulação já convertida: abre a proposta existente
        if (simSelecionada.proposta_existente_id) {
          router.navigate({
            to: "/operacional/propostas/$id",
            params: { id: simSelecionada.proposta_existente_id },
          });
          return;
        }
        const banco = bancoSel ?? simSelecionada.simulacao_bancos[0]?.banco_id;
        if (!banco) {
          toast.error("Selecione o banco vencedor.");
          return;
        }
        res = await criarProposta({
          data: { simulacao_id: simSelecionada.id, banco_id: banco, cliente_id: simSelecionada.cliente_id ?? undefined },
        });
      } else {
        res = await criarProposta({ data: {} });
      }
      toast.success(`Oportunidade ${res.numero_proposta} criada.`);
      router.navigate({ to: "/operacional/propostas/$id", params: { id: res.proposta_id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar oportunidade.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold text-foreground">Nova Oportunidade</h1>

      {/* Modo de entrada */}
      <div className="rounded-lg border border-border bg-card p-6">
        <RadioGroup value={modo} onValueChange={(v) => setModo(v as Modo)} className="grid gap-4 md:grid-cols-2">
          <label
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-lg border p-4",
              modo === "simulacao" ? "border-primary bg-accent/40" : "border-border",
            )}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="simulacao" id="modo-sim" />
              <span className="font-medium text-foreground">Converter uma simulação existente</span>
            </div>
            <span className="pl-6 text-sm text-muted-foreground">
              Escolha o banco vencedor e clique em Enviar Proposta — o sistema aproveita tudo o que já foi digitado.
            </span>
          </label>
          <label
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-lg border p-4",
              modo === "manual" ? "border-primary bg-accent/40" : "border-border",
            )}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="manual" id="modo-manual" />
              <span className="font-medium text-foreground">Cadastrar proposta manualmente</span>
            </div>
            <span className="pl-6 text-sm text-muted-foreground">
              Não existe simulação? Preencha os dados manualmente ou reaproveite um cliente do CRM.
            </span>
          </label>
        </RadioGroup>
      </div>

      {modo === "simulacao" && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <Label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Simulação de origem
          </Label>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setBusca(q);
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Número, cliente, CPF ou banco"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary">Buscar</Button>
          </form>

          <div className="space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">Carregando simulações…</p>}
            {!isLoading && (simulacoes?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma simulação com retorno positivo disponível.
              </p>
            )}
            {simulacoes?.map((s: any) => {
              const ativa = simSelecionada?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSimSelecionada(s);
                    setBancoSel(s.simulacao_bancos[0]?.banco_id ?? null);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md border p-3 text-left",
                    ativa ? "border-primary bg-accent/40" : "border-border hover:bg-muted/50",
                  )}
                >
                  <div>
                    <p className="font-medium text-foreground">{s.numero_simulacao} · {s.nome_cliente ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBRL(s.valor_imovel)} · {s.simulacao_bancos.length} banco(s) simulado(s)
                    </p>
                  </div>
                  {ativa && <Check className="h-5 w-5 text-primary" />}
                </button>
              );
            })}
          </div>

          {simSelecionada && (
            <div className="space-y-2 border-t border-border pt-4">
              <Label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Banco vencedor
              </Label>
              <RadioGroup value={bancoSel ?? undefined} onValueChange={setBancoSel} className="grid gap-2">
                {simSelecionada.simulacao_bancos.map((b: any) => (
                  <label
                    key={b.id}
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-md border p-3",
                      bancoSel === b.banco_id ? "border-primary bg-accent/40" : "border-border",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value={b.banco_id} id={`b-${b.id}`} />
                      <span className="font-medium text-foreground">{b.nome_banco}</span>
                    </div>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatBRL(b.valor_parcela)}/mês
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}
        </div>
      )}

      {modo === "manual" && (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            A proposta em branco será criada como rascunho. Complete os dados do cliente, imóvel e bancos
            na ficha da proposta, incluindo a opção “Puxar do CRM”.
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <Button size="lg" onClick={criar} disabled={enviando}>
          {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          ENVIAR PROPOSTA
        </Button>
      </div>
    </div>
  );
}
