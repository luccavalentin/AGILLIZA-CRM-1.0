import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Copy,
  Pencil,
  CheckCircle2,
  Clock,
  Wallet,
  TrendingDown,
  Coins,
  Landmark,
  GraduationCap,
} from "lucide-react";
import { OpHero, OpStat } from "@/components/operacional/ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { Combobox, AsyncCombobox } from "@/components/ui/combobox";
import { buscarClientesCRM } from "@/lib/crm/clientes.functions";
import { formatBRL, maskBRLInput, maskBRLCents, parseBRL } from "@/lib/simulacao/format";
import {
  obterControleMatriculas,
  criarCreditoMatricula,
  excluirCreditoMatricula,
  criarSolicitacaoMatricula,
  atualizarSolicitacaoMatricula,
  alternarReembolsoMatricula,
  excluirSolicitacaoMatricula,
  type MatriculaSolicitacao,
  listarUsuariosCorrespondente,
} from "@/lib/matriculas/matriculas.functions";

export const Route = createFileRoute("/_authenticated/matriculas")({
  head: () => ({ meta: [{ title: "Controle de Matrículas — Agilliza" }] }),
  component: Pagina,
});

const hoje = () => new Date().toISOString().slice(0, 10);

function Pagina() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["matriculas"],
    queryFn: () => obterControleMatriculas(),
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["matriculas"] });

  if (isLoading || !data)
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6">
      <OpHero
        icon={<GraduationCap className="h-6 w-6" />}
        eyebrow="Documentos"
        titulo="Controle de Matrículas"
        descricao="A Agilliza tira e paga as matrículas a pedido dos corretores — e recebe o reembolso deles depois."
      />

      <PixBanner />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <OpStat
          icon={<Coins className="h-5 w-5" />}
          label="Créditos comprados"
          value={formatBRL(data.total_creditos)}
          accent="var(--primary)"
        />
        <OpStat
          icon={<TrendingDown className="h-5 w-5" />}
          label="Total pago em matrículas"
          value={formatBRL(data.total_gasto)}
          accent="var(--muted-foreground)"
        />
        <OpStat
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Reembolso recebido"
          value={formatBRL(data.total_reembolsado)}
          accent="var(--primary)"
          hint="Já ressarcido pelos corretores"
        />
        <OpStat
          icon={<Clock className="h-5 w-5" />}
          label="Reembolso pendente"
          value={formatBRL(data.total_a_reembolsar)}
          accent="var(--destructive)"
          alerta={data.total_a_reembolsar > 0}
          hint="A receber dos corretores"
        />
        <OpStat
          icon={<Wallet className="h-5 w-5" />}
          label="Saldo de crédito"
          value={formatBRL(data.saldo)}
          accent="var(--primary)"
        />
      </div>


      <Solicitacoes
        lista={data.solicitacoes}
        totalCreditos={data.total_creditos}
        onMudou={invalidar}
      />
      <Creditos lista={data.creditos} onMudou={invalidar} />
    </div>
  );
}


/** Chave Pix fixa da Agilliza (CNPJ), exposta para copiar e colar. */
const PIX_AGILLIZA = "51.306.419/0001-07";

