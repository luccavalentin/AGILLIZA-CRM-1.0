import { useState } from "react";
import { mensagemDeErro } from "@/lib/erros/mensagem";
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
      toast.error(mensagemDeErro(e, "Falha ao incluir."));
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
        {/* Conversa: o que sai daqui fica à direita, com quem escreveu; o que
            vem da integração fica à esquerda, em nome dela. */}
        <div className="flex flex-col gap-3">
          {followups.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum comentário.</p>
          )}
          {[...followups]
            .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
            .map((f) => {
              const nosso = f.tipo !== "banco";
              const autor = nosso
                ? `Agilliza · ${f.autor_nome ?? "operador"}`
                : "HomeFin · integração";
              return (
                <div
                  key={f.id}
                  className={`flex ${nosso ? "justify-end" : "justify-start"} w-full`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg border p-3 ${
                      nosso ? "border-primary/20 bg-primary/[0.06]" : "border-border bg-muted/40"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{autor}</span>
                      {nosso && (
                        <ToneBadge tone={f.tipo === "externo" ? "info" : "muted"}>
                          {f.tipo === "externo" ? "enviado à HomeFin" : "interno"}
                        </ToneBadge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(f.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {f.titulo && <p className="mt-1 font-medium text-foreground">{f.titulo}</p>}
                    <p className="text-sm text-muted-foreground">{f.comentario}</p>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
