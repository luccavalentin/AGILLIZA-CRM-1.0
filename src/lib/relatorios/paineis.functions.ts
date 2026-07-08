import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolverIntervalo, type ReportFiltros } from "@/lib/relatorios/shared";

const schema = z.object({
  modulo: z.enum(["visao-geral", "operacional"]),
  periodo: z.enum(["hoje", "7d", "15d", "30d", "mes", "mes_anterior", "ano", "custom"]),
  escopo: z.enum(["minha", "equipe", "geral"]),
  de: z.string().optional(),
  ate: z.string().optional(),
});

export interface PanelMetric {
  label: string;
  valor: string;
  hint?: string;
  tone?: "brand" | "success" | "warning" | "danger" | "neutral";
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

export interface PanelDados {
  heros: PanelMetric[];
  minis: PanelMetric[];
  evolucao?: PanelEvolucao;
  chart: { titulo: string; subtitulo?: string; dados: PanelSerie[]; porBanco?: boolean };
  distribuicao?: PanelDistribuicao;
  ranking: { titulo: string; itens: { label: string; valor: number }[] };
  recusadasPorBanco?: { titulo: string; itens: { label: string; valor: number }[] };
  alertas: PanelAlert[];
}

const brl = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brlCompacto = (v: number) => {
  const n = v || 0;
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}mi`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}mil`;
  return brl(n);
};
const int = (v: number) => (v || 0).toLocaleString("pt-BR");
const pct = (v: number) =>
  `${Math.min(100, Math.max(0, v || 0)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

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
      return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "short" });
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

    const escopoEq = (q: any, col: string) => (data.escopo === "minha" ? q.eq(col, userId) : q);

    if (data.modulo === "visao-geral") {
      const [sims, props] = await Promise.all([
        escopoEq(
          supabase
            .from("simulacoes")
            .select("id,status,tipo_simulacao,valor_financiamento,created_at")
            .gte("created_at", de)
            .lte("created_at", ateFim)
            .limit(5000),
          "usuario_responsavel_id",
        ),
        escopoEq(
          supabase
            .from("propostas")
            .select(
              "status,valor_financiamento_aprovado,valor_financiamento,nome_banco,created_at,contrato_emitido_em",
            )
            .or(
              `and(created_at.gte.${de},created_at.lte.${ateFim}),and(contrato_emitido_em.gte.${de},contrato_emitido_em.lte.${ateFim})`,
            )
            .limit(5000),
          "usuario_responsavel_id",
        ),
      ]);
      if (sims.error) throw new Error(sims.error.message);
      if (props.error) throw new Error(props.error.message);

      const simRows = (sims.data ?? []) as any[];
      const simCount = simRows.length;
      const rowsBrutas = (props.data ?? []) as any[];
      // Propostas cujo movimento (criação) ocorre no período.
      const rows = rowsBrutas.filter((p) => dentroPeriodo(p.created_at));
      const enviadas = rows.filter((p) => p.status !== "rascunho");
      // Aprovadas: crédito aprovado (pela criação) + contratos (pela emissão),
      // mantendo o funil monotônico (aprovadas >= contratos) e sem base mista.
      const aprovadas = rowsBrutas.filter(
        (p) =>
          (p.status === "credito_aprovado" && dentroPeriodo(p.created_at)) ||
          (["contrato_emitido", "registrado"].includes(p.status) &&
            dentroPeriodo(p.contrato_emitido_em)),
      );
      // Contratos entram pela DATA DE EMISSÃO no período (independe da criação).
      const contratos = rowsBrutas.filter(
        (p) =>
          ["contrato_emitido", "registrado"].includes(p.status) &&
          dentroPeriodo(p.contrato_emitido_em),
      );
      const simConcluidas = simRows.filter((s) =>
        ["simulada", "parcialmente_simulada", "promovida"].includes(s.status),
      ).length;
      const simErro = simRows.filter((s) => s.status === "erro_banco").length;
      const volume = contratos.reduce(
        (s, p) => s + (p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0),
        0,
      );
      const volumeSimulado = simRows.reduce((s, r) => s + (r.valor_financiamento ?? 0), 0);
      const volumeAprovado = aprovadas.reduce(
        (s, p) => s + (p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0),
        0,
      );
      const ticket = contratos.length ? volume / contratos.length : 0;
      const taxa = enviadas.length ? (aprovadas.length / enviadas.length) * 100 : 0;
      const conversao = simCount ? (contratos.length / simCount) * 100 : 0;

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
        contratos.map((p) => ({ created_at: p.contrato_emitido_em })),
        buckets,
      );
      const evoDados: PanelSerie[] = buckets.chaves.map((k) => ({
        label: buckets.rotulo(k),
        valor: propBucket.get(k) ?? 0,
        valor2: contratoBucket.get(k) ?? 0,
      }));

      return {
        heros: [
          { label: "Simulações", valor: int(simCount), hint: brlCompacto(volumeSimulado), tone: "neutral" },
          { label: "Propostas enviadas", valor: int(enviadas.length), tone: "brand" },
          { label: "Taxa de aprovação", valor: pct(taxa), hint: `${aprovadas.length} aprovadas`, tone: "success" },
          { label: "Contratos emitidos", valor: int(contratos.length), hint: brlCompacto(volume), tone: "success" },
        ],
        minis: [
          { label: "Volume contratado", valor: brlCompacto(volume), tone: "success" },
          { label: "Volume simulado", valor: brlCompacto(volumeSimulado), tone: "neutral" },
          { label: "Volume aprovado", valor: brlCompacto(volumeAprovado), tone: "success" },
          { label: "Ticket médio", valor: brlCompacto(ticket), tone: "brand" },
          { label: "Conversão sim→contrato", valor: pct(conversao), tone: "success" },
          { label: "Simulações concluídas", valor: int(simConcluidas), tone: "success" },
          { label: "Simulações com erro", valor: int(simErro), tone: simErro ? "danger" : "neutral" },
          { label: "Aprovadas", valor: int(aprovadas.length), tone: "success" },
          {
            label: "Em análise",
            valor: int(
              enviadas.filter((p) => ["enviada_banco", "em_analise_credito"].includes(p.status)).length,
            ),
            tone: "warning",
          },
          { label: "Recusadas", valor: int(enviadas.filter((p) => p.status === "credito_recusado").length), tone: "danger" },
          { label: "Rascunhos", valor: int(rows.length - enviadas.length), tone: "neutral" },
        ],
        evolucao: {
          titulo: "Evolução do período",
          subtitulo: "Propostas enviadas e contratos emitidos",
          serie1: "Propostas",
          serie2: "Contratos",
          dados: evoDados,
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
          itens: chartDados.slice(0, 6),
        },
        recusadasPorBanco: recusadasBancoMap.size
          ? { titulo: "Recusadas por banco", itens: topItens(recusadasBancoMap, 8) }
          : undefined,
        alertas: simErro
          ? [
              {
                tone: "danger",
                titulo: "Simulações com erro",
                descricao: "Requerem revisão antes de avançar",
                contador: simErro,
              },
            ]
          : [],
      };
    }

    // operacional
    const [sims, props, dem, tk] = await Promise.all([
      escopoEq(
        supabase
          .from("simulacoes")
          .select("status,valor_financiamento,created_at")
          .gte("created_at", de)
          .lte("created_at", ateFim)
          .limit(5000),
        "usuario_responsavel_id",
      ),
      escopoEq(
        supabase
          .from("propostas")
          .select(
            "status,valor_financiamento_aprovado,valor_financiamento,nome_banco,created_at,contrato_emitido_em",
          )
          .or(
            `and(created_at.gte.${de},created_at.lte.${ateFim}),and(contrato_emitido_em.gte.${de},contrato_emitido_em.lte.${ateFim})`,
          )
          .limit(5000),
        "usuario_responsavel_id",
      ),
      escopoEq(
        supabase.from("demandas").select("status,prazo_sla,titulo,id").limit(5000),
        "responsavel_id",
      ),
      escopoEq(supabase.from("tasks").select("status,prazo,id").limit(5000), "responsavel_id"),
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
    const simConcluidas = simRows.filter((s) =>
      ["simulada", "parcialmente_simulada", "promovida"].includes(s.status),
    ).length;
    const simErro = simRows.filter((s) => s.status === "erro_banco").length;
    const aprovadas = propRows.filter((p) =>
      ["credito_aprovado", "contrato_emitido", "registrado"].includes(p.status),
    ).length;
    // Contratos entram pela DATA DE EMISSÃO no período (independe da criação).
    const contratosRows = propRowsBrutas.filter(
      (p) =>
        ["contrato_emitido", "registrado"].includes(p.status) &&
        dentroPeriodo(p.contrato_emitido_em),
    );
    const contratos = contratosRows.length;
    const volumeContratos = contratosRows.reduce(
      (s, p) => s + (p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0),
      0,
    );
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
    const volumeSimulado = simRows.reduce((s, r) => s + (r.valor_financiamento ?? 0), 0);
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
        },
        {
          label: "Propostas ativas",
          valor: int(enviadas.length),
          hint: `${int(emAnalise)} em análise`,
          tone: "brand",
        },
        {
          label: "Taxa de aprovação",
          valor: pct(taxa),
          hint: `${aprovadas} aprovadas · ${recusadas} recusadas`,
          tone: "success",
        },
        {
          label: "Contratos emitidos",
          valor: int(contratos),
          hint: `${brlCompacto(volumeContratos)} · ticket ${brlCompacto(ticket)}`,
          tone: "success",
        },
      ],
      minis: [
        { label: "Volume contratado", valor: brlCompacto(volumeContratos), tone: "success" },
        { label: "Ticket médio", valor: brlCompacto(ticket), tone: "brand" },
        { label: "Conversão sim→proposta", valor: pct(convSimProp), tone: "brand" },
        { label: "Conversão proposta→contrato", valor: pct(convPropContrato), tone: "success" },
        { label: "Propostas em análise", valor: int(emAnalise), tone: "warning" },
        { label: "Recusadas", valor: int(recusadas), tone: recusadas ? "danger" : "neutral" },
        { label: "Rascunhos", valor: int(rascunhos), tone: "neutral" },
        { label: "Simulações com erro", valor: int(simErro), tone: simErro ? "danger" : "neutral" },
        {
          label: "SLA em dia",
          valor: pct(slaEmDia),
          tone: slaEmDia >= 90 ? "success" : slaEmDia >= 70 ? "warning" : "danger",
        },
        { label: "Demandas abertas", valor: int(demAbertas.length), tone: "warning" },
        { label: "SLA vencido", valor: int(demVencidas.length), tone: demVencidas.length ? "danger" : "neutral" },
        { label: "Demandas concluídas", valor: int(demConcluidas), tone: "success" },
        { label: "Tarefas abertas", valor: int(tkAbertas.length), tone: "neutral" },
        { label: "Tarefas atrasadas", valor: int(tkAtrasadas.length), tone: tkAtrasadas.length ? "danger" : "neutral" },
        { label: "Tarefas concluídas", valor: int(tkConcluidas), tone: "success" },
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
        itens: statusMap.size ? topItens(statusMap, 6) : topItens(simStatusMap, 6),
      },
      recusadasPorBanco: recusadasBancoMap.size
        ? { titulo: "Recusadas por banco", itens: topItens(recusadasBancoMap, 8) }
        : undefined,
      alertas,
    };
  });
