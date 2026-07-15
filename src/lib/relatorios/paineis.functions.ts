import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolverIntervalo, type ReportFiltros } from "@/lib/relatorios/shared";
import { grupoDoStatus } from "@/lib/propostas/status-grupos";
import { criarEscopoEq, listarClienteIdsParceiroDoUsuario } from "@/lib/escopo";

/** Status terminais de contrato — a proposta já virou contrato emitido. */
const CONTRATO_STATUS = new Set(["contrato_emitido", "registrado"]);

/** Uma proposta conta como "Crédito aprovado" quando obteve aprovação de crédito
 * e AINDA não virou contrato emitido (documentos, engenharia, jurídico).
 * Crédito aprovado é diferente de contrato emitido: um contrato já emitido sai
 * da métrica de aprovadas e passa a contar apenas em "Contratos emitidos". */
const foiAprovada = (status: string | null | undefined) =>
  grupoDoStatus(status) === "aprovadas" && !CONTRATO_STATUS.has((status ?? "") as string);

const schema = z.object({
  modulo: z.enum(["visao-geral", "operacional"]),
  periodo: z.enum(["hoje", "7d", "15d", "30d", "mes", "mes_anterior", "ano", "custom"]),
  escopo: z.enum(["minha", "equipe", "geral"]),
  de: z.string().optional(),
  ate: z.string().optional(),
  responsavel: z.string().uuid().optional(),
});

export interface PanelDelta {
  /** Variação percentual absoluta vs. período anterior equivalente. */
  pct: number;
  dir: "up" | "down" | "flat";
  /** Se true, subir é positivo (verde); se false, subir é negativo (vermelho). */
  bom: boolean;
  /** Sem base anterior para comparar (período anterior zerado): exibe "novo". */
  novo?: boolean;
}
export interface PanelMetric {
  label: string;
  valor: string;
  hint?: string;
  tone?: "brand" | "success" | "warning" | "danger" | "neutral";
  delta?: PanelDelta;
}
export interface PanelSerie {
  label: string;
  valor: number;
  valor2?: number;
}
export interface PanelAlert {
  tone: "warning" | "danger" | "success";
  titulo: string;
  descricao?: string;
  contador?: number;
}
export interface PanelDistribuicao {
  titulo: string;
  subtitulo?: string;
  dados: PanelSerie[];
  porBanco?: boolean;
}
export interface PanelEvolucao {
  titulo: string;
  subtitulo?: string;
  serie1: string;
  serie2: string;
  dados: PanelSerie[];
}

export interface PanelFunil {
  titulo: string;
  etapas: { label: string; valor: number }[];
}
export interface PanelDados {
  heros: PanelMetric[];
  minis: PanelMetric[];
  evolucao?: PanelEvolucao;
  funil?: PanelFunil;
  chart: { titulo: string; subtitulo?: string; dados: PanelSerie[]; porBanco?: boolean };
  distribuicao?: PanelDistribuicao;
  ranking: { titulo: string; itens: { label: string; valor: number }[] };
  recusadasPorBanco?: { titulo: string; itens: { label: string; valor: number }[] };
  alertas: PanelAlert[];
  /** Extras exclusivos da visão geral do sistema. */
  porTipoSimulacao?: PanelDistribuicao;
  clientesPorEtapa?: PanelDistribuicao;
  topOperadores?: PanelDistribuicao;
  financeiroResumo?: { titulo: string; itens: { label: string; valor: string; tone?: "brand" | "success" | "warning" | "danger" | "neutral" }[] };
  volumePorBanco?: PanelDistribuicao;
}

const brl = (v: number) => (v || 0).toLocaleString("pt-BR", {  style: "currency", currency: "BRL" });
const brlCompacto = (v: number) => {
  const n = v || 0;
  // Mantém uma casa decimal em milhares/milhões para não distorcer o valor
  // real (ex.: R$ 615.300 vira "R$ 615,3 mil", não "R$ 615 mil").
  if (Math.abs(n) >= 1_000_000)
    return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", {  minimumFractionDigits: 1, maximumFractionDigits: 2 })} mi`;
  if (Math.abs(n) >= 1_000)
    return `R$ ${(n / 1_000).toLocaleString("pt-BR", {  maximumFractionDigits: 1 })} mil`;
  return brl(n);
};
const int = (v: number) => (v || 0).toLocaleString("pt-BR");
const pct = (v: number) =>
  `${Math.min(100, Math.max(0, v || 0)).toLocaleString("pt-BR", {  maximumFractionDigits: 1 })}%`;

function topItens(map: Map<string, number>, limite = 8) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([label, valor]) => ({ label: label || "—", valor }));
}

/** Rótulos amigáveis para status de propostas. */
const PROP_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviada_banco: "Enviada ao banco",
  em_analise_credito: "Em análise",
  credito_aprovado: "Aprovada",
  credito_recusado: "Recusada",
  contrato_emitido: "Contrato emitido",
  registrado: "Registrado",
  cancelada: "Cancelada",
  pendente: "Pendente",
};
const SIM_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_simulacao: "Em simulação",
  simulada: "Simulada",
  parcialmente_simulada: "Parcial",
  promovida: "Promovida",
  erro_banco: "Erro",
  cancelada: "Cancelada",
};
const rotularStatus = (s: string, mapa: Record<string, string>) =>
  mapa[s] ?? (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "—");

/** Constrói baldes temporais (por dia ou por mês) cobrindo o intervalo. */
function construirBuckets(deISO: string, ateISO: string) {
  const de = new Date(`${deISO}T00:00:00`);
  const ate = new Date(`${ateISO}T23:59:59`);
  const dias = Math.max(0, Math.round((ate.getTime() - de.getTime()) / 86_400_000));
  const porMes = dias > 62;
  const chaveDe = (d: Date) =>
    porMes
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const chaves: string[] = [];
  const cursor = new Date(de);
  if (porMes) cursor.setDate(1);
  else cursor.setHours(0, 0, 0, 0);
  let guarda = 0;
  while (cursor <= ate && guarda < 400) {
    chaves.push(chaveDe(cursor));
    if (porMes) cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
    guarda++;
  }
  const rotulo = (chave: string) => {
    if (porMes) {
      const [y, m] = chave.split("-");
      return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo",   month: "short" });
    }
    const [, m, d] = chave.split("-");
    return `${d}/${m}`;
  };
  const chaveDaData = (iso?: string | null) => (iso ? chaveDe(new Date(iso)) : "");
  return { chaves, rotulo, chaveDaData, porMes };
}

function contarPorBucket(rows: { created_at?: string | null }[], buckets: ReturnType<typeof construirBuckets>) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = buckets.chaveDaData(r.created_at);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/**
 * Contratos emitidos são a fonte de verdade da operação: ficam registrados na
 * ficha do cliente (clientes.contrato_emitido_em), que é o mesmo campo que
 * alimenta a pasta de contratos arquivados. Aqui contamos os contratos cuja
 * DATA DE EMISSÃO cai no período e estimamos o volume pelo valor do imóvel ou,
 * na ausência dele, pela maior simulação vinculada ao cliente.
 */
