import {
  Banknote,
  FileSignature,
  FolderOpen,
  Home,
  Landmark,
  User,
  Users,
  UserSquare2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PastaPadrao } from "@/lib/crm/documentos-clientes/pastas";

const ICONES: Record<PastaPadrao, LucideIcon> = {
  comprador: User,
  participantes: Users,
  vendedor: UserSquare2,
  imovel: Home,
  renda: Banknote,
  banco_proposta: Landmark,
  contratos: FileSignature,
  outros: FolderOpen,
};

/** Insígnia da pasta: traço fino azul sobre fundo claro (padrão Agilliza). */
export function IconePasta({
  pasta,
  ativa,
  className,
}: {
  pasta: PastaPadrao;
  ativa?: boolean;
  className?: string;
}) {
  const Icone = ICONES[pasta];
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset transition-colors",
        ativa
          ? "bg-primary text-primary-foreground ring-primary shadow-sm"
          : "bg-primary/8 text-primary ring-primary/15",
        className,
      )}
    >
      <Icone className="size-4" strokeWidth={1.75} />
    </span>
  );
}
