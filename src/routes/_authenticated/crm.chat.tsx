import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessagesSquare, Search, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { assertModuloPermitido } from "@/lib/route-guards";
import { supabase } from "@/integrations/supabase/client";
import { ChatClienteTab } from "@/components/crm/chat-cliente-tab";
import {
  listarConversasCliente,
  buscarClientesApp,
} from "@/lib/crm/chat-cliente.functions";
import {
  getPipelineStages,
  getClientePipeline,
  moverEtapa,
} from "@/lib/crm/clientes.functions";

export const Route = createFileRoute("/_authenticated/crm/chat")({
  head: () => ({ meta: [{ title: "Chat e Follow-up Cliente — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
});

function formatarHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Pagina() {
  const qc = useQueryClient();
  const listar = useServerFn(listarConversasCliente);
  const buscarApp = useServerFn(buscarClientesApp);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const queryKey = ["conversas-cliente"];
  const { data: conversas, isLoading } = useQuery({
    queryKey,
    queryFn: () => listar(),
  });

  // Clientes com App habilitado (mesmo sem conversa ainda) para iniciar chat.
  const termoBusca = busca.trim();
  const { data: clientesApp, isFetching: buscandoApp } = useQuery({
    queryKey: ["clientes-app", termoBusca],
    queryFn: () => buscarApp({ data: { q: termoBusca || undefined } }),
    enabled: termoBusca.length >= 2,
  });

  // Sincroniza a lista em tempo real quando qualquer mensagem chega/sai.
  useEffect(() => {
    const canal = supabase
      .channel("chat-conversas")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cliente_app_mensagens" },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const lista = conversas ?? [];
    if (!t) return lista;
    return lista.filter(
      (c) =>
        c.nome.toLowerCase().includes(t) ||
        (c.documento ?? "").toLowerCase().includes(t),
    );
  }, [conversas, busca]);

  // Clientes App habilitados que ainda não têm conversa (para iniciar chat).
  const novosClientes = useMemo(() => {
    if (termoBusca.length < 2) return [];
    const jaEmConversa = new Set((conversas ?? []).map((c) => c.cliente_id));
    return (clientesApp ?? []).filter((c) => !jaEmConversa.has(c.cliente_id));
  }, [clientesApp, conversas, termoBusca]);

  const conversaAtual = (conversas ?? []).find(
    (c) => c.cliente_id === selecionado,
  );
  const clienteAppAtual = (clientesApp ?? []).find(
    (c) => c.cliente_id === selecionado,
  );
  const alvoAtual = conversaAtual
    ? {
        cliente_id: conversaAtual.cliente_id,
        nome: conversaAtual.nome,
        documento: conversaAtual.documento,
        etapa_nome: conversaAtual.etapa_nome ?? null,
      }
    : clienteAppAtual
      ? {
          cliente_id: clienteAppAtual.cliente_id,
          nome: clienteAppAtual.nome,
          documento: clienteAppAtual.documento,
          etapa_nome: clienteAppAtual.etapa_nome,
        }
      : null;

  // Seleção automática da primeira conversa.
  useEffect(() => {
    if (!selecionado && (conversas?.length ?? 0) > 0) {
      setSelecionado(conversas![0].cliente_id);
    }
  }, [conversas, selecionado]);



  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <MessagesSquare className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Chat e Follow-up Cliente
          </h1>
          <p className="text-sm text-muted-foreground">
            Converse com os clientes pelo App e acompanhe/avançe as etapas do
            processo. Tudo é sincronizado em tempo real.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        {/* Lista de conversas */}
        <Card className="flex h-[36rem] flex-col overflow-hidden">
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar cliente…"
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : filtradas.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma conversa ainda.
              </p>
            ) : (
              filtradas.map((c) => (
                <button
                  key={c.cliente_id}
                  onClick={() => setSelecionado(c.cliente_id)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                    selecionado === c.cliente_id && "bg-muted",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {c.nome}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatarHora(c.ultima_em)}
                    </span>
                  </div>
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
                  {c.etapa_nome && (
                    <span className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      Etapa: {c.etapa_nome}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Chat + follow-up */}
        {conversaAtual ? (
          <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
            <ChatClienteTab
              key={conversaAtual.cliente_id}
              clienteId={conversaAtual.cliente_id}
              info={{
                nome: conversaAtual.nome,
                documento: conversaAtual.documento,
                contexto: conversaAtual.etapa_nome ?? undefined,
              }}
            />
            <FollowUpPanel
              clienteId={conversaAtual.cliente_id}
              nome={conversaAtual.nome}
            />
          </div>
        ) : (
          <Card className="flex h-[36rem] items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Selecione uma conversa para começar.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

function FollowUpPanel({
  clienteId,
  nome,
}: {
  clienteId: string;
  nome: string;
}) {
  const qc = useQueryClient();
  const getStages = useServerFn(getPipelineStages);
  const getAtual = useServerFn(getClientePipeline);
  const mover = useServerFn(moverEtapa);
  const [destino, setDestino] = useState<string>("");

  const { data: stages } = useQuery({
    queryKey: ["pipeline-stages"],
    queryFn: () => getStages(),
  });
  const { data: atual } = useQuery({
    queryKey: ["cliente-pipeline", clienteId],
    queryFn: () => getAtual({ data: { cliente_id: clienteId } }),
  });

  const avancar = useMutation({
    mutationFn: (codigo: string) =>
      mover({ data: { cliente_id: clienteId, codigo_destino: codigo } }),
    onSuccess: () => {
      toast.success("Etapa atualizada e sincronizada com o App do cliente.");
      setDestino("");
      qc.invalidateQueries({ queryKey: ["cliente-pipeline", clienteId] });
      qc.invalidateQueries({ queryKey: ["conversas-cliente"] });
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Não foi possível mover a etapa.",
      ),
  });

  return (
    <Card className="h-[36rem] overflow-y-auto">
      <CardContent className="space-y-4 p-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Follow-up</p>
          <p className="text-xs text-muted-foreground">Esteira de {nome}</p>
        </div>

        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Etapa atual
          </p>
          <p className="text-sm font-medium text-foreground">
            {stages?.find((s) => s.codigo === atual?.codigo)?.nome ??
              "Cadastro básico"}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Avançar etapa</p>
          <Select value={destino} onValueChange={setDestino}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a etapa…" />
            </SelectTrigger>
            <SelectContent>
              {(stages ?? []).map((s) => (
                <SelectItem key={s.codigo} value={s.codigo}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="w-full"
            disabled={!destino || avancar.isPending || destino === atual?.codigo}
            onClick={() => avancar.mutate(destino)}
          >
            {avancar.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            Mover etapa
          </Button>
        </div>

        <div className="space-y-1.5 border-t pt-3">
          <p className="text-xs font-medium text-foreground">Progresso</p>
          <ol className="space-y-1">
            {(stages ?? []).map((s) => {
              const ativa = s.codigo === atual?.codigo;
              const passada = (s.ordem ?? 0) < (atual?.ordem ?? 0);
              return (
                <li
                  key={s.codigo}
                  className={cn(
                    "flex items-center gap-2 text-xs",
                    ativa
                      ? "font-semibold text-primary"
                      : passada
                        ? "text-muted-foreground line-through"
                        : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      ativa || passada ? "bg-primary" : "bg-muted-foreground/40",
                    )}
                  />
                  {s.nome}
                </li>
              );
            })}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
