import {
  Briefcase,
  Building2,
  Folder,
  FolderKanban,
  FolderOpen,
  IdCard,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PastaTipo } from "./helpers";

export function IconePasta({ tipo, aberta }: { tipo: PastaTipo; aberta?: boolean }) {
  const conf: Record<PastaTipo, { Icon: typeof Folder; classe: string }> = {
    raiz: { Icon: FolderKanban, classe: "from-primary/20 to-primary/5 text-primary" },
    comercial: { Icon: Briefcase, classe: "from-primary/20 to-primary/5 text-primary" },
    imob: { Icon: Building2, classe: "from-primary/20 to-primary/5 text-primary" },
    corretor: { Icon: IdCard, classe: "from-primary/20 to-primary/5 text-primary" },
    analista: { Icon: UserCog, classe: "from-primary/20 to-primary/5 text-primary" },
  };
  const { Icon, classe } = conf[tipo];
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-inner ring-1 ring-inset ring-border/40",
        classe,
      )}
    >
      {aberta ? <FolderOpen className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
    </span>
  );
}
