import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, X, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  UsuarioCombobox,
  type UsuarioOpcao,
} from "@/components/operacional/usuario-combobox";
import {
  listarParticipantesChat,
  adicionarParticipanteChat,
  removerParticipanteChat,
} from "@/lib/crm/chat-cliente.functions";
import { listarUsuariosCorrespondente } from "@/lib/matriculas/matriculas.functions";

/**
 * Gerencia quem, além do dono da conversa, tem acesso a esta thread privada.
 * Convidados passam a ver o histórico e podem responder na mesma conversa.
 */
export function ChatParticipantes({
  clienteId,
  atendenteId,
}: {
  clienteId: string;
  atendenteId: string;
}) {
  const qc = useQueryClient();
  const listarPart = useServerFn(listarParticipantesChat);
  const listarUsuarios = useServerFn(listarUsuariosCorrespondente);
  const adicionar = useServerFn(adicionarParticipanteChat);
  const remover = useServerFn(removerParticipanteChat);
  const [aberto, setAberto] = useState(false);
  const [selecionado, setSelecionado] = useState("todos");

  const partKey = ["chat-participantes", clienteId, atendenteId];
  const { data: participantes } = useQuery({
    queryKey: partKey,
    queryFn: () => listarPart({ data: { cliente_id: clienteId, atendente_id: atendenteId } }),
  });

  const { data: usuarios } = useQuery({
    queryKey: ["usuarios-correspondente"],
    queryFn: () => listarUsuarios(),
    staleTime: 5 * 60_000,
  });

  const jaConvidados = useMemo(
    () => new Set([atendenteId, ...(participantes ?? []).map((p) => p.usuario_id)]),
    [participantes, atendenteId],
  );

  const disponiveis: UsuarioOpcao[] = useMemo(
    () => (usuarios ?? []).filter((u) => !jaConvidados.has(u.id)),
    [usuarios, jaConvidados],
  );

  const addMut = useMutation({
    mutationFn: (usuario_id: string) =>
      adicionar({ data: { cliente_id: clienteId, atendente_id: atendenteId, usuario_id } }),
    onSuccess: () => {
      setSelecionado("todos");
      qc.invalidateQueries({ queryKey: partKey });
      toast.success("Pessoa adicionada à conversa.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao adicionar."),
  });

  const rmMut = useMutation({
    mutationFn: (usuario_id: string) =>
      remover({ data: { cliente_id: clienteId, atendente_id: atendenteId, usuario_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: partKey });
      toast.success("Pessoa removida da conversa.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover."),
  });

  const total = participantes?.length ?? 0;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Participantes</span>
          {total > 0 && (
            <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 justify-center px-1">
              {total}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        className="w-[min(20rem,calc(100vw-1.5rem))] space-y-3"
      >
        <div>
          <p className="text-sm font-medium text-foreground">Participantes da conversa</p>
          <p className="text-xs text-muted-foreground">
            Convidados veem o histórico e podem responder nesta mesma conversa.
          </p>
        </div>

        {total > 0 ? (
          <ul className="space-y-1.5">
            {(participantes ?? []).map((p) => (
              <li
                key={p.usuario_id}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5"
              >
                <span className="truncate text-sm text-foreground">{p.nome}</span>
                <button
                  type="button"
                  onClick={() => rmMut.mutate(p.usuario_id)}
                  disabled={rmMut.isPending}
                  aria-label={`Remover ${p.nome}`}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed border-border/60 px-2.5 py-2 text-xs text-muted-foreground">
            Somente você tem acesso a esta conversa.
          </p>
        )}

        <div className="flex items-center gap-2">
          <UsuarioCombobox
            value={selecionado}
            onValueChange={setSelecionado}
            usuarios={disponiveis}
            placeholder="Selecionar pessoa…"
            className="h-9 min-w-0 flex-1"
          />
          <Button
            type="button"
            size="sm"
            disabled={selecionado === "todos" || addMut.isPending}
            onClick={() => addMut.mutate(selecionado)}
            className="shrink-0 gap-1"
          >
            <UserPlus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
