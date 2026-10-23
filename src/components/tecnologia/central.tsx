/**
 * Blocos da central de operações (visão geral da Gestão de Tecnologia): cartão com
 * ferramentas (tela cheia, atualizar, recolher), minigráficos de área, o gráfico grande
 * "Acessos e latência", a rosca de usuários online, a tabela por UF, a linha do tempo
 * e a tabela de licenças recentes. Tudo responsivo: no celular empilha e a tabela vira
 * cartões.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  KeyRound,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  RefreshCw,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { COR, EstadoVazio, Esqueleto, fmtNum } from "./base";
import { useClasseTema } from "./tema";
import { NOME_UF, REGIAO_UF } from "@/lib/tecnologia/brasil-geo";
import type { EventoAtividade, LicencaRecente } from "@/lib/tecnologia/tecnologia.functions";

// ---------------------------------------------------------------------------
// Cartão com ferramentas
// ---------------------------------------------------------------------------

export function CartaoFerramentas({
  titulo,
  subtitulo,
  icone,
  extra,
  onAtualizar,
  atualizando,
  children,
  className,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  icone?: ReactNode;
  /** Controles próprios do cartão (ex.: seletor de janela), ao lado das ferramentas. */
  extra?: ReactNode;
  onAtualizar?: () => void;
  atualizando?: boolean;
  children: (telaCheia: boolean) => ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [recolhido, setRecolhido] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  const corpoId = useId();

  useEffect(() => {
    const f = () => setTelaCheia(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);

  const alternarTelaCheia = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void ref.current?.requestFullscreen?.().catch(() => {});
  };

  return (
    <section
      ref={ref}
      className={cn(
        "tec-cartao min-w-0 rounded-xl border border-border bg-card",
        telaCheia && "overflow-auto p-4 sm:p-6",
        className,
      )}
    >
      <header className="flex flex-wrap items-start gap-x-2 gap-y-2 px-4 pt-4 sm:px-5">
        <div className="order-1 min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {icone && <span className="text-[color:var(--realce)]">{icone}</span>}
            {titulo}
          </h2>
          {subtitulo && <p className="mt-0.5 text-xs text-muted-foreground">{subtitulo}</p>}
        </div>
        {extra && (
          <div className="order-3 flex w-full min-w-0 items-center gap-1 lg:order-2 lg:w-auto">
            {extra}
          </div>
        )}
        <div className="order-2 flex shrink-0 items-center gap-1 lg:order-3">
          <Ferramenta
            rotulo={telaCheia ? "Sair da tela cheia" : "Tela cheia"}
            onClick={alternarTelaCheia}
          >
            {telaCheia ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Ferramenta>
          {onAtualizar && (
            <Ferramenta rotulo="Atualizar" onClick={onAtualizar}>
              <RefreshCw
                className={cn("size-3.5", atualizando && "animate-spin motion-reduce:animate-none")}
              />
            </Ferramenta>
          )}
          <Ferramenta
            rotulo={recolhido ? "Mostrar" : "Recolher"}
            onClick={() => setRecolhido((r) => !r)}
            expandido={!recolhido}
            controla={corpoId}
          >
            <ChevronDown className={cn("size-4 transition-transform", recolhido && "-rotate-90")} />
          </Ferramenta>
        </div>
      </header>
      <div id={corpoId} hidden={recolhido} className="p-4 pt-3 sm:px-5">
        {children(telaCheia)}
      </div>
    </section>
  );
}

function Ferramenta({
  rotulo,
  onClick,
  children,
  expandido,
  controla,
}: {
  rotulo: string;
  onClick: () => void;
  children: ReactNode;
  expandido?: boolean;
  controla?: string;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      aria-expanded={expandido}
      aria-controls={controla}
      onClick={onClick}
      className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:size-8"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Minigráfico de área (cartões coloridos da central)
// ---------------------------------------------------------------------------

export function MiniArea({
  titulo,
  valor,
  unidade,
  rodape,
  dados,
  chave,
  cor,
  carregando,
}: {
  titulo: string;
  valor: ReactNode;
  unidade?: string;
  rodape?: ReactNode;
  dados: Record<string, unknown>[];
  chave: string;
  cor: string;
  carregando?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <div className="tec-cartao relative min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="px-4 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {titulo}
        </p>
        {carregando ? (
          <Esqueleto className="mt-2 h-8 w-24" />
        ) : (
          <p className="mt-1 flex items-baseline gap-1 text-[1.75rem] font-semibold leading-none tracking-tight text-foreground tabular-nums">
            {valor}
            {unidade && (
              <span className="text-sm font-medium text-muted-foreground">{unidade}</span>
            )}
          </p>
        )}
        {rodape && <p className="mt-1 text-[11px] text-muted-foreground">{rodape}</p>}
      </div>
      <div className="mt-2 h-16 w-full">
        {dados.length > 1 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dados} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cor} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={cor} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <YAxis hide domain={[0, "dataMax"]} />
              <Area
                type="monotone"
                dataKey={chave}
                stroke={cor}
                strokeWidth={1.75}
                fill={`url(#g${id})`}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// "Acessos e latência": linhas com pontos, eixo duplo
// ---------------------------------------------------------------------------

export function GraficoAcessos<T extends object>({
  dados,
  rotuloX,
  telaCheia,
}: {
  dados: T[];
  rotuloX: (v: string) => string;
  telaCheia?: boolean;
}) {
  const passo = Math.max(1, Math.ceil(dados.length / 16));
  const ponto =
    (cor: string) => (p: { cx?: number; cy?: number; index?: number; value?: unknown }) =>
      p.cx == null || p.cy == null || p.value == null || (p.index ?? 0) % passo !== 0 ? (
        <g key={`v${p.index}`} />
      ) : (
        <circle
          key={`p${p.index}`}
          cx={p.cx}
          cy={p.cy}
          r={3}
          fill="var(--card)"
          stroke={cor}
          strokeWidth={1.75}
        />
      );
  return (
    <div
      className={cn(
        "w-full min-w-0",
        telaCheia ? "h-[70vh]" : "h-[240px] sm:h-[300px] xl:h-[340px]",
      )}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--tec-grade)" strokeDasharray="3 4" />
          <XAxis
            dataKey="inicio"
            tickFormatter={rotuloX}
            tick={{ fill: COR.eixo, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--tec-grade)" }}
            minTickGap={28}
          />
          <YAxis
            yAxisId="req"
            tick={{ fill: COR.eixo, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={50}
            allowDecimals={false}
            tickFormatter={(v: number) =>
              v >= 1000
                ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
                : `${v}`
            }
          />
          <YAxis
            yAxisId="ms"
            orientation="right"
            tick={{ fill: COR.eixo, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={46}
            tickFormatter={(v: number) =>
              v >= 1000
                ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}s`
                : `${v}`
            }
          />
          <Tooltip
            cursor={{ stroke: COR.eixo, strokeOpacity: 0.35, strokeDasharray: "3 3" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 12,
              color: "var(--popover-foreground)",
            }}
            labelFormatter={(v) => rotuloX(String(v))}
            formatter={(v: number, nome: string) =>
              nome === "p95" ? [`${fmtNum(v)} ms`, "p95"] : [fmtNum(v), nome]
            }
          />
          <Line
            yAxisId="req"
            type="monotone"
            dataKey="requisicoes"
            name="Requisições"
            stroke={COR.primaria}
            strokeWidth={2}
            dot={ponto(COR.primaria)}
            activeDot={{ r: 4.5 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="req"
            type="monotone"
            dataKey="falhas"
            name="Falhas (5xx)"
            stroke={COR.falha}
            strokeWidth={1.75}
            dot={ponto(COR.falha)}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="ms"
            type="monotone"
            dataKey="p95_ms"
            name="p95"
            stroke={COR.alerta}
            strokeWidth={1.75}
            strokeDasharray="5 4"
            dot={ponto(COR.alerta)}
            activeDot={{ r: 4 }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rosca de usuários online + tabela por UF
// ---------------------------------------------------------------------------

export const PERFIS_ROSCA: { chave: string; rotulo: string; cor: string }[] = [
  { chave: "corretor", rotulo: "Corretores", cor: "#5b8cff" },
  { chave: "imobiliaria", rotulo: "Imobiliárias", cor: "#a77bff" },
  { chave: "parceiro", rotulo: "Parceiros", cor: "#27c48a" },
  { chave: "cliente", rotulo: "Clientes", cor: "#f5b80b" },
  { chave: "plataforma", rotulo: "Plataforma", cor: "#f26d6d" },
];

export function RoscaUsuarios({
  porPerfil,
  total,
  rotuloCentro = "online agora",
}: {
  porPerfil: Record<string, number>;
  total: number;
  rotuloCentro?: string;
}) {
  const dados = PERFIS_ROSCA.map((p) => ({ ...p, n: porPerfil[p.chave] ?? 0 })).filter(
    (p) => p.n > 0,
  );
  return (
    <div>
      <div className="relative mx-auto aspect-square w-full max-w-[200px]">
        {dados.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={dados}
                dataKey="n"
                nameKey="rotulo"
                innerRadius="72%"
                outerRadius="96%"
                paddingAngle={2}
                stroke="none"
                startAngle={90}
                endAngle={-270}
                isAnimationActive={false}
              >
                {dados.map((d) => (
                  <Cell key={d.chave} fill={d.cor} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "var(--popover-foreground)",
                }}
                formatter={(v: number, nome: string) => [fmtNum(v), nome]}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="size-full rounded-full border-[14px] border-muted" />
        )}
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-3xl font-semibold leading-none tracking-tight text-foreground tabular-nums">
              {fmtNum(total)}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {rotuloCentro}
            </p>
          </div>
        </div>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {PERFIS_ROSCA.map((p) => (
          <li key={p.chave} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <span className="size-2 shrink-0 rounded-full" style={{ background: p.cor }} />
              <span className="truncate">{p.rotulo}</span>
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {fmtNum(porPerfil[p.chave] ?? 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const COR_REGIAO: Record<string, string> = {
  N: "linear-gradient(135deg,#34d399,#0f9f6e)",
  NE: "linear-gradient(135deg,#fbbf24,#e08a00)",
  CO: "linear-gradient(135deg,#a78bfa,#7c4dee)",
  SE: "linear-gradient(135deg,#60a5fa,#2f5fea)",
  S: "linear-gradient(135deg,#f87171,#d93c45)",
};

export function SeloUf({ uf }: { uf: string }) {
  return (
    <span
      className="grid h-6 w-9 shrink-0 place-items-center rounded-md text-[11px] font-bold tracking-wide text-white"
      style={{ background: COR_REGIAO[REGIAO_UF[uf] ?? "SE"] ?? "var(--muted)" }}
      title={NOME_UF[uf] ?? uf}
    >
      {uf}
    </span>
  );
}

export function TabelaUfs({
  porUf,
  limite = 6,
}: {
  porUf: Record<string, number>;
  limite?: number;
}) {
  const [todos, setTodos] = useState(false);
  const linhas = Object.entries(porUf)
    .filter(([uf]) => uf !== "sem_uf")
    .sort((a, b) => b[1] - a[1]);
  const total = Object.values(porUf).reduce((a, b) => a + b, 0);
  if (!linhas.length)
    return (
      <p className="py-3 text-center text-xs text-muted-foreground">
        Ninguém online com UF definida.
      </p>
    );
  const visiveis = todos ? linhas : linhas.slice(0, limite);
  return (
    <div>
      <ul className="divide-y divide-border">
        {visiveis.map(([uf, n]) => (
          <li key={uf} className="flex min-h-11 items-center gap-3 py-1.5 text-sm">
            <SeloUf uf={uf} />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {NOME_UF[uf] ?? uf}
            </span>
            <span className="w-12 text-right font-semibold tabular-nums text-foreground">
              {fmtNum(n)}
            </span>
            <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
              {total
                ? `${((n / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                : "—"}
            </span>
          </li>
        ))}
      </ul>
      {linhas.length > limite && (
        <button
          type="button"
          onClick={() => setTodos((t) => !t)}
          className="mt-1 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-[color:var(--realce)] hover:underline"
        >
          {todos ? "Ver menos" : `Ver os ${linhas.length} estados`}
          <ChevronDown className={cn("size-3.5 transition-transform", todos && "rotate-180")} />
        </button>
      )}
      {(porUf.sem_uf ?? 0) > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          + {fmtNum(porUf.sem_uf)} sem UF (conta sem CRECI/UF ou equipe da plataforma)
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linha do tempo: atividade recente
// ---------------------------------------------------------------------------

const EVENTO: Record<EventoAtividade["tipo"], { rotulo: string; cor: string; Icone: typeof Bug }> =
  {
    incidente_aberto: { rotulo: "Incidente aberto", cor: "#f26d6d", Icone: ShieldAlert },
    alerta: { rotulo: "Alerta automático", cor: "#f5b80b", Icone: AlertTriangle },
    incidente_resolvido: { rotulo: "Incidente resolvido", cor: "#27c48a", Icone: CheckCircle2 },
    licenca_criada: { rotulo: "Licença criada", cor: "#5b8cff", Icone: KeyRound },
    erro_novo: { rotulo: "Erro novo", cor: "#a77bff", Icone: Bug },
    rotina_erro: { rotulo: "Rotina com erro", cor: "#f26d6d", Icone: Workflow },
  };

function rotuloDia(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function AtividadeRecente({
  eventos,
  carregando,
}: {
  eventos: EventoAtividade[];
  carregando?: boolean;
}) {
  if (carregando)
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Esqueleto key={i} className="h-12" />
        ))}
      </div>
    );
  if (!eventos.length)
    return (
      <EstadoVazio
        titulo="Nada nas últimas 48 horas"
        texto="Incidentes, alertas, licenças novas e erros novos aparecem aqui."
        className="py-6"
      />
    );
  const grupos: [string, EventoAtividade[]][] = [];
  for (const e of eventos) {
    const dia = rotuloDia(e.em);
    const g = grupos.find(([d]) => d === dia);
    if (g) g[1].push(e);
    else grupos.push([dia, [e]]);
  }
  return (
    <div className="space-y-4">
      {grupos.map(([dia, lista]) => (
        <div key={dia}>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
            <span className="size-2.5 rounded-full border-2 border-[color:var(--realce)]" />
            {dia}
          </p>
          <ol className="relative ml-[4.5px] space-y-3 border-l border-border pl-4">
            {lista.map((e, i) => {
              const t = EVENTO[e.tipo] ?? EVENTO.erro_novo;
              return (
                <li key={`${e.em}-${i}`} className="relative">
                  <span
                    className="absolute -left-[25px] top-0.5 grid size-[18px] place-items-center rounded-full ring-4 ring-card"
                    style={{ background: t.cor }}
                  >
                    <t.Icone className="size-2.5 text-white" />
                  </span>
                  <p className="text-[11px] font-medium tabular-nums text-muted-foreground">
                    {new Date(e.em).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {t.rotulo}
                  </p>
                  <p className="mt-0.5 line-clamp-2 break-words text-sm text-foreground">
                    {e.titulo}
                  </p>
                  {e.detalhe && (
                    <p className="line-clamp-1 break-all text-[11px] text-[color:var(--realce)]">
                      {e.detalhe}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Licenças e usuários recentes
// ---------------------------------------------------------------------------

const SITUACAO: Record<string, { rotulo: string; cor: string }> = {
  ativo: { rotulo: "ativa", cor: "#27c48a" },
  trial: { rotulo: "teste", cor: "#5b8cff" },
  somente_leitura: { rotulo: "somente leitura", cor: "#f5b80b" },
  suspenso: { rotulo: "suspensa", cor: "#f26d6d" },
  cancelado: { rotulo: "cancelada", cor: "#95a2bd" },
  inadimplente: { rotulo: "inadimplente", cor: "#f26d6d" },
};
const TIPO_CONTA: Record<string, string> = {
  corretor: "corretor",
  imobiliaria: "imobiliária",
  parceiro: "parceiro",
};

function Etiqueta({ chave }: { chave: string }) {
  const s = SITUACAO[chave] ?? { rotulo: chave, cor: "#95a2bd" };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{
        color: s.cor,
        background: `color-mix(in oklab, ${s.cor} 16%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${s.cor} 35%, transparent)`,
      }}
    >
      {s.rotulo}
    </span>
  );
}

function iniciais(nome: string | null): string {
  return (
    (nome ?? "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0])
      .join("")
      .toUpperCase() || "?"
  );
}

const CORES_AVATAR = ["#5b8cff", "#a77bff", "#27c48a", "#f5b80b", "#f26d6d", "#2fc6d9"];

function Avatar({ nome }: { nome: string | null }) {
  const n = (nome ?? "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const cor = CORES_AVATAR[n % CORES_AVATAR.length];
  return (
    <span
      className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
      style={{
        background: `linear-gradient(135deg, color-mix(in oklab, ${cor} 80%, white), ${cor})`,
      }}
    >
      {iniciais(nome)}
    </span>
  );
}

function MenuAcoes({ conta }: { conta: string }) {
  const classeTema = useClasseTema();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Ações de ${conta}`}
          className="grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground lg:size-8"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={classeTema}>
        <DropdownMenuItem asChild>
          <Link to="/plataforma/licencas" className="min-h-11 lg:min-h-8">
            <ExternalLink className="mr-2 size-3.5" /> Abrir em Licenças
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const dataCurta = (iso: string) =>
  new Date(iso)
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    .replace(".", "");

export function LicencasRecentes({
  itens,
  permitido,
  carregando,
}: {
  itens: LicencaRecente[] | null;
  permitido: boolean;
  carregando?: boolean;
}) {
  if (carregando)
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Esqueleto key={i} className="h-14" />
        ))}
      </div>
    );
  if (!permitido)
    return (
      <EstadoVazio
        titulo="Lista nominal restrita"
        texto="Nomes e e-mails das contas só aparecem para quem pode ver as licenças. Os totais continuam valendo."
        className="py-6"
      />
    );
  if (!itens?.length) return <EstadoVazio titulo="Nenhuma licença ainda" className="py-6" />;
  return (
    <>
      {/* Celular e tablet: cartões */}
      <ul className="space-y-2 lg:hidden">
        {itens.map((l) => (
          <li
            key={l.tenant_id}
            className="flex items-start gap-3 rounded-lg border border-border p-3"
          >
            <Avatar nome={l.responsavel ?? l.conta} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {l.responsavel ?? l.conta}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {l.email ?? "sem e-mail"}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {l.conta} · {TIPO_CONTA[l.tipo] ?? l.tipo}
                {l.plano ? ` · ${l.plano}` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Etiqueta chave={l.status} />
                {l.inadimplente && <Etiqueta chave="inadimplente" />}
                <span className="text-[11px] text-muted-foreground">{dataCurta(l.criado_em)}</span>
              </div>
            </div>
            <MenuAcoes conta={l.conta} />
          </li>
        ))}
      </ul>
      {/* Desktop: tabela */}
      <div className="hidden lg:block">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="w-[30%] py-2 pr-3 font-semibold">Responsável</th>
              <th className="w-[22%] py-2 pr-3 font-semibold">Conta</th>
              <th className="w-[14%] py-2 pr-3 font-semibold">Plano</th>
              <th className="w-[18%] py-2 pr-3 font-semibold">Situação</th>
              <th className="w-[11%] py-2 pr-3 font-semibold">Criada em</th>
              <th className="w-[5%] py-2 text-right font-semibold">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {itens.map((l) => (
              <tr key={l.tenant_id} className="border-b border-border last:border-0">
                <td className="py-2.5 pr-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar nome={l.responsavel ?? l.conta} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {l.responsavel ?? l.conta}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {l.email ?? "sem e-mail"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-2.5 pr-3">
                  <p className="truncate text-foreground">{l.conta}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {TIPO_CONTA[l.tipo] ?? l.tipo}
                    {l.uf ? ` · ${l.uf}` : ""}
                  </p>
                </td>
                <td className="truncate py-2.5 pr-3 text-muted-foreground">{l.plano ?? "—"}</td>
                <td className="py-2.5 pr-3">
                  <div className="flex flex-wrap gap-1">
                    <Etiqueta chave={l.status} />
                    {l.inadimplente && <Etiqueta chave="inadimplente" />}
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-xs tabular-nums text-muted-foreground">
                  {dataCurta(l.criado_em)}
                </td>
                <td className="py-2.5 text-right">
                  <MenuAcoes conta={l.conta} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
