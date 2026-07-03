import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToneBadge } from "@/components/crm/tone-badge";
import { PRIORIDADE, statusTarefa } from "@/components/operacional/status";
import {
  obterTarefa, toggleChecklistItem, comentarTarefa, concluirTarefa,
} from "@/lib/operacional/tarefas.functions";

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function TarefaDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [comentario, setComentario] = useState("");
  const toggleFn = useServerFn(toggleChecklistItem);
  const comentarFn = useServerFn(comentarTarefa);
  const concluirFn = useServerFn(concluirTarefa);

  const { data } = useQuery({
    queryKey: ["tarefa", id],
    queryFn: () => obterTarefa({ data: { id: id! } }),
    enabled: !!id,
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["tarefa", id] });
    qc.invalidateQueries({ queryKey: ["tarefas"] });
  }

  const t = data?.tarefa;

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {t && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">{t.numero}</span>
                <ToneBadge tone={statusTarefa(t.status).tone}>{statusTarefa(t.status).label}</ToneBadge>
                <ToneBadge tone="muted">{PRIORIDADE[t.prioridade as "p1"].label}</ToneBadge>
              </div>
              <SheetTitle className="text-left">{t.titulo}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-6">
              {t.descricao && <p className="text-sm text-foreground whitespace-pre-wrap">{t.descricao}</p>}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Responsável:</span> {data?.nome_responsavel ?? "—"}</div>
                <div><span className="text-muted-foreground">Prazo:</span> {fmtData(t.prazo)}</div>
                {t.clientes?.nome && (
                  <div className="col-span-2"><span className="text-muted-foreground">Cliente:</span> {t.clientes.nome}</div>
                )}
              </div>

              {t.status !== "concluida" && (
                <Button
                  size="sm"
                  onClick={async () => { await concluirFn({ data: { id: t.id } }); invalidar(); toast.success("Tarefa concluída."); }}
                >
                  Concluir tarefa
                </Button>
              )}

              {(data?.checklist ?? []).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Checklist</h3>
                  {data!.checklist.map((it: any) => (
                    <label key={it.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={it.concluido}
                        onCheckedChange={async (v) => {
                          await toggleFn({ data: { id: it.id, concluido: !!v } });
                          invalidar();
                        }}
                      />
                      <span className={it.concluido ? "text-muted-foreground line-through" : "text-foreground"}>{it.descricao}</span>
                    </label>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Comentários</h3>
                <div className="space-y-2">
                  {(data?.comentarios ?? []).map((c: any) => (
                    <div key={c.id} className="rounded-md bg-muted p-2 text-sm">
                      <div className="mb-0.5 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{c.nome_autor ?? "—"}</span>
                        <span>{fmtData(c.created_at)}</span>
                      </div>
                      <p className="text-foreground whitespace-pre-wrap">{c.corpo}</p>
                    </div>
                  ))}
                </div>
                <Textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} placeholder="Escreva um comentário…" />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!comentario.trim()}
                  onClick={async () => {
                    await comentarFn({ data: { task_id: t.id, corpo: comentario } });
                    setComentario("");
                    invalidar();
                  }}
                >
                  Comentar
                </Button>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Histórico</h3>
                {(data?.historico ?? []).map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{h.acao}{h.detalhe ? ` — ${h.detalhe}` : ""}</span>
                    <span>{fmtData(h.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
