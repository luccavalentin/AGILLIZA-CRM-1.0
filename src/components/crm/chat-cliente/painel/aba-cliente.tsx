import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  Calculator,
  ExternalLink,
  FileText,
  ListChecks,
  Mail,
  MessageCircle,
  Phone,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BancoChip } from "@/components/bancos/banco-chip";
import { type ChatEtiqueta } from "@/lib/crm/chat-gestao.functions";
import { iniciais } from "../utils";
import { BotaoAcao, LinhaResumo } from "./painel-primitivos";
import { Stepper } from "./painel-stepper";
import { formatarBRL } from "./painel-utils";

interface PropostaResumo {
  id: string;
  numero: string | null;
  banco: string | null;
  produto: string | null;
  valor: number | null;
  status: string | null;
}

interface DadosCliente {
  nome: string | null;
  ativo: boolean;
  documento: string | null;
  celular: string | null;
  email: string | null;
  etapa_nome: string | null;
  responsavel_nome: string | null;
  proposta: PropostaResumo | null;
}

export function AbaCliente({
  clienteId,
  data,
  zap,
  atualIdx,
  encerradaMotivo,
  etiquetas,
}: {
  clienteId: string;
  data: DadosCliente;
  zap: string | null;
  atualIdx: number;
  encerradaMotivo: "recusado" | "cancelada" | null;
  etiquetas: ChatEtiqueta[];
}) {
  return (
    <div className="space-y-5">
      {/* Identificação */}
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-sm font-semibold text-primary-foreground shadow-sm">
          {iniciais(data.nome)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate text-sm font-semibold text-foreground">
              {data.nome ?? "Cliente"}
            </p>
            <Badge
              variant="outline"
              className={cn(
                "h-5 shrink-0 rounded-full px-2 text-[10px] font-medium",
                data.ativo
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-border bg-muted text-muted-foreground",
              )}
              title={
                data.ativo ? "App do cliente habilitado." : "App do cliente ainda não habilitado."
              }
            >
              {data.ativo ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          {data.documento && (
            <p className="truncate text-xs text-muted-foreground">{data.documento}</p>
          )}
        </div>
      </div>

      {/* Contatos */}
      <div className="space-y-1.5 text-sm">
        {data.celular && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="size-4 shrink-0" />
            <span className="truncate text-foreground">{data.celular}</span>
            {zap && (
              <a
                href={zap}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-emerald-600 hover:text-emerald-700"
                title="Abrir no WhatsApp"
              >
                <MessageCircle className="size-4" />
              </a>
            )}
          </div>
        )}
        {data.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="size-4 shrink-0" />
            <span className="truncate text-foreground">{data.email}</span>
          </div>
        )}
        <Link
          to="/crm/clientes/$id"
          params={{ id: clienteId }}
          className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary hover:underline"
        >
          <ExternalLink className="size-3.5" /> Ver perfil completo
        </Link>
      </div>

      {/* Resumo da proposta */}
      <div className="border-t border-border/60 pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Resumo da proposta
          </p>
          {data.proposta?.status && (
            <Badge
              variant="secondary"
              className="rounded-full border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
            >
              {data.proposta.status}
            </Badge>
          )}
        </div>
        {data.proposta ? (
          <div className="divide-y divide-border/50">
            <LinhaResumo rotulo="Proposta" valor={data.proposta.numero ?? "—"} />
            <LinhaResumo
              rotulo="Banco"
              valor={data.proposta.banco ? <BancoChip nome={data.proposta.banco} /> : "—"}
            />
            <LinhaResumo rotulo="Produto" valor={data.proposta.produto ?? "—"} />
            <LinhaResumo rotulo="Valor solicitado" valor={formatarBRL(data.proposta.valor)} />
            <LinhaResumo rotulo="Responsável" valor={data.responsavel_nome ?? "—"} />
            <div className="pt-3">
              <Link
                to="/operacional/propostas/$id"
                params={{ id: data.proposta.id }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                Ver proposta <ExternalLink className="size-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            <LinhaResumo rotulo="Etapa" valor={data.etapa_nome ?? "—"} />
            <LinhaResumo rotulo="Responsável" valor={data.responsavel_nome ?? "—"} />
            <p className="pt-2 text-xs text-muted-foreground">Ainda sem proposta cadastrada.</p>
          </div>
        )}
      </div>

      {/* Stepper */}
      <Stepper atualIdx={atualIdx} encerradaMotivo={encerradaMotivo} />

      {/* Ações rápidas */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ações rápidas
        </p>
        <div className="grid grid-cols-2 gap-2">
          <BotaoAcao to="/crm/clientes/$id" params={{ id: clienteId }} icon={FileText}>
            Enviar documento
          </BotaoAcao>
          <BotaoAcao to="/crm/clientes/$id" params={{ id: clienteId }} icon={CalendarClock}>
            Agendar retorno
          </BotaoAcao>
          <BotaoAcao to="/crm/clientes/$id" params={{ id: clienteId }} icon={ListChecks}>
            Criar tarefa
          </BotaoAcao>
          <BotaoAcao to="/operacional/simulacoes/nova" icon={Calculator}>
            Nova simulação
          </BotaoAcao>
        </div>
      </div>

      {/* Etiquetas */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Etiquetas
        </p>
        {etiquetas.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {etiquetas.map((e) => (
              <span key={e.id} className={cn("chat-tag", `chat-tag-${e.cor}`)}>
                {e.nome}
              </span>
            ))}
          </div>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Tag className="size-3.5" /> Nenhuma etiqueta. Use a barra de gestão acima para
            adicionar.
          </p>
        )}
      </div>
    </div>
  );
}
