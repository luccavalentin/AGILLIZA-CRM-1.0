import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  BadgeCheck,
  CheckCheck,
  Clock,
  ExternalLink,
  Eye,
  HandCoins,
  Hourglass,
  Pencil,
  Percent,
  Plus,
  RefreshCcw,
  Undo2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { invalidarFinanceiro, isoLocal } from "@/lib/financeiro/cliente";
import {
  ajustarRepasse,
  aprovarRepasses,
  cancelarRepasse,
  confirmarBaseRepasse,
  contasParaRegraRepasse,
  definirRegraRepasse,
  detalheRepasse,
  estornarPagamentoRepasse,
  listarRepasses,
  pagarRepasse,
  regrasRepasse,
  type BaseRepasse,
  type Repasse,
} from "@/lib/financeiro/repasses.functions";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { hojeISO } from "@/lib/financeiro/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExportarFinanceiro } from "@/components/financeiro/exportar-financeiro";
import {
  Carregando,
  Chip,
  Erro,
  FiltroPeriodo,
  Metrica,
  Metricas,
  PaginaFin,
  Pilulas,
  SITUACAO_REPASSE,
  TabelaFin,
  Vazio,
  dataBR,
  moeda,
  pct,
  type Coluna,
} from "@/components/financeiro/matriz/base";
import { CampoBusca, MenuAcoes, SecaoCartao, useAtrasado, useCadastros } from "@/components/financeiro/matriz/comuns";
import { DialogoBaixa, DialogoMotivo } from "@/components/financeiro/matriz/dialogos";
import { abrirAnexo } from "@/components/financeiro/matriz/anexos";

