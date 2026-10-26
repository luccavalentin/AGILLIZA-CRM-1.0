/**
 * Produção comercial do ecossistema (Painel geral, itens C03–C06 do pedido de 26/10/2026).
 *
 * O Agilliza Correspondente responde pela operação dele e pela de todo o ecossistema.
 * Três filtros combináveis, todos na URL:
 *   · escopo  — `minha` (o que é do usuário) / `geral`;
 *   · base    — `sua_base` (o próprio Agilliza + a conta dele no Agilliza Tech + corretores
 *               e parceiros vinculados, `nucleo.tenants.vinculo_agilliza`) /
 *               `assinantes` (todas as licenças pagas) / `assinante` (uma licença);
 *   · usuário — um usuário da base escolhida (`a:<uuid>` do Agilliza, `t:<uuid>` do Tech).
 *
 * Este arquivo é PURO (sem banco): tipos, leitura dos filtros, a soma de linhas em totais,
 * rankings e série, e a variação contra o período anterior. O servidor está em
 * `producao-ecossistema.functions.ts` (Agilliza) e `producao-ecossistema.server.ts` (ponte).
 */

export type EscopoProducao = "minha" | "geral";
export type BaseProducao = "sua_base" | "assinantes" | "assinante";
export type PeriodoProducao = "7d" | "30d" | "mes" | "mes_anterior" | "90d" | "ano" | "custom";

export const PERIODOS_PRODUCAO: { id: PeriodoProducao; rotulo: string }[] = [
  { id: "7d", rotulo: "Últimos 7 dias" },
  { id: "30d", rotulo: "Últimos 30 dias" },
  { id: "mes", rotulo: "Este mês" },
  { id: "mes_anterior", rotulo: "Mês anterior" },
  { id: "90d", rotulo: "Últimos 90 dias" },
  { id: "ano", rotulo: "Este ano" },
  { id: "custom", rotulo: "Personalizado" },
];

export interface FiltrosProducao {
  escopo: EscopoProducao;
  base: BaseProducao;
  /** Licença (tenant do Agilliza Tech) quando `base = assinante`. */
  licenca?: string;
  /** `a:<uuid>` (usuário do Agilliza) ou `t:<uuid>` (usuário do Agilliza Tech). */
  usuario?: string;
  periodo: PeriodoProducao;
  de?: string;
  ate?: string;
}

export const FILTROS_PADRAO: FiltrosProducao = {
  escopo: "minha",
  base: "sua_base",
  periodo: "30d",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Lê os filtros da URL (ou da memória local) aceitando só valores conhecidos. */
export function lerFiltros(s: Record<string, unknown> | null | undefined): FiltrosProducao {
  const o = s ?? {};
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);
  const escopo: EscopoProducao = o.escopo === "geral" ? "geral" : "minha";
  const baseBruta = str(o.base);
  let base: BaseProducao =
    baseBruta === "assinantes" || baseBruta === "assinante" ? baseBruta : "sua_base";
  const licenca = str(o.licenca);
  const licencaOk = licenca && UUID_RE.test(licenca) ? licenca.toLowerCase() : undefined;
  if (base === "assinante" && !licencaOk) base = "assinantes";
  const usuario = str(o.usuario);
  const usuarioOk =
    usuario && /^[at]:/.test(usuario) && UUID_RE.test(usuario.slice(2))
      ? usuario.toLowerCase()
      : undefined;
  const periodoBruto = str(o.periodo) as PeriodoProducao | undefined;
  let periodo: PeriodoProducao = PERIODOS_PRODUCAO.some((p) => p.id === periodoBruto)
    ? (periodoBruto as PeriodoProducao)
    : FILTROS_PADRAO.periodo;
  const de = str(o.de);
  const ate = str(o.ate);
  const customOk = !!de && !!ate && DATA_RE.test(de) && DATA_RE.test(ate) && de <= ate;
  if (periodo === "custom" && !customOk) periodo = FILTROS_PADRAO.periodo;
  return {
    escopo,
    base,
    ...(base === "assinante" ? { licenca: licencaOk } : {}),
    ...(usuarioOk && usuarioCabeNaBase(usuarioOk, base) ? { usuario: usuarioOk } : {}),
    periodo,
    ...(periodo === "custom" ? { de, ate } : {}),
  };
}

/**
 * Usuário do Agilliza (`a:`) só existe na Sua base; usuário do Tech (`t:`) existe na Sua base
 * (contas vinculadas) e num assinante. "Assinantes — todos" não filtra por usuário (são
 * milhares): escolha um assinante primeiro.
 */
export function usuarioCabeNaBase(usuario: string, base: BaseProducao): boolean {
  if (base === "assinantes") return false;
  if (base === "assinante") return usuario.startsWith("t:");
  return true;
}

