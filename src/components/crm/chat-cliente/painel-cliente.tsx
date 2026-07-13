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
                <p className="truncate text-sm font-semibold text-foreground">
                  {data.nome ?? "Cliente"}
                </p>
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
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Resumo rápido
              </p>
              {data.proposta ? (
                <>
                  <div className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-sm text-muted-foreground">Proposta</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {data.proposta.numero ?? "—"}
                      </span>
                      {data.proposta.status && (
                        <Badge variant="secondary" className="text-[10px]">
                          {data.proposta.status}
                        </Badge>
                      )}
                    </div>
                  </div>
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
                    Ver proposta
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
