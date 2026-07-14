import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Phone,
  Mail,
  MessageCircle,
  ExternalLink,
  FileText,
  CalendarClock,
  ListChecks,
  Calculator,
  Loader2,
  Tag,
  Check,
  Circle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { obterPainelChatCliente } from "@/lib/crm/chat-cliente.functions";
import { type ChatEtiqueta } from "@/lib/crm/chat-gestao.functions";
import { iniciais } from "./utils";

const TABS = [
  { id: "cliente", label: "Cliente" },
  { id: "detalhes", label: "Detalhes" },
  { id: "interacoes", label: "Interações" },
  { id: "arquivos", label: "Arquivos" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Cinco macro-etapas exibidas no stepper do painel. Cada uma agrupa os
 * códigos internos da tabela pipeline_stages. */
const MACRO_STAGES = [
  { key: "simulacao", label: "Simulação", codes: ["cadastro_basico", "cadastro_completo", "simulacao"] },
  { key: "documentacao", label: "Documentação", codes: ["coleta_documentos"] },
  { key: "analise", label: "Análise", codes: ["engenharia_vistoria", "analise_juridica", "credito_enviado"] },
  { key: "proposta", label: "Proposta", codes: ["credito_aprovado"] },
  { key: "contratacao", label: "Contratação", codes: ["contrato_emitido"] },
] as const;

function macroIndexOf(codigo: string | null): number {
  if (!codigo) return 0;
  for (let i = 0; i < MACRO_STAGES.length; i++) {
    if ((MACRO_STAGES[i].codes as readonly string[]).includes(codigo)) return i;
  }
  return 0;
}

function formatarBRL(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function LinhaResumo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{rotulo}</span>
      <span className="min-w-0 truncate text-right font-medium text-foreground">
        {valor}
      </span>
    </div>
  );
}

function BotaoAcao({
  to,
  params,
  icon: Icon,
  children,
}: {
  to: string;
  params?: Record<string, string>;
  icon: typeof FileText;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      params={params}
      className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <Icon className="size-4 shrink-0 text-primary" />
      <span className="truncate">{children}</span>
    </Link>
  );
}

function Stepper({ atualIdx }: { atualIdx: number }) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Status e etapa
      </p>
      <Badge
        variant="secondary"
        className="mb-3 rounded-full border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary"
      >
        {MACRO_STAGES[atualIdx]?.label ?? "Em análise"}
      </Badge>
      <div className="flex items-start justify-between gap-1">
        {MACRO_STAGES.map((s, i) => {
          const feito = i < atualIdx;
          const atual = i === atualIdx;
          return (
            <div key={s.key} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-center">
                {/* linha esquerda */}
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    i === 0 ? "opacity-0" : feito || atual ? "bg-primary" : "bg-border",
                  )}
                />
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    feito
                      ? "border-primary bg-primary text-primary-foreground"
                      : atual
                        ? "border-primary bg-background text-primary"
                        : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {feito ? (
                    <Check className="size-3" />
                  ) : (
                    <Circle className={cn("size-2 fill-current", atual ? "" : "opacity-50")} />
                  )}
                </div>
                {/* linha direita */}
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    i === MACRO_STAGES.length - 1 ? "opacity-0" : feito ? "bg-primary" : "bg-border",
                  )}
                />
              </div>
              <span
                className={cn(
                  "text-center text-[10px] font-medium leading-tight",
                  atual ? "text-foreground" : feito ? "text-primary" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PainelChatCliente({
  clienteId,
  etiquetas = [],
}: {
  clienteId: string;
  etiquetas?: ChatEtiqueta[];
}) {
  const [tab, setTab] = useState<TabId>("cliente");
  const painelFn = useServerFn(obterPainelChatCliente);
  const { data, isLoading } = useQuery({
    queryKey: ["painel-chat-cliente", clienteId],
    queryFn: () => painelFn({ data: { cliente_id: clienteId } }),
    staleTime: 30_000,
  });

  const zap = useMemo(() => {
    const cel = (data?.celular ?? "").replace(/\D/g, "");
    return cel ? `https://wa.me/55${cel}` : null;
  }, [data?.celular]);

  const atualIdx = useMemo(() => macroIndexOf(data?.etapa_codigo ?? null), [data?.etapa_codigo]);

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/60 shadow-sm">
      <div className="flex shrink-0 gap-1 border-b bg-muted/30 px-2 pt-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "relative rounded-t-lg px-3 py-2 text-xs font-medium transition-colors",
              tab === t.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>
        ) : tab === "cliente" ? (
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
                      data.ativo
                        ? "App do cliente habilitado."
                        : "App do cliente ainda não habilitado."
                    }
                  >
                    {data.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                {data.documento && (
                  <p className="truncate text-xs text-muted-foreground">
                    {data.documento}
                  </p>
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

            {/* Resumo rápido */}
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Resumo da proposta
                </p>
                {data.proposta?.status && (
                  <Badge variant="secondary" className="text-[10px]">
                    {data.proposta.status}
                  </Badge>
                )}
              </div>
              {data.proposta ? (
                <>
                  <LinhaResumo
                    rotulo="Proposta"
                    valor={data.proposta.numero ?? "—"}
                  />
                  <LinhaResumo rotulo="Banco" valor={data.proposta.banco ?? "—"} />
                  <LinhaResumo
                    rotulo="Produto"
                    valor={data.proposta.produto ?? "—"}
                  />
                  <LinhaResumo
                    rotulo="Valor solicitado"
                    valor={formatarBRL(data.proposta.valor)}
                  />
                  <LinhaResumo
                    rotulo="Responsável"
                    valor={data.responsavel_nome ?? "—"}
                  />
                  <Link
                    to="/operacional/propostas/$id"
                    params={{ id: data.proposta.id }}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                  >
                    Ver proposta <ExternalLink className="size-3.5" />
                  </Link>
                </>
              ) : (
                <>
                  <LinhaResumo rotulo="Etapa" valor={data.etapa_nome ?? "—"} />
                  <LinhaResumo
                    rotulo="Responsável"
                    valor={data.responsavel_nome ?? "—"}
                  />
                  <p className="pt-2 text-xs text-muted-foreground">
                    Ainda sem proposta cadastrada.
                  </p>
                </>
              )}
            </div>

            {/* Status e etapa (stepper) */}
            <Stepper atualIdx={atualIdx} />

            {/* Ações rápidas */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ações rápidas
              </p>
              <div className="grid grid-cols-2 gap-2">
                <BotaoAcao
                  to="/crm/clientes/$id"
                  params={{ id: clienteId }}
                  icon={FileText}
                >
                  Enviar documento
                </BotaoAcao>
                <BotaoAcao
                  to="/crm/clientes/$id"
                  params={{ id: clienteId }}
                  icon={CalendarClock}
                >
                  Agendar retorno
                </BotaoAcao>
                <BotaoAcao
                  to="/crm/clientes/$id"
                  params={{ id: clienteId }}
                  icon={ListChecks}
                >
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
                    <span
                      key={e.id}
                      className={cn("chat-tag", `chat-tag-${e.cor}`)}
                    >
                      {e.nome}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Tag className="size-3.5" /> Nenhuma etiqueta. Use a barra de
                  gestão acima para adicionar.
                </p>
              )}
            </div>
          </div>
        ) : tab === "detalhes" ? (
          <div className="space-y-3 text-sm">
            <LinhaResumo rotulo="Nome" valor={data.nome ?? "—"} />
            <LinhaResumo rotulo="Documento" valor={data.documento ?? "—"} />
            <LinhaResumo rotulo="Celular" valor={data.celular ?? "—"} />
            <LinhaResumo rotulo="E-mail" valor={data.email ?? "—"} />
            <LinhaResumo rotulo="Etapa" valor={data.etapa_nome ?? "—"} />
            <LinhaResumo rotulo="Responsável" valor={data.responsavel_nome ?? "—"} />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-muted-foreground">
              {tab === "interacoes"
                ? "Veja o histórico completo de interações na ficha do cliente."
                : "Veja e gerencie os arquivos na ficha do cliente."}
            </p>
            <Link
              to="/crm/clientes/$id"
              params={{ id: clienteId }}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" /> Abrir ficha do cliente
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}
