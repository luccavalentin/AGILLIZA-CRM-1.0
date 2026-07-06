import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Search, Loader2, Send, Copy, FileText, Calculator, Building2 } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarSimulacoesElegiveis,
  listarPropostas,
  listarBancosDaProposta,
  criarProposta,
  replicarProposta,
} from "@/lib/propostas/propostas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/simulacao/format";

export const Route = createFileRoute("/_authenticated/operacional/propostas_/enviar")({
  head: () => ({ meta: [{ title: "Nova Proposta — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.propostas"),
  component: Pagina,
});

type Modo = "simulacao" | "replicar" | "manual" | "nova_simulacao";

const OPCOES: { valor: Modo; icone: typeof Copy; titulo: string; descricao: string }[] = [
  {
    valor: "simulacao",
    icone: FileText,
    titulo: "Converter uma simulação existente",
    descricao:
      "Escolha o banco vencedor e clique em Enviar Proposta — o sistema aproveita tudo o que já foi digitado.",
  },
  {
    valor: "replicar",
    icone: Copy,
    titulo: "Replicar uma proposta existente",
    descricao:
      "Reaproveite os dados de uma proposta, escolha quais bancos manter e edite antes de enviar uma nova.",
  },
  {
    valor: "nova_simulacao",
    icone: Calculator,
    titulo: "Gerar uma nova simulação agora",
    descricao:
      "Faça uma simulação na hora com os bancos ativos e cadastre a proposta em seguida.",
  },
  {
    valor: "manual",
    icone: Building2,
    titulo: "Cadastrar proposta manualmente",
    descricao: "Não existe simulação? Preencha os dados manualmente ou reaproveite um cliente do CRM.",
  },
];

function Pagina() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("simulacao");
  const [enviando, setEnviando] = useState(false);

  // simulação
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState("");
  const [simSelecionada, setSimSelecionada] = useState<any | null>(null);
  const [bancoSel, setBancoSel] = useState<string | null>(null);

  // replicar
  const [qProp, setQProp] = useState("");
  const [buscaProp, setBuscaProp] = useState("");
  const [propSelecionada, setPropSelecionada] = useState<any | null>(null);
  const [bancosMarcados, setBancosMarcados] = useState<Set<string>>(new Set());

  const { data: simulacoes, isLoading } = useQuery({
    queryKey: ["simulacoes-elegiveis", busca],
    queryFn: () => listarSimulacoesElegiveis({ data: { q: busca || undefined } }),
    enabled: modo === "simulacao",
  });

  const { data: propostas, isLoading: carregandoProps } = useQuery({
    queryKey: ["propostas-replicar", buscaProp],
    queryFn: () =>
      listarPropostas({ data: { escopo: "todas", q: buscaProp || undefined, pagina: 1, porPagina: 20 } }),
    enabled: modo === "replicar",
  });

  const { data: detalheProp } = useQuery({
    queryKey: ["proposta-bancos-replicar", propSelecionada?.id],
    queryFn: () => listarBancosDaProposta({ data: { proposta_id: propSelecionada.id } }),
    enabled: modo === "replicar" && !!propSelecionada,
  });

  function toggleBanco(bancoId: string) {
    setBancosMarcados((prev) => {
      const next = new Set(prev);
      if (next.has(bancoId)) next.delete(bancoId);
      else next.add(bancoId);
      return next;
    });
  }

  async function criar() {
    setEnviando(true);
    try {
      let res;
      if (modo === "simulacao") {
        if (!simSelecionada) {
          toast.error("Selecione uma simulação.");
          return;
        }
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
          data: {
            simulacao_id: simSelecionada.id,
            banco_id: banco,
            cliente_id: simSelecionada.cliente_id ?? undefined,
          },
        });
      } else if (modo === "replicar") {
        if (!propSelecionada) {
          toast.error("Selecione a proposta a replicar.");
          return;
        }
        if (bancosMarcados.size === 0) {
          toast.error("Selecione pelo menos um banco.");
          return;
        }
        res = await replicarProposta({
          data: { proposta_id: propSelecionada.id, banco_ids: Array.from(bancosMarcados) },
        });
      } else {
        res = await criarProposta({ data: {} });
      }
      toast.success(`Proposta ${res.numero_proposta} criada.`);
      router.navigate({ to: "/operacional/propostas/$id", params: { id: res.proposta_id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar proposta.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold text-foreground">Nova Proposta</h1>

      {/* Modo de entrada */}
      <div className="rounded-lg border border-border bg-card p-6">
        <RadioGroup
          value={modo}
          onValueChange={(v) => setModo(v as Modo)}
          className="grid gap-4 md:grid-cols-2"
        >
          {OPCOES.map((op) => {
            const Icone = op.icone;
            return (
              <label
                key={op.valor}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-lg border p-4",
                  modo === op.valor ? "border-primary bg-accent/40" : "border-border",
                )}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value={op.valor} id={`modo-${op.valor}`} />
                  <Icone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{op.titulo}</span>
                </div>
                <span className="pl-6 text-sm text-muted-foreground">{op.descricao}</span>
              </label>
            );
          })}
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
            <Button type="submit" variant="secondary">
              Buscar
            </Button>
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
                    <p className="font-medium text-foreground">
                      {s.numero_simulacao} · {s.nome_cliente ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBRL(s.valor_imovel)} · {s.simulacao_bancos.length} banco(s) simulado(s)
                      {s.proposta_existente_id && " · já convertida em proposta"}
                    </p>
                  </div>
                  {ativa && <Check className="h-5 w-5 text-primary" />}
                </button>
              );
            })}
          </div>

          {simSelecionada?.proposta_existente_id && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              Esta simulação já foi convertida em proposta. Clique em “Abrir proposta” para ir à
              ficha.
            </div>
          )}

          {simSelecionada && !simSelecionada.proposta_existente_id && (
            <div className="space-y-2 border-t border-border pt-4">
              <Label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Banco vencedor
              </Label>
              <RadioGroup
                value={bancoSel ?? undefined}
                onValueChange={setBancoSel}
                className="grid gap-2"
              >
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

      {modo === "replicar" && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <Label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Proposta de origem
          </Label>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setBuscaProp(qProp);
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Número, cliente ou CPF"
                value={qProp}
                onChange={(e) => setQProp(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary">
              Buscar
            </Button>
          </form>

          <div className="space-y-2">
            {carregandoProps && (
              <p className="text-sm text-muted-foreground">Carregando propostas…</p>
            )}
            {!carregandoProps && (propostas?.itens?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma proposta encontrada.</p>
            )}
            {propostas?.itens?.map((p: any) => {
              const ativa = propSelecionada?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPropSelecionada(p);
                    setBancosMarcados(new Set());
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md border p-3 text-left",
                    ativa ? "border-primary bg-accent/40" : "border-border hover:bg-muted/50",
                  )}
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {p.numero_proposta} · {p.nome_cliente ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBRL(p.valor_financiamento)} · {p.bancos?.length ?? 0} banco(s)
                    </p>
                  </div>
                  {ativa && <Check className="h-5 w-5 text-primary" />}
                </button>
              );
            })}
          </div>

          {propSelecionada && (
            <div className="space-y-2 border-t border-border pt-4">
              <Label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Bancos a replicar
              </Label>
              {(detalheProp?.bancos?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Esta proposta não possui bancos vinculados.
                </p>
              ) : (
                <div className="grid gap-2">
                  {detalheProp?.bancos?.map((b: any) => (
                    <label
                      key={b.id}
                      className={cn(
                        "flex cursor-pointer items-center justify-between rounded-md border p-3",
                        bancosMarcados.has(b.banco_id)
                          ? "border-primary bg-accent/40"
                          : "border-border",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={bancosMarcados.has(b.banco_id)}
                          onCheckedChange={() => toggleBanco(b.banco_id)}
                        />
                        <span className="font-medium text-foreground">{b.nome_banco}</span>
                      </div>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {b.valor_parcela ? `${formatBRL(b.valor_parcela)}/mês` : "—"}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                A nova proposta é criada como rascunho — você poderá editar todos os dados antes de
                enviar.
              </p>
            </div>
          )}
        </div>
      )}

      {modo === "nova_simulacao" && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Você será levado à simulação para calcular as parcelas com os bancos ativos. Ao concluir,
            volte aqui e escolha “Converter uma simulação existente”, ou converta direto na tela da
            simulação.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => router.navigate({ to: "/operacional/simulacoes/nova" })}
            >
              <Sparkles className="mr-2 h-4 w-4" /> Simulação rápida
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.navigate({ to: "/operacional/simulacoes/completa" })}
            >
              Simulação completa
            </Button>
          </div>
        </div>
      )}

      {modo === "manual" && (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            A proposta em branco será criada como rascunho. Complete os dados do cliente, imóvel e
            bancos na ficha da proposta, incluindo a opção “Puxar do CRM”.
          </p>
        </div>
      )}

      {modo !== "nova_simulacao" && (
        <div className="flex justify-end">
          <Button size="lg" onClick={criar} disabled={enviando}>
            {enviando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {modo === "simulacao" && simSelecionada?.proposta_existente_id
              ? "ABRIR PROPOSTA"
              : modo === "replicar"
                ? "REPLICAR PROPOSTA"
                : "CRIAR PROPOSTA"}
          </Button>
        </div>
      )}
    </div>
  );
}
