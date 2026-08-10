import { useRef, useState } from "react";
import { Plus, Trash2, Pencil, GripVertical } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AdicionarItem } from "./AdicionarItem";
import type { GrupoChecklist, ItemChecklist } from "./types";

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

export function ChecklistsPersonalizados(props: ChecklistsCfgProps) {
  const { grupos } = props;
  const [novoGrupo, setNovoGrupo] = useState("");
  const [criando, setCriando] = useState(false);
  const drag = useRef<
    { tipo: "grupo"; grupoId: string } | { tipo: "item"; grupoId: string; itemId: string } | null
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
            Crie listas próprias para este cliente. Arraste para reordenar e mover itens entre
            listas.
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
                    <TituloGrupo titulo={g.titulo} onRename={(t) => props.renameGrupo(g.id, t)} />
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
        destaque
          ? "border-primary/60 bg-primary/5"
          : "border-transparent hover:border-border/60 hover:bg-muted/40"
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
