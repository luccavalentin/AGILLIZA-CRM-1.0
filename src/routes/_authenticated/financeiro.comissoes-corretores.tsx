import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  BadgeCheck,
  CheckCheck,
  Clock,
  Eye,
  FileText,
  HandCoins,
  Hourglass,
  MessageSquareWarning,
  Pencil,
  Plus,
  Trash2,
  UserRoundCheck,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { consultar, executar, executarOuFalhar, invalidarFinanceiro, isoLocal, type AvisoFinanceiro } from "@/lib/financeiro/cliente";
import type { ComissaoParticipante, Demonstrativo, ListaComissoesParticipantes, Papel, Pessoa } from "@/lib/financeiro/tipos";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/simulacao/currency-input";
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
  SITUACAO_PARTICIPANTE,
  TabelaFin,
  Vazio,
  dataBR,
  moeda,
  pct,
  type Coluna,
} from "@/components/financeiro/matriz/base";
import { BuscaProposta, CampoBusca, MenuAcoes, useAtrasado, useCadastros, type PropostaResumo } from "@/components/financeiro/matriz/comuns";
import { DialogoAviso, DialogoBaixa, DialogoMotivo } from "@/components/financeiro/matriz/dialogos";
import { GavetaLancamento } from "@/components/financeiro/matriz/detalhe";
import { DemonstrativoDialogo, PAPEIS } from "@/components/financeiro/matriz/demonstrativo";

