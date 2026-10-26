/**
 * Relatórios gerenciais do ecossistema (pedido do dono de 26/10/2026, C47) — regras PURAS.
 *
 * O banco entrega a produção já agregada num cubo pequeno (mês × grupo × conta × banco × usuário),
 * com o mesmo formato nas duas pontas:
 *   · Agilliza: `public.relatorio_eco_agilliza` (migração 20261027060001);
 *   · Agilliza Tech: `plataforma.relatorio_ecossistema` (migração 0335, pela ponte).
 * Aqui se lê o filtro global (o MESMO "Sua base | Assinantes" das outras telas, mais
 * "Ecossistema inteiro", período, escopo, banco e responsável), decide-se o que buscar em cada
 * ponta e se monta tudo o que as telas mostram: funil, conversão, tempo por etapa, rankings,
 * série mensal, comparativo com o período anterior e o construtor de relatórios personalizados.
 *
 * Regras de contagem (iguais ao Painel geral): simulações e propostas pela data de criação;
 * crédito aprovado = proposta do período com status de aprovado em diante; aguardando contrato
 * = aprovada ainda sem contrato; contratos pela data de emissão; registrados entre os emitidos;
 * o que um assinante levou ao Agilliza conta uma vez só (pela cópia do Agilliza) sempre que o
 * Agilliza entra na mesma conta.
 */
import {
  lerFiltroBase,
  paramsDoFiltro,
  rotuloDoFiltro,
  type ContaFiltro,
  type FiltroBase,
} from "@/lib/plataforma/filtro-base";
import {
  PERIODOS_PRODUCAO,
  resolverIntervaloProducao,
  type Intervalo,
  type PeriodoProducao,
} from "@/lib/relatorios/producao-ecossistema";

// ------------------------------------------------------------------ filtros --

export type Visao = "recorte" | "ecossistema";
export type EscopoRel = "minha" | "geral";

export interface FiltrosRelatorio {
  /** "ecossistema" = tudo (Agilliza + vinculados + assinantes), sem o recorte de base. */
  visao: Visao;
  base: FiltroBase;
  escopo: EscopoRel;
  periodo: PeriodoProducao;
  de?: string;
  ate?: string;
  /** Id do banco (`caixa`, `itau`…), o mesmo nas duas pontas. */
  banco?: string;
  /** `a:<uuid>` (usuário do Agilliza) ou `t:<uuid>` (usuário do Agilliza Tech). */
  usuario?: string;
}

export const BANCOS_RELATORIO: { id: string; nome: string }[] = [
  { id: "bradesco", nome: "Bradesco" },
  { id: "caixa", nome: "Caixa" },
  { id: "inter", nome: "Inter" },
  { id: "itau", nome: "Itaú" },
  { id: "santander", nome: "Santander" },
  { id: "bb", nome: "Banco do Brasil" },
  { id: "btg", nome: "BTG Pactual" },
];

export const nomeDoBanco = (id: string | null | undefined): string =>
  !id ? "Sem banco" : (BANCOS_RELATORIO.find((b) => b.id === id)?.nome ?? id);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const BANCO = /^[a-z_]{2,30}$/;

export const FILTROS_RELATORIO_PADRAO: FiltrosRelatorio = {
  visao: "recorte",
  base: { base: "sua", origem: "tudo", contaId: null },
  escopo: "geral",
  periodo: "mes",
};

/** Lê os filtros da URL. Valor torto vira o padrão, nunca erro na tela. */
export function lerFiltrosRelatorio(s: Record<string, unknown> | null | undefined): FiltrosRelatorio {
  const o = s ?? {};
  const txt = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);
  const visao: Visao = txt(o.visao) === "ecossistema" ? "ecossistema" : "recorte";
  const escopo: EscopoRel = txt(o.escopo) === "minha" ? "minha" : "geral";
  const p = txt(o.periodo) as PeriodoProducao | undefined;
  let periodo: PeriodoProducao = PERIODOS_PRODUCAO.some((x) => x.id === p)
    ? (p as PeriodoProducao)
    : FILTROS_RELATORIO_PADRAO.periodo;
  const de = txt(o.de);
  const ate = txt(o.ate);
  const customOk = !!de && !!ate && DATA.test(de) && DATA.test(ate) && de <= ate;
  if (periodo === "custom" && !customOk) periodo = FILTROS_RELATORIO_PADRAO.periodo;
  const banco = txt(o.banco)?.toLowerCase();
  const usuario = txt(o.usuario)?.toLowerCase();
  const usuarioOk = usuario && /^[at]:/.test(usuario) && UUID.test(usuario.slice(2)) ? usuario : undefined;
  return {
    visao,
    base: lerFiltroBase(o),
    escopo,
    periodo,
    ...(periodo === "custom" ? { de, ate } : {}),
    ...(banco && BANCO.test(banco) ? { banco } : {}),
    ...(usuarioOk ? { usuario: usuarioOk } : {}),
  };
}

