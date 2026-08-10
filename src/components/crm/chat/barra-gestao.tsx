import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlarmClock,
  Archive,
  ArchiveRestore,
  ArrowRight,
  BellRing,
  Check,
  ChevronDown,
  GitBranch,
  Loader2,
  Plus,
  Tag,
  Timer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getPipelineStages, getClientePipeline, moverEtapa } from "@/lib/crm/clientes.functions";
import {
  criarEtiquetaChat,
  definirArquivamentoConversa,
  definirEtiquetasCliente,
  excluirEtiquetaChat,
  getChatMeta,
  overviewGestaoChat,
  salvarChatMeta,
  type ChatEtiqueta,
} from "@/lib/crm/chat-gestao.functions";
import { CORES, iniciais } from "./helpers";
import { TagChip } from "./tag-chip";

export function MaisAcoesGestao(props: {
  clienteId: string;
  nome: string;
  documento?: string | null;
  contexto?: string | null;
  etiquetas: ChatEtiqueta[];
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-9 shrink-0 gap-1.5 rounded-lg px-0 sm:w-auto sm:px-3"
        >
          <span className="hidden sm:inline">Mais ações</span>
          <ChevronDown className="size-4 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <BarraGestao {...props} />
      </PopoverContent>
    </Popover>
  );
}

