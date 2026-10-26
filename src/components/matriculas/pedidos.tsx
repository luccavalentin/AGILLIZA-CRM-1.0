import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Ban,
  BatteryWarning,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  FileDown,
  Hand,
  Plus,
  Search,
  Undo2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, maskBRLCents, maskBRLInput } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";
import {
  aguardarRecargaMatricula,
  assumirMatricula,
  cancelarMatricula,
  concluirMatricula,
  desfazerPagamentoMatricula,
  linkArquivoMatricula,
  listarSolicitantesMatricula,
  marcarMatriculaPaga,
  pedirMatricula,
  type MatriculaSolicitacao,
} from "@/lib/matriculas/matriculas.functions";
import {
  acoesDisponiveis,
  custoValido,
  erroDoArquivo,
  nomeDoSolicitante,
  ROTULO_STATUS,
  rotuloOrigem,
  STATUS_ABERTOS,
  type StatusMatricula,
} from "@/lib/matriculas/regras";
import { SolicitacaoDialog } from "./solicitacao-dialog";

type Filtro = "abertos" | "aguardando_recarga" | "a_receber" | "concluida" | "cancelada" | "todos";

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "abertos", rotulo: "Em aberto" },
  { id: "aguardando_recarga", rotulo: "Aguardando recarga" },
  { id: "a_receber", rotulo: "A receber" },
  { id: "concluida", rotulo: "Concluídas" },
  { id: "cancelada", rotulo: "Canceladas" },
  { id: "todos", rotulo: "Todos" },
];

const TOM_STATUS: Record<StatusMatricula, string> = {
  pedida: "bg-primary/10 text-primary",
  em_andamento: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  aguardando_recarga: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  concluida: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  cancelada: "bg-muted text-muted-foreground",
};

