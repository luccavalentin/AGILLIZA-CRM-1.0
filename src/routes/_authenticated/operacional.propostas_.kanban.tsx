import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { numerosDoCartaoAssinante, textoIdH } from "@/lib/propostas/id-h";
import { MarcarRegistroDialog } from "@/components/propostas/marcar-registro-dialog";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Eye,
  EyeOff,
  FolderOpen,
  KanbanSquare,
  Loader2,
  RotateCcw,
  Search,
  Timer,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createDebouncedInvalidator } from "@/lib/realtime-debounce";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import {
  listarPropostas,
  moverStatusProposta,
  cancelarProposta,
  listarResponsaveisEquipe,
} from "@/lib/propostas/propostas.functions";
import { listarOpcoesVinculoPropostas } from "@/lib/crm/parceiros.functions";
import {
  listarPrazosKanban,
  listarPropostasAssinantesKanban,
} from "@/lib/propostas/kanban.functions";
import { listarContasDaFila, ROTULO_PROPOSTA_ASSINANTE } from "@/lib/plataforma/fila.functions";
import { statusProposta } from "@/components/propostas/status";
import { podeContinuarProposta, type PropostaStatus } from "@/lib/propostas/state-machine";
import {
  COLUNAS_KANBAN,
  avaliarSoltura,
  colunaDoStatus,
  colunaDoStatusAssinante,
  diasParado,
  nivelSla,
  podeArrastar,
  proximasEtapasManuais,
  resumoColuna,
  type NivelSla,
} from "@/lib/propostas/kanban-propostas";
import { CartaoProposta, type AcaoRapida } from "@/components/propostas/kanban/cartao-proposta";
import { PrazosKanbanDialog } from "@/components/propostas/kanban/prazos-dialog";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatBRL, maskCpfCnpj } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";
import { numeroBancoParaExibir } from "@/lib/propostas/numero-banco-display";

/** Cartões visíveis por coluna antes de "ver todas" (o resto abre numa pasta com busca). */
const MAX_VISIVEIS_POR_COLUNA = 5;