export const Route = createFileRoute("/_authenticated/financeiro/comissoes-corretores")({
  head: () => ({ meta: [{ title: "Comissões de corretores e parceiros — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.comissoes"),
  component: Pagina,
});

const BASES: Record<string, string> = {
  valor_financiado: "Valor financiado",
  valor_contrato: "Valor do contrato",
  comissao_banco: "Comissão do banco",
};

type Filtro = "todas" | "prevista" | "aguardando_confirmacao" | "aprovada" | "parcial" | "paga" | "contestada" | "ajustada" | "cancelada";
type Acao = "ajustar" | "contestar" | "cancelar" | "resolver_manter" | "resolver_ajustar";

function Pagina() {
  const qc = useQueryClient();
  const hoje = new Date();
  const [periodo, setPeriodo] = useState({
    de: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1)),
    ate: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() + 3, 0)),
  });
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [pessoa, setPessoa] = useState("");
  const [papel, setPapel] = useState("");
  const b = useAtrasado(busca);
  const podeLancar = usePermissao("financeiro.comissoes", "create");
  const podeAprovar = usePermissao("financeiro.comissoes", "aprovar");
  const podePagar = usePermissao("financeiro.comissoes", "pagar");
  const podeEditar = usePermissao("financeiro.comissoes", "edit");
  const cad = useCadastros();
  const pessoas = cad.data?.pessoas ?? [];

  const q = useQuery({
    queryKey: ["financeiro", "comissoes-participantes", periodo, b, filtro, pessoa, papel],
    queryFn: () =>
      consultar<ListaComissoesParticipantes>("comissoesParticipantes", {
        _f: {
          de: periodo.de,
          ate: periodo.ate,
          busca: b,
          situacao: filtro === "todas" ? null : filtro,
          pessoa_id: pessoa || null,
          papel: papel || null,
        },
      }),
  });
  const itens = q.data?.itens ?? [];
  const t = q.data?.totais;

  const [sel, setSel] = useState<Set<string>>(new Set());
  const [detalhe, setDetalhe] = useState<ComissaoParticipante | null>(null);
  const [pagar, setPagar] = useState<ComissaoParticipante | null>(null);
  const [acao, setAcao] = useState<{ tipo: Acao; item: ComissaoParticipante } | null>(null);
  const [novo, setNovo] = useState(false);
  const [participantes, setParticipantes] = useState(false);
  const [demo, setDemo] = useState<{ id: string; nome: string } | null>(null);

  async function aprovar(ids: string[]) {
    try {
      const r = await executarOuFalhar<{ aprovadas: number; recusadas: number }>("cuAprovar", { _ids: ids });
      toast.success(
        `${r.aprovadas} aprovada(s) para pagamento${r.recusadas ? ` · ${r.recusadas} não estavam prontas (aguardando o banco, contestadas ou já pagas)` : ""}.`,
      );
      setSel(new Set());
      await invalidarFinanceiro(qc);
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível aprovar."));
    }
  }

  const colunas: Coluna<ComissaoParticipante>[] = [
    {
      chave: "pessoa",
      rotulo: "Pessoa",
      soDesktop: true,
      render: (l) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium">{l.pessoa ?? "—"}</span>
          <span className="text-[11px] text-muted-foreground">
            {l.papel ? PAPEIS[l.papel] : l.tipo_vinculo} · {l.pessoa_tipo === "portal_parceiro" ? "parceiro" : "equipe"}
          </span>
        </span>
      ),
    },
    {
      chave: "proposta",
      rotulo: "Proposta",
      render: (l) =>
        l.proposta_id ? (
          <Link to="/operacional/propostas/$id" params={{ id: l.proposta_id }} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
            {l.numero_proposta}
          </Link>
        ) : (
          <span className="text-muted-foreground">Avulsa</span>
        ),
    },
    {
      chave: "calculo",
      rotulo: "Cálculo (gravado)",
      soDesktop: true,
      render: (l) => (
        <span className="text-xs text-muted-foreground">
          {l.tipo_valor === "fixo" ? "Valor fixo" : `${pct(l.percentual, 4)} de ${moeda(l.base)}`}
          <br />
          {BASES[l.base_calculo] ?? l.base_calculo}
          {l.regra_individual ? " · regra própria" : " · regra do papel"}
        </span>
      ),
    },
    { chave: "valor", rotulo: "Valor", alinhar: "direita", render: (l) => moeda(l.valor) },
    { chave: "pago", rotulo: "Pago", alinhar: "direita", render: (l) => <span className="text-success">{moeda(l.pago)}</span> },
    { chave: "venc", rotulo: "Vencimento", render: (l) => dataBR(l.vencimento) },
    { chave: "situacao", rotulo: "Situação", render: (l) => <Chip def={SITUACAO_PARTICIPANTE[l.situacao]} /> },
  ];

  const exportar = useMemo(
    () =>
      itens.map((l) => ({
        pessoa: l.pessoa ?? "",
        papel: l.papel ? PAPEIS[l.papel] : "",
        proposta: l.numero_proposta ?? "",
        base: l.base,
        percentual: l.percentual,
        valor: l.valor,
        pago: l.pago,
        saldo: l.saldo,
        vencimento: l.vencimento ?? "",
        situacao: SITUACAO_PARTICIPANTE[l.situacao]?.rotulo ?? l.situacao,
      })),
    [itens],
  );

  return (
    <PaginaFin
      titulo="Comissões de corretores e parceiros"
      descricao="Fluxo próprio, separado do repasse aos assinantes: regra individual ou do papel (originou, atendeu, participou), previsão no gatilho, aprovação e pagamento com comprovante."
      icone={UserRoundCheck}
      acoes={
        <>
          <ExportarFinanceiro
            titulo="Comissões de corretores e parceiros"
            descricao={`Vencimento de ${dataBR(periodo.de)} a ${dataBR(periodo.ate)}`}
            columns={[
              { key: "pessoa", label: "Pessoa" },
              { key: "papel", label: "Papel" },
              { key: "proposta", label: "Proposta" },
              { key: "base", label: "Base", format: "brl", align: "right" },
              { key: "percentual", label: "%", format: "pct", align: "right" },
              { key: "valor", label: "Valor", format: "brl", align: "right", footer: "sum" },
              { key: "pago", label: "Pago", format: "brl", align: "right", footer: "sum" },
              { key: "saldo", label: "Saldo", format: "brl", align: "right", footer: "sum" },
              { key: "vencimento", label: "Vencimento", format: "date" },
              { key: "situacao", label: "Situação" },
            ]}
            rows={exportar}
            size="sm"
            variant="outline"
          />
          {podeLancar && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setParticipantes(true)}>
              <Users className="h-4 w-4" /> Participantes da proposta
            </Button>
          )}
          {podeLancar && (
            <Button size="sm" className="gap-1.5" onClick={() => setNovo(true)}>
              <Plus className="h-4 w-4" /> Lançar comissão
            </Button>
          )}
        </>
      }
    >
      <Metricas colunas={5}>
        <Metrica rotulo="Previstas" valor={moeda(t?.previstas)} ajuda={`${t?.quantidade ?? 0} lançamentos`} tom="info" icone={Clock} />
        <Metrica rotulo="Aguardando o banco" valor={moeda(t?.aguardando)} tom="neutro" icone={Hourglass} onClick={() => setFiltro("aguardando_confirmacao")} />
        <Metrica rotulo="Aprovadas a pagar" valor={moeda(t?.aprovadas)} tom="alerta" icone={Wallet} onClick={() => setFiltro("aprovada")} />
        <Metrica rotulo="Pagas" valor={moeda(t?.pagas)} tom="sucesso" icone={BadgeCheck} />
        <Metrica
          rotulo="Contestadas"
          valor={String(t?.contestadas ?? 0)}
          tom={(t?.contestadas ?? 0) > 0 ? "perigo" : "neutro"}
          icone={MessageSquareWarning}
          onClick={() => setFiltro("contestada")}
        />
      </Metricas>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <FiltroPeriodo de={periodo.de} ate={periodo.ate} onChange={setPeriodo} />
        <div className="flex flex-wrap gap-2">
          <Select value={pessoa || "_"} onValueChange={(v) => setPessoa(v === "_" ? "" : v)}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue placeholder="Pessoa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Todas as pessoas</SelectItem>
              {pessoas.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={papel || "_"} onValueChange={(v) => setPapel(v === "_" ? "" : v)}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="Papel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Todos os papéis</SelectItem>
              {Object.entries(PAPEIS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <CampoBusca valor={busca} onChange={setBusca} placeholder="Pessoa, proposta, banco…" />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Pilulas
          valor={filtro}
          onChange={setFiltro}
          opcoes={[
            { valor: "todas", rotulo: "Todas" },
            { valor: "prevista", rotulo: "Previstas" },
            { valor: "aguardando_confirmacao", rotulo: "Aguardando banco" },
            { valor: "ajustada", rotulo: "Ajustadas" },
            { valor: "aprovada", rotulo: "Aprovadas" },
            { valor: "parcial", rotulo: "Parciais" },
            { valor: "paga", rotulo: "Pagas" },
            { valor: "contestada", rotulo: "Contestadas", contador: t?.contestadas },
            { valor: "cancelada", rotulo: "Canceladas" },
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
          titulo="Nenhuma comissão neste filtro"
          descricao="As previsões nascem quando a proposta chega à etapa da regra de cada pessoa (Regras e configurações). Avulsas entram por “Lançar comissão”."
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
          titulo={(l) => (
            <span>
              {l.pessoa ?? "—"} <span className="text-xs font-normal text-muted-foreground">· {l.papel ? PAPEIS[l.papel] : l.tipo_vinculo}</span>
            </span>
          )}
          acoes={(l) => (
            <MenuAcoes
              itens={[
                { rotulo: "Ver detalhe e trilha", icone: Eye, onClick: () => setDetalhe(l) },
                { rotulo: "Demonstrativo da pessoa", icone: FileText, onClick: () => setDemo({ id: l.pessoa_id, nome: l.pessoa ?? "" }) },
                {
                  rotulo: "Aprovar para pagamento",
                  icone: CheckCheck,
                  onClick: () => aprovar([l.id]),
                  oculto: !podeAprovar || !["prevista", "ajustada"].includes(l.situacao),
                },
                {
                  rotulo: "Registrar pagamento",
                  icone: HandCoins,
                  onClick: () => setPagar(l),
                  oculto: !podePagar || !["aprovada", "parcial"].includes(l.situacao),
                },
                {
                  rotulo: "Ajustar valor",
                  icone: Pencil,
                  onClick: () => setAcao({ tipo: "ajustar", item: l }),
                  oculto: !podeEditar || ["paga", "cancelada"].includes(l.situacao),
                  separarAntes: true,
                },
                {
                  rotulo: "Contestar",
                  icone: MessageSquareWarning,
                  onClick: () => setAcao({ tipo: "contestar", item: l }),
                  oculto: !podeEditar || ["paga", "cancelada", "contestada"].includes(l.situacao),
                },
                {
                  rotulo: "Manter (resolver contestação)",
                  icone: BadgeCheck,
                  onClick: () => setAcao({ tipo: "resolver_manter", item: l }),
                  oculto: !podeEditar || l.situacao !== "contestada",
                },
                {
                  rotulo: "Ajustar (resolver contestação)",
                  icone: Pencil,
                  onClick: () => setAcao({ tipo: "resolver_ajustar", item: l }),
                  oculto: !podeEditar || l.situacao !== "contestada",
                },
                {
                  rotulo: "Cancelar",
                  icone: Ban,
                  perigo: true,
                  onClick: () => setAcao({ tipo: "cancelar", item: l }),
                  oculto: !podeEditar || l.situacao === "cancelada" || l.pago > 0,
                },
              ]}
            />
          )}
        />
      )}

      <GavetaLancamento
        natureza="comissao_participante"
        id={detalhe?.id ?? null}
        titulo={detalhe ? `Comissão de ${detalhe.pessoa ?? ""}` : ""}
        onFechar={() => setDetalhe(null)}
        podeEstornar={podePagar}
        resumo={
          detalhe && (
            <div className="space-y-2 rounded-xl bg-muted/40 p-3 text-xs">
              <p>
                <b>{moeda(detalhe.valor)}</b> ·{" "}
                {detalhe.tipo_valor === "fixo" ? "valor fixo" : `${pct(detalhe.percentual, 4)} de ${moeda(detalhe.base)} (${BASES[detalhe.base_calculo]})`}
              </p>
              {detalhe.valor_original != null && detalhe.valor_original !== detalhe.valor && <p>Calculado: {moeda(detalhe.valor_original)}</p>}
              {detalhe.contestacao_motivo && <p className="text-destructive">Contestação: {detalhe.contestacao_motivo}</p>}
              {detalhe.ajuste_motivo && <p>Ajuste: {detalhe.ajuste_motivo}</p>}
            </div>
          )
        }
      />

      <DialogoBaixa
        aberto={!!pagar}
        titulo="Registrar pagamento da comissão"
        subtitulo={pagar?.pessoa ?? undefined}
        saldo={pagar ? pagar.saldo : 0}
        entrada={false}
        pasta="comissoes"
        contas={cad.data?.contas_bancarias ?? []}
        formas={cad.data?.formas ?? []}
        onFechar={() => setPagar(null)}
        onConfirmar={async (d) => {
          const r = await executar("baixa", {
            _natureza: "comissao_participante",
            _alvo: pagar!.id,
            _valor: d.valor,
            _data: d.data,
            _conta_bancaria: d.contaBancaria,
            _forma: d.forma,
            _documento: d.documento,
            _observacao: d.observacao,
            _anexo: d.anexo,
          });
          if (r.ok) await invalidarFinanceiro(qc);
          return r;
        }}
      />

      <DialogoMotivo
        aberto={!!acao}
        titulo={
          acao?.tipo === "ajustar" || acao?.tipo === "resolver_ajustar"
            ? "Ajustar a comissão"
            : acao?.tipo === "contestar"
              ? "Contestar a comissão"
              : acao?.tipo === "resolver_manter"
                ? "Manter o valor (resolver contestação)"
                : "Cancelar a comissão"
        }
        descricao={acao?.tipo?.startsWith("resolver") ? `Contestação: ${acao.item.contestacao_motivo ?? ""}` : undefined}
        comValor={acao?.tipo === "ajustar" || acao?.tipo === "resolver_ajustar" ? "Novo valor" : undefined}
        valorInicial={acao?.item.valor}
        perigo={acao?.tipo === "cancelar"}
        onFechar={() => setAcao(null)}
        onConfirmar={async (motivo, valor) => {
          const a = acao!;
          if (a.tipo === "ajustar") await executarOuFalhar("cuAjustar", { _id: a.item.id, _novo: valor, _motivo: motivo });
          else if (a.tipo === "contestar") await executarOuFalhar("cuContestar", { _id: a.item.id, _motivo: motivo });
          else if (a.tipo === "cancelar") await executarOuFalhar("cuCancelar", { _id: a.item.id, _motivo: motivo });
          else
            await executarOuFalhar("cuResolver", {
              _id: a.item.id,
              _manter: a.tipo === "resolver_manter",
              _novo: a.tipo === "resolver_ajustar" ? valor : null,
              _motivo: motivo,
            });
          toast.success("Registrado.");
          await invalidarFinanceiro(qc);
        }}
      />

      <NovaComissao aberto={novo} onFechar={() => setNovo(false)} pessoas={pessoas} />
      <Participantes aberto={participantes} onFechar={() => setParticipantes(false)} pessoas={pessoas} />
      <DemonstrativoDialogo pessoa={demo} onFechar={() => setDemo(null)} />
    </PaginaFin>
  );
}

function NovaComissao({ aberto, onFechar, pessoas }: { aberto: boolean; onFechar: () => void; pessoas: Pessoa[] }) {
  const qc = useQueryClient();
  const [proposta, setProposta] = useState<PropostaResumo | null>(null);
  const [pessoa, setPessoa] = useState("");
  const [papel, setPapel] = useState<Papel | "">("");
  const [tipo, setTipo] = useState<"percentual" | "fixo">("percentual");
  const [base, setBase] = useState("valor_financiado");
  const [percentual, setPercentual] = useState("");
  const [fixo, setFixo] = useState(0);
  const [vencimento, setVencimento] = useState("");
  const [obs, setObs] = useState("");
  const [aviso, setAviso] = useState<AvisoFinanceiro | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(justificativa?: string) {
    const r = await executar("cuLancar", {
      _d: {
        proposta_id: proposta?.id ?? null,
        usuario_id: pessoa,
        papel: papel || null,
        tipo_valor: tipo,
        base_calculo: base,
        percentual: tipo === "percentual" ? Number(percentual.replace(",", ".")) : 0,
        valor_fixo: tipo === "fixo" ? fixo : null,
        vencimento: vencimento || null,
        observacao: obs || null,
        confirmar: !!justificativa,
        justificativa: justificativa ?? null,
      },
    });
    if (!r.ok) {
      setAviso(r);
      return;
    }
    toast.success("Comissão lançada como prevista.");
    await invalidarFinanceiro(qc);
    onFechar();
  }

  return (
    <>
      <Dialog open={aberto} onOpenChange={(o) => !o && !enviando && onFechar()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Lançar comissão de corretor ou parceiro</DialogTitle>
            <DialogDescription>Entra como prevista; a regra usada fica gravada no lançamento.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Proposta (opcional)</Label>
              <BuscaProposta valor={proposta} onEscolher={setProposta} />
            </div>
            <div className="space-y-1.5">
              <Label>Pessoa</Label>
              <Select value={pessoa} onValueChange={setPessoa}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent>
                  {pessoas
                    .filter((p) => p.ativo)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Papel na proposta</Label>
              <Select value={papel || "_"} onValueChange={(v) => setPapel(v === "_" ? "" : (v as Papel))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">Sem papel</SelectItem>
                  {Object.entries(PAPEIS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as "percentual" | "fixo")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentual">Percentual</SelectItem>
                  <SelectItem value="fixo">Valor fixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tipo === "percentual" ? (
              <>
                <div className="space-y-1.5">
                  <Label>Percentual (%)</Label>
                  <Input inputMode="decimal" value={percentual} onChange={(e) => setPercentual(e.target.value)} placeholder="0,50" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Base</Label>
                  <Select value={base} onValueChange={setBase}>
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
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label>Valor</Label>
                <CurrencyInput value={fixo} onChange={setFixo} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Vencimento</Label>
              <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Observação</Label>
              <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={onFechar} disabled={enviando}>
              Voltar
            </Button>
            <Button
              disabled={enviando || !pessoa || (tipo === "percentual" ? !percentual : fixo <= 0)}
              onClick={async () => {
                setEnviando(true);
                try {
                  await salvar();
                } catch (e) {
                  toast.error(mensagemDeErro(e, "Não foi possível lançar."));
                } finally {
                  setEnviando(false);
                }
              }}
            >
              Lançar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DialogoAviso aviso={aviso} onFechar={() => setAviso(null)} onConfirmar={(j) => salvar(j)} />
    </>
  );
}

function Participantes({ aberto, onFechar, pessoas }: { aberto: boolean; onFechar: () => void; pessoas: Pessoa[] }) {
  const qc = useQueryClient();
  const [proposta, setProposta] = useState<PropostaResumo | null>(null);
  const [itens, setItens] = useState<{ pessoa_id: string; papel: Papel }[]>([]);
  const [enviando, setEnviando] = useState(false);
  const atuais = useQuery({
    queryKey: ["financeiro", "participantes", proposta?.id],
    enabled: !!proposta,
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await (supabase as any)
        .from("fin_proposta_participantes")
        .select("pessoa_id, papel")
        .eq("proposta_id", proposta!.id);
      if (error) throw new Error("Não foi possível ler os participantes.");
      const lista = (data ?? []) as { pessoa_id: string; papel: Papel }[];
      setItens(lista);
      return lista;
    },
  });
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !enviando && onFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Participantes da proposta</DialogTitle>
          <DialogDescription>
            Quem originou, atendeu ou participou. A mesma pessoa não entra duas vezes no mesmo papel; cada uma recebe pela regra dela (ou do papel).
          </DialogDescription>
        </DialogHeader>
        <BuscaProposta
          valor={proposta}
          onEscolher={(p) => {
            setProposta(p);
            setItens([]);
          }}
        />
        {proposta && (
          <div className="space-y-2">
            {atuais.isLoading && <Carregando linhas={2} />}
            {itens.map((it, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_8.5rem_auto] gap-2">
                <Select value={it.pessoa_id} onValueChange={(v) => setItens((l) => l.map((x, j) => (j === i ? { ...x, pessoa_id: v } : x)))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pessoa" />
                  </SelectTrigger>
                  <SelectContent>
                    {pessoas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={it.papel} onValueChange={(v) => setItens((l) => l.map((x, j) => (j === i ? { ...x, papel: v as Papel } : x)))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAPEIS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" aria-label="Remover" onClick={() => setItens((l) => l.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setItens((l) => [...l, { pessoa_id: "", papel: "participou" }])}>
              <Plus className="h-4 w-4" /> Adicionar participante
            </Button>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onFechar} disabled={enviando}>
            Fechar
          </Button>
          <Button
            disabled={!proposta || enviando || itens.some((i) => !i.pessoa_id)}
            onClick={async () => {
              setEnviando(true);
              try {
                await executarOuFalhar("participantes", { _prop_id: proposta!.id, _itens: itens });
                const n = await executarOuFalhar<number>("cuGerarFaltantes", { _prop_id: proposta!.id });
                toast.success(n ? `Participantes salvos · ${n} previsão(ões) gerada(s).` : "Participantes salvos. Nenhuma regra nova se aplica.");
                await invalidarFinanceiro(qc);
                onFechar();
              } catch (e) {
                toast.error(mensagemDeErro(e, "Não foi possível salvar."));
              } finally {
                setEnviando(false);
              }
            }}
          >
            Salvar e gerar previsões
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