function data(iso: string | null): string {
  if (!iso) return "—";
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function Pedidos({
  lista,
  eu,
  valorReferencia,
  saldo,
  onMudou,
}: {
  lista: MatriculaSolicitacao[];
  eu: string;
  valorReferencia: number | null;
  saldo: number;
  onMudou: () => void;
}) {
  const podeEditar = usePermissao("documentos.matriculas", "edit");
  const podeCriar = usePermissao("documentos.matriculas", "create");
  const [filtro, setFiltro] = useState<Filtro>("abertos");
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState(false);
  const [concluir, setConcluir] = useState<MatriculaSolicitacao | null>(null);
  const [cancelar, setCancelar] = useState<MatriculaSolicitacao | null>(null);

  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = { abertos: 0, aguardando_recarga: 0, a_receber: 0, concluida: 0, cancelada: 0, todos: lista.length };
    for (const s of lista) {
      if (STATUS_ABERTOS.includes(s.status)) c.abertos++;
      if (s.status === "aguardando_recarga") c.aguardando_recarga++;
      if (s.status === "concluida") c.concluida++;
      if (s.status === "concluida" && !s.reembolsado) c.a_receber++;
      if (s.status === "cancelada") c.cancelada++;
    }
    return c;
  }, [lista]);

  const filtrada = useMemo(() => {
    const q = busca
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    return lista.filter((s) => {
      if (filtro === "abertos" && !STATUS_ABERTOS.includes(s.status)) return false;
      if (filtro === "aguardando_recarga" && s.status !== "aguardando_recarga") return false;
      if (filtro === "a_receber" && !(s.status === "concluida" && !s.reembolsado)) return false;
      if (filtro === "concluida" && s.status !== "concluida") return false;
      if (filtro === "cancelada" && s.status !== "cancelada") return false;
      if (!q) return true;
      return `${nomeDoSolicitante(s)} ${s.corretor ?? ""} ${s.cliente ?? ""} ${s.numero_matricula ?? ""} ${s.cartorio ?? ""} ${s.imovel ?? ""}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .includes(q);
    });
  }, [lista, filtro, busca]);

  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <h2 className="mr-auto text-sm font-semibold text-foreground">Pedidos de matrícula</h2>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Solicitante, cartório, matrícula…"
            className="h-9 pl-8"
          />
        </div>
        {podeCriar && <SolicitacaoDialog onMudou={onMudou} />}
        {podeCriar && (
          <Button size="sm" onClick={() => setNovo(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Novo pedido
          </Button>
        )}
      </div>
      <div className="flex gap-1.5 overflow-x-auto border-b px-4 py-2.5">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            aria-pressed={filtro === f.id}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filtro === f.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {f.rotulo}
            <span className="ml-1.5 tabular-nums opacity-80">{contagem[f.id]}</span>
          </button>
        ))}
      </div>

      {filtrada.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">
            {busca ? "Nada encontrado com essa busca" : filtro === "abertos" ? "Nenhum pedido em aberto" : "Nada por aqui"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Os pedidos feitos pela equipe, pelos parceiros e pelas contas assinantes (pelo portal
            delas) aparecem aqui.
          </p>
        </div>
      ) : (
        <ul className="divide-y">
          {filtrada.map((s) => (
            <LinhaPedido
              key={s.id}
              s={s}
              eu={eu}
              podeEditar={podeEditar}
              onMudou={onMudou}
              onConcluir={() => setConcluir(s)}
              onCancelar={() => setCancelar(s)}
            />
          ))}
        </ul>
      )}

      <NovoPedidoDialog aberto={novo} aoFechar={() => setNovo(false)} onMudou={onMudou} />
      <ConcluirDialog
        pedido={concluir}
        valorReferencia={valorReferencia}
        saldo={saldo}
        aoFechar={() => setConcluir(null)}
        onMudou={onMudou}
      />
      <CancelarDialog pedido={cancelar} aoFechar={() => setCancelar(null)} onMudou={onMudou} />
    </section>
  );
}

function LinhaPedido({
  s,
  eu,
  podeEditar,
  onMudou,
  onConcluir,
  onCancelar,
}: {
  s: MatriculaSolicitacao;
  eu: string;
  podeEditar: boolean;
  onMudou: () => void;
  onConcluir: () => void;
  onCancelar: () => void;
}) {
  const assumirFn = useServerFn(assumirMatricula);
  const aguardarFn = useServerFn(aguardarRecargaMatricula);
  const pagarFn = useServerFn(marcarMatriculaPaga);
  const desfazerFn = useServerFn(desfazerPagamentoMatricula);
  const linkFn = useServerFn(linkArquivoMatricula);
  const [ocupado, setOcupado] = useState(false);
  const acoes = acoesDisponiveis(s, eu, podeEditar);

  async function rodar(fn: () => Promise<unknown>, ok: string) {
    setOcupado(true);
    try {
      await fn();
      toast.success(ok);
      onMudou();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível concluir agora."));
    } finally {
      setOcupado(false);
    }
  }

  async function abrirArquivo() {
    try {
      const { url } = await linkFn({ data: { id: s.id, tipo: "matricula" } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível abrir o arquivo."));
    }
  }

  const assinante = s.solicitante_tipo === "assinante";
  return (
    <li className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TOM_STATUS[s.status])}>
            {ROTULO_STATUS[s.status]}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
              assinante ? "border-primary/30 text-primary" : "text-muted-foreground",
            )}
          >
            {assinante ? <Building2 className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
            {rotuloOrigem(s)}
          </span>
          {s.status === "concluida" && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                s.reembolsado
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {s.reembolsado ? `Pago em ${data(s.data_pagto_reembolso)}` : "A receber"}
            </span>
          )}
        </div>
        <p className="mt-1.5 truncate font-semibold text-foreground">
          {nomeDoSolicitante(s)}
          {assinante && s.corretor && <span className="font-normal text-muted-foreground"> · {s.corretor}</span>}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {[s.cartorio, s.cidade_uf].filter(Boolean).join(" · ") || "Cartório não informado"}
          {s.numero_matricula && <span className="text-foreground"> · Matrícula {s.numero_matricula}</span>}
        </p>
        {(s.imovel || s.cliente) && (
          <p className="truncate text-xs text-muted-foreground">
            {[s.imovel, s.cliente && `Cliente: ${s.cliente}`].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Pedido em {data(s.data_solicitacao)}
          {s.analista_nome && ` · Analista: ${s.analista_nome}`}
          {s.concluida_em && ` · Puxada em ${data(s.concluida_em)}`}
          {s.cancelada_motivo && ` · ${s.cancelada_motivo}`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
        {s.status === "concluida" && (
          <span className="mr-1 text-base font-semibold tabular-nums text-foreground">{formatBRL(s.valor)}</span>
        )}
        {s.tem_arquivo && (
          <Button size="sm" variant="outline" onClick={() => void abrirArquivo()}>
            <FileDown className="mr-1 h-3.5 w-3.5" />
            Matrícula
          </Button>
        )}
        {acoes.includes("assumir") && (
          <Botao disabled={ocupado} onClick={() => rodar(() => assumirFn({ data: { id: s.id } }), "Pedido assumido.")}>
            <Hand className="mr-1 h-3.5 w-3.5" />
            Assumir
          </Botao>
        )}
        {acoes.includes("aguardar_recarga") && (
          <Botao
            disabled={ocupado}
            onClick={() => rodar(() => aguardarFn({ data: { id: s.id } }), "Pedido aguardando a recarga.")}
          >
            <BatteryWarning className="mr-1 h-3.5 w-3.5" />
            Sem saldo
          </Botao>
        )}
        {acoes.includes("concluir") && (
          <Button size="sm" disabled={ocupado} onClick={onConcluir}>
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            Concluir
          </Button>
        )}
        {acoes.includes("marcar_paga") && (
          <Button
            size="sm"
            disabled={ocupado}
            onClick={() => rodar(() => pagarFn({ data: { id: s.id, data: null } }), "Pagamento registrado.")}
          >
            <CircleDollarSign className="mr-1 h-3.5 w-3.5" />
            Marcar paga
          </Button>
        )}
        {acoes.includes("desfazer_pagamento") && (
          <Botao
            disabled={ocupado}
            onClick={() => rodar(() => desfazerFn({ data: { id: s.id } }), "Pagamento desfeito.")}
          >
            <Undo2 className="mr-1 h-3.5 w-3.5" />
            Desfazer
          </Botao>
        )}
        {acoes.includes("cancelar") && (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            disabled={ocupado}
            onClick={onCancelar}
            aria-label="Cancelar pedido"
          >
            <Ban className="h-3.5 w-3.5" />
          </Button>
        )}
        {s.solicitante_tipo === "externo" && s.status === "concluida" && podeEditar && (
          <SolicitacaoDialog onMudou={onMudou} inicial={s} />
        )}
      </div>
    </li>
  );
}

function Botao(props: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" disabled={props.disabled} onClick={props.onClick}>
      {props.children}
    </Button>
  );
}

const selectCls =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function NovoPedidoDialog({
  aberto,
  aoFechar,
  onMudou,
}: {
  aberto: boolean;
  aoFechar: () => void;
  onMudou: () => void;
}) {
  const pedirFn = useServerFn(pedirMatricula);
  const listarFn = useServerFn(listarSolicitantesMatricula);
  const pessoas = useQuery({
    queryKey: ["matriculas-solicitantes"],
    queryFn: () => listarFn(),
    enabled: aberto,
    staleTime: 5 * 60_000,
  });
  const [quem, setQuem] = useState("");
  const [nomeAvulso, setNomeAvulso] = useState("");
  const [cartorio, setCartorio] = useState("");
  const [cidade, setCidade] = useState("");
  const [numero, setNumero] = useState("");
  const [imovel, setImovel] = useState("");
  const [cliente, setCliente] = useState("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  function limpar() {
    setQuem("");
    setNomeAvulso("");
    setCartorio("");
    setCidade("");
    setNumero("");
    setImovel("");
    setCliente("");
    setObs("");
  }

  async function salvar() {
    setSalvando(true);
    try {
      await pedirFn({
        data: {
          solicitante_user_id: quem && quem !== "avulso" ? quem : null,
          solicitante_nome: quem === "avulso" ? nomeAvulso : null,
          cartorio,
          cidade_uf: cidade || null,
          numero_matricula: numero || null,
          imovel: imovel || null,
          cliente: cliente || null,
          observacao: obs || null,
        },
      });
      toast.success("Pedido registrado. Um analista assume e puxa a matrícula.");
      limpar();
      aoFechar();
      onMudou();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível registrar o pedido."));
    } finally {
      setSalvando(false);
    }
  }

  const grupos = useMemo(() => {
    const equipe = (pessoas.data ?? []).filter((p) => p.grupo === "Equipe");
    const parceiros = (pessoas.data ?? []).filter((p) => p.grupo !== "Equipe");
    return { equipe, parceiros };
  }, [pessoas.data]);

  const valido =
    (quem && (quem !== "avulso" || nomeAvulso.trim().length >= 2)) &&
    cartorio.trim().length >= 2 &&
    (numero.trim() || imovel.trim());

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo pedido de matrícula</DialogTitle>
          <DialogDescription>
            Quem pede paga a Agilliza depois que o analista puxar a matrícula.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="mp-quem">Quem pediu</Label>
            <select id="mp-quem" className={selectCls} value={quem} onChange={(e) => setQuem(e.target.value)}>
              <option value="">{pessoas.isLoading ? "Carregando…" : "Escolha"}</option>
              {grupos.equipe.length > 0 && (
                <optgroup label="Equipe">
                  {grupos.equipe.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </optgroup>
              )}
              {grupos.parceiros.length > 0 && (
                <optgroup label="Parceiros e corretores">
                  {grupos.parceiros.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </optgroup>
              )}
              <option value="avulso">Outra pessoa (digitar o nome)</option>
            </select>
          </div>
          {quem === "avulso" && (
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="mp-nome">Nome de quem pediu</Label>
              <Input id="mp-nome" value={nomeAvulso} maxLength={200} onChange={(e) => setNomeAvulso(e.target.value)} />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="mp-cart">Cartório</Label>
            <Input
              id="mp-cart"
              value={cartorio}
              maxLength={160}
              onChange={(e) => setCartorio(e.target.value)}
              placeholder="Ex.: 1º Registro de Imóveis"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mp-cid">Cidade/UF</Label>
            <Input id="mp-cid" value={cidade} maxLength={80} onChange={(e) => setCidade(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mp-num">Nº da matrícula</Label>
            <Input id="mp-num" value={numero} maxLength={100} onChange={(e) => setNumero(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mp-cli">Cliente</Label>
            <Input id="mp-cli" value={cliente} maxLength={200} onChange={(e) => setCliente(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="mp-imo">Imóvel (endereço)</Label>
            <Input
              id="mp-imo"
              value={imovel}
              maxLength={300}
              onChange={(e) => setImovel(e.target.value)}
              placeholder="Obrigatório se não souber o número"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="mp-obs">Observação</Label>
            <Textarea id="mp-obs" rows={2} value={obs} maxLength={500} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando || !valido}>
            {salvando ? "Salvando…" : "Registrar pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConcluirDialog({
  pedido,
  valorReferencia,
  saldo,
  aoFechar,
  onMudou,
}: {
  pedido: MatriculaSolicitacao | null;
  valorReferencia: number | null;
  saldo: number;
  aoFechar: () => void;
  onMudou: () => void;
}) {
  const concluirFn = useServerFn(concluirMatricula);
  const [valor, setValor] = useState("");
  const [numero, setNumero] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

  // Ao abrir outro pedido, recomeça com o valor de referência e o número já pedido.
  if (pedido && aberto !== pedido.id) {
    setAberto(pedido.id);
    setValor(valorReferencia ? maskBRLInput(valorReferencia) : "");
    setNumero(pedido.numero_matricula ?? "");
    setArquivo(null);
  }

  const custo = custoValido(valor);
  const semSaldo = custo !== null && custo > saldo;

  async function salvar() {
    if (!pedido || custo === null) return;
    const fd = new FormData();
    fd.set("id", pedido.id);
    fd.set("valor", String(custo));
    fd.set("numero", numero);
    if (arquivo) fd.set("arquivo", arquivo);
    setSalvando(true);
    try {
      await concluirFn({ data: fd });
      toast.success(`Matrícula concluída: ${formatBRL(custo)} a receber de ${nomeDoSolicitante(pedido)}.`);
      setAberto(null);
      aoFechar();
      onMudou();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível concluir."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog
      open={!!pedido}
      onOpenChange={(v) => {
        if (!v) {
          setAberto(null);
          aoFechar();
        }
      }}
    >
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Concluir matrícula</DialogTitle>
          <DialogDescription>
            O custo vira valor a receber de {pedido ? nomeDoSolicitante(pedido) : "quem pediu"} e sai do saldo
            de crédito ({formatBRL(saldo)}).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="mc-valor">Custo da matrícula</Label>
            <Input
              id="mc-valor"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(maskBRLCents(e.target.value))}
              placeholder="0,00"
              aria-invalid={semSaldo}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mc-num">Nº da matrícula</Label>
            <Input id="mc-num" value={numero} maxLength={100} onChange={(e) => setNumero(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="mc-arq">Matrícula (PDF ou imagem, até 20 MB)</Label>
            <Input
              id="mc-arq"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                const erro = f ? erroDoArquivo(f) : null;
                if (erro) {
                  toast.error(erro);
                  e.target.value = "";
                  setArquivo(null);
                } else setArquivo(f);
              }}
            />
          </div>
          {semSaldo && (
            <p className="text-xs font-medium text-destructive sm:col-span-2">
              O saldo de crédito não cobre este custo: registre a recarga antes.
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando || custo === null || semSaldo || !numero.trim()}>
            {salvando ? "Concluindo…" : "Concluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelarDialog({
  pedido,
  aoFechar,
  onMudou,
}: {
  pedido: MatriculaSolicitacao | null;
  aoFechar: () => void;
  onMudou: () => void;
}) {
  const cancelarFn = useServerFn(cancelarMatricula);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!pedido) return;
    setSalvando(true);
    try {
      await cancelarFn({ data: { id: pedido.id, motivo } });
      toast.success("Pedido cancelado.");
      setMotivo("");
      aoFechar();
      onMudou();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível cancelar."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={!!pedido} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar pedido</DialogTitle>
          <DialogDescription>
            {pedido?.solicitante_tipo === "assinante"
              ? "A conta assinante vê o cancelamento e o motivo no portal dela."
              : "O pedido fica no histórico como cancelado."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="mx-mot">Motivo</Label>
          <Textarea id="mx-mot" rows={2} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={aoFechar}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={() => void salvar()} disabled={salvando || motivo.trim().length < 3}>
            {salvando ? "Cancelando…" : "Cancelar pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
