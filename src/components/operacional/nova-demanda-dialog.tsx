import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { criarDemanda } from "@/lib/operacional/demandas.functions";
import { listarColegas, buscarClientesOpcoes } from "@/lib/operacional/shared.functions";

const TIPOS = [
  { v: "analise_documento", l: "Análise de documento" },
  { v: "correcao", l: "Correção" },
  { v: "reenvio_simulacao", l: "Reenvio de simulação" },
  { v: "renovacao", l: "Renovação" },
  { v: "geral", l: "Geral" },
];

export function NovaDemandaDialog({ onCriada }: { onCriada: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState("geral");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<"p1" | "p2" | "p3">("p2");
  const [responsavel, setResponsavel] = useState("");
  const [cliente, setCliente] = useState("");
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

  async function salvar() {
    if (titulo.trim().length < 2) return toast.error("Informe um título.");
    if (!responsavel) return toast.error("Selecione o responsável.");
    setSalvando(true);
    try {
      await criarFn({
        data: {
          tipo,
          titulo,
          descricao: descricao || undefined,
          prioridade,
          responsavel_id: responsavel,
          cliente_id: cliente || undefined,
        },
      });
      toast.success("Demanda enviada.");
      setAberto(false);
      setTitulo("");
      setDescricao("");
      setResponsavel("");
      setCliente("");
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
          <Plus className="mr-1 h-4 w-4" /> Nova demanda
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar demanda</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.v} value={t.v}>
                      {t.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Analisar documento X"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Responsável (destinatário)</Label>
              <Select value={responsavel} onValueChange={setResponsavel}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
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
              <Label>Cliente-alvo (opcional)</Label>
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
          <p className="text-xs text-muted-foreground">
            O prazo (SLA) é calculado automaticamente em horas úteis conforme o tipo e a prioridade.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            Enviar demanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
