import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  ArrowLeft,
  ChevronDown,
  Clock,
  Download,
  Maximize2,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Users,
} from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  obterDemanda,
  moverStatusDemanda,
  transicaoDemandaPermitida,
  type DemandaStatus,
} from "@/lib/operacional/demandas.functions";
import { DemandaChatConversa } from "@/components/operacional/demanda-chat";
import {
  abrirDemandaChatFlutuante,
  useFloatingChats,
  fecharChatFlutuante,
} from "@/components/shared/floating-chat-store";
import { statusDemanda } from "@/components/operacional/status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ColunaLateral } from "@/components/operacional/demanda-page/coluna-lateral";
import { ChatFlutuandoAviso, StatPill, TabBtn } from "@/components/operacional/demanda-page/ui";
import {
  ArquivosTab,
  AtividadesTab,
  NotasInternas,
} from "@/components/operacional/demanda-page/tabs";
import { formatarTempoAberto } from "@/components/operacional/demanda-page/helpers";

export const Route = createFileRoute("/_authenticated/operacional/demandas_/$id")({
  head: () => ({ meta: [{ title: "Demanda — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.demandas"),
  component: Pagina,
});

type Aba = "conversas" | "notas" | "arquivos" | "atividades";

function Pagina() {
  const { id } = useParams({ from: "/_authenticated/operacional/demandas_/$id" });
  const qc = useQueryClient();
  const moverFn = useServerFn(moverStatusDemanda);
  const [aba, setAba] = useState<Aba>("conversas");
  const [copiado, setCopiado] = useState(false);
  const janelas = useFloatingChats();
  const estaFlutuando = janelas.some((c) => c.kind === "demanda" && c.demandaId === id);

  const { data, refetch } = useQuery({
    queryKey: ["demanda", id],
    queryFn: () => obterDemanda({ data: { id } }),
  });

  async function trocarStatus(novo: DemandaStatus) {
    if (!data?.demanda) return;
    if (!transicaoDemandaPermitida(data.demanda.status as DemandaStatus, novo)) {
      toast.error("Transição de status não permitida.");
      return;
    }
    try {
      await moverFn({ data: { id, status: novo } });
      refetch();
      qc.invalidateQueries({ queryKey: ["demandas"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao mover status.");
    }
  }

  async function copiarNumero() {
    if (!data?.demanda?.numero) return;
    await navigator.clipboard.writeText(data.demanda.numero);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1200);
  }

  const d = data?.demanda as any;
  const mensagens = data?.mensagens ?? [];
  const participantes = data?.participantes ?? [];
  const anexos = data?.anexos ?? [];
  const historico = data?.historico ?? [];

  const participantesIds = useMemo(
    () => (participantes as any[]).map((p) => p.user_id),
    [participantes],
  );

  if (!data) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  if (!d)
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Demanda não encontrada.</p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link to="/operacional/demandas">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>
    );

  const cfg = statusDemanda(d.status as DemandaStatus);
  const tempoAberto = formatarTempoAberto(d.created_at ?? d.criado_em, d.concluida_em);
  const interlocutorDemandaNome = data.permissoes?.sou_criador
    ? data.nome_responsavel
    : data.permissoes?.sou_responsavel
      ? data.nome_criador
      : (data.nome_responsavel ?? data.nome_criador);

  return (
    <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1400px] gap-5 p-4 md:p-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <ColunaLateral
        id={id}
        data={data}
        d={d}
        participantesIds={participantesIds}
        copiado={copiado}
        onCopiarNumero={copiarNumero}
        onTrocarStatus={trocarStatus}
        refetch={refetch}
        qc={qc}
      />

      <section className="flex min-h-0 min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatPill
            icone={<Clock className="h-4 w-4 text-primary" />}
            valor={tempoAberto}
            label="Tempo em aberto"
          />
          <StatPill
            icone={<MessageCircle className="h-4 w-4 text-primary" />}
            valor={String(mensagens.length)}
            label="Mensagens"
          />
          <StatPill
            icone={<Paperclip className="h-4 w-4 text-primary" />}
            valor={String(anexos.length)}
            label="Anexos"
          />
          <StatPill
            icone={<Users className="h-4 w-4 text-primary" />}
            valor={String(participantes.length)}
            label="Participantes"
          />

          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  Mais ações <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => window.print()}>
                  <Download className="mr-2 h-4 w-4" /> Exportar / imprimir
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setAba("atividades")}>
                  <Activity className="mr-2 h-4 w-4" /> Ver histórico
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              onClick={() => document.documentElement.requestFullscreen?.()}
              title="Expandir"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border/60 px-4">
            <div className="flex">
              <TabBtn active={aba === "conversas"} onClick={() => setAba("conversas")}>
                Conversas
              </TabBtn>
              <TabBtn active={aba === "notas"} onClick={() => setAba("notas")}>
                Notas internas
              </TabBtn>
              <TabBtn active={aba === "arquivos"} onClick={() => setAba("arquivos")}>
                Arquivos{" "}
                {anexos.length > 0 && (
                  <span className="ml-1 text-[10px] text-muted-foreground">({anexos.length})</span>
                )}
              </TabBtn>
              <TabBtn active={aba === "atividades"} onClick={() => setAba("atividades")}>
                Atividades
              </TabBtn>
            </div>
            <div className="flex items-center gap-1.5 py-2">
              {aba === "conversas" && !estaFlutuando && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() =>
                    abrirDemandaChatFlutuante(id, {
                      numero: d.numero,
                      titulo: d.titulo,
                      statusLabel: cfg.label,
                      interlocutorNome: interlocutorDemandaNome,
                    })
                  }
                >
                  <Maximize2 className="h-3.5 w-3.5" /> Soltar chat
                </Button>
              )}
              {aba === "conversas" && estaFlutuando && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => fecharChatFlutuante("demanda", id)}
                >
                  Reacoplar chat
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => refetch()}>Atualizar conversa</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            {aba === "conversas" &&
              (estaFlutuando ? (
                <ChatFlutuandoAviso tipo="demanda" id={id} />
              ) : (
                <DemandaChatConversa
                  demandaId={id}
                  info={{
                    numero: d.numero,
                    titulo: d.titulo,
                    statusLabel: cfg.label,
                    interlocutorNome: interlocutorDemandaNome,
                  }}
                />
              ))}
            {aba === "notas" && <NotasInternas />}
            {aba === "arquivos" && <ArquivosTab anexos={anexos} />}
            {aba === "atividades" && <AtividadesTab historico={historico} />}
          </div>
        </div>
      </section>
    </div>
  );
}
