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
import { Icone3D, type TamanhoIcone3D, type TomIcone3D } from "@/components/ui/icone-3d";
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

/** Tom de cada pasta na peça 3D (vermelho nunca: é só para alerta). */
export const TOM_DA_PASTA: Record<PastaPadrao, TomIcone3D> = {
  comprador: "marca",
  participantes: "info",
  vendedor: "ciano",
  imovel: "sucesso",
  renda: "alerta",
  banco_proposta: "violeta",
  contratos: "marca",
  outros: "neutro",
};

export const ICONE_DA_PASTA = ICONES;

/**
 * Insígnia da pasta: a peça 3D do Agilliza (`Icone3D`) no tom da pasta. `plano` = só o glifo de
 * traço fino, para itens de menu (ícone de interface).
 */
export function IconePasta({
  pasta,
  ativa,
  tamanho = "sm",
  plano,
  className,
}: {
  pasta: PastaPadrao;
  ativa?: boolean;
  tamanho?: TamanhoIcone3D;
  plano?: boolean;
  className?: string;
}) {
  const Icone = ICONES[pasta];
  if (plano) return <Icone aria-hidden className={cn("size-4 text-primary", className)} strokeWidth={1.75} />;
  return (
    <Icone3D
      icone={Icone}
      tom={TOM_DA_PASTA[pasta]}
      tamanho={tamanho}
      className={cn(ativa && "drop-shadow-sm", className)}
    />
  );
}