export const Route = createFileRoute("/_authenticated/operacional/propostas_/kanban")({
  head: () => ({ meta: [{ title: "Kanban de Propostas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.propostas"),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: Pagina,
});

const TONE_BAR: Record<string, string> = {
  success: "bg-success",
  info: "bg-primary",
  warning: "bg-warning",
  danger: "bg-destructive",
  muted: "bg-muted-foreground",
};

const compacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

function rotuloColuna(destino: PropostaStatus): string {
  return COLUNAS_KANBAN.find((c) => c.destino === destino)?.rotulo ?? statusProposta(destino).label;
}

/** Cartão já normalizado (Sua base ou assinante) para a coluna. */
interface Cartao {
  chave: string;
  origem: "base" | "assinante";
  coluna: PropostaStatus;
  status: string;
  cliente: string;
  documento: string | null;
  numero: string;
  numeroSecundario: string | null;
  selo: { rotulo: string; tom: string };
  banco: string | null;
  valor: number;
  dias: number | null;
  nivel: NivelSla;
  responsavel: string | null;
  conta: string | null;
  bruto: any;
}

function Pagina() {
  const router = useRouter();
  const qc = useQueryClient();
  const { q: qInicial } = Route.useSearch();
  const moverFn = useServerFn(moverStatusProposta);
  const cancelarFn = useServerFn(cancelarProposta);
  const podeVerAssinantes = usePermissao("saas.fila", "view");
  const podeEditarPropostas = usePermissao("operacional.propostas", "edit");

  const [base, setBase] = useState<"base" | "assinantes">("base");
  const [escopo, setEscopo] = useState<"todas" | "minhas">("minhas");
  const [q, setQ] = useState(qInicial ?? "");
  const [busca, setBusca] = useState(qInicial?.trim() ?? "");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [respFiltro, setRespFiltro] = useState("todos");
  const [corretorFiltro, setCorretorFiltro] = useState("todos");
  const [imobFiltro, setImobFiltro] = useState("todos");
  const [comercialFiltro, setComercialFiltro] = useState("todos");
  const [bancoFiltro, setBancoFiltro] = useState("todos");
  const [contaFiltro, setContaFiltro] = useState("todas");
  const [ocultarVazias, setOcultarVazias] = useState(false);
  const [arrastando, setArrastando] = useState<Cartao | null>(null);
  const [sobre, setSobre] = useState<PropostaStatus | null>(null);
  const [movendo, setMovendo] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<{ cartao: Cartao; destino: PropostaStatus; aviso: string } | null>(null);
  const [cancelar, setCancelar] = useState<Cartao | null>(null);
  const [motivo, setMotivo] = useState("");
  const [prazosAbertos, setPrazosAbertos] = useState(false);
  const [pastaAberta, setPastaAberta] = useState<PropostaStatus | null>(null);
  const [buscaPasta, setBuscaPasta] = useState("");

  // Busca ao vivo (com espera curta).
  useEffect(() => {
    const t = setTimeout(() => setBusca(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Sem permissão da fila, "Assinantes" nem aparece; se perder no meio, volta para a base.
  useEffect(() => {
    if (!podeVerAssinantes && base === "assinantes") setBase("base");
  }, [podeVerAssinantes, base]);

  const consultaBase = useQuery({
    queryKey: [
      "propostas",
      "kanban",
      escopo,
      busca,
      dataInicio,
      dataFim,
      respFiltro,
      corretorFiltro,
      imobFiltro,
      comercialFiltro,
    ],
    enabled: base === "base",
    queryFn: () =>
      listarPropostas({
        data: {
          escopo,
          q: busca || undefined,
          data_inicio: dataInicio ? `${dataInicio}T00:00:00` : undefined,
          data_fim: dataFim ? `${dataFim}T23:59:59` : undefined,
          responsavel_nome: respFiltro !== "todos" ? respFiltro : undefined,
          corretor_nome: corretorFiltro !== "todos" ? corretorFiltro : undefined,
          imobiliaria_nome: imobFiltro !== "todos" ? imobFiltro : undefined,
          comercial_nome: comercialFiltro !== "todos" ? comercialFiltro : undefined,
          pagina: 1,
          porPagina: 500,
        },
      }),
  });

  const consultaAssinantes = useQuery({
    queryKey: ["propostas", "kanban-assinantes", contaFiltro, busca],
    enabled: base === "assinantes" && podeVerAssinantes,
    queryFn: () =>
      listarPropostasAssinantesKanban({
        data: { licenca: contaFiltro !== "todas" ? contaFiltro : null, termo: busca || null },
      }),
    refetchInterval: 60_000,
  });

  const { data: contas } = useQuery({
    queryKey: ["fila-assinantes", "contas"],
    enabled: base === "assinantes" && podeVerAssinantes,
    queryFn: () => listarContasDaFila(),
    staleTime: 10 * 60_000,
  });

  const { data: prazosDados } = useQuery({
    queryKey: ["propostas", "kanban-prazos"],
    queryFn: () => listarPrazosKanban(),
    staleTime: 5 * 60_000,
  });
  const prazos = prazosDados?.prazos ?? {};

  // Tempo real: qualquer mudança de situação (ficha, banco, outro usuário) atualiza o quadro.
  useEffect(() => {
    const { schedule, cancel } = createDebouncedInvalidator(() =>
      qc.invalidateQueries({ queryKey: ["propostas"] }),
    );
    const canal = supabase
      .channel("kanban:propostas")
      .on("postgres_changes", { event: "*", schema: "public", table: "propostas" }, schedule)
      .subscribe();
    return () => {
      cancel();
      supabase.removeChannel(canal);
    };
  }, [qc]);

  const { data: equipe } = useQuery({
    queryKey: ["propostas", "responsaveis-equipe"],
    queryFn: () => listarResponsaveisEquipe(),
    staleTime: 5 * 60_000,
  });
  const responsaveis = useMemo(() => {
    const s = new Set<string>();
    (equipe ?? []).forEach((m) => m.nome && s.add(m.nome));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [equipe]);

  const { data: opcoesVinculo } = useQuery({
    queryKey: ["opcoes-vinculo-propostas"],
    queryFn: () => listarOpcoesVinculoPropostas(),
    staleTime: 5 * 60_000,
  });
  const corretores = opcoesVinculo?.corretores ?? [];
  const imobiliarias = opcoesVinculo?.imobiliarias ?? [];
  const comerciais = opcoesVinculo?.comerciais ?? [];

  // Normaliza os dois mundos para o mesmo cartão.
  const cartoes: Cartao[] = useMemo(() => {
    const agora = new Date();
    if (base === "base") {
      return (consultaBase.data?.itens ?? []).flatMap((c: any): Cartao[] => {
        const coluna = colunaDoStatus(c.status);
        if (!coluna) return [];
        const nb = numeroBancoParaExibir(c.numero_proposta_banco);
        const dias = diasParado(c.status_atualizado_em ?? c.created_at, agora);
        const cfg = statusProposta(String(c.status), c.nome_banco);
        return [
          {
            chave: c.id,
            origem: "base",
            coluna,
            status: c.status,
            cliente: c.nome_cliente ?? "—",
            documento: c.cpf_cnpj ? maskCpfCnpj(c.cpf_cnpj) : null,
            numero: nb ? `Nº banco ${nb}` : textoIdH(c),
            numeroSecundario: nb ? textoIdH(c) : null,
            selo: { rotulo: cfg.label, tom: cfg.tone },
            banco: c.nome_banco ?? null,
            valor: Number(c.valor_financiamento) || 0,
            dias,
            nivel: nivelSla(c.status, dias, prazos),
            responsavel: c.nome_responsavel ?? null,
            conta: null,
            bruto: c,
          },
        ];
      });
    }
    return (consultaAssinantes.data?.propostas ?? []).flatMap((p): Cartao[] => {
      const coluna = colunaDoStatusAssinante(p.status);
      if (!coluna) return [];
      const dias = diasParado(p.assumida_em ?? p.criado_em, agora);
      const encerrada = ["registrado", "cancelada", "recusada"].includes(p.status);
      return [
        {
          chave: p.id,
          origem: "assinante",
          coluna,
          status: p.status,
          cliente: p.cliente,
          documento: null,
          // "ID H." no lugar do PRO-… quando a proposta já tem o id da oportunidade (c1).
          ...numerosDoCartaoAssinante(p),
          selo: {
            rotulo: ROTULO_PROPOSTA_ASSINANTE[p.status] ?? p.status,
            tom: encerrada ? (p.status === "registrado" ? "success" : "danger") : p.pendente ? "warning" : "info",
          },
          banco: p.banco,
          valor: Number(p.valor_financiamento) || 0,
          dias,
          // Na fila do assinante o prazo é o do banco do Agilliza Tech (sla_ate): atrasada = crítico.
          nivel: encerrada ? "sem" : p.atrasada ? "critico" : p.pendente ? "alerta" : "ok",
          responsavel: p.analista,
          conta: p.conta,
          bruto: p,
        },
      ];
    });
  }, [base, consultaBase.data, consultaAssinantes.data, prazos]);

  const bancos = useMemo(() => {
    const s = new Set<string>();
    for (const c of cartoes) if (c.banco) s.add(c.banco);
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [cartoes]);
  const analistas = useMemo(() => {
    const s = new Set<string>();
    for (const c of cartoes) if (c.origem === "assinante" && c.responsavel) s.add(c.responsavel);
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [cartoes]);

  const filtrados = useMemo(
    () =>
      cartoes.filter((c) => {
        if (bancoFiltro !== "todos" && (c.banco ?? "") !== bancoFiltro) return false;
        if (base === "assinantes" && respFiltro !== "todos") {
          if (respFiltro === "__sem__" ? c.responsavel : c.responsavel !== respFiltro) return false;
        }
        return true;
      }),
    [cartoes, bancoFiltro, base, respFiltro],
  );

  const porColuna = useMemo(() => {
    const m = new Map<PropostaStatus, Cartao[]>();
    for (const col of COLUNAS_KANBAN) m.set(col.destino, []);
    for (const c of filtrados) m.get(c.coluna)?.push(c);
    // Mais parada primeiro: é ela que precisa de atenção.
    for (const lista of m.values()) lista.sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1));
    return m;
  }, [filtrados]);

  const totais = useMemo(() => {
    const ativos = filtrados.filter(
      (c) => !["registrado", "cancelada", "credito_recusado"].includes(c.coluna),
    );
    return {
      ativos: resumoColuna(ativos.map((c) => ({ valor_financiamento: c.valor }))),
      criticas: filtrados.filter((c) => c.nivel === "critico").length,
      alertas: filtrados.filter((c) => c.nivel === "alerta").length,
    };
  }, [filtrados]);

  const carregando = base === "base" ? consultaBase.isLoading : consultaAssinantes.isLoading;
  const erro = base === "base" ? consultaBase.error : consultaAssinantes.error;
  const totalServidor =
    base === "base" ? (consultaBase.data?.total ?? 0) : (consultaAssinantes.data?.total ?? 0);

  function limparFiltros() {
    setQ("");
    setBusca("");
    setDataInicio("");
    setDataFim("");
    setEscopo("minhas");
    setRespFiltro("todos");
    setCorretorFiltro("todos");
    setImobFiltro("todos");
    setComercialFiltro("todos");
    setBancoFiltro("todos");
    setContaFiltro("todas");
  }

  function abrir(c: Cartao) {
    setPastaAberta(null);
    if (c.origem === "base") {
      router.navigate({ to: "/operacional/propostas/$id", params: { id: c.chave } });
    } else if (c.bruto?.proposta_agilliza_id) {
      router.navigate({ to: "/operacional/propostas/$id", params: { id: c.bruto.proposta_agilliza_id } });
    } else {
      router.navigate({ to: "/operacional/propostas", search: { aba: "assinantes" } });
    }
  }

  const [registrando, setRegistrando] = useState<any | null>(null);

  async function mover(c: Cartao, destino: PropostaStatus) {
    // C12: "Contrato registrado" pede a data do cartório na ação própria.
    if (destino === "registrado") {
      setRegistrando(c.bruto ?? { id: c.chave });
      return;
    }
    setMovendo(c.chave);
    try {
      await moverFn({ data: { proposta_id: c.chave, novo_status: destino } });
      toast.success(`Proposta em "${rotuloColuna(destino)}".`);
      await qc.invalidateQueries({ queryKey: ["propostas"] });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Falha ao mover."));
    } finally {
      setMovendo(null);
    }
  }

  function tentarMover(c: Cartao, coluna: PropostaStatus) {
    if (c.origem !== "base") return;
    const r = avaliarSoltura(c.status, coluna, c.banco, (s) =>
      COLUNAS_KANBAN.some((x) => x.destino === s) ? rotuloColuna(s as PropostaStatus) : statusProposta(s, c.banco).label,
    );
    if (r.tipo === "nada") return;
    if (r.tipo === "recusada") return void toast.error(r.motivo);
    if (r.tipo === "cancelar") {
      setMotivo("");
      setCancelar(c);
      return;
    }
    if (r.tipo === "confirmar") return setConfirmar({ cartao: c, destino: r.destino, aviso: r.aviso });
    void mover(c, r.destino);
  }

  function soltar(coluna: PropostaStatus) {
    setSobre(null);
    const c = arrastando;
    setArrastando(null);
    if (c) tentarMover(c, coluna);
  }

  async function confirmarCancelamento() {
    if (!cancelar) return;
    if (motivo.trim().length < 5) return void toast.error("Informe o motivo (pelo menos 5 letras).");
    setMovendo(cancelar.chave);
    try {
      await cancelarFn({ data: { proposta_id: cancelar.chave, motivo: motivo.trim() } });
      toast.success("Proposta cancelada.");
      setCancelar(null);
      await qc.invalidateQueries({ queryKey: ["propostas"] });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível cancelar."));
    } finally {
      setMovendo(null);
    }
  }

  function acoesDo(c: Cartao): AcaoRapida[] {
    if (c.origem === "assinante") {
      return [
        c.bruto?.proposta_agilliza_id
          ? { rotulo: "Abrir a proposta no Agilliza", icone: "abrir", onSelect: () => abrir(c) }
          : { rotulo: "Abrir na fila dos assinantes", icone: "abrir", onSelect: () => abrir(c) },
      ];
    }
    const acoes: AcaoRapida[] = [{ rotulo: "Abrir a proposta", icone: "abrir", onSelect: () => abrir(c) }];
    if (podeContinuarProposta(c.status, c.bruto?.bancos)) {
      acoes.push({
        rotulo: "Continuar proposta",
        icone: "continuar",
        onSelect: () =>
          router.navigate({ to: "/operacional/propostas/$id/continuar", params: { id: c.chave } }),
      });
    }
    for (const d of proximasEtapasManuais(c.status, c.banco)) {
      acoes.push({ rotulo: `Mover para ${rotuloColuna(d)}`, icone: "avancar", onSelect: () => tentarMover(c, d) });
    }
    if (avaliarSoltura(c.status, "cancelada", c.banco).tipo === "cancelar") {
      acoes.push({
        rotulo: "Cancelar proposta",
        icone: "cancelar",
        perigo: true,
        onSelect: () => tentarMover(c, "cancelada"),
      });
    }
    return acoes;
  }

  function renderCartao(c: Cartao) {
    const arrastavel = c.origem === "base" && podeArrastar(c.status) && movendo !== c.chave;
    return (
      <CartaoProposta
        key={`${c.origem}-${c.chave}`}
        cliente={c.cliente}
        documento={c.documento}
        numero={c.numero}
        numeroSecundario={c.numeroSecundario}
        selo={c.selo}
        banco={c.banco}
        valor={c.valor}
        dias={c.dias}
        nivel={c.nivel}
        responsavel={escopo === "todas" || c.origem === "assinante" ? c.responsavel : null}
        conta={c.conta}
        marcador={
          movendo === c.chave ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : c.origem === "assinante" && c.bruto?.pendente ? (
            <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
              sem analista
            </span>
          ) : null
        }
        arrastavel={arrastavel}
        arrastando={arrastando?.chave === c.chave}
        onArrastar={() => setArrastando(c)}
        onSoltarFim={() => {
          setArrastando(null);
          setSobre(null);
        }}
        onAbrir={() => abrir(c)}
        acoes={acoesDo(c)}
      />
    );
  }

  const cartoesDaPasta = useMemo(() => {
    if (!pastaAberta) return [];
    const todos = porColuna.get(pastaAberta) ?? [];
    const t = buscaPasta.trim().toLowerCase();
    if (!t) return todos;
    return todos.filter((c) =>
      [c.cliente, c.documento, c.numero, c.numeroSecundario, c.banco, c.responsavel, c.conta]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t)),
    );
  }, [pastaAberta, porColuna, buscaPasta]);

  const colunasVisiveis = COLUNAS_KANBAN.filter(
    (col) => !ocultarVazias || (porColuna.get(col.destino)?.length ?? 0) > 0,
  );

  const seletor =
    "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-[11.5rem]";

  return (
    <div className="min-h-[calc(100dvh-var(--app-header,4rem))] space-y-4 p-3 sm:space-y-5 sm:p-4 lg:p-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-border/70 bg-card text-primary shadow-[inset_0_1px_0_color-mix(in_oklab,#fff_60%,transparent),0_10px_24px_-14px_color-mix(in_oklab,var(--primary)_55%,transparent)]">
            <KanbanSquare className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Kanban de Propostas
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              Arraste entre as etapas permitidas. O mais parado aparece primeiro.
            </p>
          </div>
        </div>
        <div data-tour="propostas-kanban-prazos" className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-10 rounded-xl" onClick={() => setPrazosAbertos(true)}>
            <Timer className="mr-1.5 h-4 w-4" /> Prazos
          </Button>
          <Button asChild variant="secondary" size="sm" className="h-10 rounded-xl">
            <Link to="/operacional/propostas">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Lista
            </Link>
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card data-tour="propostas-kanban-filtros" className="space-y-3 rounded-2xl border-border/60 p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          {podeVerAssinantes && (
            <div
              role="tablist"
              aria-label="Base"
              className="inline-flex h-10 items-center gap-0.5 rounded-xl border border-border/70 bg-muted/50 p-1"
            >
              {(
                [
                  { id: "base", rotulo: "Sua base", Icone: Users },
                  { id: "assinantes", rotulo: "Assinantes", Icone: Building2 },
                ] as const
              ).map(({ id, rotulo, Icone }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={base === id}
                  onClick={() => {
                    setBase(id);
                    setRespFiltro("todos");
                    setBancoFiltro("todos");
                  }}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition",
                    base === id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icone className="h-3.5 w-3.5" /> {rotulo}
                </button>
              ))}
            </div>
          )}
          {base === "base" && (
            <Tabs value={escopo} onValueChange={(v) => setEscopo(v as "todas" | "minhas")}>
              <TabsList className="h-10 rounded-xl">
                <TabsTrigger value="minhas" className="rounded-lg">
                  Meu kanban
                </TabsTrigger>
                <TabsTrigger value="todas" className="rounded-lg">
                  Todas
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <div className="relative min-w-0 flex-[1_1_220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 rounded-xl pl-9 shadow-sm"
              placeholder={base === "base" ? "Cliente, CPF/CNPJ ou nº da proposta" : "Cliente ou nº da proposta"}
              value={q}
              maxLength={120}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2.5">
          {base === "assinantes" && (
            <div className="flex w-full flex-col gap-1 sm:w-auto">
              <Label className="text-xs text-muted-foreground">Assinante</Label>
              <select value={contaFiltro} onChange={(e) => setContaFiltro(e.target.value)} className={seletor}>
                <option value="todas">Todos os assinantes</option>
                {(contas ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
          {(base === "assinantes" || escopo === "todas") && (
            <div className="flex w-[calc(50%-0.35rem)] flex-col gap-1 sm:w-auto">
              <Label className="text-xs text-muted-foreground">{base === "base" ? "Responsável" : "Analista"}</Label>
              <select value={respFiltro} onChange={(e) => setRespFiltro(e.target.value)} className={seletor}>
                <option value="todos">Todos</option>
                {base === "assinantes" && <option value="__sem__">Sem analista</option>}
                {(base === "base" ? responsaveis : analistas).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex w-[calc(50%-0.35rem)] flex-col gap-1 sm:w-auto">
            <Label className="text-xs text-muted-foreground">Banco</Label>
            <select value={bancoFiltro} onChange={(e) => setBancoFiltro(e.target.value)} className={seletor}>
              <option value="todos">Todos</option>
              {bancos.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          {base === "base" && (
            <>
              <div className="flex w-[calc(50%-0.35rem)] flex-col gap-1 sm:w-auto">
                <Label className="text-xs text-muted-foreground">Corretor</Label>
                <select value={corretorFiltro} onChange={(e) => setCorretorFiltro(e.target.value)} className={seletor}>
                  <option value="todos">Todos</option>
                  {corretores.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex w-[calc(50%-0.35rem)] flex-col gap-1 sm:w-auto">
                <Label className="text-xs text-muted-foreground">Comercial</Label>
                <select value={comercialFiltro} onChange={(e) => setComercialFiltro(e.target.value)} className={seletor}>
                  <option value="todos">Todos</option>
                  {comerciais.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex w-[calc(50%-0.35rem)] flex-col gap-1 sm:w-auto">
                <Label className="text-xs text-muted-foreground">Imobiliária</Label>
                <select value={imobFiltro} onChange={(e) => setImobFiltro(e.target.value)} className={seletor}>
                  <option value="todos">Todos</option>
                  {imobiliarias.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex w-[calc(50%-0.35rem)] flex-col gap-1 sm:w-auto">
                <Label className="text-xs text-muted-foreground">De</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-10 rounded-xl sm:w-[9.5rem]" />
              </div>
              <div className="flex w-[calc(50%-0.35rem)] flex-col gap-1 sm:w-auto">
                <Label className="text-xs text-muted-foreground">Até</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-10 rounded-xl sm:w-[9.5rem]" />
              </div>
            </>
          )}
          <div className="flex flex-wrap gap-1.5 sm:ml-auto">
            <Button variant="ghost" className="h-10 rounded-xl" onClick={() => setOcultarVazias((v) => !v)}>
              {ocultarVazias ? <Eye className="mr-1 h-4 w-4" /> : <EyeOff className="mr-1 h-4 w-4" />}
              {ocultarVazias ? "Mostrar vazias" : "Ocultar vazias"}
            </Button>
            <Button variant="ghost" className="h-10 rounded-xl" onClick={limparFiltros}>
              <RotateCcw className="mr-1 h-4 w-4" /> Limpar
            </Button>
          </div>
        </div>
      </Card>

      {/* Indicadores */}
      <div data-tour="propostas-kanban-indicadores" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <div className="op-stat p-3.5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Em andamento</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{totais.ativos.quantidade}</p>
        </div>
        <div className="op-stat p-3.5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Volume em andamento</p>
          <p className="mt-2 truncate text-xl font-semibold tabular-nums text-foreground">{formatBRL(totais.ativos.soma)}</p>
        </div>
        <div className={cn("op-stat p-3.5", totais.alertas > 0 && "op-stat--alerta")} style={{ ["--op-accent" as string]: "var(--warning)" }}>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Perto do prazo</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-warning">{totais.alertas}</p>
        </div>
        <div className={cn("op-stat p-3.5", totais.criticas > 0 && "op-stat--alerta")} style={{ ["--op-accent" as string]: "var(--destructive)" }}>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Paradas além do prazo</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-destructive">{totais.criticas}</p>
        </div>
      </div>

      {totalServidor > cartoes.length && !carregando && (
        <p className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Mostrando as {cartoes.length} propostas mais recentes de {totalServidor}. Use os filtros para ver as demais.
        </p>
      )}

      {erro ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center">
          <AlertTriangle className="h-7 w-7 text-destructive" />
          <p className="text-sm font-medium text-foreground">Não foi possível carregar o quadro</p>
          <p className="max-w-sm text-xs text-muted-foreground">{mensagemDeErro(erro, "Tente de novo em instantes.")}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => (base === "base" ? consultaBase.refetch() : consultaAssinantes.refetch())}
          >
            Tentar de novo
          </Button>
        </div>
      ) : carregando ? (
        <div data-tour="propostas-kanban-colunas" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      ) : (
        <div data-tour="propostas-kanban-colunas" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {colunasVisiveis.map((col) => {
            const cfg = statusProposta(col.destino);
            const lista = porColuna.get(col.destino) ?? [];
            const visiveis = lista.slice(0, MAX_VISIVEIS_POR_COLUNA);
            const excedente = lista.length - visiveis.length;
            const resumo = resumoColuna(lista.map((c) => ({ valor_financiamento: c.valor })));
            const criticas = lista.filter((c) => c.nivel === "critico").length;
            const destinoValido =
              arrastando !== null &&
              (() => {
                const r = avaliarSoltura(arrastando.status, col.destino, arrastando.banco);
                return r.tipo !== "recusada" && r.tipo !== "nada";
              })();
            return (
              <section
                key={col.destino}
                aria-label={rotuloColuna(col.destino)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (destinoValido) setSobre(col.destino);
                }}
                onDragLeave={() => setSobre((s) => (s === col.destino ? null : s))}
                onDrop={() => soltar(col.destino)}
                className={cn(
                  "flex max-h-[42rem] min-h-[14rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-sm transition-[box-shadow,border-color,opacity]",
                  arrastando && !destinoValido && "opacity-55",
                  destinoValido && "border-dashed border-primary/60",
                  sobre === col.destino && "ring-2 ring-primary/40",
                )}
              >
                <header className="shrink-0 border-b border-border/50">
                  <div className={cn("h-[3px]", TONE_BAR[cfg.tone])} />
                  <div className="flex items-start justify-between gap-2 bg-gradient-to-br from-primary/[0.04] via-card to-card px-3.5 py-2.5">
                    <div className="min-w-0">
                      <h2 className="truncate text-xs font-semibold uppercase leading-snug text-foreground">
                        {rotuloColuna(col.destino)}
                      </h2>
                      <p className="mt-0.5 text-[11px] font-medium tabular-nums text-muted-foreground" title={formatBRL(resumo.soma)}>
                        {resumo.soma > 0 ? compacto.format(resumo.soma) : "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {criticas > 0 && (
                        <span
                          className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive"
                          title="Paradas além do prazo"
                        >
                          {criticas}!
                        </span>
                      )}
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary ring-1 ring-inset ring-primary/20">
                        {resumo.quantidade}
                      </span>
                    </div>
                  </div>
                </header>
                <div className="custom-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto p-2.5">
                  {visiveis.map(renderCartao)}
                  {lista.length === 0 && (
                    <p className="py-8 text-center text-xs text-muted-foreground">Nenhuma proposta nesta etapa</p>
                  )}
                </div>
                {lista.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setBuscaPasta("");
                      setPastaAberta(col.destino);
                    }}
                    className="flex shrink-0 items-center justify-between gap-2 border-t border-border/60 px-3.5 py-2.5 text-xs font-medium text-muted-foreground transition hover:bg-primary/5 hover:text-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-primary" />
                      {excedente > 0 ? `Ver todas (+${excedente})` : "Abrir e pesquisar"}
                    </span>
                    <Search className="h-3.5 w-3.5 opacity-70" />
                  </button>
                )}
              </section>
            );
          })}
          {colunasVisiveis.length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card p-12 text-center">
              <KanbanSquare className="h-7 w-7 text-primary" />
              <p className="text-sm font-semibold text-foreground">Nenhuma proposta com esses filtros</p>
              <p className="text-xs text-muted-foreground">Limpe os filtros ou mostre as etapas vazias.</p>
            </div>
          )}
        </div>
      )}

      {/* Pasta da coluna (todas + busca) */}
      <Dialog open={pastaAberta !== null} onOpenChange={(o) => !o && setPastaAberta(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-4xl overflow-hidden rounded-2xl p-0">
          <div className="border-b border-border/50 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 px-5 py-4">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 text-base font-semibold tracking-tight">
                {pastaAberta ? rotuloColuna(pastaAberta) : ""}
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {(pastaAberta ? (porColuna.get(pastaAberta) ?? []) : []).length} propostas
                </span>
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="space-y-3 px-5 pb-5 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Buscar por cliente, ID H., nº no banco ou responsável"
                value={buscaPasta}
                onChange={(e) => setBuscaPasta(e.target.value)}
                className="h-11 rounded-xl pl-10"
              />
            </div>
            <div className="grid max-h-[62vh] grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2 [scrollbar-gutter:stable]">
              {cartoesDaPasta.map(renderCartao)}
              {pastaAberta && cartoesDaPasta.length === 0 && (
                <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Nenhuma proposta encontrada.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Etapa que costuma vir do banco */}
      <AlertDialog open={confirmar !== null} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mover para "{confirmar ? rotuloColuna(confirmar.destino) : ""}"?</AlertDialogTitle>
            <AlertDialogDescription>{confirmar?.aviso}</AlertDialogDescription>
          </AlertDialogHeader>
          {confirmar && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              <BancoLogo nome={confirmar.cartao.banco} size="xs" />
              <span className="truncate font-medium">{confirmar.cartao.cliente}</span>
              <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{confirmar.cartao.numero}</span>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const c = confirmar;
                setConfirmar(null);
                if (c) void mover(c.cartao, c.destino);
              }}
            >
              Mover assim mesmo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancelamento com motivo */}
      <Dialog open={cancelar !== null} onOpenChange={(o) => !o && movendo === null && setCancelar(null)}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar proposta</DialogTitle>
            <DialogDescription>
              {cancelar?.cliente} · {cancelar?.numero}. O motivo fica no histórico
              {cancelar?.bruto?.homefin_id_oportunidade ? " e o banco é avisado." : "."}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2">
            <Label htmlFor="motivo-cancelamento" className="text-xs text-muted-foreground">
              Motivo
            </Label>
            <Textarea
              id="motivo-cancelamento"
              rows={3}
              maxLength={500}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: cliente desistiu da compra"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={movendo !== null} onClick={() => setCancelar(null)}>
              Voltar
            </Button>
            <Button variant="destructive" disabled={movendo !== null || motivo.trim().length < 5} onClick={confirmarCancelamento}>
              {movendo !== null && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Cancelar proposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MarcarRegistroDialog proposta={registrando} onClose={() => setRegistrando(null)} />

      <PrazosKanbanDialog
        aberto={prazosAbertos}
        onAberto={setPrazosAbertos}
        dados={prazosDados ? { ...prazosDados, podeEditar: prazosDados.podeEditar && podeEditarPropostas } : undefined}
      />
    </div>
  );
}