async function carregarContratosCliente(
  supabase: any,
  escopoEq: (q: any, ...cols: string[]) => any,
  de: string,
  ate: string,
) {
  const cliRes = await escopoEq(
    supabase
      .from("clientes")
      .select("id,contrato_emitido_em,imovel_valor")
      .not("contrato_emitido_em", "is", null)
      .gte("contrato_emitido_em", de)
      .lte("contrato_emitido_em", ate)
      .limit(5000),
    "responsavel_id",
    "criador_id",
    "@cli:id",
  );
  if (cliRes.error) throw new Error(cliRes.error.message);
  const cliRowsAll = (cliRes.data ?? []) as any[];
  if (!cliRowsAll.length) return { rows: [] as { contrato_emitido_em: string; valor: number }[], volume: 0, count: 0 };

  // Um contrato só é considerado "emitido" quando existe uma proposta com
  // status contrato_emitido/registrado vinculada ao cliente. Isso evita que
  // uma movimentação manual da esteira (que também popula contrato_emitido_em)
  // conte como contrato no painel sem que exista contrato real.
  const contratoStatus = Array.from(CONTRATO_STATUS) as string[];
  const propRes = await supabase
    .from("propostas")
    .select("cliente_id,status")
    .in("cliente_id", cliRowsAll.map((c) => c.id))
    .in("status", contratoStatus as any)
    .is("deleted_at", null)
    .limit(5000);
  if (propRes.error) throw new Error(propRes.error.message);
  const clientesComContratoReal = new Set<string>(
    (propRes.data ?? []).map((p: any) => p.cliente_id),
  );
  const cliRows = cliRowsAll.filter((c) => clientesComContratoReal.has(c.id));
  if (!cliRows.length) return { rows: [] as { contrato_emitido_em: string; valor: number }[], volume: 0, count: 0 };

  const semValor = cliRows.filter((c) => !c.imovel_valor).map((c) => c.id);
  const simMap = new Map<string, number>();
  if (semValor.length) {
    const simRes = await supabase
      .from("simulacoes")
      .select("cliente_id,valor_financiamento,valor_imovel")
      .in("cliente_id", semValor)
      .is("deleted_at", null)
      .limit(5000);
    for (const s of (simRes.data ?? []) as any[]) {
      const v = Number(s.valor_financiamento ?? s.valor_imovel ?? 0) || 0;
      if (v > (simMap.get(s.cliente_id) ?? 0)) simMap.set(s.cliente_id, v);
    }
  }

  const rows = cliRows.map((c) => ({
    contrato_emitido_em: c.contrato_emitido_em as string,
    valor: Number(c.imovel_valor ?? simMap.get(c.id) ?? 0) || 0,
  }));
  const volume = rows.reduce((s, r) => s + r.valor, 0);
  return { rows, volume, count: rows.length };
}


/** Calcula o período imediatamente anterior de igual duração. */
function intervaloAnterior(deISO: string, ateISO: string) {
  const de = new Date(`${deISO}T00:00:00`);
  const ate = new Date(`${ateISO}T00:00:00`);
  const dias = Math.max(0, Math.round((ate.getTime() - de.getTime()) / 86_400_000));
  const prevAte = new Date(de);
  prevAte.setDate(prevAte.getDate() - 1);
  const prevDe = new Date(prevAte);
  prevDe.setDate(prevDe.getDate() - dias);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { de: iso(prevDe), ate: iso(prevAte) };
}

interface AnteriorTotais {
  simCount: number;
  enviadas: number;
  aprovadas: number;
  recusadas: number;
  contratos: number;
  volumeContratos: number;
  volumeSimulado: number;
  taxa: number;
}

/** Totais do período anterior equivalente, para calcular tendências (deltas). */
async function carregarAnterior(
  supabase: any,
  escopoEq: (q: any, ...cols: string[]) => any,
  deAtual: string,
  ateAtual: string,
): Promise<AnteriorTotais> {
  const { de, ate } = intervaloAnterior(deAtual, ateAtual);
  const ateFim = `${ate}T23:59:59`;
  const [sims, props, contratosInfo] = await Promise.all([
    escopoEq(
      supabase
        .from("simulacoes")
        .select("status,valor_financiamento,created_at")
        .is("deleted_at", null)
        .gte("created_at", de)
        .lte("created_at", ateFim)
        .limit(5000),
      "usuario_responsavel_id",
      "usuario_criador_id",
      "@cli:cliente_id",
    ),
    escopoEq(
      supabase
        .from("propostas")
        .select("status,created_at")
        .is("deleted_at", null)
        .gte("created_at", de)
        .lte("created_at", ateFim)
        .limit(5000),
      "usuario_responsavel_id",
      "usuario_criador_id",
      "@cli:cliente_id",
    ),
    carregarContratosCliente(supabase, escopoEq, de, ate),
  ]);
  const simRows = (sims.data ?? []) as any[];
  const propRows = (props.data ?? []) as any[];
  const enviadas = propRows.filter((p) => p.status !== "rascunho");
  const aprovadas = enviadas.filter((p) => foiAprovada(p.status)).length;
  const recusadas = enviadas.filter((p) => p.status === "credito_recusado").length;
  const simConcl = simRows.filter((s) =>
    ["simulada", "parcialmente_simulada", "promovida"].includes(s.status),
  );
  return {
    simCount: simRows.length,
    enviadas: enviadas.length,
    aprovadas,
    recusadas,
    contratos: contratosInfo.count,
    volumeContratos: contratosInfo.volume,
    volumeSimulado: simConcl.reduce((s, r) => s + (r.valor_financiamento ?? 0), 0),
    taxa: enviadas.length ? (aprovadas / enviadas.length) * 100 : 0,
  };
}

/** Constrói o objeto de tendência comparando valor atual vs. anterior. */
function mkDelta(cur: number, prev: number, bom = true): PanelDelta | undefined {
  if (!prev && !cur) return undefined;
  // Sem base anterior: não há variação percentual real — sinaliza como "novo".
  if (!prev) return { pct: 0, dir: cur > 0 ? "up" : "flat", bom, novo: cur > 0 };
  const diff = ((cur - prev) / prev) * 100;
  const dir = diff > 0.5 ? "up" : diff < -0.5 ? "down" : "flat";
  return { pct: Math.abs(diff), dir, bom };
}




