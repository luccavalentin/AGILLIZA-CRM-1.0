import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  CalendarCheck,
  ChevronRight,
  ExternalLink,
  FileText,
  FolderClosed,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
  Undo2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { DateInput } from "@/components/shared/date-input";
import type { ContratoEmitido } from "@/lib/crm/clientes.functions";
import type { PainelClienteItem } from "./utils";

/** Diálogo que lista clientes de uma etapa (ou de toda a esteira). */
export function DialogClientesEtapa({
  open,
  titulo,
  clientes,
  verTodos,
  onOpenChange,
  onAbrirCliente,
}: {
  open: boolean;
  titulo: string;
  clientes: (PainelClienteItem & { etapaNome: string })[];
  verTodos: boolean;
  onOpenChange: (open: boolean) => void;
  onAbrirCliente: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  useEffect(() => {
    if (!open) setBusca("");
  }, [open]);
  const termo = busca.trim().toLowerCase();
  const filtrados = termo
    ? clientes.filter((c) =>
        [c.nome, c.numero_cliente, c.etapaNome, c.responsavel_nome, c.numero_proposta]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(termo)),
      )
    : clientes;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-card to-card/95 p-0 shadow-2xl">
        <DialogHeader className="relative border-b border-border/50 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <Users className="size-4 text-primary" />
            {titulo}
            <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {clientes.length} cliente{clientes.length === 1 ? "" : "s"}
            </span>
          </DialogTitle>
          <DialogDescription>Pesquise e clique para abrir o cadastro.</DialogDescription>
        </DialogHeader>

        <div className="brand-scroll scroll-shadow-bottom flex-1 space-y-4 overflow-y-auto px-6 pb-6 pt-4">
          <div className="group relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              autoFocus
              placeholder="Buscar por nome, nº do cliente ou proposta"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-11 rounded-xl border-border/70 bg-background pl-11 pr-4 text-sm shadow-sm"
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {filtrados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onAbrirCliente(c.id)}
                className="group flex w-full items-center gap-2.5 rounded-lg border border-border bg-background p-2.5 text-left transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                  {c.nome.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                    {c.nome}
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                    {c.numero_cliente}
                    {verTodos && (
                      <span className="truncate rounded-full bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground">
                        {c.etapaNome}
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
            {filtrados.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
                Nenhum cliente encontrado.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


interface DialogArquivoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contratos: ContratoEmitido[] | undefined;
  contratosFiltrados: ContratoEmitido[];
  carregando: boolean;
  contratoBusca: string;
  contratoDesde: string;
  contratoAte: string;
  editandoContrato: string | null;
  setContratoBusca: (v: string) => void;
  setContratoDesde: (v: string) => void;
  setContratoAte: (v: string) => void;
  setEditandoContrato: (v: string | null) => void;
  onSalvarDataContrato: (clienteId: string, valor: string) => void;
  onDesarquivar: (clienteId: string) => void;
  onExcluir: (clienteId: string) => void;
}

/** Diálogo com o arquivo de contratos emitidos (pesquisa, filtro e ações). */
export function DialogArquivoContratos(p: DialogArquivoProps) {
  const navigate = useNavigate();
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderClosed className="size-4 text-primary" />
            Contratos emitidos
          </DialogTitle>
          <DialogDescription>
            Arquivo dos contratos já emitidos — pesquise e filtre por data.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 border-y border-border/60 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={p.contratoBusca}
              onChange={(e) => p.setContratoBusca(e.target.value)}
              placeholder="Buscar por nome, nº do cliente, proposta ou banco..."
              className="h-9 rounded-lg pl-9 pr-9 text-sm"
            />
            {p.contratoBusca && (
              <button
                type="button"
                onClick={() => p.setContratoBusca("")}
                className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Emitido de</label>
              <Input
                type="date"
                value={p.contratoDesde}
                onChange={(e) => p.setContratoDesde(e.target.value)}
                className="h-9 w-36 rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">até</label>
              <Input
                type="date"
                value={p.contratoAte}
                onChange={(e) => p.setContratoAte(e.target.value)}
                className="h-9 w-36 rounded-lg text-sm"
              />
            </div>
            {(p.contratoDesde || p.contratoAte || p.contratoBusca) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={() => {
                  p.setContratoBusca("");
                  p.setContratoDesde("");
                  p.setContratoAte("");
                }}
              >
                Limpar
              </Button>
            )}
            <span className="ml-auto self-center text-[11px] tabular-nums text-muted-foreground">
              {p.contratosFiltrados.length} contrato(s)
            </span>
          </div>
        </div>
        <div className="brand-scroll scroll-shadow-bottom mt-3 flex-1 space-y-2 overflow-y-auto p-6 pt-0">
          {p.carregando ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))
          ) : (p.contratos ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-10 text-center">
              <FolderClosed className="size-7 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                Nenhum contrato emitido arquivado ainda.
              </p>
            </div>
          ) : p.contratosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-10 text-center">
              <Search className="size-7 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                Nenhum contrato encontrado com esses filtros.
              </p>
            </div>
          ) : (
            p.contratosFiltrados.map((ct) => (
              <div
                key={ct.cliente_id}
                className="group flex items-start gap-3 rounded-lg border border-border bg-background p-3 transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-4" />
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      p.onOpenChange(false);
                      navigate({ to: "/crm/clientes/$id", params: { id: ct.cliente_id } });
                    }}
                    className="block max-w-full truncate text-left text-sm font-medium text-foreground underline-offset-2 transition-colors hover:text-primary hover:underline"
                    title="Abrir cadastro do cliente"
                  >
                    {ct.nome_cliente ?? "Cliente"}
                  </button>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    {ct.proposta_id ? (
                      <button
                        type="button"
                        onClick={() => {
                          p.onOpenChange(false);
                          navigate({
                            to: "/operacional/propostas/$id",
                            params: { id: ct.proposta_id! },
                          });
                        }}
                        className="inline-flex items-center gap-1 font-mono text-primary underline-offset-2 transition-colors hover:underline"
                        title="Abrir proposta"
                      >
                        <FileText className="size-3" />
                        {ct.numero_proposta ?? "Ver proposta"}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono">
                        <FileText className="size-3" />
                        {ct.numero_proposta ?? "—"}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <CalendarCheck className="size-3" />
                      {ct.contrato_emitido_em
                        ? new Date(ct.contrato_emitido_em).toLocaleDateString("pt-BR", {
                            timeZone: "America/Sao_Paulo",
                          })
                        : "—"}
                    </span>
                    {ct.nome_banco && (
                      <button
                        type="button"
                        onClick={() => {
                          p.onOpenChange(false);
                          navigate({
                            to: "/operacional/propostas/kanban",
                            search: { q: ct.nome_banco! },
                          });
                        }}
                        className="inline-flex items-center gap-1 text-primary underline-offset-2 transition-colors hover:underline"
                        title="Ver propostas deste banco"
                      >
                        <Building2 className="size-3" />
                        {ct.nome_banco}
                      </button>
                    )}
                  </span>
                  {p.editandoContrato === ct.cliente_id && (
                    <div className="mt-2 flex items-center gap-2">
                      <DateInput
                        value={ct.contrato_emitido_em ?? ""}
                        onChange={(v) => p.onSalvarDataContrato(ct.cliente_id, v)}
                        className="h-8 flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => p.setEditandoContrato(null)}
                      >
                        Concluir
                      </Button>
                    </div>
                  )}
                </span>
                {ct.valor_financiamento != null && (
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                    {`R$ ${Number(ct.valor_financiamento).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground"
                      title="Ações do contrato"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        p.onOpenChange(false);
                        navigate({ to: "/crm/clientes/$id", params: { id: ct.cliente_id } });
                      }}
                    >
                      <ExternalLink className="mr-2 size-4" /> Abrir cadastro
                    </DropdownMenuItem>
                    {ct.proposta_id && (
                      <DropdownMenuItem
                        onClick={() => {
                          p.onOpenChange(false);
                          navigate({
                            to: "/operacional/propostas/$id",
                            params: { id: ct.proposta_id! },
                          });
                        }}
                      >
                        <FileText className="mr-2 size-4" /> Visualizar proposta
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => p.setEditandoContrato(ct.cliente_id)}>
                      <Pencil className="mr-2 size-4" /> Editar data de emissão
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => p.onDesarquivar(ct.cliente_id)}>
                      <Undo2 className="mr-2 size-4" /> Mover para a esteira
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => p.onExcluir(ct.cliente_id)}
                    >
                      <Trash2 className="mr-2 size-4" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Diálogo para adicionar um cliente já cadastrado em uma etapa. */
export function DialogAdicionarCliente({
  stage,
  busca,
  termoDeb,
  buscando,
  resultados,
  adicionando,
  onOpenChange,
  onBuscaChange,
  onSelecionar,
}: {
  stage: { codigo: string; nome: string } | null;
  busca: string;
  termoDeb: string;
  buscando: boolean;
  resultados: Array<{ id: string; nome: string; documento?: string | null; email?: string | null; telefone_celular?: string | null }> | undefined;
  adicionando: boolean;
  onOpenChange: (o: boolean) => void;
  onBuscaChange: (v: string) => void;
  onSelecionar: (id: string) => void;
}) {
  return (
    <Dialog open={!!stage} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-primary" />
            Adicionar cliente — {stage?.nome}
          </DialogTitle>
          <DialogDescription>
            Pesquise por nome, documento ou e-mail e selecione um cliente já cadastrado para
            inseri-lo nesta etapa. As demais etapas avançam automaticamente conforme a operação.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={busca}
              onChange={(e) => onBuscaChange(e.target.value)}
              placeholder="Buscar cliente cadastrado..."
              className="h-10 rounded-xl pl-9"
            />
          </div>
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {termoDeb.length < 2 ? (
              <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                Digite ao menos 2 caracteres para buscar.
              </p>
            ) : buscando ? (
              <div className="space-y-1.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : (resultados ?? []).length === 0 ? (
              <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                Nenhum cliente encontrado.
              </p>
            ) : (
              (resultados ?? []).map((cli) => (
                <button
                  key={cli.id}
                  type="button"
                  disabled={adicionando}
                  onClick={() => onSelecionar(cli.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-border p-2.5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {(cli.nome ?? "?").trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {cli.nome}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {cli.documento || cli.email || cli.telefone_celular || "—"}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Confirmação de exclusão de contrato emitido. */
export function AlertExcluirContrato({
  clienteId,
  onOpenChange,
  onConfirmar,
}: {
  clienteId: string | null;
  onOpenChange: (o: boolean) => void;
  onConfirmar: (clienteId: string) => void;
}) {
  return (
    <AlertDialog open={!!clienteId} onOpenChange={(o) => !o && onOpenChange(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir contrato emitido?</AlertDialogTitle>
          <AlertDialogDescription>
            O registro de contrato emitido será removido e o cliente voltará para a esteira. Esta
            ação pode ser refeita definindo novamente a data de emissão.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (clienteId) onConfirmar(clienteId);
              onOpenChange(false);
            }}
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Confirmação de limpeza de vínculo simulação/proposta. */
export function AlertLimparVinculo({
  info,
  onOpenChange,
  onConfirmar,
}: {
  info: { id: string; nome: string } | null;
  onOpenChange: (o: boolean) => void;
  onConfirmar: () => void;
}) {
  return (
    <AlertDialog open={!!info} onOpenChange={(o) => !o && onOpenChange(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir vínculo de simulação/aprovação?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso remove por completo o vínculo de {info?.nome} com simulações e propostas
            (inclusive registros já excluídos) e retorna o cliente para a etapa de cadastro. O
            cadastro do cliente é mantido. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmar}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir vínculo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
