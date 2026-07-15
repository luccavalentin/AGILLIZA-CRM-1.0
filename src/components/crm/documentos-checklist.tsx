import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Upload, Loader2, CircleDashed, Trash2, Plus, Pencil, X, GripVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  getChecklistDados,
  salvarChecklist,
  listarDocumentos,
  anexarDocumento,
} from "@/lib/crm/clientes.functions";
import { TIPOS_DOCUMENTO_POR_CATEGORIA } from "@/lib/crm/documento-tipos";

const T = TIPOS_DOCUMENTO_POR_CATEGORIA;

type Categoria = "comprador" | "conjuge" | "vendedor" | "vendedor_conjuge" | "imovel" | "outros";

interface ItemChecklist {
  id: string;
  label: string;
  feito: boolean;
}
interface GrupoChecklist {
  id: string;
  titulo: string;
  itens: ItemChecklist[];
}

const filled = (v: unknown) => typeof v === "string" && v.trim().length > 0;


function AutoItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-sm">
      {ok ? (
        <Check className="size-4 shrink-0 text-success" />
      ) : (
        <CircleDashed className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      {!ok && <span className="text-xs text-muted-foreground">(preencher no cadastro)</span>}
    </div>
  );
}

function AdicionarItem({ onAdd }: { onAdd: (label: string) => void }) {
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  function confirmar() {
    const v = texto.trim();
    if (!v) return;
    onAdd(v);
    setTexto("");
    setAberto(false);
  }
  if (!aberto) {
    return (
      <div className="pt-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setAberto(true)}>
          <Plus className="size-4" /> Adicionar item
        </Button>
      </div>
    );
  }
  return (
    <div className="mt-2 flex items-center gap-2">
      <Input
        autoFocus
        value={texto}
        placeholder="Novo item do checklist…"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirmar();
          } else if (e.key === "Escape") {
            setAberto(false);
            setTexto("");
          }
        }}
        className="h-9"
      />
      <Button type="button" size="sm" onClick={confirmar}>
        <Plus className="size-4" /> Incluir
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          setAberto(false);
          setTexto("");
        }}
      >
        Cancelar
      </Button>
    </div>
  );
}

// ============= Checklists personalizados (configuráveis + drag & drop) =============

interface ChecklistsCfgProps {
  grupos: GrupoChecklist[];
  addGrupo: (t: string) => void;
  renameGrupo: (id: string, t: string) => void;
  removeGrupo: (id: string) => void;
  addItem: (grupoId: string, label: string) => void;
  toggleItem: (grupoId: string, itemId: string, feito: boolean) => void;
  renameItem: (grupoId: string, itemId: string, label: string) => void;
  removeItem: (grupoId: string, itemId: string) => void;
  moverGrupo: (fromId: string, toId: string) => void;
  moverItem: (
    origem: { grupoId: string; itemId: string },
    destino: { grupoId: string; itemId?: string },
  ) => void;
}

