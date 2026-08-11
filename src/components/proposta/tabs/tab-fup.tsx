import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adicionarFollowup } from "@/lib/propostas/propostas.functions";
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
import { ToneBadge } from "@/components/crm/tone-badge";

export function TabFup({ propostaId, followups }: { propostaId: string; followups: any[] }) {
  const qc = useQueryClient();
  const addFn = useServerFn(adicionarFollowup);
  const [tipo, setTipo] = useState<"interno" | "externo">("interno");
  const [titulo, setTitulo] = useState("");
  const [comentario, setComentario] = useState("");
  const [busy, setBusy] = useState(false);

  async function incluir() {
    if (comentario.trim().length === 0) {
      toast.error("Escreva um comentário.");
      return;
    }
    setBusy(true);
    try {
      await addFn({
        data: { proposta_id: propostaId, tipo, titulo: titulo || undefined, comentario },
      });
      setTitulo("");
      setComentario("");
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao incluir.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Incluir comentário
        </p>
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="interno">Interno</SelectItem>
              <SelectItem value="externo">Externo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Título</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div>
          <Label>Comentário</Label>
          <Textarea
            value={comentario}
            maxLength={4000}
            rows={4}
            onChange={(e) => setComentario(e.target.value)}
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">{comentario.length}/4000</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={incluir} disabled={busy}>
            Incluir comentário
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Histórico de comentários
        </p>
        <div className="space-y-3">
          {followups.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum comentário.</p>
          )}
          {followups.map((f) => {
            const rotulo =
              f.tipo === "banco" ? "Banco" : f.tipo === "externo" ? "Externo" : "Interno";
            const tone = f.tipo === "banco" ? "success" : f.tipo === "externo" ? "info" : "muted";
            return (
              <div key={f.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <ToneBadge tone={tone as any}>{rotulo}</ToneBadge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(f.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                {f.titulo && <p className="mt-2 font-medium text-foreground">{f.titulo}</p>}
                <p className="text-sm text-muted-foreground">{f.comentario}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
