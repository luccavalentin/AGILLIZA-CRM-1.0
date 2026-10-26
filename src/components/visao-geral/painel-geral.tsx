import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgeCheck,
  Building2,
  Calculator,
  CalendarRange,
  FileSignature,
  Gauge,
  Info,
  Landmark,
  Newspaper,
  RefreshCw,
  RotateCcw,
  Send,
  Stamp,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { PageHeader } from "@/components/shared/page-header";
import { Icone3D, type TomIcone3D } from "@/components/ui/icone-3d";
import { Indicador3D } from "@/components/ui/indicador-3d";
import { Estado3D } from "@/components/ui/estado-3d";
import { SeletorBusca } from "./seletor-busca";
import { NewsEquipeWidget } from "@/components/news/news-equipe";
import {
  BLOCO_VAZIO,
  FILTROS_PADRAO,
  PERIODOS_PRODUCAO,
  juntarBlocos,
  resolverIntervaloProducao,
  filtrosParaUrl,
  lerFiltros,
  variacao,
  type FiltrosProducao,
  type LinhaRanking,
  type ResultadoProducao,
  type Totais,
} from "@/lib/relatorios/producao-ecossistema";
import {
  getOpcoesAgilliza,
  getOpcoesPlataforma,
  getProducaoAgilliza,
  getProducaoPlataforma,
} from "@/lib/relatorios/producao-ecossistema.functions";
import "./painel-geral.css";