/** Filtros → parâmetros de URL (sem os padrões, para o link ficar curto). */
export function filtrosParaUrl(f: FiltrosProducao): Record<string, string | undefined> {
  return {
    escopo: f.escopo === FILTROS_PADRAO.escopo ? undefined : f.escopo,
    base: f.base === FILTROS_PADRAO.base ? undefined : f.base,
    licenca: f.base === "assinante" ? f.licenca : undefined,
    usuario: f.usuario,
    periodo: f.periodo === FILTROS_PADRAO.periodo ? undefined : f.periodo,
    de: f.periodo === "custom" ? f.de : undefined,
    ate: f.periodo === "custom" ? f.ate : undefined,
  };
}

// ------------------------------------------------------------------ período --

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const diaUTC = (s: string) => new Date(`${s}T00:00:00Z`);

/** Hoje no fuso de Brasília (AAAA-MM-DD). */
export function hojeBR(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

export interface Intervalo {
  de: string;
  ate: string;
  /** Período anterior de MESMA duração, logo antes de `de`. */
  anteriorDe: string;
  anteriorAte: string;
  dias: number;
}

export function resolverIntervaloProducao(f: FiltrosProducao, agora = new Date()): Intervalo {
  const hoje = hojeBR(agora);
  const h = diaUTC(hoje);
  let de: string;
  let ate = hoje;
  switch (f.periodo) {
    case "7d":
      de = iso(new Date(h.getTime() - 6 * 86_400_000));
      break;
    case "90d":
      de = iso(new Date(h.getTime() - 89 * 86_400_000));
      break;
    case "mes":
      de = `${hoje.slice(0, 7)}-01`;
      break;
    case "mes_anterior": {
      const ini = new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() - 1, 1));
      const fim = new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), 0));
      de = iso(ini);
      ate = iso(fim);
      break;
    }
    case "ano":
      de = `${hoje.slice(0, 4)}-01-01`;
      break;
    case "custom":
      de = f.de ?? hoje;
      ate = f.ate ?? hoje;
      break;
    default:
      de = iso(new Date(h.getTime() - 29 * 86_400_000));
  }
  const dias = Math.round((diaUTC(ate).getTime() - diaUTC(de).getTime()) / 86_400_000) + 1;
  const anteriorAte = iso(new Date(diaUTC(de).getTime() - 86_400_000));
  const anteriorDe = iso(new Date(diaUTC(anteriorAte).getTime() - (dias - 1) * 86_400_000));
  return { de, ate, anteriorDe, anteriorAte, dias };
}

// ------------------------------------------------------------------ totais --

/** A natureza de cada número do painel (sempre na mesma ordem). */
export interface Totais {
  simulacoes: number;
  /** Propostas que saíram do rascunho (Agilliza) / enviadas ao correspondente (Tech). */
  propostas: number;
  /** Crédito aprovado que ainda não virou contrato. */
  aprovadas: number;
  /** Contratos emitidos no período (data de emissão). */
  contratos: number;
  /** Dos contratos emitidos no período, os que já estão registrados. */
  registrados: number;
  /** Valor financiado dos contratos emitidos no período (R$). */
  valor: number;
}

export const ZERO: Totais = {
  simulacoes: 0,
  propostas: 0,
  aprovadas: 0,
  contratos: 0,
  registrados: 0,
  valor: 0,
};

export function somar(a: Totais, b: Totais): Totais {
  return {
    simulacoes: a.simulacoes + b.simulacoes,
    propostas: a.propostas + b.propostas,
    aprovadas: a.aprovadas + b.aprovadas,
    contratos: a.contratos + b.contratos,
    registrados: a.registrados + b.registrados,
    valor: a.valor + b.valor,
  };
}

/** Linha comum de produção: cada fato conta num `tipo`, num dia, de um usuário e de uma conta. */
export interface FatoProducao {
  tipo: "simulacao" | "proposta" | "aprovada" | "contrato";
  /** AAAA-MM-DD no fuso de Brasília. */
  dia: string;
  /** Contrato já registrado (só para `contrato`). */
  registrado?: boolean;
  /** Valor financiado (só para `contrato`). */
  valor?: number;
  usuarioId: string | null;
  usuarioNome?: string | null;
  contaId: string | null;
  contaNome?: string | null;
}

export interface LinhaRanking extends Totais {
  id: string;
  nome: string;
  /** Conta do usuário (no ranking de usuários do Tech) ou tipo da conta (no de assinantes). */
  detalhe?: string | null;
}

export interface PontoSerie {
  chave: string;
  rotulo: string;
  simulacoes: number;
  propostas: number;
  contratos: number;
}

