/**
 * Contas a pagar (despesas) e outras receitas do correspondente (C45e, C45f): fornecedor,
 * categoria, centro de custo, vencimento, recorrência de verdade (as ocorrências são
 * geradas), pagamento parcial com comprovante, boleto lido em rascunho e duplicatas
 * avisadas. Comissões dos bancos e repasses NÃO aparecem aqui (têm tela própria).
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Ban,
  CheckCircle2,
  Eye,
  FileClock,
  HandCoins,
  Paperclip,
  Pencil,
  Plus,
  Repeat,
  ScanLine,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissao } from "@/hooks/use-permissao";
import { consultar, executar, executarOuFalhar, invalidarFinanceiro, isoLocal, type AvisoFinanceiro } from "@/lib/financeiro/cliente";
import type { Cadastros, ContaFin, ListaContas } from "@/lib/financeiro/tipos";
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
  SITUACAO_CONTA,
  TabelaFin,
  Vazio,
  dataBR,
  moeda,
  type Coluna,
} from "./base";
import { BuscaProposta, CampoBusca, MenuAcoes, useAtrasado, useCadastros, type PropostaResumo } from "./comuns";
import { DialogoAviso, DialogoBaixa, DialogoMotivo } from "./dialogos";
import { GavetaLancamento } from "./detalhe";
import { LeitorBoleto, descartarRascunho } from "./leitor-boleto";
import { enviarAnexo } from "./anexos";
import { MatriculasAReceber } from "./matriculas-a-receber";

type Tipo = "pagar" | "receber";
type Filtro = "abertas" | "vencidas" | "pagas" | "recorrentes" | "rascunhos" | "canceladas" | "todas";

const RECORRENCIA: Record<string, string> = { nenhuma: "Única", mensal: "Mensal", anual: "Anual", parcelado: "Parcelada" };

function situacao(c: ContaFin) {
  if (c.rascunho) return SITUACAO_CONTA.rascunho;
  if (c.vencida) return SITUACAO_CONTA.atrasada;
  return SITUACAO_CONTA[c.status];
}

export function PaginaContas({ tipo, abrirId }: { tipo: Tipo; abrirId?: string }) {
  const qc = useQueryClient();
  const pagar = tipo === "pagar";
  const modulo = pagar ? "financeiro.contas_pagar" : "financeiro.contas_receber";
  const hoje = new Date();
  const [periodo, setPeriodo] = useState({
    de: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1)),
    ate: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() + 4, 0)),
  });
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("abertas");
  const [categoria, setCategoria] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const b = useAtrasado(busca);
  const podeCriar = usePermissao(modulo, "create");
  const podeEditar = usePermissao(modulo, "edit");
  const podeBaixar = usePermissao(modulo, "baixar");
  const cad = useCadastros();

  const q = useQuery({
    queryKey: ["financeiro", "contas", tipo, periodo, b, filtro, categoria, fornecedor],
    queryFn: () =>
      consultar<ListaContas>("contas", {
        _tipo: tipo,
        _f: {
          de: filtro === "rascunhos" ? null : periodo.de,
          ate: filtro === "rascunhos" ? null : periodo.ate,
          busca: b,
          situacao: filtro,
          categoria_id: categoria || null,
          fornecedor_id: fornecedor || null,
        },
      }),
  });
  const itens = q.data?.itens ?? [];
  const t = q.data?.totais;

  const [nova, setNova] = useState<ContaFin | "nova" | null>(null);
  const [leitor, setLeitor] = useState<{ rascunho: ContaFin | null } | null>(null);
  const [baixar, setBaixar] = useState<ContaFin | null>(null);
  const [cancelar, setCancelar] = useState<ContaFin | null>(null);
  const [detalhe, setDetalhe] = useState<ContaFin | null>(null);
  const [abertoDoLink, setAbertoDoLink] = useState<string | null>(null);
  if (abrirId && abrirId !== abertoDoLink) {
    setAbertoDoLink(abrirId);
    setDetalhe({ id: abrirId, descricao: "Conta", numero: null } as ContaFin);
  }

  async function anexar(c: ContaFin) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,image/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        await enviarAnexo(f, pagar ? "contas-pagar" : "contas-receber", pagar ? "financial_payables" : "financial_receivables", c.id);
        toast.success("Documento anexado.");
        await invalidarFinanceiro(qc);
      } catch (e) {
        toast.error(mensagemDeErro(e, "Não foi possível anexar."));
      }
    };
    input.click();
  }

  const colunas: Coluna<ContaFin>[] = [
    { chave: "numero", rotulo: "Nº", soDesktop: true, render: (c) => <span className="font-mono text-xs">{c.numero}</span> },
    {
      chave: "descricao",
      rotulo: "Descrição",
      soDesktop: true,
      render: (c) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium">{c.descricao}</span>
          <span className="text-[11px] text-muted-foreground">
            {[c.contraparte, c.categoria, c.recorrencia !== "nenhuma" ? RECORRENCIA[c.recorrencia] : null, c.origem_tipo?.startsWith("rh_") ? "RH" : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      ),
    },
    { chave: "venc", rotulo: "Vencimento", render: (c) => <span className={c.vencida ? "font-medium text-destructive" : ""}>{dataBR(c.vencimento)}</span> },
    { chave: "valor", rotulo: "Valor", alinhar: "direita", render: (c) => moeda(c.valor) },
    {
      chave: "pago",
      rotulo: pagar ? "Pago" : "Recebido",
      alinhar: "direita",
      render: (c) => <span className={c.valor_pago > 0 ? "text-success" : "text-muted-foreground"}>{moeda(c.valor_pago)}</span>,
    },
    { chave: "situacao", rotulo: "Situação", render: (c) => <Chip def={situacao(c)} /> },
  ];

  const exportar = useMemo(
    () =>
      itens.map((c) => ({
        numero: c.numero ?? "",
        descricao: c.descricao,
        contraparte: c.contraparte ?? "",
        categoria: c.categoria ?? "",
        centro: c.centro_custo ?? "",
        vencimento: c.vencimento,
        valor: c.valor,
        pago: c.valor_pago,
        situacao: situacao(c)?.rotulo ?? c.status,
      })),
    [itens],
  );

  return (
    <PaginaFin
      titulo={pagar ? "Contas a pagar" : "Contas a receber"}
      descricao={
        pagar
          ? "Despesas da operação com fornecedor, categoria e centro de custo. Boleto lido vira rascunho para conferir; pagamento só é registrado por quem pode — nunca sozinho."
          : "Outras receitas do correspondente (serviços, matrículas pedidas por terceiros…). Comissões dos bancos e licenças dos assinantes têm telas próprias."
      }
      icone={pagar ? ArrowUpCircle : ArrowDownCircle}
      acoes={
        <>
          <ExportarFinanceiro
            titulo={pagar ? "Contas a pagar" : "Contas a receber"}
            descricao={`Vencimento de ${dataBR(periodo.de)} a ${dataBR(periodo.ate)}`}
            columns={[
              { key: "numero", label: "Nº" },
              { key: "descricao", label: "Descrição" },
              { key: "contraparte", label: pagar ? "Fornecedor" : "Pagador" },
              { key: "categoria", label: "Categoria" },
              { key: "centro", label: "Centro de custo" },
              { key: "vencimento", label: "Vencimento", format: "date" },
              { key: "valor", label: "Valor", format: "brl", align: "right", footer: "sum" },
              { key: "pago", label: pagar ? "Pago" : "Recebido", format: "brl", align: "right", footer: "sum" },
              { key: "situacao", label: "Situação" },
            ]}
            rows={exportar}
            size="sm"
            variant="outline"
          />
          {!pagar && (
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <Link to="/financeiro/assinantes">Licenças dos assinantes</Link>
            </Button>
          )}
          {pagar && podeCriar && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLeitor({ rascunho: null })}>
              <ScanLine className="h-4 w-4" /> Ler boleto
            </Button>
          )}
          {podeCriar && (
            <Button size="sm" className="gap-1.5" onClick={() => setNova("nova")}>
              <Plus className="h-4 w-4" /> {pagar ? "Nova despesa" : "Nova receita"}
            </Button>
          )}
        </>
      }
    >
      <Metricas colunas={pagar ? 5 : 3}>
        <Metrica rotulo="Em aberto" valor={moeda(t?.abertas)} ajuda={`${t?.abertas_qtd ?? 0} contas`} tom="alerta" icone={FileClock} onClick={() => setFiltro("abertas")} />
        <Metrica
          rotulo="Vencidas"
          valor={moeda(t?.vencidas)}
          ajuda={`${t?.vencidas_qtd ?? 0} contas`}
          tom={(t?.vencidas_qtd ?? 0) > 0 ? "perigo" : "neutro"}
          icone={TriangleAlert}
          onClick={() => setFiltro("vencidas")}
        />
        <Metrica rotulo={pagar ? "Pago no período" : "Recebido no período"} valor={moeda(t?.pagas)} tom="sucesso" icone={CheckCircle2} onClick={() => setFiltro("pagas")} />
        {pagar && <Metrica rotulo="Recorrentes" valor={String(t?.recorrentes_qtd ?? 0)} tom="info" icone={Repeat} onClick={() => setFiltro("recorrentes")} />}
        {pagar && (
          <Metrica
            rotulo="Rascunhos de boleto"
            valor={String(t?.rascunhos_qtd ?? 0)}
            ajuda="fora das somas até conferir"
            tom={(t?.rascunhos_qtd ?? 0) > 0 ? "alerta" : "neutro"}
            icone={ScanLine}
            onClick={() => setFiltro("rascunhos")}
          />
        )}
      </Metricas>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <FiltroPeriodo de={periodo.de} ate={periodo.ate} onChange={setPeriodo} />
        <div className="flex flex-wrap gap-2">
          <Select value={categoria || "_"} onValueChange={(v) => setCategoria(v === "_" ? "" : v)}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Todas as categorias</SelectItem>
              {(cad.data?.categorias ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pagar && (
            <Select value={fornecedor || "_"} onValueChange={(v) => setFornecedor(v === "_" ? "" : v)}>
              <SelectTrigger className="h-9 w-44">
                <SelectValue placeholder="Fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_">Todos os fornecedores</SelectItem>
                {(cad.data?.fornecedores ?? []).map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <CampoBusca valor={busca} onChange={setBusca} placeholder="Número, descrição…" />
        </div>
      </div>
      <Pilulas
        valor={filtro}
        onChange={setFiltro}
        opcoes={[
          { valor: "abertas", rotulo: "Em aberto" },
          { valor: "vencidas", rotulo: "Vencidas", contador: t?.vencidas_qtd },
          { valor: "pagas", rotulo: pagar ? "Pagas" : "Recebidas" },
          ...(pagar ? [{ valor: "recorrentes" as Filtro, rotulo: "Recorrentes" }, { valor: "rascunhos" as Filtro, rotulo: "Rascunhos", contador: t?.rascunhos_qtd }] : []),
          { valor: "canceladas", rotulo: "Canceladas" },
          { valor: "todas", rotulo: "Todas" },
        ]}
      />

      {q.isLoading ? (
        <Carregando />
      ) : q.error ? (
        <Erro erro={q.error} onTentar={() => q.refetch()} />
      ) : itens.length === 0 ? (
        <Vazio
          titulo={filtro === "rascunhos" ? "Nenhum boleto esperando conferência" : "Nenhuma conta neste filtro"}
          descricao={pagar ? "Lance uma despesa ou leia um boleto (PDF, foto ou linha digitável)." : "Lance uma receita avulsa do correspondente."}
        />
      ) : (
        <TabelaFin
          linhas={itens}
          colunas={colunas}
          onAbrir={(c) => (c.rascunho ? setLeitor({ rascunho: c }) : setDetalhe(c))}
          titulo={(c) => (
            <span className="block min-w-0">
              <span className="block truncate">{c.descricao}</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                {c.numero} {c.contraparte ? `· ${c.contraparte}` : ""}
              </span>
            </span>
          )}
          acoes={(c) => (
            <MenuAcoes
              itens={[
                { rotulo: "Conferir rascunho", icone: ShieldCheck, onClick: () => setLeitor({ rascunho: c }), oculto: !c.rascunho || !podeCriar },
                {
                  rotulo: "Descartar rascunho",
                  icone: Trash2,
                  perigo: true,
                  onClick: () => descartarRascunho(c.id, qc).then(() => toast.success("Rascunho descartado.")).catch((e) => toast.error(e.message)),
                  oculto: !c.rascunho || !podeCriar,
                },
                { rotulo: "Ver detalhe e trilha", icone: Eye, onClick: () => setDetalhe(c), oculto: c.rascunho },
                {
                  rotulo: pagar ? "Registrar pagamento" : "Registrar recebimento",
                  icone: HandCoins,
                  onClick: () => setBaixar(c),
                  oculto: c.rascunho || !podeBaixar || !["aberta", "parcial", "atrasada"].includes(c.status),
                },
                { rotulo: "Anexar documento", icone: Paperclip, onClick: () => anexar(c), oculto: c.rascunho || !(podeCriar || podeEditar) },
                { rotulo: "Editar", icone: Pencil, onClick: () => setNova(c), oculto: c.rascunho || !podeEditar || ["paga", "cancelada"].includes(c.status), separarAntes: true },
                {
                  rotulo: "Cancelar",
                  icone: Ban,
                  perigo: true,
                  onClick: () => setCancelar(c),
                  oculto: c.rascunho || !podeEditar || c.status === "cancelada" || c.valor_pago > 0,
                },
              ]}
            />
          )}
        />
      )}

      {!pagar && <MatriculasAReceber />}

      <NovaConta tipo={tipo} conta={nova} onFechar={() => setNova(null)} cadastros={cad.data} />
      {pagar && <LeitorBoleto aberto={!!leitor} onFechar={() => setLeitor(null)} cadastros={cad.data} rascunhoExistente={leitor?.rascunho ?? null} />}

      <GavetaLancamento
        natureza={pagar ? "conta_pagar" : "conta_receber"}
        id={detalhe?.id ?? null}
        titulo={detalhe ? `${detalhe.numero ?? ""} · ${detalhe.descricao}` : ""}
        onFechar={() => setDetalhe(null)}
        podeEstornar={podeBaixar}
      />

      <DialogoBaixa
        aberto={!!baixar}
        titulo={pagar ? "Registrar pagamento" : "Registrar recebimento"}
        subtitulo={baixar ? `${baixar.numero ?? ""} · ${baixar.descricao}` : undefined}
        saldo={baixar ? baixar.valor - baixar.valor_pago : 0}
        entrada={!pagar}
        pasta={pagar ? "contas-pagar" : "contas-receber"}
        contas={cad.data?.contas_bancarias ?? []}
        formas={cad.data?.formas ?? []}
        onFechar={() => setBaixar(null)}
        onConfirmar={async (d) => {
          const r = await executar("baixa", {
            _natureza: pagar ? "conta_pagar" : "conta_receber",
            _alvo: baixar!.id,
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
        aberto={!!cancelar}
        titulo="Cancelar conta"
        perigo
        onFechar={() => setCancelar(null)}
        onConfirmar={async (motivo) => {
          await executarOuFalhar("contaCancelar", { _tipo: tipo, _id: cancelar!.id, _motivo: motivo });
          toast.success("Conta cancelada.");
          await invalidarFinanceiro(qc);
        }}
      />
    </PaginaFin>
  );
}

function NovaConta({
  tipo,
  conta,
  onFechar,
  cadastros,
}: {
  tipo: Tipo;
  conta: ContaFin | "nova" | null;
  onFechar: () => void;
  cadastros: Cadastros | undefined;
}) {
  const qc = useQueryClient();
  const pagar = tipo === "pagar";
  const editando = conta && conta !== "nova" ? conta : null;
  const [chave, setChave] = useState<string | null>(null);
  const [f, setF] = useState({
    descricao: "",
    contraparte: "",
    fornecedorId: "",
    categoriaId: "",
    centroId: "",
    formaId: "",
    valor: 0,
    vencimento: "",
    recorrencia: "nenhuma",
    parcelas: "3",
    ate: "",
    observacao: "",
  });
  const [proposta, setProposta] = useState<PropostaResumo | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [aviso, setAviso] = useState<AvisoFinanceiro | null>(null);
  const [enviando, setEnviando] = useState(false);
  const atual = conta ? (editando?.id ?? "nova") : null;
  if (atual !== chave) {
    setChave(atual);
    if (atual) {
      setF({
        descricao: editando?.descricao ?? "",
        contraparte: editando?.contraparte ?? "",
        fornecedorId: editando?.fornecedor_id ?? "",
        categoriaId: editando?.categoria_id ?? "",
        centroId: editando?.cost_center_id ?? "",
        formaId: editando?.payment_method_id ?? "",
        valor: editando?.valor ?? 0,
        vencimento: editando?.vencimento ?? "",
        recorrencia: "nenhuma",
        parcelas: "3",
        ate: "",
        observacao: editando?.observacao ?? "",
      });
      setProposta(null);
      setArquivo(null);
    }
  }

  async function salvar(justificativa?: string) {
    const forn = cadastros?.fornecedores?.find((x) => x.id === f.fornecedorId);
    const r = await executar<{ ids: string[] }>("contaSalvar", {
      _tipo: tipo,
      _d: {
        id: editando?.id ?? null,
        descricao: f.descricao,
        [pagar ? "fornecedor" : "pagador"]: forn?.nome ?? f.contraparte,
        fornecedor_id: pagar ? f.fornecedorId || null : undefined,
        categoria_id: f.categoriaId || null,
        cost_center_id: f.centroId || null,
        payment_method_id: f.formaId || null,
        proposta_id: !pagar ? (proposta?.id ?? editando?.proposta_id ?? null) : undefined,
        valor: f.valor,
        vencimento: f.vencimento,
        recorrencia: editando ? undefined : f.recorrencia,
        parcelas: f.recorrencia === "parcelado" ? Number(f.parcelas) : null,
        recorrencia_ate: ["mensal", "anual"].includes(f.recorrencia) ? f.ate : null,
        observacao: f.observacao || null,
        confirmar_duplicidade: !!justificativa,
        justificativa: justificativa ?? null,
      },
    });
    if (!r.ok) {
      setAviso(r);
      return;
    }
    if (arquivo && r.dados.ids[0]) {
      await enviarAnexo(arquivo, pagar ? "contas-pagar" : "contas-receber", pagar ? "financial_payables" : "financial_receivables", r.dados.ids[0]).catch(() =>
        toast.warning("A conta foi salva, mas o arquivo não anexou."),
      );
    }
    toast.success(r.dados.ids.length > 1 ? `${r.dados.ids.length} ocorrências criadas.` : editando ? "Conta atualizada." : "Conta criada.");
    await invalidarFinanceiro(qc);
    onFechar();
  }

  const valido =
    f.descricao.trim().length >= 2 &&
    f.valor > 0 &&
    !!f.vencimento &&
    (f.recorrencia !== "parcelado" || Number(f.parcelas) >= 2) &&
    (!["mensal", "anual"].includes(f.recorrencia) || !!f.ate);

  return (
    <>
      <Dialog open={!!conta} onOpenChange={(o) => !o && !enviando && onFechar()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar conta" : pagar ? "Nova despesa" : "Nova receita"}</DialogTitle>
            <DialogDescription>{pagar ? "Despesa da operação do correspondente." : "Receita avulsa do correspondente (não é comissão de banco nem licença)."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Descrição</Label>
              <Input value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} maxLength={200} />
            </div>
            {pagar ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Fornecedor</Label>
                <Select value={f.fornecedorId || "_"} onValueChange={(v) => setF({ ...f, fornecedorId: v === "_" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">Sem cadastro (escrever o nome)</SelectItem>
                    {(cadastros?.fornecedores ?? [])
                      .filter((x) => x.ativo)
                      .map((x) => (
                        <SelectItem key={x.id} value={x.id}>
                          {x.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {!f.fornecedorId && (
                  <Input value={f.contraparte} onChange={(e) => setF({ ...f, contraparte: e.target.value })} placeholder="Nome do fornecedor" maxLength={160} />
                )}
              </div>
            ) : (
              <>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Pagador</Label>
                  <Input value={f.contraparte} onChange={(e) => setF({ ...f, contraparte: e.target.value })} maxLength={160} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Proposta de origem (opcional)</Label>
                  <BuscaProposta valor={proposta} onEscolher={setProposta} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>Valor {f.recorrencia === "parcelado" ? "total" : ""}</Label>
              <CurrencyInput value={f.valor} onChange={(v) => setF({ ...f, valor: v })} />
            </div>
            <div className="space-y-1.5">
              <Label>{f.recorrencia === "nenhuma" ? "Vencimento" : "1º vencimento"}</Label>
              <Input type="date" value={f.vencimento} onChange={(e) => setF({ ...f, vencimento: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={f.categoriaId || "_"} onValueChange={(v) => setF({ ...f, categoriaId: v === "_" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">Sem categoria</SelectItem>
                  {(cadastros?.categorias ?? [])
                    .filter((c) => c.ativo && c.tipo === (pagar ? "despesa" : "receita"))
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Centro de custo</Label>
              <Select value={f.centroId || "_"} onValueChange={(v) => setF({ ...f, centroId: v === "_" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">Sem centro</SelectItem>
                  {(cadastros?.centros ?? [])
                    .filter((c) => c.ativo)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={f.formaId || "_"} onValueChange={(v) => setF({ ...f, formaId: v === "_" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">Não informada</SelectItem>
                  {(cadastros?.formas ?? [])
                    .filter((c) => c.ativo)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {!editando && (
              <div className="space-y-1.5">
                <Label>Recorrência</Label>
                <Select value={f.recorrencia} onValueChange={(v) => setF({ ...f, recorrencia: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RECORRENCIA).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!editando && f.recorrencia === "parcelado" && (
              <div className="space-y-1.5">
                <Label>Parcelas</Label>
                <Input type="number" min={2} max={120} value={f.parcelas} onChange={(e) => setF({ ...f, parcelas: e.target.value })} />
              </div>
            )}
            {!editando && ["mensal", "anual"].includes(f.recorrencia) && (
              <div className="space-y-1.5">
                <Label>Repetir até</Label>
                <Input type="date" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} />
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Observação</Label>
              <Textarea rows={2} value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} maxLength={500} />
            </div>
            {!editando && (
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground hover:border-primary/40 sm:col-span-2">
                <Paperclip className="h-4 w-4 text-primary" />
                <span className="min-w-0 flex-1 truncate">{arquivo ? arquivo.name : "Anexar documento (nota, contrato, boleto)"}</span>
                <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={onFechar} disabled={enviando}>
              Voltar
            </Button>
            <Button
              disabled={!valido || enviando}
              onClick={async () => {
                setEnviando(true);
                try {
                  await salvar();
                } catch (e) {
                  toast.error(mensagemDeErro(e, "Não foi possível salvar."));
                } finally {
                  setEnviando(false);
                }
              }}
            >
              {editando ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DialogoAviso aviso={aviso} onFechar={() => setAviso(null)} onConfirmar={(j) => salvar(j)} />
    </>
  );
}
