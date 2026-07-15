import { AdminHero } from "@/components/admin/admin-hero";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck,
  Filter,
  X,
  Search,
  UserPlus,
  UserCog,
  Trash2,
  FilePlus2,
  FileEdit,
  Send,
  KeyRound,
  Users,
  Activity,
  CalendarClock,
  ChevronDown,
  Download,
  Monitor,
  Fingerprint,
  Clock,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarAuditoria,
  opcoesAuditoria,
  type AuditoriaLinha,
} from "@/lib/admin/auditoria.functions";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.auditoria"),
  component: Pagina,
});

const TODOS = "__todos__";

interface Filtros {
  dataInicio: string;
  dataFim: string;
  userId: string;
  acao: string;
  entidade: string;
  busca: string;
}

const FILTROS_VAZIOS: Filtros = {
  dataInicio: "",
  dataFim: "",
  userId: "",
  acao: "",
  entidade: "",
  busca: "",
};

// --- Classificação visual das ações (ícone + tom institucional) ---------------
type Tom = "criar" | "atualizar" | "excluir" | "enviar" | "seguranca" | "neutro";

const TOM_CLASSES: Record<Tom, { chip: string; dot: string; ring: string }> = {
  criar: {
    chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/25",
  },
  atualizar: {
    chip: "bg-primary/12 text-primary",
    dot: "bg-primary",
    ring: "ring-primary/25",
  },
  excluir: {
    chip: "bg-destructive/12 text-destructive",
    dot: "bg-destructive",
    ring: "ring-destructive/25",
  },
  enviar: {
    chip: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
    dot: "bg-sky-500",
    ring: "ring-sky-500/25",
  },
  seguranca: {
    chip: "bg-amber-500/12 text-amber-600 dark:text-amber-500",
    dot: "bg-amber-500",
    ring: "ring-amber-500/25",
  },
  neutro: {
    chip: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
    ring: "ring-border",
  },
};

function classificar(acao: string): { tom: Tom; Icone: LucideIcon } {
  const a = acao.toLowerCase();
  if (a.includes("resetar_senha") || a.includes("habilitar_login") || a.includes("permiss"))
    return { tom: "seguranca", Icone: KeyRound };
  if (a.includes("excluir") || a.includes("desativar"))
    return { tom: "excluir", Icone: Trash2 };
  if (a.includes("enviar")) return { tom: "enviar", Icone: Send };
  if (a.includes("criar") || a.includes("anexar") || a.includes("cadastr") || a.includes("ativar"))
    return {
      tom: "criar",
      Icone: a.includes("pessoa") || a.includes("cliente") ? UserPlus : FilePlus2,
    };
  if (a.includes("atualizar") || a.includes("editar") || a.includes("renomear") || a.includes("personalizar"))
    return {
      tom: "atualizar",
      Icone: a.includes("pessoa") || a.includes("cliente") ? UserCog : FileEdit,
    };
  return { tom: "neutro", Icone: Activity };
}

function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo",   hour: "2-digit", minute: "2-digit" });
}

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo",  
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Gera e baixa um CSV com a trilha de auditoria carregada. */
function exportarCsv(registros: AuditoriaLinha[]): void {
  const cabecalho = [
    "Data/Hora",
    "Usuário",
    "Ação",
    "Descrição",
    "Entidade",
    "ID Entidade",
    "IP",
    "Navegador",
  ];
  const escapar = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const linhas = registros.map((r) =>
    [
      fmtDataHora(r.created_at),
      r.ator_nome ?? "",
      r.acao_label,
      r.descricao ?? "",
      r.entidade ?? "",
      r.entidade_id ?? "",
      r.ip ?? "",
      r.user_agent ?? "",
    ]
      .map(escapar)
      .join(","),
  );
  const csv = "\ufeff" + [cabecalho.map(escapar).join(","), ...linhas].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Diferença legível entre payload anterior e novo. */
function diffPayload(
  anterior: unknown,
  novo: unknown,
): { campo: string; de: string; para: string }[] {
  const a = (anterior && typeof anterior === "object" ? anterior : {}) as Record<string, unknown>;
  const n = (novo && typeof novo === "object" ? novo : {}) as Record<string, unknown>;
  const chaves = [...new Set([...Object.keys(a), ...Object.keys(n)])].sort();
  const fmt = (v: unknown) =>
    v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return chaves
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(n[k]))
    .map((k) => ({ campo: k, de: fmt(a[k]), para: fmt(n[k]) }));
}

