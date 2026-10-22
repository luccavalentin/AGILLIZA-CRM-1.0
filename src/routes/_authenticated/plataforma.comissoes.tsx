import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgeCheck, CircleDollarSign, HandCoins, Percent, Search, Trash2, X } from "lucide-react";
import { AdminHero } from "@/components/admin/admin-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  atualizarComissaoAssinante,
  contasParaComissao,
  definirComissaoAssinante,
  listarComissoesAssinantes,
  type ComissaoAssinante,
  type StatusComissaoAssinante,
} from "@/lib/plataforma/comissoes-assinantes.functions";

export const Route = createFileRoute("/_authenticated/plataforma/comissoes")({
  head: () => ({ meta: [{ title: "Comissões dos assinantes — Plataforma — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.comissoes"),
  component: Pagina,
});

const STATUS: Record<StatusComissaoAssinante, { rotulo: string; classe: string }> = {
  a_pagar: { rotulo: "A pagar", classe: "border-warning/40 bg-warning/15 text-warning-foreground" },
  paga: { rotulo: "Paga", classe: "border-success/20 bg-success/10 text-success-texto" },
  cancelada: { rotulo: "Cancelada", classe: "" },
};

const TIPO: Record<string, string> = { corretor: "Corretor", imobiliaria: "Imobiliária", parceiro: "Parceiro" };

const pct = (n: number) => `${Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`;

/**
 * Comissão dos assinantes: quem envia proposta ao correspondente recebe um percentual do
 * valor financiado, liberado só quando o contrato é registrado em cartório.
 */
function Pagina() {
  const listarFn = useServerFn(listarComissoesAssinantes);
  const podeEditar = usePermissao("saas.comissoes", "edit");
  const [status, setStatus] = useState<StatusComissaoAssinante | "todas">("a_pagar");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [busca, setBusca] = useState("");
  const [cancelando, setCancelando] = useState<ComissaoAssinante | null>(null);

  const q = useQuery({
    queryKey: ["plataforma-comissoes", status, de, ate, busca],
    queryFn: () =>
      listarFn({
        data: { status: status === "todas" ? null : status, de: de || null, ate: ate || null, busca: busca || null },
      }),
    placeholderData: (a) => a,
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        secao="Plataforma"
        icon={<HandCoins className="h-5 w-5" />}
        titulo="Comissões dos assinantes"
        descricao="O corretor ou a imobiliária que envia a proposta recebe um percentual do valor financiado, liberado quando o contrato é registrado em cartório."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Indicador rotulo="A pagar" valor={formatBRL(Number(q.data?.totais.a_pagar ?? 0))} icone={<CircleDollarSign className="size-4" />} />
        <Indicador rotulo="Pagas" valor={formatBRL(Number(q.data?.totais.pagas ?? 0))} icone={<BadgeCheck className="size-4" />} />
        <Indicador
          rotulo="Percentual padrão"
          valor={q.data ? pct(q.data.config.padrao) : "—"}
          icone={<Percent className="size-4" />}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {podeEditar && q.data && <Configuracao padrao={q.data.config.padrao} porConta={q.data.config.por_conta} />}

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 lg:flex-row lg:items-end">
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1 lg:w-auto" role="tablist" aria-label="Situação">
          {(["a_pagar", "paga", "cancelada", "todas"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={status === s}
              onClick={() => setStatus(s)}
              className={
                "min-h-9 rounded-md px-2 text-xs font-medium sm:text-sm " +
                (status === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")
              }
            >
              {s === "todas" ? "Todas" : STATUS[s].rotulo}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 lg:w-80">
          <div className="space-y-1">
            <Label htmlFor="cm-de" className="text-xs">
              Registradas de
            </Label>
            <Input id="cm-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cm-ate" className="text-xs">
              até
            </Label>
            <Input id="cm-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar conta ou proposta"
            className="pl-9"
            placeholder="Buscar conta ou proposta"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {q.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : q.isError ? (
        <p className="rounded-lg border bg-card p-4 text-sm text-destructive">
          {mensagemDeErro(q.error, "Não foi possível carregar as comissões.")}
        </p>
      ) : (q.data?.itens.length ?? 0) === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhuma comissão com estes filtros. A comissão nasce no dia em que o contrato é registrado em cartório.
        </div>
      ) : (
        <ul className="space-y-2">
          {q.data!.itens.map((c) => (
            <LinhaComissao key={c.id} c={c} podeEditar={podeEditar} onCancelar={() => setCancelando(c)} />
          ))}
        </ul>
      )}

      {cancelando && <CancelarComissao comissao={cancelando} aoFechar={() => setCancelando(null)} />}
    </div>
  );
}

function Indicador({
  rotulo,
  valor,
  icone,
  className = "",
}: {
  rotulo: string;
  valor: string;
  icone: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border bg-card p-4 ${className}`}>
      <div className="flex items-center justify-between text-muted-foreground">
        <p className="truncate text-xs uppercase tracking-wide">{rotulo}</p>
        {icone}
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{valor}</p>
    </div>
  );
}

function LinhaComissao({
  c,
  podeEditar,
  onCancelar,
}: {
  c: ComissaoAssinante;
  podeEditar: boolean;
  onCancelar: () => void;
}) {
  const qc = useQueryClient();
  const atualizarFn = useServerFn(atualizarComissaoAssinante);
  const mudar = useMutation({
    mutationFn: (s: StatusComissaoAssinante) => atualizarFn({ data: { id: c.id, status: s } }),
    onSuccess: (_r, s) => {
      toast.success(s === "paga" ? "Baixa registrada." : "Comissão voltou para a pagar.");
      qc.invalidateQueries({ queryKey: ["plataforma-comissoes"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível atualizar.")),
  });

  return (
    <li className="rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{c.conta}</p>
          <p className="text-xs text-muted-foreground">
            {TIPO[c.tipo] ?? c.tipo} · proposta {c.proposta}
            {c.numero_agilliza ? ` · Agilliza ${c.numero_agilliza}` : ""}
            {c.cliente ? ` · ${c.cliente}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Registrada em {formatData(c.registrado_em)} · {pct(c.percentual)} de {formatBRL(Number(c.base))}
            {c.paga_em ? ` · paga em ${formatData(c.paga_em)}` : ""}
            {c.observacao ? ` · ${c.observacao}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold tabular-nums">{formatBRL(Number(c.valor))}</span>
          <Badge variant="outline" className={STATUS[c.status].classe}>
            {STATUS[c.status].rotulo}
          </Badge>
        </div>
      </div>
      {podeEditar && c.status !== "cancelada" && (
        <div className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:justify-end">
          {c.status === "a_pagar" ? (
            <Button size="sm" className="w-full sm:w-auto" disabled={mudar.isPending} onClick={() => mudar.mutate("paga")}>
              <BadgeCheck className="mr-1.5 size-4" /> Dar baixa (paga)
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={mudar.isPending}
              onClick={() => mudar.mutate("a_pagar")}
            >
              Voltar para a pagar
            </Button>
          )}
          <Button size="sm" variant="ghost" className="w-full text-destructive sm:w-auto" onClick={onCancelar}>
            <X className="mr-1.5 size-4" /> Cancelar
          </Button>
        </div>
      )}
    </li>
  );
}

function CancelarComissao({ comissao, aoFechar }: { comissao: ComissaoAssinante; aoFechar: () => void }) {
  const qc = useQueryClient();
  const atualizarFn = useServerFn(atualizarComissaoAssinante);
  const [motivo, setMotivo] = useState("");
  const cancelar = useMutation({
    mutationFn: () => atualizarFn({ data: { id: comissao.id, status: "cancelada", observacao: motivo } }),
    onSuccess: () => {
      toast.success("Comissão cancelada.");
      qc.invalidateQueries({ queryKey: ["plataforma-comissoes"] });
      aoFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível cancelar.")),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Cancelar comissão</DialogTitle>
          <DialogDescription>
            {comissao.conta} · {formatBRL(Number(comissao.valor))}. O motivo fica registrado.
          </DialogDescription>
        </DialogHeader>
        <Textarea rows={3} placeholder="Motivo do cancelamento" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={aoFechar}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            className="w-full sm:w-auto"
            disabled={motivo.trim().length < 5 || cancelar.isPending}
            onClick={() => cancelar.mutate()}
          >
            Cancelar comissão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Configuracao({
  padrao,
  porConta,
}: {
  padrao: number;
  porConta: { tenant_id: string; conta: string; tipo: string; percentual: number }[];
}) {
  const qc = useQueryClient();
  const definirFn = useServerFn(definirComissaoAssinante);
  const contasFn = useServerFn(contasParaComissao);
  const [valorPadrao, setValorPadrao] = useState(String(padrao).replace(".", ","));
  const [busca, setBusca] = useState("");
  const [conta, setConta] = useState<{ id: string; nome: string } | null>(null);
  const [valorConta, setValorConta] = useState("");
  const contas = useQuery({
    queryKey: ["plataforma-comissoes-contas", busca],
    queryFn: () => contasFn({ data: { busca } }),
    enabled: busca.trim().length >= 2 && !conta,
  });

  const numero = (v: string) => Number(v.replace(",", "."));
  const salvar = useMutation({
    mutationFn: (p: { tenantId: string | null; percentual: number | null }) => definirFn({ data: p }),
    onSuccess: () => {
      toast.success("Percentual salvo. Vale para os próximos registros; as comissões já criadas não mudam.");
      qc.invalidateQueries({ queryKey: ["plataforma-comissoes"] });
      setConta(null);
      setBusca("");
      setValorConta("");
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar.")),
  });

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Percentual da comissão</h2>
        <p className="text-xs text-muted-foreground">
          Mudar o percentual vale para os próximos registros. As comissões já criadas guardam o percentual do dia.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="cm-padrao">Padrão para todas as contas (%)</Label>
          <Input
            id="cm-padrao"
            inputMode="decimal"
            className="sm:w-32"
            value={valorPadrao}
            onChange={(e) => setValorPadrao(e.target.value)}
          />
        </div>
        <Button
          className="w-full sm:w-auto"
          disabled={salvar.isPending || !(numero(valorPadrao) >= 0 && numero(valorPadrao) <= 10)}
          onClick={() => salvar.mutate({ tenantId: null, percentual: numero(valorPadrao) })}
        >
          Salvar padrão
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Percentual próprio de uma conta</p>
        {porConta.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {porConta.map((c) => (
              <li key={c.tenant_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  {c.conta} <span className="text-muted-foreground">· {TIPO[c.tipo] ?? c.tipo}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <b className="tabular-nums">{pct(c.percentual)}</b>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Tirar o percentual próprio de ${c.conta}`}
                    onClick={() => salvar.mutate({ tenantId: c.tenant_id, percentual: null })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="relative flex-1">
            {conta ? (
              <div className="flex min-h-10 items-center justify-between gap-2 rounded-md border px-3 text-sm">
                <span className="truncate">{conta.nome}</span>
                <button type="button" aria-label="Trocar conta" onClick={() => setConta(null)}>
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <>
                <Input
                  aria-label="Buscar conta"
                  placeholder="Buscar conta pelo nome"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
                {(contas.data?.length ?? 0) > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
                    {contas.data!.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => setConta({ id: c.id, nome: c.nome })}
                        >
                          {c.nome} <span className="text-muted-foreground">· {TIPO[c.tipo] ?? c.tipo}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <Input
            aria-label="Percentual da conta"
            inputMode="decimal"
            placeholder="%"
            className="sm:w-24"
            value={valorConta}
            onChange={(e) => setValorConta(e.target.value)}
          />
          <Button
            className="w-full sm:w-auto"
            disabled={!conta || salvar.isPending || !(numero(valorConta) >= 0 && numero(valorConta) <= 10) || valorConta === ""}
            onClick={() => conta && salvar.mutate({ tenantId: conta.id, percentual: numero(valorConta) })}
          >
            Definir
          </Button>
        </div>
      </div>
    </section>
  );
}
