import { MessageCircle, MessagesSquare, UserCircle2, Users } from "lucide-react";
import type { ChatTipo } from "@/lib/chats/gestao.functions";
import type { ThreadCentral, ThreadKind } from "@/lib/chats/central.functions";

export type SelecionadoState =
  | { kind: "dm"; conversaId: string; nome: string | null; foto: string | null }
  | { kind: "cliente"; clienteId: string; nome: string | null; foto: string | null }
  | {
      kind: "demanda";
      demandaId: string;
      numero: string | null;
      titulo: string | null;
      interlocutorNome: string | null;
      interlocutorFoto: string | null;
    }
  | null;

export function chaveConversa(kind: ChatTipo | ThreadKind, id: string) {
  return `${kind}-${id}`;
}

export function iniciais(nome?: string | null): string {
  if (!nome) return "?";
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function tempoRelativo(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const agora = new Date();
  const diff = (agora.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  const dias = Math.floor(diff / 86400);
  if (dias < 7) return `${dias} d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export const RÓTULOS: Record<ThreadKind, { label: string; icon: typeof Users }> = {
  dm: { label: "Direta", icon: UserCircle2 },
  cliente: { label: "Cliente", icon: MessageCircle },
  demanda: { label: "Demanda", icon: MessagesSquare },
};

export function ehSelecionado(sel: SelecionadoState, t: ThreadCentral): boolean {
  if (!sel) return false;
  if (sel.kind !== t.kind) return false;
  if (sel.kind === "dm" && t.kind === "dm") return sel.conversaId === t.id;
  if (sel.kind === "cliente" && t.kind === "cliente") return sel.clienteId === t.id;
  if (sel.kind === "demanda" && t.kind === "demanda") return sel.demandaId === t.id;
  return false;
}

export function threadParaSelecionado(t: ThreadCentral): SelecionadoState {
  if (t.kind === "dm")
    return { kind: "dm", conversaId: t.id, nome: t.titulo, foto: t.avatar_url ?? null };
  if (t.kind === "cliente")
    return { kind: "cliente", clienteId: t.id, nome: t.titulo, foto: t.avatar_url ?? null };
  return {
    kind: "demanda",
    demandaId: t.id,
    numero: t.subtitulo,
    titulo: t.demanda_titulo ?? null,
    interlocutorNome: t.interlocutor_nome ?? t.titulo ?? null,
    interlocutorFoto: t.interlocutor_foto ?? t.avatar_url ?? null,
  };
}