/** Filtros → parâmetros de URL (sem os padrões). */
export function filtrosRelatorioParaUrl(f: FiltrosRelatorio): Record<string, string | undefined> {
  const base = f.visao === "ecossistema" ? {} : paramsDoFiltro(f.base);
  return {
    visao: f.visao === "ecossistema" ? "ecossistema" : undefined,
    base: base.base,
    origem: base.origem,
    conta: base.conta,
    escopo: f.escopo === FILTROS_RELATORIO_PADRAO.escopo ? undefined : f.escopo,
    periodo: f.periodo === FILTROS_RELATORIO_PADRAO.periodo ? undefined : f.periodo,
    de: f.periodo === "custom" ? f.de : undefined,
    ate: f.periodo === "custom" ? f.ate : undefined,
    banco: f.banco,
    usuario: f.usuario,
  };
}

export function intervaloDoRelatorio(f: FiltrosRelatorio, agora = new Date()): Intervalo {
  return resolverIntervaloProducao(
    { escopo: "geral", base: "sua_base", periodo: f.periodo, de: f.de, ate: f.ate },
    agora,
  );
}

/** Rótulo do recorte para títulos, exportação e cabeçalhos. */
export function rotuloDoRecorte(f: FiltrosRelatorio, conta?: ContaFiltro | null): string {
  return f.visao === "ecossistema" ? "Ecossistema inteiro" : rotuloDoFiltro(f.base, conta);
}

/** O que buscar em cada ponta. */
export interface PlanoDeLeitura {
  agilliza: boolean;
  tech: null | {
    grupo: "todos" | "vinculados" | "assinantes";
    licenca: string | null;
    /** O Agilliza entra na mesma conta: o que foi levado para lá não conta de novo. */
    semNoAgilliza: boolean;
  };
}

/**
 * Recorte → fontes. Sem permissão de ver as contas do Agilliza Tech (`podeTech`), só o Agilliza.
 * Usuário escolhido também recorta: `a:` só existe no Agilliza, `t:` só no Agilliza Tech.
 */
export function planoDeLeitura(f: FiltrosRelatorio, podeTech: boolean): PlanoDeLeitura {
  let plano: PlanoDeLeitura;
  if (f.visao === "ecossistema") {
    plano = { agilliza: true, tech: { grupo: "todos", licenca: null, semNoAgilliza: true } };
  } else if (f.base.base === "assinantes") {
    plano = { agilliza: false, tech: { grupo: "assinantes", licenca: f.base.contaId, semNoAgilliza: false } };
  } else if (f.base.origem === "agilliza") {
    plano = { agilliza: true, tech: null };
  } else if (f.base.origem === "vinculados") {
    plano = { agilliza: false, tech: { grupo: "vinculados", licenca: f.base.contaId, semNoAgilliza: false } };
  } else {
    plano = { agilliza: true, tech: { grupo: "vinculados", licenca: null, semNoAgilliza: true } };
  }
  if (!podeTech) plano = { agilliza: plano.agilliza || plano.tech !== null, tech: null };
  if (f.usuario?.startsWith("a:")) plano = { ...plano, tech: null };
  if (f.usuario?.startsWith("t:")) plano = { ...plano, agilliza: false };
  return plano;
}

// ------------------------------------------------------------------- cubo --

