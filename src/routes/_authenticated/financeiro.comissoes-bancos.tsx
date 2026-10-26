import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle2,
  Clock,
  Eye,
  FilePlus2,
  HandCoins,
  Landmark,
  MessageSquareWarning,
  Pencil,
  Plus,
  Scale,
  Sparkles,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { consultar, executar, executarOuFalhar, invalidarFinanceiro, isoLocal, type AvisoFinanceiro } from "@/lib/financeiro/cliente";
import type { ComissaoBanco, ListaComissoesBanco } from "@/lib/financeiro/tipos";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/simulacao/currency-input";
import { BancoLogo } from "@/components/bancos/banco-logo";
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
  SITUACAO_BANCO,
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

export const Route = createFileRoute("/_authenticated/financeiro/comissoes-bancos")({
  head: () => ({ meta: [{ title: "Comissões dos bancos — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.comissoes_bancos"),
  component: Pagina,
});

type Filtro = "todas" | "previsto" | "a_receber" | "parcial" | "divergente" | "contestado" | "recebido" | "cancelado";
type Acao = "informar" | "corrigir" | "contestar" | "resolver" | "cancelar" | "diferenca";

function Pagina() {
  const qc = useQueryClient();
  const hoje = new Date();
  const [periodo, setPeriodo] = useState({
    de: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1)),
    ate: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() + 3, 0)),
  });
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const buscaAtrasada = useAtrasado(busca);
  const podeLancar = usePermissao("financeiro.comissoes_bancos", "create");
  const podeEditar = usePermissao("financeiro.comissoes_bancos", "edit");
  const podeReceber = usePermissao("financeiro.comissoes_bancos", "receber");
  const cad = useCadastros();

  const q = useQuery({
    queryKey: ["financeiro", "comissoes-bancos", periodo, buscaAtrasada, filtro],
    queryFn: () =>
      consultar<ListaComissoesBanco>("comissoesBancos", {
        _f: { de: periodo.de, ate: periodo.ate, busca: buscaAtrasada, situacao: filtro === "todas" ? null : filtro },
      }),
  });

  const [novo, setNovo] = useState(false);
  const [detalhe, setDetalhe] = useState<ComissaoBanco | null>(null);
  const [acao, setAcao] = useState<{ tipo: Acao; item: ComissaoBanco } | null>(null);
  const [receber, setReceber] = useState<ComissaoBanco | null>(null);

  const t = q.data?.totais;
  const itens = q.data?.itens ?? [];

  async function gerarFaltantes() {
    try {
      const n = await executarOuFalhar<number>("cbGerarFaltantes");
      toast.success(n ? `${n} previsão(ões) gerada(s) para contratos sem previsão.` : "Todos os contratos já têm previsão.");
      await invalidarFinanceiro(qc);
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível gerar."));
    }
  }

  const colunas: Coluna<ComissaoBanco>[] = [
    {
      chave: "banco",
      rotulo: "Banco",
      soDesktop: true,
      render: (l) => (
        <span className="flex items-center gap-2">
          <BancoLogo nome={l.banco} size="md" />
          <span className="truncate">{l.banco ?? "—"}</span>
        </span>
      ),
    },
    {
      chave: "proposta",
      rotulo: "Cliente / proposta",
      render: (l) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium">{l.cliente ?? "—"}</span>
          {l.proposta_id ? (
            <Link
              to="/operacional/propostas/$id"
              params={{ id: l.proposta_id }}
              className="text-[11px] text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {l.numero_proposta}
            </Link>
          ) : (
            <span className="text-[11px] text-muted-foreground">{l.contrato ? `Contrato ${l.contrato}` : "Lançamento manual"}</span>
          )}
        </span>
      ),
    },
    {
      chave: "previsto",
      rotulo: "Previsto",
      alinhar: "direita",
      render: (l) => (
        <span title={l.sem_regra ? "Sem regra do banco: informe o valor" : `${pct(l.percentual, 4)} de ${moeda(l.base)}`}>
          {l.sem_regra ? <span className="text-warning">sem regra</span> : moeda(l.previsto)}
        </span>
      ),
    },
    { chave: "informado", rotulo: "Informado", alinhar: "direita", render: (l) => (l.informado != null ? moeda(l.informado) : "—") },
    { chave: "recebido", rotulo: "Recebido", alinhar: "direita", render: (l) => <span className="text-success">{moeda(l.recebido)}</span> },
    {
      chave: "diferenca",
      rotulo: "Diferença",
      alinhar: "direita",
      soDesktop: true,
      render: (l) =>
        l.diferenca == null || Math.abs(l.diferenca) < 0.01 ? (
          "—"
        ) : (
          <span className={l.diferenca < 0 ? "text-destructive" : "text-warning"}>{moeda(l.diferenca)}</span>
        ),
    },
    { chave: "previsao", rotulo: "Previsão", render: (l) => dataBR(l.previsao_recebimento) },
    { chave: "situacao", rotulo: "Situação", render: (l) => <Chip def={SITUACAO_BANCO[l.situacao]} /> },
  ];

  const linhasExport = useMemo(
    () =>
      itens.map((l) => ({
        banco: l.banco ?? "",
        cliente: l.cliente ?? "",
        proposta: l.numero_proposta ?? l.contrato ?? "",
        previsto: l.previsto,
        informado: l.informado ?? 0,
        recebido: l.recebido,
        diferenca: l.diferenca ?? 0,
        previsao: l.previsao_recebimento ?? "",
        situacao: SITUACAO_BANCO[l.situacao]?.rotulo ?? l.situacao,
      })),
    [itens],
  );

  return (
    <PaginaFin
      titulo="Comissões dos bancos"
      descricao="O que cada banco deve ao correspondente: previsão pela regra gravada, valor informado pelo banco e o efetivamente recebido. Contrato registrado gera previsão — nunca recebimento."
      icone={Landmark}
      acoes={
        <>
          <ExportarFinanceiro
            titulo="Comissões dos bancos"
            descricao={`Previsão de ${dataBR(periodo.de)} a ${dataBR(periodo.ate)}`}
            columns={[
              { key: "banco", label: "Banco" },
              { key: "cliente", label: "Cliente" },
              { key: "proposta", label: "Proposta/contrato" },
              { key: "previsto", label: "Previsto", format: "brl", align: "right", footer: "sum" },
              { key: "informado", label: "Informado", format: "brl", align: "right", footer: "sum" },
              { key: "recebido", label: "Recebido", format: "brl", align: "right", footer: "sum" },
              { key: "diferenca", label: "Diferença", format: "brl", align: "right" },
              { key: "previsao", label: "Previsão", format: "date" },
              { key: "situacao", label: "Situação" },
            ]}
            rows={linhasExport}
            size="sm"
            variant="outline"
          />
          {podeLancar && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={gerarFaltantes}>
              <Sparkles className="h-4 w-4" /> Gerar previsões que faltam
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
        <Metrica rotulo="Previsto" valor={moeda(t?.previsto)} ajuda={`${t?.quantidade ?? 0} comissões`} tom="info" icone={Clock} />
        <Metrica rotulo="Informado pelo banco" valor={moeda(t?.informado)} tom="marca" icone={FilePlus2} />
        <Metrica rotulo="Recebido" valor={moeda(t?.recebido)} tom="sucesso" icone={CheckCircle2} />
        <Metrica rotulo="A receber" valor={moeda(t?.a_receber)} ajuda={`${t?.vencidas ?? 0} com previsão vencida`} tom="alerta" icone={Wallet} />
        <Metrica
          rotulo="Divergentes / contestadas"
          valor={`${t?.divergentes ?? 0} / ${t?.contestadas ?? 0}`}
          tom={(t?.divergentes ?? 0) + (t?.contestadas ?? 0) > 0 ? "perigo" : "neutro"}
          icone={Scale}
          onClick={() => setFiltro("divergente")}
        />
      </Metricas>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <FiltroPeriodo de={periodo.de} ate={periodo.ate} onChange={setPeriodo} />
        <CampoBusca valor={busca} onChange={setBusca} placeholder="Cliente, banco, contrato…" />
      </div>
      <Pilulas
        valor={filtro}
        onChange={setFiltro}
        opcoes={[
          { valor: "todas", rotulo: "Todas" },
          { valor: "previsto", rotulo: "Previstas" },
          { valor: "a_receber", rotulo: "A receber" },
          { valor: "parcial", rotulo: "Parciais" },
          { valor: "divergente", rotulo: "Divergentes", contador: t?.divergentes },
          { valor: "contestado", rotulo: "Contestadas", contador: t?.contestadas },
          { valor: "recebido", rotulo: "Recebidas" },
          { valor: "cancelado", rotulo: "Canceladas" },
        ]}
      />

      {q.isLoading ? (
        <Carregando />
      ) : q.error ? (
        <Erro erro={q.error} onTentar={() => q.refetch()} />
      ) : itens.length === 0 ? (
        <Vazio
          titulo="Nenhuma comissão neste filtro"
          descricao="A previsão nasce sozinha quando a proposta chega ao gatilho (contrato emitido ou registrado). Lançamentos avulsos entram pelo botão “Lançar comissão”."
        />
      ) : (
        <TabelaFin
          linhas={itens}
          colunas={colunas}
          onAbrir={setDetalhe}
          titulo={(l) => (
            <span className="flex items-center gap-2">
              <BancoLogo nome={l.banco} size="sm" /> {l.banco ?? "—"}
            </span>
          )}
          acoes={(l) => (
            <MenuAcoes
              itens={[
                { rotulo: "Ver detalhe e trilha", icone: Eye, onClick: () => setDetalhe(l) },
                {
                  rotulo: "Registrar recebimento",
                  icone: HandCoins,
                  onClick: () => setReceber(l),
                  oculto: !podeReceber || ["cancelado", "recebido"].includes(l.situacao),
                },
                {
                  rotulo: "Informar valor do banco",
                  icone: FilePlus2,
                  onClick: () => setAcao({ tipo: "informar", item: l }),
                  oculto: !(podeLancar || podeEditar) || l.situacao === "cancelado",
                },
                {
                  rotulo: "Corrigir previsão",
                  icone: Pencil,
                  onClick: () => setAcao({ tipo: "corrigir", item: l }),
                  oculto: !podeEditar || ["cancelado", "recebido"].includes(l.situacao),
                },
                {
                  rotulo: "Encerrar com diferença",
                  icone: Scale,
                  onClick: () => setAcao({ tipo: "diferenca", item: l }),
                  oculto: !podeReceber || l.situacao !== "parcial",
                },
                {
                  rotulo: l.situacao === "contestado" ? "Resolver contestação" : "Contestar com o banco",
                  icone: MessageSquareWarning,
                  onClick: () => setAcao({ tipo: l.situacao === "contestado" ? "resolver" : "contestar", item: l }),
                  oculto: !podeEditar || l.situacao === "cancelado",
                  separarAntes: true,
                },
                {
                  rotulo: "Cancelar",
                  icone: Ban,
                  perigo: true,
                  onClick: () => setAcao({ tipo: "cancelar", item: l }),
                  oculto: !podeEditar || l.situacao === "cancelado" || l.recebido > 0,
                },
              ]}
            />
          )}
        />
      )}

      <NovaComissao aberto={novo} onFechar={() => setNovo(false)} bancos={cad.data?.bancos ?? []} />

      <GavetaLancamento
        natureza="comissao_banco"
        id={detalhe?.id ?? null}
        titulo={detalhe ? `Comissão ${detalhe.banco ?? ""}` : ""}
        onFechar={() => setDetalhe(null)}
        podeEstornar={podeReceber}
        resumo={
          detalhe && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Resumo rotulo="Previsto" valor={moeda(detalhe.previsto)} />
              <Resumo rotulo="Informado" valor={detalhe.informado != null ? moeda(detalhe.informado) : "—"} />
              <Resumo rotulo="Recebido" valor={moeda(detalhe.recebido)} />
              <Resumo rotulo="Situação" valor={SITUACAO_BANCO[detalhe.situacao]?.rotulo ?? detalhe.situacao} />
            </div>
          )
        }
      />

      <DialogoBaixa
        aberto={!!receber}
        titulo="Registrar recebimento do banco"
        subtitulo={receber ? `${receber.banco ?? ""} · ${receber.cliente ?? ""}` : undefined}
        saldo={receber ? Math.max(0, (receber.informado ?? receber.previsto) - receber.recebido) : 0}
        entrada
        pasta="comissoes-bancos"
        contas={cad.data?.contas_bancarias ?? []}
        formas={cad.data?.formas ?? []}
        permiteExcedente
        onFechar={() => setReceber(null)}
        onConfirmar={async (d) => {
          const r = await executar("baixa", {
            _natureza: "comissao_banco",
            _alvo: receber!.id,
            _valor: d.valor,
            _data: d.data,
            _conta_bancaria: d.contaBancaria,
            _forma: d.forma,
            _documento: d.documento,
            _observacao: d.observacao,
            _anexo: d.anexo,
            _permitir_excedente: d.permitirExcedente,
          });
          if (r.ok) await invalidarFinanceiro(qc);
          return r;
        }}
      />

      <DialogoMotivo
        aberto={!!acao}
        titulo={
          acao?.tipo === "informar"
            ? "Valor informado pelo banco"
            : acao?.tipo === "corrigir"
              ? "Corrigir a previsão"
              : acao?.tipo === "contestar"
                ? "Contestar com o banco"
                : acao?.tipo === "resolver"
                  ? "Resolver contestação"
                  : acao?.tipo === "diferenca"
                    ? "Encerrar com diferença"
                    : "Cancelar comissão"
        }
        descricao={
          acao?.tipo === "informar"
            ? "O valor que o banco informou no relatório/extrato dele. Diferente da previsão vira “divergente”. Não marca recebido."
            : acao?.tipo === "diferenca"
              ? "O banco pagou parte e não vai completar: a comissão fica recebida, com a diferença registrada."
              : undefined
        }
        rotulo={acao?.tipo === "informar" ? "Observação (de onde veio o valor)" : "Motivo"}
        comValor={acao?.tipo === "informar" ? "Valor informado" : acao?.tipo === "corrigir" ? "Nova previsão" : undefined}
        valorInicial={acao ? (acao.tipo === "informar" ? (acao.item.informado ?? acao.item.previsto) : acao.item.previsto) : 0}
        perigo={acao?.tipo === "cancelar"}
        onFechar={() => setAcao(null)}
        onConfirmar={async (motivo, valor) => {
          const a = acao!;
          const mapa: Record<Acao, [Parameters<typeof executarOuFalhar>[0], Record<string, unknown>]> = {
            informar: ["cbInformar", { _id: a.item.id, _valor: valor, _observacao: motivo }],
            corrigir: ["cbCorrigir", { _id: a.item.id, _valor: valor, _motivo: motivo }],
            contestar: ["cbContestar", { _id: a.item.id, _motivo: motivo }],
            resolver: ["cbResolver", { _id: a.item.id, _motivo: motivo }],
            cancelar: ["cbCancelar", { _id: a.item.id, _motivo: motivo }],
            diferenca: ["cbEncerrarDiferenca", { _id: a.item.id, _motivo: motivo }],
          };
          const [nome, args] = mapa[a.tipo];
          await executarOuFalhar(nome, args);
          toast.success("Registrado.");
          await invalidarFinanceiro(qc);
        }}
      />
    </PaginaFin>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{rotulo}</p>
      <p className="font-mono text-sm font-semibold tabular-nums">{valor}</p>
    </div>
  );
}