function ChecklistsPersonalizados(props: ChecklistsCfgProps) {
  const { grupos } = props;
  const [novoGrupo, setNovoGrupo] = useState("");
  const [criando, setCriando] = useState(false);
  const drag = useRef<
    | { tipo: "grupo"; grupoId: string }
    | { tipo: "item"; grupoId: string; itemId: string }
    | null
  >(null);
  const [alvo, setAlvo] = useState<string | null>(null);

  function criarGrupo() {
    props.addGrupo(novoGrupo);
    setNovoGrupo("");
    setCriando(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">Checklists personalizados</h3>
          <p className="text-xs text-muted-foreground">
            Crie listas próprias para este cliente. Arraste para reordenar e mover itens entre listas.
          </p>
        </div>
        {!criando ? (
          <Button size="sm" onClick={() => setCriando(true)}>
            <Plus className="size-4" /> Nova checklist
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={novoGrupo}
              placeholder="Título da checklist…"
              onChange={(e) => setNovoGrupo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  criarGrupo();
                } else if (e.key === "Escape") {
                  setCriando(false);
                  setNovoGrupo("");
                }
              }}
              className="h-9 w-56"
            />
            <Button size="sm" onClick={criarGrupo}>
              <Plus className="size-4" /> Criar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCriando(false)}>
              Cancelar
            </Button>
          </div>
        )}
      </div>

      {grupos.length === 0 && !criando && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma checklist personalizada ainda. Crie a primeira para organizar os documentos
            deste cliente do seu jeito.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {grupos.map((g) => {
          const total = g.itens.length;
          const feitos = g.itens.filter((it) => it.feito).length;
          const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;
          return (
            <Card
              key={g.id}
              className={`transition-shadow ${alvo === `grupo:${g.id}` ? "ring-2 ring-primary/50" : ""}`}
              onDragOver={(e) => {
                if (drag.current?.tipo === "grupo") {
                  e.preventDefault();
                  setAlvo(`grupo:${g.id}`);
                }
              }}
              onDrop={(e) => {
                if (drag.current?.tipo === "grupo") {
                  e.preventDefault();
                  props.moverGrupo(drag.current.grupoId, g.id);
                }
                drag.current = null;
                setAlvo(null);
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    draggable
                    onDragStart={() => (drag.current = { tipo: "grupo", grupoId: g.id })}
                    onDragEnd={() => {
                      drag.current = null;
                      setAlvo(null);
                    }}
                    className="mt-0.5 cursor-grab text-muted-foreground active:cursor-grabbing"
                    title="Arrastar checklist"
                    aria-label="Arrastar checklist"
                  >
                    <GripVertical className="size-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <TituloGrupo
                      titulo={g.titulo}
                      onRename={(t) => props.renameGrupo(g.id, t)}
                    />
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">
                        {feitos}/{total}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => props.removeGrupo(g.id)}
                    aria-label="Excluir checklist"
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent
                className="space-y-1"
                onDragOver={(e) => {
                  if (drag.current?.tipo === "item") e.preventDefault();
                }}
                onDrop={(e) => {
                  if (drag.current?.tipo === "item") {
                    e.preventDefault();
                    props.moverItem(
                      { grupoId: drag.current.grupoId, itemId: drag.current.itemId },
                      { grupoId: g.id },
                    );
                  }
                  drag.current = null;
                  setAlvo(null);
                }}
              >
                <div className="pb-2">
                  <AdicionarItem onAdd={(l) => props.addItem(g.id, l)} />
                </div>
                {g.itens.length === 0 && (
                  <p className="py-2 text-xs text-muted-foreground">
                    Sem itens. Use "Adicionar item" acima para incluir documentos ou tarefas.
                  </p>
                )}
                {g.itens.map((it) => (
                  <ItemGrupo
                    key={it.id}
                    item={it}
                    destaque={alvo === `item:${it.id}`}
                    onToggle={(v) => props.toggleItem(g.id, it.id, v)}
                    onRename={(t) => props.renameItem(g.id, it.id, t)}
                    onRemove={() => props.removeItem(g.id, it.id)}
                    onDragStart={() =>
                      (drag.current = { tipo: "item", grupoId: g.id, itemId: it.id })
                    }
                    onDragEnd={() => {
                      drag.current = null;
                      setAlvo(null);
                    }}
                    onDragOver={(e) => {
                      if (drag.current?.tipo === "item") {
                        e.preventDefault();
                        setAlvo(`item:${it.id}`);
                      }
                    }}
                    onDrop={(e) => {
                      if (drag.current?.tipo === "item") {
                        e.preventDefault();
                        e.stopPropagation();
                        props.moverItem(
                          { grupoId: drag.current.grupoId, itemId: drag.current.itemId },
                          { grupoId: g.id, itemId: it.id },
                        );
                      }
                      drag.current = null;
                      setAlvo(null);
                    }}
                  />
                ))}
              </CardContent>

            </Card>
          );
        })}
      </div>
    </div>
  );
}