/** As medidas de cada linha do cubo (iguais nas duas pontas). */
export interface Medidas {
  simulacoes: number;
  propostas: number;
  aprovadas: number;
  aguardando_contrato: number;
  recusadas: number;
  canceladas: number;
  contratos: number;
  registrados: number;
  valor_proposto: number;
  valor_contratado: number;
  h_aprov: number;
  n_aprov: number;
  h_contrato: number;
  n_contrato: number;
  h_registro: number;
  n_registro: number;
}

export const MEDIDAS: (keyof Medidas)[] = [
  "simulacoes",
  "propostas",
  "aprovadas",
  "aguardando_contrato",
  "recusadas",
  "canceladas",
  "contratos",
  "registrados",
  "valor_proposto",
  "valor_contratado",
  "h_aprov",
  "n_aprov",
  "h_contrato",
  "n_contrato",
  "h_registro",
  "n_registro",
];

export const ZERO_MEDIDAS: Medidas = Object.fromEntries(MEDIDAS.map((m) => [m, 0])) as unknown as Medidas;

export type GrupoFato = "agilliza" | "vinculados" | "assinantes";

export interface FatoEco extends Medidas {
  mes: string;
  grupo: GrupoFato;
  conta_id: string;
  conta_nome: string;
  conta_tipo: string;
  banco: string | null;
  usuario_id: string | null;
  usuario_nome: string;
  /** Parceiro (corretor/imobiliária do portal do parceiro) da operação do Agilliza. */
  parceiro_id: string | null;
  parceiro_nome: string | null;
}

export interface Gargalo {
  grupo: GrupoFato;
  status: string;
  quantidade: number;
  dias_parado: number;
  sla_vencido: number;
  parados_15d: number;
}

