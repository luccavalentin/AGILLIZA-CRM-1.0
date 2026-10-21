import { Landmark, MapPin, Pencil, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDelete } from "@/components/shared/confirm-delete";

export function CardVendedor({
  v,
  onEditar,
  onExcluir,
  podeEditar = true,
}: {
  v: any;
  onEditar: (v: any) => void;
  onExcluir: (id: string) => Promise<void>;
  /** Sem `crm.clientes` › Editar o card é só consulta. */
  podeEditar?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <User className="size-4" />
          </span>
          <div>
            <CardTitle className="text-sm">{v.nome}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {v.tipo_pessoa === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
              {v.documento ? ` · ${v.documento}` : ""}
            </p>
          </div>
        </div>
        {podeEditar && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onEditar(v)}
              aria-label="Editar vendedor"
              title="Editar vendedor"
            >
              <Pencil className="size-4" />
            </Button>
            <ConfirmDelete
              onConfirm={() => onExcluir(v.id)}
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  aria-label="Excluir vendedor"
                  title="Excluir vendedor"
                >
                  <Trash2 className="size-4" />
                </Button>
              }
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-1 text-xs text-muted-foreground">
        {v.email && <p>{v.email}</p>}
        {v.telefone_celular && <p>{v.telefone_celular}</p>}
        {(v.agencia || v.conta_corrente) && (
          <p className="flex items-center gap-1">
            <Landmark className="size-3" /> Ag. {v.agencia ?? "—"} · CC {v.conta_corrente ?? "—"}
            {v.digito_conta ? `-${v.digito_conta}` : ""}
          </p>
        )}
        {(v.cidade || v.uf) && (
          <p className="flex items-center gap-1">
            <MapPin className="size-3" /> {[v.cidade, v.uf].filter(Boolean).join(" / ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
