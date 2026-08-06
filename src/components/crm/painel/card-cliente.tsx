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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import { statusProposta } from "@/components/propostas/status";
import { tempoRelativo, type PainelClienteItem } from "./utils";

interface Props {
  cliente: PainelClienteItem;
  stageCodigo: string;
  /** Card apenas leitura: sem arrasto (etapas sincronizadas pela proposta). */
  readOnly?: boolean;
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
  readOnly = false,
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
  const ehContrato = stageCodigo === "contrato_emitido";
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
      draggable={!readOnly}
      onDragStart={(e) => {
        if (readOnly) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", c.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={() => {
        if (!clicavel()) return;
        onAbrirCadastro();
      }}
      style={{ "--banco": corBanco } as React.CSSProperties}
      className={`group crm-focus-ring relative min-w-0 shrink-0 overflow-hidden rounded-xl border border-border bg-card p-3 pl-3.5 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:border-[color-mix(in_oklab,var(--banco)_45%,transparent)] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[var(--banco)] before:opacity-0 before:transition-opacity hover:before:opacity-100 ${
        readOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold uppercase text-primary">
          {c.nome.trim().charAt(0).toUpperCase() || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground" title={c.nome}>
            {c.nome}
          </p>
          <p className="truncate font-mono text-[11px] tabular-nums text-muted-foreground">
            {c.numero_cliente}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-70 transition-all hover:bg-muted hover:text-foreground hover:opacity-100 group-hover:opacity-100"
              title="Ações do cliente"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
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
            {ehContrato && c.contrato_emitido_em && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onArquivarContrato}>
                  <Archive className="mr-2 size-4" /> Arquivar contrato
                </DropdownMenuItem>
              </>
            )}
            {dependente && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onLimparVinculo}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" /> Excluir vínculo
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {temProposta && c.proposta_status && (
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${statusClasse}`}
          >
            {statusProposta(c.proposta_status).label}
          </span>
        )}
        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          {tempoRelativo(c.pipeline_atualizado_em)}
        </span>
      </div>

      {(temProposta || c.numero_simulacao) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          {temProposta && (
            <Link
              to="/operacional/propostas/kanban"
              search={{ q: c.numero_proposta ?? c.nome }}
              onClick={(e) => e.stopPropagation()}
              title={`Ver proposta ${c.numero_proposta}`}
              className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 font-bold tabular-nums text-primary hover:bg-primary/15"
            >
              <KanbanSquare className="size-2.5" />
              {c.numero_proposta}
            </Link>
          )}
          {c.numero_simulacao && (
            <Link
              to="/operacional/simulacoes"
              onClick={(e) => e.stopPropagation()}
              title={`Ver simulação ${c.numero_simulacao}`}
              className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-medium tabular-nums text-foreground hover:bg-muted/70"
            >
              <Calculator className="size-2.5" />
              {c.numero_simulacao}
              {c.total_simulacoes > 1 && (
                <span className="text-muted-foreground">+{c.total_simulacoes - 1}</span>
              )}
            </Link>
          )}
        </div>
      )}

      <div className="mt-2 space-y-0.5">
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate" title={c.responsavel_nome ?? "—"}>
            Resp: {c.responsavel_nome ?? "—"}
          </span>
        </div>
        {c.analista_nome && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <UserCheck className="h-3 w-3 shrink-0" />
            <span className="truncate" title={c.analista_nome}>
              Analista: {c.analista_nome}
            </span>
          </div>
        )}
        {(c.corretor_nome || c.imobiliaria_nome) && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Building2 className="h-3 w-3 shrink-0" />
            <span
              className="truncate"
              title={[c.corretor_nome, c.imobiliaria_nome].filter(Boolean).join(" · ")}
            >
              {c.corretor_nome ?? c.imobiliaria_nome}
              {c.corretor_nome && c.imobiliaria_nome && ` · ${c.imobiliaria_nome}`}
            </span>
          </div>
        )}
      </div>

      {temProposta && c.nome_banco && (
        <div className="mt-2.5 flex items-center gap-1.5 border-t border-border/60 pt-2.5 text-xs font-medium text-foreground">
          <BancoLogo nome={c.nome_banco} size="xs" className="shrink-0" />
          <span className="truncate">{c.nome_banco}</span>
        </div>
      )}

      {ehVistoria && (
        <div className="mt-2.5 space-y-1.5 border-t border-border/60 pt-2.5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <CalendarClock className="size-3 shrink-0 text-muted-foreground" />
            <label className="w-14 shrink-0 text-[10px] font-medium text-muted-foreground">
              Agendada
            </label>
            <Input
              type="date"
              value={c.vistoria_agendada_em ?? ""}
              onChange={(e) => onSalvarDataVistoria("vistoria_agendada_em", e.target.value)}
              className="h-6 min-w-0 flex-1 px-1.5 text-[11px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <CalendarCheck className="size-3 shrink-0 text-primary" />
            <label className="w-14 shrink-0 text-[10px] font-medium text-muted-foreground">
              Concluída
            </label>
            <Input
              type="date"
              value={c.vistoria_concluida_em ?? ""}
              onChange={(e) => onSalvarDataVistoria("vistoria_concluida_em", e.target.value)}
              className="h-6 min-w-0 flex-1 px-1.5 text-[11px]"
            />
          </div>
        </div>
      )}
      {ehContrato && (
        <div className="mt-2.5 border-t border-border/60 pt-2.5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <CalendarCheck className="size-3 shrink-0 text-primary" />
            <label className="shrink-0 text-[10px] font-medium text-muted-foreground">
              Emitido
            </label>
            <Input
              type="date"
              value={c.contrato_emitido_em ?? ""}
              onChange={(e) => onSalvarDataContrato(e.target.value)}
              className="h-6 min-w-0 flex-1 px-1.5 text-[11px]"
              title="Data de emissão do contrato"
            />
          </div>
        </div>
      )}
    </div>
  );
}
