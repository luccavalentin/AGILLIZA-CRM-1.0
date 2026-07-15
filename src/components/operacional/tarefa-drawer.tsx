import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Paperclip, Download, Trash2, Tag as TagIcon, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { VisualizadorArquivo } from "@/components/comum/visualizador-arquivo";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToneBadge } from "@/components/crm/tone-badge";
import { PRIORIDADE, statusTarefa } from "@/components/operacional/status";
import { supabase } from "@/integrations/supabase/client";
import {
  obterTarefa,
  toggleChecklistItem,
  comentarTarefa,
  concluirTarefa,
  listarTagsTarefa,
  criarTagTarefa,
  alternarTagTarefa,
  registrarAnexoTarefa,
  removerAnexoTarefa,
  urlAnexoTarefa,
} from "@/lib/operacional/tarefas.functions";

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo",  
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTamanho(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const CORES = ["#64748b", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];

export function TarefaDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [comentario, setComentario] = useState("");
  const [novaTag, setNovaTag] = useState("");
  const [corTag, setCorTag] = useState(CORES[0]);
  const [enviando, setEnviando] = useState(false);
  const [visualizando, setVisualizando] = useState<{ url: string; nome: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleFn = useServerFn(toggleChecklistItem);
  const comentarFn = useServerFn(comentarTarefa);
  const concluirFn = useServerFn(concluirTarefa);
  const criarTagFn = useServerFn(criarTagTarefa);
  const alternarTagFn = useServerFn(alternarTagTarefa);
  const registrarAnexoFn = useServerFn(registrarAnexoTarefa);
  const removerAnexoFn = useServerFn(removerAnexoTarefa);
  const urlAnexoFn = useServerFn(urlAnexoTarefa);

  const { data } = useQuery({
    queryKey: ["tarefa", id],
    queryFn: () => obterTarefa({ data: { id: id! } }),
    enabled: !!id,
  });

  const { data: todasTags } = useQuery({
    queryKey: ["tarefa-tags"],
    queryFn: () => listarTagsTarefa(),
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["tarefa", id] });
    qc.invalidateQueries({ queryKey: ["tarefas"] });
  }

  const t = data?.tarefa;
  const tagsAtuais = data?.tags ?? [];
  const tagIds = new Set(tagsAtuais.map((tg: any) => tg.id));

  async function toggleTag(tagId: string, vincular: boolean) {
    if (!t) return;
    await alternarTagFn({ data: { task_id: t.id, tag_id: tagId, vincular } });
    qc.invalidateQueries({ queryKey: ["tarefa", id] });
  }

  async function handleCriarTag() {
    if (novaTag.trim().length < 1 || !t) return;
    try {
      const tag = await criarTagFn({ data: { nome: novaTag.trim(), cor: corTag } });
      setNovaTag("");
      await alternarTagFn({ data: { task_id: t.id, tag_id: tag.id, vincular: true } });
      qc.invalidateQueries({ queryKey: ["tarefa-tags"] });
      qc.invalidateQueries({ queryKey: ["tarefa", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar etiqueta.");
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !t) return;
    setEnviando(true);
    try {
      const path = `${t.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("tarefa-anexos").upload(path, file);
      if (error) throw error;
      await registrarAnexoFn({
        data: { task_id: t.id, nome: file.name, storage_path: path, tamanho: file.size },
      });
      invalidar();
      toast.success("Anexo enviado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload.");
    } finally {
      setEnviando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function baixarAnexo(storage_path: string, nome: string) {
    try {
      const { url } = await urlAnexoFn({ data: { storage_path } });
      setVisualizando({ url, nome });
    } catch {
      toast.error("Falha ao gerar link do anexo.");
    }
  }

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {t && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">{t.numero}</span>
                <ToneBadge tone={statusTarefa(t.status).tone}>
                  {statusTarefa(t.status).label}
                </ToneBadge>
                <ToneBadge tone="muted">{PRIORIDADE[t.prioridade as "p1"].label}</ToneBadge>
              </div>
              <SheetTitle className="text-left">{t.titulo}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-6">
              {t.descricao && (
                <p className="text-sm text-foreground whitespace-pre-wrap">{t.descricao}</p>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Responsável:</span>{" "}
                  {data?.nome_responsavel ?? "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Prazo:</span> {fmtData(t.prazo)}
                </div>
                {t.clientes?.nome && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Cliente:</span> {t.clientes.nome}
                  </div>
                )}
              </div>

              {/* Etiquetas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Etiquetas</h3>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                        <TagIcon className="h-3.5 w-3.5" /> Gerenciar
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 space-y-3">
                      <div className="space-y-1">
                        {(todasTags ?? []).map((tg: any) => (
                          <label key={tg.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={tagIds.has(tg.id)}
                              onCheckedChange={(v) => toggleTag(tg.id, !!v)}
                            />
                            <span
                              className="inline-block h-3 w-3 rounded-full"
                              style={{ backgroundColor: tg.cor }}
                            />
                            <span className="text-foreground">{tg.nome}</span>
                          </label>
                        ))}
                        {(todasTags ?? []).length === 0 && (
                          <p className="text-xs text-muted-foreground">Nenhuma etiqueta ainda.</p>
                        )}
                      </div>
                      <div className="space-y-2 border-t border-border pt-2">
                        <Input
                          value={novaTag}
                          onChange={(e) => setNovaTag(e.target.value)}
                          placeholder="Nova etiqueta"
                          className="h-8 text-sm"
                        />
                        <div className="flex items-center gap-1.5">
                          {CORES.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setCorTag(c)}
                              className={`h-5 w-5 rounded-full ring-offset-2 ring-offset-background ${corTag === c ? "ring-2 ring-ring" : ""}`}
                              style={{ backgroundColor: c }}
                              aria-label={`Cor ${c}`}
                            />
                          ))}
                        </div>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={handleCriarTag}
                          disabled={!novaTag.trim()}
                        >
                          <Plus className="mr-1 h-4 w-4" /> Criar e aplicar
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tagsAtuais.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Sem etiquetas.</span>
                  ) : (
                    tagsAtuais.map((tg: any) => (
                      <span
                        key={tg.id}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-white"
                        style={{ backgroundColor: tg.cor }}
                      >
                        {tg.nome}
                        <button
                          type="button"
                          onClick={() => toggleTag(tg.id, false)}
                          aria-label="Remover etiqueta"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {t.status !== "concluida" && (
                <Button
                  size="sm"
                  onClick={async () => {
                    await concluirFn({ data: { id: t.id } });
                    invalidar();
                    toast.success("Tarefa concluída.");
                  }}
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
                      <span
                        className={
                          it.concluido ? "text-muted-foreground line-through" : "text-foreground"
                        }
                      >
                        {it.descricao}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* Anexos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Anexos</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    disabled={enviando}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Paperclip className="h-3.5 w-3.5" /> {enviando ? "Enviando…" : "Anexar"}
                  </Button>
                  <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
                </div>
                <div className="space-y-1.5">
                  {(data?.anexos ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum anexo.</p>
                  ) : (
                    data!.anexos.map((a: any) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                      >
                        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-foreground">{a.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.nome_autor ?? "—"} · {fmtTamanho(a.tamanho)} ·{" "}
                            {fmtData(a.created_at)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => baixarAnexo(a.storage_path, a.nome)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={async () => {
                            await removerAnexoFn({ data: { id: a.id } });
                            invalidar();
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

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
                <Textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={2}
                  placeholder="Escreva um comentário…"
                />
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
                  <div
                    key={h.id}
                    className="flex items-center justify-between text-xs text-muted-foreground"
                  >
                    <span>
                      {h.acao}
                      {h.detalhe ? ` — ${h.detalhe}` : ""}
                    </span>
                    <span>{fmtData(h.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </SheetContent>
      <VisualizadorArquivo
        arquivo={visualizando}
        open={!!visualizando}
        onOpenChange={(o: boolean) => !o && setVisualizando(null)}
      />
    </Sheet>
  );
}