function acrescentar(t: Totais, f: FatoProducao) {
  if (f.tipo === "simulacao") t.simulacoes += 1;
  else if (f.tipo === "proposta") t.propostas += 1;
  else if (f.tipo === "aprovada") t.aprovadas += 1;
  else {
    t.contratos += 1;
    if (f.registrado) t.registrados += 1;
    t.valor += Number(f.valor) || 0;
  }
}

export function totalizar(fatos: FatoProducao[]): Totais {
  const t = { ...ZERO };
  for (const f of fatos) acrescentar(t, f);
  return t;
}

/** Ordena por contratos, depois propostas, depois simulações; corta em `limite`. */
export function ranking(
  fatos: FatoProducao[],
  chave: "usuario" | "conta",
  limite = 10,
): LinhaRanking[] {
  const m = new Map<string, LinhaRanking>();
  for (const f of fatos) {
    const id = chave === "usuario" ? f.usuarioId : f.contaId;
    if (!id) continue;
    let l = m.get(id);
    if (!l) {
      l = {
        id,
        nome: (chave === "usuario" ? f.usuarioNome : f.contaNome) || "Sem nome",
        detalhe: chave === "usuario" ? (f.contaNome ?? null) : null,
        ...ZERO,
      };
      m.set(id, l);
    }
    acrescentar(l, f);
  }
  return [...m.values()]
    .sort(
      (a, b) =>
        b.contratos - a.contratos ||
        b.valor - a.valor ||
        b.propostas - a.propostas ||
        b.simulacoes - a.simulacoes ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    )
    .slice(0, limite);
}

/** Série por dia (até 62 dias) ou por mês, cobrindo o intervalo inteiro (dias sem fato = 0). */
export function serie(fatos: FatoProducao[], de: string, ate: string): PontoSerie[] {
  const dias = Math.round((diaUTC(ate).getTime() - diaUTC(de).getTime()) / 86_400_000) + 1;
  const porMes = dias > 62;
  const chaves: string[] = [];
  const c = diaUTC(de);
  if (porMes) c.setUTCDate(1);
  for (let i = 0; i < 400 && iso(c) <= ate; i++) {
    chaves.push(porMes ? iso(c).slice(0, 7) : iso(c));
    if (porMes) c.setUTCMonth(c.getUTCMonth() + 1);
    else c.setUTCDate(c.getUTCDate() + 1);
  }
  const m = new Map(chaves.map((k) => [k, { simulacoes: 0, propostas: 0, contratos: 0 }]));
  for (const f of fatos) {
    const p = m.get(porMes ? f.dia.slice(0, 7) : f.dia);
    if (!p) continue;
    if (f.tipo === "simulacao") p.simulacoes += 1;
    else if (f.tipo === "proposta") p.propostas += 1;
    else if (f.tipo === "contrato") p.contratos += 1;
  }
  const MESES = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  return chaves.map((k) => ({
    chave: k,
    rotulo: porMes
      ? `${MESES[Number(k.slice(5, 7)) - 1]}/${k.slice(2, 4)}`
      : `${k.slice(8)}/${k.slice(5, 7)}`,
    ...m.get(k)!,
  }));
}

// ---------------------------------------------------------------- variação --

export interface VariacaoNumero {
  /** Percentual absoluto; `null` = sem base anterior. */
  pct: number | null;
  sobe?: boolean;
}

/**
 * Variação contra o período anterior. Sem base anterior não há percentual ("novo"); zero
 * contra zero não mostra nada (`undefined`). Movimento abaixo de 0,5% é "estável".
 */
export function variacao(atual: number, anterior: number): VariacaoNumero | undefined {
  if (!atual && !anterior) return undefined;
  if (!anterior) return { pct: null };
  const d = ((atual - anterior) / anterior) * 100;
  if (Math.abs(d) < 0.5) return { pct: 0 };
  return { pct: Math.abs(d), sobe: d > 0 };
}

// ------------------------------------------------------------- resultado --

export type EstadoFonte = "ok" | "sem_permissao" | "indisponivel" | "nao_se_aplica";

export interface ResultadoProducao {
  filtros: FiltrosProducao;
  intervalo: Intervalo;
  atual: Totais;
  anterior: Totais;
  serie: PontoSerie[];
  rankingUsuarios: LinhaRanking[];
  rankingAssinantes: LinhaRanking[];
  /** De onde veio cada parte e se veio inteira. */
  fontes: {
    agilliza: EstadoFonte;
    plataforma: EstadoFonte;
    /** `nativa` = função de agregação do banco do Tech; `listas` = soma das listas paginadas. */
    agregacao: "nativa" | "listas" | null;
    /** Mensagem para a tela quando uma parte não veio. */
    aviso?: string | null;
  };
  /** Nome do assinante escolhido (base = assinante). */
  assinanteNome?: string | null;
  atualizadoEm: string;
}