function chaveDia(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo",  
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function isHoje(iso: string): boolean {
  const d = new Date(iso);
  const h = new Date();
  return (
    d.getDate() === h.getDate() &&
    d.getMonth() === h.getMonth() &&
    d.getFullYear() === h.getFullYear()
  );
}

function Kpi({
  icon: Icone,
  valor,
  rotulo,
}: {
  icon: LucideIcon;
  valor: string | number;
  rotulo: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icone className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xl font-bold leading-none tracking-tight text-foreground tabular-nums">
            {valor}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{rotulo}</p>
        </div>
      </div>
    </div>
  );
}


function Pagina() {
  const [rascunho, setRascunho] = useState<Filtros>(FILTROS_VAZIOS);
  const [aplicados, setAplicados] = useState<Filtros>(FILTROS_VAZIOS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [selecionado, setSelecionado] = useState<AuditoriaLinha | null>(null);

  const opcoes = useQuery({
    queryKey: ["admin-auditoria-opcoes"],
    queryFn: () => opcoesAuditoria(),
  });

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (aplicados.dataInicio) p.dataInicio = new Date(aplicados.dataInicio).toISOString();
    if (aplicados.dataFim) {
      const d = new Date(aplicados.dataFim);
      d.setHours(23, 59, 59, 999);
      p.dataFim = d.toISOString();
    }
    if (aplicados.userId) p.userId = aplicados.userId;
    if (aplicados.acao) p.acao = aplicados.acao;
    if (aplicados.entidade) p.entidade = aplicados.entidade;
    if (aplicados.busca.trim()) p.busca = aplicados.busca.trim();
    return p;
  }, [aplicados]);

  const q = useQuery({
    queryKey: ["admin-auditoria", params],
    queryFn: () => listarAuditoria({ data: params }),
  });

  const registros = (q.data ?? []) as AuditoriaLinha[];
  const temFiltro = Object.values(aplicados).some((v) => v);
  const qtdFiltros = Object.values(aplicados).filter((v) => v).length;

  // KPIs derivados dos registros carregados.
  const kpis = useMemo(() => {
    const total = registros.length;
    const hoje = registros.filter((r) => isHoje(r.created_at)).length;
    const usuarios = new Set(registros.map((r) => r.user_id).filter(Boolean)).size;
    const contagem = new Map<string, number>();
    registros.forEach((r) => contagem.set(r.acao_label, (contagem.get(r.acao_label) ?? 0) + 1));
    let topAcao = "—";
    let topN = 0;
    contagem.forEach((n, k) => {
      if (n > topN) {
        topN = n;
        topAcao = k;
      }
    });
    return { total, hoje, usuarios, topAcao };
  }, [registros]);

  // Agrupamento por dia para a linha do tempo.
  const grupos = useMemo(() => {
    const mapa = new Map<string, AuditoriaLinha[]>();
    for (const r of registros) {
      const k = chaveDia(r.created_at);
      const arr = mapa.get(k) ?? [];
      arr.push(r);
      mapa.set(k, arr);
    }
    return [...mapa.entries()];
  }, [registros]);

  function aplicar() {
    setAplicados(rascunho);
  }
  function limpar() {
    setRascunho(FILTROS_VAZIOS);
    setAplicados(FILTROS_VAZIOS);
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        icon={<ShieldCheck className="h-5 w-5" />}
        titulo="Auditoria"
        descricao="Acompanhe, de forma clara e cronológica, tudo o que acontece no seu ecossistema."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {q.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
          ))
        ) : (
          <>
            <Kpi icon={Activity} valor={kpis.total} rotulo="Eventos no período" />
            <Kpi icon={CalendarClock} valor={kpis.hoje} rotulo="Eventos hoje" />
            <Kpi icon={Users} valor={kpis.usuarios} rotulo="Usuários envolvidos" />
            <Kpi icon={ShieldCheck} valor={kpis.topAcao} rotulo="Operação mais frequente" />
          </>
        )}
      </div>

      {/* Barra de busca + filtros avançados */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por ação, entidade ou IP…"
              value={rascunho.busca}
              onChange={(e) => setRascunho((s) => ({ ...s, busca: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && aplicar()}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={aplicar}>
              Buscar
            </Button>
            <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
              <CollapsibleTrigger asChild>
                <Button size="sm" variant="outline">
                  <Filter className="mr-2 size-4" />
                  Filtros
                  {qtdFiltros > 0 && (
                    <Badge className="ml-2 h-5 min-w-5 justify-center px-1.5" variant="secondary">
                      {qtdFiltros}
                    </Badge>
                  )}
                  <ChevronDown
                    className={cn(
                      "ml-1 size-4 transition-transform",
                      filtrosAbertos && "rotate-180",
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportarCsv(registros)}
              disabled={registros.length === 0}
            >
              <Download className="mr-2 size-4" />
              Exportar
            </Button>
          </div>
        </div>

        <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
          <CollapsibleContent>
            <div className="border-t border-border p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Data inicial</Label>
                  <Input
                    type="date"
                    value={rascunho.dataInicio}
                    onChange={(e) => setRascunho((s) => ({ ...s, dataInicio: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data final</Label>
                  <Input
                    type="date"
                    value={rascunho.dataFim}
                    onChange={(e) => setRascunho((s) => ({ ...s, dataFim: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Usuário</Label>
                  <Select
                    value={rascunho.userId || TODOS}
                    onValueChange={(v) =>
                      setRascunho((s) => ({ ...s, userId: v === TODOS ? "" : v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TODOS}>Todos os usuários</SelectItem>
                      {(opcoes.data?.atores ?? []).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de operação</Label>
                  <Select
                    value={rascunho.acao || TODOS}
                    onValueChange={(v) =>
                      setRascunho((s) => ({ ...s, acao: v === TODOS ? "" : v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TODOS}>Todas as operações</SelectItem>
                      {(opcoes.data?.acoes ?? []).map((a) => (
                        <SelectItem key={a.valor} value={a.valor}>
                          {a.rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Entidade</Label>
                  <Select
                    value={rascunho.entidade || TODOS}
                    onValueChange={(v) =>
                      setRascunho((s) => ({ ...s, entidade: v === TODOS ? "" : v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TODOS}>Todas as entidades</SelectItem>
                      {(opcoes.data?.entidades ?? []).map((e) => (
                        <SelectItem key={e} value={e}>
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={aplicar}>
                  <Filter className="mr-2 size-4" /> Aplicar filtros
                </Button>
                {temFiltro && (
                  <Button size="sm" variant="ghost" onClick={limpar}>
                    <X className="mr-2 size-4" /> Limpar
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Linha do tempo */}
      {q.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : registros.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <ShieldCheck className="size-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">Nenhum registro encontrado</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {temFiltro
                ? "Ajuste os filtros para ver outros eventos."
                : "As ações realizadas no sistema aparecerão aqui."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map(([dia, itens]) => (
            <section key={dia}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {dia}
                </h2>
                <span className="h-px flex-1 bg-border" />
                <Badge variant="secondary" className="text-[10px]">
                  {itens.length} evento{itens.length === 1 ? "" : "s"}
                </Badge>
              </div>

              <div className="relative space-y-2 pl-3">
                <span className="absolute bottom-2 left-[7px] top-2 w-px bg-border" aria-hidden />
                {itens.map((r) => {
                  const { tom, Icone } = classificar(r.acao);
                  const c = TOM_CLASSES[tom];
                  return (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setSelecionado(r)}
                      className="relative flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/30 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span
                        className={cn(
                          "z-10 grid size-8 shrink-0 place-items-center rounded-lg ring-1",
                          c.chip,
                          c.ring,
                        )}
                      >
                        <Icone className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug text-foreground">
                          {r.mensagem}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className={cn("inline-flex items-center gap-1.5 font-medium")}>
                            <span className={cn("size-1.5 rounded-full", c.dot)} />
                            {r.acao_label}
                          </span>
                          {r.entidade && <span className="capitalize">{r.entidade}</span>}
                          {r.ip && <span className="tabular-nums">IP {r.ip}</span>}
                        </div>
                      </div>
                      <span className="shrink-0 whitespace-nowrap text-xs font-medium tabular-nums text-muted-foreground">
                        {fmtHora(r.created_at)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <DetalheAuditoria registro={selecionado} onClose={() => setSelecionado(null)} />
    </div>
  );
}

// --- Modal de detalhe do evento --------------------------------------------
function LinhaDetalhe({
  icon: Icone,
  rotulo,
  valor,
}: {
  icon: LucideIcon;
  rotulo: string;
  valor: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icone className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </p>
        <p className="mt-0.5 break-words text-sm font-medium text-foreground">{valor}</p>
      </div>
    </div>
  );
}

function DetalheAuditoria({
  registro,
  onClose,
}: {
  registro: AuditoriaLinha | null;
  onClose: () => void;
}) {
  const mudancas = registro
    ? diffPayload(registro.payload_anterior, registro.payload_novo)
    : [];
  const info = registro ? classificar(registro.acao) : null;

  return (
    <Dialog open={!!registro} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg gap-0 p-0">
        {registro && info && (
          <>
            <DialogHeader className="space-y-2 border-b border-border p-5">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg ring-1",
                    TOM_CLASSES[info.tom].chip,
                    TOM_CLASSES[info.tom].ring,
                  )}
                >
                  <info.Icone className="size-4" />
                </span>
                <div className="min-w-0">
                  <DialogTitle className="text-base leading-tight">
                    {registro.acao_label}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 truncate font-mono text-xs">
                    {registro.acao}
                  </DialogDescription>
                </div>
              </div>
              <p className="text-sm text-foreground">{registro.mensagem}</p>
            </DialogHeader>

            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <LinhaDetalhe
                    icon={UserIcon}
                    rotulo="Usuário"
                    valor={registro.ator_nome ?? "Sistema"}
                  />
                  <LinhaDetalhe
                    icon={Clock}
                    rotulo="Data e hora"
                    valor={fmtDataHora(registro.created_at)}
                  />
                  {registro.entidade && (
                    <LinhaDetalhe
                      icon={Activity}
                      rotulo="Entidade"
                      valor={
                        registro.entidade +
                        (registro.entidade_id ? ` · ${registro.entidade_id}` : "")
                      }
                    />
                  )}
                  {registro.ip && (
                    <LinhaDetalhe icon={Fingerprint} rotulo="Endereço IP" valor={registro.ip} />
                  )}
                  {registro.user_agent && (
                    <div className="sm:col-span-2">
                      <LinhaDetalhe
                        icon={Monitor}
                        rotulo="Navegador"
                        valor={registro.user_agent}
                      />
                    </div>
                  )}
                </div>

                {mudancas.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Alterações registradas
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Campo</th>
                            <th className="px-3 py-2 text-left font-medium">Antes</th>
                            <th className="px-3 py-2 text-left font-medium">Depois</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mudancas.map((m) => (
                            <tr key={m.campo} className="border-t border-border align-top">
                              <td className="px-3 py-2 font-medium text-foreground">{m.campo}</td>
                              <td className="px-3 py-2 text-destructive/80 line-through">{m.de}</td>
                              <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400">
                                {m.para}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
