import { Check, Download, FileText, Pencil, Trash2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneBadge } from "@/components/crm/tone-badge";
import { CATEGORIA_LABEL, statusTone, type Categoria } from "./types";

export function LinhaDocumento({
  doc,
  onBaixar,
  onEditar,
  onMarcar,
  onExcluir,
}: {
  doc: any;
  onBaixar: (storage_path: string, nome: string) => void;
  onEditar: (d: any) => void;
  onMarcar: (id: string, status: "aprovado" | "reprovado") => void;
  onExcluir: (d: any) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={() => onBaixar(doc.storage_path, doc.nome_arquivo)}
        title="Visualizar documento"
        className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left transition-colors hover:opacity-80"
      >
        <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground underline-offset-2 hover:underline">
            {doc.nome_arquivo}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {CATEGORIA_LABEL[doc.categoria as Categoria]} · {doc.tipo_documento} · v
            {doc.versao}
          </p>
          {doc.enviado_por_nome ? (
            <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <User className="size-3 shrink-0" />
              <span className="truncate">Enviado por {doc.enviado_por_nome}</span>
            </span>
          ) : null}
        </div>
      </button>

      <div className="flex shrink-0 items-center justify-end gap-0.5 border-t border-border/60 pt-2 sm:border-0 sm:pt-0">
        <ToneBadge tone={statusTone[doc.status] ?? "muted"}>{doc.status}</ToneBadge>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onBaixar(doc.storage_path, doc.nome_arquivo)}
          title="Visualizar / baixar"
        >
          <Download className="size-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onEditar(doc)} title="Editar">
          <Pencil className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onMarcar(doc.id, "aprovado")}
          title="Aprovar"
        >
          <Check className="size-4 text-success" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onMarcar(doc.id, "reprovado")}
          title="Reprovar"
        >
          <X className="size-4 text-destructive" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onExcluir(doc)} title="Excluir">
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
