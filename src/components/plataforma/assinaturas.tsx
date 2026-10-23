import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FilePlus2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissao } from "@/hooks/use-permissao";
import { RodapePaginas, useValorAssentado } from "@/components/plataforma/paginacao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, formatData, hojeISO, somarMesesISO } from "@/lib/financeiro/format";
import {
  POR_PAGINA_ASSINATURAS,
  cancelarAssinaturaPlataforma,
  criarAssinaturaPlataforma,
  emitirFaturaAvulsa,
  listarAssinaturas,
  type AssinaturaPlataforma,
} from "@/lib/plataforma/receita.functions";

const CICLO: Record<string, string> = {
  mensal: "mês",
  trimestral: "trimestre",
  semestral: "semestre",
  anual: "ano",
};
const NOME_PERIODO: Record<string, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};
const MESES: Record<string, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };

/** Situação da assinatura (o banco tem também "em teste" e "encerrada", que antes viravam "Ativa"). */
function situacao(a: AssinaturaPlataforma): {
  rotulo: string;
  tom: "default" | "secondary" | "destructive" | "outline";
} {
  // Licença por pacote (0253): em dia, vencida (carência) ou bloqueada.
  if (a.licenca) {
    if (a.status === "ativa") return { rotulo: "Em dia", tom: "default" };
    if (a.status === "vencida") return { rotulo: "Vencida", tom: "secondary" };
    return { rotulo: "Bloqueada", tom: "destructive" };
  }
  if (a.cancelada_em || a.status === "cancelada") return { rotulo: "Cancelada", tom: "outline" };
  if (a.status === "encerrada") return { rotulo: "Encerrada", tom: "outline" };
  if (a.status === "inadimplente") return { rotulo: "Inadimplente", tom: "destructive" };
  if (a.status === "trial") return { rotulo: "Em teste", tom: "secondary" };
  return { rotulo: "Ativa", tom: "default" };
}

/** "1.234,50" ou "1234.5" → número; inválido → NaN. */
function numero(v: string): number {
  const t = v.trim();
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
}

