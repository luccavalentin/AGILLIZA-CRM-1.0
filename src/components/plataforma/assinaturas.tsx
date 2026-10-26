import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ban, FilePlus2, Plus, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { usePermissao } from "@/hooks/use-permissao";
import {
  Avatar,
  BarraFiltros,
  CampoBusca,
  EstadoErro,
  EstadoVazio,
  ListaCarregando,
  Selo,
  type Tom,
} from "@/components/plataforma/kit";
import { Dinheiro, TIPO_CONTA } from "@/components/plataforma/receita/comum";
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
function situacao(a: AssinaturaPlataforma): { rotulo: string; tom: Tom } {
  // Licença por pacote (0253): em dia, vencida (carência) ou bloqueada.
  if (a.licenca) {
    if (a.status === "ativa") return { rotulo: "Em dia", tom: "sucesso" };
    if (a.status === "vencida") return { rotulo: "Vencida", tom: "alerta" };
    return { rotulo: "Bloqueada", tom: "perigo" };
  }
  if (a.cancelada_em || a.status === "cancelada") return { rotulo: "Cancelada", tom: "neutro" };
  if (a.status === "encerrada") return { rotulo: "Encerrada", tom: "neutro" };
  if (a.status === "inadimplente") return { rotulo: "Inadimplente", tom: "perigo" };
  if (a.status === "trial") return { rotulo: "Em teste", tom: "info" };
  return { rotulo: "Ativa", tom: "sucesso" };
}

/** "1.234,50" ou "1234.5" → número; inválido → NaN. */
function numero(v: string): number {
  const t = v.trim();
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
}

const tipoConta = (t: string) => TIPO_CONTA[t] ?? "Corretor";