export interface BlocoEco {
  fatos: FatoEco[];
  anterior: Medidas;
  gargalos: Gargalo[];
  /** Licenças das contas do recorte (só para quem lê as contas). */
  contas?: { total: number; ativas: number; teste: number; suspensas: number; por_tipo: Record<string, number> } | null;
  truncado?: boolean;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Normaliza o que veio do banco (números como texto, nulos) num bloco confiável. */
export function normalizarBloco(bruto: unknown, origem: "agilliza" | "tech"): BlocoEco {
  const b = (bruto ?? {}) as Record<string, any>;
  const medidas = (o: Record<string, unknown> | null | undefined): Medidas =>
    Object.fromEntries(MEDIDAS.map((m) => [m, num(o?.[m])])) as unknown as Medidas;
  const fatos: FatoEco[] = (Array.isArray(b.fatos) ? b.fatos : []).map((f: any) => ({
    ...medidas(f),
    mes: String(f.mes ?? ""),
    grupo: (origem === "agilliza" ? "agilliza" : f.grupo === "vinculados" ? "vinculados" : "assinantes") as GrupoFato,
    conta_id: String(f.conta_id ?? (origem === "agilliza" ? "agilliza" : "")),
    conta_nome: String(f.conta_nome ?? (origem === "agilliza" ? "Agilliza Correspondente" : "Conta")),
    conta_tipo: String(f.conta_tipo ?? ""),
    banco: f.banco ? String(f.banco) : null,
    usuario_id: f.usuario_id ? `${origem === "agilliza" ? "a" : "t"}:${f.usuario_id}` : null,
    usuario_nome: String(f.usuario_nome ?? "Sem responsável"),
    parceiro_id: f.parceiro_id ? String(f.parceiro_id) : null,
    parceiro_nome: f.parceiro_nome ? String(f.parceiro_nome) : null,
  }));
  const gargalos: Gargalo[] = (Array.isArray(b.gargalos) ? b.gargalos : []).map((g: any) => ({
    grupo: (origem === "agilliza" ? "agilliza" : g.grupo === "vinculados" ? "vinculados" : "assinantes") as GrupoFato,
    status: String(g.status ?? ""),
    quantidade: num(g.quantidade),
    dias_parado: num(g.dias_parado),
    sla_vencido: num(g.sla_vencido),
    parados_15d: num(g.parados_15d),
  }));
  return {
    fatos,
    anterior: medidas(b.anterior),
    gargalos,
    contas: b.contas ?? null,
    truncado: !!b.truncado,
  };
}

export function somarMedidas(a: Medidas, b: Medidas): Medidas {
  const r = { ...a };
  for (const m of MEDIDAS) r[m] = a[m] + b[m];
  return r;
}

export function totalizarFatos(fatos: FatoEco[]): Medidas {
  return fatos.reduce<Medidas>((t, f) => somarMedidas(t, f), { ...ZERO_MEDIDAS });
}

/** Junta as duas pontas (cada uma pode faltar). */
export function combinarBlocos(...blocos: (BlocoEco | null | undefined)[]): BlocoEco {
  const validos = blocos.filter((b): b is BlocoEco => !!b);
  return {
    fatos: validos.flatMap((b) => b.fatos),
    anterior: validos.reduce<Medidas>((t, b) => somarMedidas(t, b.anterior), { ...ZERO_MEDIDAS }),
    gargalos: validos.flatMap((b) => b.gargalos),
    contas: validos.find((b) => b.contas)?.contas ?? null,
    truncado: validos.some((b) => b.truncado),
  };
}

// ------------------------------------------------------------ indicadores --

/** Percentual (0–100) com proteção contra divisão por zero. `null` = sem base. */
export const taxa = (parte: number, todo: number): number | null =>
  todo > 0 ? Math.round((parte / todo) * 1000) / 10 : null;

/** Variação contra o período anterior, no formato do `VariacaoSelo`. */
export function variacao(atual: number, anterior: number, bom = true) {
  if (anterior === 0) return { pct: atual === 0 ? 0 : null, sobe: atual === 0 ? undefined : true, bom };
  const pct = Math.round((Math.abs(atual - anterior) / anterior) * 1000) / 10;
  return { pct, sobe: atual === anterior ? undefined : atual > anterior, bom };
}

/** Média em dias de uma etapa (soma de horas ÷ quantidade). `null` sem medição. */
export const diasMedios = (horas: number, n: number): number | null =>
  n > 0 ? Math.round((horas / n / 24) * 10) / 10 : null;

export interface EtapaFunil {
  chave: "simulacoes" | "propostas" | "aprovadas" | "contratos" | "registrados";
  rotulo: string;
  valor: number;
  /** Conversão a partir da etapa anterior. */
  conversao: number | null;
}

export function funil(t: Medidas): EtapaFunil[] {
  const etapas: Omit<EtapaFunil, "conversao">[] = [
    { chave: "simulacoes", rotulo: "Simulações", valor: t.simulacoes },
    { chave: "propostas", rotulo: "Propostas", valor: t.propostas },
    { chave: "aprovadas", rotulo: "Crédito aprovado", valor: t.aprovadas },
    { chave: "contratos", rotulo: "Contratos emitidos", valor: t.contratos },
    { chave: "registrados", rotulo: "Contratos registrados", valor: t.registrados },
  ];
  return etapas.map((e, i) => ({ ...e, conversao: i === 0 ? null : taxa(e.valor, etapas[i - 1].valor) }));
}

export interface TempoEtapa {
  rotulo: string;
  dias: number | null;
  medicoes: number;
}

export function temposPorEtapa(t: Medidas): TempoEtapa[] {
  return [
    { rotulo: "Proposta → crédito aprovado", dias: diasMedios(t.h_aprov, t.n_aprov), medicoes: t.n_aprov },
    { rotulo: "Aprovação → contrato emitido", dias: diasMedios(t.h_contrato, t.n_contrato), medicoes: t.n_contrato },
    { rotulo: "Contrato → registro", dias: diasMedios(t.h_registro, t.n_registro), medicoes: t.n_registro },
  ];
}

// ----------------------------------------------- dimensões e métricas (cubo) --

export type Dimensao = "mes" | "grupo" | "conta" | "banco" | "usuario" | "parceiro";

export const DIMENSOES: { id: Dimensao; rotulo: string }[] = [
  { id: "mes", rotulo: "Mês" },
  { id: "grupo", rotulo: "Origem (Agilliza, vinculados, assinantes)" },
  { id: "conta", rotulo: "Conta / assinante" },
  { id: "banco", rotulo: "Banco" },
  { id: "usuario", rotulo: "Responsável" },
  { id: "parceiro", rotulo: "Parceiro do Agilliza" },
];

export type Metrica =
  | keyof Pick<
      Medidas,
      | "simulacoes"
      | "propostas"
      | "aprovadas"
      | "aguardando_contrato"
      | "recusadas"
      | "canceladas"
      | "contratos"
      | "registrados"
      | "valor_proposto"
      | "valor_contratado"
    >
  | "conversao"
  | "aprovacao"
  | "ticket_medio"
  | "dias_ate_contrato";

export const METRICAS: { id: Metrica; rotulo: string; formato: "int" | "brl" | "pct" | "dias" }[] = [
  { id: "simulacoes", rotulo: "Simulações", formato: "int" },
  { id: "propostas", rotulo: "Propostas", formato: "int" },
  { id: "aprovadas", rotulo: "Crédito aprovado", formato: "int" },
  { id: "aguardando_contrato", rotulo: "Aguardando contrato", formato: "int" },
  { id: "recusadas", rotulo: "Recusadas", formato: "int" },
  { id: "canceladas", rotulo: "Canceladas", formato: "int" },
  { id: "contratos", rotulo: "Contratos emitidos", formato: "int" },
  { id: "registrados", rotulo: "Contratos registrados", formato: "int" },
  { id: "valor_proposto", rotulo: "Valor proposto (R$)", formato: "brl" },
  { id: "valor_contratado", rotulo: "Valor financiado em contrato (R$)", formato: "brl" },
  { id: "aprovacao", rotulo: "Taxa de aprovação (%)", formato: "pct" },
  { id: "conversao", rotulo: "Conversão proposta → contrato (%)", formato: "pct" },
  { id: "ticket_medio", rotulo: "Ticket médio do contrato (R$)", formato: "brl" },
  { id: "dias_ate_contrato", rotulo: "Dias da aprovação ao contrato", formato: "dias" },
];

export const ROTULO_GRUPO: Record<GrupoFato, string> = {
  agilliza: "Agilliza Correspondente",
  vinculados: "Vinculados (Sua base)",
  assinantes: "Assinantes",
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const rotuloMes = (mes: string) =>
  /^\d{4}-\d{2}$/.test(mes) ? `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}` : mes || "—";

/** Valor de uma métrica (simples ou derivada) sobre um total. `null` = sem base. */
export function valorMetrica(t: Medidas, m: Metrica): number | null {
  switch (m) {
    case "aprovacao":
      return taxa(t.aprovadas, t.propostas);
    case "conversao":
      return taxa(t.contratos, t.propostas);
    case "ticket_medio":
      return t.contratos > 0 ? Math.round((t.valor_contratado / t.contratos) * 100) / 100 : null;
    case "dias_ate_contrato":
      return diasMedios(t.h_contrato, t.n_contrato);
    default:
      return t[m];
  }
}

export interface LinhaAgrupada {
  chave: string;
  rotulo: string;
  /** Detalhe (conta do usuário, tipo da conta, origem). */
  detalhe?: string;
  totais: Medidas;
}

function chaveDe(f: FatoEco, d: Dimensao): { chave: string; rotulo: string; detalhe?: string } {
  switch (d) {
    case "mes":
      return { chave: f.mes, rotulo: rotuloMes(f.mes) };
    case "grupo":
      return { chave: f.grupo, rotulo: ROTULO_GRUPO[f.grupo] };
    case "conta":
      return {
        chave: f.conta_id,
        rotulo: f.conta_nome,
        detalhe: f.grupo === "agilliza" ? "Operação própria" : `${tipoConta(f.conta_tipo)} · ${ROTULO_GRUPO[f.grupo]}`,
      };
    case "banco":
      return { chave: f.banco ?? "", rotulo: nomeDoBanco(f.banco) };
    case "usuario":
      return {
        chave: f.usuario_id ?? "",
        rotulo: f.usuario_id ? f.usuario_nome : "Sem responsável",
        detalhe: f.conta_nome,
      };
    case "parceiro":
      return {
        chave: f.parceiro_id ?? "",
        rotulo: f.parceiro_id ? (f.parceiro_nome ?? "Parceiro") : "Sem parceiro",
        detalhe: f.grupo === "agilliza" ? "Parceiro do Agilliza" : f.conta_nome,
      };
  }
}

const tipoConta = (t: string) => (t === "imobiliaria" ? "Imobiliária" : t === "corretor" ? "Corretor" : "Conta");

/** Agrupa o cubo por uma dimensão. */
export function agrupar(fatos: FatoEco[], d: Dimensao): LinhaAgrupada[] {
  const mapa = new Map<string, LinhaAgrupada>();
  for (const f of fatos) {
    const k = chaveDe(f, d);
    const atual = mapa.get(k.chave) ?? { ...k, totais: { ...ZERO_MEDIDAS } };
    atual.totais = somarMedidas(atual.totais, f);
    mapa.set(k.chave, atual);
  }
  return [...mapa.values()];
}

/** Ordena por uma métrica (maior primeiro; sem base vai para o fim) e corta. */
export function ordenarPor(linhas: LinhaAgrupada[], m: Metrica, limite?: number): LinhaAgrupada[] {
  const v = (l: LinhaAgrupada) => valorMetrica(l.totais, m) ?? Number.NEGATIVE_INFINITY;
  const r = [...linhas].sort((a, b) => v(b) - v(a) || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  return limite ? r.slice(0, limite) : r;
}

/** Ranking padrão: contratos, depois valor, propostas e simulações. */
export function ranking(fatos: FatoEco[], d: Dimensao, limite?: number): LinhaAgrupada[] {
  const r = agrupar(fatos, d).sort(
    (a, b) =>
      b.totais.contratos - a.totais.contratos ||
      b.totais.valor_contratado - a.totais.valor_contratado ||
      b.totais.propostas - a.totais.propostas ||
      b.totais.simulacoes - a.totais.simulacoes ||
      a.rotulo.localeCompare(b.rotulo, "pt-BR"),
  );
  return limite ? r.slice(0, limite) : r;
}

/** Série mensal do intervalo, com os meses vazios preenchidos. */
export function serieMensal(fatos: FatoEco[], de: string, ate: string): LinhaAgrupada[] {
  const porMes = new Map(agrupar(fatos, "mes").map((l) => [l.chave, l]));
  const out: LinhaAgrupada[] = [];
  let [a, m] = de.slice(0, 7).split("-").map(Number);
  const [af, mf] = ate.slice(0, 7).split("-").map(Number);
  for (let i = 0; i < 40 && (a < af || (a === af && m <= mf)); i++) {
    const chave = `${a}-${String(m).padStart(2, "0")}`;
    out.push(porMes.get(chave) ?? { chave, rotulo: rotuloMes(chave), totais: { ...ZERO_MEDIDAS } });
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return out;
}

// ------------------------------------------------------- gargalos (etapas) --

const ROTULO_STATUS: Record<string, string> = {
  // Agilliza
  aguardando_envio: "Aguardando envio",
  enviada_banco: "Enviada ao banco",
  em_analise_credito: "Em análise de crédito",
  credito_aprovado: "Crédito aprovado",
  credito_condicionado: "Aprovação condicionada",
  formularios: "Formulários",
  aguardando_documentos: "Coleta de documentos",
  checklist_documentacao: "Coleta de documentos",
  cadastro_complementar: "Coleta de documentos",
  dossie_completo: "Coleta de documentos",
  envio_documentos_banco: "Coleta de documentos",
  engenharia_vistoria: "Engenharia / vistoria",
  vistoria_agendamento: "Engenharia / vistoria",
  vistoria_concluida: "Engenharia / vistoria",
  analise_juridica: "Análise jurídica",
  emissao_contrato: "Análise jurídica",
  contrato_emitido: "Contrato emitido",
  erro_envio: "Erro no envio",
  // Agilliza Tech
  aguardando_correspondente: "Na fila do correspondente",
  em_envio: "Em envio",
  enviada: "Enviada ao banco",
  em_analise: "Em análise de crédito",
  condicionada: "Aprovação condicionada",
  aprovada: "Crédito aprovado",
  contrato: "Contrato emitido",
};
export const rotuloEtapa = (s: string) => ROTULO_STATUS[s] ?? s.replace(/_/g, " ");

export interface LinhaGargalo {
  etapa: string;
  quantidade: number;
  dias_parado: number;
  parados_15d: number;
  sla_vencido: number;
}

/** Junta os gargalos das duas pontas pela etapa (rótulo), com a média de dias ponderada. */
export function gargalosPorEtapa(g: Gargalo[]): LinhaGargalo[] {
  const mapa = new Map<string, LinhaGargalo & { soma: number }>();
  for (const x of g) {
    const etapa = rotuloEtapa(x.status);
    const a = mapa.get(etapa) ?? { etapa, quantidade: 0, dias_parado: 0, parados_15d: 0, sla_vencido: 0, soma: 0 };
    a.quantidade += x.quantidade;
    a.soma += x.dias_parado * x.quantidade;
    a.parados_15d += x.parados_15d;
    a.sla_vencido += x.sla_vencido;
    mapa.set(etapa, a);
  }
  return [...mapa.values()]
    .map(({ soma, ...l }) => ({ ...l, dias_parado: l.quantidade ? Math.round((soma / l.quantidade) * 10) / 10 : 0 }))
    .sort((a, b) => b.dias_parado * b.quantidade - a.dias_parado * a.quantidade);
}

// ------------------------------------------------------- caminho até a origem --

export interface LinkOrigem {
  to: string;
  search: Record<string, string>;
}

/**
 * Onde cada número nasce: a lista de propostas ou de simulações com o mesmo recorte de base e o
 * mesmo período (as listas usam `?base=&origem=&conta=` e `?de=&ate=`).
 */
export function linkOrigem(
  f: FiltrosRelatorio,
  intervalo: Pick<Intervalo, "de" | "ate">,
  alvo: "simulacoes" | "propostas" | "contratos" | "registrados" | "aprovadas",
  extra: { contaId?: string; grupo?: GrupoFato } = {},
): LinkOrigem {
  const base: FiltroBase =
    extra.grupo === "agilliza"
      ? { base: "sua", origem: "agilliza", contaId: null }
      : extra.contaId && extra.grupo
        ? extra.grupo === "vinculados"
          ? { base: "sua", origem: "vinculados", contaId: extra.contaId }
          : { base: "assinantes", contaId: extra.contaId }
        : f.visao === "ecossistema"
          ? { base: "sua", origem: "tudo", contaId: null }
          : f.base;
  const search: Record<string, string> = { ...(paramsDoFiltro(base) as Record<string, string>) };
  search.de = intervalo.de;
  search.ate = intervalo.ate;
  if (alvo === "simulacoes") return { to: "/operacional/simulacoes", search };
  if (alvo === "registrados") search.situacao = "registrado";
  if (alvo === "contratos") search.situacao = "contrato";
  if (alvo === "aprovadas") search.situacao = "aprovada";
  if (f.banco) search.banco = f.banco;
  return { to: "/operacional/propostas", search };
}

/** Situação do Agilliza (link antigo) → situação da lista de propostas. */
const SITUACAO_DA_LISTA: Record<string, string> = {
  credito_aprovado: "aprovada",
  contrato_emitido: "contrato",
  registrado: "registrado",
  aprovada: "aprovada",
  contrato: "contrato",
};

/**
 * Endereços antigos (`/relatorios/simulacoes`, `/relatorios/propostas`, usados também pelo Painel
 * geral) → busca da lista de origem: período, recorte de base e situação. Valor torto some.
 */
export function buscaDaListaDeOrigem(
  s: Record<string, unknown>,
  lista: "simulacoes" | "propostas",
): Record<string, string> {
  const f = lerFiltrosRelatorio(s);
  const i = intervaloDoRelatorio(f);
  // Painel geral: base=assinante&licenca=<uuid> | base=assinantes.
  const licenca = typeof s.licenca === "string" && UUID.test(s.licenca) ? s.licenca.toLowerCase() : null;
  const base: FiltroBase =
    s.base === "assinante" && licenca
      ? { base: "assinantes", contaId: licenca }
      : s.base === "assinantes"
        ? { base: "assinantes", contaId: null }
        : f.base;
  const out: Record<string, string> = { ...(paramsDoFiltro(base) as Record<string, string>), de: i.de, ate: i.ate };
  const situacao = typeof s.status === "string" ? SITUACAO_DA_LISTA[s.status] : undefined;
  if (lista === "propostas" && situacao) out.situacao = situacao;
  return out;
}