export const getPanelDados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof schema>) => schema.parse(d))
  .handler(async ({ data, context }): Promise<PanelDados> => {
    const { supabase, userId } = context;
    const f = data as unknown as ReportFiltros;
    const { de, ate } = resolverIntervalo(f);
    const ateFim = `${ate}T23:59:59`;
    const buckets = construirBuckets(de, ate);

    // Um contrato entra no período pela data de emissão (contrato_emitido_em),
    // não pela data de criação da proposta (que pode ser de meses antes).
    const dentroPeriodo = (iso?: string | null) =>
      !!iso && iso.slice(0, 10) >= de && iso.slice(0, 10) <= ate;

    // Filtro por usuário: quando um responsável específico é escolhido, ele
    // prevalece sobre o escopo (mesmo em "geral"). Sem responsável, mantém a
    // regra de escopo: "minha" restringe ao usuário — como responsável OU
    // criador OU parceiro do cliente (corretor/imobiliária/comercial).
    const partnerClienteIds =
      data.escopo === "minha" && !data.responsavel
        ? await listarClienteIdsParceiroDoUsuario(supabase, userId)
        : [];
    const escopoEq = criarEscopoEq({
      userId,
      escopo: data.escopo,
      responsavel: data.responsavel,
      partnerClienteIds,
    });

    if (data.modulo === "visao-geral") {
      const [sims, props, contratosInfo, ant, clientesRes, demRes, tkRes, recRes, payRes, pipeRes] = await Promise.all([
        escopoEq(
          supabase
            .from("simulacoes")
            .select("id,status,tipo_simulacao,valor_financiamento,created_at,usuario_responsavel_id")
            .is("deleted_at", null)
            .gte("created_at", de)
            .lte("created_at", ateFim)
            .limit(5000),
          "usuario_responsavel_id",
          "usuario_criador_id",
          "@cli:cliente_id",
        ),
        escopoEq(
          supabase
            .from("propostas")
            .select(
              "status,valor_financiamento_aprovado,valor_financiamento,nome_banco,created_at,contrato_emitido_em,usuario_responsavel_id",
            )
            .is("deleted_at", null)
            .or(
              `and(created_at.gte.${de},created_at.lte.${ateFim}),and(contrato_emitido_em.gte.${de},contrato_emitido_em.lte.${ateFim})`,
            )
            .limit(5000),
          "usuario_responsavel_id",
          "usuario_criador_id",
          "@cli:cliente_id",
        ),
        carregarContratosCliente(supabase, escopoEq, de, ate),
        carregarAnterior(supabase, escopoEq, de, ate),
        escopoEq(
          supabase
            .from("clientes")
            .select("id,created_at,contrato_emitido_em,responsavel_id")
            .gte("created_at", de)
            .lte("created_at", ateFim)
            .limit(5000),
          "responsavel_id",
          "criador_id",
          "@cli:id",
        ),
        escopoEq(
          supabase
            .from("demandas")
            .select("status,prazo_sla")
            .limit(5000),
          "responsavel_id",
          "criador_id",
          "@cli:cliente_id",
        ),
        escopoEq(
          supabase
            .from("tasks")
            .select("status,prazo")
            .limit(5000),
          "responsavel_id",
          "criador_id",
          "@cli:cliente_id",
        ),
        escopoEq(
          supabase
            .from("financial_receivables")
            .select("valor,valor_pago,status,vencimento,tipo,criador_id")
            .in("status", ["aberta", "parcial"] as any)
            .limit(5000),
          "criador_id",
        ),
        escopoEq(
          supabase
            .from("financial_payables")
            .select("valor,valor_pago,status,vencimento,criador_id")
            .in("status", ["aberta", "parcial"] as any)
            .limit(5000),
          "criador_id",
        ),
        supabase
          .from("cliente_pipeline")
          .select("cliente_id,pipeline_stages(codigo,nome,ordem),clientes!inner(responsavel_id,criador_id)")
          .limit(5000),
      ]);
      if (sims.error) throw new Error(sims.error.message);
      if (props.error) throw new Error(props.error.message);


      const simRows = (sims.data ?? []) as any[];
      const simCount = simRows.length;
      const rowsBrutas = (props.data ?? []) as any[];
      // Propostas cujo movimento (criação) ocorre no período.
      const rows = rowsBrutas.filter((p) => dentroPeriodo(p.created_at));
      const enviadas = rows.filter((p) => p.status !== "rascunho");
      // Contratos emitidos vêm da ficha do cliente (contrato_emitido_em) —
      // fonte de verdade da operação e da pasta de arquivados.
      const contratosCount = contratosInfo.count;
      const volume = contratosInfo.volume;
      // Aprovação é somente crédito aprovado na proposta/simulação bancária.
      // Contrato emitido é uma métrica operacional separada e não pode inflar
      // taxa, volume aprovado ou quantidade de aprovadas.
      const aprovadasProp = rows.filter((p) => foiAprovada(p.status));
      const aprovadasCount = aprovadasProp.length;
      const simConcluidasRows = simRows.filter((s) =>
        ["simulada", "parcialmente_simulada", "promovida"].includes(s.status),
      );
      const simConcluidas = simConcluidasRows.length;
      const simErro = simRows.filter((s) => s.status === "erro_banco").length;
      // Volume simulado considera apenas simulações que efetivamente foram
      // simuladas (com retorno), ignorando rascunhos, erros e cancelamentos.
      const volumeSimulado = simConcluidasRows.reduce(
        (s, r) => s + (r.valor_financiamento ?? 0),
        0,
      );
      const volumeAprovado = aprovadasProp.reduce(
        (s, p) => s + (p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0),
        0,
      );
      const ticket = contratosCount ? volume / contratosCount : 0;
      const taxa = enviadas.length ? (aprovadasCount / enviadas.length) * 100 : 0;
      const conversao = simCount ? (contratosCount / simCount) * 100 : 0;


      const bancoMap = new Map<string, number>();
      enviadas.forEach((p) =>
        bancoMap.set(p.nome_banco ?? "—", (bancoMap.get(p.nome_banco ?? "—") ?? 0) + 1),
      );
      const simStatusMap = new Map<string, number>();
      simRows.forEach((s) =>
        simStatusMap.set(s.status ?? "—", (simStatusMap.get(s.status ?? "—") ?? 0) + 1),
      );
      const chartPorBanco = bancoMap.size > 0;
      const chartDados = chartPorBanco ? topItens(bancoMap, 8) : topItens(simStatusMap, 8);

      // Distribuição (donut) — status das propostas enviadas
      const statusMap = new Map<string, number>();
      enviadas.forEach((p) =>
        statusMap.set(p.status, (statusMap.get(p.status) ?? 0) + 1),
      );
      const distDados = [...statusMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([s, v]) => ({ label: rotularStatus(s, PROP_LABEL), valor: v }));

      // Recusadas por banco — cor/nome do banco + quantidade
      const recusadasBancoMap = new Map<string, number>();
      enviadas
        .filter((p) => p.status === "credito_recusado")
        .forEach((p) =>
          recusadasBancoMap.set(
            p.nome_banco ?? "—",
            (recusadasBancoMap.get(p.nome_banco ?? "—") ?? 0) + 1,
          ),
        );

      // Evolução — propostas x contratos ao longo do tempo
      const propBucket = contarPorBucket(enviadas, buckets);
      const contratoBucket = contarPorBucket(
        contratosInfo.rows.map((p) => ({ created_at: p.contrato_emitido_em })),
        buckets,
      );
      const evoDados: PanelSerie[] = buckets.chaves.map((k) => ({
        label: buckets.rotulo(k),
        valor: propBucket.get(k) ?? 0,
        valor2: contratoBucket.get(k) ?? 0,
      }));

      const recusadasCount = enviadas.filter(
        (p) => p.status === "credito_recusado",
      ).length;

      // === Extras: visão geral do sistema ===
      const clientesRows = (clientesRes.data ?? []) as any[];
      const clientesNovos = clientesRows.length;

      const demRows = (demRes.data ?? []) as any[];
      const tkRows = (tkRes.data ?? []) as any[];
      const agora = new Date();
      const demAbertas = demRows.filter((d) => !["concluida", "cancelada"].includes(d.status));
      const demVencidas = demAbertas.filter((d) => d.prazo_sla && new Date(d.prazo_sla) < agora);
      const tkAbertas = tkRows.filter((t) => !["concluida", "cancelada"].includes(t.status));
      const tkAtrasadas = tkAbertas.filter((t) => t.prazo && new Date(t.prazo) < agora);

      const recRows = (recRes.data ?? []) as any[];
      const payRows = (payRes.data ?? []) as any[];
      const somaAberto = (rows: any[]) =>
        rows.reduce((s, r) => s + Math.max(0, Number(r.valor ?? 0) - Number(r.valor_pago ?? 0)), 0);
      const aReceber = somaAberto(recRows);
      const aPagar = somaAberto(payRows);
      const comissoesPrevistas = somaAberto(
        recRows.filter((r) => String(r.tipo ?? "").toLowerCase().includes("comiss")),
      );

      // Simulações por tipo
      const tipoSimMap = new Map<string, number>();
      simRows.forEach((s) => {
        const t = s.tipo_simulacao === "completa" ? "Completa" : s.tipo_simulacao === "rapida" ? "Rápida" : "Outra";
        tipoSimMap.set(t, (tipoSimMap.get(t) ?? 0) + 1);
      });
      const porTipoSimulacao = tipoSimMap.size
        ? {
            titulo: "Simulações por tipo",
            subtitulo: "Rápida × Completa",
            dados: [...tipoSimMap.entries()].map(([label, valor]) => ({ label, valor })),
          }
        : undefined;

      // Volume por banco (contratos emitidos e propostas aprovadas)
      const volBancoMap = new Map<string, number>();
      aprovadasProp.forEach((p) => {
        const v = Number(p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0) || 0;
        if (!v) return;
        volBancoMap.set(p.nome_banco ?? "—", (volBancoMap.get(p.nome_banco ?? "—") ?? 0) + v);
      });
      const volumePorBanco = volBancoMap.size
        ? {
            titulo: "Volume aprovado por banco",
            subtitulo: "Somatório de crédito aprovado",
            porBanco: true,
            dados: [...volBancoMap.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([label, valor]) => ({ label, valor })),
          }
        : undefined;

      // Clientes por etapa do pipeline
      const pipeRowsBrutas = (pipeRes.data ?? []) as any[];
      // Aplica o mesmo escopo em memória (o cliente_pipeline não permite
      // filtro OR em join): somente clientes onde o usuário é responsável ou
      // criador quando o escopo é "minha".
      const filtroResp = data.responsavel ?? (data.escopo === "minha" ? userId : null);
      const pipeRows = filtroResp
        ? pipeRowsBrutas.filter((r) => {
            const c = r.clientes ?? {};
            return c.responsavel_id === filtroResp || c.criador_id === filtroResp;
          })
        : pipeRowsBrutas;
      const etapaMap = new Map<string, { valor: number; ordem: number }>();
      pipeRows.forEach((r) => {
        const stg = r.pipeline_stages;
        if (!stg) return;
        const nome = stg.nome ?? stg.codigo ?? "—";
        const cur = etapaMap.get(nome) ?? { valor: 0, ordem: stg.ordem ?? 0 };
        cur.valor += 1;
        cur.ordem = stg.ordem ?? cur.ordem;
        etapaMap.set(nome, cur);
      });
      const clientesPorEtapa = etapaMap.size
        ? {
            titulo: "Clientes por etapa da esteira",
            subtitulo: "Distribuição atual do CRM",
            dados: [...etapaMap.entries()]
              .sort((a, b) => a[1].ordem - b[1].ordem)
              .map(([label, v]) => ({ label, valor: v.valor })),
          }
        : undefined;

      // Top operadores por contratos emitidos (apenas visão ampliada)
      let topOperadores: PanelDistribuicao | undefined;
      if (data.escopo !== "minha" && !data.responsavel) {
        const opMap = new Map<string, number>();
        rowsBrutas
          .filter((p) => CONTRATO_STATUS.has(p.status) && dentroPeriodo(p.contrato_emitido_em))
          .forEach((p) => {
            const uid = p.usuario_responsavel_id ?? "—";
            opMap.set(uid, (opMap.get(uid) ?? 0) + 1);
          });
        if (opMap.size) {
          const ids = [...opMap.keys()].filter((k) => k !== "—");
          const nomes = new Map<string, string>();
          if (ids.length) {
            const pr = await supabase.from("profiles").select("user_id,nome").in("user_id", ids);
            (pr.data ?? []).forEach((u: any) => nomes.set(u.user_id, u.nome ?? "Usuário"));
          }
          topOperadores = {
            titulo: "Top operadores",
            subtitulo: "Contratos emitidos no período",
            dados: [...opMap.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([id, valor]) => ({ label: nomes.get(id) ?? "—", valor })),
          };
        }
      }

      return {
        heros: [
          { label: "Simulações", valor: int(simCount), hint: brlCompacto(volumeSimulado), tone: "neutral", delta: mkDelta(simCount, ant.simCount) },
          { label: "Propostas enviadas", valor: int(enviadas.length), tone: "brand", delta: mkDelta(enviadas.length, ant.enviadas) },
          {
            label: "Aprovadas",
            valor: int(aprovadasCount),
            hint: `${pct(taxa)} de aprovação`,
            tone: aprovadasCount ? "success" : "neutral",
            delta: mkDelta(aprovadasCount, ant.aprovadas),
          },
          {
            label: "Recusadas",
            valor: int(recusadasCount),
            hint: `${enviadas.length ? pct((recusadasCount / enviadas.length) * 100) : pct(0)} de recusa`,
            tone: recusadasCount ? "danger" : "neutral",
            delta: mkDelta(recusadasCount, ant.recusadas, false),
          },
          { label: "Contratos emitidos", valor: int(contratosCount), hint: brlCompacto(volume), tone: "success", delta: mkDelta(contratosCount, ant.contratos) },
        ],
        minis: [
          { label: "Volume contratado", valor: brlCompacto(volume), tone: "success" },
          { label: "Volume simulado", valor: brlCompacto(volumeSimulado), tone: "neutral" },
          { label: "Ticket médio", valor: brlCompacto(ticket), tone: "brand" },
          { label: "Conversão sim→contrato", valor: pct(conversao), tone: "success" },
          {
            label: "Em análise",
            valor: int(
              enviadas.filter((p) => ["enviada_banco", "em_analise_credito"].includes(p.status)).length,
            ),
            tone: "warning",
          },
          { label: "Rascunhos", valor: int(rows.length - enviadas.length), tone: "neutral" },
          { label: "Clientes novos", valor: int(clientesNovos), tone: "brand" },
          { label: "Demandas abertas", valor: int(demAbertas.length), tone: "warning" },
          { label: "SLA vencido", valor: int(demVencidas.length), tone: demVencidas.length ? "danger" : "neutral" },
          { label: "Tarefas abertas", valor: int(tkAbertas.length), tone: "neutral" },
          { label: "Tarefas atrasadas", valor: int(tkAtrasadas.length), tone: tkAtrasadas.length ? "danger" : "neutral" },
          { label: "Volume aprovado", valor: brlCompacto(volumeAprovado), tone: "brand" },
        ],
        evolucao: {
          titulo: "Evolução do período",
          subtitulo: "Propostas enviadas e contratos emitidos",
          serie1: "Propostas",
          serie2: "Contratos",
          dados: evoDados,
        },
        funil: {
          titulo: "Funil de conversão",
          etapas: [
            { label: "Simulações", valor: simCount },
            { label: "Propostas enviadas", valor: enviadas.length },
            { label: "Aprovações", valor: aprovadasCount },
            { label: "Contratos emitidos", valor: contratosCount },
          ],
        },
        chart: {
          titulo: chartPorBanco ? "Ranking de bancos" : "Simulações por status",
          subtitulo: chartPorBanco ? "Propostas enviadas" : "Movimento das simulações",
          dados: chartDados,
          porBanco: chartPorBanco,
        },
        distribuicao: distDados.length
          ? { titulo: "Distribuição de propostas", subtitulo: "Por status", dados: distDados }
          : undefined,
        ranking: {
          titulo: chartPorBanco ? "Bancos" : "Status das simulações",
          itens: chartDados.slice(0, 6).map((i) => ({
            ...i,
            label: chartPorBanco ? i.label : rotularStatus(i.label, SIM_LABEL),
          })),
        },
        recusadasPorBanco: recusadasBancoMap.size
          ? { titulo: "Recusadas por banco", itens: topItens(recusadasBancoMap, 8) }
          : undefined,
        porTipoSimulacao,
        clientesPorEtapa,
        topOperadores,
        volumePorBanco,
        financeiroResumo:
          aReceber || aPagar || comissoesPrevistas
            ? {
                titulo: "Financeiro em aberto",
                itens: [
                  { label: "A receber", valor: brlCompacto(aReceber), tone: "success" },
                  { label: "A pagar", valor: brlCompacto(aPagar), tone: "warning" },
                  { label: "Repasses previstos", valor: brlCompacto(comissoesPrevistas), tone: "brand" },
                ],
              }
            : undefined,
        alertas: [
          ...(simErro
            ? [{ tone: "danger" as const, titulo: "Simulações com erro", descricao: "Requerem revisão antes de avançar", contador: simErro }]
            : []),
          ...(demVencidas.length
            ? [{ tone: "danger" as const, titulo: "Demandas com SLA vencido", descricao: "Requerem ação imediata", contador: demVencidas.length }]
            : []),
          ...(tkAtrasadas.length
            ? [{ tone: "warning" as const, titulo: "Tarefas atrasadas", descricao: "Prazo ultrapassado", contador: tkAtrasadas.length }]
            : []),
        ],
      };
    }

    // operacional
    const [sims, props, dem, tk, contratosInfo, ant] = await Promise.all([
      escopoEq(
        supabase
          .from("simulacoes")
          .select("status,valor_financiamento,created_at")
          .is("deleted_at", null)
          .gte("created_at", de)
          .lte("created_at", ateFim)
          .limit(5000),
        "usuario_responsavel_id",
        "usuario_criador_id",
        "@cli:cliente_id",
      ),
      escopoEq(
        supabase
          .from("propostas")
          .select(
            "status,valor_financiamento_aprovado,valor_financiamento,nome_banco,created_at,contrato_emitido_em",
          )
          .is("deleted_at", null)
          .or(
            `and(created_at.gte.${de},created_at.lte.${ateFim}),and(contrato_emitido_em.gte.${de},contrato_emitido_em.lte.${ateFim})`,
          )
          .limit(5000),
        "usuario_responsavel_id",
        "usuario_criador_id",
        "@cli:cliente_id",
      ),
      escopoEq(
        supabase
          .from("demandas")
          .select("status,prazo_sla,titulo,id")
          .gte("created_at", de)
          .lte("created_at", ateFim)
          .limit(5000),
        "responsavel_id",
        "criador_id",
        "@cli:cliente_id",
      ),
      escopoEq(
        supabase
          .from("tasks")
          .select("status,prazo,id")
          .gte("created_at", de)
          .lte("created_at", ateFim)
          .limit(5000),
        "responsavel_id",
        "criador_id",
        "@cli:cliente_id",
      ),
      carregarContratosCliente(supabase, escopoEq, de, ate),
      carregarAnterior(supabase, escopoEq, de, ate),
    ]);
    if (sims.error) throw new Error(sims.error.message);
    if (props.error) throw new Error(props.error.message);
    if (dem.error) throw new Error(dem.error.message);
    if (tk.error) throw new Error(tk.error.message);

    const simRows = (sims.data ?? []) as any[];
    const propRowsBrutas = (props.data ?? []) as any[];
    // Propostas criadas no período (base das métricas por criação).
    const propRows = propRowsBrutas.filter((p) => dentroPeriodo(p.created_at));
    const demRows = (dem.data ?? []) as any[];
    const tkRows = (tk.data ?? []) as any[];
    const agora = new Date();
    const enviadas = propRows.filter((p) => p.status !== "rascunho");
    const simConcluidasRows = simRows.filter((s) =>
      ["simulada", "parcialmente_simulada", "promovida"].includes(s.status),
    );
    const simConcluidas = simConcluidasRows.length;
    const simErro = simRows.filter((s) => s.status === "erro_banco").length;
    // Contratos emitidos vêm da ficha do cliente (contrato_emitido_em).
    const contratos = contratosInfo.count;
    const volumeContratos = contratosInfo.volume;
    // Aprovação é somente crédito aprovado na proposta/simulação bancária.
    // Contrato emitido permanece separado para não gerar taxa falsa de 100%.
    const aprovadas = propRowsBrutas.filter(
      (p) => foiAprovada(p.status) && dentroPeriodo(p.created_at),
    ).length;

    const demAbertas = demRows.filter((d) => !["concluida", "cancelada"].includes(d.status));
    const demVencidas = demAbertas.filter((d) => d.prazo_sla && new Date(d.prazo_sla) < agora);
    const tkAbertas = tkRows.filter((t) => !["concluida", "cancelada"].includes(t.status));
    const tkAtrasadas = tkRows.filter(
      (t) => !["concluida", "cancelada"].includes(t.status) && t.prazo && new Date(t.prazo) < agora,
    );
    const taxa = enviadas.length ? (aprovadas / enviadas.length) * 100 : 0;

    // Métricas operacionais complementares
    const emAnalise = enviadas.filter((p) =>
      ["enviada_banco", "em_analise_credito"].includes(p.status),
    ).length;
    const recusadas = propRows.filter((p) => p.status === "credito_recusado").length;
    const rascunhos = propRows.length - enviadas.length;
    // Volume simulado: apenas simulações efetivamente simuladas (com retorno).
    const volumeSimulado = simConcluidasRows.reduce(
      (s, r) => s + (r.valor_financiamento ?? 0),
      0,
    );
    const ticket = contratos ? volumeContratos / contratos : 0;
    const convSimProp = simRows.length ? (enviadas.length / simRows.length) * 100 : 0;
    const convPropContrato = enviadas.length ? (contratos / enviadas.length) * 100 : 0;
    const slaEmDia = demAbertas.length
      ? ((demAbertas.length - demVencidas.length) / demAbertas.length) * 100
      : 100;
    const demConcluidas = demRows.filter((d) => d.status === "concluida").length;
    const tkConcluidas = tkRows.filter((t) => t.status === "concluida").length;
    const taxaConclusaoTarefas = tkRows.length ? (tkConcluidas / tkRows.length) * 100 : 0;

    const statusMap = new Map<string, number>();
    propRows.forEach((p) => statusMap.set(p.status, (statusMap.get(p.status) ?? 0) + 1));
    const simStatusMap = new Map<string, number>();
    simRows.forEach((s) =>
      simStatusMap.set(s.status ?? "—", (simStatusMap.get(s.status ?? "—") ?? 0) + 1),
    );
    const chartDados = [
      { label: "Simulações", valor: simRows.length },
      { label: "Concluídas", valor: simConcluidas },
      { label: "Propostas", valor: enviadas.length },
      { label: "Aprovadas", valor: aprovadas },
      { label: "Contratos", valor: contratos },
    ];

    // Distribuição (donut) — status de propostas (ou simulações se não houver)
    const distMapa = statusMap.size ? statusMap : simStatusMap;
    const distLabelMap = statusMap.size ? PROP_LABEL : SIM_LABEL;
    const distDados = [...distMapa.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([s, v]) => ({ label: rotularStatus(s, distLabelMap), valor: v }));

    // Recusadas por banco — cor/nome do banco + quantidade
    const recusadasBancoMap = new Map<string, number>();
    propRows
      .filter((p) => p.status === "credito_recusado")
      .forEach((p) =>
        recusadasBancoMap.set(
          p.nome_banco ?? "—",
          (recusadasBancoMap.get(p.nome_banco ?? "—") ?? 0) + 1,
        ),
      );

    // Evolução — simulações x propostas ao longo do tempo
    const simBucket = contarPorBucket(simRows, buckets);
    const propBucket = contarPorBucket(enviadas, buckets);
    const evoDados: PanelSerie[] = buckets.chaves.map((k) => ({
      label: buckets.rotulo(k),
      valor: simBucket.get(k) ?? 0,
      valor2: propBucket.get(k) ?? 0,
    }));

    const alertas: PanelAlert[] = [];
    if (simErro)
      alertas.push({
        tone: "danger",
        titulo: "Simulações com erro",
        descricao: "Revisar retorno da integração bancária",
        contador: simErro,
      });
    if (demVencidas.length)
      alertas.push({
        tone: "danger",
        titulo: "Demandas com SLA vencido",
        descricao: "Requerem ação imediata",
        contador: demVencidas.length,
      });
    if (tkAtrasadas.length)
      alertas.push({
        tone: "warning",
        titulo: "Tarefas atrasadas",
        descricao: "Prazo ultrapassado",
        contador: tkAtrasadas.length,
      });

    return {
      heros: [
        {
          label: "Simulações",
          valor: int(simRows.length),
          hint: `${int(simConcluidas)} concluídas · ${brlCompacto(volumeSimulado)}`,
          tone: "neutral",
          delta: mkDelta(simRows.length, ant.simCount),
        },
        {
          label: "Propostas ativas",
          valor: int(enviadas.length),
          hint: `${int(emAnalise)} em análise`,
          tone: "brand",
          delta: mkDelta(enviadas.length, ant.enviadas),
        },
        {
          label: "Taxa de aprovação",
          valor: pct(taxa),
          hint: `${aprovadas} aprovadas · ${recusadas} recusadas`,
          tone: aprovadas ? "success" : "neutral",
          delta: mkDelta(taxa, ant.taxa),
        },
        {
          label: "Contratos emitidos",
          valor: int(contratos),
          hint: `${brlCompacto(volumeContratos)} · ticket ${brlCompacto(ticket)}`,
          tone: "success",
          delta: mkDelta(contratos, ant.contratos),
        },
      ],
      minis: [
        { label: "Volume contratado", valor: brlCompacto(volumeContratos), tone: "success" },
        { label: "Ticket médio", valor: brlCompacto(ticket), tone: "brand" },
        { label: "Conversão sim→proposta", valor: pct(convSimProp), tone: "brand" },
        { label: "Conversão proposta→contrato", valor: pct(convPropContrato), tone: "success" },
        { label: "Rascunhos", valor: int(rascunhos), tone: "neutral" },
        {
          label: "SLA em dia",
          valor: pct(slaEmDia),
          tone: slaEmDia >= 90 ? "success" : slaEmDia >= 70 ? "warning" : "danger",
        },
        { label: "Demandas abertas", valor: int(demAbertas.length), tone: "warning" },
        { label: "SLA vencido", valor: int(demVencidas.length), tone: demVencidas.length ? "danger" : "neutral" },
        { label: "Tarefas abertas", valor: int(tkAbertas.length), tone: "neutral" },
        { label: "Tarefas atrasadas", valor: int(tkAtrasadas.length), tone: tkAtrasadas.length ? "danger" : "neutral" },
        { label: "Conclusão de tarefas", valor: pct(taxaConclusaoTarefas), tone: "success" },
      ],
      evolucao: {
        titulo: "Evolução do período",
        subtitulo: "Simulações e propostas ao longo do tempo",
        serie1: "Simulações",
        serie2: "Propostas",
        dados: evoDados,
      },
      chart: {
        titulo: "Funil operacional",
        subtitulo: "Simulações → propostas → contratos",
        dados: chartDados,
      },
      distribuicao: distDados.length
        ? {
            titulo: statusMap.size ? "Distribuição de propostas" : "Distribuição de simulações",
            subtitulo: "Por status",
            dados: distDados,
          }
        : undefined,
      ranking: {
        titulo: statusMap.size ? "Status de propostas" : "Status de simulações",
        itens: (statusMap.size ? topItens(statusMap, 6) : topItens(simStatusMap, 6)).map((i) => ({
          ...i,
          label: rotularStatus(i.label, statusMap.size ? PROP_LABEL : SIM_LABEL),
        })),
      },
      recusadasPorBanco: recusadasBancoMap.size
        ? { titulo: "Recusadas por banco", itens: topItens(recusadasBancoMap, 8) }
        : undefined,
      alertas,
    };
  });