function BarraGestao({
  clienteId,
  nome,
  documento,
  contexto,
  etiquetas,
}: {
  clienteId: string;
  nome: string;
  documento?: string | null;
  contexto?: string | null;
  etiquetas: ChatEtiqueta[];
}) {
  const qc = useQueryClient();
  const getStages = useServerFn(getPipelineStages);
  const getAtual = useServerFn(getClientePipeline);
  const mover = useServerFn(moverEtapa);
  const getMeta = useServerFn(getChatMeta);
  const salvarMeta = useServerFn(salvarChatMeta);
  const arquivar = useServerFn(definirArquivamentoConversa);
  const definirTags = useServerFn(definirEtiquetasCliente);
  const criarTag = useServerFn(criarEtiquetaChat);
  const excluirTag = useServerFn(excluirEtiquetaChat);

  const [destino, setDestino] = useState<string>("");
  const [novaTag, setNovaTag] = useState("");
  const [novaCor, setNovaCor] = useState<string>("blue");
  const [slaHoras, setSlaHoras] = useState<string>("24");
  const [lembreteEm, setLembreteEm] = useState<string>("");
  const [lembreteNota, setLembreteNota] = useState<string>("");

  const { data: stages } = useQuery({
    queryKey: ["pipeline-stages"],
    queryFn: () => getStages(),
  });
  const { data: atual } = useQuery({
    queryKey: ["cliente-pipeline", clienteId],
    queryFn: () => getAtual({ data: { cliente_id: clienteId } }),
  });
  const { data: meta } = useQuery({
    queryKey: ["chat-meta", clienteId],
    queryFn: () => getMeta({ data: { cliente_id: clienteId } }),
  });
  const { data: overview } = useQuery({
    queryKey: ["chat-overview-cliente", clienteId],
    queryFn: () => overviewGestaoChat({ data: { cliente_ids: [clienteId] } }),
  });

  useEffect(() => {
    if (meta) {
      setSlaHoras(String(meta.sla_atualizacao_horas));
      setLembreteEm(meta.lembrete_em ? new Date(meta.lembrete_em).toISOString().slice(0, 16) : "");
      setLembreteNota(meta.lembrete_nota ?? "");
    }
  }, [meta]);

  const tagsAplicadas = useMemo(
    () => new Set((overview?.links ?? []).map((l) => l.etiqueta_id)),
    [overview],
  );

  const avancar = useMutation({
    mutationFn: (codigo: string) =>
      mover({ data: { cliente_id: clienteId, codigo_destino: codigo } }),
    onSuccess: () => {
      toast.success("Etapa atualizada e sincronizada com o App do cliente.");
      setDestino("");
      qc.invalidateQueries({ queryKey: ["cliente-pipeline", clienteId] });
      qc.invalidateQueries({ queryKey: ["conversas-cliente"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível mover a etapa."),
  });

  const toggleTag = useMutation({
    mutationFn: (etiquetaId: string) => {
      const novo = new Set(tagsAplicadas);
      if (novo.has(etiquetaId)) novo.delete(etiquetaId);
      else novo.add(etiquetaId);
      return definirTags({
        data: { cliente_id: clienteId, etiqueta_ids: Array.from(novo) },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-overview-cliente", clienteId] });
      qc.invalidateQueries({ queryKey: ["chat-overview"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar as etiquetas."),
  });

  const adicionarTag = useMutation({
    mutationFn: () => criarTag({ data: { nome: novaTag.trim(), cor: novaCor } }),
    onSuccess: () => {
      setNovaTag("");
      toast.success("Etiqueta criada.");
      qc.invalidateQueries({ queryKey: ["chat-etiquetas"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a etiqueta."),
  });

  const removerTag = useMutation({
    mutationFn: (id: string) => excluirTag({ data: { id } }),
    onSuccess: () => {
      toast.success("Etiqueta excluída.");
      qc.invalidateQueries({ queryKey: ["chat-etiquetas"] });
      qc.invalidateQueries({ queryKey: ["chat-overview-cliente", clienteId] });
      qc.invalidateQueries({ queryKey: ["chat-overview"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir a etiqueta."),
  });

  const gravarMeta = useMutation({
    mutationFn: () =>
      salvarMeta({
        data: {
          cliente_id: clienteId,
          sla_atualizacao_horas: Math.max(1, Number(slaHoras) || 24),
          lembrete_em: lembreteEm ? new Date(lembreteEm).toISOString() : null,
          lembrete_nota: lembreteNota.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("SLA e lembrete salvos.");
      qc.invalidateQueries({ queryKey: ["chat-meta", clienteId] });
      qc.invalidateQueries({ queryKey: ["chat-overview"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });

  const estaArquivada = meta?.arquivado ?? false;
  const alternarArquivo = useMutation({
    mutationFn: () => arquivar({ data: { cliente_id: clienteId, arquivado: !estaArquivada } }),
    onSuccess: () => {
      toast.success(estaArquivada ? "Conversa desarquivada." : "Conversa arquivada.");
      qc.invalidateQueries({ queryKey: ["chat-meta", clienteId] });
      qc.invalidateQueries({ queryKey: ["chat-overview"] });
      qc.invalidateQueries({ queryKey: ["chat-overview-cliente", clienteId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível arquivar."),
  });

  const aplicadas = etiquetas.filter((e) => tagsAplicadas.has(e.id));

  const etapaAtual = stages?.find((s) => s.codigo === atual?.codigo)?.nome ?? "Cadastro básico";
  const temLembrete = Boolean(lembreteEm);
  const contextoLinha = [documento, contexto].filter(Boolean).join(" · ");

  return (
    <Card className="overflow-hidden border-border/60 border-l-2 border-l-primary/40 shadow-sm">
      <div className="flex flex-col gap-3 p-3 xl:flex-row xl:flex-wrap xl:items-stretch xl:gap-0">
        {/* Identidade */}
        <div className="flex min-w-0 items-center gap-3 xl:flex-1 xl:pr-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/80 to-primary/50 text-sm font-semibold text-primary-foreground shadow-sm">
            {iniciais(nome)}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/80">
              Gestão da conversa
            </p>
            <p className="truncate text-sm font-semibold leading-tight text-foreground">{nome}</p>
            {contextoLinha && (
              <p className="truncate text-xs text-muted-foreground">{contextoLinha}</p>
            )}
          </div>
          <Button
            variant={estaArquivada ? "default" : "outline"}
            size="sm"
            className="ml-auto h-8 shrink-0 gap-1.5 text-xs"
            disabled={alternarArquivo.isPending}
            onClick={() => alternarArquivo.mutate()}
            title="O histórico é excluído automaticamente 2 meses após a emissão do contrato."
          >
            {alternarArquivo.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : estaArquivada ? (
              <ArchiveRestore className="h-3.5 w-3.5" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
            {estaArquivada ? "Desarquivar" : "Arquivar"}
          </Button>
        </div>

        {/* Etiquetas */}
        <div className="flex min-w-0 flex-col justify-center gap-1.5 border-t border-primary/15 pt-3 xl:border-l xl:border-l-primary/15 xl:border-t-0 xl:px-4 xl:pt-0">
          <div className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground">Etiquetas</span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {aplicadas.length === 0 ? (
              <span className="text-[11px] text-muted-foreground">Nenhuma</span>
            ) : (
              aplicadas.map((e) => (
                <TagChip key={e.id} etiqueta={e} onRemove={() => toggleTag.mutate(e.id)} />
              ))
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 rounded-full px-2.5 text-[11px]"
                >
                  <Plus className="h-3.5 w-3.5" /> Gerenciar
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 space-y-3 p-3">
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {etiquetas.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Crie a primeira etiqueta abaixo.
                    </p>
                  )}
                  {etiquetas.map((e) => {
                    const on = tagsAplicadas.has(e.id);
                    return (
                      <div key={e.id} className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={toggleTag.isPending}
                          onClick={() => toggleTag.mutate(e.id)}
                          className={cn(
                            "flex flex-1 items-center gap-2 rounded-md border px-2 py-1 text-left text-xs transition-colors",
                            on ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                          )}
                        >
                          <span className={cn("chat-tag-dot", `chat-dot-${e.cor}`)} />
                          <span className="flex-1 truncate">{e.nome}</span>
                          {on && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                        <button
                          type="button"
                          disabled={removerTag.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Excluir a etiqueta "${e.nome}"? Ela será removida de todos os clientes.`,
                              )
                            ) {
                              removerTag.mutate(e.id);
                            }
                          }}
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                          aria-label={`Excluir ${e.nome}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-2 border-t pt-2">
                  <Input
                    value={novaTag}
                    onChange={(ev) => setNovaTag(ev.target.value)}
                    placeholder="Nova etiqueta…"
                    className="h-8 text-xs"
                  />
                  <div className="flex items-center gap-1">
                    {CORES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setNovaCor(c.id)}
                        aria-label={c.nome}
                        className={cn(
                          "chat-tag-dot h-5 w-5 rounded-full ring-offset-1 transition",
                          `chat-dot-${c.id}`,
                          novaCor === c.id && "ring-2 ring-primary ring-offset-background",
                        )}
                      />
                    ))}
                  </div>
                  <Button
                    size="sm"
                    className="h-8 w-full text-xs"
                    disabled={!novaTag.trim() || adicionarTag.isPending}
                    onClick={() => adicionarTag.mutate()}
                  >
                    {adicionarTag.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Criar etiqueta
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* SLA e lembrete */}
        <div className="flex flex-col justify-center gap-1.5 border-t border-primary/15 pt-3 xl:border-l xl:border-l-primary/15 xl:border-t-0 xl:px-4 xl:pt-0">
          <div className="flex items-center gap-1.5">
            <AlarmClock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground">SLA e lembrete</span>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                  {slaHoras}h
                  {temLembrete && (
                    <span className="chat-tag chat-tag-amber">
                      <BellRing className="h-3 w-3" /> lembrete
                    </span>
                  )}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 space-y-2.5 p-3">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">
                  SLA de atualização (horas sem resposta)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={slaHoras || ""}
                  onChange={(e) => setSlaHoras(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Lembrete de follow-up</label>
                <Input
                  type="datetime-local"
                  value={lembreteEm}
                  onChange={(e) => setLembreteEm(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <Textarea
                value={lembreteNota}
                onChange={(e) => setLembreteNota(e.target.value)}
                placeholder="Nota do lembrete (opcional)…"
                className="min-h-[3rem] text-xs"
              />
              <Button
                size="sm"
                className="h-8 w-full text-xs"
                disabled={gravarMeta.isPending}
                onClick={() => gravarMeta.mutate()}
              >
                {gravarMeta.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BellRing className="mr-1.5 h-3.5 w-3.5" />
                )}
                Salvar SLA e lembrete
              </Button>
            </PopoverContent>
          </Popover>
        </div>

        {/* Esteira */}
        <div className="flex flex-col justify-center gap-1.5 border-t border-primary/15 pt-3 xl:border-l xl:border-l-primary/15 xl:border-t-0 xl:pl-4 xl:pt-0">
          <div className="flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground">
              Esteira · {etapaAtual}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Select value={destino} onValueChange={setDestino}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Mover para…" />
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
              size="sm"
              className="h-8 gap-1 text-xs"
              disabled={!destino || avancar.isPending || destino === atual?.codigo}
              onClick={() => avancar.mutate(destino)}
            >
              {avancar.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
              Mover
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