function TituloGrupo({ titulo, onRename }: { titulo: string; onRename: (t: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(titulo);
  if (editando) {
    return (
      <Input
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => {
          setEditando(false);
          onRename(texto);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            setEditando(false);
            onRename(texto);
          } else if (e.key === "Escape") {
            setEditando(false);
            setTexto(titulo);
          }
        }}
        className="h-8"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setTexto(titulo);
        setEditando(true);
      }}
      className="group inline-flex items-center gap-1.5 text-left"
      title="Renomear checklist"
    >
      <span className="text-sm font-semibold text-foreground">{titulo}</span>
      <Pencil className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function ItemGrupo({
  item,
  destaque,
  onToggle,
  onRename,
  onRemove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  item: ItemChecklist;
  destaque?: boolean;
  onToggle: (v: boolean) => void;
  onRename: (t: string) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(item.label);
  return (
    <div
      draggable={!editando}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
        destaque ? "border-primary/60 bg-primary/5" : "border-transparent hover:border-border/60 hover:bg-muted/40"
      }`}
    >
      <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground/60 active:cursor-grabbing" />
      <Checkbox checked={item.feito} onCheckedChange={(v) => onToggle(v === true)} />
      {editando ? (
        <Input
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => {
            setEditando(false);
            onRename(texto);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setEditando(false);
              onRename(texto);
            } else if (e.key === "Escape") {
              setEditando(false);
              setTexto(item.label);
            }
          }}
          className="h-7 flex-1"
        />
      ) : (
        <span
          className={`flex-1 text-sm ${item.feito ? "text-muted-foreground line-through" : "text-foreground"}`}
        >
          {item.label}
        </span>
      )}
      {!editando && (
        <button
          type="button"
          onClick={() => {
            setTexto(item.label);
            setEditando(true);
          }}
          aria-label="Editar item"
          className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
        >
          <Pencil className="size-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remover item"
        className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}


export function DocumentosChecklist({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();
  const getDados = useServerFn(getChecklistDados);
  const salvar = useServerFn(salvarChecklist);
  const listar = useServerFn(listarDocumentos);
  const anexar = useServerFn(anexarDocumento);

  const [check, setCheck] = useState<Record<string, any>>({});
  const [fgts, setFgts] = useState(false);
  const [subindo, setSubindo] = useState<string | null>(null);
  const carregou = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ["cliente-checklist", clienteId],
    queryFn: () => getDados({ data: { cliente_id: clienteId } }),
  });
  const { data: docs } = useQuery({
    queryKey: ["cliente-docs", clienteId],
    queryFn: () => listar({ data: { cliente_id: clienteId } }),
  });

  useEffect(() => {
    if (data && !carregou.current) {
      setCheck((data.cliente?.documentos_checklist as Record<string, any>) ?? {});
      setFgts(Boolean(data.cliente?.utiliza_fgts));
      carregou.current = true;
    }
  }, [data]);

  const cli = data?.cliente;
  const vend = data?.vendedores?.[0];
  const casado =
    cli?.estado_civil === "casado" || cli?.estado_civil === "uniao_estavel";
  const vendCasado = vend?.estado_civil === "casado" || vend?.estado_civil === "uniao_estavel";
  const [vendTipoManual, setVendTipoManual] = useState<"PF" | "PJ" | null>(null);
  const vendPJ = vendTipoManual ? vendTipoManual === "PJ" : vend?.tipo_pessoa === "PJ";

  const temDoc = (cat: Categoria, key: string) =>
    (docs ?? []).some((d: any) => d.categoria === cat && d.tipo_documento === key);

  async function persistir(next: Record<string, any>, novoFgts = fgts) {
    try {
      await salvar({
        data: { cliente_id: clienteId, checklist: next, utiliza_fgts: novoFgts },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar checklist.");
    }
  }

  function setManual(key: string, val: any) {
    setCheck((prev) => {
      const next = { ...prev, [key]: val };
      persistir(next);
      return next;
    });
  }

  const hidden: string[] = Array.isArray(check.__hidden) ? check.__hidden : [];
  const custom: { id: string; label: string; cat?: Categoria }[] = Array.isArray(check.__custom)
    ? check.__custom
    : [];
  const labels: Record<string, string> =
    check.__labels && typeof check.__labels === "object" ? check.__labels : {};
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  function startEdit(itemKey: string, current: string) {
    setEditKey(itemKey);
    setEditText(current);
  }

  function saveEdit(itemKey: string) {
    const texto = editText.trim();
    setEditKey(null);
    if (!texto) return;
    setCheck((prev) => {
      const l = prev.__labels && typeof prev.__labels === "object" ? prev.__labels : {};
      const next: Record<string, any> = { ...prev, __labels: { ...l, [itemKey]: texto } };
      // custom items store the label on the entry too
      if (Array.isArray(prev.__custom) && itemKey.startsWith("custom_")) {
        const id = itemKey.slice("custom_".length);
        next.__custom = prev.__custom.map((x: { id: string; label: string }) =>
          x.id === id ? { ...x, label: texto } : x,
        );
      }
      persistir(next);
      return next;
    });
  }


  function hideItem(key: string) {
    setCheck((prev) => {
      const h: string[] = Array.isArray(prev.__hidden) ? prev.__hidden : [];
      const next = { ...prev, __hidden: Array.from(new Set([...h, key])) };
      persistir(next);
      return next;
    });
  }

  function addCustom(label: string, cat: Categoria = "outros") {
    const texto = label.trim();
    if (!texto) return;
    setCheck((prev) => {
      const c = Array.isArray(prev.__custom) ? prev.__custom : [];
      const next = {
        ...prev,
        __custom: [...c, { id: crypto.randomUUID(), label: texto, cat }],
      };
      persistir(next);
      return next;
    });
  }

  function removeCustom(id: string) {
    setCheck((prev) => {
      const c = Array.isArray(prev.__custom) ? prev.__custom : [];
      const next: Record<string, any> = {
        ...prev,
        __custom: c.filter((x: { id: string }) => x.id !== id),
      };
      delete next[`custom_${id}`];
      persistir(next);
      return next;
    });
  }

  // ===== Checklists personalizados (grupos configuráveis pelo usuário) =====
  const grupos: GrupoChecklist[] = Array.isArray(check.__grupos) ? check.__grupos : [];

  function setGrupos(
    updater: (g: GrupoChecklist[]) => GrupoChecklist[],
  ) {
    setCheck((prev) => {
      const atuais: GrupoChecklist[] = Array.isArray(prev.__grupos) ? prev.__grupos : [];
      const next = { ...prev, __grupos: updater(atuais) };
      persistir(next);
      return next;
    });
  }

  function addGrupo(titulo: string) {
    const t = titulo.trim();
    if (!t) return;
    setGrupos((g) => [...g, { id: crypto.randomUUID(), titulo: t, itens: [] }]);
  }

  function renameGrupo(id: string, titulo: string) {
    const t = titulo.trim();
    if (!t) return;
    setGrupos((g) => g.map((x) => (x.id === id ? { ...x, titulo: t } : x)));
  }

  function removeGrupo(id: string) {
    setGrupos((g) => g.filter((x) => x.id !== id));
  }

  function addItemGrupo(grupoId: string, label: string) {
    const t = label.trim();
    if (!t) return;
    setGrupos((g) =>
      g.map((x) =>
        x.id === grupoId
          ? { ...x, itens: [...x.itens, { id: crypto.randomUUID(), label: t, feito: false }] }
          : x,
      ),
    );
  }

  function toggleItemGrupo(grupoId: string, itemId: string, feito: boolean) {
    setGrupos((g) =>
      g.map((x) =>
        x.id === grupoId
          ? { ...x, itens: x.itens.map((it) => (it.id === itemId ? { ...it, feito } : it)) }
          : x,
      ),
    );
  }

  function renameItemGrupo(grupoId: string, itemId: string, label: string) {
    const t = label.trim();
    if (!t) return;
    setGrupos((g) =>
      g.map((x) =>
        x.id === grupoId
          ? { ...x, itens: x.itens.map((it) => (it.id === itemId ? { ...it, label: t } : it)) }
          : x,
      ),
    );
  }

  function removeItemGrupo(grupoId: string, itemId: string) {
    setGrupos((g) =>
      g.map((x) =>
        x.id === grupoId ? { ...x, itens: x.itens.filter((it) => it.id !== itemId) } : x,
      ),
    );
  }

  function moverGrupo(fromId: string, toId: string) {
    if (fromId === toId) return;
    setGrupos((g) => {
      const from = g.findIndex((x) => x.id === fromId);
      const to = g.findIndex((x) => x.id === toId);
      if (from < 0 || to < 0) return g;
      const copia = [...g];
      const [movido] = copia.splice(from, 1);
      copia.splice(to, 0, movido);
      return copia;
    });
  }

  /** Move um item (reordena dentro do grupo ou transfere entre grupos). */
  function moverItem(
    origem: { grupoId: string; itemId: string },
    destino: { grupoId: string; itemId?: string },
  ) {
    if (origem.grupoId === destino.grupoId && origem.itemId === destino.itemId) return;
    setGrupos((g) => {
      const copia = g.map((x) => ({ ...x, itens: [...x.itens] }));
      const gOrigem = copia.find((x) => x.id === origem.grupoId);
      const gDestino = copia.find((x) => x.id === destino.grupoId);
      if (!gOrigem || !gDestino) return g;
      const idx = gOrigem.itens.findIndex((it) => it.id === origem.itemId);
      if (idx < 0) return g;
      const [movido] = gOrigem.itens.splice(idx, 1);
      let insertAt = gDestino.itens.length;
      if (destino.itemId) {
        const destIdx = gDestino.itens.findIndex((it) => it.id === destino.itemId);
        if (destIdx >= 0) insertAt = destIdx;
      }
      gDestino.itens.splice(insertAt, 0, movido);
      return copia;
    });
  }


  async function toggleFgts(v: boolean) {
    setFgts(v);
    await persistir(check, v);
  }

  async function enviar(e: React.ChangeEvent<HTMLInputElement>, cat: Categoria, key: string) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Arquivo acima de 10 MB.");
    setSubindo(key);
    try {
      const path = `${clienteId}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("cliente-documentos")
        .upload(path, file);
      if (upErr) throw upErr;
      await anexar({
        data: {
          cliente_id: clienteId,
          categoria: cat,
          tipo_documento: key,
          nome_arquivo: file.name,
          storage_path: path,
          mime_type: file.type,
          tamanho_bytes: file.size,
        },
      });
      toast.success("Documento anexado.");
      qc.invalidateQueries({ queryKey: ["cliente-docs", clienteId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha no upload.");
    } finally {
      setSubindo(null);
    }
  }

  function DocItem({
    itemKey,
    label,
    cat,
    onRemove,
  }: {
    itemKey: string;
    label: string;
    cat: Categoria;
    onRemove?: () => void;
  }) {
    if (hidden.includes(itemKey)) return null;
    const has = temDoc(cat, label);
    const checked = has || check[itemKey] === true;
    const display = labels[itemKey] ?? label;
    const editing = editKey === itemKey;
    return (
      <div className="flex items-center gap-3 py-1.5">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => setManual(itemKey, v === true)}
        />
        {editing ? (
          <Input
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={() => saveEdit(itemKey)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveEdit(itemKey);
              } else if (e.key === "Escape") {
                setEditKey(null);
              }
            }}
            className="h-8 flex-1"
          />
        ) : (
          <span className={`flex-1 text-sm ${checked ? "text-foreground" : "text-muted-foreground"}`}>
            {display}
          </span>
        )}
        {has && !editing && (
          <span className="rounded bg-success/10 px-1.5 py-0.5 text-xs text-success">enviado</span>
        )}
        {!editing && (
          <button
            type="button"
            onClick={() => startEdit(itemKey, display)}
            aria-label="Editar item"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
        {editing ? (
          <>
            <button
              type="button"
              onClick={() => saveEdit(itemKey)}
              aria-label="Salvar item"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-success/10 hover:text-success"
            >
              <Check className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setEditKey(null)}
              aria-label="Cancelar edição"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </>
        ) : (
          <>
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-accent">
              {subindo === label ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              Enviar
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="sr-only"
                onChange={(e) => enviar(e, cat, label)}
                disabled={subindo === label}
              />
            </label>
            <button
              type="button"
              onClick={onRemove ?? (() => hideItem(itemKey))}
              aria-label="Remover item"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </>
        )}
      </div>
    );
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      {/* COMPRADOR */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist do comprador</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="pb-2">
            <AdicionarItem onAdd={(l) => addCustom(l, "comprador")} />
          </div>
          <DocItem itemKey="c_doc_id" cat="comprador" label={T.comprador[0]} />
          {casado && (
            <DocItem itemKey="c_doc_id_conj" cat="conjuge" label={T.conjuge[0]} />
          )}
          <DocItem itemKey="c_comp_end" cat="comprador" label={T.comprador[1]} />
          <DocItem itemKey="c_cert_ec" cat="comprador" label={T.comprador[2]} />
          <div className="my-2 border-t border-border" />
          <AutoItem label="Profissão" ok={filled(cli?.profissao)} />
          <AutoItem label="Telefone do comprador" ok={filled(cli?.telefone_celular)} />
          {casado && (
            <AutoItem label="Telefone do cônjuge" ok={filled(cli?.conjuge_celular)} />
          )}
          <AutoItem label="E-mail do comprador" ok={filled(cli?.email)} />
          {casado && <AutoItem label="E-mail do cônjuge" ok={filled(cli?.conjuge_email)} />}
          <AutoItem
            label="Dados da conta (agência e conta)"
            ok={filled(cli?.agencia) && filled(cli?.conta_corrente)}
          />
          <div className="mt-3 flex items-center justify-between rounded-lg border border-border p-3">
            <Label className="text-sm">Irá utilizar FGTS?</Label>
            <Switch checked={fgts} onCheckedChange={toggleFgts} />
          </div>
          {fgts && (
            <div className="mt-2 space-y-1 rounded-lg border border-dashed border-border p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Documentos para uso do FGTS
              </p>
              <DocItem itemKey="fgts_end" cat="comprador" label={T.comprador[3]} />
              <DocItem itemKey="fgts_irpf" cat="comprador" label={T.comprador[4]} />
              <DocItem itemKey="fgts_ctps" cat="comprador" label={T.comprador[5]} />
              <DocItem itemKey="fgts_extrato" cat="comprador" label={T.comprador[6]} />
            </div>
          )}
          {custom
            .filter((c) => c.cat === "comprador")
            .map((item) => (
              <DocItem
                key={item.id}
                itemKey={`custom_${item.id}`}
                label={item.label}
                cat="comprador"
                onRemove={() => removeCustom(item.id)}
              />
            ))}
        </CardContent>
      </Card>

      {/* VENDEDOR */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">
              Checklist do vendedor — {vendPJ ? "Pessoa Jurídica" : "Pessoa Física"}
            </CardTitle>
            <div className="inline-flex items-center gap-1 rounded-lg border border-border p-0.5">
              <button
                type="button"
                onClick={() => setVendTipoManual("PF")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${!vendPJ ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                Pessoa Física
              </button>
              <button
                type="button"
                onClick={() => setVendTipoManual("PJ")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${vendPJ ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                Pessoa Jurídica
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {vend
              ? "O tipo é detectado automaticamente pelo vendedor cadastrado na aba \"Vendedores\". Use os botões acima para visualizar o outro checklist."
              : "Nenhum vendedor cadastrado ainda. Escolha PF ou PJ acima para preparar os documentos, ou cadastre o vendedor na aba \"Vendedores\"."}
          </p>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="pb-2">
            <AdicionarItem onAdd={(l) => addCustom(l, "vendedor")} />
          </div>
          {vendPJ ? (
            <>
              <DocItem itemKey="v_contrato_social" cat="vendedor" label={T.vendedor[3]} />
              <DocItem itemKey="v_cnpj" cat="vendedor" label={T.vendedor[4]} />
              <DocItem itemKey="v_doc_socios" cat="vendedor" label={T.vendedor[5]} />
              <DocItem itemKey="v_comp_end_pj" cat="vendedor" label={T.vendedor[6]} />
            </>
          ) : (
            <>
              <DocItem itemKey="v_doc_id" cat="vendedor" label={T.vendedor[0]} />
              <DocItem itemKey="v_comp_end" cat="vendedor" label={T.vendedor[1]} />
              <DocItem itemKey="v_cert_ec" cat="vendedor" label={T.vendedor[2]} />
              <div className="my-2 border-t border-border" />
              <AutoItem label="Profissão" ok={filled(vend?.profissao)} />
              <AutoItem label="Telefone" ok={filled(vend?.telefone_celular)} />
              <AutoItem label="E-mail" ok={filled(vend?.email)} />
              <AutoItem
                label="Dados bancários: Banco / AG e CC para recebimento"
                ok={filled(vend?.agencia) && filled(vend?.conta_corrente)}
              />
              {vendCasado && (
                <div className="flex items-center gap-3 py-1.5">
                  <Checkbox
                    checked={check["v_dados_banc_conj"] === true}
                    onCheckedChange={(v) => setManual("v_dados_banc_conj", v === true)}
                  />
                  <span className="flex-1 text-sm text-muted-foreground">
                    Dados bancários do cônjuge do vendedor
                  </span>
                </div>
              )}
            </>
          )}
          {!vend && (
            <p className="pt-2 text-xs text-muted-foreground">
              Cadastre um vendedor na aba “Vendedores” para validar os dados automaticamente.
            </p>
          )}
          {custom
            .filter((c) => c.cat === "vendedor")
            .map((item) => (
              <DocItem
                key={item.id}
                itemKey={`custom_${item.id}`}
                label={item.label}
                cat="vendedor"
                onRemove={() => removeCustom(item.id)}
              />
            ))}
        </CardContent>
      </Card>

      {/* IMÓVEL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist do imóvel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="pb-2">
            <AdicionarItem onAdd={(l) => addCustom(l, "imovel")} />
          </div>
          <DocItem itemKey="i_matricula" cat="imovel" label={T.imovel[0]} />
          <DocItem itemKey="i_iptu" cat="imovel" label={T.imovel[1]} />
          <div className="mt-2 flex items-center justify-between rounded-lg border border-border p-3">
            <Label className="text-sm">O imóvel fica em condomínio?</Label>
            <Switch
              checked={check["i_condominio"] === true}
              onCheckedChange={(v) => setManual("i_condominio", v)}
            />
          </div>
          {check["i_condominio"] === true && (
            <div className="mt-2 space-y-1 rounded-lg border border-dashed border-border p-3">
              <DocItem itemKey="i_cnd_cond" cat="imovel" label={T.imovel[2]} />
              <DocItem itemKey="i_planta" cat="imovel" label={T.imovel[3]} />
            </div>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Contato da vistoria — Nome
              </Label>
              <Input
                value={check["i_vistoria_nome"] ?? ""}
                onChange={(e) =>
                  setCheck((p) => ({ ...p, i_vistoria_nome: e.target.value }))
                }
                onBlur={() => persistir(check)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Contato da vistoria — Telefone
              </Label>
              <Input
                value={check["i_vistoria_tel"] ?? ""}
                onChange={(e) =>
                  setCheck((p) => ({ ...p, i_vistoria_tel: e.target.value }))
                }
                onBlur={() => persistir(check)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Quantidade de vagas do imóvel
              </Label>
              <Input
                inputMode="numeric"
                value={check["i_vagas"] ?? ""}
                onChange={(e) => setCheck((p) => ({ ...p, i_vagas: e.target.value }))}
                onBlur={() => persistir(check)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">IQ?</Label>
              <Select
                value={check["i_iq"] ?? ""}
                onValueChange={(v) => setManual("i_iq", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {custom
            .filter((c) => c.cat === "imovel")
            .map((item) => (
              <DocItem
                key={item.id}
                itemKey={`custom_${item.id}`}
                label={item.label}
                cat="imovel"
                onRemove={() => removeCustom(item.id)}
              />
            ))}
        </CardContent>
      </Card>

      {/* ITENS PERSONALIZADOS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens personalizados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="pb-2">
            <AdicionarItem onAdd={(l) => addCustom(l, "outros")} />
          </div>
          {custom.filter((c) => !c.cat || c.cat === "outros").length === 0 && (
            <p className="text-sm text-muted-foreground">
              Adicione itens próprios ao checklist deste cliente.
            </p>
          )}
          {custom
            .filter((c) => !c.cat || c.cat === "outros")
            .map((item) => (
              <DocItem
                key={item.id}
                itemKey={`custom_${item.id}`}
                label={item.label}
                cat="outros"
                onRemove={() => removeCustom(item.id)}
              />
            ))}
        </CardContent>
      </Card>

      {/* CHECKLISTS PERSONALIZADOS (grupos configuráveis + drag & drop) */}
      <ChecklistsPersonalizados
        grupos={grupos}
        addGrupo={addGrupo}
        renameGrupo={renameGrupo}
        removeGrupo={removeGrupo}
        addItem={addItemGrupo}
        toggleItem={toggleItemGrupo}
        renameItem={renameItemGrupo}
        removeItem={removeItemGrupo}
        moverGrupo={moverGrupo}
        moverItem={moverItem}
      />
    </div>


  );
}
