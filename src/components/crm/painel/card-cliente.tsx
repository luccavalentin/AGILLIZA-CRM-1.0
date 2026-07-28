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
      className={`crm-focus-ring group/kcard relative rounded-2xl border border-border/60 bg-card/95 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 ease-out hover:border-primary/30 hover:shadow-[0_8px_28px_-12px_rgba(59,130,246,0.25)] ${
        readOnly ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      <div className="px-3 pb-2.5 pt-2.5">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => {
              if (!clicavel()) return;
              onAbrirCadastro();
            }}
            className="group/card flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary ring-1 ring-inset ring-primary/15 transition-colors group-hover/card:bg-primary group-hover/card:text-primary-foreground group-hover/card:ring-primary/40">
              {c.nome.trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block truncate text-[13px] font-semibold leading-tight text-foreground transition-colors group-hover/card:text-primary"
                title={c.nome}
              >
                {c.nome}
              </span>
              <span className="mt-0.5 block font-mono text-[10px] tracking-tight text-muted-foreground/80">
                {c.numero_cliente}
              </span>
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-70 transition-all hover:bg-muted hover:text-foreground hover:opacity-100 group-hover/kcard:opacity-100"
                title="Ações do cliente"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
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

        <div className="mt-2 space-y-0.5">
          <div className="flex items-center gap-1.5 text-[11px] leading-snug text-muted-foreground">
            <User className="size-3 shrink-0 text-primary/60" />
            <span className="min-w-0 flex-1 truncate" title={c.responsavel_nome ?? "—"}>
              <span className="text-foreground/70">Resp:</span> {c.responsavel_nome ?? "—"}
            </span>
          </div>
          {c.analista_nome && (
            <div className="flex items-center gap-1.5 text-[11px] leading-snug text-muted-foreground">
              <UserCheck className="size-3 shrink-0 text-primary/60" />
              <span className="min-w-0 flex-1 truncate" title={c.analista_nome}>
                <span className="text-foreground/70">Analista:</span> {c.analista_nome}
              </span>
            </div>
          )}
          {(c.corretor_nome || c.imobiliaria_nome) && (
            <div className="flex items-center gap-1.5 text-[11px] leading-snug text-muted-foreground">
              <Building2 className="size-3 shrink-0 text-primary/60" />
              <span
                className="min-w-0 flex-1 truncate"
                title={[c.corretor_nome, c.imobiliaria_nome].filter(Boolean).join(" · ")}
              >
                {c.corretor_nome ?? c.imobiliaria_nome}
                {c.corretor_nome && c.imobiliaria_nome && (
                  <span className="text-muted-foreground/60"> · {c.imobiliaria_nome}</span>
                )}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
            <Clock className="size-2.5 shrink-0" />
            <span className="truncate">Atualizado {tempoRelativo(c.pipeline_atualizado_em)}</span>
          </div>
        </div>

        {c.numero_simulacao && (
          <div className="mt-2 flex items-center gap-1.5">
            <Link
              to="/operacional/simulacoes"
              onClick={(e) => e.stopPropagation()}
              title={`Ver simulação ${c.numero_simulacao}`}
              className="inline-flex min-w-0 items-center gap-1 rounded-full bg-primary/[0.06] px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-inset ring-primary/15 transition-colors hover:bg-primary/12"
            >
              <Calculator className="size-2.5 shrink-0" />
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
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 px-3 py-1.5">
          {temProposta ? (
            <Link
              to="/operacional/propostas/kanban"
              search={{ q: c.numero_proposta ?? c.nome }}
              onClick={(e) => e.stopPropagation()}
              title={`Ver proposta ${c.numero_proposta}`}
              className="group/kb inline-flex min-w-0 items-center gap-1 rounded-full bg-primary/[0.06] px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-inset ring-primary/15 transition-all duration-200 hover:bg-primary/12"
            >
              <KanbanSquare className="size-2.5 shrink-0" />
              <span className="truncate font-mono">{c.numero_proposta}</span>
              <ChevronRight className="size-2.5 shrink-0 -translate-x-0.5 opacity-0 transition-all duration-200 group-hover/kb:translate-x-0 group-hover/kb:opacity-100" />
            </Link>
          ) : (
            <span className="text-[10px] italic text-muted-foreground/70">
              Sem proposta vinculada
            </span>
          )}
          {temProposta && c.nome_banco && (
            <span
              className="inline-flex min-w-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset"
              style={{
                color: corBanco,
                borderColor: `color-mix(in oklab, ${corBanco} 30%, transparent)`,
                backgroundColor: `color-mix(in oklab, ${corBanco} 8%, transparent)`,
                // @ts-expect-error inline var
                "--tw-ring-color": `color-mix(in oklab, ${corBanco} 30%, transparent)`,
              }}
              title={c.nome_banco}
            >
              <BancoLogo nome={c.nome_banco} size="xs" className="shrink-0" />
              <span className="truncate max-w-[80px]">{c.nome_banco}</span>
            </span>
          )}
          {temProposta && c.proposta_status && (
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ring-inset ${statusClasse}`}
            >
              {statusProposta(c.proposta_status).label}
            </span>
          )}
        </div>
      )}

      {ehVistoria && (
        <div className="space-y-1.5 border-t border-border/50 px-3 py-2">
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
        <div className="border-t border-border/50 px-3 py-2">
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
