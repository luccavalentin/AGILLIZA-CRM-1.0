import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Paperclip, Download, Trash2, Tag as TagIcon, X, Calendar, User, Building2, CheckCircle2, MessageSquare, ListChecks, History, ChevronDown, ChevronUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import brandSymbol from "@/assets/brand/agilliza-symbol-oficial.png";
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
  excluirComentarioTarefa,
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
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [visualizando, setVisualizando] = useState<{ url: string; nome: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleFn = useServerFn(toggleChecklistItem);
  const comentarFn = useServerFn(comentarTarefa);
  const excluirComentarioFn = useServerFn(excluirComentarioTarefa);
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
    <Dialog open={!!id} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92dvh] overflow-hidden p-0 sm:p-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-30 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow ring-1 ring-border/60 backdrop-blur transition hover:bg-background hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
        {t && (
          <div className="relative">
            {/* Marca d'água centralizada */}
            <img
              src={brandSymbol}
              alt=""
              aria-hidden
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 z-0 w-[65%] max-w-[520px] -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.045] dark:opacity-[0.08]"
            />

            {/* Cabeçalho refinado */}
            <div className="relative z-10 border-b border-border/60 bg-gradient-to-br from-primary/[0.08] via-primary/[0.03] to-transparent px-6 py-5 sm:px-8 sm:py-6">
              <DialogHeader className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-background/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground ring-1 ring-border/60 tabular-nums backdrop-blur">
                    {t.numero}
                  </span>
                  <ToneBadge tone={statusTarefa(t.status).tone}>
                    {statusTarefa(t.status).label}
                  </ToneBadge>
                  <ToneBadge tone="muted">{PRIORIDADE[t.prioridade as "p1"].label}</ToneBadge>
                </div>
                <DialogTitle className="text-left text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-2xl">
                  {t.titulo}
                </DialogTitle>
                {t.descricao && (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {t.descricao}
                  </p>
                )}
              </DialogHeader>
            </div>

            {/* Corpo com scroll */}
            <div className="relative z-10 max-h-[calc(92dvh-9rem)] overflow-y-auto px-6 py-6 sm:px-8">
              <div className="space-y-6">
                {/* Metadados */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-3 py-2.5 text-sm backdrop-blur">
                    <User className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Responsável</p>
                      <p className="truncate text-foreground">{data?.nome_responsavel ?? "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-3 py-2.5 text-sm backdrop-blur">
                    <Calendar className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Prazo</p>
                      <p className="truncate text-foreground tabular-nums">{fmtData(t.prazo)}</p>
                    </div>
                  </div>
                  {t.clientes?.nome && (
                    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-3 py-2.5 text-sm backdrop-blur sm:col-span-2">
                      <Building2 className="h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cliente</p>
                        <p className="truncate text-foreground">{t.clientes.nome}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Etiquetas */}
                <section className="space-y-2.5 rounded-xl border border-border/60 bg-card/70 p-4 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <TagIcon className="h-4 w-4 text-primary" /> Etiquetas
                    </h3>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                          <Plus className="h-3.5 w-3.5" /> Gerenciar
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
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white shadow-sm"
                          style={{ backgroundColor: tg.cor }}
                        >
                          {tg.nome}
                          <button
                            type="button"
                            onClick={() => toggleTag(tg.id, false)}
                            aria-label="Remover etiqueta"
                            className="opacity-80 hover:opacity-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </section>

                {t.status !== "concluida" && (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={async () => {
                      await concluirFn({ data: { id: t.id } });
                      invalidar();
                      toast.success("Tarefa concluída.");
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Concluir tarefa
                  </Button>
                )}

                {(data?.checklist ?? []).length > 0 && (
                  <section className="space-y-2 rounded-xl border border-border/60 bg-card/70 p-4 backdrop-blur">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <ListChecks className="h-4 w-4 text-primary" /> Checklist
                    </h3>
                    <div className="space-y-1.5">
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
                  </section>
                )}

                {/* Anexos */}
                <section className="space-y-2.5 rounded-xl border border-border/60 bg-card/70 p-4 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <Paperclip className="h-4 w-4 text-primary" /> Anexos
                    </h3>
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
                          className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 text-sm transition hover:border-border hover:bg-background"
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
                </section>

                {/* Comentários */}
                <section className="space-y-3 rounded-xl border-2 border-primary/30 bg-primary/[0.04] p-4 shadow-sm ring-1 ring-primary/10 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <MessageSquare className="h-4 w-4 text-primary" /> Comentários
                    </h3>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary tabular-nums">
                      {(data?.comentarios ?? []).length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(data?.comentarios ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum comentário ainda. Seja o primeiro a comentar.</p>
                    ) : (
                      data!.comentarios.map((c: any) => (
                        <div
                          key={c.id}
                          className="rounded-lg border border-border/60 bg-background p-3 text-sm shadow-sm ring-1 ring-primary/5 border-l-4 border-l-primary"
                        >
                          <div className="mb-1.5 flex items-center justify-between text-xs">
                            <span className="font-semibold text-foreground">{c.nome_autor ?? "—"}</span>
                            <span className="text-muted-foreground tabular-nums">{fmtData(c.created_at)}</span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed text-foreground">{c.corpo}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <Textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    rows={2}
                    placeholder="Escreva um comentário…"
                    className="bg-background"
                  />
                  <Button
                    size="sm"
                    disabled={!comentario.trim()}
                    onClick={async () => {
                      await comentarFn({ data: { task_id: t.id, corpo: comentario } });
                      setComentario("");
                      invalidar();
                    }}
                  >
                    Comentar
                  </Button>
                </section>

                {/* Histórico */}
                {(data?.historico ?? []).length > 0 && (
                  <section className="rounded-xl border border-border/60 bg-card/70 backdrop-blur">
                    <button
                      type="button"
                      onClick={() => setHistoricoAberto((v) => !v)}
                      className="flex w-full items-center justify-between gap-2 p-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 rounded-xl"
                      aria-expanded={historicoAberto}
                    >
                      <span className="flex items-center gap-1.5">
                        <History className="h-4 w-4 text-primary" /> Histórico
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({data!.historico.length})
                        </span>
                      </span>
                      {historicoAberto ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    {historicoAberto && (
                      <div className="space-y-1 px-4 pb-4">
                        {data!.historico.map((h: any) => (
                          <div
                            key={h.id}
                            className="flex items-center justify-between border-b border-border/40 py-1 text-xs text-muted-foreground last:border-b-0"
                          >
                            <span>
                              {h.acao}
                              {h.detalhe ? ` — ${h.detalhe}` : ""}
                            </span>
                            <span className="tabular-nums">{fmtData(h.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
      <VisualizadorArquivo
        arquivo={visualizando}
        open={!!visualizando}
        onOpenChange={(o: boolean) => !o && setVisualizando(null)}
      />
    </Dialog>
  );
}