/** Assinaturas e licenças por pacote dos assinantes (lista com busca e cancelar). */
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
  const [cancelando, setCancelando] = useState<AssinaturaPlataforma | null>(null);
  const itens = q.data?.assinaturas ?? [];

  const valor = (a: AssinaturaPlataforma) => (
    <>
      <span className="font-medium">
        <Dinheiro valor={a.valor} />
      </span>
      <span className="text-xs text-muted-foreground">/{CICLO[a.ciclo] ?? a.ciclo}</span>
      {(MESES[a.ciclo] ?? 1) > 1 && (
        <span className="block text-xs text-muted-foreground">{formatBRL(a.mrr)}/mês</span>
      )}
    </>
  );
  const plano = (a: AssinaturaPlataforma) => (
    <>
      <span className="text-foreground">{a.plano ?? "Sem plano"}</span>
      <span className="block text-xs text-muted-foreground">
        {a.licenca
          ? `Licença ${NOME_PERIODO[a.ciclo]?.toLowerCase() ?? a.ciclo}`
          : "Assinatura recorrente"}
      </span>
    </>
  );
  const cancelar = (a: AssinaturaPlataforma) =>
    pode && !a.cancelada_em && !a.licenca ? (
      <Button
        size="sm"
        variant="ghost"
        className="min-h-11 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:min-h-8"
        onClick={() => setCancelando(a)}
      >
        <Ban className="mr-1.5 size-4" /> Cancelar
      </Button>
    ) : null;

  return (
    <div className="space-y-3">
      <BarraFiltros className="md:justify-between">
        <p className="text-sm text-muted-foreground">
          Assinaturas recorrentes e licenças por pacote, vigentes primeiro.
        </p>
        <CampoBusca
          rotulo="Buscar assinatura pela conta"
          placeholder="Buscar pela conta"
          valor={busca}
          onChange={(v) => {
            setBusca(v);
            setPagina(1);
          }}
        />
      </BarraFiltros>
      <div className="overflow-hidden rounded-[14px] border border-border/80 bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]">
        {q.isLoading ? (
          <ListaCarregando />
        ) : q.isError ? (
          <EstadoErro
            mensagem={mensagemDeErro(q.error, "Não foi possível carregar as assinaturas.")}
            onTentar={() => q.refetch()}
          />
        ) : itens.length === 0 ? (
          <EstadoVazio
            icone={<Repeat />}
            titulo={termo ? "Nenhuma assinatura com esta busca" : "Nenhuma assinatura ainda"}
            descricao={termo ? undefined : "Crie a primeira em “Nova assinatura”, no topo da tela."}
          />
        ) : (
          <>
            <table className="hidden w-full text-sm lg:table">
              <thead>
                <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Conta</th>
                  <th className="px-3 py-2.5 font-medium">Plano</th>
                  <th className="px-3 py-2.5 text-right font-medium">Valor</th>
                  <th className="hidden px-3 py-2.5 font-medium xl:table-cell">Próxima cobrança</th>
                  <th className="px-3 py-2.5 font-medium">Situação</th>
                  <th className="w-[1%] px-4 py-2.5">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {itens.map((a) => {
                  const s = situacao(a);
                  return (
                    <tr key={a.id} className="hover:bg-primary/[0.02]">
                      <td className="max-w-[16rem] px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar nome={a.conta} tamanho="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{a.conta}</p>
                            <p className="text-xs text-muted-foreground">
                              {tipoConta(a.conta_tipo)}
                              {a.quantidade_usuarios
                                ? ` · ${a.quantidade_usuarios} ${a.quantidade_usuarios === 1 ? "usuário" : "usuários"}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">{plano(a)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">{valor(a)}</td>
                      <td className="hidden whitespace-nowrap px-3 py-2.5 xl:table-cell">
                        {a.proxima_cobranca_em ? formatData(a.proxima_cobranca_em) : "—"}
                        {a.licenca && a.proxima_cobranca_em && (
                          <span className="block text-xs text-muted-foreground">fim do acesso</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Selo tom={s.tom} ponto={s.tom === "perigo"}>
                          {s.rotulo}
                        </Selo>
                      </td>
                      <td className="px-4 py-2.5 text-right">{cancelar(a)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ul className="divide-y divide-border/60 lg:hidden">
              {itens.map((a) => {
                const s = situacao(a);
                return (
                  <li key={a.id} className="space-y-2 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{a.conta}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {tipoConta(a.conta_tipo)} · {a.plano ?? "sem plano"}
                        </p>
                      </div>
                      <p className="shrink-0 text-right">{valor(a)}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Selo tom={s.tom}>{s.rotulo}</Selo>
                        {a.proxima_cobranca_em
                          ? `${a.licenca ? "acesso até" : "próxima"} ${formatData(a.proxima_cobranca_em)}`
                          : ""}
                      </div>
                      {cancelar(a)}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <RodapePaginas
          pagina={pagina}
          porPagina={POR_PAGINA_ASSINATURAS}
          quantidade={itens.length}
          total={q.data?.total}
          carregando={q.isFetching}
          onPagina={setPagina}
        />
      </div>
      <CancelarAssinatura assinatura={cancelando} onFechar={() => setCancelando(null)} />
    </div>
  );
}

/**
 * Ações do topo da Receita: fatura avulsa e nova assinatura. As listas de contas e planos
 * vêm da mesma consulta das assinaturas, só quando um dos diálogos abre.
 */
export function AcoesReceita() {
  const pode = usePermissao("saas.receita", "edit");
  const listarFn = useServerFn(listarAssinaturas);
  const [nova, setNova] = useState(false);
  const [fatura, setFatura] = useState(false);
  const q = useQuery({
    queryKey: ["plataforma-assinaturas", "", 1],
    queryFn: () => listarFn({ data: { busca: null, pagina: 1 } }),
    enabled: pode && (nova || fatura),
    staleTime: 60_000,
  });
  if (!pode) return null;
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="min-h-11 sm:min-h-9"
        onClick={() => setFatura(true)}
      >
        <FilePlus2 className="mr-1.5 size-4" /> Fatura avulsa
      </Button>
      <Button size="sm" className="min-h-11 sm:min-h-9" onClick={() => setNova(true)}>
        <Plus className="mr-1.5 size-4" /> Nova assinatura
      </Button>
      <NovaAssinatura
        aberto={nova}
        onFechar={() => setNova(false)}
        contas={q.data?.contas ?? []}
        planos={q.data?.planos ?? []}
        carregando={q.isLoading}
      />
      <FaturaAvulsa
        aberto={fatura}
        onFechar={() => setFatura(false)}
        contas={q.data?.contas ?? []}
        carregando={q.isLoading}
      />
    </>
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
  carregando,
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
  carregando?: boolean;
}) {
  const criarFn = useServerFn(criarAssinaturaPlataforma);
  const recarregar = useRecarregar();
  const [conta, setConta] = useState("");
  const [plano, setPlano] = useState("");
  const [ciclo, setCiclo] = useState<"mensal" | "trimestral" | "anual">("mensal");
  const [valor, setValor] = useState("");
  const [usuarios, setUsuarios] = useState("1");
  const tipoDaConta = contas.find((c) => c.id === conta)?.tipo;
  const planosDaConta = useMemo(
    () =>
      planos.filter((p) => !tipoDaConta || p.publico === tipoDaConta || p.publico === "todos"),
    [planos, tipoDaConta],
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova assinatura</DialogTitle>
          <DialogDescription>
            A assinatura anterior da conta é encerrada, a primeira fatura sai hoje e a conta deixa o
            teste.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="ass-conta">Conta</Label>
            <Select
              value={conta}
              onValueChange={(v) => {
                setConta(v);
                setPlano("");
              }}
              disabled={carregando}
            >
              <SelectTrigger id="ass-conta">
                <SelectValue placeholder={carregando ? "Carregando contas…" : "Escolha a conta"} />
              </SelectTrigger>
              <SelectContent>
                {contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} · {TIPO_CONTA[c.tipo] ?? c.tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ass-plano">Plano</Label>
            <Select
              value={plano}
              onValueChange={(v) => {
                setPlano(v);
                sugerir(v, ciclo);
              }}
            >
              <SelectTrigger id="ass-plano">
                <SelectValue placeholder="Escolha o plano" />
              </SelectTrigger>
              <SelectContent>
                {planosDaConta.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} · {formatBRL(p.preco_mensal)}/mês
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ass-ciclo">Ciclo</Label>
            <Select
              value={ciclo}
              onValueChange={(v) => {
                setCiclo(v as typeof ciclo);
                sugerir(plano, v as typeof ciclo);
              }}
            >
              <SelectTrigger id="ass-ciclo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="trimestral">Trimestral</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ass-valor">Valor por ciclo</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                R$
              </span>
              <Input
                id="ass-valor"
                inputMode="decimal"
                className="pl-9 tabular-nums"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">Sugerido pelo catálogo; pode negociar.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ass-usuarios">Usuários</Label>
            <Input
              id="ass-usuarios"
              inputMode="numeric"
              className="w-24"
              value={usuarios}
              onChange={(e) => setUsuarios(e.target.value)}
            />
          </div>
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
  carregando,
}: {
  aberto: boolean;
  onFechar: () => void;
  contas: { id: string; nome: string; tipo: string }[];
  carregando?: boolean;
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fatura avulsa</DialogTitle>
          <DialogDescription>
            Serviço extra, ajuste ou cobrança combinada. Entra na fila de cobrança da conta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="fat-conta">Conta</Label>
            <Select value={conta} onValueChange={setConta} disabled={carregando}>
              <SelectTrigger id="fat-conta">
                <SelectValue placeholder={carregando ? "Carregando contas…" : "Escolha a conta"} />
              </SelectTrigger>
              <SelectContent>
                {contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} · {TIPO_CONTA[c.tipo] ?? c.tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
              <Label htmlFor="fat-valor">Valor</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  id="fat-valor"
                  inputMode="decimal"
                  className="pl-9 tabular-nums"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                />
              </div>
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
          <DialogDescription>
            Para de faturar a partir de agora. O motivo fica registrado no histórico da conta.
          </DialogDescription>
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
