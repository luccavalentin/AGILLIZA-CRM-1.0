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
  AlertOctagon,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { obterPainelChatCliente } from "@/lib/crm/chat-cliente.functions";
import {
  listarInteracoes,
  listarDocumentos,
  urlDocumento,
} from "@/lib/crm/clientes.functions";
import { type ChatEtiqueta } from "@/lib/crm/chat-gestao.functions";
import { iniciais } from "./utils";
import { BancoChip } from "@/components/bancos/banco-chip";


const TABS = [
  { id: "cliente", label: "Cliente" },
  { id: "detalhes", label: "Detalhes" },
  { id: "interacoes", label: "Interações" },
  { id: "arquivos", label: "Arquivos" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Cinco macro-etapas do fluxo real (state machine da proposta):
 *  Simulação → Crédito (envio+análise no banco) → Documentação (após
 *  aprovado, coleta e organização) → Vistoria & Jurídico (engenharia +
 *  análise jurídica) → Contrato. `credito_recusado` encerra o fluxo. */
const MACRO_STAGES = [
  { key: "simulacao", label: "Simulação", codes: ["cadastro_basico", "cadastro_completo", "simulacao"] },
  { key: "credito", label: "Crédito", codes: ["credito_enviado"] },
  {
    key: "documentacao",
    label: "Documentação",
    codes: ["credito_aprovado", "coleta_documentos", "aguardando_documentos"],
  },
  { key: "vistoria", label: "Vistoria & Jurídico", codes: ["engenharia_vistoria", "analise_juridica"] },
  { key: "contratacao", label: "Contrato", codes: ["contrato_emitido"] },
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

function Stepper({
  atualIdx,
  encerradaMotivo,
}: {
  atualIdx: number;
  encerradaMotivo: "recusado" | "cancelada" | null;
}) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Status e etapa
      </p>
      {encerradaMotivo ? (
        <Badge
          variant="secondary"
          className="mb-3 inline-flex items-center gap-1 rounded-full border-destructive/25 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-medium text-destructive"
        >
          <AlertOctagon className="size-3" />
          {encerradaMotivo === "recusado" ? "Crédito recusado — encerrada" : "Proposta cancelada"}
        </Badge>
      ) : (
        <Badge
          variant="secondary"
          className="mb-3 rounded-full border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary"
        >
          {MACRO_STAGES[atualIdx]?.label ?? "Em análise"}
        </Badge>
      )}

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
                  <LinhaResumo
                    rotulo="Proposta"
                    valor={data.proposta.numero ?? "—"}
                  />
                  <LinhaResumo
                    rotulo="Banco"
                    valor={
                      data.proposta.banco ? (
                        <BancoChip nome={data.proposta.banco} />
                      ) : (
                        "—"
                      )
                    }
                  />
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
                  <LinhaResumo
                    rotulo="Responsável"
                    valor={data.responsavel_nome ?? "—"}
                  />
                  <p className="pt-2 text-xs text-muted-foreground">
                    Ainda sem proposta cadastrada.
                  </p>
                </div>
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
        ) : tab === "interacoes" ? (
          <AbaInteracoes clienteId={clienteId} />
        ) : (
          <AbaArquivos clienteId={clienteId} />
        )}

      </div>
    </Card>
  );
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo",  
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarTamanho(b: number | null | undefined): string {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function AbaInteracoes({ clienteId }: { clienteId: string }) {
  const fn = useServerFn(listarInteracoes);
  const { data, isLoading } = useQuery({
    queryKey: ["chat-painel-interacoes", clienteId],
    queryFn: () => fn({ data: { cliente_id: clienteId } }),
    staleTime: 30_000,
  });
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const lista = (data ?? []) as Array<{
    id: string;
    canal: string | null;
    resultado: string | null;
    observacao: string | null;
    ocorrido_em: string | null;
    responsavel?: { nome: string | null } | null;
  }>;
  if (lista.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <MessageCircle className="size-6 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">
          Nenhuma interação registrada ainda.
        </p>
        <Link
          to="/crm/clientes/$id"
          params={{ id: clienteId }}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ExternalLink className="size-3.5" /> Registrar na ficha
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {lista.map((i) => (
        <div
          key={i.id}
          className="rounded-xl border border-border/60 bg-background p-3 shadow-sm"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <Badge
              variant="secondary"
              className="rounded-full border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
            >
              {i.canal ?? "interação"}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {formatarData(i.ocorrido_em)}
            </span>
          </div>
          {i.resultado && (
            <p className="text-sm font-medium text-foreground">{i.resultado}</p>
          )}
          {i.observacao && (
            <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">
              {i.observacao}
            </p>
          )}
          {i.responsavel?.nome && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              por {i.responsavel.nome}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}


function AbaArquivos({ clienteId }: { clienteId: string }) {
  const fn = useServerFn(listarDocumentos);
  const urlFn = useServerFn(urlDocumento);
  const { data, isLoading } = useQuery({
    queryKey: ["chat-painel-arquivos", clienteId],
    queryFn: () => fn({ data: { cliente_id: clienteId } }),
    staleTime: 30_000,
  });
  async function abrir(storagePath: string) {
    try {
      const r = await urlFn({ data: { storage_path: storagePath } });
      if (r?.url) window.open(r.url, "_blank", "noopener");
    } catch {
      /* ignore */
    }
  }
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const lista = (data ?? []) as Array<{
    id: string;
    nome_arquivo: string;
    tipo_documento: string | null;
    categoria: string | null;
    status: string | null;
    tamanho_bytes: number | null;
    storage_path: string;
    created_at: string | null;
    enviado_por_nome?: string | null;
  }>;
  if (lista.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <FileText className="size-6 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">
          Nenhum arquivo enviado ainda.
        </p>
        <Link
          to="/crm/clientes/$id"
          params={{ id: clienteId }}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ExternalLink className="size-3.5" /> Enviar na ficha
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {lista.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => abrir(a.storage_path)}
          className="flex w-full items-start gap-3 rounded-xl border border-border/60 bg-background p-3 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {a.nome_arquivo}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
              {a.tipo_documento && <span>{a.tipo_documento}</span>}
              {a.categoria && <span>· {a.categoria}</span>}
              <span>· {formatarTamanho(a.tamanho_bytes)}</span>
              <span>· {formatarData(a.created_at)}</span>
            </div>
            {a.enviado_por_nome && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                por {a.enviado_por_nome}
              </p>
            )}
          </div>
          {a.status && (
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                a.status === "aprovado"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : a.status === "reprovado"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-border bg-muted text-muted-foreground",
              )}
            >
              {a.status}
            </Badge>
          )}
        </button>
      ))}
    </div>
  );
}