// ============================================================================
// Drilldown de KPIs — "clique no card para ver o detalhamento".
// ============================================================================

export interface PanelDrilldownItem {
  label: string;
  sub?: string;
  valor?: string;
  data?: string;
  to?: string;
  tone?: "brand" | "success" | "warning" | "danger" | "neutral";
  banco?: string;
}

export interface PanelDrilldown {
  titulo: string;
  subtitulo?: string;
  valor?: string;
  descricao?: string;
  formula?: { label: string; valor: string; tone?: "brand" | "success" | "warning" | "danger" | "neutral" }[];
  itens: PanelDrilldownItem[];
  total?: string;
  linkAbrir?: string;
  linkAbrirLabel?: string;
}

const drillSchema = schema.extend({ metrica: z.string().min(1).max(80) });

function normLabel(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[→↦]/g, ">")
    .toLowerCase()
    .trim();
}

const fmtData = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";

function itemProposta(p: any): PanelDrilldownItem {
  const cliente = (p.clientes?.nome as string | undefined) ?? "Cliente";
  const banco = (p.nome_banco as string | undefined) ?? "";
  const status = rotularStatus((p.status as string) ?? "", PROP_LABEL);
  const numero = (p.numero_proposta as string | undefined) ?? "";
  const partes = [numero && `Nº ${numero}`, status].filter(Boolean);
  const valorNum = Number(p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0) || 0;
  return {
    label: cliente,
    sub: partes.join(" · "),
    banco: banco || undefined,
    valor: valorNum ? brlCompacto(valorNum) : undefined,
    data: fmtData(p.contrato_emitido_em ?? p.created_at),
    to: `/operacional/propostas/${p.id}`,
  };
}

