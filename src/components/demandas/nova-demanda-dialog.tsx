import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Shuffle, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { usePermissao } from "@/hooks/use-permissao";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { configDemandas, criarDemandaNaFila } from "@/lib/operacional/demandas-central.functions";
import {
  listarPropostasOpcoes,
  listarSimulacoesOpcoes,
} from "@/lib/operacional/demandas.functions";
import { buscarClientesOpcoes, listarColegas } from "@/lib/operacional/shared.functions";
import { listarContasDaFila } from "@/lib/plataforma/fila.functions";
import { ROTULO_PRIORIDADE_DEMANDA, type DemandaPrioridade } from "@/lib/operacional/demandas-regras";
import { TipoIcone } from "./pecas";

const NENHUM = "__nenhum__";

/**
 * Nova demanda. O padrão é "distribuir automaticamente": o banco escolhe o analista da
 * conta ou a pessoa certa da fila justa (e grava o porquê). Escolher alguém é exceção.
 */
export function NovaDemandaDialog({
  onCriada,
  clienteInicial,
  gatilho,
}: {
  onCriada?: (id: string) => void;
  clienteInicial?: { id: string; nome: string | null } | null;
  gatilho?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<string>("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<DemandaPrioridade>("p2");
  const [modo, setModo] = useState<"auto" | "pessoa">("auto");
  const [responsavel, setResponsavel] = useState<string>("");
  const [fila, setFila] = useState<string>(NENHUM);
  const [conta, setConta] = useState<string>(NENHUM);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [cliente, setCliente] = useState<{ id: string; nome: string | null } | null>(clienteInicial ?? null);
  const [proposta, setProposta] = useState<string>(NENHUM);
  const [simulacao, setSimulacao] = useState<string>(NENHUM);
  const [salvando, setSalvando] = useState(false);

  const criar = useServerFn(criarDemandaNaFila);
  const podeVerAssinantes = usePermissao("saas.fila", "view");

  const { data: cfg } = useQuery({
    queryKey: ["demandas-config"],
    queryFn: () => configDemandas(),
    enabled: aberto,
    staleTime: 60_000,
  });
  const { data: colegas } = useQuery({
    queryKey: ["colegas"],
    queryFn: () => listarColegas(),
    enabled: aberto,
    staleTime: 5 * 60_000,
  });
  const { data: contas } = useQuery({
    queryKey: ["fila-assinantes-contas"],
    queryFn: () => listarContasDaFila(),
    enabled: aberto && podeVerAssinantes,
    staleTime: 10 * 60_000,
  });
  const { data: clientes } = useQuery({
    queryKey: ["demanda-clientes", buscaCliente],
    queryFn: () => buscarClientesOpcoes({ data: { q: buscaCliente || undefined } }),
    enabled: aberto && !cliente,
    staleTime: 30_000,
  });
  const { data: propostas } = useQuery({
    queryKey: ["demanda-propostas", cliente?.id],
    queryFn: () => listarPropostasOpcoes({ data: { cliente_id: cliente!.id } }),
    enabled: aberto && !!cliente,
  });
  const { data: simulacoes } = useQuery({
    queryKey: ["demanda-simulacoes", cliente?.id],
    queryFn: () => listarSimulacoesOpcoes({ data: { cliente_id: cliente!.id } }),
    enabled: aberto && !!cliente,
  });

  const tiposAtivos = useMemo(() => (cfg?.tipos ?? []).filter((t) => t.ativo), [cfg]);
  const filasAtivas = useMemo(() => (cfg?.filas ?? []).filter((f) => f.ativa), [cfg]);
  const tipoSel = tiposAtivos.find((t) => t.codigo === tipo);

  useEffect(() => {
    if (!tipo && tiposAtivos.length) setTipo(tiposAtivos[0].codigo);
  }, [tipo, tiposAtivos]);

  function limpar() {
    setTitulo("");
    setDescricao("");
    setPrioridade("p2");
    setModo("auto");
    setResponsavel("");
    setFila(NENHUM);
    setConta(NENHUM);
    setCliente(clienteInicial ?? null);
    setProposta(NENHUM);
    setSimulacao(NENHUM);
  }

  async function salvar() {
    if (titulo.trim().length < 2) {
      toast.error("Dê um título à demanda.");
      return;
    }
    if (modo === "pessoa" && !responsavel) {
      toast.error("Escolha o responsável ou deixe a distribuição automática.");
      return;
    }
    setSalvando(true);
    try {
      const { id } = await criar({
        data: {
          tipo,
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          prioridade,
          responsavel_id: modo === "pessoa" ? responsavel : null,
          fila_id: modo === "auto" && fila !== NENHUM ? fila : null,
          conta_id: conta !== NENHUM ? conta : null,
          cliente_id: cliente?.id ?? null,
          proposta_id: proposta !== NENHUM ? proposta : null,
          simulacao_id: simulacao !== NENHUM ? simulacao : null,
        },
      });
      toast.success("Demanda criada.");
      setAberto(false);
      limpar();
      onCriada?.(id);
      navigate({ to: "/operacional/demandas/$id", params: { id } });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível criar a demanda."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (!v) limpar();
      }}
    >
      <DialogTrigger asChild>
        {gatilho ?? (
          <Button className="h-10 rounded-xl px-4 font-semibold shadow-[0_10px_22px_-12px_rgba(0,15,159,0.85)]">
            <Plus className="mr-1.5 h-4 w-4" /> Nova demanda
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova demanda</DialogTitle>
          <DialogDescription>
            Delegue uma consulta, simulação, proposta ou documentação. A distribuição escolhe quem atende.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label className="mb-2 block text-xs font-semibold text-muted-foreground">Tipo</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {tiposAtivos.map((t) => (
                <button
                  key={t.codigo}
                  type="button"
                  onClick={() => setTipo(t.codigo)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[12.5px] font-medium transition",
                    tipo === t.codigo
                      ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary/20"
                      : "border-border/70 bg-card text-foreground/80 hover:border-primary/40",
                  )}
                >
                  <TipoIcone tipo={t.codigo} tamanho="sm" />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate">{t.nome}</span>
                    <span className="block text-[10.5px] font-normal text-muted-foreground">
                      prazo {String(t.sla_horas).replace(".", ",")}h úteis
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <Label htmlFor="dem-titulo" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Título
              </Label>
              <Input
                id="dem-titulo"
                value={titulo}
                maxLength={160}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder={tipoSel ? `${tipoSel.nome} — cliente ou assunto` : "Assunto"}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Prioridade</Label>
              <div className="inline-flex h-10 rounded-xl border border-border/70 bg-muted/40 p-1">
                {(["p1", "p2", "p3"] as DemandaPrioridade[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrioridade(p)}
                    className={cn(
                      "rounded-lg px-3 text-[12px] font-semibold transition",
                      prioridade === p
                        ? p === "p1"
                          ? "bg-destructive text-white shadow"
                          : "bg-card text-foreground shadow"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {ROTULO_PRIORIDADE_DEMANDA[p]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="dem-desc" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              O que precisa ser feito
            </Label>
            <Textarea
              id="dem-desc"
              value={descricao}
              maxLength={4000}
              rows={3}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes, documentos que faltam, prazos do cliente…"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Cliente (opcional)</Label>
              {cliente ? (
                <div className="flex h-10 items-center justify-between gap-2 rounded-xl border border-border/70 bg-card px-3 text-sm">
                  <span className="truncate">{cliente.nome ?? "Cliente"}</span>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => {
                      setCliente(null);
                      setProposta(NENHUM);
                      setSimulacao(NENHUM);
                    }}
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Input
                    value={buscaCliente}
                    onChange={(e) => setBuscaCliente(e.target.value)}
                    placeholder="Buscar por nome ou número"
                  />
                  {buscaCliente.trim().length > 1 && (clientes ?? []).length > 0 && (
                    <div className="max-h-36 overflow-y-auto rounded-xl border border-border/70 bg-card p-1">
                      {(clientes ?? []).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCliente({ id: c.id, nome: c.nome })}
                          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[12.5px] hover:bg-accent"
                        >
                          <span className="truncate">{c.nome}</span>
                          <span className="text-[10.5px] text-muted-foreground">{c.numero_cliente}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {podeVerAssinantes && (
              <div>
                <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                  Pedido de uma conta do Agilliza Tech
                </Label>
                <Select value={conta} onValueChange={setConta}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Interno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUM}>Interno (equipe do Agilliza)</SelectItem>
                    {(contas ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {cliente && ((propostas ?? []).length > 0 || (simulacoes ?? []).length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Proposta</Label>
                <Select value={proposta} onValueChange={setProposta}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUM}>Nenhuma</SelectItem>
                    {(propostas ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.numero ?? "Proposta"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Simulação</Label>
                <Select value={simulacao} onValueChange={setSimulacao}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUM}>Nenhuma</SelectItem>
                    {(simulacoes ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.numero ?? "Simulação"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModo("auto")}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[12.5px] transition",
                  modo === "auto" ? "border-primary bg-card ring-2 ring-primary/20" : "border-transparent hover:bg-card/70",
                )}
              >
                <Shuffle className="size-4 text-primary" />
                <span>
                  <span className="block font-semibold">Distribuir automaticamente</span>
                  <span className="block text-[10.5px] text-muted-foreground">Analista da conta ou fila justa</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setModo("pessoa")}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[12.5px] transition",
                  modo === "pessoa" ? "border-primary bg-card ring-2 ring-primary/20" : "border-transparent hover:bg-card/70",
                )}
              >
                <UserRoundCheck className="size-4 text-primary" />
                <span>
                  <span className="block font-semibold">Escolher a pessoa</span>
                  <span className="block text-[10.5px] text-muted-foreground">Delegar direto</span>
                </span>
              </button>
            </div>
            <div className="mt-3">
              {modo === "auto" ? (
                <Select value={fila} onValueChange={setFila}>
                  <SelectTrigger className="h-10 rounded-xl bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUM}>Fila pelo tipo e pela origem (recomendado)</SelectItem>
                    {filasAtivas.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        Fila: {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={responsavel} onValueChange={setResponsavel}>
                  <SelectTrigger className="h-10 rounded-xl bg-card">
                    <SelectValue placeholder="Escolha o responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {(colegas ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome ?? c.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setAberto(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || !tipo} className="font-semibold">
            {salvando ? "Criando…" : "Criar demanda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
