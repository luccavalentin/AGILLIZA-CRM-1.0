import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, Check } from "lucide-react";
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
import { adicionarParticipantesDemanda } from "@/lib/operacional/demandas.functions";
import { listarColegas } from "@/lib/operacional/shared.functions";
import { cn } from "@/lib/utils";

/**
 * Dialog para adicionar novos participantes (co-observadores) a uma demanda,
 * consultando colegas do mesmo ecossistema e permitindo seleção múltipla.
 * Ignora participantes já vinculados via `jaParticipantes`.
 */
export function AdicionarParticipanteDialog({
  demandaId,
  jaParticipantes,
  onAdicionado,
  trigger,
}: {
  demandaId: string;
  jaParticipantes: string[];
  onAdicionado: () => void;
  trigger?: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const adicionarFn = useServerFn(adicionarParticipantesDemanda);

  const { data: colegas } = useQuery({
    queryKey: ["colegas"],
    queryFn: () => listarColegas(),
    enabled: aberto,
  });

  const jaSet = new Set(jaParticipantes);
  const filtrados = (colegas ?? []).filter((c) => {
    if (jaSet.has(c.id)) return false;
    if (!busca.trim()) return true;
    const t = busca.toLowerCase();
    return (c.nome ?? "").toLowerCase().includes(t) || (c.email ?? "").toLowerCase().includes(t);
  });

  function toggle(id: string) {
    setSelecionados((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  async function salvar() {
    const ids = [...selecionados];
    if (!ids.length) return toast.error("Selecione ao menos um colega.");
    setSalvando(true);
    try {
      await adicionarFn({ data: { id: demandaId, user_ids: ids } });
      toast.success("Participante(s) adicionado(s).");
      setAberto(false);
      setSelecionados(new Set());
      setBusca("");
      onAdicionado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao adicionar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <UserPlus className="mr-1 h-3.5 w-3.5" /> Adicionar participante
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar participante</DialogTitle>
          <DialogDescription>
            Convide colegas para acompanhar esta demanda. Eles recebem notificações e podem
            interagir no chat.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Buscar por nome ou e-mail…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <div className="max-h-72 overflow-y-auto rounded-md border border-border/60 bg-background">
            {filtrados.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">
                Nenhum colega disponível.
              </p>
            ) : (
              filtrados.map((c) => {
                const marcado = selecionados.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 border-b border-border/40 px-3 py-2 text-left text-sm last:border-b-0 transition-colors hover:bg-accent/40",
                      marcado && "bg-primary/10",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{c.nome ?? c.email}</p>
                      {c.email && (
                        <p className="truncate text-[11px] text-muted-foreground">{c.email}</p>
                      )}
                    </div>
                    {marcado && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                );
              })
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">{selecionados.size} selecionado(s)</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || selecionados.size === 0}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
