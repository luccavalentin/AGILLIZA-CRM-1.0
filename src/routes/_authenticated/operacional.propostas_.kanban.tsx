import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Search, RotateCcw, KanbanSquare, User, Clock, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createDebouncedInvalidator } from "@/lib/realtime-debounce";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarPropostas, moverStatusProposta, listarResponsaveisEquipe } from "@/lib/propostas/propostas.functions";
import { listarParceiros } from "@/lib/crm/parceiros.functions";
import { statusProposta } from "@/components/propostas/status";
import {
  transicaoPermitida,
  STATUS_TERMINAIS,
  type PropostaStatus,
} from "@/lib/propostas/state-machine";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBRL, maskCpfCnpj } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";
import { numeroBancoParaExibir } from "@/lib/propostas/numero-banco-display";

/** Máximo de cards visíveis antes de "empilhar" o restante numa pasta com busca. */
const MAX_VISIVEIS_POR_COLUNA = 2;

export const Route = createFileRoute("/_authenticated/operacional/propostas_/kanban")({
  head: () => ({ meta: [{ title: "Kanban de Propostas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.propostas"),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: Pagina,
});

/**
 * Colunas do kanban. Cada coluna tem um status "destino" (usado ao soltar um card)
 * e a lista de status que ela agrega (para exibir os cards).
 * "enviada_banco" e "em_analise_credito" compartilham a mesma etapa visual.
 */
type ColunaKanban = {
  destino: PropostaStatus;
  agrega: PropostaStatus[];
};

const COLUNAS: ColunaKanban[] = [
  { destino: "rascunho", agrega: ["rascunho"] },
  { destino: "enviada_banco", agrega: ["enviada_banco", "em_analise_credito"] },
  { destino: "credito_aprovado", agrega: ["credito_aprovado"] },
  { destino: "credito_recusado", agrega: ["credito_recusado"] },
  {
    destino: "aguardando_documentos",
    agrega: [
      "aguardando_documentos",
      "checklist_documentacao",
      "cadastro_complementar",
      "dossie_completo",
      "formularios",
      "envio_documentos_banco",
    ],
  },
  {
    destino: "engenharia_vistoria",
    agrega: ["engenharia_vistoria", "vistoria_agendamento", "vistoria_concluida"],
  },
  { destino: "analise_juridica", agrega: ["analise_juridica", "emissao_contrato"] },
  { destino: "contrato_emitido", agrega: ["contrato_emitido", "registrado"] },
  { destino: "erro_envio", agrega: ["erro_envio"] },
  { destino: "cancelada", agrega: ["cancelada"] },
];

const TONE_BAR: Record<string, string> = {
  success: "bg-success",
  info: "bg-primary",
  warning: "bg-warning",
  danger: "bg-destructive",
  muted: "bg-muted-foreground",
};

const TONE_BADGE: Record<string, string> = {
  success: "bg-success/10 text-success",
  info: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

/** Primeiro e último dia do mês atual como intervalo ISO (para o filtro padrão). */
function intervaloMesAtual(): { inicio: string; fim: string } {
  const agora = new Date();
  const primeiro = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const ultimo = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { inicio: iso(primeiro), fim: iso(ultimo) };
}

/** Há quanto tempo a proposta está na etapa atual (ex.: "hoje", "3d", "2sem"). */
function tempoNaEtapa(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T"));
  if (isNaN(d.getTime())) return "";
  const dias = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 14) return `${dias}d`;
  if (dias < 60) return `${Math.floor(dias / 7)}sem`;
  return `${Math.floor(dias / 30)}m`;
}



function Pagina() {
  const router = useRouter();
  const qc = useQueryClient();
  const { q: qInicial } = Route.useSearch();
  const moverFn = useServerFn(moverStatusProposta);
  const [arrastando, setArrastando] = useState<{ id: string; status: PropostaStatus } | null>(null);

  const padrao = useMemo(() => intervaloMesAtual(), []);
  const [escopo, setEscopo] = useState<"todas" | "minhas">(qInicial ? "todas" : "minhas");
  const [q, setQ] = useState(qInicial ?? "");
  const [busca, setBusca] = useState(qInicial ?? "");
  const [dataInicio, setDataInicio] = useState(qInicial ? "" : padrao.inicio);
  const [dataFim, setDataFim] = useState(qInicial ? "" : padrao.fim);
  const [respFiltro, setRespFiltro] = useState("todos");
  const [corretorFiltro, setCorretorFiltro] = useState("todos");
  const [imobFiltro, setImobFiltro] = useState("todos");


  // Busca ao vivo: filtra conforme o usuário digita (com debounce).
  useEffect(() => {
    const t = setTimeout(() => setBusca(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data } = useQuery({
    queryKey: ["propostas", "kanban", escopo, busca, dataInicio, dataFim],
    queryFn: () =>
      listarPropostas({
        data: {
          escopo,
          q: busca || undefined,
          data_inicio: dataInicio ? `${dataInicio}T00:00:00` : undefined,
          data_fim: dataFim ? `${dataFim}T23:59:59` : undefined,
          pagina: 1,
          porPagina: 500,
        },
      }),
  });

  // Comunicação em tempo real com a proposta: qualquer mudança de status/etapa
  // (via ficha, sincronização com o banco ou outro usuário) atualiza o Kanban.
  // Coalescemos rajadas (trigger + update em cascata) numa única invalidação.
  useEffect(() => {
    const { schedule, cancel } = createDebouncedInvalidator(() =>
      qc.invalidateQueries({ queryKey: ["propostas"] }),
    );
    const canal = supabase
      .channel("kanban:propostas")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "propostas" },
        schedule,
      )
      .subscribe();
    return () => {
      cancel();
      supabase.removeChannel(canal);
    };
  }, [qc]);



  function limparFiltros() {
    setQ("");
    setBusca("");
    setDataInicio(padrao.inicio);
    setDataFim(padrao.fim);
    setEscopo("minhas");
    setRespFiltro("todos");
    setCorretorFiltro("todos");
    setImobFiltro("todos");
  }


  async function soltar(coluna: PropostaStatus) {
    if (!arrastando) return;
    const { id, status } = arrastando;
    setArrastando(null);
    if (status === coluna) return;
    if (!transicaoPermitida(status, coluna)) {
      toast.error(
        `Transição inválida: ${statusProposta(status).label} → ${statusProposta(coluna).label}.`,
      );
      return;
    }
    try {
      await moverFn({ data: { proposta_id: id, novo_status: coluna } });
      qc.invalidateQueries({ queryKey: ["propostas"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao mover.");
    }
  }

  const itens = data?.itens ?? [];

  // Todos os responsáveis internos do correspondente (mesmo os sem proposta ainda),
  // combinados com quaisquer nomes que já apareçam nos cards por segurança.
  const { data: equipe } = useQuery({
    queryKey: ["propostas", "responsaveis-equipe"],
    queryFn: () => listarResponsaveisEquipe(),
    staleTime: 5 * 60_000,
  });
  const responsaveis = useMemo(() => {
    const s = new Set<string>();
    (equipe ?? []).forEach((m) => m.nome && s.add(m.nome));
    itens.forEach((i: any) => i.nome_responsavel && s.add(i.nome_responsavel));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [equipe, itens]);
  // Todos os parceiros do ecossistema (mesmo os sem proposta ainda) + nomes que
  // já aparecem nos cards. Assim o filtro "Corretor/Imobiliária" mostra tudo que
  // está vinculado ao correspondente, não apenas o que está visível na tela.
  const { data: parceirosCadastrados } = useQuery({
    queryKey: ["parceiros-cadastrados"],
    queryFn: () => listarParceiros(),
    staleTime: 5 * 60_000,
  });
  const corretores = useMemo(() => {
    const s = new Set<string>();
    (parceirosCadastrados ?? [])
      .filter((p) => (p.tipo_pessoa ?? "").toLowerCase() === "corretor")
      .forEach((p) => p.nome && s.add(p.nome));
    itens.forEach((i: any) => i.corretor_nome && s.add(i.corretor_nome));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [parceirosCadastrados, itens]);
  const imobiliarias = useMemo(() => {
    const s = new Set<string>();
    (parceirosCadastrados ?? [])
      .filter((p) => (p.tipo_pessoa ?? "").toLowerCase() === "imobiliaria")
      .forEach((p) => p.nome && s.add(p.nome));
    itens.forEach((i: any) => i.imobiliaria_nome && s.add(i.imobiliaria_nome));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [parceirosCadastrados, itens]);

  const itensFiltrados = useMemo(
    () =>
      itens.filter((i: any) => {
        if (respFiltro !== "todos" && (i.nome_responsavel ?? "") !== respFiltro) return false;
        if (corretorFiltro !== "todos" && (i.corretor_nome ?? "") !== corretorFiltro) return false;
        if (imobFiltro !== "todos" && (i.imobiliaria_nome ?? "") !== imobFiltro) return false;
        return true;
      }),
    [itens, respFiltro, corretorFiltro, imobFiltro],
  );

  // Agrupa uma única vez por coluna, em vez de refiltrar a lista inteira
  // (até 500 itens) para cada uma das colunas a cada render.
  const cardsPorColuna = useMemo(() => {
    const mapa = new Map<string, typeof itens>();
    for (const col of COLUNAS) mapa.set(col.destino, []);
    for (const item of itensFiltrados) {
      for (const col of COLUNAS) {
        if (col.agrega.includes(item.status as PropostaStatus)) {
          mapa.get(col.destino)!.push(item);
          break;
        }
      }
    }
    return mapa;
  }, [itensFiltrados]);



  const [pastaAberta, setPastaAberta] = useState<PropostaStatus | null>(null);
  const [buscaPasta, setBuscaPasta] = useState("");

  function renderCard(c: any, cfg: ReturnType<typeof statusProposta>) {
    const terminal = STATUS_TERMINAIS.includes(c.status as PropostaStatus);
    return (
      <div
        key={c.id}
        draggable={!terminal}
        onDragStart={() =>
          !terminal && setArrastando({ id: c.id, status: c.status as PropostaStatus })
        }
        onDragEnd={() => setArrastando(null)}
        onClick={() => {
          setPastaAberta(null);
          router.navigate({ to: "/operacional/propostas/$id", params: { id: c.id } });
        }}
        style={{ "--banco": corDoBanco(c.nome_banco) } as React.CSSProperties}
        className={cn(
          "group relative min-w-0 shrink-0 overflow-hidden rounded-xl border border-border bg-card p-3 pl-3.5 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
          "before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[var(--banco)] before:opacity-0 before:transition-opacity hover:before:opacity-100",
          "hover:border-[color-mix(in_oklab,var(--banco)_45%,transparent)]",
          terminal ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold uppercase text-primary">
            {(c.nome_cliente ?? "?").trim().charAt(0) || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {c.nome_cliente ?? "—"}
            </p>
            {c.cpf_cnpj && (
              <p className="truncate text-[11px] tabular-nums text-muted-foreground">
                {maskCpfCnpj(c.cpf_cnpj)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
              TONE_BADGE[cfg.tone],
            )}
          >
            {cfg.label}
          </span>
          {!terminal && c.status_atualizado_em && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {tempoNaEtapa(c.status_atualizado_em)}
            </span>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          {(() => {
            const nb = numeroBancoParaExibir(c.numero_proposta_banco);
            return nb ? (
              <>
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[12px] font-bold tabular-nums text-primary">
                  Nº banco {nb}
                </span>
                <span className="tabular-nums text-muted-foreground">Interno #{c.numero_proposta}</span>
              </>
            ) : (
              <span className="rounded bg-muted px-1.5 py-0.5 font-medium tabular-nums text-foreground">
                #{c.numero_proposta}
              </span>
            );
          })()}
        </div>

        {escopo === "todas" && c.nome_responsavel && (
          <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{c.nome_responsavel}</span>
          </div>
        )}

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-border/60 pt-2.5">
          <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground">
            <BancoLogo nome={c.nome_banco} size="xs" className="shrink-0" />
            <span className="truncate">{c.nome_banco ?? "—"}</span>
          </span>
          <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
            {formatBRL(c.valor_financiamento)}
          </span>
        </div>
      </div>
    );
  }

  const cardsDaPasta = useMemo(() => {
    if (!pastaAberta) return [];
    const todos = cardsPorColuna.get(pastaAberta) ?? [];
    const q = buscaPasta.trim().toLowerCase();
    if (!q) return todos;
    return todos.filter((c: any) =>
      [c.nome_cliente, c.cpf_cnpj, c.numero_proposta, c.numero_proposta_banco, c.nome_banco, c.nome_responsavel]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [pastaAberta, cardsPorColuna, buscaPasta]);

  return (
    <div className="min-h-[calc(100dvh-var(--app-header,4rem))] space-y-4 p-3 sm:space-y-6 sm:p-4 lg:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm ring-1 ring-primary/20">
            <KanbanSquare className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Kanban de Propostas
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              Arraste os cards entre as etapas permitidas.
            </p>
          </div>
        </div>
        <Button asChild variant="secondary" size="sm" className="h-11 rounded-xl">
          <Link to="/operacional/propostas">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Lista
          </Link>
        </Button>
      </div>

      {/* Filtros */}
      <Card className="rounded-2xl border-border/60 p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Tabs value={escopo} onValueChange={(v) => setEscopo(v as "todas" | "minhas")}>
            <TabsList className="h-11 rounded-xl">
              <TabsTrigger value="todas" className="rounded-lg">
                Todas
              </TabsTrigger>
              <TabsTrigger value="minhas" className="rounded-lg">
                Meu kanban
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 rounded-xl pl-9 shadow-sm"
              placeholder="Cliente, CPF/CNPJ ou nº da proposta"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="h-11 w-[9.5rem] rounded-xl"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="h-11 w-[9.5rem] rounded-xl"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Responsável</Label>
            <select
              value={respFiltro}
              onChange={(e) => setRespFiltro(e.target.value)}
              className="h-11 w-[10rem] rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="todos">Todos</option>
              {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Corretor</Label>
            <select
              value={corretorFiltro}
              onChange={(e) => setCorretorFiltro(e.target.value)}
              className="h-11 w-[10rem] rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="todos">Todos</option>
              {corretores.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Imobiliária</Label>
            <select
              value={imobFiltro}
              onChange={(e) => setImobFiltro(e.target.value)}
              className="h-11 w-[10rem] rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="todos">Todos</option>
              {imobiliarias.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <Button variant="ghost" className="h-11 rounded-xl" onClick={limparFiltros}>
            <RotateCcw className="mr-1 h-4 w-4" /> Limpar
          </Button>
        </div>
      </Card>


      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {COLUNAS.map((col) => {
          const cfg = statusProposta(col.destino);
          const cards = cardsPorColuna.get(col.destino) ?? [];
          const visiveis = cards.slice(0, MAX_VISIVEIS_POR_COLUNA);
          const excedente = cards.length - visiveis.length;
          return (
            <div
              key={col.destino}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => soltar(col.destino)}
              className="flex min-h-40 max-h-[36rem] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-muted/30 shadow-sm"
            >
              <div className="shrink-0 overflow-hidden rounded-t-xl">
                <div className={cn("h-[3px]", TONE_BAR[cfg.tone])} />
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 px-3 py-2.5">
                  <span className="min-w-0 text-xs font-semibold uppercase leading-snug text-muted-foreground">
                    {cfg.label}
                  </span>
                  <span className="shrink-0 rounded-full bg-background px-1.5 text-xs text-muted-foreground">
                    {cards.length}
                  </span>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2 [scrollbar-width:thin]">
                <button
                  type="button"
                  onClick={() => {
                    setBuscaPasta("");
                    setPastaAberta(col.destino);
                  }}
                  className="group flex shrink-0 items-center justify-between gap-2 rounded-xl border border-dashed border-border bg-background/60 px-3 py-2.5 text-xs font-medium text-muted-foreground shadow-sm transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                >
                  <span className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-primary" />
                    {excedente > 0
                      ? `Ver mais ${excedente} ${excedente === 1 ? "proposta" : "propostas"}`
                      : cards.length > 0
                        ? "Abrir e pesquisar"
                        : "Pesquisar nesta etapa"}
                  </span>
                  <Search className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100" />
                </button>

                {visiveis.map((c) => renderCard(c, cfg))}
                {cards.length === 0 && (
                  <p className="px-1 py-6 text-center text-xs text-muted-foreground">Vazio</p>
                )}
              </div>

            </div>
          );
        })}
      </div>

      <Dialog open={pastaAberta !== null} onOpenChange={(o) => !o && setPastaAberta(null)}>
        <DialogContent className="max-w-4xl overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-card to-card/95 p-0 shadow-2xl">
          <div className="relative border-b border-border/50 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 px-6 py-4">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-60 blur-3xl"
              style={{ background: "color-mix(in oklab, var(--primary) 18%, transparent)" }}
            />
            <DialogHeader className="relative">
              <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
                <span className="inline-block h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />
                {pastaAberta ? statusProposta(pastaAberta).label : ""}
                <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {(pastaAberta ? cardsPorColuna.get(pastaAberta) ?? [] : []).length} propostas
                </span>
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-6 pb-6 pt-4">
            <div className="group relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                autoFocus
                placeholder="Buscar por cliente, CPF/CNPJ ou nº da proposta"
                value={buscaPasta}
                onChange={(e) => setBuscaPasta(e.target.value)}
                className="h-12 rounded-xl border-border/70 bg-background pl-11 pr-4 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_2px_8px_-2px_rgba(15,23,42,0.08),0_8px_24px_-12px_rgba(15,23,42,0.15)] transition-all duration-200 placeholder:text-muted-foreground/70 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_4px_14px_-2px_rgba(15,23,42,0.12),0_12px_32px_-12px_rgba(15,23,42,0.2)] focus-visible:border-primary/50 focus-visible:shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_0_0_4px_color-mix(in_oklab,var(--primary)_18%,transparent),0_12px_32px_-12px_color-mix(in_oklab,var(--primary)_35%,transparent)] focus-visible:ring-0"
              />
            </div>

            <div className="grid max-h-[62vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 [scrollbar-gutter:stable]">
              {pastaAberta &&
                cardsDaPasta.map((c: any) => (
                  <div
                    key={c.id}
                    className="transition-transform duration-200 hover:-translate-y-1"
                  >
                    {renderCard(c, statusProposta(pastaAberta!))}
                  </div>
                ))}
              {pastaAberta && cardsDaPasta.length === 0 && (
                <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
                  Nenhuma proposta encontrada.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