export const Route = createFileRoute("/_authenticated/financeiro/repasses")({
  head: () => ({ meta: [{ title: "Repasses aos assinantes — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.repasses"),
  component: Pagina,
});

const BASES: Record<BaseRepasse, string> = {
  valor_financiado: "Valor financiado",
  valor_contrato: "Valor do contrato",
  comissao_recebida: "Comissão recebida do banco",
};

type Filtro = "todos" | "a_pagar" | "a_conferir" | "aguardando_base" | "aprovada" | "parcial" | "paga" | "cancelada";

function Pagina() {
  const qc = useQueryClient();
  const hoje = new Date();
  const [periodo, setPeriodo] = useState({
    de: isoLocal(new Date(hoje.getFullYear() - 1, hoje.getMonth(), 1)),
    ate: isoLocal(hoje),
  });
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const b = useAtrasado(busca);
  const podeAprovar = usePermissao("financeiro.repasses", "aprovar");
  const podePagar = usePermissao("financeiro.repasses", "pagar");
  const podeEditar = usePermissao("financeiro.repasses", "edit");
  const podeRegras = usePermissao("financeiro.repasses", "regras");
  const cad = useCadastros();

  const q = useQuery({
    queryKey: ["financeiro", "repasses", periodo, b, filtro],
    queryFn: () => listarRepasses({ data: { de: periodo.de, ate: periodo.ate, busca: b || null, status: filtro === "todos" ? null : filtro } }),
  });
  const itens = q.data?.itens ?? [];
  const t = q.data?.totais;

  const [sel, setSel] = useState<Set<string>>(new Set());
  const [detalhe, setDetalhe] = useState<Repasse | null>(null);
  const [pagar, setPagar] = useState<Repasse | null>(null);
  const [acao, setAcao] = useState<{ tipo: "ajustar" | "cancelar"; item: Repasse } | null>(null);
  const [novaRegra, setNovaRegra] = useState(false);

  async function aprovar(ids: string[]) {
    try {
      const r = await aprovarRepasses({ data: { ids } });
      toast.success(`${r.aprovados} aprovado(s)${r.recusados ? ` · ${r.recusados} não estavam prontos (base do banco pendente ou já aprovados)` : ""}.`);
      setSel(new Set());
      await invalidarFinanceiro(qc);
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível aprovar."));
    }
  }

  async function confirmarBase(id: string) {
    try {
      const r = await confirmarBaseRepasse({ data: { id } });
      toast[r.confirmada ? "success" : "info"](r.confirmada ? "Base confirmada com a comissão recebida." : "O banco ainda não pagou a comissão desta proposta.");
      await invalidarFinanceiro(qc);
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível confirmar."));
    }
  }

  const colunas: Coluna<Repasse>[] = [
    {
      chave: "conta",
      rotulo: "Assinante",
      soDesktop: true,
      render: (l) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium">{l.conta}</span>
          <span className="text-[11px] capitalize text-muted-foreground">{l.tipo_conta}</span>
        </span>
      ),
    },
    {
      chave: "proposta",
      rotulo: "Proposta",
      render: (l) => (
        <span className="block min-w-0">
          <span className="block truncate">{l.cliente ?? l.proposta}</span>
          {l.proposta_agilliza_id ? (
            <Link
              to="/operacional/propostas/$id"
              params={{ id: l.proposta_agilliza_id }}
              className="text-[11px] text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {l.numero_agilliza ?? l.proposta}
            </Link>
          ) : (
            <span className="text-[11px] text-muted-foreground">{l.proposta}</span>
          )}
        </span>
      ),
    },
    {
      chave: "base",
      rotulo: "Base (gravada)",
      render: (l) => (
        <span className="text-xs">
          {moeda(l.base)}
          <span className="block text-[11px] text-muted-foreground">
            {BASES[l.base_tipo]}
            {l.base_provisoria ? " · provisória" : ""}
          </span>
        </span>
      ),
    },
    {
      chave: "pct",
      rotulo: "%",
      alinhar: "direita",
      soDesktop: true,
      render: (l) => (
        <span title={l.regra_escopo === "conta" ? "Percentual próprio da conta" : "Padrão"}>
          {pct(l.percentual, 4)}
          {l.regra_escopo === "conta" && <span className="ml-1 text-[10px] text-primary">próprio</span>}
        </span>
      ),
    },
    { chave: "valor", rotulo: "Valor", alinhar: "direita", render: (l) => moeda(l.valor) },
    { chave: "pago", rotulo: "Pago", alinhar: "direita", render: (l) => <span className="text-success">{moeda(l.valor_pago)}</span> },
    { chave: "registro", rotulo: "Registro", render: (l) => dataBR(l.registrado_em) },
    { chave: "status", rotulo: "Situação", render: (l) => <Chip def={SITUACAO_REPASSE[l.status]} /> },
  ];

  const exportar = useMemo(
    () =>
      itens.map((l) => ({
        conta: l.conta,
        proposta: l.numero_agilliza ?? l.proposta,
        cliente: l.cliente ?? "",
        base: l.base,
        base_tipo: BASES[l.base_tipo],
        percentual: l.percentual,
        valor: l.valor,
        pago: l.valor_pago,
        registro: l.registrado_em,
        situacao: SITUACAO_REPASSE[l.status]?.rotulo ?? l.status,
      })),
    [itens],
  );

  return (
    <PaginaFin
      titulo="Repasses aos assinantes"
      descricao="O que a matriz repassa às contas assinantes (corretores e imobiliárias) pelas propostas enviadas: nasce no registro do contrato com a regra gravada, é aprovado e pago com comprovante."
      icone={Percent}
      acoes={
        <>
          <ExportarFinanceiro
            titulo="Repasses aos assinantes"
            descricao={`Registros de ${dataBR(periodo.de)} a ${dataBR(periodo.ate)}`}
            columns={[
              { key: "conta", label: "Assinante" },
              { key: "proposta", label: "Proposta" },
              { key: "cliente", label: "Cliente" },
              { key: "base", label: "Base", format: "brl", align: "right" },
              { key: "base_tipo", label: "Tipo de base" },
              { key: "percentual", label: "%", format: "pct", align: "right" },
              { key: "valor", label: "Valor", format: "brl", align: "right", footer: "sum" },
              { key: "pago", label: "Pago", format: "brl", align: "right", footer: "sum" },
              { key: "registro", label: "Registro", format: "date" },
              { key: "situacao", label: "Situação" },
            ]}
            rows={exportar}
            size="sm"
            variant="outline"
          />
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <Link to="/financeiro/assinantes">
              <Wallet className="h-4 w-4" /> Licenças por assinante
            </Link>
          </Button>
        </>
      }
    >
      <Metricas colunas={5}>
        <Metrica rotulo="Previsto" valor={moeda(t?.previsto)} ajuda={`${t?.quantidade ?? 0} repasses`} tom="info" icone={Clock} onClick={() => setFiltro("a_pagar")} />
        <Metrica rotulo="Aguardando o banco" valor={String(t?.aguardando_base ?? 0)} ajuda="base = comissão recebida" tom="neutro" icone={Hourglass} onClick={() => setFiltro("aguardando_base")} />
        <Metrica rotulo="Aprovado a pagar" valor={moeda(t?.aprovado)} tom="alerta" icone={Wallet} onClick={() => setFiltro("aprovada")} />
        <Metrica rotulo="Pago" valor={moeda(t?.pago)} tom="sucesso" icone={BadgeCheck} onClick={() => setFiltro("paga")} />
        <Metrica rotulo="Cancelado" valor={moeda(t?.cancelado)} tom="neutro" icone={Ban} onClick={() => setFiltro("cancelada")} />
      </Metricas>

      <Regras podeEditar={podeRegras} aoNova={() => setNovaRegra(true)} />

      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <FiltroPeriodo de={periodo.de} ate={periodo.ate} onChange={setPeriodo} />
        <CampoBusca valor={busca} onChange={setBusca} placeholder="Assinante ou proposta…" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Pilulas
          valor={filtro}
          onChange={setFiltro}
          opcoes={[
            { valor: "todos", rotulo: "Todos" },
            { valor: "a_pagar", rotulo: "Previstos" },
            { valor: "a_conferir", rotulo: "Em conferência", contador: t?.em_conferencia },
            { valor: "aguardando_base", rotulo: "Aguardando banco", contador: t?.aguardando_base },
            { valor: "aprovada", rotulo: "Aprovados" },
            { valor: "parcial", rotulo: "Parciais" },
            { valor: "paga", rotulo: "Pagos" },
            { valor: "cancelada", rotulo: "Cancelados" },
          ]}
        />
        {podeAprovar && sel.size > 0 && (
          <Button size="sm" className="gap-1.5" onClick={() => aprovar([...sel])}>
            <CheckCheck className="h-4 w-4" /> Aprovar {sel.size} para pagamento
          </Button>
        )}
      </div>

      {q.isLoading ? (
        <Carregando />
      ) : q.error ? (
        <Erro erro={q.error} onTentar={() => q.refetch()} />
      ) : itens.length === 0 ? (
        <Vazio
          titulo="Nenhum repasse neste filtro"
          descricao="O repasse só existe depois que o contrato da proposta enviada pelo assinante é registrado em cartório — antes disso não aparece nem soma."
        />
      ) : (
        <TabelaFin
          linhas={itens}
          colunas={colunas}
          onAbrir={setDetalhe}
          selecionados={podeAprovar ? sel : undefined}
          onSelecionar={
            podeAprovar
              ? (id, m) =>
                  setSel((s) => {
                    const n = new Set(s);
                    if (m) n.add(id);
                    else n.delete(id);
                    return n;
                  })
              : undefined
          }
          titulo={(l) => l.conta}
          acoes={(l) => (
            <MenuAcoes
              itens={[
                { rotulo: "Ver pagamentos e histórico", icone: Eye, onClick: () => setDetalhe(l) },
                {
                  rotulo: "Confirmar base (banco pagou)",
                  icone: RefreshCcw,
                  onClick: () => confirmarBase(l.id),
                  oculto: !podeAprovar || !l.base_provisoria,
                },
                { rotulo: "Aprovar para pagamento", icone: CheckCheck, onClick: () => aprovar([l.id]), oculto: !podeAprovar || l.status !== "a_pagar" },
                {
                  rotulo: "Registrar pagamento",
                  icone: HandCoins,
                  onClick: () => setPagar(l),
                  oculto: !podePagar || !["aprovada", "parcial"].includes(l.status),
                },
                {
                  rotulo: "Ajustar valor",
                  icone: Pencil,
                  onClick: () => setAcao({ tipo: "ajustar", item: l }),
                  oculto: !podeEditar || ["paga", "cancelada", "a_conferir"].includes(l.status),
                  separarAntes: true,
                },
                {
                  rotulo: "Ver licença do assinante",
                  icone: ExternalLink,
                  onClick: () => window.open(`/plataforma/licencas?conta=${l.tenant_id}`, "_self"),
                },
                {
                  rotulo: "Cancelar",
                  icone: Ban,
                  perigo: true,
                  onClick: () => setAcao({ tipo: "cancelar", item: l }),
                  oculto: !podeEditar || l.status === "cancelada" || l.valor_pago > 0,
                },
              ]}
            />
          )}
        />
      )}

      <DetalheRepasse repasse={detalhe} onFechar={() => setDetalhe(null)} podePagar={podePagar} />

      <DialogoBaixa
        aberto={!!pagar}
        titulo="Registrar pagamento do repasse"
        subtitulo={pagar?.conta}
        saldo={pagar ? pagar.saldo : 0}
        entrada={false}
        pasta="repasses"
        contas={cad.data?.contas_bancarias ?? []}
        formas={cad.data?.formas ?? []}
        onFechar={() => setPagar(null)}
        onConfirmar={async (d) => {
          await pagarRepasse({
            data: {
              id: pagar!.id,
              valor: d.valor,
              data: d.data,
              contaBancaria: d.contaBancaria,
              forma: d.forma,
              documento: d.documento,
              observacao: d.observacao,
              anexo: d.anexo,
            },
          });
          await invalidarFinanceiro(qc);
        }}
      />

      <DialogoMotivo
        aberto={!!acao}
        titulo={acao?.tipo === "ajustar" ? "Ajustar o repasse" : "Cancelar o repasse"}
        descricao={acao?.tipo === "ajustar" ? "O valor calculado continua guardado; o novo valor volta para aprovação." : undefined}
        comValor={acao?.tipo === "ajustar" ? "Novo valor" : undefined}
        valorInicial={acao?.item.valor}
        perigo={acao?.tipo === "cancelar"}
        onFechar={() => setAcao(null)}
        onConfirmar={async (motivo, valor) => {
          if (acao!.tipo === "ajustar") await ajustarRepasse({ data: { id: acao!.item.id, valor: valor ?? 0, motivo } });
          else await cancelarRepasse({ data: { id: acao!.item.id, motivo } });
          toast.success("Registrado.");
          await invalidarFinanceiro(qc);
        }}
      />

      <NovaRegra aberto={novaRegra} onFechar={() => setNovaRegra(false)} />
    </PaginaFin>
  );
}

function Regras({ podeEditar, aoNova }: { podeEditar: boolean; aoNova: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["financeiro", "repasses", "regras"], queryFn: () => regrasRepasse() });
  const [remover, setRemover] = useState<{ tenant: string; conta: string } | null>(null);
  const vigentes = (q.data?.regras ?? []).filter((r) => r.vigente && r.tenant_id);
  const futuras = (q.data?.regras ?? []).filter((r) => !r.encerrada_em && r.vigencia_inicio > hojeISO());
  const padrao = q.data?.vigente_padrao;
  return (
    <SecaoCartao
      tour="financeiro-repasses-regras"
      titulo="Regras do repasse"
      descricao="Padrão para todas as contas; o percentual próprio de uma conta prevalece. Regra nova vale de hoje em diante e nunca recalcula repasse já nascido."
      acoes={
        podeEditar && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={aoNova}>
            <Plus className="h-4 w-4" /> Nova regra
          </Button>
        )
      }
    >
      {q.isLoading ? (
        <Carregando linhas={1} />
      ) : q.error ? (
        <Erro erro={q.error} onTentar={() => q.refetch()} />
      ) : (
        <div className="grid gap-3 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
            <p className="text-xs text-muted-foreground">Padrão vigente</p>
            <p className="font-mono text-2xl font-semibold tabular-nums text-primary">{pct(padrao?.percentual, 4)}</p>
            <p className="text-xs text-muted-foreground">
              sobre {padrao ? BASES[padrao.base] : "—"} · desde {dataBR(padrao?.vigencia_inicio)}
            </p>
          </div>
          <div className="min-w-0">
            {vigentes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">Nenhuma conta com percentual próprio.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {vigentes.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{r.conta}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {pct(r.percentual, 4)} · {BASES[r.base]} · desde {dataBR(r.vigencia_inicio)}
                      </span>
                    </span>
                    {podeEditar && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Voltar ao padrão" onClick={() => setRemover({ tenant: r.tenant_id!, conta: r.conta ?? "" })}>
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {futuras.length > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Agendadas: {futuras.map((f) => `${f.conta ?? "Padrão"} ${pct(f.percentual, 4)} a partir de ${dataBR(f.vigencia_inicio)}`).join(" · ")}
              </p>
            )}
          </div>
        </div>
      )}
      <DialogoMotivo
        aberto={!!remover}
        titulo={`Voltar ${remover?.conta ?? ""} ao padrão`}
        descricao="A partir de hoje a conta segue o percentual padrão. Repasses já nascidos não mudam."
        onFechar={() => setRemover(null)}
        onConfirmar={async (motivo) => {
          await definirRegraRepasse({ data: { tenantId: remover!.tenant, percentual: null, base: null, inicio: hojeISO(), motivo } });
          toast.success("A conta volta ao padrão a partir de hoje.");
          await invalidarFinanceiro(qc);
        }}
      />
    </SecaoCartao>
  );
}

function NovaRegra({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const qc = useQueryClient();
  const [escopo, setEscopo] = useState<"padrao" | "conta">("padrao");
  const [conta, setConta] = useState<{ id: string; nome: string } | null>(null);
  const [termo, setTermo] = useState("");
  const t = useAtrasado(termo.trim());
  const [percentual, setPercentual] = useState("0,25");
  const [base, setBase] = useState<BaseRepasse>("valor_financiado");
  const [inicio, setInicio] = useState(hojeISO());
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const contas = useQuery({
    queryKey: ["financeiro", "contas-regra", t],
    enabled: escopo === "conta" && t.length >= 2 && !conta,
    queryFn: () => contasParaRegraRepasse({ data: { busca: t } }),
  });
  const valor = Number(percentual.replace(",", "."));
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !enviando && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova regra de repasse</DialogTitle>
          <DialogDescription>Vale a partir da data escolhida (hoje ou depois). O que já nasceu fica com a regra que tinha.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(["padrao", "conta"] as const).map((e) => (
              <Button key={e} type="button" variant={escopo === e ? "default" : "outline"} onClick={() => setEscopo(e)}>
                {e === "padrao" ? "Padrão (todas)" : "Uma conta"}
              </Button>
            ))}
          </div>
          {escopo === "conta" &&
            (conta ? (
              <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                <b className="truncate">{conta.nome}</b>
                <Button size="sm" variant="ghost" onClick={() => setConta(null)}>
                  Trocar
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Nome da conta assinante" />
                {(contas.data ?? []).map((c) => (
                  <button key={c.id} type="button" className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => setConta(c)}>
                    {c.nome} <span className="text-xs capitalize text-muted-foreground">· {c.tipo}</span>
                  </button>
                ))}
              </div>
            ))}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Percentual (%)</Label>
              <Input inputMode="decimal" value={percentual} onChange={(e) => setPercentual(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>A partir de</Label>
              <Input type="date" min={hojeISO()} value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Base</Label>
            <Select value={base} onValueChange={(v) => setBase(v as BaseRepasse)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BASES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {base === "comissao_recebida" && (
              <p className="text-[11px] text-muted-foreground">O repasse fica “aguardando o banco” até a comissão da proposta ser recebida.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onFechar} disabled={enviando}>
            Voltar
          </Button>
          <Button
            disabled={enviando || !(valor >= 0 && valor <= 10) || (escopo === "conta" && !conta) || !inicio}
            onClick={async () => {
              setEnviando(true);
              try {
                await definirRegraRepasse({ data: { tenantId: escopo === "conta" ? conta!.id : null, percentual: valor, base, inicio, motivo } });
                toast.success("Regra gravada.");
                await invalidarFinanceiro(qc);
                onFechar();
              } catch (e) {
                toast.error(mensagemDeErro(e, "Não foi possível gravar a regra."));
              } finally {
                setEnviando(false);
              }
            }}
          >
            Gravar regra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DetalheRep {
  item: Record<string, unknown> & { conta?: string; regra_snapshot?: Record<string, unknown> | null };
  pagamentos: {
    id: string;
    valor: number;
    data: string;
    forma: string | null;
    documento: string | null;
    conta: string | null;
    estornada_em: string | null;
    estorno_motivo: string | null;
    registrado_por: string | null;
    conciliada: boolean;
    anexo: { caminho: string; nome: string } | null;
  }[];
  eventos: { tipo: string; de: string | null; para: string | null; valor_antes: number | null; valor_depois: number | null; motivo: string | null; quando: string; quem: string | null }[];
}

const EVENTOS: Record<string, string> = {
  aprovado: "Aprovado para pagamento",
  pagamento: "Pagamento registrado",
  estorno: "Pagamento estornado",
  ajustado: "Valor ajustado",
  cancelado: "Cancelado",
  base_confirmada: "Base confirmada (banco pagou)",
};

function DetalheRepasse({ repasse, onFechar, podePagar }: { repasse: Repasse | null; onFechar: () => void; podePagar: boolean }) {
  const qc = useQueryClient();
  const [estornar, setEstornar] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["financeiro", "repasse", repasse?.id],
    enabled: !!repasse,
    queryFn: async () => (await detalheRepasse({ data: { id: repasse!.id } })) as unknown as DetalheRep | null,
  });
  const snap = q.data?.item.regra_snapshot as Record<string, unknown> | null | undefined;
  return (
    <Dialog open={!!repasse} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Repasse · {repasse?.conta}</DialogTitle>
          <DialogDescription>
            {repasse && `${moeda(repasse.valor)} · ${pct(repasse.percentual, 4)} de ${moeda(repasse.base)} (${BASES[repasse.base_tipo]})`}
          </DialogDescription>
        </DialogHeader>
        {q.isLoading ? (
          <Carregando linhas={3} />
        ) : q.error ? (
          <Erro erro={q.error} />
        ) : q.data ? (
          <div className="space-y-4 text-sm">
            {snap && (
              <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                Regra gravada: {String(snap.escopo ?? "") === "conta" ? "percentual próprio da conta" : "padrão"} · {pct(Number(snap.percentual ?? 0), 4)} ·{" "}
                {BASES[(snap.base as BaseRepasse) ?? "valor_financiado"]} · vigente desde {dataBR(String(snap.vigencia_inicio ?? ""))}
                {snap.base_definitiva != null && ` · base confirmada ${moeda(Number(snap.base_definitiva))}`}
              </div>
            )}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pagamentos</h3>
              {q.data.pagamentos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum pagamento registrado.</p>
              ) : (
                <ul className="space-y-2">
                  {q.data.pagamentos.map((p) => (
                    <li key={p.id} className={`rounded-xl border p-3 ${p.estornada_em ? "border-dashed opacity-60" : "border-border/70"}`}>
                      <div className="flex justify-between">
                        <b className="font-mono tabular-nums">{moeda(p.valor)}</b>
                        <span className="text-xs text-muted-foreground">{dataBR(p.data)}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{[p.forma, p.conta, p.documento, p.registrado_por].filter(Boolean).join(" · ")}</p>
                      {p.estornada_em && <p className="text-[11px] text-destructive">Estornado: {p.estorno_motivo}</p>}
                      <div className="mt-1.5 flex gap-2">
                        {p.anexo && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => abrirAnexo(p.anexo!.caminho).catch((e) => toast.error(e.message))}>
                            Comprovante
                          </Button>
                        )}
                        {podePagar && !p.estornada_em && !p.conciliada && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => setEstornar(p.id)}>
                            Estornar
                          </Button>
                        )}
                        {p.conciliada && <span className="text-[11px] text-success">Conciliado com o extrato</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Histórico</h3>
              <ol className="space-y-2 border-l border-border pl-4">
                {q.data.eventos.map((e, i) => (
                  <li key={i}>
                    <p className="text-xs font-semibold">{EVENTOS[e.tipo] ?? e.tipo}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(e.quando).toLocaleString("pt-BR")} · {e.quem ?? "Sistema"}
                      {e.valor_antes !== e.valor_depois && e.valor_depois != null ? ` · ${moeda(e.valor_antes ?? 0)} → ${moeda(e.valor_depois)}` : ""}
                    </p>
                    {e.motivo && <p className="text-[11px] italic">“{e.motivo}”</p>}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        ) : null}
        <DialogoMotivo
          aberto={!!estornar}
          titulo="Estornar pagamento do repasse"
          confirmar="Estornar"
          perigo
          onFechar={() => setEstornar(null)}
          onConfirmar={async (motivo) => {
            await estornarPagamentoRepasse({ data: { baixaId: estornar!, motivo } });
            toast.success("Pagamento estornado.");
            await invalidarFinanceiro(qc);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
