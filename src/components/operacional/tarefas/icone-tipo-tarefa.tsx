import { CalendarCheck2, Circle, FolderUp, Home, Phone, UsersRound } from "lucide-react";

/** Ícone do tipo de compromisso — os mesmos das Tarefas do Agilliza Tech. */
const ICONES = {
  ligacao: Phone,
  visita: Home,
  reuniao: UsersRound,
  documento: FolderUp,
  lembrete: CalendarCheck2,
  outro: Circle,
} as const;

export function IconeTipoTarefa({ tipo, className }: { tipo: string | null | undefined; className?: string }) {
  const Icone = ICONES[(tipo ?? "lembrete") as keyof typeof ICONES] ?? CalendarCheck2;
  return <Icone className={className} aria-hidden />;
}
