import { Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EstadoVazio, IconeGestao, Selo } from "@/components/plataforma/kit";
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
    return (
      <EstadoVazio
        icone={<ShieldCheck />}
        titulo="Nenhum papel cadastrado ainda"
        descricao="Crie o primeiro papel e defina o que ele pode ver e fazer."
      />
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {niveis.map((n) => {
        const liberados = new Set(n.permissoes.filter((p) => p.permitido).map((p) => p.modulo)).size;
        return (
          <article
            key={n.id}
            className="flex flex-col gap-3 rounded-[14px] border border-border/80 bg-card p-4 shadow-[0_1px_2px_rgb(16_24_40/0.04)] transition-shadow hover:shadow-[0_6px_16px_-10px_rgb(0_10_112/0.25)]"
          >
            <div className="flex items-start gap-3">
              <IconeGestao icone={<ShieldCheck />} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{n.nome}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Selo tom="marca">{PAPEL_LABEL[n.papel] ?? n.papel}</Selo>
                  <Selo>{n.acesso_tipo === "portal_parceiro" ? "Portal do Parceiro" : "Correspondente"}</Selo>
                  {n.is_padrao ? <Selo tom="info">Padrão</Selo> : null}
                </div>
                {n.descricao ? (
                  <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{n.descricao}</p>
                ) : null}
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {liberados} {liberados === 1 ? "módulo liberado" : "módulos liberados"}
                </p>
              </div>
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <Button size="sm" className="min-h-11 sm:min-h-8" onClick={() => onConfigurar(n.id)}>
                <ShieldCheck className="size-4" /> Permissões
              </Button>
              {editavel ? (
                <>
                  <Button variant="outline" size="sm" className="min-h-11 sm:min-h-8" onClick={() => onEditar(n)}>
                    <Pencil className="size-4" /> Editar
                  </Button>
                  {!n.is_padrao ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 text-destructive hover:text-destructive sm:min-h-8"
                      onClick={() => onExcluir(n.id)}
                    >
                      <Trash2 className="size-4" /> Excluir
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
