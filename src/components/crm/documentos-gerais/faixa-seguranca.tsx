import { Lock, Shield } from "lucide-react";

export function FaixaSeguranca() {
  return (
    <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/30 p-4 md:grid-cols-2">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Shield className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">
            Seus documentos sempre seguros
          </p>
          <p className="text-xs text-muted-foreground">
            Armazenamento criptografado e acesso controlado por permissões.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3 md:justify-end">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Lock className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">Controle de acesso</p>
          <p className="text-xs text-muted-foreground">
            Permissões granulares por perfil e nível de acesso.
          </p>
        </div>
      </div>
    </div>
  );
}
