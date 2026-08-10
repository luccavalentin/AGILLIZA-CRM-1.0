import {
  AlertTriangle,
  Check,
  Download,
  FileText,
  MessageSquareWarning,
  Pencil,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneBadge } from "@/components/crm/tone-badge";
import { CATEGORIA_LABEL, statusTone, type Categoria } from "./types";

/** Formata data ISO (YYYY-MM-DD) em pt-BR sem conversão de fuso. */
function formatarValidade(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** true quando `expira_em` é menor que hoje (comparação lexicográfica em ISO). */
function estaVencido(iso: string): boolean {
  return iso < new Date().toISOString().slice(0, 10);
}

export function LinhaDocumento({
  doc,
  onBaixar,
  onEditar,
  onMarcar,
  onSolicitarCorrecao,
  onExcluir,
}: {
  doc: any;
  onBaixar: (storage_path: string, nome: string) => void;
  onEditar: (d: any) => void;
  onMarcar: (id: string, status: "aprovado" | "reprovado") => void;
  onSolicitarCorrecao: (d: any) => void;
  onExcluir: (d: any) => void;
}) {
  const vencido = doc.expira_em ? estaVencido(doc.expira_em) : false;
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
            {CATEGORIA_LABEL[doc.categoria as Categoria]} · {doc.tipo_documento} · v{doc.versao}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {doc.enviado_por_nome ? (
              <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <User className="size-3 shrink-0" />
                <span className="truncate">Enviado por {doc.enviado_por_nome}</span>
              </span>
            ) : null}
            {doc.expira_em ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  vencido ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                }`}
              >
                {vencido ? <AlertTriangle className="size-3" /> : null}
                {vencido ? "Vencido em " : "Vence em "}
                {formatarValidade(doc.expira_em)}
              </span>
            ) : null}
          </div>
        </div>
      </button>

      <div className="flex shrink-0 items-center justify-end gap-0.5 border-t border-border/60 pt-2 sm:border-0 sm:pt-0">
        <ToneBadge tone={statusTone[doc.status] ?? "muted"}>{doc.status}</ToneBadge>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onBaixar(doc.storage_path, doc.nome_arquivo)}
          title="Visualizar / baixar"
          aria-label="Visualizar ou baixar documento"
        >
          <Download className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onEditar(doc)}
          title="Editar"
          aria-label="Editar documento"
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onMarcar(doc.id, "aprovado")}
          title="Aprovar"
          aria-label="Aprovar documento"
        >
          <Check className="size-4 text-success" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onSolicitarCorrecao(doc)}
          title="Solicitar correção"
          aria-label="Solicitar correção do documento"
        >
          <MessageSquareWarning className="size-4 text-warning" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onMarcar(doc.id, "reprovado")}
          title="Reprovar"
          aria-label="Reprovar documento"
        >
          <X className="size-4 text-destructive" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onExcluir(doc)}
          title="Excluir"
          aria-label="Excluir documento"
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
