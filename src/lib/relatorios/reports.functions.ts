import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  resolverIntervalo,
  type ReportFiltros,
  type ReportResult,
  type ChartSerie,
  type ComparativoMensal,
} from "@/lib/relatorios/shared";
import { mascararDocumento } from "@/lib/crm/documento";

const filtrosSchema = z.object({
  codigo: z.string(),
  filtros: z.object({
    periodo: z.enum(["hoje", "7d", "15d", "30d", "mes", "mes_anterior", "ano", "custom"]),
    de: z.string().optional(),
    ate: z.string().optional(),
    escopo: z.enum(["minha", "equipe", "geral"]),
    banco: z.string().optional(),
    produto: z.string().optional(),
    status: z.string().optional(),
    responsavel: z.string().optional(),
    cliente: z.string().optional(),
    valorMin: z.number().optional(),
    valorMax: z.number().optional(),
    busca: z.string().optional(),
  }),
});

const brl = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const int = (v: number) => (v || 0).toLocaleString("pt-BR");
const pct = (v: number) => `${(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Rótulos oficiais dos status de proposta (espelha components/propostas/status.ts). */
const STATUS_PROPOSTA_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviada_banco: "Enviada ao banco",
  em_analise_credito: "Em análise de crédito",
  aguardando_documentos: "Aguardando documentos",
  credito_aprovado: "Crédito aprovado",
  engenharia_vistoria: "Engenharia / vistoria",
  analise_juridica: "Análise jurídica",
  contrato_emitido: "Contrato emitido",
  registrado: "Registrado",
  credito_recusado: "Crédito recusado",
  erro_envio: "Erro no envio",
  cancelada: "Cancelada",
};
const rotuloStatus = (s: string) => STATUS_PROPOSTA_LABEL[s] ?? s;

/** Rótulos de status por módulo (para o filtro "Status" de cada relatório). */
const STATUS_SIMULACAO_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviando: "Enviando",
  simulada: "Simulada",
  parcialmente_simulada: "Parcialmente simulada",
  erro_banco: "Erro no banco",
  expirada: "Expirada",
  cancelada: "Cancelada",
  promovida: "Promovida",
};
const STATUS_DEMANDA_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  aguardando: "Aguardando",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
const STATUS_TAREFA_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
const STATUS_COMISSAO_LABEL: Record<string, string> = {
  a_receber: "A receber",
  recebida: "Recebida",
  paga_parceiro: "Paga ao parceiro",
  encerrada: "Encerrada",
};
const STATUS_FINANCEIRO_LABEL: Record<string, string> = {
  aberta: "Aberta",
  parcial: "Parcial",
  paga: "Paga / recebida",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
  estornada: "Estornada",
};

/** Converte um mapa rótulo em lista de opções {value,label}. */
const opcoes = (m: Record<string, string>) =>
  Object.entries(m).map(([value, label]) => ({ value, label }));

/** Opções de status do filtro por código de relatório. */
function statusOpcoesPorCodigo(codigo: string): { value: string; label: string }[] | undefined {
  switch (codigo) {
    case "consolidado":
    case "painel-geral":
    case "comerciais":
    case "gerencial":
    case "propostas":
    case "operacionais":
      return opcoes(STATUS_PROPOSTA_LABEL);
    case "simulacoes":
      return opcoes(STATUS_SIMULACAO_LABEL);
    case "demandas":
      return opcoes(STATUS_DEMANDA_LABEL);
    case "tarefas":
      return opcoes(STATUS_TAREFA_LABEL);
    case "comissoes":
      return opcoes(STATUS_COMISSAO_LABEL);
    case "financeiros":
      return opcoes(STATUS_FINANCEIRO_LABEL);
    default:
      return undefined;
  }
}



async function temPii(supabase: any, userId: string): Promise<boolean> {
  const { data: tudo } = await supabase.rpc("has_any_role", {
    _user_id: userId,
    _roles: ["admin", "correspondente"],
  });
  if (tudo) return true;
  const { data } = await supabase.rpc("usuario_tem_permissao", {
    _user_id: userId,
    _modulo: "crm.clientes",
    _acao: "pii:view",
  });
  return Boolean(data);
}

/** Aplica filtro de escopo "minha" (responsável = usuário). RLS já limita equipe/geral. */
function aplicarEscopo(query: any, filtros: ReportFiltros, userId: string, colResp: string) {
  if (filtros.escopo === "minha" && colResp) return query.eq(colResp, userId);
  return query;
}

function serieMensal(rows: { data: string; valor?: number }[]): ChartSerie[] {
  const map = new Map<string, { valor: number; count: number }>();
  for (const r of rows) {
    if (!r.data) continue;
    const mes = r.data.slice(0, 7);
    const cur = map.get(mes) ?? { valor: 0, count: 0 };
    cur.valor += r.valor ?? 0;
    cur.count += 1;
    map.set(mes, cur);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => {
      const [y, m] = mes.split("-");
      return { label: `${m}/${y.slice(2)}`, valor: v.count, valor2: v.valor };
    });
}

function topN(map: Map<string, number>, n: number): ChartSerie[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, valor]) => ({ label: label || "—", valor }));
}

export const runReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof filtrosSchema>) => filtrosSchema.parse(d))
  .handler(async ({ data, context }): Promise<ReportResult> => {
    const { supabase, userId } = context;
    const { codigo, filtros } = data;
    const { de, ate } = resolverIntervalo(filtros);
    const ateFim = `${ate}T23:59:59`;
    const pii = await temPii(supabase, userId);

    // registra auditoria de acesso ao relatório
    const { data: corr } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
    await supabase.from("report_audit_logs").insert({
      correspondente_id: corr as string,
      user_id: userId,
      report_codigo: codigo,
      acao: "visualizou",
      filtros: filtros as any,
    } as any);

    const resultado = await (async (): Promise<ReportResult> => {
      switch (codigo) {
        case "consolidado":
        case "painel-geral":
          return await relConsolidado();
        case "comerciais":
          return await relComerciais();
        case "gerencial":
          return await relGerencial();
        case "simulacoes":
          return await relSimulacoes();
        case "propostas":
        case "operacionais":
          return await relPropostas();
        case "crm":
        case "clientes":
          return await relClientes();
        case "demandas":
          return await relDemandas("demandas");
        case "tarefas":
          return await relTarefas();
        case "financeiros":
          return await relFinanceiro();
        case "comissoes":
          return await relComissoes();
        case "app-cliente":
          return await relAppCliente();
        default:
          return await relConsolidado();
      }
    })();

    // Comparativo mês a mês (últimos 6 meses) — anexado a todos os relatórios.
    resultado.comparativoMensal = await comparativoMensalPropostas();

    // Opções de filtro comuns a TODOS os relatórios: status do módulo + lista de
    // responsáveis (usuários) do correspondente. Assim qualquer relatório pode
    // ser filtrado por status e por usuário.
    const responsaveis = await listarResponsaveis();
    resultado.filtrosDisponiveis = {
      ...resultado.filtrosDisponiveis,
      statuses: resultado.filtrosDisponiveis?.statuses ?? statusOpcoesPorCodigo(codigo),
      responsaveis,
    };
    return resultado;

    async function listarResponsaveis(): Promise<{ value: string; label: string }[]> {
      let q = (supabase as any)
        .from("profiles")
        .select("id,nome,ativo")
        .order("nome", { ascending: true })
        .limit(1000);
      if (corr) q = q.eq("correspondente_id", corr);
      const { data } = await q;
      return ((data ?? []) as any[])
        .filter((p) => p.ativo !== false && p.nome)
        .map((p) => ({ value: p.id as string, label: p.nome as string }));
    }


    async function comparativoMensalPropostas(): Promise<ComparativoMensal | undefined> {
      const hojeStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const [hy, hm] = hojeStr.split("-").map(Number);
      const inicio = new Date(hy, hm - 1 - 5, 1); // 1º dia, 5 meses atrás
      const isoDia = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      let q = (supabase as any)
        .from("propostas")
        .select("status,nome_banco,created_at")
        .gte("created_at", isoDia(inicio))
        .order("created_at", { ascending: true })
        .limit(20000);
      q = aplicarEscopo(q, filtros, userId, "usuario_responsavel_id");
      if (filtros.responsavel) q = q.eq("usuario_responsavel_id", filtros.responsavel);
      const { data: rows } = await q;
      const props = ((rows ?? []) as any[]).filter((p) => p.status !== "rascunho");
      if (!props.length) return undefined;

      const MESES_PT = [
        "Jan",
        "Fev",
        "Mar",
        "Abr",
        "Mai",
        "Jun",
        "Jul",
        "Ago",
        "Set",
        "Out",
        "Nov",
        "Dez",
      ];
      const meses: string[] = [];
      const idx = new Map<string, number>();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(hy, hm - 1 - i, 1);
        idx.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 5 - i);
        meses.push(`${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`);
      }

      const quantidade = Array(6).fill(0) as number[];
      const aprov = Array(6).fill(0) as number[];
      const decid = Array(6).fill(0) as number[];
      const bancoMap = new Map<string, number[]>();
      for (const p of props) {
        const i = idx.get(String(p.created_at ?? "").slice(0, 7));
        if (i == null) continue;
        quantidade[i]++;
        const aprovada = ["credito_aprovado", "contrato_emitido", "registrado"].includes(p.status);
        const recusada = p.status === "credito_recusado";
        if (aprovada || recusada) {
          decid[i]++;
          if (aprovada) aprov[i]++;
        }
        const nb = p.nome_banco ?? "—";
        if (!bancoMap.has(nb)) bancoMap.set(nb, Array(6).fill(0));
        bancoMap.get(nb)![i]++;
      }
      const taxaAprovacao = quantidade.map((_, i) => (decid[i] ? (aprov[i] / decid[i]) * 100 : 0));
      const bancos = [...bancoMap.entries()]
        .map(([nome, valores]) => ({ nome, valores, total: valores.reduce((a, b) => a + b, 0) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)
        .map(({ nome, valores }) => ({ nome, valores }));

      return { meses, quantidade, taxaAprovacao, bancos };
    }

    async function fetchAll(
      table: string,
      cols: string,
      dateCol: string,
      colResp: string,
      opts?: { statusCol?: string | false },
    ) {
      let q = (supabase as any)
        .from(table)
        .select(cols)
        .gte(dateCol, de)
        .lte(dateCol, ateFim)
        .order(dateCol, { ascending: false })
        .limit(5000);
      q = aplicarEscopo(q, filtros, userId, colResp);
      if (filtros.responsavel && colResp) q = q.eq(colResp, filtros.responsavel);
      // Filtro por status: usa a coluna informada ou "status" quando presente no select.
      const statusCol =
        opts?.statusCol === false
          ? undefined
          : (opts?.statusCol ??
            (`,${cols.replace(/\s/g, "")},`.includes(",status,") ? "status" : undefined));
      if (filtros.status && statusCol) q = q.eq(statusCol, filtros.status);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      return (rows ?? []) as any[];
    }

    async function relConsolidado(): Promise<ReportResult> {
      const [sims, props, cls, coms] = await Promise.all([
        fetchAll("simulacoes", "id,status,created_at", "created_at", "usuario_responsavel_id"),
        fetchAll(
          "propostas",
          "id,status,valor_financiamento,valor_financiamento_aprovado,nome_banco,created_at",
          "created_at",
          "usuario_responsavel_id",
        ),
        fetchAll("clientes", "id,created_at", "created_at", "responsavel_id"),
        fetchAll("comissoes", "valor_bruto,created_at", "created_at", "usuario_responsavel_id"),
      ]);
      const enviadas = props.filter((p) => p.status !== "rascunho");
      const aprovadas = props.filter((p) =>
        ["credito_aprovado", "contrato_emitido", "registrado"].includes(p.status),
      );
      const contratos = props.filter((p) => ["contrato_emitido", "registrado"].includes(p.status));
      const volume = contratos.reduce(
        (s, p) => s + (p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0),
        0,
      );
      const bancoMap = new Map<string, number>();
      enviadas.forEach((p) =>
        bancoMap.set(p.nome_banco ?? "—", (bancoMap.get(p.nome_banco ?? "—") ?? 0) + 1),
      );
      const funil: ChartSerie[] = [
        { label: "Simulações", valor: sims.length },
        { label: "Propostas", valor: enviadas.length },
        { label: "Aprovadas", valor: aprovadas.length },
        { label: "Contratos", valor: contratos.length },
      ];
      return {
        titulo: "Painel geral consolidado",
        descricao: "Visão executiva da produção no período.",
        modulo: "Consolidado",
        kpis: [
          { label: "Clientes", valor: int(cls.length), tone: "brand" },
          { label: "Simulações", valor: int(sims.length), tone: "neutral" },
          { label: "Propostas", valor: int(enviadas.length), tone: "neutral" },
          { label: "Aprovadas", valor: int(aprovadas.length), tone: "success" },
          { label: "Contratos", valor: int(contratos.length), tone: "success" },
          { label: "Volume contratado", valor: brl(volume), tone: "brand" },
        ],
        charts: [
          { titulo: "Funil de conversão", tipo: "funnel", dados: funil },
          {
            titulo: "Ranking de bancos",
            subtitulo: "Propostas enviadas",
            tipo: "barh",
            dados: topN(bancoMap, 8),
          },
          {
            titulo: "Evolução mensal",
            subtitulo: "Propostas por mês",
            tipo: "line",
            dados: serieMensal(enviadas.map((p) => ({ data: p.created_at }))),
          },
        ],
        columns: [
          { key: "nome_banco", label: "Banco" },
          { key: "status", label: "Status" },
          { key: "valor", label: "Financiamento", align: "right", footer: "sum", format: "brl" },
          { key: "created_at", label: "Criada em", format: "date" },
        ],
        rows: enviadas.slice(0, 500).map((p) => ({
          nome_banco: p.nome_banco ?? "—",
          status: p.status,
          valor: p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0,
          created_at: p.created_at,
        })),
      };
    }

    async function relComerciais(): Promise<ReportResult> {
      const props = await fetchAll(
        "propostas",
        "id,status,valor_financiamento,valor_financiamento_aprovado,nome_banco,usuario_responsavel_id,created_at",
        "created_at",
        "usuario_responsavel_id",
      );
      const enviadas = props.filter((p) => p.status !== "rascunho");
      const aprovadas = props.filter((p) =>
        ["credito_aprovado", "contrato_emitido", "registrado"].includes(p.status),
      );
      const contratos = props.filter((p) => ["contrato_emitido", "registrado"].includes(p.status));
      const valor = contratos.reduce(
        (s, p) => s + (p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0),
        0,
      );
      const ticket = contratos.length ? valor / contratos.length : 0;
      const taxa = enviadas.length ? (aprovadas.length / enviadas.length) * 100 : 0;
      const bancoMap = new Map<string, number>();
      enviadas.forEach((p) =>
        bancoMap.set(p.nome_banco ?? "—", (bancoMap.get(p.nome_banco ?? "—") ?? 0) + 1),
      );
      const bancoLider = topN(bancoMap, 1)[0]?.label ?? "—";
      // ranking por usuário
      const respIds = [...new Set(enviadas.map((p) => p.usuario_responsavel_id).filter(Boolean))];
      const nomes = await nomesUsuarios(respIds);
      const userMap = new Map<string, { props: number; contratos: number; valor: number }>();
      enviadas.forEach((p) => {
        const k = p.usuario_responsavel_id ?? "—";
        const cur = userMap.get(k) ?? { props: 0, contratos: 0, valor: 0 };
        cur.props += 1;
        if (["contrato_emitido", "registrado"].includes(p.status)) {
          cur.contratos += 1;
          cur.valor += p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0;
        }
        userMap.set(k, cur);
      });
      return {
        titulo: "Relatório comercial",
        descricao: "Desempenho de produção por período e responsável.",
        modulo: "Comercial",
        kpis: [
          { label: "Propostas", valor: int(enviadas.length), tone: "neutral" },
          { label: "Taxa de aprovação", valor: pct(taxa), tone: "success" },
          { label: "Ticket médio", valor: brl(ticket), tone: "brand" },
          { label: "Valor contratado", valor: brl(valor), tone: "brand" },
          { label: "Contratos", valor: int(contratos.length), tone: "success" },
          { label: "Banco líder", valor: bancoLider, tone: "neutral" },
        ],
        charts: [
          {
            titulo: "Série mensal",
            subtitulo: "Propostas x valor",
            tipo: "line",
            dados: serieMensal(
              enviadas.map((p) => ({ data: p.created_at, valor: p.valor_financiamento ?? 0 })),
            ),
          },
          { titulo: "Ranking de bancos", tipo: "barh", dados: topN(bancoMap, 8) },
        ],
        columns: [
          { key: "resp", label: "Responsável" },
          { key: "props", label: "Propostas", align: "right", footer: "sum", format: "int" },
          { key: "contratos", label: "Contratos", align: "right", footer: "sum", format: "int" },
          { key: "valor", label: "Valor contratado", align: "right", footer: "sum", format: "brl" },
        ],
        rows: [...userMap.entries()]
          .sort((a, b) => b[1].valor - a[1].valor)
          .slice(0, 50)
          .map(([k, v]) => ({
            resp: nomes.get(k) ?? "—",
            props: v.props,
            contratos: v.contratos,
            valor: v.valor,
          })),
      };
    }

    async function relGerencial(): Promise<ReportResult> {
      const PRODUTO_LABEL = (p?: string) =>
        p === "home_equity"
          ? "Home Equity"
          : p === "financiamento_imobiliario"
            ? "Financiamento"
            : p
              ? p
              : "—";
      const cols = [
        "id",
        "status",
        "produto",
        "nome_banco",
        "valor_financiamento",
        "valor_financiamento_aprovado",
        "analista_id",
        "analista_nome",
        "comercial_id",
        "consultor_nome",
        "parceiro_id",
        "parceiro_nome",
        "usuario_responsavel_id",
        "created_at",
        "contrato_emitido_em",
      ].join(",");

      // Busca por período em created_at OU em contrato_emitido_em (para contratos emitidos no período).
      let q = (supabase as any)
        .from("propostas")
        .select(cols)
        .or(
          `and(created_at.gte.${de},created_at.lte.${ateFim}),and(contrato_emitido_em.gte.${de},contrato_emitido_em.lte.${ateFim})`,
        )
        .order("created_at", { ascending: false })
        .limit(10000);
      q = aplicarEscopo(q, filtros, userId, "usuario_responsavel_id");
      if (filtros.responsavel) q = q.eq("usuario_responsavel_id", filtros.responsavel);
      if (filtros.banco) q = q.eq("nome_banco", filtros.banco);
      if (filtros.produto) q = q.eq("produto", filtros.produto);
      const { data: rowsRaw, error } = await q;
      if (error) throw new Error(error.message);
      const props = (rowsRaw ?? []) as any[];

      // Nomes de analistas/comerciais quando só há id (sem nome desnormalizado).
      const idsFaltando = new Set<string>();
      for (const p of props) {
        if (!p.analista_nome && p.analista_id) idsFaltando.add(p.analista_id);
        if (!p.consultor_nome && p.comercial_id) idsFaltando.add(p.comercial_id);
      }
      const nomes = await nomesUsuarios([...idsFaltando]);
      const nomeAnalista = (p: any) =>
        p.analista_nome || nomes.get(p.analista_id) || "Não atribuído";
      const nomeComercial = (p: any) =>
        p.consultor_nome || nomes.get(p.comercial_id) || "Não atribuído";
      const nomeParceiro = (p: any) => p.parceiro_nome || "Não atribuído";
      const valorProc = (p: any) => p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0;

      const emAndamento = [
        "enviada_banco",
        "em_analise_credito",
        "aguardando_documentos",
        "credito_aprovado",
        "engenharia_vistoria",
        "analise_juridica",
      ];
      const aprovado = ["credito_aprovado", "contrato_emitido", "registrado"];
      const contrato = ["contrato_emitido", "registrado"];

      const dentro = (iso?: string) => !!iso && iso.slice(0, 10) >= de && iso.slice(0, 10) <= ate;
      const andamento = props.filter((p) => emAndamento.includes(p.status) && dentro(p.created_at));
      const aprovadas = props.filter((p) => aprovado.includes(p.status) && dentro(p.created_at));
      const contratos = props.filter(
        (p) => contrato.includes(p.status) && dentro(p.contrato_emitido_em),
      );

      // Helper: agrupamento simples por 1 dimensão -> {chave, qtd, valor}
      const colsBreak = (label: string) => [
        { key: "k", label },
        {
          key: "qtd",
          label: "Qtd",
          align: "right" as const,
          footer: "sum" as const,
          format: "int" as const,
        },
        {
          key: "valor",
          label: "Valor",
          align: "right" as const,
          footer: "sum" as const,
          format: "brl" as const,
        },
      ];
      const breakdown = (rows: any[], keyFn: (p: any) => string, valFn: (p: any) => number) => {
        const m = new Map<string, { qtd: number; valor: number }>();
        for (const p of rows) {
          const k = keyFn(p) || "—";
          const cur = m.get(k) ?? { qtd: 0, valor: 0 };
          cur.qtd += 1;
          cur.valor += valFn(p) || 0;
          m.set(k, cur);
        }
        return [...m.entries()]
          .sort((a, b) => b[1].valor - a[1].valor)
          .map(([k, v]) => ({ k, qtd: v.qtd, valor: v.valor }));
      };

      // Helper: agrupamento por 2 dimensões (ex.: analista x banco)
      const colsBreak2 = (l1: string, l2: string) => [
        { key: "k1", label: l1 },
        { key: "k2", label: l2 },
        {
          key: "qtd",
          label: "Qtd",
          align: "right" as const,
          footer: "sum" as const,
          format: "int" as const,
        },
        {
          key: "valor",
          label: "Valor",
          align: "right" as const,
          footer: "sum" as const,
          format: "brl" as const,
        },
      ];
      const breakdown2 = (
        rows: any[],
        k1Fn: (p: any) => string,
        k2Fn: (p: any) => string,
        valFn: (p: any) => number,
      ) => {
        const m = new Map<string, { k1: string; k2: string; qtd: number; valor: number }>();
        for (const p of rows) {
          const a = k1Fn(p) || "—";
          const b = k2Fn(p) || "—";
          const key = `${a}||${b}`;
          const cur = m.get(key) ?? { k1: a, k2: b, qtd: 0, valor: 0 };
          cur.qtd += 1;
          cur.valor += valFn(p) || 0;
          m.set(key, cur);
        }
        return [...m.values()].sort((x, y) =>
          x.k1 === y.k1 ? y.valor - x.valor : x.k1.localeCompare(y.k1),
        );
      };

      const secaoTabelas = (
        rows: any[],
        dataLabel: string,
        dataFn: (p: any) => string,
        valFn: (p: any) => number,
      ): { titulo: string; subtitulo?: string; columns: any[]; rows: any[] }[] => {
        const porData = new Map<string, { qtd: number; valor: number }>();
        for (const p of rows) {
          const d = (dataFn(p) || "").slice(0, 10);
          if (!d) continue;
          const cur = porData.get(d) ?? { qtd: 0, valor: 0 };
          cur.qtd += 1;
          cur.valor += valFn(p) || 0;
          porData.set(d, cur);
        }
        return [
          {
            titulo: dataLabel,
            columns: [
              { key: "k", label: "Data", format: "date" as const },
              {
                key: "qtd",
                label: "Qtd",
                align: "right" as const,
                footer: "sum" as const,
                format: "int" as const,
              },
              {
                key: "valor",
                label: "Valor",
                align: "right" as const,
                footer: "sum" as const,
                format: "brl" as const,
              },
            ],
            rows: [...porData.entries()]
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([k, v]) => ({ k, qtd: v.qtd, valor: v.valor })),
          },
          {
            titulo: "Por banco",
            columns: colsBreak("Banco"),
            rows: breakdown(rows, (p) => p.nome_banco, valFn),
          },
          {
            titulo: "Por tipo (Financiamento / Home Equity)",
            columns: colsBreak("Tipo"),
            rows: breakdown(rows, (p) => PRODUTO_LABEL(p.produto), valFn),
          },
          {
            titulo: "Por analista Adm",
            columns: colsBreak("Analista Adm"),
            rows: breakdown(rows, nomeAnalista, valFn),
          },
          {
            titulo: "Por analista Comercial · separado por banco",
            columns: colsBreak2("Analista Comercial", "Banco"),
            rows: breakdown2(rows, nomeComercial, (p) => p.nome_banco, valFn),
          },
          {
            titulo: "Por Imobiliária / Corretor",
            columns: colsBreak("Imobiliária / Corretor"),
            rows: breakdown(rows, nomeParceiro, valFn),
          },
        ];
      };

      const totalAnd = andamento.reduce((s, p) => s + valorProc(p), 0);
      const totalAprov = aprovadas.reduce((s, p) => s + valorProc(p), 0);
      const totalContr = contratos.reduce((s, p) => s + valorProc(p), 0);

      const tabelas = [
        {
          titulo: "Processos em andamento",
          descricao: "Propostas ativas na esteira dentro do período.",
          tabelas: [
            {
              titulo: "Por valor · separado por banco",
              columns: colsBreak("Banco"),
              rows: breakdown(andamento, (p) => p.nome_banco, valorProc),
            },
            {
              titulo: "Por tipo (Financiamento / Home Equity)",
              columns: colsBreak("Tipo"),
              rows: breakdown(andamento, (p) => PRODUTO_LABEL(p.produto), valorProc),
            },
            {
              titulo: "Por analista Adm",
              columns: colsBreak("Analista Adm"),
              rows: breakdown(andamento, nomeAnalista, valorProc),
            },
            {
              titulo: "Por analista Comercial · separado por banco",
              columns: colsBreak2("Analista Comercial", "Banco"),
              rows: breakdown2(andamento, nomeComercial, (p) => p.nome_banco, valorProc),
            },
            {
              titulo: "Por Imobiliária / Corretor",
              columns: colsBreak("Imobiliária / Corretor"),
              rows: breakdown(andamento, nomeParceiro, valorProc),
            },
            {
              titulo: "Por fase (status atual)",
              columns: colsBreak("Fase"),
              rows: breakdown(andamento, (p) => rotuloStatus(p.status), valorProc),
            },
          ],
        },
        {
          titulo: "Propostas aprovadas",
          descricao: "Propostas com crédito aprovado no período.",
          tabelas: secaoTabelas(aprovadas, "Por data", (p) => p.created_at, valorProc),
        },
        {
          titulo: "Contratos emitidos",
          descricao: "Contratos emitidos por data de emissão no período.",
          tabelas: [
            ...secaoTabelas(
              contratos,
              "Por data de emissão",
              (p) => p.contrato_emitido_em,
              valorProc,
            ),
            {
              titulo: "Por valor · separado por banco",
              columns: colsBreak("Banco"),
              rows: breakdown(contratos, (p) => p.nome_banco, valorProc),
            },
          ],
        },
      ];

      return {
        titulo: "Relatório gerencial",
        descricao:
          "Processos em andamento, propostas aprovadas e contratos emitidos com quebras por banco, tipo, analistas, imobiliária/corretor e fase.",
        modulo: "Gerencial",
        kpis: [
          { label: "Em andamento", valor: int(andamento.length), tone: "neutral" },
          { label: "Valor em andamento", valor: brl(totalAnd), tone: "brand" },
          { label: "Aprovadas", valor: int(aprovadas.length), tone: "success" },
          { label: "Valor aprovado", valor: brl(totalAprov), tone: "brand" },
          { label: "Contratos emitidos", valor: int(contratos.length), tone: "success" },
          { label: "Valor contratado", valor: brl(totalContr), tone: "brand" },
        ],
        charts: [
          {
            titulo: "Funil",
            subtitulo: "Andamento → Aprovadas → Contratos",
            tipo: "funnel",
            dados: [
              { label: "Em andamento", valor: andamento.length },
              { label: "Aprovadas", valor: aprovadas.length },
              { label: "Contratos", valor: contratos.length },
            ],
          },
          {
            titulo: "Contratos por banco",
            subtitulo: "Valor contratado",
            tipo: "barh",
            dados: breakdown(contratos, (p) => p.nome_banco, valorProc)
              .map((r) => ({ label: r.k, valor: r.valor }))
              .slice(0, 8),
          },
        ],
        columns: [
          { key: "nome_banco", label: "Banco" },
          { key: "produto", label: "Tipo" },
          { key: "status", label: "Fase" },
          { key: "analista", label: "Analista Adm" },
          { key: "comercial", label: "Analista Comercial" },
          { key: "parceiro", label: "Imobiliária / Corretor" },
          { key: "valor", label: "Valor", align: "right", footer: "sum", format: "brl" },
          { key: "created_at", label: "Criada em", format: "date" },
        ],
        rows: [
          ...andamento,
          ...aprovadas.filter((p) => !emAndamento.includes(p.status)),
          ...contratos.filter((p) => !aprovado.includes(p.status) || contrato.includes(p.status)),
        ]
          .slice(0, 1000)
          .map((p) => ({
            nome_banco: p.nome_banco ?? "—",
            produto: PRODUTO_LABEL(p.produto),
            status: rotuloStatus(p.status),
            analista: nomeAnalista(p),
            comercial: nomeComercial(p),
            parceiro: nomeParceiro(p),
            valor: valorProc(p),
            created_at: p.created_at,
          })),
      };
    }

    async function relSimulacoes(): Promise<ReportResult> {
      const sims = await fetchAll(
        "simulacoes",
        "id,tipo_simulacao,status,valor_financiamento,nome_cliente,numero_simulacao,created_at",
        "created_at",
        "usuario_responsavel_id",
      );
      const props = await fetchAll(
        "propostas",
        "id,created_at",
        "created_at",
        "usuario_responsavel_id",
      );
      const rapidas = sims.filter((s) => s.tipo_simulacao === "simplificada").length;
      const completas = sims.filter((s) => s.tipo_simulacao === "completa").length;
      const erro = sims.filter((s) => s.status === "erro_banco").length;
      const promovidas = sims.filter((s) => s.status === "promovida").length;
      const conv = sims.length ? (promovidas / sims.length) * 100 : 0;
      const ticket = sims.length
        ? sims.reduce((s, x) => s + (x.valor_financiamento ?? 0), 0) / sims.length
        : 0;
      const statusMap = new Map<string, number>();
      sims.forEach((s) => statusMap.set(s.status, (statusMap.get(s.status) ?? 0) + 1));
      return {
        titulo: "Relatório de simulações",
        descricao: "Volume, tipo e conversão de simulações.",
        modulo: "Simulações",
        kpis: [
          { label: "Total", valor: int(sims.length), tone: "neutral" },
          { label: "Rápidas", valor: int(rapidas), tone: "neutral" },
          { label: "Completas", valor: int(completas), tone: "brand" },
          { label: "Com erro", valor: int(erro), tone: "danger" },
          { label: "Conversão sim→prop", valor: pct(conv), tone: "success" },
          { label: "Ticket médio", valor: brl(ticket), tone: "brand" },
        ],
        charts: [
          { titulo: "Distribuição por status", tipo: "barh", dados: topN(statusMap, 8) },
          {
            titulo: "Evolução mensal",
            tipo: "line",
            dados: serieMensal(sims.map((s) => ({ data: s.created_at }))),
          },
        ],
        columns: [
          { key: "numero_simulacao", label: "Número" },
          { key: "nome_cliente", label: "Cliente" },
          { key: "tipo", label: "Tipo" },
          { key: "status", label: "Status" },
          { key: "valor", label: "Financiamento", align: "right", footer: "sum", format: "brl" },
          { key: "created_at", label: "Criada em", format: "date" },
        ],
        rows: sims.slice(0, 500).map((s) => ({
          numero_simulacao: s.numero_simulacao,
          nome_cliente: s.nome_cliente ?? "—",
          tipo: s.tipo_simulacao,
          status: s.status,
          valor: s.valor_financiamento ?? 0,
          created_at: s.created_at,
        })),
      };
    }

    async function relPropostas(): Promise<ReportResult> {
      const todas = await fetchAll(
        "propostas",
        "id,numero_proposta,numero_proposta_banco,nome_cliente,status,valor_financiamento,valor_financiamento_aprovado,nome_banco,produto,prazo,created_at",
        "created_at",
        "usuario_responsavel_id",
      );

      // Apenas bancos ATIVOS aparecem no filtro (produtos vêm das propostas existentes).
      const [{ data: bancosCad }, { data: prodProps }] = await Promise.all([
        supabase
          .from("homefin_bancos")
          .select("nome_banco")
          .eq("ativo", true)
          .order("nome_banco", { ascending: true }),
        supabase.from("propostas").select("produto"),
      ]);
      const bancosDisponiveis = [
        ...new Set(
          ((bancosCad ?? []) as any[]).map((b) => String(b.nome_banco ?? "")).filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "pt-BR"));
      const produtosDisponiveis = [
        ...new Set(
          ((prodProps ?? []) as any[]).map((p) => String(p.produto ?? "")).filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "pt-BR"));

      // Filtros server-side (banco, produto, status, faixa de valor, busca textual).
      const buscaLc = filtros.busca?.trim().toLowerCase();
      const props = todas.filter((p) => {
        if (filtros.banco && (p.nome_banco ?? "") !== filtros.banco) return false;
        if (filtros.produto && (p.produto ?? "") !== filtros.produto) return false;
        if (filtros.status && p.status !== filtros.status) return false;
        const v = p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0;
        if (filtros.valorMin != null && v < filtros.valorMin) return false;
        if (filtros.valorMax != null && v > filtros.valorMax) return false;
        if (buscaLc) {
          const alvo =
            `${p.numero_proposta ?? ""} ${p.numero_proposta_banco ?? ""} ${p.nome_cliente ?? ""} ${p.nome_banco ?? ""}`.toLowerCase();
          if (!alvo.includes(buscaLc)) return false;
        }
        return true;
      });

      const enviadas = props.filter((p) => p.status !== "rascunho");
      const emAnalise = props.filter((p) =>
        [
          "enviada_banco",
          "em_analise_credito",
          "aguardando_documentos",
          "engenharia_vistoria",
          "analise_juridica",
        ].includes(p.status),
      );
      const aprovadas = props.filter((p) => p.status === "credito_aprovado");
      const recusadas = props.filter((p) => p.status === "credito_recusado");
      const contratos = props.filter((p) => ["contrato_emitido", "registrado"].includes(p.status));
      const volumeEnviado = enviadas.reduce((s, p) => s + (p.valor_financiamento ?? 0), 0);
      const volumeContratado = contratos.reduce(
        (s, p) => s + (p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0),
        0,
      );
      const ticket = contratos.length ? volumeContratado / contratos.length : 0;
      const decididas = aprovadas.length + recusadas.length + contratos.length;
      const taxaAprov = decididas ? ((aprovadas.length + contratos.length) / decididas) * 100 : 0;

      const bancoMap = new Map<string, number>();
      enviadas.forEach((p) =>
        bancoMap.set(p.nome_banco ?? "—", (bancoMap.get(p.nome_banco ?? "—") ?? 0) + 1),
      );
      const statusMap = new Map<string, number>();
      props.forEach((p) =>
        statusMap.set(rotuloStatus(p.status), (statusMap.get(rotuloStatus(p.status)) ?? 0) + 1),
      );
      const produtoMap = new Map<string, number>();
      enviadas.forEach((p) =>
        produtoMap.set(p.produto ?? "—", (produtoMap.get(p.produto ?? "—") ?? 0) + 1),
      );

      return {
        titulo: "Relatório de propostas",
        descricao: "Status, bancos, produtos e volumes das propostas no período.",
        modulo: "Propostas",
        kpis: [
          { label: "Total", valor: int(props.length), tone: "neutral" },
          { label: "Em análise", valor: int(emAnalise.length), tone: "warning" },
          { label: "Contratos", valor: int(contratos.length), tone: "success" },
          { label: "Taxa de aprovação", valor: pct(taxaAprov), tone: "success" },
          { label: "Ticket médio", valor: brl(ticket), tone: "brand" },
          {
            label: "Volume contratado",
            valor: brl(volumeContratado),
            hint: `Enviado ${brl(volumeEnviado)}`,
            tone: "brand",
          },
        ],
        charts: [
          {
            titulo: "Distribuição por banco",
            subtitulo: "Propostas enviadas",
            tipo: "barh",
            dados: topN(bancoMap, 10),
          },
          { titulo: "Distribuição por status", tipo: "bar", dados: topN(statusMap, 12) },
          {
            titulo: "Distribuição por produto",
            subtitulo: "Propostas enviadas",
            tipo: "barh",
            dados: topN(produtoMap, 8),
          },
          {
            titulo: "Evolução mensal",
            subtitulo: "Propostas x volume enviado",
            tipo: "line",
            moeda: true,
            dados: serieMensal(
              enviadas.map((p) => ({ data: p.created_at, valor: p.valor_financiamento ?? 0 })),
            ),
          },
        ],
        columns: [
          { key: "numero_proposta", label: "Nº interno" },
          { key: "numero_proposta_banco", label: "Nº banco" },
          { key: "nome_cliente", label: "Cliente" },
          { key: "nome_banco", label: "Banco" },
          { key: "produto", label: "Produto" },
          { key: "status", label: "Status" },
          { key: "prazo", label: "Prazo (meses)", align: "right", format: "int" },
          { key: "valor", label: "Financiamento", align: "right", footer: "sum", format: "brl" },
          { key: "created_at", label: "Criada em", format: "date" },
        ],
        rows: props.slice(0, 1000).map((p) => ({
          numero_proposta: p.numero_proposta,
          numero_proposta_banco: p.numero_proposta_banco ?? "—",
          nome_cliente: p.nome_cliente ?? "—",
          nome_banco: p.nome_banco ?? "—",
          produto: p.produto ?? "—",
          status: rotuloStatus(p.status),
          prazo: p.prazo ?? null,
          valor: p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0,
          created_at: p.created_at,
        })),
        filtrosDisponiveis: {
          bancos: bancosDisponiveis,
          produtos: produtosDisponiveis,
          statuses: Object.entries(STATUS_PROPOSTA_LABEL).map(([value, label]) => ({
            value,
            label,
          })),
        },
      };
    }

    async function relClientes(): Promise<ReportResult> {
      const cls = await fetchAll(
        "clientes",
        "id,numero_cliente,nome,documento,tipo_pessoa,ativo,portal_acesso_ativo,responsavel_id,created_at",
        "created_at",
        "responsavel_id",
      );
      const novos = cls.length;
      const ativos = cls.filter((c) => c.ativo).length;
      const semResp = cls.filter((c) => !c.responsavel_id).length;
      const appOn = cls.filter((c) => c.portal_acesso_ativo).length;
      const pfPj = new Map<string, number>();
      cls.forEach((c) => pfPj.set(c.tipo_pessoa ?? "—", (pfPj.get(c.tipo_pessoa ?? "—") ?? 0) + 1));
      return {
        titulo: "Relatório de clientes",
        descricao: "Base de clientes cadastrados no período.",
        modulo: "CRM",
        kpis: [
          { label: "Novos", valor: int(novos), tone: "brand" },
          { label: "Ativos", valor: int(ativos), tone: "success" },
          { label: "App habilitado", valor: int(appOn), tone: "neutral" },
          { label: "Sem responsável", valor: int(semResp), tone: "warning" },
        ],
        charts: [
          { titulo: "Tipo de pessoa", tipo: "barh", dados: topN(pfPj, 4) },
          {
            titulo: "Evolução mensal",
            tipo: "line",
            dados: serieMensal(cls.map((c) => ({ data: c.created_at }))),
          },
        ],
        columns: [
          { key: "numero_cliente", label: "Número" },
          { key: "nome", label: "Nome" },
          { key: "documento", label: "Documento" },
          { key: "tipo_pessoa", label: "Tipo" },
          { key: "ativo", label: "Ativo" },
          { key: "created_at", label: "Cadastro", format: "date" },
        ],
        rows: cls.slice(0, 500).map((c) => ({
          numero_cliente: c.numero_cliente,
          nome: c.nome,
          documento: pii ? c.documento : mascararDocumento(c.documento ?? ""),
          tipo_pessoa: c.tipo_pessoa,
          ativo: c.ativo ? "Sim" : "Não",
          created_at: c.created_at,
        })),
      };
    }

    async function relDemandas(_kind: string): Promise<ReportResult> {
      const dem = await fetchAll(
        "demandas",
        "id,numero,titulo,status,prioridade,prazo_sla,concluida_em,responsavel_id,created_at",
        "created_at",
        "responsavel_id",
      );
      const agora = new Date();
      const abertas = dem.filter((d) => !["concluida", "cancelada"].includes(d.status)).length;
      const concluidas = dem.filter((d) => d.status === "concluida").length;
      const slaVencido = dem.filter(
        (d) =>
          !["concluida", "cancelada"].includes(d.status) &&
          d.prazo_sla &&
          new Date(d.prazo_sla) < agora,
      ).length;
      const statusMap = new Map<string, number>();
      dem.forEach((d) => statusMap.set(d.status, (statusMap.get(d.status) ?? 0) + 1));
      return {
        titulo: "Relatório de demandas",
        descricao: "Volume, SLA e conclusão de demandas.",
        modulo: "Operacional",
        kpis: [
          { label: "Total", valor: int(dem.length), tone: "neutral" },
          { label: "Abertas", valor: int(abertas), tone: "warning" },
          { label: "Concluídas", valor: int(concluidas), tone: "success" },
          { label: "SLA vencido", valor: int(slaVencido), tone: "danger" },
        ],
        charts: [{ titulo: "Distribuição por status", tipo: "barh", dados: topN(statusMap, 6) }],
        columns: [
          { key: "numero", label: "Número" },
          { key: "titulo", label: "Título" },
          { key: "prioridade", label: "Prioridade" },
          { key: "status", label: "Status" },
          { key: "created_at", label: "Criada", format: "date" },
        ],
        rows: dem.slice(0, 500).map((d) => ({
          numero: d.numero,
          titulo: d.titulo,
          prioridade: d.prioridade,
          status: d.status,
          created_at: d.created_at,
        })),
      };
    }

    async function relTarefas(): Promise<ReportResult> {
      const tk = await fetchAll(
        "tasks",
        "id,numero,titulo,status,prioridade,prazo,concluida_em,responsavel_id,created_at",
        "created_at",
        "responsavel_id",
      );
      const agora = new Date();
      const abertas = tk.filter((t) => !["concluida", "cancelada"].includes(t.status)).length;
      const concluidas = tk.filter((t) => t.status === "concluida").length;
      const atrasadas = tk.filter(
        (t) =>
          !["concluida", "cancelada"].includes(t.status) && t.prazo && new Date(t.prazo) < agora,
      ).length;
      const statusMap = new Map<string, number>();
      tk.forEach((t) => statusMap.set(t.status, (statusMap.get(t.status) ?? 0) + 1));
      return {
        titulo: "Relatório de tarefas",
        descricao: "Execução e prazos das tarefas no período.",
        modulo: "Operacional",
        kpis: [
          { label: "Total", valor: int(tk.length), tone: "neutral" },
          { label: "Abertas", valor: int(abertas), tone: "warning" },
          { label: "Concluídas", valor: int(concluidas), tone: "success" },
          { label: "Atrasadas", valor: int(atrasadas), tone: "danger" },
        ],
        charts: [{ titulo: "Distribuição por status", tipo: "barh", dados: topN(statusMap, 6) }],
        columns: [
          { key: "numero", label: "Número" },
          { key: "titulo", label: "Título" },
          { key: "prioridade", label: "Prioridade" },
          { key: "status", label: "Status" },
          { key: "created_at", label: "Criada", format: "date" },
        ],
        rows: tk.slice(0, 500).map((t) => ({
          numero: t.numero,
          titulo: t.titulo,
          prioridade: t.prioridade,
          status: t.status,
          created_at: t.created_at,
        })),
      };
    }

    async function relFinanceiro(): Promise<ReportResult> {
      const [pag, rec] = await Promise.all([
        supabase
          .from("financial_payables")
          .select("valor,valor_pago,status,vencimento,descricao,created_at,data_pagamento")
          .gte("created_at", de)
          .lte("created_at", ateFim)
          .limit(5000)
          .then((r: any) => r.data ?? []),
        supabase
          .from("financial_receivables")
          .select("valor,valor_recebido,status,vencimento,descricao,created_at,data_pagamento")
          .gte("created_at", de)
          .lte("created_at", ateFim)
          .limit(5000)
          .then((r: any) => r.data ?? []),
      ]);
      const hojeStr = new Date().toISOString().slice(0, 10);
      const aReceber = rec
        .filter((r: any) => ["aberta", "parcial"].includes(r.status))
        .reduce((s: number, r: any) => s + (r.valor ?? 0), 0);
      const aPagar = pag
        .filter((r: any) => ["aberta", "parcial"].includes(r.status))
        .reduce((s: number, r: any) => s + (r.valor ?? 0), 0);
      const pago = pag.reduce((s: number, r: any) => s + (r.valor_pago ?? 0), 0);
      const recebido = rec.reduce((s: number, r: any) => s + (r.valor_recebido ?? 0), 0);
      const vencido = [...pag, ...rec]
        .filter(
          (r: any) =>
            ["aberta", "parcial"].includes(r.status) && r.vencimento && r.vencimento < hojeStr,
        )
        .reduce((s: number, r: any) => s + (r.valor ?? 0), 0);
      return {
        titulo: "Relatório financeiro",
        descricao: "Fluxo de recebimentos, pagamentos e saldo.",
        modulo: "Financeiro",
        kpis: [
          { label: "A receber", valor: brl(aReceber), tone: "success" },
          { label: "A pagar", valor: brl(aPagar), tone: "warning" },
          { label: "Recebido", valor: brl(recebido), tone: "success" },
          { label: "Pago", valor: brl(pago), tone: "neutral" },
          { label: "Saldo previsto", valor: brl(aReceber - aPagar), tone: "brand" },
          { label: "Vencido", valor: brl(vencido), tone: "danger" },
        ],
        charts: [
          {
            titulo: "Fluxo mensal",
            subtitulo: "Recebido x pago",
            tipo: "line",
            moeda: true,
            serie1: "Recebido",
            serie2: "Pago",
            dados: fluxoMensal(rec, pag),
          },
        ],
        columns: [
          { key: "tipo", label: "Tipo" },
          { key: "descricao", label: "Descrição" },
          { key: "status", label: "Status" },
          { key: "vencimento", label: "Vencimento", format: "date" },
          { key: "valor", label: "Valor", align: "right", footer: "sum", format: "brl" },
        ],
        rows: [
          ...rec.map((r: any) => ({
            tipo: "Receber",
            descricao: r.descricao ?? "—",
            status: r.status,
            vencimento: r.vencimento,
            valor: r.valor ?? 0,
          })),
          ...pag.map((r: any) => ({
            tipo: "Pagar",
            descricao: r.descricao ?? "—",
            status: r.status,
            vencimento: r.vencimento,
            valor: r.valor ?? 0,
          })),
        ].slice(0, 800),
      };
    }

    async function relComissoes(): Promise<ReportResult> {
      const coms = await supabase
        .from("comissoes")
        .select("valor_bruto,split_parceiro,split_interno,status,usuario_responsavel_id,created_at")
        .gte("created_at", de)
        .lte("created_at", ateFim)
        .limit(5000)
        .then((r: any) => r.data ?? []);
      const prevista = coms.reduce((s: number, c: any) => s + (c.valor_bruto ?? 0), 0);
      const paga = coms
        .filter((c: any) => c.status === "paga_parceiro" || c.status === "encerrada")
        .reduce((s: number, c: any) => s + (c.valor_bruto ?? 0), 0);
      const ticket = coms.length ? prevista / coms.length : 0;
      const respIds = [
        ...new Set(coms.map((c: any) => c.usuario_responsavel_id).filter(Boolean)),
      ] as string[];
      const nomes = await nomesUsuarios(respIds);
      const userMap = new Map<string, number>();
      coms.forEach((c: any) =>
        userMap.set(
          c.usuario_responsavel_id ?? "—",
          (userMap.get(c.usuario_responsavel_id ?? "—") ?? 0) + (c.valor_bruto ?? 0),
        ),
      );
      return {
        titulo: "Relatório de comissões",
        descricao: "Comissões previstas e pagas no período.",
        modulo: "Financeiro",
        kpis: [
          { label: "Comissão prevista", valor: brl(prevista), tone: "brand" },
          { label: "Comissão paga", valor: brl(paga), tone: "success" },
          { label: "Ticket médio", valor: brl(ticket), tone: "neutral" },
          { label: "Registros", valor: int(coms.length), tone: "neutral" },
        ],
        charts: [
          {
            titulo: "Ranking por responsável",
            tipo: "barh",
            moeda: true,
            dados: [...userMap.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([k, v]) => ({ label: nomes.get(k) ?? "—", valor: v })),
          },
        ],
        columns: [
          { key: "resp", label: "Responsável" },
          { key: "valor", label: "Comissão", align: "right", footer: "sum", format: "brl" },
        ],
        rows: [...userMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => ({ resp: nomes.get(k) ?? "—", valor: v })),
      };
    }

    async function relAppCliente(): Promise<ReportResult> {
      const cls = await fetchAll(
        "clientes",
        "id,numero_cliente,nome,portal_acesso_ativo,created_at",
        "created_at",
        "responsavel_id",
      );
      const habilitados = cls.filter((c) => c.portal_acesso_ativo).length;
      return {
        titulo: "Relatório do App do Cliente",
        descricao: "Adesão dos clientes ao aplicativo.",
        modulo: "App Cliente",
        kpis: [
          { label: "Habilitados", valor: int(habilitados), tone: "success" },
          { label: "Base no período", valor: int(cls.length), tone: "neutral" },
        ],
        charts: [
          {
            titulo: "Adesão mensal",
            tipo: "line",
            dados: serieMensal(
              cls.filter((c) => c.portal_acesso_ativo).map((c) => ({ data: c.created_at })),
            ),
          },
        ],
        columns: [
          { key: "numero_cliente", label: "Número" },
          { key: "nome", label: "Cliente" },
          { key: "app", label: "App" },
          { key: "created_at", label: "Cadastro", format: "date" },
        ],
        rows: cls.slice(0, 500).map((c) => ({
          numero_cliente: c.numero_cliente,
          nome: c.nome,
          app: c.portal_acesso_ativo ? "Habilitado" : "—",
          created_at: c.created_at,
        })),
      };
    }

    function fluxoMensal(rec: any[], pag: any[]): ChartSerie[] {
      const map = new Map<string, { r: number; p: number }>();
      rec.forEach((x) => {
        // Valores realizados devem ser agrupados pela data de pagamento/recebimento,
        // não pela data de criação do lançamento.
        const m = (x.data_pagamento ?? x.created_at ?? "").slice(0, 7);
        const c = map.get(m) ?? { r: 0, p: 0 };
        c.r += x.valor_recebido ?? 0;
        map.set(m, c);
      });
      pag.forEach((x) => {
        const m = (x.data_pagamento ?? x.created_at ?? "").slice(0, 7);
        const c = map.get(m) ?? { r: 0, p: 0 };
        c.p += x.valor_pago ?? 0;
        map.set(m, c);
      });
      return [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([m, v]) => {
          const [y, mm] = m.split("-");
          return { label: `${mm}/${y.slice(2)}`, valor: v.r, valor2: v.p };
        });
    }

    async function nomesUsuarios(ids: string[]): Promise<Map<string, string>> {
      const out = new Map<string, string>();
      if (!ids.length) return out;
      const { data } = await supabase.from("profiles").select("id,nome").in("id", ids);
      (data ?? []).forEach((p: any) => out.set(p.id, p.nome ?? "—"));
      return out;
    }
  });

/** Registra uma exportação (PDF/XLSX) no histórico e auditoria. */
export const registrarExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { codigo: string; formato: string; registros: number; filtros: Record<string, unknown> }) =>
      d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: corr } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
    await supabase.from("report_exports").insert({
      correspondente_id: corr as string,
      user_id: userId,
      report_codigo: data.codigo,
      formato: data.formato,
      registros: data.registros,
      filtros: data.filtros as any,
      status: "concluido",
    } as any);
    await supabase.from("report_audit_logs").insert({
      correspondente_id: corr as string,
      user_id: userId,
      report_codigo: data.codigo,
      acao: "exportou",
      formato: data.formato,
      registros: data.registros,
      filtros: data.filtros as any,
    } as any);
    return { ok: true };
  });

/** Lista histórico de exportações. */
export const listarExportacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("report_exports")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []) as any[];
  });

/** Retorna se o usuário pode ver escopo de equipe/geral em relatórios. */
export const getEscopoRelatorios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ podeEquipe: boolean; podeGeral: boolean }> => {
    const { supabase, userId } = context;
    const [{ data: geral }, { data: equipe }] = await Promise.all([
      supabase.rpc("can_view_global_reports", { _user_id: userId }),
      supabase.rpc("can_view_team_reports", { _user_id: userId }),
    ]);
    return { podeEquipe: Boolean(equipe), podeGeral: Boolean(geral) };
  });

const REPORTS_DISPONIVEIS = [
  "consolidado",
  "comerciais",
  "simulacoes",
  "propostas",
  "crm",
  "clientes",
  "demandas",
  "tarefas",
  "financeiros",
  "comissoes",
  "app-cliente",
  "operacionais",
] as const;

/** Lista relatórios base disponíveis para o construtor de personalizados. */
export const listarReportsBase = createServerFn({ method: "GET" }).handler(async () => {
  return REPORTS_DISPONIVEIS as unknown as string[];
});

/** Lista filtros salvos (próprios + compartilhados da equipe). */
export const listarFiltrosSalvos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("report_saved_filters")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []) as any[];
  });

const salvarSchema = z.object({
  nome: z.string().min(1),
  report_codigo: z.string().min(1),
  filtros: z.record(z.string(), z.any()).default({}),
  visibilidade: z.enum(["private", "shared_team"]).default("private"),
});

/** Salva um relatório personalizado (filtro salvo). */
export const salvarFiltro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof salvarSchema>) => salvarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: corr } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
    const { error } = await supabase.from("report_saved_filters").insert({
      correspondente_id: corr as string,
      user_id: userId,
      report_codigo: data.report_codigo,
      nome: data.nome,
      filtros: data.filtros as any,
      visibilidade: data.visibilidade,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Exclui um relatório personalizado próprio. */
export const excluirFiltro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("report_saved_filters")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
