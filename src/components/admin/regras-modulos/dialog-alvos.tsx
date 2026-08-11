import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CATALOGO_MODULOS, type EscopoAlvo } from "@/lib/admin/regras-modulos.functions";
import { PAPEIS_ALVO } from "./constants";

export function DialogAlvos({
  moduloAtivo,
  onClose,
  alvos,
  toggleAlvo,
  tipos,
  pessoas,
}: {
  moduloAtivo: string | null;
  onClose: () => void;
  alvos: Record<string, EscopoAlvo[]>;
  toggleAlvo: (modulo: string, alvo: EscopoAlvo, ativo: boolean) => void;
  tipos: { id: string; slug: string; nome: string }[];
  pessoas: { id: string; nome: string | null; email?: string | null }[];
}) {
  function alvoAtivo(modulo: string, alvo: EscopoAlvo): boolean {
    return (alvos[modulo] ?? []).some(
      (a) =>
        a.alvo_tipo === alvo.alvo_tipo &&
        (a.alvo_id ?? null) === (alvo.alvo_id ?? null) &&
        (a.alvo_valor ?? null) === (alvo.alvo_valor ?? null),
    );
  }

  return (
    <Dialog open={moduloAtivo !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Quem este papel pode ver
            {moduloAtivo
              ? ` — ${CATALOGO_MODULOS.find((m) => m.modulo === moduloAtivo)?.label ?? ""}`
              : ""}
          </DialogTitle>
        </DialogHeader>
        {moduloAtivo ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Por papel</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PAPEIS_ALVO.map((p) => (
                  <label key={p.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={alvoAtivo(moduloAtivo, {
                        alvo_tipo: "papel",
                        alvo_valor: p.value,
                      })}
                      onCheckedChange={(v) =>
                        toggleAlvo(
                          moduloAtivo,
                          { alvo_tipo: "papel", alvo_valor: p.value },
                          v === true,
                        )
                      }
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Por tipo de pessoa</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {tipos.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={alvoAtivo(moduloAtivo, {
                        alvo_tipo: "tipo_pessoa",
                        alvo_valor: t.slug,
                      })}
                      onCheckedChange={(v) =>
                        toggleAlvo(
                          moduloAtivo,
                          { alvo_tipo: "tipo_pessoa", alvo_valor: t.slug },
                          v === true,
                        )
                      }
                    />
                    {t.nome}
                  </label>
                ))}
                {tipos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum tipo cadastrado.</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Por usuário específico</p>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
                {pessoas.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={alvoAtivo(moduloAtivo, {
                        alvo_tipo: "usuario",
                        alvo_id: u.id,
                      })}
                      onCheckedChange={(v) =>
                        toggleAlvo(moduloAtivo, { alvo_tipo: "usuario", alvo_id: u.id }, v === true)
                      }
                    />
                    <span className="truncate">
                      {u.nome ?? "—"}
                      {u.email ? <span className="text-muted-foreground"> · {u.email}</span> : null}
                    </span>
                  </label>
                ))}
                {pessoas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma pessoa cadastrada.</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button onClick={onClose}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