function itemSimulacao(s: any): PanelDrilldownItem {
  const cliente = (s.clientes?.nome as string | undefined) ?? "Cliente";
  const status = rotularStatus((s.status as string) ?? "", SIM_LABEL);
  const numero = (s.numero_simulacao as string | undefined) ?? "";
  const partes = [numero && `Nº ${numero}`, status].filter(Boolean);
  const valorNum = Number(s.valor_financiamento ?? 0) || 0;
  const bancos = (s.simulacao_bancos ?? []) as any[];
  const bancoPref =
    bancos.find((b) => b?.selecionado) ??
    bancos.find((b) => b?.status_banco === "simulada") ??
    bancos[0];
  const banco = (bancoPref?.nome_banco as string | undefined) ?? undefined;
  return {
    label: cliente,
    sub: partes.join(" · "),
    banco,
    valor: valorNum ? brlCompacto(valorNum) : undefined,
    data: fmtData(s.created_at),
    to: `/operacional/simulacoes/${s.id}`,
  };
}

export const getPanelDrilldown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => drillSchema.parse(d))
  .handler(async ({ data, context }): Promise<PanelDrilldown> => {
    const { supabase, userId } = context;
    const f = data as unknown as ReportFiltros;
    const { de, ate } = resolverIntervalo(f);
    const ateFim = `${ate}T23:59:59`;
    const partnerClienteIds =
      data.escopo === "minha" && !data.responsavel
        ? await listarClienteIdsParceiroDoUsuario(supabase, userId)
        : [];
    const escopoEq = criarEscopoEq({
      userId,
      escopo: data.escopo,
      responsavel: data.responsavel,
      partnerClienteIds,
    });

    const dentroPeriodo = (iso?: string | null) =>
      !!iso && iso.slice(0, 10) >= de && iso.slice(0, 10) <= ate;

    const chave = normLabel(data.metrica);
    const LIMITE = 200;

    async function propostasNoPeriodo(): Promise<any[]> {
      const res = await escopoEq(
        supabase
          .from("propostas")
          .select(
            "id,numero_proposta,status,nome_banco,valor_financiamento,valor_financiamento_aprovado,created_at,contrato_emitido_em,clientes(nome)",
          )
          .is("deleted_at", null)
          .or(
            `and(created_at.gte.${de},created_at.lte.${ateFim}),and(contrato_emitido_em.gte.${de},contrato_emitido_em.lte.${ateFim})`,
          )
          .order("created_at", { ascending: false })
          .limit(LIMITE * 2),
        "usuario_responsavel_id",
        "usuario_criador_id",
        "@cli:cliente_id",
      );
      if (res.error) throw new Error(res.error.message);
      return (res.data ?? []) as any[];
    }
    async function simulacoesNoPeriodo(): Promise<any[]> {
      const res = await escopoEq(
        supabase
          .from("simulacoes")
          .select(
            "id,numero_simulacao,status,valor_financiamento,created_at,clientes(nome),simulacao_bancos(nome_banco,selecionado,status_banco)",
          )
          .is("deleted_at", null)
          .gte("created_at", de)
          .lte("created_at", ateFim)
          .order("created_at", { ascending: false })
          .limit(LIMITE),
        "usuario_responsavel_id",
        "usuario_criador_id",
        "@cli:cliente_id",
      );
      if (res.error) throw new Error(res.error.message);
      return (res.data ?? []) as any[];
    }
    async function contratosDetalhados(): Promise<{ cliente: any; prop: any }[]> {
      const cliRes = await escopoEq(
        supabase
          .from("clientes")
          .select("id,nome,contrato_emitido_em,imovel_valor")
          .not("contrato_emitido_em", "is", null)
          .gte("contrato_emitido_em", de)
          .lte("contrato_emitido_em", ate)
          .order("contrato_emitido_em", { ascending: false })
          .limit(LIMITE),
        "responsavel_id",
        "criador_id",
        "@cli:id",
      );
      if (cliRes.error) throw new Error(cliRes.error.message);
      const cliRows = (cliRes.data ?? []) as any[];
      if (!cliRows.length) return [];
      const ids = cliRows.map((c) => c.id);
      const propRes = await supabase
        .from("propostas")
        .select("id,cliente_id,status,nome_banco,valor_financiamento_aprovado,valor_financiamento,numero_proposta")
        .in("cliente_id", ids)
        .in("status", Array.from(CONTRATO_STATUS) as any)
        .is("deleted_at", null);
      const propByCli = new Map<string, any>();
      for (const p of ((propRes.data ?? []) as any[])) {
        if (!propByCli.has(p.cliente_id)) propByCli.set(p.cliente_id, p);
      }
      return cliRows
        .filter((c) => propByCli.has(c.id))
        .map((c) => ({ cliente: c, prop: propByCli.get(c.id) }));
    }

    if (chave === "simulacoes") {
      const rows = await simulacoesNoPeriodo();
      const somaValor = rows.reduce((s, r) => s + (Number(r.valor_financiamento) || 0), 0);
      return {
        titulo: "Simulações do período",
        subtitulo: "Ordenadas da mais recente para a mais antiga",
        valor: int(rows.length),
        descricao: `Volume total simulado: ${brlCompacto(somaValor)}.`,
        itens: rows.map(itemSimulacao),
        linkAbrir: "/operacional/simulacoes",
        linkAbrirLabel: "Abrir lista completa de simulações",
      };
    }

    if (chave === "volume simulado") {
      const rows = (await simulacoesNoPeriodo()).filter((s) =>
        ["simulada", "parcialmente_simulada", "promovida"].includes(s.status),
      );
      const soma = rows.reduce((s, r) => s + (Number(r.valor_financiamento) || 0), 0);
      return {
        titulo: "Volume simulado",
        subtitulo: "Simulações concluídas com retorno do banco",
        valor: brlCompacto(soma),
        descricao: `${int(rows.length)} simulações somam ${brlCompacto(soma)} em crédito simulado.`,
        itens: rows
          .sort((a, b) => (Number(b.valor_financiamento) || 0) - (Number(a.valor_financiamento) || 0))
          .map(itemSimulacao),
        total: brlCompacto(soma),
        linkAbrir: "/operacional/simulacoes",
        linkAbrirLabel: "Abrir lista completa de simulações",
      };
    }

    if (chave === "propostas enviadas" || chave === "propostas ativas" || chave === "propostas") {
      const rows = (await propostasNoPeriodo()).filter(
        (p) => dentroPeriodo(p.created_at) && p.status !== "rascunho",
      );
      return {
        titulo: chave === "propostas ativas" ? "Propostas ativas" : "Propostas enviadas",
        subtitulo: "Criadas no período (excluindo rascunhos)",
        valor: int(rows.length),
        itens: rows.map(itemProposta),
        linkAbrir: "/operacional/propostas",
        linkAbrirLabel: "Abrir lista completa de propostas",
      };
    }

    if (chave === "aprovadas") {
      const rows = (await propostasNoPeriodo()).filter(
        (p) => dentroPeriodo(p.created_at) && foiAprovada(p.status),
      );
      return {
        titulo: "Propostas aprovadas",
        subtitulo: "Crédito aprovado pelo banco no período",
        valor: int(rows.length),
        itens: rows.map(itemProposta),
        linkAbrir: "/operacional/propostas",
        linkAbrirLabel: "Abrir lista completa de propostas",
      };
    }

    if (chave === "recusadas") {
      const rows = (await propostasNoPeriodo()).filter(
        (p) => dentroPeriodo(p.created_at) && p.status === "credito_recusado",
      );
      return {
        titulo: "Propostas recusadas",
        subtitulo: "Crédito reprovado pelo banco no período",
        valor: int(rows.length),
        itens: rows.map(itemProposta),
        linkAbrir: "/operacional/propostas",
        linkAbrirLabel: "Abrir lista completa de propostas",
      };
    }

    if (chave === "em analise") {
      const rows = (await propostasNoPeriodo()).filter(
        (p) =>
          dentroPeriodo(p.created_at) &&
          ["enviada_banco", "em_analise_credito"].includes(p.status),
      );
      return {
        titulo: "Em análise no banco",
        subtitulo: "Propostas enviadas aguardando retorno",
        valor: int(rows.length),
        itens: rows.map(itemProposta),
        linkAbrir: "/operacional/propostas",
        linkAbrirLabel: "Abrir lista completa de propostas",
      };
    }

    if (chave === "rascunhos") {
      const rows = (await propostasNoPeriodo()).filter(
        (p) => dentroPeriodo(p.created_at) && p.status === "rascunho",
      );
      return {
        titulo: "Rascunhos",
        subtitulo: "Propostas ainda não enviadas ao banco",
        valor: int(rows.length),
        itens: rows.map(itemProposta),
        linkAbrir: "/operacional/propostas",
        linkAbrirLabel: "Abrir lista completa de propostas",
      };
    }

    if (chave === "contratos emitidos" || chave === "volume contratado") {
      const detalhes = await contratosDetalhados();
      const somaBruta = detalhes.reduce(
        (s, { cliente, prop }) =>
          s +
          (Number(
            cliente.imovel_valor ?? prop.valor_financiamento_aprovado ?? prop.valor_financiamento ?? 0,
          ) || 0),
        0,
      );
      const linhas: PanelDrilldownItem[] = detalhes.map(({ cliente, prop }) => {
        const valorNum =
          Number(
            cliente.imovel_valor ?? prop.valor_financiamento_aprovado ?? prop.valor_financiamento ?? 0,
          ) || 0;
        return {
          label: cliente.nome ?? "Cliente",
          sub: prop.numero_proposta ? `Nº ${prop.numero_proposta}` : undefined,
          banco: prop.nome_banco ?? undefined,
          valor: valorNum ? brlCompacto(valorNum) : undefined,
          data: fmtData(cliente.contrato_emitido_em),
          to: `/operacional/propostas/${prop.id}`,
        };
      });
      return {
        titulo: chave === "volume contratado" ? "Volume contratado" : "Contratos emitidos",
        subtitulo: "Contratos com data de emissão no período",
        valor: chave === "volume contratado" ? brlCompacto(somaBruta) : int(linhas.length),
        descricao: `${int(linhas.length)} contrato(s) · ${brlCompacto(somaBruta)} de volume`,
        itens: linhas,
        total: brlCompacto(somaBruta),
        linkAbrir: "/operacional/propostas",
        linkAbrirLabel: "Abrir propostas contratadas",
      };
    }

    if (chave === "volume aprovado") {
      const rows = (await propostasNoPeriodo()).filter(
        (p) => dentroPeriodo(p.created_at) && foiAprovada(p.status),
      );
      const soma = rows.reduce(
        (s, p) => s + (Number(p.valor_financiamento_aprovado ?? p.valor_financiamento) || 0),
        0,
      );
      return {
        titulo: "Volume aprovado",
        subtitulo: "Somatório do crédito aprovado no período",
        valor: brlCompacto(soma),
        descricao: `${int(rows.length)} proposta(s) aprovada(s).`,
        itens: rows
          .sort(
            (a, b) =>
              (Number(b.valor_financiamento_aprovado ?? b.valor_financiamento) || 0) -
              (Number(a.valor_financiamento_aprovado ?? a.valor_financiamento) || 0),
          )
          .map(itemProposta),
        total: brlCompacto(soma),
        linkAbrir: "/operacional/propostas",
      };
    }

    if (chave === "ticket medio") {
      const detalhes = await contratosDetalhados();
      const soma = detalhes.reduce(
        (s, { cliente, prop }) =>
          s +
          (Number(
            cliente.imovel_valor ?? prop.valor_financiamento_aprovado ?? prop.valor_financiamento ?? 0,
          ) || 0),
        0,
      );
      const qtd = detalhes.length;
      const ticket = qtd ? soma / qtd : 0;
      return {
        titulo: "Ticket médio",
        subtitulo: "Volume contratado ÷ contratos emitidos",
        valor: brlCompacto(ticket),
        formula: [
          { label: "Volume contratado", valor: brlCompacto(soma), tone: "success" },
          { label: "Contratos emitidos", valor: int(qtd), tone: "brand" },
          { label: "Ticket médio", valor: brlCompacto(ticket), tone: "success" },
        ],
        itens: detalhes.map(({ cliente, prop }) => {
          const valorNum =
            Number(
              cliente.imovel_valor ?? prop.valor_financiamento_aprovado ?? prop.valor_financiamento ?? 0,
            ) || 0;
          return {
            label: cliente.nome ?? "Cliente",
            sub: prop.numero_proposta ? `Nº ${prop.numero_proposta}` : undefined,
            banco: prop.nome_banco ?? undefined,
            valor: valorNum ? brlCompacto(valorNum) : undefined,
            data: fmtData(cliente.contrato_emitido_em),
            to: `/operacional/propostas/${prop.id}`,
          };
        }),
        linkAbrir: "/operacional/propostas",
      };
    }

    if (
      chave === "conversao sim>contrato" ||
      chave === "conversao sim>proposta" ||
      chave === "conversao proposta>contrato" ||
      chave === "taxa de aprovacao"
    ) {
      const [sims, props, contratos] = await Promise.all([
        simulacoesNoPeriodo(),
        propostasNoPeriodo(),
        contratosDetalhados(),
      ]);
      const enviadas = props.filter(
        (p) => dentroPeriodo(p.created_at) && p.status !== "rascunho",
      );
      const aprovadas = props.filter(
        (p) => dentroPeriodo(p.created_at) && foiAprovada(p.status),
      ).length;
      const qtdContratos = contratos.length;
      let num = 0;
      let den = 0;
      let titulo = "";
      let numLabel = "";
      let denLabel = "";
      if (chave === "conversao sim>contrato") {
        num = qtdContratos;
        den = sims.length;
        titulo = "Conversão simulação → contrato";
        numLabel = "Contratos emitidos";
        denLabel = "Simulações";
      } else if (chave === "conversao sim>proposta") {
        num = enviadas.length;
        den = sims.length;
        titulo = "Conversão simulação → proposta";
        numLabel = "Propostas enviadas";
        denLabel = "Simulações";
      } else if (chave === "conversao proposta>contrato") {
        num = qtdContratos;
        den = enviadas.length;
        titulo = "Conversão proposta → contrato";
        numLabel = "Contratos emitidos";
        denLabel = "Propostas enviadas";
      } else {
        num = aprovadas;
        den = enviadas.length;
        titulo = "Taxa de aprovação";
        numLabel = "Aprovadas";
        denLabel = "Propostas enviadas";
      }
      const taxa = den ? (num / den) * 100 : 0;
      return {
        titulo,
        subtitulo: `${numLabel} ÷ ${denLabel}`,
        valor: pct(taxa),
        formula: [
          { label: numLabel, valor: int(num), tone: "success" },
          { label: denLabel, valor: int(den), tone: "brand" },
          { label: "Resultado", valor: pct(taxa), tone: taxa >= 50 ? "success" : "warning" },
        ],
        itens: [],
        descricao:
          den === 0
            ? "Sem base para calcular a conversão no período selecionado."
            : "Aumente o numerador ou revise a base para elevar a conversão.",
      };
    }

    if (chave === "clientes novos") {
      const res = await escopoEq(
        supabase
          .from("clientes")
          .select("id,nome,documento,created_at,telefone_celular")
          .gte("created_at", de)
          .lte("created_at", ateFim)
          .order("created_at", { ascending: false })
          .limit(LIMITE),
        "responsavel_id",
        "criador_id",
        "@cli:id",
      );
      if (res.error) throw new Error(res.error.message);
      const rows = (res.data ?? []) as any[];
      return {
        titulo: "Clientes novos",
        subtitulo: "Cadastrados no período",
        valor: int(rows.length),
        itens: rows.map((c) => ({
          label: c.nome ?? "Cliente",
          sub: [c.documento, c.telefone_celular].filter(Boolean).join(" · "),
          data: fmtData(c.created_at),
          to: `/crm/clientes/${c.id}`,
        })),
        linkAbrir: "/crm/clientes",
        linkAbrirLabel: "Abrir lista de clientes",
      };
    }

    if (chave === "demandas abertas" || chave === "sla vencido") {
      const res = await escopoEq(
        supabase
          .from("demandas")
          .select("id,numero,titulo,status,prazo_sla,created_at")
          .limit(LIMITE * 2),
        "responsavel_id",
        "criador_id",
        "@cli:cliente_id",
      );
      if (res.error) throw new Error(res.error.message);
      const agora = new Date();
      let rows = ((res.data ?? []) as any[]).filter(
        (d) => !["concluida", "cancelada"].includes(d.status),
      );
      const isVencido = chave === "sla vencido";
      const titulo = isVencido ? "Demandas com SLA vencido" : "Demandas abertas";
      if (isVencido) rows = rows.filter((d) => d.prazo_sla && new Date(d.prazo_sla) < agora);
      return {
        titulo,
        subtitulo: isVencido
          ? "Prazo de atendimento já ultrapassado"
          : "Ainda não concluídas ou canceladas",
        valor: int(rows.length),
        itens: rows.map((d) => ({
          label: d.titulo ?? "Demanda",
          sub: [d.numero && `Nº ${d.numero}`, d.status].filter(Boolean).join(" · "),
          data: fmtData(d.prazo_sla ?? d.created_at),
          to: `/operacional/demandas/${d.id}`,
          tone: isVencido ? "danger" : "warning",
        })),
        linkAbrir: "/operacional/demandas",
        linkAbrirLabel: "Abrir lista de demandas",
      };
    }

    if (chave === "tarefas abertas" || chave === "tarefas atrasadas") {
      const res = await escopoEq(
        supabase
          .from("tasks")
          .select("id,numero,titulo,status,prazo,created_at")
          .limit(LIMITE * 2),
        "responsavel_id",
        "criador_id",
        "@cli:cliente_id",
      );
      if (res.error) throw new Error(res.error.message);
      const agora = new Date();
      let rows = ((res.data ?? []) as any[]).filter(
        (t) => !["concluida", "cancelada"].includes(t.status),
      );
      const atrasadas = chave === "tarefas atrasadas";
      if (atrasadas) rows = rows.filter((t) => t.prazo && new Date(t.prazo) < agora);
      return {
        titulo: atrasadas ? "Tarefas atrasadas" : "Tarefas abertas",
        subtitulo: atrasadas ? "Prazo ultrapassado" : "Ainda não concluídas",
        valor: int(rows.length),
        itens: rows.map((t) => ({
          label: t.titulo ?? "Tarefa",
          sub: [t.numero && `Nº ${t.numero}`, t.status].filter(Boolean).join(" · "),
          data: fmtData(t.prazo ?? t.created_at),
          to: `/operacional/tarefas/${t.id}`,
          tone: atrasadas ? "danger" : "neutral",
        })),
        linkAbrir: "/operacional/tarefas",
        linkAbrirLabel: "Abrir lista de tarefas",
      };
    }

    if (chave === "sla em dia") {
      const res = await escopoEq(
        supabase
          .from("demandas")
          .select("id,numero,titulo,status,prazo_sla,created_at")
          .limit(LIMITE * 2),
        "responsavel_id",
        "criador_id",
        "@cli:cliente_id",
      );
      if (res.error) throw new Error(res.error.message);
      const agora = new Date();
      const abertas = ((res.data ?? []) as any[]).filter(
        (d) => !["concluida", "cancelada"].includes(d.status),
      );
      const vencidas = abertas.filter((d) => d.prazo_sla && new Date(d.prazo_sla) < agora);
      const emDia = abertas.length - vencidas.length;
      const taxa = abertas.length ? (emDia / abertas.length) * 100 : 100;
      return {
        titulo: "SLA em dia",
        subtitulo: "(Abertas − vencidas) ÷ abertas",
        valor: pct(taxa),
        formula: [
          { label: "Demandas em dia", valor: int(emDia), tone: "success" },
          { label: "Demandas vencidas", valor: int(vencidas.length), tone: "danger" },
          { label: "Demandas abertas", valor: int(abertas.length), tone: "brand" },
          { label: "Resultado", valor: pct(taxa), tone: taxa >= 90 ? "success" : "warning" },
        ],
        itens: abertas
          .filter((d) => !vencidas.includes(d))
          .slice(0, LIMITE)
          .map((d) => ({
            label: d.titulo ?? "Demanda",
            sub: [d.numero && `Nº ${d.numero}`, d.status].filter(Boolean).join(" · "),
            data: fmtData(d.prazo_sla ?? d.created_at),
            to: `/operacional/demandas/${d.id}`,
            tone: "success",
          })),
        linkAbrir: "/operacional/demandas",
      };
    }

    if (chave === "conclusao de tarefas") {
      const res = await escopoEq(
        supabase
          .from("tasks")
          .select("id,numero,titulo,status,prazo,created_at")
          .gte("created_at", de)
          .lte("created_at", ateFim)
          .limit(LIMITE * 2),
        "responsavel_id",
        "criador_id",
        "@cli:cliente_id",
      );
      if (res.error) throw new Error(res.error.message);
      const rows = (res.data ?? []) as any[];
      const concluidas = rows.filter((t) => t.status === "concluida").length;
      const taxa = rows.length ? (concluidas / rows.length) * 100 : 0;
      return {
        titulo: "Conclusão de tarefas",
        subtitulo: "Concluídas ÷ total no período",
        valor: pct(taxa),
        formula: [
          { label: "Concluídas", valor: int(concluidas), tone: "success" },
          { label: "Total no período", valor: int(rows.length), tone: "brand" },
          { label: "Resultado", valor: pct(taxa), tone: taxa >= 80 ? "success" : "warning" },
        ],
        itens: rows.slice(0, LIMITE).map((t) => ({
          label: t.titulo ?? "Tarefa",
          sub: [t.numero && `Nº ${t.numero}`, t.status].filter(Boolean).join(" · "),
          data: fmtData(t.created_at),
          to: `/operacional/tarefas/${t.id}`,
          tone: t.status === "concluida" ? "success" : "neutral",
        })),
        linkAbrir: "/operacional/tarefas",
      };
    }

    return {
      titulo: data.metrica,
      subtitulo: "Detalhamento não disponível para este indicador",
      descricao:
        "Este KPI é calculado a partir de várias fontes e ainda não tem uma listagem específica de detalhamento. Consulte os relatórios para explorar em profundidade.",
      itens: [],
    };
  });
