// Menu unificado de ações para uma conversa: fixar, arquivar,
// renomear, etiquetar, ocultar ("excluir para mim").

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Archive,
  ArchiveRestore,
  Check,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  arquivarConversa,
  criarEtiqueta,
  definirEtiquetasConversa,
  fixarConversa,
  listarEstadoChatDoUsuario,
  listarEtiquetas,
  listarVinculosEtiqueta,
  ocultarConversa,
  renomearConversa,
  type ChatTipo,
  type EtiquetaChat,
} from "@/lib/chats/gestao.functions";
import { cn } from "@/lib/utils";

interface Props {
  chatTipo: ChatTipo;
  chatId: string;
  arquivado?: boolean;
  fixado?: boolean;
  apelidoAtual?: string | null;
  nomeReferencia?: string | null;
  etiquetaIds?: string[];
  suportaEtiquetas?: boolean; // portal_cliente não suporta
  permitirExcluir?: boolean;
  align?: "start" | "end" | "center";
  compact?: boolean;
  onChanged?: () => void;
}

const CORES = [
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#64748b",
];

export function ConversaMenuAcoes({
  chatTipo,
  chatId,
  arquivado = false,
  fixado = false,
  apelidoAtual = null,
  nomeReferencia = null,
  etiquetaIds = [],
  suportaEtiquetas = true,
  permitirExcluir = true,
  align = "end",
  compact = false,
  onChanged,
}: Props) {
  const qc = useQueryClient();
  const [openMenu, setOpenMenu] = useState(false);
  const [openRenomear, setOpenRenomear] = useState(false);
  const [openEtiqueta, setOpenEtiqueta] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState(false);
  const [apelido, setApelido] = useState(apelidoAtual ?? "");

  const arquivarFn = useServerFn(arquivarConversa);
  const fixarFn = useServerFn(fixarConversa);
  const ocultarFn = useServerFn(ocultarConversa);
  const renomearFn = useServerFn(renomearConversa);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["threads-central"] });
    qc.invalidateQueries({ queryKey: ["chat-estado-usuario"] });
    qc.invalidateQueries({ queryKey: ["chat-etiqueta-vinculos"] });
    onChanged?.();
  };

  const mArquivar = useMutation({
    mutationFn: async () =>
      arquivarFn({ data: { chat_tipo: chatTipo, chat_id: chatId, arquivar: !arquivado } }),
    onSuccess: () => {
      toast.success(arquivado ? "Conversa desarquivada" : "Conversa arquivada");
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao arquivar"),
  });

  const mFixar = useMutation({
    mutationFn: async () =>
      fixarFn({ data: { chat_tipo: chatTipo, chat_id: chatId, fixar: !fixado } }),
    onSuccess: () => {
      toast.success(fixado ? "Conversa desafixada" : "Conversa fixada");
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const mExcluir = useMutation({
    mutationFn: async () =>
      ocultarFn({ data: { chat_tipo: chatTipo, chat_id: chatId, ocultar: true } }),
    onSuccess: () => {
      toast.success("Conversa removida da sua lista");
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const mRenomear = useMutation({
    mutationFn: async () =>
      renomearFn({
        data: {
          chat_tipo: chatTipo,
          chat_id: chatId,
          apelido: apelido.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Conversa renomeada");
      setOpenRenomear(false);
      invalidar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  return (
    <>
      <DropdownMenu open={openMenu} onOpenChange={setOpenMenu}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size={compact ? "icon" : "sm"}
            className={cn(compact && "size-7 shrink-0")}
            onClick={(e) => e.stopPropagation()}
            aria-label="Ações da conversa"
          >
            <MoreVertical className={compact ? "size-4" : "size-4"} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          onClick={(e) => e.stopPropagation()}
          className="w-56"
        >
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
              setOpenRenomear(true);
            }}
          >
            <Pencil className="mr-2 size-4" /> Renomear
          </DropdownMenuItem>
          {suportaEtiquetas && (
            <DropdownMenuItem onSelect={() => setOpenEtiqueta(true)}>
              <Tag className="mr-2 size-4" /> Etiquetas
            </DropdownMenuItem>
          )}
          {permitirExcluir && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirmExcluir(true)}
              >
                <Trash2 className="mr-2 size-4" /> Excluir conversa
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Renomear */}
      <Dialog open={openRenomear} onOpenChange={setOpenRenomear}>
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
              placeholder={nomeReferencia ?? "Novo nome"}
              maxLength={80}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenRenomear(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => mRenomear.mutate()}
              disabled={mRenomear.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Etiquetas */}
      {suportaEtiquetas && chatTipo !== "portal_cliente" && (
        <PopoverEtiquetasHelper
          chatTipo={chatTipo as "dm" | "cliente" | "demanda"}
          chatId={chatId}
          etiquetaIdsAtuais={etiquetaIds}
          aberto={openEtiqueta}
          onOpenChange={setOpenEtiqueta}
          onChanged={invalidar}
        />
      )}

      {/* Confirmação exclusão */}
      <AlertDialog open={confirmExcluir} onOpenChange={setConfirmExcluir}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              A conversa some da sua lista. O histórico permanece salvo e outros
              participantes continuam vendo normalmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => mExcluir.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// -----------------------------------------------------------
// Popover isolado para gestão de etiquetas.
// -----------------------------------------------------------
function PopoverEtiquetasHelper({
  chatTipo,
  chatId,
  etiquetaIdsAtuais,
  aberto,
  onOpenChange,
  onChanged,
}: {
  chatTipo: "dm" | "cliente" | "demanda";
  chatId: string;
  etiquetaIdsAtuais: string[];
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const listarFn = useServerFn(listarEtiquetas);
  const criarFn = useServerFn(criarEtiqueta);
  const definirFn = useServerFn(definirEtiquetasConversa);

  const [selecionadas, setSelecionadas] = useState<Set<string>>(
    new Set(etiquetaIdsAtuais),
  );
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState(CORES[0]);

  const { data: etiquetas } = useQuery({
    queryKey: ["chat-etiquetas"],
    queryFn: () => listarFn(),
    enabled: aberto,
  });

  const mCriar = useMutation({
    mutationFn: async () =>
      criarFn({ data: { nome: novoNome.trim(), cor: novaCor } }),
    onSuccess: (nova: EtiquetaChat) => {
      setNovoNome("");
      qc.invalidateQueries({ queryKey: ["chat-etiquetas"] });
      setSelecionadas((s) => new Set(s).add(nova.id));
      toast.success("Etiqueta criada");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const mDefinir = useMutation({
    mutationFn: async () =>
      definirFn({
        data: {
          chat_tipo: chatTipo,
          chat_id: chatId,
          etiqueta_ids: Array.from(selecionadas),
        },
      }),
    onSuccess: () => {
      toast.success("Etiquetas atualizadas");
      onChanged();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  return (
    <Popover open={aberto} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <span aria-hidden className="sr-only" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b p-3">
          <p className="text-sm font-semibold">Etiquetas</p>
          <p className="text-[11px] text-muted-foreground">
            Marque as etiquetas aplicadas a esta conversa.
          </p>
        </div>
        <ScrollArea className="max-h-56">
          <ul className="py-1">
            {(etiquetas ?? []).map((et) => {
              const on = selecionadas.has(et.id);
              return (
                <li key={et.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelecionadas((s) => {
                        const c = new Set(s);
                        if (c.has(et.id)) c.delete(et.id);
                        else c.add(et.id);
                        return c;
                      })
                    }
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/60",
                      on && "bg-muted/40",
                    )}
                  >
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ background: et.cor }}
                    />
                    <span className="flex-1 truncate">{et.nome}</span>
                    {on && <Check className="size-4 text-primary" />}
                  </button>
                </li>
              );
            })}
            {(etiquetas ?? []).length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                Nenhuma etiqueta criada ainda.
              </li>
            )}
          </ul>
        </ScrollArea>
        <div className="space-y-2 border-t p-2">
          <div className="flex items-center gap-1">
            {CORES.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setNovaCor(c)}
                aria-label={`Cor ${c}`}
                className={cn(
                  "size-4 rounded-full border",
                  novaCor === c ? "ring-2 ring-primary ring-offset-1" : "",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Nova etiqueta…"
              maxLength={40}
              className="h-8"
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!novoNome.trim() || mCriar.isPending}
              onClick={() => mCriar.mutate()}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => mDefinir.mutate()}
              disabled={mDefinir.isPending}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Renderiza pílulas coloridas para uma lista de etiquetas. */
export function EtiquetasPills({
  etiquetas,
}: {
  etiquetas: EtiquetaChat[];
}) {
  if (!etiquetas.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {etiquetas.map((et) => (
        <Badge
          key={et.id}
          variant="outline"
          className="h-5 gap-1 px-1.5 text-[10px] font-medium"
          style={{ borderColor: et.cor, color: et.cor }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ background: et.cor }}
          />
          {et.nome}
        </Badge>
      ))}
    </div>
  );
}

/**
 * Versão "auto-suficiente" do menu de ações: carrega o próprio estado do
 * chat (arquivado/fixado/apelido/etiquetas) para o usuário logado. Use nos
 * cabeçalhos dos chats standalone (ficha de cliente, detalhe de demanda,
 * janelas soltas) para que todas as configurações fiquem na tela do chat.
 */
export function ConversaMenuAcoesLive({
  chatTipo,
  chatId,
  nomeReferencia = null,
  suportaEtiquetas = true,
  permitirExcluir = true,
  align = "end",
  compact = false,
}: {
  chatTipo: ChatTipo;
  chatId: string;
  nomeReferencia?: string | null;
  suportaEtiquetas?: boolean;
  permitirExcluir?: boolean;
  align?: "start" | "end" | "center";
  compact?: boolean;
}) {
  const estadoFn = useServerFn(listarEstadoChatDoUsuario);
  const vincFn = useServerFn(listarVinculosEtiqueta);

  const { data: estados } = useQuery({
    queryKey: ["chat-estado-usuario"],
    queryFn: () => estadoFn(),
  });
  const { data: vinc } = useQuery({
    queryKey: ["chat-etiqueta-vinculos"],
    queryFn: () => vincFn(),
    enabled: suportaEtiquetas,
  });

  const estado = (estados ?? []).find(
    (e: any) => e.chat_tipo === chatTipo && e.chat_id === chatId,
  );
  const etiquetaIds = ((vinc ?? []) as any[])
    .filter((v) => v.chat_tipo === chatTipo && v.chat_id === chatId)
    .map((v) => v.etiqueta_id);

  return (
    <ConversaMenuAcoes
      chatTipo={chatTipo}
      chatId={chatId}
      arquivado={!!estado?.arquivado_em}
      fixado={!!estado?.pinado_em}
      apelidoAtual={estado?.apelido ?? null}
      nomeReferencia={nomeReferencia}
      etiquetaIds={etiquetaIds}
      suportaEtiquetas={suportaEtiquetas}
      permitirExcluir={permitirExcluir}
      align={align}
      compact={compact}
    />
  );
}