function NovaComissao({ aberto, onFechar, bancos }: { aberto: boolean; onFechar: () => void; bancos: string[] }) {
  const qc = useQueryClient();
  const [proposta, setProposta] = useState<PropostaResumo | null>(null);
  const [banco, setBanco] = useState("");
  const [cliente, setCliente] = useState("");
  const [contrato, setContrato] = useState("");
  const [valor, setValor] = useState(0);
  const [previsao, setPrevisao] = useState("");
  const [origem, setOrigem] = useState("");
  const [obs, setObs] = useState("");
  const [aviso, setAviso] = useState<AvisoFinanceiro | null>(null);
  const [enviando, setEnviando] = useState(false);

  function limpar() {
    setProposta(null);
    setBanco("");
    setCliente("");
    setContrato("");
    setValor(0);
    setPrevisao("");
    setOrigem("");
    setObs("");
  }

  async function salvar(justificativa?: string) {
    const d = {
      proposta_id: proposta?.id ?? null,
      banco_nome: banco || proposta?.nome_banco || null,
      cliente_nome: cliente || proposta?.nome_cliente || null,
      numero_contrato: contrato || null,
      valor_previsto: valor,
      previsao_recebimento: previsao || null,
      origem_do_calculo: origem || null,
      observacao: obs || null,
      confirmar_duplicidade: !!justificativa,
      justificativa: justificativa ?? null,
    };
    const r = await executar("cbLancar", { _d: d });
    if (!r.ok) {
      setAviso(r);
      return;
    }
    toast.success("Comissão lançada como prevista.");
    await invalidarFinanceiro(qc);
    limpar();
    onFechar();
  }

  return (
    <>
      <Dialog open={aberto} onOpenChange={(o) => !o && !enviando && onFechar()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Lançar comissão do banco</DialogTitle>
            <DialogDescription>Entra como prevista. Recebimento só depois, com o registro do crédito.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Proposta (opcional)</Label>
              <BuscaProposta
                valor={proposta}
                onEscolher={(p) => {
                  setProposta(p);
                  if (p) {
                    setBanco(p.nome_banco ?? "");
                    setCliente(p.nome_cliente ?? "");
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Banco</Label>
              <Input value={banco} onChange={(e) => setBanco(e.target.value)} list="fin-bancos" />
              <datalist id="fin-bancos">
                {bancos.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Nº do contrato</Label>
              <Input value={contrato} onChange={(e) => setContrato(e.target.value)} maxLength={60} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Cliente</Label>
              <Input value={cliente} onChange={(e) => setCliente(e.target.value)} maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor previsto</Label>
              <CurrencyInput value={valor} onChange={setValor} />
            </div>
            <div className="space-y-1.5">
              <Label>Previsão de recebimento</Label>
              <Input type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Origem do cálculo</Label>
              <Input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Ex.: tabela do banco 10/2026, 1,2% do financiado" maxLength={200} />
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
              disabled={enviando || !(banco || proposta)}
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
