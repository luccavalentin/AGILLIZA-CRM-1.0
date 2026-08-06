import { Check, Loader2, Pencil, Trash2, Upload, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { Categoria } from "./types";
import type { ChecklistState } from "./use-checklist-state";

export function DocItem({
  state,
  itemKey,
  label,
  cat,
  temDoc,
  onRemove,
}: {
  state: ChecklistState;
  itemKey: string;
  label: string;
  cat: Categoria;
  temDoc: (c: Categoria, k: string) => boolean;
  onRemove?: () => void;
}) {
  const {
    check,
    hidden,
    labels,
    editKey,
    editText,
    setEditText,
    setEditKey,
    setManual,
    startEdit,
    saveEdit,
    hideItem,
    subindo,
    enviar,
  } = state;

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
        <span
          className={`flex-1 text-sm ${checked ? "text-foreground" : "text-muted-foreground"}`}
        >
          {display}
        </span>
      )}
      {has && !editing && (
        <span className="rounded bg-success/10 px-1.5 py-0.5 text-xs text-success">
          enviado
        </span>
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