const CHAVE_MEMORIA = "agilliza:painel-geral:filtros";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
/** Valor grande legível sem esconder a ordem de grandeza (R$ 48,92 mi). O exato fica no título. */
const brlCurto = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1_000_000)
    return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  if (a >= 10_000)
    return `R$ ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return brl(v);
};
const int = (v: number) => v.toLocaleString("pt-BR");
const dataCurta = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const dataLonga = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;

interface DefMetrica {
  chave: keyof Totais;
  rotulo: string;
  natureza: string;
  icone: LucideIcon;
  tom: TomIcone3D;
  formato: (v: number) => string;
  /** Subir é bom? */
  bom: boolean;
}

const METRICAS: DefMetrica[] = [
  {
    chave: "simulacoes",
    rotulo: "Simulações",
    natureza: "criadas no período",
    icone: Calculator,
    tom: "marca",
    formato: int,
    bom: true,
  },
  {
    chave: "propostas",
    rotulo: "Propostas enviadas",
    natureza: "saíram do rascunho",
    icone: Send,
    tom: "info",
    formato: int,
    bom: true,
  },
  {
    chave: "aprovadas",
    rotulo: "Crédito aprovado",
    natureza: "ainda sem contrato",
    icone: BadgeCheck,
    tom: "sucesso",
    formato: int,
    bom: true,
  },
  {
    chave: "contratos",
    rotulo: "Contratos emitidos",
    natureza: "pela data de emissão",
    icone: FileSignature,
    tom: "violeta",
    formato: int,
    bom: true,
  },
  {
    chave: "registrados",
    rotulo: "Contratos registrados",
    natureza: "dos emitidos no período",
    icone: Stamp,
    tom: "ciano",
    formato: int,
    bom: true,
  },
  {
    chave: "valor",
    rotulo: "Valor financiado",
    natureza: "R$ dos contratos emitidos",
    icone: Wallet,
    tom: "sucesso",
    formato: brlCurto,
    bom: true,
  },
];

/** Para onde leva cada número (a lista que ele conta). */
function linkDaMetrica(
  chave: keyof Totais,
  f: FiltrosProducao,
  r: ResultadoProducao | undefined,
): { to: string; search?: Record<string, unknown> } {
  if (f.base !== "sua_base") {
    return chave === "simulacoes"
      ? { to: "/operacional/simulacoes" }
      : { to: "/operacional/propostas", search: { aba: "assinantes" } };
  }
  const comum: Record<string, unknown> = {
    periodo: "custom",
    de: r?.intervalo.de,
    ate: r?.intervalo.ate,
    escopo: f.escopo,
    ...(f.usuario?.startsWith("a:") ? { responsavel: f.usuario.slice(2) } : {}),
  };
  switch (chave) {
    case "simulacoes":
      return { to: "/relatorios/simulacoes", search: comum };
    case "propostas":
      return { to: "/relatorios/propostas", search: comum };
    case "aprovadas":
      return { to: "/relatorios/propostas", search: { ...comum, status: "credito_aprovado" } };
    case "registrados":
      return { to: "/relatorios/propostas", search: { ...comum, status: "registrado" } };
    default:
      return { to: "/relatorios/propostas", search: { ...comum, status: "contrato_emitido" } };
  }
}

function lerMemoria(): FiltrosProducao | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE_MEMORIA);
    return bruto ? lerFiltros(JSON.parse(bruto)) : null;
  } catch {
    return null;
  }
}
function guardarMemoria(f: FiltrosProducao) {
  try {
    window.localStorage.setItem(CHAVE_MEMORIA, JSON.stringify(f));
  } catch {
    /* navegador sem armazenamento: só não lembra */
  }
}

/** Trilho segmentado (Minha/Geral, Sua base/Assinantes). */
function Segmentado<T extends string>({
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string;
  valor: T;
  opcoes: { id: T; texto: string; icone: LucideIcon; desabilitado?: boolean; dica?: string }[];
  aoMudar: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="pg-segmentado">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={valor === o.id}
          disabled={o.desabilitado}
          title={o.dica}
          data-depth="off"
          onClick={() => aoMudar(o.id)}
        >
          <o.icone aria-hidden className="size-3.5" />
          {o.texto}
        </button>
      ))}
    </div>
  );
}

function Cartao({
  titulo,
  subtitulo,
  icone,
  tom,
  acao,
  children,
  className,
}: {
  titulo: string;
  subtitulo?: string;
  icone: LucideIcon;
  tom?: TomIcone3D;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("pg-cartao", className)}>
      <header className="pg-cartao-cab">
        <Icone3D icone={icone} tom={tom ?? "marca"} tamanho="sm" />
        <div className="min-w-0 flex-1">
          <h2>{titulo}</h2>
          {subtitulo && <p>{subtitulo}</p>}
        </div>
        {acao}
      </header>
      {children}
    </section>
  );
}

function Ranking({
  linhas,
  vazio,
  tipo,
}: {
  linhas: LinhaRanking[];
  vazio: string;
  tipo: "usuario" | "conta";
}) {
  if (!linhas.length) return <Estado3D compacto icone={Users} titulo={vazio} />;
  // A barra mede UMA natureza para todos (a mais avançada que tiver movimento), senão
  // quem tem 5 propostas e nenhum contrato pareceria à frente de quem tem 4 contratos.
  const medida: "contratos" | "propostas" | "simulacoes" = linhas.some((l) => l.contratos)
    ? "contratos"
    : linhas.some((l) => l.propostas)
      ? "propostas"
      : "simulacoes";
  const max = Math.max(1, ...linhas.map((l) => l[medida]));
  return (
    <ol className="pg-ranking">
      {linhas.map((l, i) => {
        const base = l[medida];
        const iniciais = l.nome
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p[0]?.toUpperCase())
          .join("");
        return (
          <li key={l.id}>
            <span className="pg-ranking-pos" aria-label={`${i + 1}º`}>
              {i + 1}
            </span>
            <span
              className={cn("pg-ranking-avatar", tipo === "conta" && "pg-ranking-avatar-conta")}
            >
              {iniciais || "?"}
            </span>
            <span className="pg-ranking-nome">
              <b title={l.nome}>{l.nome}</b>
              {l.detalhe && <small title={l.detalhe}>{l.detalhe}</small>}
              <span className="pg-ranking-barra" aria-hidden>
                <span style={{ width: `${base ? Math.max(4, (base / max) * 100) : 0}%` }} />
              </span>
            </span>
            <span className="pg-ranking-num pg-ranking-sec">
              <b>{int(l.contratos)}</b>
              <small>contratos</small>
            </span>
            <span className="pg-ranking-num pg-ranking-sec">
              <b>{int(l.propostas)}</b>
              <small>propostas</small>
            </span>
            <span className="pg-ranking-num pg-ranking-valor" title={brl(l.valor)}>
              <b>{brlCurto(l.valor)}</b>
              <small className="pg-so-computador">financiado</small>
              <small className="pg-so-celular">
                {int(l.contratos)} {l.contratos === 1 ? "contrato" : "contratos"}
              </small>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Funil({ t }: { t: Totais }) {
  const etapas = [
    { rotulo: "Simulações", valor: t.simulacoes },
    { rotulo: "Propostas enviadas", valor: t.propostas },
    { rotulo: "Contratos emitidos", valor: t.contratos },
    { rotulo: "Registrados", valor: t.registrados },
  ];
  const topo = Math.max(1, etapas[0].valor, etapas[1].valor);
  return (
    <ol className="pg-funil">
      {etapas.map((e, i) => {
        const anterior = i > 0 ? etapas[i - 1].valor : null;
        const taxa = anterior ? (e.valor / anterior) * 100 : null;
        return (
          <li key={e.rotulo}>
            <div className="pg-funil-linha">
              <span>{e.rotulo}</span>
              <b>{int(e.valor)}</b>
            </div>
            <div className="pg-funil-trilho" aria-hidden>
              <span style={{ width: `${Math.max(e.valor ? 3 : 0, (e.valor / topo) * 100)}%` }} />
            </div>
            {taxa !== null && (
              <small>
                {anterior
                  ? `${taxa.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da etapa anterior`
                  : "sem base na etapa anterior"}
              </small>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function PainelGeral({ search }: { search: Record<string, unknown> }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const producaoAgFn = useServerFn(getProducaoAgilliza);
  const producaoTechFn = useServerFn(getProducaoPlataforma);
  const opcoesAgFn = useServerFn(getOpcoesAgilliza);
  const opcoesTechFn = useServerFn(getOpcoesPlataforma);
  const f = useMemo(() => lerFiltros(search), [search]);
  const urlVazia = useMemo(
    () =>
      Object.values(filtrosParaUrl(lerFiltros(search))).every((v) => v === undefined) &&
      !Object.keys(search ?? {}).length,
    [search],
  );

  const aplicar = (novo: Partial<FiltrosProducao>, substituir = false) => {
    const prox = lerFiltros({ ...f, ...novo });
    guardarMemoria(prox);
    void navigate({
      to: "/visao-geral/painel",
      search: filtrosParaUrl(prox) as never,
      replace: substituir,
    });
  };

  // Lembra a última escolha: link sem filtro abre como a pessoa deixou da última vez.
  useEffect(() => {
    if (!urlVazia) return;
    const m = lerMemoria();
    if (m && JSON.stringify(m) !== JSON.stringify(FILTROS_PADRAO)) aplicar(m, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Duas fontes, duas chamadas: o Agilliza (qualquer pessoa vê a sua produção) e o Agilliza
  // Tech pela ponte (guardado por saas.fila/saas.licencas e conferido de novo no banco).
  const [buscaAssinante, setBuscaAssinante] = useState("");
  const opA = useQuery({
    queryKey: ["painel-geral-opcoes-agilliza"],
    queryFn: () => opcoesAgFn(),
    staleTime: 5 * 60_000,
  });
  const opP = useQuery({
    queryKey: ["painel-geral-opcoes-tech", f.base, f.licenca ?? "", buscaAssinante],
    queryFn: () =>
      opcoesTechFn({ data: { base: f.base, licenca: f.licenca, busca: buscaAssinante } }),
    staleTime: 5 * 60_000,
    retry: false,
    placeholderData: (anterior) => anterior,
  });
  const podeGeral = opA.data?.podeGeral ?? false;
  const techNegado = !!opP.error && /permiss/i.test((opP.error as Error).message);
  const opcoes = {
    isFetching: opP.isFetching,
    data: {
      assinantes: opP.data?.assinantes ?? [],
      usuarios: [
        ...(f.base === "sua_base" ? (opA.data?.usuarios ?? []) : []),
        ...(opP.data?.usuarios ?? []),
      ],
      plataforma: techNegado ? ("sem_permissao" as const) : ("ok" as const),
    },
  };

  const chave = ["painel-geral", JSON.stringify(f)];
  const precisaAgilliza = f.base === "sua_base" && !f.usuario?.startsWith("t:");
  const precisaTech = !f.usuario?.startsWith("a:") && !(f.base === "sua_base" && techNegado);
  const qa = useQuery({
    queryKey: [...chave, "agilliza"],
    queryFn: () => producaoAgFn({ data: f as never }),
    enabled: precisaAgilliza,
    staleTime: 30_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
    placeholderData: (anterior) => anterior,
  });
  const qt = useQuery({
    queryKey: [...chave, "tech"],
    queryFn: () => producaoTechFn({ data: f as never }),
    enabled: precisaTech,
    retry: false,
    staleTime: 30_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
    placeholderData: (anterior) => anterior,
  });
  const q = {
    isFetching: qa.isFetching || qt.isFetching,
    // Na Sua base, a falha do Tech vira aviso; fora dela, é o erro da tela.
    error: (precisaAgilliza ? qa.error : null) ?? (f.base !== "sua_base" ? qt.error : null),
    refetch: () => {
      if (precisaAgilliza) void qa.refetch();
      if (precisaTech) void qt.refetch();
    },
  };
  const r = useMemo<ResultadoProducao | undefined>(() => {
    const prontoA = !precisaAgilliza || !!qa.data;
    const prontoT = !precisaTech || !!qt.data || (f.base === "sua_base" && !!qt.error);
    if (!prontoA || !prontoT) return undefined;
    const intervalo = qa.data?.intervalo ?? resolverIntervaloProducao(f);
    let bloco = precisaAgilliza && qa.data ? qa.data.bloco : BLOCO_VAZIO;
    if (precisaTech && qt.data)
      bloco = f.base === "sua_base" ? juntarBlocos(bloco, qt.data.bloco) : qt.data.bloco;
    const avisos = [qa.data?.aviso];
    if (f.base === "sua_base" && (qt.error || techNegado)) {
      avisos.push(
        techNegado || /permiss/i.test((qt.error as Error)?.message ?? "")
          ? "As contas vinculadas no Agilliza Tech ficaram de fora: sem permissão na plataforma."
          : `As contas vinculadas no Agilliza Tech ficaram de fora agora: ${(qt.error as Error).message}`,
      );
    }
    return {
      filtros: qa.data?.filtros ?? f,
      intervalo,
      atual: bloco.atual,
      anterior: bloco.anterior,
      serie: bloco.serie,
      rankingUsuarios: bloco.rankingUsuarios,
      rankingAssinantes: bloco.rankingContas,
      fontes: {
        agilliza: precisaAgilliza ? "ok" : "nao_se_aplica",
        plataforma: qt.data
          ? "ok"
          : techNegado
            ? "sem_permissao"
            : precisaTech
              ? "indisponivel"
              : "nao_se_aplica",
        agregacao: qt.data?.agregacao ?? null,
        aviso: avisos.filter(Boolean).join(" ") || null,
      },
      assinanteNome: qt.data?.assinanteNome ?? null,
      atualizadoEm: new Date(
        Math.max(qa.dataUpdatedAt || 0, qt.dataUpdatedAt || 0) || Date.now(),
      ).toISOString(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qa.data, qt.data, qt.error, techNegado, precisaAgilliza, precisaTech, f]);
  const carregando = !r && !q.error;

  const assinanteNome =
    r?.assinanteNome ?? opcoes.data?.assinantes.find((a) => a.id === f.licenca)?.nome ?? null;
  const descricaoBase =
    f.base === "sua_base"
      ? "Sua base: o Agilliza, a conta dele no Agilliza Tech e os corretores e parceiros vinculados"
      : f.base === "assinantes"
        ? f.escopo === "minha"
          ? "Assinantes da sua carteira"
          : "Todos os assinantes do Agilliza Tech"
        : `Assinante: ${assinanteNome ?? "conta escolhida"}`;
  const filtrado = JSON.stringify(f) !== JSON.stringify(FILTROS_PADRAO);
  const tudoZero =
    !!r &&
    Object.values(r.atual).every((v) => v === 0) &&
    Object.values(r.anterior).every((v) => v === 0);

  const usuariosOpcoes = (opcoes.data?.usuarios ?? []).map((u) => ({
    id: u.id,
    nome: u.nome,
    detalhe: u.conta,
  }));
  const usuarioDesabilitado = f.base === "assinantes" || (f.base === "sua_base" && !podeGeral);

  return (
    <div className="pg-painel mx-auto w-full max-w-[1480px] space-y-5 p-3 sm:p-4 md:space-y-6 md:p-6">
      <PageHeader
        icone={<Gauge />}
        secao="Visão geral"
        titulo="Painel geral"
        descricao="Produção comercial do Agilliza e de todo o ecossistema, com origem de cada número."
        acoes={
          <>
            {r && (
              <span
                className="pg-atualizado"
                title={new Date(r.atualizadoEm).toLocaleString("pt-BR")}
              >
                <span className="pg-pulso" aria-hidden />
                Atualizado às{" "}
                {new Date(r.atualizadoEm).toLocaleTimeString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              aria-label="Atualizar"
              onClick={() => qc.invalidateQueries({ queryKey: chave })}
              disabled={q.isFetching}
            >
              <RefreshCw className={cn("size-4", q.isFetching && "animate-spin")} />
            </Button>
          </>
        }
      />

      {/* Filtros: tudo na URL (link compartilhável) e lembrado neste navegador. */}
      <section className="pg-filtros" aria-label="Filtros da produção">
        <div className="pg-filtro">
          <span className="pg-filtro-rotulo">Visão</span>
          <Segmentado
            rotulo="Visão"
            valor={f.escopo}
            aoMudar={(escopo) => aplicar({ escopo })}
            opcoes={[
              { id: "minha", texto: "Minha", icone: UserRound },
              {
                id: "geral",
                texto: "Geral",
                icone: Users,
                desabilitado: !podeGeral && f.escopo !== "geral",
                dica: podeGeral ? undefined : "A visão Geral depende de permissão de relatórios.",
              },
            ]}
          />
        </div>
        <div className="pg-filtro">
          <span className="pg-filtro-rotulo">Base</span>
          <Segmentado
            rotulo="Base"
            valor={f.base === "sua_base" ? "sua_base" : "assinantes"}
            aoMudar={(b) => aplicar({ base: b, licenca: undefined, usuario: undefined })}
            opcoes={[
              { id: "sua_base", texto: "Sua base", icone: Building2 },
              {
                id: "assinantes",
                texto: "Assinantes",
                icone: Landmark,
                desabilitado: opcoes.data?.plataforma === "sem_permissao",
                dica:
                  opcoes.data?.plataforma === "sem_permissao"
                    ? "Sem permissão na plataforma para ver os assinantes."
                    : undefined,
              },
            ]}
          />
        </div>
        {f.base !== "sua_base" && (
          <div className="pg-filtro pg-filtro-largo">
            <span className="pg-filtro-rotulo">Assinante</span>
            <SeletorBusca
              rotulo="Assinante"
              todos={f.escopo === "minha" ? "Todos da minha carteira" : "Todos os assinantes"}
              vazio="Nenhum assinante com esse nome."
              valor={f.base === "assinante" ? f.licenca : undefined}
              rotuloValor={assinanteNome}
              opcoes={(opcoes.data?.assinantes ?? []).map((a) => ({
                id: a.id,
                nome: a.nome,
                detalhe:
                  a.tipo === "imobiliaria"
                    ? "Imobiliária"
                    : a.tipo === "parceiro"
                      ? "Parceiro"
                      : "Corretor",
              }))}
              onBusca={setBuscaAssinante}
              carregando={opcoes.isFetching}
              aoEscolher={(id) =>
                aplicar(
                  id
                    ? { base: "assinante", licenca: id, usuario: undefined }
                    : { base: "assinantes", licenca: undefined, usuario: undefined },
                )
              }
              icone={<Landmark className="size-3.5 shrink-0 text-muted-foreground" />}
              className="w-full sm:w-64"
            />
          </div>
        )}
        <div className="pg-filtro pg-filtro-largo">
          <span className="pg-filtro-rotulo">Usuário</span>
          <SeletorBusca
            rotulo="Usuário"
            todos="Todos os usuários"
            vazio="Nenhum usuário nesta base."
            valor={f.usuario}
            opcoes={usuariosOpcoes}
            aoEscolher={(usuario) => aplicar({ usuario })}
            desabilitado={usuarioDesabilitado}
            dica={
              f.base === "assinantes"
                ? "Escolha um assinante para filtrar pelos usuários dele."
                : !podeGeral
                  ? "Filtrar por outro usuário depende de permissão de relatórios."
                  : undefined
            }
            icone={<UserRound className="size-3.5 shrink-0 text-muted-foreground" />}
            className="w-full sm:w-56"
          />
        </div>
        <div className="pg-filtro">
          <span className="pg-filtro-rotulo">Período</span>
          <Select
            value={f.periodo}
            onValueChange={(v) =>
              aplicar({
                periodo: v as FiltrosProducao["periodo"],
                ...(v === "custom" ? { de: r?.intervalo.de, ate: r?.intervalo.ate } : {}),
              })
            }
          >
            <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Período">
              <CalendarRange className="size-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS_PRODUCAO.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {f.periodo === "custom" && (
          <div className="pg-filtro pg-filtro-largo">
            <span className="pg-filtro-rotulo">De – até</span>
            <DateRangePicker
              de={f.de ?? ""}
              ate={f.ate ?? ""}
              onChange={(de, ate) => de && ate && aplicar({ periodo: "custom", de, ate })}
              className="h-9 w-full sm:w-64"
            />
          </div>
        )}
        {filtrado && (
          <Button
            variant="ghost"
            size="sm"
            className="pg-limpar h-9 self-end text-muted-foreground"
            onClick={() =>
              aplicar({
                ...FILTROS_PADRAO,
                licenca: undefined,
                usuario: undefined,
                de: undefined,
                ate: undefined,
              })
            }
          >
            <RotateCcw className="size-3.5" /> Limpar
          </Button>
        )}
      </section>

      {r && (
        <p className="pg-resumo">
          <Info aria-hidden className="size-3.5 shrink-0" />
          <span>
            {f.escopo === "minha" ? "Minha produção" : "Produção geral"} · {descricaoBase}
            {f.usuario && usuariosOpcoes.find((u) => u.id === f.usuario)
              ? ` · ${usuariosOpcoes.find((u) => u.id === f.usuario)!.nome}`
              : ""}{" "}
            · de {dataLonga(r.intervalo.de)} a {dataLonga(r.intervalo.ate)} ({r.intervalo.dias}{" "}
            {r.intervalo.dias === 1 ? "dia" : "dias"}), comparado a{" "}
            {dataCurta(r.intervalo.anteriorDe)}–{dataCurta(r.intervalo.anteriorAte)}.
          </span>
        </p>
      )}
      {r?.fontes.aviso && (
        <Estado3D compacto tom="alerta" icone={Info} titulo="Atenção" descricao={r.fontes.aviso} />
      )}

      {q.error && !r ? (
        <Estado3D
          tipo="erro"
          titulo="Não foi possível carregar a produção"
          descricao={(q.error as Error).message}
          acao={
            <Button variant="outline" size="sm" onClick={() => q.refetch()}>
              Tentar de novo
            </Button>
          }
        />
      ) : (
        <>
          <div className="pg-indicadores">
            {METRICAS.map((m, i) => {
              const atual = r?.atual[m.chave] ?? 0;
              const ant = r?.anterior[m.chave] ?? 0;
              const v = r ? variacao(atual, ant) : undefined;
              return (
                <Indicador3D
                  key={m.chave}
                  destaque={i === 3}
                  icone={m.icone}
                  tom={m.tom}
                  rotulo={m.rotulo}
                  natureza={m.natureza}
                  carregando={carregando}
                  valor={
                    <span title={m.chave === "valor" ? brl(atual) : undefined}>
                      {m.formato(atual)}
                    </span>
                  }
                  variacao={v ? { pct: v.pct, sobe: v.sobe, bom: m.bom } : undefined}
                  detalhe={r ? `antes: ${m.formato(ant)}` : undefined}
                  link={linkDaMetrica(m.chave, f, r)}
                />
              );
            })}
          </div>

          {tudoZero ? (
            <Estado3D
              icone={Calculator}
              titulo="Nenhuma produção neste filtro"
              descricao="Não houve simulação, proposta nem contrato no período e na base escolhidos. Amplie o período ou mude a base."
              acao={
                <Button variant="outline" size="sm" onClick={() => aplicar({ periodo: "90d" })}>
                  Ver os últimos 90 dias
                </Button>
              }
            />
          ) : (
            <>
              <div className="pg-grade-2">
                <Cartao
                  titulo="Evolução no período"
                  subtitulo={`Simulações, propostas e contratos por ${r && r.serie.length && r.serie[0].chave.length === 7 ? "mês" : "dia"}`}
                  icone={Gauge}
                  className="pg-col-8"
                >
                  <div
                    className="h-[260px] w-full"
                    role="img"
                    aria-label="Gráfico da evolução da produção no período"
                  >
                    {r ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={r.serie}
                          margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                        >
                          <defs>
                            {[
                              ["sim", "#000f9f"],
                              ["prop", "#2457d6"],
                              ["cont", "#10a37f"],
                            ].map(([id, cor]) => (
                              <linearGradient key={id} id={`pg-${id}`} x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor={cor} stopOpacity={0.22} />
                                <stop offset="100%" stopColor={cor} stopOpacity={0} />
                              </linearGradient>
                            ))}
                          </defs>
                          <CartesianGrid stroke="#eceef2" vertical={false} />
                          <XAxis
                            dataKey="rotulo"
                            tick={{ fontSize: 11, fill: "#6b7280" }}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={18}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 11, fill: "#6b7280" }}
                            tickLine={false}
                            axisLine={false}
                            width={44}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: 10,
                              border: "1px solid #e4e7ec",
                              fontSize: 12,
                              boxShadow: "0 8px 24px -12px rgb(15 23 42 / .25)",
                            }}
                            labelStyle={{ fontWeight: 600 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="simulacoes"
                            name="Simulações"
                            stroke="#000f9f"
                            strokeWidth={1.75}
                            fill="url(#pg-sim)"
                          />
                          <Area
                            type="monotone"
                            dataKey="propostas"
                            name="Propostas"
                            stroke="#2457d6"
                            strokeWidth={1.75}
                            fill="url(#pg-prop)"
                          />
                          <Area
                            type="monotone"
                            dataKey="contratos"
                            name="Contratos"
                            stroke="#10a37f"
                            strokeWidth={1.75}
                            fill="url(#pg-cont)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full animate-pulse rounded-lg bg-muted" />
                    )}
                  </div>
                  <ul className="pg-legenda" aria-hidden>
                    <li style={{ ["--c" as string]: "#000f9f" }}>Simulações</li>
                    <li style={{ ["--c" as string]: "#2457d6" }}>Propostas</li>
                    <li style={{ ["--c" as string]: "#10a37f" }}>Contratos</li>
                  </ul>
                </Cartao>
                <Cartao
                  titulo="Conversão"
                  subtitulo="Da simulação ao registro"
                  icone={BadgeCheck}
                  tom="sucesso"
                  className="pg-col-4"
                >
                  {r ? (
                    <Funil t={r.atual} />
                  ) : (
                    <div className="h-48 animate-pulse rounded-lg bg-muted" />
                  )}
                </Cartao>
              </div>

              <div className="pg-grade-2">
                <Cartao
                  titulo="Ranking por usuário"
                  subtitulo="Contratos, propostas e valor financiado no período"
                  icone={Users}
                  tom="info"
                  className="pg-col-6"
                >
                  {r ? (
                    <Ranking
                      linhas={r.rankingUsuarios}
                      tipo="usuario"
                      vazio="Sem produção por usuário no período."
                    />
                  ) : (
                    <div className="h-48 animate-pulse rounded-lg bg-muted" />
                  )}
                </Cartao>
                <Cartao
                  titulo={
                    f.base === "sua_base" ? "Ranking por conta da base" : "Ranking por assinante"
                  }
                  subtitulo={
                    f.base === "sua_base"
                      ? "O Agilliza e cada conta vinculada no Agilliza Tech"
                      : "Licenças do Agilliza Tech"
                  }
                  icone={Landmark}
                  tom="violeta"
                  className="pg-col-6"
                  acao={
                    f.base !== "sua_base" ? (
                      <Link to="/plataforma/licencas" className="pg-link">
                        Licenças
                      </Link>
                    ) : undefined
                  }
                >
                  {r ? (
                    <Ranking
                      linhas={r.rankingAssinantes}
                      tipo="conta"
                      vazio="Sem produção por conta no período."
                    />
                  ) : (
                    <div className="h-48 animate-pulse rounded-lg bg-muted" />
                  )}
                </Cartao>
              </div>
            </>
          )}

          {/* Agilliza News da equipe (C60, a7): o que a curadoria publicou, no mesmo cartão 3D. */}
          <div className="pg-grade-2">
            <Cartao
              titulo="Agilliza News"
              subtitulo="Mercado, crédito e comunicados da Agilliza para a equipe"
              icone={Newspaper}
              tom="info"
              className="pg-col-12"
              acao={
                <Link to="/news" className="pg-link">
                  Ver tudo
                </Link>
              }
            >
              <NewsEquipeWidget embutido />
            </Cartao>
          </div>

          {r && (
            <footer className="pg-fonte">
              <b>De onde vêm os números.</b>{" "}
              {f.base === "sua_base" &&
                r.fontes.agilliza === "ok" &&
                "Agilliza: simulações e propostas pela data de criação; contrato emitido pela data na ficha do cliente, só com proposta em contrato; valor financiado = aprovado (ou pedido) da proposta do contrato. "}
              {r.fontes.plataforma === "ok" &&
                (r.fontes.agregacao === "nativa"
                  ? "Agilliza Tech: somado no banco da plataforma, contratos pela data de emissão. "
                  : "Agilliza Tech: somado das listas da plataforma; contratos dos assinantes pela data de criação da proposta até a agregação do banco ser instalada. ")}
              {f.base === "sua_base" &&
                "Proposta de conta vinculada já trazida ao Agilliza conta uma vez só. "}
              A variação compara com o período anterior de mesma duração; sem base anterior aparece
              “novo”.
            </footer>
          )}
        </>
      )}
    </div>
  );
}