/** Assinaturas dos assinantes, com criar, cancelar e fatura avulsa. */
export function AssinaturasPlataforma() {
  const listarFn = useServerFn(listarAssinaturas);
  const pode = usePermissao("saas.receita", "edit");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const termo = useValorAssentado(busca.trim());
  const q = useQuery({
    queryKey: ["plataforma-assinaturas", termo, pagina],
    queryFn: () => listarFn({ data: { busca: termo || null, pagina } }),
    placeholderData: (anterior) => anterior,
  });
  const [nova, setNova] = useState(false);
  const [fatura, setFatura] = useState(false);
  const [cancelando, setCancelando] = useState<AssinaturaPlataforma | null>(null);

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
        <h2 className="text-sm font-semibold">Assinaturas</h2>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Input
            aria-label="Buscar assinatura pela conta"
            placeholder="Buscar pela conta"
            className="sm:w-56"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
            }}
          />
          {pode && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setFatura(true)}>
                <FilePlus2 className="mr-1 size-4" /> Fatura avulsa
              </Button>
              <Button size="sm" onClick={() => setNova(true)}>
                <Plus className="mr-1 size-4" /> Nova assinatura
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Conta</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="hidden md:table-cell">Próxima cobrança</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-[1%] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Skeleton className="h-10" />
                </TableCell>
              </TableRow>
            )}
            {q.isError && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-destructive">
                  {mensagemDeErro(q.error, "Não foi possível carregar as assinaturas.")}
                </TableCell>
              </TableRow>
            )}
            {q.data && q.data.assinaturas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {termo ? "Nenhuma assinatura com esta busca." : "Nenhuma assinatura ainda."}
                </TableCell>
              </TableRow>
            )}
            {(q.data?.assinaturas ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <p className="font-medium">{a.conta}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.conta_tipo === "imobiliaria"
                      ? "Imobiliária"
                      : a.conta_tipo === "parceiro"
                        ? "Parceiro"
                        : "Corretor"}
                    {a.quantidade_usuarios
                      ? ` · ${a.quantidade_usuarios} ${a.quantidade_usuarios === 1 ? "usuário" : "usuários"}`
                      : ""}
                  </p>
                </TableCell>
                <TableCell>
                  {a.plano ?? "—"}
                  {a.licenca && (
                    <p className="text-xs text-muted-foreground">
                      Licença {NOME_PERIODO[a.ciclo]?.toLowerCase() ?? a.ciclo}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(a.valor)}/{CICLO[a.ciclo] ?? a.ciclo}
                  {(MESES[a.ciclo] ?? 1) > 1 && (
                    <span className="block text-xs text-muted-foreground">
                      {formatBRL(a.mrr)}/mês
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {a.proxima_cobranca_em ? formatData(a.proxima_cobranca_em) : "—"}
                  {a.licenca && a.proxima_cobranca_em && (
                    <span className="block text-xs text-muted-foreground">fim do acesso</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={situacao(a).tom}>{situacao(a).rotulo}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {pode && !a.cancelada_em && !a.licenca && (
                    <Button size="sm" variant="ghost" onClick={() => setCancelando(a)}>
                      Cancelar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <RodapePaginas
        pagina={pagina}
        porPagina={POR_PAGINA_ASSINATURAS}
        quantidade={q.data?.assinaturas.length ?? 0}
        total={q.data?.total}
        carregando={q.isFetching}
        onPagina={setPagina}
      />

      {q.data && (
        <>
          <NovaAssinatura
            aberto={nova}
            onFechar={() => setNova(false)}
            contas={q.data.contas}
            planos={q.data.planos}
          />
          <FaturaAvulsa aberto={fatura} onFechar={() => setFatura(false)} contas={q.data.contas} />
        </>
      )}
      <CancelarAssinatura assinatura={cancelando} onFechar={() => setCancelando(null)} />
    </section>
  );
}

function useRecarregar() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["plataforma-assinaturas"] });
    qc.invalidateQueries({ queryKey: ["plataforma-receita"] });
    qc.invalidateQueries({ queryKey: ["plataforma-licencas"] });
  };
}

function NovaAssinatura({
  aberto,
  onFechar,
  contas,
  planos,
}: {
  aberto: boolean;
  onFechar: () => void;
  contas: { id: string; nome: string; tipo: string }[];
  planos: {
    id: string;
    nome: string;
    publico: string;
    preco_mensal: number;
    preco_anual: number | null;
  }[];
}) {
  const criarFn = useServerFn(criarAssinaturaPlataforma);
  const recarregar = useRecarregar();
  const [conta, setConta] = useState("");
  const [plano, setPlano] = useState("");
  const [ciclo, setCiclo] = useState<"mensal" | "trimestral" | "anual">("mensal");
  const [valor, setValor] = useState("");
  const [usuarios, setUsuarios] = useState("1");
  const tipoConta = contas.find((c) => c.id === conta)?.tipo;
  const planosDaConta = useMemo(
    () => planos.filter((p) => !tipoConta || p.publico === tipoConta || p.publico === "todos"),
    [planos, tipoConta],
  );
  // Sugere o preço do catálogo; o valor cobrado pode ser negociado.
  function sugerir(idPlano: string, c: typeof ciclo) {
    const p = planos.find((x) => x.id === idPlano);
    if (!p) return;
    const v =
      c === "anual"
        ? (p.preco_anual ?? p.preco_mensal * 12)
        : c === "trimestral"
          ? p.preco_mensal * 3
          : p.preco_mensal;
    setValor(String(v.toFixed(2)).replace(".", ","));
  }
  const criar = useMutation({
    mutationFn: () => {
      const v = numero(valor);
      if (!(v > 0)) throw new Error("Informe o valor cobrado.");
      return criarFn({
        data: {
          tenantId: conta,
          planoId: plano,
          ciclo,
          valor: v,
          quantidadeUsuarios: Math.max(1, Math.trunc(Number(usuarios) || 1)),
        },
      });
    },
    onSuccess: () => {
      toast.success("Assinatura criada, conta ativada e primeira fatura emitida.");
      recarregar();
      onFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível criar a assinatura.")),
  });

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova assinatura</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Select
            value={conta}
            onValueChange={(v) => {
              setConta(v);
              setPlano("");
            }}
          >
            <SelectTrigger aria-label="Conta">
              <SelectValue placeholder="Escolha a conta" />
            </SelectTrigger>
            <SelectContent>
              {contas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              value={plano}
              onValueChange={(v) => {
                setPlano(v);
                sugerir(v, ciclo);
              }}
            >
              <SelectTrigger aria-label="Plano">
                <SelectValue placeholder="Plano" />
              </SelectTrigger>
              <SelectContent>
                {planosDaConta.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} · {formatBRL(p.preco_mensal)}/mês
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={ciclo}
              onValueChange={(v) => {
                setCiclo(v as typeof ciclo);
                sugerir(plano, v as typeof ciclo);
              }}
            >
              <SelectTrigger aria-label="Ciclo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="trimestral">Trimestral</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-1">
              <Label htmlFor="ass-valor">Valor cobrado por ciclo (R$)</Label>
              <Input
                id="ass-valor"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ass-usuarios">Usuários</Label>
              <Input
                id="ass-usuarios"
                inputMode="numeric"
                value={usuarios}
                onChange={(e) => setUsuarios(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            A assinatura anterior da conta é encerrada, a primeira fatura sai hoje e a conta deixa o
            teste.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            onClick={() => criar.mutate()}
            disabled={criar.isPending || !conta || !plano || !valor.trim()}
          >
            Criar assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FaturaAvulsa({
  aberto,
  onFechar,
  contas,
}: {
  aberto: boolean;
  onFechar: () => void;
  contas: { id: string; nome: string; tipo: string }[];
}) {
  const emitirFn = useServerFn(emitirFaturaAvulsa);
  const recarregar = useRecarregar();
  const [conta, setConta] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(() => somarMesesISO(hojeISO(), 0));
  const emitir = useMutation({
    mutationFn: () => {
      const v = numero(valor);
      if (!(v > 0)) throw new Error("Valor inválido.");
      return emitirFn({ data: { tenantId: conta, descricao, valor: v, vencimento } });
    },
    onSuccess: () => {
      toast.success("Fatura emitida.");
      setDescricao("");
      setValor("");
      recarregar();
      onFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível emitir a fatura.")),
  });
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fatura avulsa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={conta} onValueChange={setConta}>
            <SelectTrigger aria-label="Conta da fatura">
              <SelectValue placeholder="Escolha a conta" />
            </SelectTrigger>
            <SelectContent>
              {contas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-1">
            <Label htmlFor="fat-desc">Descrição</Label>
            <Input
              id="fat-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Treinamento da equipe"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="fat-valor">Valor (R$)</Label>
              <Input
                id="fat-valor"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fat-venc">Vencimento</Label>
              <Input
                id="fat-venc"
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            onClick={() => emitir.mutate()}
            disabled={
              emitir.isPending ||
              !conta ||
              descricao.trim().length < 3 ||
              !valor.trim() ||
              !vencimento
            }
          >
            Emitir fatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelarAssinatura({
  assinatura,
  onFechar,
}: {
  assinatura: AssinaturaPlataforma | null;
  onFechar: () => void;
}) {
  const cancelarFn = useServerFn(cancelarAssinaturaPlataforma);
  const recarregar = useRecarregar();
  const [motivo, setMotivo] = useState("");
  const cancelar = useMutation({
    mutationFn: () => cancelarFn({ data: { id: assinatura!.id, motivo } }),
    onSuccess: () => {
      toast.success("Assinatura cancelada.");
      setMotivo("");
      recarregar();
      onFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível cancelar.")),
  });
  return (
    <Dialog open={!!assinatura} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar assinatura de {assinatura?.conta}?</DialogTitle>
        </DialogHeader>
        <Textarea
          aria-label="Motivo do cancelamento"
          rows={3}
          placeholder="Motivo (fica registrado)"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={() => cancelar.mutate()}
            disabled={cancelar.isPending || motivo.trim().length < 5}
          >
            Cancelar assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
