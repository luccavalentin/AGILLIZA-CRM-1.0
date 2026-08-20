// Menu compacto de ações para cada item da lista de conversas do CRM.
// Oferece: fixar, arquivar/desarquivar, renomear (apelido pessoal) e
// remover da minha lista ("ocultar"). Fixar/renomear/ocultar usam o
// estado por-usuário compartilhado (chat_estado_usuario); arquivar usa
// a API do CRM (crm_chat_meta) para manter o filtro "Arquivadas" da
// sidebar coerente com o restante do módulo.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, ArchiveRestore, MoreVertical, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { definirArquivamentoConversa } from "@/lib/crm/chat-gestao.functions";
import {
  arquivarConversa,
  fixarConversa,
  ocultarConversa,
  renomearConversa,
} from "@/lib/chats/gestao.functions";

interface Props {
  clienteId: string;
  nome: string;
  arquivado: boolean;
  fixado: boolean;
  apelidoAtual: string | null;
}

export function ItemAcoesMenu({ clienteId, nome, arquivado, fixado, apelidoAtual }: Props) {
  const qc = useQueryClient();
  const [openMenu, setOpenMenu] = useState(false);
  const [openRen, setOpenRen] = useState(false);
  const [openDel, setOpenDel] = useState(false);
  const [apelido, setApelido] = useState(apelidoAtual ?? "");

  const arquivarCrm = useServerFn(definirArquivamentoConversa);
  const arquivarShared = useServerFn(arquivarConversa);
  const fixarFn = useServerFn(fixarConversa);
  const renomearFn = useServerFn(renomearConversa);
  const ocultarFn = useServerFn(ocultarConversa);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["chat-overview"] });
    qc.invalidateQueries({ queryKey: ["chat-estado-usuario"] });
    qc.invalidateQueries({ queryKey: ["conversas-cliente"] });
  };

  const mArquivar = useMutation({
    mutationFn: async () => {
      await arquivarCrm({
        data: { cliente_id: clienteId, arquivado: !arquivado },
      });
      // Espelha no estado por-usuário para consistência com a Central.
      await arquivarShared({
        data: {
          chat_tipo: "cliente",
          chat_id: clienteId,
          arquivar: !arquivado,
        },
      });
    },
    onSuccess: () => {
      toast.success(arquivado ? "Conversa desarquivada." : "Conversa arquivada.");
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao arquivar."),
  });

  const mFixar = useMutation({
    mutationFn: () =>
      fixarFn({
        data: { chat_tipo: "cliente", chat_id: clienteId, fixar: !fixado },
      }),
    onSuccess: () => {
      toast.success(fixado ? "Conversa desafixada." : "Conversa fixada no topo.");
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha."),
  });

  const mRenomear = useMutation({
    mutationFn: () =>
      renomearFn({
        data: {
          chat_tipo: "cliente",
          chat_id: clienteId,
          apelido: apelido.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Conversa renomeada.");
      setOpenRen(false);
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha."),
  });

  const mOcultar = useMutation({
    mutationFn: () =>
      ocultarFn({
        data: { chat_tipo: "cliente", chat_id: clienteId, ocultar: true },
      }),
    onSuccess: () => {
      toast.success("Conversa removida da sua lista.");
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha."),
  });

  return (
    <>
      {/* Atalho de exclusão: aparece assim que o mouse passa sobre o item. */}
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground transition-colors hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpenDel(true);
        }}
        aria-label="Excluir conversa"
        title="Excluir conversa"
      >
        <Trash2 className="size-4" />
      </Button>
      <DropdownMenu open={openMenu} onOpenChange={setOpenMenu}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            aria-label="Ações da conversa"
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="w-52">
          <DropdownMenuLabel className="text-xs">Ações</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => mFixar.mutate()}>
            {fixado ? (
              <>
                <PinOff className="mr-2 size-4" /> Desafixar
              </>
            ) : (
              <>
                <Pin className="mr-2 size-4" /> Fixar no topo
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => mArquivar.mutate()}>
            {arquivado ? (
              <>
                <ArchiveRestore className="mr-2 size-4" /> Desarquivar
              </>
            ) : (
              <>
                <Archive className="mr-2 size-4" /> Arquivar
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setApelido(apelidoAtual ?? "");
              setOpenRen(true);
            }}
          >
            <Pencil className="mr-2 size-4" /> Renomear
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setOpenDel(true)}
          >
            <Trash2 className="mr-2 size-4" /> Remover da minha lista
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openRen} onOpenChange={setOpenRen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              O apelido é pessoal — só você o enxerga.
            </p>
            <Input
              value={apelido}
              onChange={(e) => setApelido(e.target.value)}
              placeholder={nome}
              maxLength={80}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenRen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => mRenomear.mutate()} disabled={mRenomear.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={openDel} onOpenChange={setOpenDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              A conversa some da sua lista. O histórico permanece salvo e o cliente e demais
              atendentes continuam vendo normalmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => mOcultar.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