/** Faixa azul com o Pix da Agilliza, apenas para copiar. */
function PixBanner() {
  function copiar() {
    navigator.clipboard.writeText(PIX_AGILLIZA);
    toast.success("Chave Pix copiada.");
  }

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/80 p-0 text-primary-foreground shadow-lg">
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-primary-foreground/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-primary-foreground/10 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-foreground/15 p-2.5 ring-1 ring-primary-foreground/20">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide opacity-80">
              Segue o Pix da Agilliza
            </p>
            <p className="text-lg font-semibold tabular-nums">{PIX_AGILLIZA}</p>
            <p className="text-xs opacity-80">
              Chave CNPJ — os corretores usam para reembolsar a Agilliza.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={copiar}>
            <Copy className="mr-1 h-4 w-4" /> Copiar chave
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Solicitacoes({
  lista,
  totalCreditos,
  onMudou,
}: {
  lista: MatriculaSolicitacao[];
  totalCreditos: number;
  onMudou: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [reembolso, setReembolso] = useState<"todos" | "sim" | "nao">("todos");

  async function toggle(id: string, reembolsado: boolean) {
    try {
      await alternarReembolsoMatricula({ data: { id, reembolsado } });
      onMudou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar.");
    }
  }

  // Saldo acumulado (crédito − gastos acumulados) calculado do mais antigo ao mais novo.
  const saldoPorId = useMemo(() => {
    const cronologica = [...lista].sort((a, b) =>
      a.data_solicitacao.localeCompare(b.data_solicitacao),
    );
    const mapa = new Map<string, number>();
    let acumulado = 0;
    for (const s of cronologica) {
      acumulado += Number(s.valor);
      mapa.set(s.id, totalCreditos - acumulado);
    }
    return mapa;
  }, [lista, totalCreditos]);

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lista.filter((s) => {
      if (de && s.data_solicitacao < de) return false;
      if (ate && s.data_solicitacao > ate) return false;
      if (reembolso === "sim" && !s.reembolsado) return false;
      if (reembolso === "nao" && s.reembolsado) return false;
      if (q) {
        const alvo =
          `${s.solicitante} ${s.corretor ?? ""} ${s.cliente ?? ""} ${s.numero_matricula ?? ""}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
  }, [lista, busca, de, ate, reembolso]);

  function limpar() {
    setBusca("");
    setDe("");
    setAte("");
    setReembolso("todos");
  }

  const temFiltro = busca || de || ate || reembolso !== "todos";

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Solicitações ({filtrada.length})</h2>
        <SolicitacaoDialog onMudou={onMudou} />
      </div>

      <div className="grid grid-cols-1 gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1 lg:col-span-2">
          <Label className="text-xs">Buscar (solicitante, corretor, cliente, matrícula)</Label>
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite para filtrar…"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">De</Label>
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Reembolso</Label>
          <Select value={reembolso} onValueChange={(v) => setReembolso(v as typeof reembolso)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="sim">Recebidos</SelectItem>
              <SelectItem value="nao">Pendentes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {temFiltro && (
          <div className="flex items-end lg:col-span-5">
            <Button variant="ghost" size="sm" onClick={limpar}>
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Corretor</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Nº da matrícula</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Reembolso recebido</TableHead>
              <TableHead>Data do reembolso</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrada.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma solicitação encontrada.
                </TableCell>
              </TableRow>
            )}
            {filtrada.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="tabular-nums">
                  {new Date(s.data_solicitacao + "T00:00:00").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </TableCell>
                <TableCell className="font-medium">{s.solicitante}</TableCell>
                <TableCell>{s.corretor ?? "—"}</TableCell>
                <TableCell className="max-w-[220px] truncate" title={s.cliente ?? undefined}>
                  {s.cliente ?? "—"}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {s.numero_matricula ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatBRL(s.valor)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={s.reembolsado} onCheckedChange={(v) => toggle(s.id, v)} />
                    {s.reembolsado ? (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Recebido
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" /> Pendente
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {s.data_pagto_reembolso
                    ? new Date(s.data_pagto_reembolso + "T00:00:00").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
                    : "—"}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${(saldoPorId.get(s.id) ?? 0) < 0 ? "text-destructive" : ""}`}
                >
                  {formatBRL(saldoPorId.get(s.id) ?? 0)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <SolicitacaoDialog onMudou={onMudou} inicial={s} />
                    <ConfirmDelete
                      descricao="Excluir esta solicitação de matrícula?"
                      onConfirm={async () => {
                        await excluirSolicitacaoMatricula({ data: { id: s.id } });
                        onMudou();
                      }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function SolicitacaoDialog({
  onMudou,
  inicial,
}: {
  onMudou: () => void;
  inicial?: MatriculaSolicitacao;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(inicial?.data_solicitacao ?? hoje());
  const [solicitante, setSolicitante] = useState(inicial?.solicitante ?? "");
  const [corretor, setCorretor] = useState(inicial?.corretor ?? "");
  const [cliente, setCliente] = useState(inicial?.cliente ?? "");
  const [numero, setNumero] = useState(inicial?.numero_matricula ?? "");
  const [valor, setValor] = useState(inicial?.valor ? maskBRLInput(inicial.valor) : "");
  const [reembolsado, setReembolsado] = useState(inicial?.reembolsado ?? false);
  const [dataPagto, setDataPagto] = useState(inicial?.data_pagto_reembolso ?? "");
  const [obs, setObs] = useState(inicial?.observacao ?? "");
  const [salvando, setSalvando] = useState(false);

  const { data: usuarios } = useQuery({
    queryKey: ["matriculas-usuarios"],
    queryFn: () => listarUsuariosCorrespondente(),
    staleTime: 5 * 60 * 1000,
  });
  const nomesUsuarios = useMemo(() => (usuarios ?? []).map((u) => u.nome), [usuarios]);

  const buscarClientes = useCallback(async (term: string) => {
    const rows = await buscarClientesCRM({ data: { q: term } });
    return (rows ?? []).map((c: any) => ({
      value: c.id,
      label: c.nome,
      description:
        [c.documento, c.email].filter(Boolean).join(" · ") || undefined,
    }));
  }, []);




  function reset() {
    setData(inicial?.data_solicitacao ?? hoje());
    setSolicitante(inicial?.solicitante ?? "");
    setCorretor(inicial?.corretor ?? "");
    setCliente(inicial?.cliente ?? "");
    setNumero(inicial?.numero_matricula ?? "");
    setValor(inicial?.valor ? maskBRLInput(inicial.valor) : "");
    setReembolsado(inicial?.reembolsado ?? false);
    setDataPagto(inicial?.data_pagto_reembolso ?? "");
    setObs(inicial?.observacao ?? "");
  }

  async function salvar() {
    if (!solicitante.trim()) {
      toast.error("Informe o solicitante.");
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        data_solicitacao: data,
        solicitante: solicitante.trim(),
        corretor: corretor.trim() || null,
        cliente: cliente.trim() || null,
        numero_matricula: numero.trim() || null,
        valor: parseBRL(valor),
        reembolsado,
        data_pagto_reembolso: reembolsado ? dataPagto || null : null,
        observacao: obs.trim() || null,
      };
      if (inicial) await atualizarSolicitacaoMatricula({ data: { ...payload, id: inicial.id } });
      else await criarSolicitacaoMatricula({ data: payload });
      toast.success(inicial ? "Solicitação atualizada." : "Solicitação registrada.");
      setOpen(false);
      onMudou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger asChild>
        {inicial ? (
          <Button variant="ghost" size="icon" aria-label="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> Nova solicitação
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle>{inicial ? "Editar solicitação" : "Nova solicitação"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Data da solicitação</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Valor pago</Label>
              <Input
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(maskBRLCents(e.target.value))}
                placeholder="0,00"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Operador</Label>
            <Combobox
              value={solicitante}
              onValueChange={setSolicitante}
              options={nomesUsuarios}
              placeholder="Selecione o operador"
              searchPlaceholder="Buscar operador…"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Solicitante</Label>
              <Combobox
                value={corretor}
                onValueChange={setCorretor}
                options={nomesUsuarios}
                placeholder="Nome do solicitante"
                searchPlaceholder="Buscar solicitante…"
              />
            </div>


            <div className="space-y-1">
              <Label>Nº da matrícula</Label>
              <Input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ex.: 52592"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Cliente</Label>
            <AsyncCombobox
              value={cliente}
              onValueChange={(v) => setCliente(v)}
              onSearch={buscarClientes}
              placeholder="Selecione o cliente do CRM"
              searchPlaceholder="Nome, CPF/CNPJ ou e-mail…"
              emptyText="Nenhum cliente encontrado."
            />
          </div>
          <div className="space-y-1">
            <Label>Observação</Label>
            <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <Switch checked={reembolsado} onCheckedChange={setReembolsado} />
            <Label className="cursor-pointer" onClick={() => setReembolsado((v) => !v)}>
              Reembolso recebido do corretor
            </Label>
          </div>
          {reembolsado && (
            <div className="space-y-1">
              <Label>Data do reembolso</Label>
              <Input type="date" value={dataPagto} onChange={(e) => setDataPagto(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Creditos({
  lista,
  onMudou,
}: {
  lista: { id: string; data: string; valor: number; descricao: string | null }[];
  onMudou: () => void;
}) {
  const total = useMemo(() => lista.reduce((s, c) => s + Number(c.valor), 0), [lista]);
  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Compras de crédito</h2>
          <p className="text-xs text-muted-foreground">Total: {formatBRL(total)}</p>
        </div>
        <CreditoDialog onMudou={onMudou} />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma compra de crédito registrada.
                </TableCell>
              </TableRow>
            )}
            {lista.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="tabular-nums">
                  {new Date(c.data + "T00:00:00").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </TableCell>
                <TableCell>{c.descricao ?? "Compra de crédito"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatBRL(c.valor)}</TableCell>
                <TableCell className="text-right">
                  <ConfirmDelete
                    descricao="Excluir esta compra de crédito?"
                    onConfirm={async () => {
                      await excluirCreditoMatricula({ data: { id: c.id } });
                      onMudou();
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function CreditoDialog({ onMudou }: { onMudou: () => void }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(hoje());
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await criarCreditoMatricula({
        data: { data, valor: parseBRL(valor), descricao: descricao.trim() || null },
      });
      toast.success("Crédito registrado.");
      setOpen(false);
      setValor("");
      setDescricao("");
      setData(hoje());
      onMudou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Plus className="mr-1 h-4 w-4" /> Adicionar crédito
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Compra de crédito</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Valor</Label>
              <Input
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(maskBRLCents(e.target.value))}
                placeholder="0,00"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
