import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { criarTarefa } from "@/lib/operacional/tarefas.functions";
import { listarColegas, buscarClientesOpcoes } from "@/lib/operacional/shared.functions";

export function NovaTarefaDialog({
  onCriada,
  clientePreSelecionado,
  trigger,
}: {
  onCriada: () => void;
  clientePreSelecionado?: string;
  trigger?: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<"p1" | "p2" | "p3">("p2");
  const [prazo, setPrazo] = useState("");
  const [responsavel, setResponsavel] = useState<string>("");
  const [cliente, setCliente] = useState<string>(clientePreSelecionado ?? "");
  const [checklist, setChecklist] = useState<string[]>([]);
  const [novoItem, setNovoItem] = useState("");
  const [salvando, setSalvando] = useState(false);
  const criarFn = useServerFn(criarTarefa);

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

  async function salvar() {
    if (titulo.trim().length < 2) return toast.error("Informe um título.");
    setSalvando(true);
    try {
      await criarFn({
        data: {
          titulo,
          descricao: descricao || undefined,
          prioridade,
          prazo: prazo ? new Date(prazo).toISOString() : undefined,
          responsavel_id: responsavel || undefined,
          cliente_id: cliente || undefined,
          checklist: checklist.length ? checklist : undefined,
        },
      });
      toast.success("Tarefa criada.");
      setAberto(false);
      setTitulo("");
      setDescricao("");
      setPrazo("");
      setResponsavel("");
      setCliente("");
      setChecklist([]);
      onCriada();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> Nova tarefa
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Ligar para cliente"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="p1">P1 — Alta</SelectItem>
                  <SelectItem value="p2">P2 — Média</SelectItem>
                  <SelectItem value="p3">P3 — Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prazo</Label>
              <Input
                type="datetime-local"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select value={responsavel} onValueChange={setResponsavel}>
                <SelectTrigger>
                  <SelectValue placeholder="Eu" />
                </SelectTrigger>
                <SelectContent>
                  {(colegas ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome ?? c.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cliente (opcional)</Label>
              <Select value={cliente} onValueChange={setCliente}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  {(clientes ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome ?? c.numero_cliente}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Checklist</Label>
            <div className="flex gap-2">
              <Input
                value={novoItem}
                onChange={(e) => setNovoItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && novoItem.trim()) {
                    e.preventDefault();
                    setChecklist((l) => [...l, novoItem.trim()]);
                    setNovoItem("");
                  }
                }}
                placeholder="Adicionar item e Enter"
              />
            </div>
            {checklist.length > 0 && (
              <ul className="mt-2 space-y-1">
                {checklist.map((it, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-md bg-muted px-2 py-1 text-sm"
                  >
                    <span>{it}</span>
                    <button
                      type="button"
                      onClick={() => setChecklist((l) => l.filter((_, j) => j !== i))}
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            Criar tarefa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
