import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Check, ChevronsUpDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  criarDemanda,
  listarPropostasOpcoes,
  listarSimulacoesOpcoes,
} from "@/lib/operacional/demandas.functions";
import { listarColegas, buscarClientesOpcoes } from "@/lib/operacional/shared.functions";

interface OpcaoId {
  id: string;
  label: string;
}

function ComboSelect({
  value,
  onValueChange,
  options,
  placeholder,
  emptyText,
  disabled,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: OpcaoId[];
  placeholder: string;
  emptyText: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selecionado = options.find((o) => o.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selecionado && "text-muted-foreground",
          )}
        >
          <span className="truncate">{selecionado ? selecionado.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar…" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__nenhum__"
                onSelect={() => {
                  onValueChange("");
                  setOpen(false);
                }}
              >
                <Check className={cn("h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground">Sem vínculo</span>
              </CommandItem>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.label}
                  onSelect={() => {
                    onValueChange(o.id === value ? "" : o.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Diálogo enxuto de nova demanda: título, descrição, prioridade, responsável e vínculos
 * opcionais (cliente / proposta / simulação). Sem anexos, sem tipos — o foco é abrir a
 * conversa com quem receberá a demanda.
 */
export function NovaDemandaDialog({
  onCriada,
  trigger,
  clienteInicial,
  propostaInicial,
  simulacaoInicial,
}: {
  onCriada: (id?: string) => void;
  trigger?: React.ReactNode;
  clienteInicial?: string;
  propostaInicial?: string;
  simulacaoInicial?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<"p1" | "p2" | "p3">("p2");
  const [responsavel, setResponsavel] = useState("");
  const [cliente, setCliente] = useState(clienteInicial ?? "");
  const [proposta, setProposta] = useState(propostaInicial ?? "");
  const [simulacao, setSimulacao] = useState(simulacaoInicial ?? "");
  const [salvando, setSalvando] = useState(false);
  const criarFn = useServerFn(criarDemanda);

  const { data: colegas } = useQuery({
    queryKey: ["colegas"],
    queryFn: () => listarColegas(),
    enabled: aberto,
  });
  const { data: clientes } = useQuery({
    queryKey: ["clientes-opcoes"],
    queryFn: () => buscarClientesOpcoes({ data: {} }),
    enabled: aberto,
  });
  const { data: propostas } = useQuery({
    queryKey: ["propostas-opcoes", cliente],
    queryFn: () => listarPropostasOpcoes({ data: cliente ? { cliente_id: cliente } : {} }),
    enabled: aberto,
  });
  const { data: simulacoes } = useQuery({
    queryKey: ["simulacoes-opcoes", cliente],
    queryFn: () => listarSimulacoesOpcoes({ data: cliente ? { cliente_id: cliente } : {} }),
    enabled: aberto,
  });

  // Ao trocar de cliente, invalida vínculos que ficaram inconsistentes.
  useEffect(() => {
    if (!cliente) return;
    setProposta((p) => (p && !propostas?.some((x) => x.id === p) ? "" : p));
    setSimulacao((s) => (s && !simulacoes?.some((x) => x.id === s) ? "" : s));
  }, [cliente, propostas, simulacoes]);

  function limpar() {
    setTitulo("");
    setDescricao("");
    setPrioridade("p2");
    setResponsavel("");
    setCliente(clienteInicial ?? "");
    setProposta(propostaInicial ?? "");
    setSimulacao(simulacaoInicial ?? "");
  }

  async function salvar() {
    if (!titulo.trim()) return toast.error("Informe um título.");
    if (!responsavel) return toast.error("Escolha um responsável.");
    setSalvando(true);
    try {
      const nova = await criarFn({
        data: {
          tipo: "diversos",
          titulo: titulo.trim(),
          descricao: descricao.trim() || undefined,
          prioridade,
          responsavel_id: responsavel,
          cliente_id: cliente || null,
          proposta_id: proposta || null,
          simulacao_id: simulacao || null,
        },
      });
      toast.success("Demanda criada.");
      setAberto(false);
      limpar();
      onCriada(nova.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar demanda.");
    } finally {
      setSalvando(false);
    }
  }

  const optColegas: OpcaoId[] = (colegas ?? []).map((c) => ({
    id: c.id,
    label: c.nome ?? c.email ?? c.id,
  }));
  const optClientes: OpcaoId[] = (clientes ?? []).map((c) => ({
    id: c.id,
    label: c.numero_cliente ? `${c.numero_cliente} · ${c.nome ?? "—"}` : (c.nome ?? c.id),
  }));
  const optPropostas: OpcaoId[] = (propostas ?? []).map((p) => ({
    id: p.id,
    label: `${p.numero ?? "PRO-—"}${p.nome_cliente ? ` · ${p.nome_cliente}` : ""}`,
  }));
  const optSimulacoes: OpcaoId[] = (simulacoes ?? []).map((s) => ({
    id: s.id,
    label: `${s.numero ?? "SIM-—"}${s.nome_cliente ? ` · ${s.nome_cliente}` : ""}`,
  }));

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova demanda
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova demanda</DialogTitle>
          <DialogDescription>
            Envie uma demanda para um colega e converse em tempo real.
          </DialogDescription>
        </DialogHeader>

        <div className="brand-scroll scroll-shadow-bottom flex-1 space-y-3 overflow-y-auto px-6 py-4">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Revisar documentos de renda"
              maxLength={140}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o que precisa ser feito…"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as "p1" | "p2" | "p3")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="p1">P1 · Urgente</SelectItem>
                  <SelectItem value="p2">P2 · Normal</SelectItem>
                  <SelectItem value="p3">P3 · Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <ComboSelect
                value={responsavel}
                onValueChange={setResponsavel}
                options={optColegas}
                placeholder="Selecionar…"
                emptyText="Sem colegas."
              />
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Vínculos (opcional)
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Cliente</Label>
              <ComboSelect
                value={cliente}
                onValueChange={setCliente}
                options={optClientes}
                placeholder="Vincular cliente…"
                emptyText="Nenhum cliente."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Proposta</Label>
                <ComboSelect
                  value={proposta}
                  onValueChange={setProposta}
                  options={optPropostas}
                  placeholder="Vincular…"
                  emptyText="Nenhuma proposta."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Simulação</Label>
                <ComboSelect
                  value={simulacao}
                  onValueChange={setSimulacao}
                  options={optSimulacoes}
                  placeholder="Vincular…"
                  emptyText="Nenhuma simulação."
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setAberto(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Criando…" : "Criar demanda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
