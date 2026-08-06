import type { LucideIcon } from "lucide-react";

interface ModuloPlaceholderProps {
  icon: LucideIcon;
  titulo: string;
  descricao: string;
}

/**
 * Página de módulo ainda não implementado (entregue em etapa futura).
 * Estado vazio real — sem dados fictícios.
 */
export function ModuloPlaceholder({ icon: Icon, titulo, descricao }: ModuloPlaceholderProps) {
  return (
    <div className="mx-auto max-w-none">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{descricao}</p>
      </div>
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-background px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <p className="text-base font-medium text-foreground">Módulo em construção</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Este módulo será habilitado em uma próxima etapa do sistema.
          </p>
        </div>
      </div>
    </div>
  );
}
