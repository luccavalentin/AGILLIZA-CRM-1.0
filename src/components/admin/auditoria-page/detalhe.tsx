import {
  Activity,
  Clock,
  Fingerprint,
  Monitor,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { AuditoriaLinha } from "@/lib/admin/auditoria.functions";
import { classificar, diffPayload, fmtDataHora, TOM_CLASSES } from "./helpers";

function LinhaDetalhe({
  icon: Icone,
  rotulo,
  valor,
}: {
  icon: LucideIcon;
  rotulo: string;
  valor: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icone className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </p>
        <p className="mt-0.5 break-words text-sm font-medium text-foreground">{valor}</p>
      </div>
    </div>
  );
}

export function DetalheAuditoria({
  registro,
  onClose,
}: {
  registro: AuditoriaLinha | null;
  onClose: () => void;
}) {
  const mudancas = registro
    ? diffPayload(registro.payload_anterior, registro.payload_novo)
    : [];
  const info = registro ? classificar(registro.acao) : null;

  return (
    <Dialog open={!!registro} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg gap-0 p-0">
        {registro && info && (
          <>
            <DialogHeader className="space-y-2 border-b border-border p-5">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg ring-1",
                    TOM_CLASSES[info.tom].chip,
                    TOM_CLASSES[info.tom].ring,
                  )}
                >
                  <info.Icone className="size-4" />
                </span>
                <div className="min-w-0">
                  <DialogTitle className="text-base leading-tight">
                    {registro.acao_label}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 truncate font-mono text-xs">
                    {registro.acao}
                  </DialogDescription>
                </div>
              </div>
              <p className="text-sm text-foreground">{registro.mensagem}</p>
            </DialogHeader>

            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <LinhaDetalhe
                    icon={UserIcon}
                    rotulo="Usuário"
                    valor={registro.ator_nome ?? "Sistema"}
                  />
                  <LinhaDetalhe
                    icon={Clock}
                    rotulo="Data e hora"
                    valor={fmtDataHora(registro.created_at)}
                  />
                  {registro.entidade && (
                    <LinhaDetalhe
                      icon={Activity}
                      rotulo="Entidade"
                      valor={
                        registro.entidade +
                        (registro.entidade_id ? ` · ${registro.entidade_id}` : "")
                      }
                    />
                  )}
                  {registro.ip && (
                    <LinhaDetalhe icon={Fingerprint} rotulo="Endereço IP" valor={registro.ip} />
                  )}
                  {registro.user_agent && (
                    <div className="sm:col-span-2">
                      <LinhaDetalhe
                        icon={Monitor}
                        rotulo="Navegador"
                        valor={registro.user_agent}
                      />
                    </div>
                  )}
                </div>

                {mudancas.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Alterações registradas
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Campo</th>
                            <th className="px-3 py-2 text-left font-medium">Antes</th>
                            <th className="px-3 py-2 text-left font-medium">Depois</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mudancas.map((m) => (
                            <tr key={m.campo} className="border-t border-border align-top">
                              <td className="px-3 py-2 font-medium text-foreground">{m.campo}</td>
                              <td className="px-3 py-2 text-destructive/80 line-through">{m.de}</td>
                              <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400">
                                {m.para}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
