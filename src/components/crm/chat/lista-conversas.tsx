import { Search, Tag, BellRing, Timer, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChatConfigSheet } from "@/components/shared/chat-config-sheet";
import { TagChip } from "./tag-chip";
import { iniciais, rotuloDia, type FiltroChat } from "./helpers";
import { ItemAcoesMenu } from "./item-acoes-menu";
import type { UseChatConversas } from "./use-chat-conversas";


type Props = {
  hook: UseChatConversas;
};

/**
 * Sidebar de conversas do Chat CRM. Renderiza busca, chips de filtro,
 * lista agrupada por dia e a seção de "novos clientes com App habilitado".
 * Puramente apresentacional — recebe o estado do hook `useChatConversas`.
 */
export function ListaConversas({ hook }: Props) {
  const {
    busca,
    setBusca,
    filtro,
    setFiltro,
    etiquetaFiltro,
    setEtiquetaFiltro,
    selecionado,
    setSelecionado,
    setAtendenteSel,
    atendenteSel,
    verTodos,
    setVerTodos,
    abrirConversa,
    isLoading,
    etiquetas,
    etiquetasCliente,
    filtradas,
    novosClientes,
    buscandoApp,
    termoBusca,
    contadores,
    slaEstourado,
    lembreteDevido,
  } = hook;

  const chips: { id: FiltroChat; label: string; count?: number }[] = [
    { id: "todas", label: "Todas" },
    { id: "nao_lidas", label: "Não lidas", count: contadores.nao_lidas },
    { id: "sla", label: "SLA estourado", count: contadores.sla },
    { id: "lembrete", label: "Lembretes", count: contadores.lembrete },
    { id: "arquivadas", label: "Arquivadas", count: contadores.arquivadas },
  ];

  return (
    <Card
      className={cn(
        "h-full min-h-0 min-w-0 flex-col overflow-hidden border-border/60 shadow-sm lg:flex",
        selecionado ? "hidden" : "flex",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b bg-card px-3 py-3">
        <h2 className="text-sm font-semibold text-foreground">Conversas</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setVerTodos(!verTodos);
              setSelecionado(null);
              setAtendenteSel(null);
            }}
            title="Alterna entre as suas conversas e a visão de todos os atendentes (apenas gestores)."
            className={cn(
              "flex size-8 items-center justify-center rounded-lg border transition-colors",
              verTodos
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            <Users className="h-4 w-4" />
          </button>
          <ChatConfigSheet />
        </div>
      </div>
      <div className="space-y-2 border-b bg-muted/30 p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou documento…"
            className="rounded-lg bg-background pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {chips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setFiltro(chip.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                filtro === chip.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {chip.label}
              {chip.count ? (
                <span
                  className={cn(
                    "rounded-full px-1 text-[10px]",
                    filtro === chip.id
                      ? "bg-primary-foreground/20"
                      : "bg-muted-foreground/15",
                  )}
                >
                  {chip.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        {(etiquetas?.length ?? 0) > 0 && (
          <Select value={etiquetaFiltro} onValueChange={setEtiquetaFiltro}>
            <SelectTrigger className="h-8 rounded-lg bg-background text-xs">
              <div className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Filtrar por etiqueta" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etiquetas</SelectItem>
              {(etiquetas ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="crm-scrollbar-slim flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filtradas.length === 0 && novosClientes.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {termoBusca.length >= 2
              ? buscandoApp
                ? "Buscando clientes…"
                : "Nenhum cliente encontrado. Habilite o App do cliente no CRM para poder conversar."
              : filtro !== "todas" || etiquetaFiltro !== "all"
                ? "Nenhuma conversa para este filtro."
                : "Nenhuma conversa ainda. Busque um cliente com App habilitado para iniciar."}
          </p>
        ) : (
          <>
            {(() => {
              let ultimoDia = "";
              const nodes: React.ReactNode[] = [];
              for (const c of filtradas) {
                const dia = rotuloDia(c.ultima_em);
                if (dia !== ultimoDia) {
                  ultimoDia = dia;
                  nodes.push(
                    <div
                      key={`hdr-${dia}`}
                      className="sticky top-0 z-[1] border-b border-border/40 bg-card/95 px-3 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/80 backdrop-blur"
                    >
                      {dia}
                    </div>,
                  );
                }
                const tags = etiquetasCliente.get(c.cliente_id) ?? [];
                const sla = slaEstourado(
                  c.cliente_id,
                  c.ultimo_remetente,
                  c.ultima_em,
                );
                const lembrete = lembreteDevido(c.cliente_id);
                const ativo =
                  selecionado === c.cliente_id &&
                  (atendenteSel == null || atendenteSel === c.atendente_id);
                nodes.push(
                  <div
                    key={`${c.cliente_id}::${c.atendente_id ?? ""}`}
                    className={cn(
                      "group relative mx-2 mb-0.5 flex w-[calc(100%-1rem)] items-start rounded-xl transition-colors",
                      ativo
                        ? "bg-primary/[0.08] shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
                        : "hover:bg-muted/60",
                    )}
                  >
                    <button
                      onClick={() => abrirConversa(c.cliente_id, c.atendente_id)}
                      className="crm-focus-ring flex flex-1 items-start gap-3 rounded-xl px-2.5 py-2.5 text-left"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary/50 text-xs font-semibold text-primary-foreground">
                        {iniciais(c.nome)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn(
                            "truncate text-sm",
                            ativo ? "font-semibold text-foreground" : "font-medium text-foreground",
                          )}>
                            {c.nome}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {new Date(c.ultima_em).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {verTodos && !c.minha && c.atendente_nome && (
                          <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-primary/80">
                            <Users className="h-3 w-3" /> {c.atendente_nome}
                          </span>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-muted-foreground">
                            {c.ultimo_remetente === "time" ? "Você: " : ""}
                            {c.ultima_mensagem}
                          </span>
                          {c.nao_lidas > 0 && (
                            <Badge className="h-5 shrink-0 px-1.5 text-[10px]">
                              {c.nao_lidas}
                            </Badge>
                          )}
                        </div>
                        {(tags.length > 0 || sla || lembrete) && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {sla && (
                              <span className="chat-tag chat-tag-red">
                                <Timer className="h-3 w-3" /> SLA
                              </span>
                            )}
                            {lembrete && (
                              <span className="chat-tag chat-tag-amber">
                                <BellRing className="h-3 w-3" /> Lembrete
                              </span>
                            )}
                            {tags.map((t) => (
                              <TagChip key={t.id} etiqueta={t} />
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                    <div className="flex items-center pr-1.5 pt-2">
                      <ItemAcoesMenu
                        clienteId={c.cliente_id}
                        nome={c.nome}
                        arquivado={hook.arquivada(c.cliente_id)}
                        fixado={false}
                        apelidoAtual={null}
                      />
                    </div>
                  </div>,
                );
              }
              return nodes;
            })()}


            {novosClientes.length > 0 && (
              <>
                <p className="bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Clientes com App habilitado
                </p>
                {novosClientes.map((c) => (
                  <button
                    key={c.cliente_id}
                    onClick={() => abrirConversa(c.cliente_id, null)}
                    className={cn(
                      "flex w-full items-start gap-3 border-b border-border/50 px-3 py-3 text-left transition-colors hover:bg-muted/50",
                      selecionado === c.cliente_id &&
                        "bg-primary/5 shadow-[inset_3px_0_0_0_hsl(var(--primary))]",
                    )}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {iniciais(c.nome)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {c.nome}
                        </span>
                        <Badge
                          variant={c.logou ? "secondary" : "outline"}
                          className="h-5 shrink-0 px-1.5 text-[10px]"
                        >
                          {c.logou ? "Ativo" : "Não logou"}
                        </Badge>
                      </div>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.documento ?? "Iniciar conversa"}
                      </span>
                      {c.etapa_nome && (
                        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                          {c.etapa_nome}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
