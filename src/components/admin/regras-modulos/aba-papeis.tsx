import { Lock, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { NivelAcesso } from "@/lib/admin/regras-modulos.functions";
import { PAPEL_LABEL } from "./constants";

export function AbaPapeis({
  niveis,
  editavel,
  onConfigurar,
  onEditar,
  onExcluir,
}: {
  niveis: NivelAcesso[];
  editavel: boolean;
  onConfigurar: (id: string) => void;
  onEditar: (n: NivelAcesso) => void;
  onExcluir: (id: string) => void;
}) {
  if (niveis.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum papel cadastrado ainda.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {niveis.map((n) => (
        <Card key={n.id} className="flex flex-col gap-3 p-4">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-medium text-foreground">{n.nome}</span>
                {n.is_padrao ? (
                  <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                    <Lock className="h-3 w-3" /> Padrão
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {PAPEL_LABEL[n.papel] ?? n.papel} ·{" "}
                {n.acesso_tipo === "portal_parceiro"
                  ? "Portal do Parceiro"
                  : "Portal do Correspondente"}
              </p>
              {n.descricao ? (
                <p className="mt-1 text-xs text-muted-foreground">{n.descricao}</p>
              ) : null}
            </div>
          </div>
          <div className="mt-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onConfigurar(n.id)}>
              <ShieldCheck className="h-4 w-4" /> Permissões
            </Button>
            {editavel ? (
              <>
                <Button variant="outline" size="sm" onClick={() => onEditar(n)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                {!n.is_padrao ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onExcluir(n.id)}
                  >
                    <Trash2 className="h-4 w-4" /> Excluir
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
