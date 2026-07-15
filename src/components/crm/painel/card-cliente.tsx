import { Link } from "@tanstack/react-router";
import {
  Building2,
  CalendarCheck,
  CalendarClock,
  Calculator,
  ChevronRight,
  Clock,
  ExternalLink,
  KanbanSquare,
  MoreHorizontal,
  Trash2,
  User,
  UserCheck,
  Archive,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import { statusProposta } from "@/components/propostas/status";
import { tempoRelativo, type PainelClienteItem } from "./utils";

interface Props {
  cliente: PainelClienteItem;
  stageCodigo: string;
  onDragStart: () => void;
  onDragEnd: () => void;
  clicavel: () => boolean;
  onAbrirCadastro: () => void;
  onSalvarDataVistoria: (campo: "vistoria_agendada_em" | "vistoria_concluida_em", valor: string) => void;
  onSalvarDataContrato: (valor: string) => void;
  onArquivarContrato: () => void;
  onLimparVinculo: () => void;
}

/** Card individual de cliente em uma coluna da esteira. */
export function CardCliente({
  cliente: c,
  stageCodigo,
  onDragStart,
  onDragEnd,
  clicavel,
  onAbrirCadastro,
  onSalvarDataVistoria,
  onSalvarDataContrato,
  onArquivarContrato,
  onLimparVinculo,
}: Props) {
  const ehVistoria = stageCodigo === "engenharia_vistoria";
  const dependente = ["simulacao", "credito_enviado", "credito_aprovado"].includes(stageCodigo);
  const temProposta = Boolean(c.numero_proposta);
  const st = (c.proposta_status ?? "").toLowerCase();
  const aprovado = st.includes("aprovad");
  const recusado = st.includes("recusad") || st.includes("reprovad") || st.includes("cancelad");
  const corBanco = corDoBanco(c.nome_banco);
  const statusClasse = aprovado
    ? "bg-success/10 text-success ring-success/25"
    : recusado
      ? "bg-destructive/10 text-destructive ring-destructive/25"
      : "bg-primary/10 text-primary ring-primary/20";
  const mostrarBloco = temProposta || dependente;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", c.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="cursor-grab rounded-xl border border-border bg-card transition-[border-color,box-shadow] duration-150 hover:border-primary/40 hover:shadow-sm active:cursor-grabbing"
    >
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (!clicavel()) return;
              onAbrirCadastro();
            }}
            className="group/card flex min-w-0 flex-1 items-start gap-2.5 text-left"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary transition-colors group-hover/card:bg-primary group-hover/card:text-primary-foreground">
              {c.nome.trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground transition-colors group-hover/card:text-primary">
                {c.nome}
              </span>
              <span className="block font-mono text-[11px] text-muted-foreground">
                {c.numero_cliente}
              </span>
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Ações do cliente"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onAbrirCadastro}>
                <ExternalLink className="mr-2 size-4" /> Abrir cadastro
              </DropdownMenuItem>
              {c.numero_proposta && (
                <DropdownMenuItem asChild>
                  <Link to="/operacional/propostas/kanban" search={{ q: c.numero_proposta }}>
                    <KanbanSquare className="mr-2 size-4" /> Ver proposta
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <User className="size-3 shrink-0 text-primary/70" />
            <span className="truncate">
              <span className="font-medium text-foreground/80">Resp:</span>{" "}
              {c.responsavel_nome ?? "—"}
            </span>
          </div>
          {c.analista_nome && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <UserCheck className="size-3 shrink-0 text-primary/70" />
              <span className="truncate">
                <span className="font-medium text-foreground/80">Analista:</span> {c.analista_nome}
              </span>
            </div>
          )}
          {(c.corretor_nome || c.imobiliaria_nome) && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Building2 className="size-3 shrink-0 text-primary/70" />
              <span className="truncate">
                {c.corretor_nome ?? c.imobiliaria_nome}
                {c.corretor_nome && c.imobiliaria_nome && (
                  <span className="text-muted-foreground/70">
                    {" · "}
                    {c.imobiliaria_nome}
                  </span>
                )}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="size-3 shrink-0" />
            Atualizado {tempoRelativo(c.pipeline_atualizado_em)}
          </div>
        </div>
        {c.numero_simulacao && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
            <Link
              to="/operacional/simulacoes"
              onClick={(e) => e.stopPropagation()}
              title={`Ver simulação ${c.numero_simulacao}`}
              className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-primary/[0.07] px-2 py-0.5 text-[11px] font-medium text-primary ring-1 ring-inset ring-primary/15 transition-colors hover:bg-primary/15"
            >
              <Calculator className="size-3 shrink-0" />
              <span className="truncate font-mono">{c.numero_simulacao}</span>
            </Link>
            {c.total_simulacoes > 1 && (
              <span className="text-[10px] font-medium text-muted-foreground">
                +{c.total_simulacoes - 1}
              </span>
            )}
          </div>
        )}
      </div>

      {mostrarBloco && (
        <div className="space-y-1.5 border-t border-border/70 px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {temProposta ? (
              <Link
                to="/operacional/propostas/kanban"
                search={{ q: c.numero_proposta ?? c.nome }}
                onClick={(e) => e.stopPropagation()}
                title={`Ver proposta ${c.numero_proposta} no kanban`}
                className="group/kb inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-primary/[0.07] px-2 py-1 text-[11px] font-medium text-primary ring-1 ring-inset ring-primary/15 transition-all duration-200 hover:bg-primary/15 hover:ring-primary/30 active:scale-[0.98]"
              >
                <KanbanSquare className="size-3 shrink-0" />
                <span className="truncate font-mono">{c.numero_proposta}</span>
                <ChevronRight className="size-3 shrink-0 -translate-x-0.5 opacity-0 transition-all duration-200 group-hover/kb:translate-x-0 group-hover/kb:opacity-100" />
              </Link>
            ) : (
              <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                Sem proposta vinculada
              </span>
            )}
            {dependente && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLimparVinculo();
                }}
                title="Excluir vínculo de simulação/aprovação e voltar ao cadastro"
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-destructive ring-1 ring-inset ring-destructive/20 transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="size-3 shrink-0" />
                <span className="hidden min-[380px]:inline">Excluir vínculo</span>
              </button>
            )}
          </div>

          {temProposta && (c.nome_banco || c.proposta_status) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {c.nome_banco && (
                <span
                  className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold"
                  style={{
                    color: corBanco,
                    borderColor: `color-mix(in oklab, ${corBanco} 35%, transparent)`,
                    backgroundColor: `color-mix(in oklab, ${corBanco} 8%, transparent)`,
                  }}
                  title={c.nome_banco}
                >
                  <BancoLogo nome={c.nome_banco} size="xs" className="shrink-0" />
                  <span className="truncate">{c.nome_banco}</span>
                </span>
              )}
              {c.proposta_status && (
                <span
                  className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${statusClasse}`}
                >
                  {statusProposta(c.proposta_status).label}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {ehVistoria && (
        <div className="space-y-2 border-t border-border/70 px-2.5 py-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" />
            <label className="w-16 shrink-0 text-[11px] font-medium text-muted-foreground">
              Agendada
            </label>
            <Input
              type="date"
              value={c.vistoria_agendada_em ?? ""}
              onChange={(e) => onSalvarDataVistoria("vistoria_agendada_em", e.target.value)}
              className="h-7 min-w-0 flex-1 px-2 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <CalendarCheck className="size-3.5 shrink-0 text-primary" />
            <label className="w-16 shrink-0 text-[11px] font-medium text-muted-foreground">
              Concluída
            </label>
            <Input
              type="date"
              value={c.vistoria_concluida_em ?? ""}
              onChange={(e) => onSalvarDataVistoria("vistoria_concluida_em", e.target.value)}
              className="h-7 min-w-0 flex-1 px-2 text-xs"
            />
          </div>
        </div>
      )}
      {stageCodigo === "contrato_emitido" && (
        <div className="space-y-2 border-t border-border/70 px-2.5 py-2">
          <div className="flex items-center gap-2">
            <CalendarCheck className="size-3.5 shrink-0 text-primary" />
            <label className="shrink-0 text-[11px] font-medium text-muted-foreground">
              Emitido em
            </label>
            <Input
              type="date"
              value={c.contrato_emitido_em ?? ""}
              onChange={(e) => onSalvarDataContrato(e.target.value)}
              className="h-7 min-w-0 flex-1 px-2 text-xs"
              title="Data de emissão do contrato (definida por você)"
            />
          </div>
          {c.contrato_emitido_em && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onArquivarContrato}
              className="h-7 w-full gap-1.5 text-xs"
            >
              <Archive className="size-3.5" />
              Arquivar contrato
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
