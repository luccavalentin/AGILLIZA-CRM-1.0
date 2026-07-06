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
}
export interface PanelAlert {
  tone: "warning" | "danger" | "success";
  titulo: string;
  descricao?: string;
  contador?: number;
}

export interface PanelDados {
  heros: PanelMetric[];
  minis: PanelMetric[];
  chart: { titulo: string; subtitulo?: string; dados: PanelSerie[]; porBanco?: boolean };
  ranking: { titulo: string; itens: { label: string; valor: number }[] };
  alertas: PanelAlert[];
}

const brl = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const int = (v: number) => (v || 0).toLocaleString("pt-BR");

function topItens(map: Map<string, number>, limite = 8) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([label, valor]) => ({ label: label || "—", valor }));
}

export const getPanelDados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof schema>) => schema.parse(d))
  .handler(async ({ data, context }): Promise<PanelDados> => {
    const { supabase, userId } = context;
    const f = data as unknown as ReportFiltros;
    const { de, ate } = resolverIntervalo(f);
    const ateFim = `${ate}T23:59:59`;

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
            .select("status,valor_financiamento_aprovado,valor_financiamento,nome_banco,created_at")
            .gte("created_at", de)
            .lte("created_at", ateFim)
            .limit(5000),
          "usuario_responsavel_id",
        ),
      ]);
      if (sims.error) throw new Error(sims.error.message);
      if (props.error) throw new Error(props.error.message);

      const simRows = (sims.data ?? []) as any[];
      const simCount = simRows.length;
      const rows = (props.data ?? []) as any[];
      const enviadas = rows.filter((p) => p.status !== "rascunho");
      const aprovadas = enviadas.filter((p) =>
        ["credito_aprovado", "contrato_emitido", "registrado"].includes(p.status),
      );
      const contratos = enviadas.filter((p) =>
        ["contrato_emitido", "registrado"].includes(p.status),
      );
      const simConcluidas = simRows.filter((s) =>
        ["simulada", "parcialmente_simulada", "promovida"].includes(s.status),
      ).length;
      const simErro = simRows.filter((s) => s.status === "erro_banco").length;
      const volume = contratos.reduce(
        (s, p) => s + (p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0),
        0,
      );
      const taxa = enviadas.length ? (aprovadas.length / enviadas.length) * 100 : 0;
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
      return {
        heros: [
          { label: "Simulações", valor: int(simCount), tone: "neutral" },
          { label: "Propostas enviadas", valor: int(enviadas.length), tone: "brand" },
          {
            label: "Taxa de aprovação",
            valor: `${taxa.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
            tone: "success",
          },
          { label: "Contratos", valor: int(contratos.length), hint: brl(volume), tone: "success" },
        ],
        minis: [
          { label: "Simulações concluídas", valor: int(simConcluidas), tone: "success" },
          {
            label: "Simulações com erro",
            valor: int(simErro),
            tone: simErro ? "danger" : "neutral",
          },
          { label: "Aprovadas", valor: int(aprovadas.length), tone: "success" },
          {
            label: "Em análise",
            valor: int(
              enviadas.filter((p) => ["enviada_banco", "em_analise_credito"].includes(p.status))
                .length,
            ),
            tone: "warning",
          },
          {
            label: "Recusadas",
            valor: int(enviadas.filter((p) => p.status === "credito_recusado").length),
            tone: "danger",
          },
          { label: "Rascunhos", valor: int(rows.length - enviadas.length), tone: "neutral" },
        ],
        chart: {
          titulo: chartPorBanco ? "Ranking de bancos" : "Simulações por status",
          subtitulo: chartPorBanco ? "Propostas enviadas" : "Movimento das simulações",
          dados: chartDados,
        },
        ranking: {
          titulo: chartPorBanco ? "Bancos" : "Status das simulações",
          itens: chartDados.slice(0, 6),
        },
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
          .select("status,created_at")
          .gte("created_at", de)
          .lte("created_at", ateFim)
          .limit(5000),
        "usuario_responsavel_id",
      ),
      escopoEq(
        supabase
          .from("propostas")
          .select("status,created_at")
          .gte("created_at", de)
          .lte("created_at", ateFim)
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
    const propRows = (props.data ?? []) as any[];
    const demRows = (dem.data ?? []) as any[];
    const tkRows = (tk.data ?? []) as any[];
    const agora = new Date();
    const simConcluidas = simRows.filter((s) =>
      ["simulada", "parcialmente_simulada", "promovida"].includes(s.status),
    ).length;
    const simErro = simRows.filter((s) => s.status === "erro_banco").length;
    const aprovadas = propRows.filter((p) =>
      ["credito_aprovado", "contrato_emitido", "registrado"].includes(p.status),
    ).length;
    const contratos = propRows.filter((p) =>
      ["contrato_emitido", "registrado"].includes(p.status),
    ).length;
    const demAbertas = demRows.filter((d) => !["concluida", "cancelada"].includes(d.status));
    const demVencidas = demAbertas.filter((d) => d.prazo_sla && new Date(d.prazo_sla) < agora);
    const tkAtrasadas = tkRows.filter(
      (t) => !["concluida", "cancelada"].includes(t.status) && t.prazo && new Date(t.prazo) < agora,
    );
    const statusMap = new Map<string, number>();
    propRows.forEach((p) => statusMap.set(p.status, (statusMap.get(p.status) ?? 0) + 1));
    const simStatusMap = new Map<string, number>();
    simRows.forEach((s) =>
      simStatusMap.set(s.status ?? "—", (simStatusMap.get(s.status ?? "—") ?? 0) + 1),
    );
    const chartDados = [
      { label: "Simulações", valor: simRows.length },
      { label: "Simulações concluídas", valor: simConcluidas },
      { label: "Propostas", valor: propRows.filter((p) => p.status !== "rascunho").length },
      { label: "Aprovadas", valor: aprovadas },
      { label: "Contratos", valor: contratos },
    ];

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
        { label: "Simulações", valor: int(simRows.length), tone: "neutral" },
        {
          label: "Propostas",
          valor: int(propRows.filter((p) => p.status !== "rascunho").length),
          tone: "brand",
        },
        { label: "Aprovadas", valor: int(aprovadas), tone: "success" },
        { label: "Demandas abertas", valor: int(demAbertas.length), tone: "warning" },
      ],
      minis: [
        { label: "Simulações concluídas", valor: int(simConcluidas), tone: "success" },
        { label: "Simulações com erro", valor: int(simErro), tone: simErro ? "danger" : "neutral" },
        { label: "Contratos", valor: int(contratos), tone: "success" },
        { label: "SLA vencido", valor: int(demVencidas.length), tone: "danger" },
        {
          label: "Tarefas abertas",
          valor: int(tkRows.filter((t) => !["concluida", "cancelada"].includes(t.status)).length),
          tone: "neutral",
        },
        { label: "Tarefas atrasadas", valor: int(tkAtrasadas.length), tone: "danger" },
        {
          label: "Demandas concluídas",
          valor: int(demRows.filter((d) => d.status === "concluida").length),
          tone: "success",
        },
      ],
      chart: {
        titulo: "Funil operacional",
        subtitulo: "Simulações, propostas e contratos",
        dados: chartDados,
      },
      ranking: {
        titulo: statusMap.size ? "Status de propostas" : "Status de simulações",
        itens: statusMap.size ? topItens(statusMap, 6) : topItens(simStatusMap, 6),
      },
      alertas,
    };
  });