// ------------------------------------------------------------------ blocos --

/**
 * Produção de uma fonte já somada: o Agilliza (somado aqui a partir das linhas) e o
 * Agilliza Tech (somado no banco pela função de agregação, ou aqui a partir das listas).
 */
export interface BlocoProducao {
  atual: Totais;
  anterior: Totais;
  serie: PontoSerie[];
  rankingUsuarios: LinhaRanking[];
  rankingContas: LinhaRanking[];
}

export const BLOCO_VAZIO: BlocoProducao = {
  atual: { ...ZERO },
  anterior: { ...ZERO },
  serie: [],
  rankingUsuarios: [],
  rankingContas: [],
};

export function blocoDosFatos(
  atual: FatoProducao[],
  anterior: FatoProducao[],
  de: string,
  ate: string,
): BlocoProducao {
  return {
    atual: totalizar(atual),
    anterior: totalizar(anterior),
    serie: serie(atual, de, ate),
    rankingUsuarios: ranking(atual, "usuario"),
    rankingContas: ranking(atual, "conta"),
  };
}

function juntarRanking(a: LinhaRanking[], b: LinhaRanking[], limite = 10): LinhaRanking[] {
  const m = new Map<string, LinhaRanking>();
  for (const l of [...a, ...b]) {
    const atual = m.get(l.id);
    m.set(l.id, atual ? { ...atual, ...somar(atual, l) } : { ...l });
  }
  return [...m.values()]
    .sort(
      (x, y) =>
        y.contratos - x.contratos ||
        y.valor - x.valor ||
        y.propostas - x.propostas ||
        y.simulacoes - x.simulacoes ||
        x.nome.localeCompare(y.nome, "pt-BR"),
    )
    .slice(0, limite);
}

/** Soma duas fontes (Sua base = Agilliza + contas do Tech da base). */
export function juntarBlocos(a: BlocoProducao, b: BlocoProducao): BlocoProducao {
  const pontos = new Map<string, PontoSerie>();
  for (const p of [...a.serie, ...b.serie]) {
    const x = pontos.get(p.chave);
    pontos.set(
      p.chave,
      x
        ? {
            ...x,
            simulacoes: x.simulacoes + p.simulacoes,
            propostas: x.propostas + p.propostas,
            contratos: x.contratos + p.contratos,
          }
        : { ...p },
    );
  }
  return {
    atual: somar(a.atual, b.atual),
    anterior: somar(a.anterior, b.anterior),
    serie: [...pontos.values()].sort((x, y) => x.chave.localeCompare(y.chave)),
    rankingUsuarios: juntarRanking(a.rankingUsuarios, b.rankingUsuarios),
    rankingContas: juntarRanking(a.rankingContas, b.rankingContas),
  };
}

// ------------------------------------------------- regras do Agilliza Tech --

/** Status do Tech que contam como "crédito aprovado" (ainda sem contrato). */
export const APROVADAS_TECH = new Set([
  "aprovada",
  "condicionada",
  "formularios",
  "aguardando_documentos",
  "engenharia_vistoria",
  "analise_juridica",
]);
/** Status do Tech de contrato emitido (o registrado também já foi emitido). */
export const CONTRATOS_TECH = new Set(["contrato", "registrado"]);

/** Proposta do Tech (linha de `plataforma.consultar_propostas`) → fatos. */
export function fatosDaPropostaTech(
  p: {
    status: string;
    criado_em: string;
    valor_aprovado?: number | string | null;
    valor_financiamento?: number | string | null;
    usuario_id?: string | null;
    usuario_origem?: string | null;
    tenant_id?: string | null;
    conta?: string | null;
  },
  diaDe: (iso: string) => string,
): FatoProducao[] {
  const base = {
    dia: diaDe(p.criado_em),
    usuarioId: p.usuario_id ? `t:${p.usuario_id}` : null,
    usuarioNome: p.usuario_origem ?? null,
    contaId: p.tenant_id ?? null,
    contaNome: p.conta ?? null,
  };
  const fatos: FatoProducao[] = [{ tipo: "proposta", ...base }];
  if (APROVADAS_TECH.has(p.status)) fatos.push({ tipo: "aprovada", ...base });
  if (CONTRATOS_TECH.has(p.status)) {
    fatos.push({
      tipo: "contrato",
      ...base,
      registrado: p.status === "registrado",
      valor: Number(p.valor_aprovado ?? p.valor_financiamento ?? 0) || 0,
    });
  }
  return fatos;
}
