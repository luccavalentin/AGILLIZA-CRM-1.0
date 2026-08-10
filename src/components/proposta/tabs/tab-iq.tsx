import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { salvarIq } from "@/lib/propostas/propostas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function TabIq({ proposta, propostaId }: { proposta: any; propostaId: string }) {
  const qc = useQueryClient();
  const salvarFn = useServerFn(salvarIq);
  const [nome, setNome] = useState(proposta.iq_nome ?? "");
  const [comentario, setComentario] = useState(proposta.iq_comentario ?? "");

  async function salvar() {
    try {
      await salvarFn({
        data: { proposta_id: propostaId, iq_nome: nome, iq_comentario: comentario },
      });
      toast.success("Dados do interveniente salvos.");
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Dados do interveniente quitante
      </p>
      <div>
        <Label>Nome</Label>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div>
        <Label>Comentário sobre o processo</Label>
        <Textarea
          value={comentario}
          maxLength={2000}
          rows={5}
          onChange={(e) => setComentario(e.target.value)}
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">{comentario.length}/2000</p>
      </div>
      <div className="flex justify-end">
        <Button onClick={salvar}>Salvar</Button>
      </div>
    </div>
  );
}
