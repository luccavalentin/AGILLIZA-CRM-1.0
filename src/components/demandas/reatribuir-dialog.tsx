import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listarColegas } from "@/lib/operacional/shared.functions";
import { reatribuirDemanda } from "@/lib/operacional/demandas-central.functions";
import { motivoValido } from "@/lib/operacional/demandas-regras";

const FILA = "__fila__";

/** Reatribuir para alguém (ou devolver à fila) — sempre com o motivo, que vai ao histórico. */
export function ReatribuirDialog({
  demandaId,
  responsavelAtual,
  aberto,
  onAberto,
  onFeito,
}: {
  demandaId: string;
  responsavelAtual: string | null;
  aberto: boolean;
  onAberto: (v: boolean) => void;
  onFeito?: () => void;
}) {
  const [para, setPara] = useState<string>("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const fn = useServerFn(reatribuirDemanda);
  const { data: colegas } = useQuery({
    queryKey: ["colegas"],
    queryFn: () => listarColegas(),
    enabled: aberto,
    staleTime: 5 * 60_000,
  });

  async function salvar() {
    if (!para) {
      toast.error("Escolha para quem vai a demanda.");
      return;
    }
    if (!motivoValido(motivo)) {
      toast.error("Explique o motivo (de 5 a 500 letras).");
      return;
    }
    setSalvando(true);
    try {
      const r = await fn({ data: { id: demandaId, para: para === FILA ? null : para, motivo: motivo.trim() } });
      if (para === FILA) {
        toast.success(
          r.responsavel_id ? "Devolvida à fila: a distribuição já escolheu outra pessoa." : "Devolvida à fila: aguardando alguém disponível.",
        );
      } else {
        toast.success("Demanda reatribuída.");
      }
      onAberto(false);
      setPara("");
      setMotivo("");
      onFeito?.();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível reatribuir."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={onAberto}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reatribuir demanda</DialogTitle>
          <DialogDescription>O motivo fica no histórico da demanda e quem recebe é avisado.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Para</Label>
            <Select value={para} onValueChange={setPara}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                {responsavelAtual && <SelectItem value={FILA}>Devolver à fila (a distribuição escolhe)</SelectItem>}
                {(colegas ?? [])
                  .filter((c) => c.id !== responsavelAtual)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome ?? c.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="reat-motivo" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Motivo
            </Label>
            <Textarea
              id="reat-motivo"
              rows={3}
              maxLength={500}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: cliente já é atendido por ela; férias; sobrecarga…"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onAberto(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando} className="font-semibold">
            {salvando ? "Salvando…" : "Reatribuir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
