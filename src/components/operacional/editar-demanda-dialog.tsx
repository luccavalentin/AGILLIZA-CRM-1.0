import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { editarDemanda } from "@/lib/operacional/demandas.functions";

type Prioridade = "p1" | "p2" | "p3";

export function EditarDemandaDialog({
  demanda,
  onSalva,
  trigger,
  abertoOverride,
  onOpenChangeOverride,
}: {
  demanda: {
    id: string;
    titulo: string;
    descricao: string | null;
    prioridade: Prioridade;
    sla_horas: number | null;
  };
  onSalva: () => void;
  trigger?: ReactNode;
  abertoOverride?: boolean;
  onOpenChangeOverride?: (open: boolean) => void;
}) {

  const [abertoInterno, setAbertoInterno] = useState(false);
  const aberto = abertoOverride ?? abertoInterno;
  const setAberto = onOpenChangeOverride ?? setAbertoInterno;
  const [titulo, setTitulo] = useState(demanda.titulo);
  const [descricao, setDescricao] = useState(demanda.descricao ?? "");
  const [prioridade, setPrioridade] = useState<Prioridade>(demanda.prioridade);
  const [reconfSla, setReconfSla] = useState(false);
  const [slaHoras, setSlaHoras] = useState<string>(
    demanda.sla_horas != null ? String(demanda.sla_horas) : "",
  );
  const [salvando, setSalvando] = useState(false);
  const editarFn = useServerFn(editarDemanda);

  function abrir(o: boolean) {
    if (o) {
      setTitulo(demanda.titulo);
      setDescricao(demanda.descricao ?? "");
      setPrioridade(demanda.prioridade);
      setSlaHoras(demanda.sla_horas != null ? String(demanda.sla_horas) : "");
      setReconfSla(false);
    }
    setAberto(o);
  }

  async function salvar() {
    if (titulo.trim().length < 2) return toast.error("Informe um título válido.");
    const horas = Number(slaHoras);
    if (reconfSla && (!Number.isFinite(horas) || horas <= 0)) {
      return toast.error("Informe as horas de SLA.");
    }
    setSalvando(true);
    try {
      await editarFn({
        data: {
          id: demanda.id,
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          prioridade,
          ...(reconfSla ? { sla_horas: horas } : {}),
        },
      });
      toast.success("Demanda atualizada.");
      setAberto(false);
      onSalva();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={abrir}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar demanda</DialogTitle>
          <DialogDescription>
            Atualize as informações e, se necessário, reconfigure o prazo (SLA).
          </DialogDescription>
        </DialogHeader>
        <div className="brand-scroll scroll-shadow-bottom flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Prioridade</Label>
            <Select value={prioridade} onValueChange={(v) => setPrioridade(v as Prioridade)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="p1">Alta (P1)</SelectItem>
                <SelectItem value="p2">Média (P2)</SelectItem>
                <SelectItem value="p3">Baixa (P3)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={reconfSla}
                onChange={(e) => setReconfSla(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Reconfigurar prazo (SLA)
            </label>
            {reconfSla && (
              <div className="mt-3 space-y-1.5">
                <Label>Horas úteis para conclusão</Label>
                <Input
                  type="number"
                  min={1}
                  value={slaHoras || ""}
                  onChange={(e) => setSlaHoras(e.target.value)}
                  placeholder="Ex.: 8"
                />
                <p className="text-xs text-muted-foreground">
                  O prazo será recalculado a partir de agora, considerando apenas horas úteis.
                </p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setAberto(false)}>
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
