import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  resolverIntervalo,
  type ReportFiltros,
  type ReportResult,
  type ChartSerie,
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

async function temPii(supabase: any, userId: string): Promise<boolean> {
  const { data: tudo } = await supabase.rpc("has_any_role", { _user_id: userId, _roles: ["admin", "correspondente"] });
  if (tudo) return true;
  const { data } = await supabase.rpc("usuario_tem_permissao", { _user_id: userId, _modulo: "crm.clientes", _acao: "pii:view" });
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
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, valor]) => ({ label: label || "—", valor }));
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
      correspondente_id: corr as string, user_id: userId, report_codigo: codigo, acao: "visualizou", filtros: filtros as any,
    } as any);

    switch (codigo) {
      case "consolidado":
      case "painel-geral":
        return await relConsolidado();
      case "comerciais":
        return await relComerciais();
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

    async function fetchAll(table: string, cols: string, dateCol: string, colResp: string) {
      let q = (supabase as any).from(table).select(cols).gte(dateCol, de).lte(dateCol, ateFim).order(dateCol, { ascending: false }).limit(5000);
      q = aplicarEscopo(q, filtros, userId, colResp);
      if (filtros.responsavel && colResp) q = q.eq(colResp, filtros.responsavel);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      return (rows ?? []) as any[];
    }

    async function relConsolidado(): Promise<ReportResult> {
      const [sims, props, cls, coms] = await Promise.all([
        fetchAll("simulacoes", "id,status,created_at", "created_at", "usuario_responsavel_id"),
        fetchAll("propostas", "id,status,valor_financiamento,valor_financiamento_aprovado,nome_banco,created_at", "created_at", "usuario_responsavel_id"),
        fetchAll("clientes", "id,created_at", "created_at", "responsavel_id"),
        fetchAll("comissoes", "valor_bruto,created_at", "created_at", "usuario_responsavel_id"),
      ]);
      const enviadas = props.filter((p) => p.status !== "rascunho");
      const aprovadas = props.filter((p) => ["credito_aprovado", "contrato_emitido", "registrado"].includes(p.status));
      const contratos = props.filter((p) => ["contrato_emitido", "registrado"].includes(p.status));
      const volume = contratos.reduce((s, p) => s + (p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0), 0);
      const bancoMap = new Map<string, number>();
      enviadas.forEach((p) => bancoMap.set(p.nome_banco ?? "—", (bancoMap.get(p.nome_banco ?? "—") ?? 0) + 1));
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
          { titulo: "Ranking de bancos", subtitulo: "Propostas enviadas", tipo: "barh", dados: topN(bancoMap, 8) },
          { titulo: "Evolução mensal", subtitulo: "Propostas por mês", tipo: "line", dados: serieMensal(enviadas.map((p) => ({ data: p.created_at }))) },
        ],
        columns: [
          { key: "nome_banco", label: "Banco" },
          { key: "status", label: "Status" },
          { key: "valor", label: "Financiamento", align: "right", footer: "sum", format: "brl" },
          { key: "created_at", label: "Criada em", format: "date" },
        ],
        rows: enviadas.slice(0, 500).map((p) => ({ nome_banco: p.nome_banco ?? "—", status: p.status, valor: p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0, created_at: p.created_at })),
      };
    }

    async function relComerciais(): Promise<ReportResult> {
      const props = await fetchAll("propostas", "id,status,valor_financiamento,valor_financiamento_aprovado,nome_banco,usuario_responsavel_id,created_at", "created_at", "usuario_responsavel_id");
      const enviadas = props.filter((p) => p.status !== "rascunho");
      const aprovadas = props.filter((p) => ["credito_aprovado", "contrato_emitido", "registrado"].includes(p.status));
      const contratos = props.filter((p) => ["contrato_emitido", "registrado"].includes(p.status));
      const valor = contratos.reduce((s, p) => s + (p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0), 0);
      const ticket = contratos.length ? valor / contratos.length : 0;
      const taxa = enviadas.length ? (aprovadas.length / enviadas.length) * 100 : 0;
      const bancoMap = new Map<string, number>();
      enviadas.forEach((p) => bancoMap.set(p.nome_banco ?? "—", (bancoMap.get(p.nome_banco ?? "—") ?? 0) + 1));
      const bancoLider = topN(bancoMap, 1)[0]?.label ?? "—";
      // ranking por usuário
      const respIds = [...new Set(enviadas.map((p) => p.usuario_responsavel_id).filter(Boolean))];
      const nomes = await nomesUsuarios(respIds);
      const userMap = new Map<string, { props: number; contratos: number; valor: number }>();
      enviadas.forEach((p) => {
        const k = p.usuario_responsavel_id ?? "—";
        const cur = userMap.get(k) ?? { props: 0, contratos: 0, valor: 0 };
        cur.props += 1;
        if (["contrato_emitido", "registrado"].includes(p.status)) { cur.contratos += 1; cur.valor += p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0; }
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
          { titulo: "Série mensal", subtitulo: "Propostas x valor", tipo: "line", dados: serieMensal(enviadas.map((p) => ({ data: p.created_at, valor: p.valor_financiamento ?? 0 }))) },
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
          .map(([k, v]) => ({ resp: nomes.get(k) ?? "—", props: v.props, contratos: v.contratos, valor: v.valor })),
      };
    }

    async function relSimulacoes(): Promise<ReportResult> {
      const sims = await fetchAll("simulacoes", "id,tipo_simulacao,status,valor_financiamento,nome_cliente,numero_simulacao,created_at", "created_at", "usuario_responsavel_id");
      const props = await fetchAll("propostas", "id,created_at", "created_at", "usuario_responsavel_id");
      const rapidas = sims.filter((s) => s.tipo_simulacao === "simplificada").length;
      const completas = sims.filter((s) => s.tipo_simulacao === "completa").length;
      const erro = sims.filter((s) => s.status === "erro_banco").length;
      const promovidas = sims.filter((s) => s.status === "promovida").length;
      const conv = sims.length ? (promovidas / sims.length) * 100 : 0;
      const ticket = sims.length ? sims.reduce((s, x) => s + (x.valor_financiamento ?? 0), 0) / sims.length : 0;
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
          { titulo: "Evolução mensal", tipo: "line", dados: serieMensal(sims.map((s) => ({ data: s.created_at }))) },
        ],
        columns: [
          { key: "numero_simulacao", label: "Número" },
          { key: "nome_cliente", label: "Cliente" },
          { key: "tipo", label: "Tipo" },
          { key: "status", label: "Status" },
          { key: "valor", label: "Financiamento", align: "right", footer: "sum", format: "brl" },
          { key: "created_at", label: "Criada em", format: "date" },
        ],
        rows: sims.slice(0, 500).map((s) => ({ numero_simulacao: s.numero_simulacao, nome_cliente: s.nome_cliente ?? "—", tipo: s.tipo_simulacao, status: s.status, valor: s.valor_financiamento ?? 0, created_at: s.created_at })),
      };
    }

    async function relPropostas(): Promise<ReportResult> {
      const props = await fetchAll("propostas", "id,numero_proposta,status,valor_financiamento,valor_financiamento_aprovado,nome_banco,produto,created_at", "created_at", "usuario_responsavel_id");
      const enviadas = props.filter((p) => p.status !== "rascunho");
      const analise = props.filter((p) => ["enviada_banco", "em_analise_credito"].includes(p.status)).length;
      const aprovadas = props.filter((p) => p.status === "credito_aprovado").length;
      const recusadas = props.filter((p) => p.status === "credito_recusado").length;
      const contratos = props.filter((p) => ["contrato_emitido", "registrado"].includes(p.status)).length;
      const bancoMap = new Map<string, number>();
      enviadas.forEach((p) => bancoMap.set(p.nome_banco ?? "—", (bancoMap.get(p.nome_banco ?? "—") ?? 0) + 1));
      const statusMap = new Map<string, number>();
      props.forEach((p) => statusMap.set(p.status, (statusMap.get(p.status) ?? 0) + 1));
      return {
        titulo: "Relatório de propostas",
        descricao: "Status, bancos e volumes das propostas no período.",
        modulo: "Propostas",
        kpis: [
          { label: "Total", valor: int(props.length), tone: "neutral" },
          { label: "Em análise", valor: int(analise), tone: "warning" },
          { label: "Aprovadas", valor: int(aprovadas), tone: "success" },
          { label: "Recusadas", valor: int(recusadas), tone: "danger" },
          { label: "Contratos", valor: int(contratos), tone: "success" },
          { label: "Volume enviado", valor: brl(enviadas.reduce((s, p) => s + (p.valor_financiamento ?? 0), 0)), tone: "brand" },
        ],
        charts: [
          { titulo: "Distribuição por banco", tipo: "barh", dados: topN(bancoMap, 8) },
          { titulo: "Distribuição por status", tipo: "bar", dados: topN(statusMap, 10) },
        ],
        columns: [
          { key: "numero_proposta", label: "Número" },
          { key: "nome_banco", label: "Banco" },
          { key: "produto", label: "Produto" },
          { key: "status", label: "Status" },
          { key: "valor", label: "Financiamento", align: "right", footer: "sum", format: "brl" },
          { key: "created_at", label: "Criada em", format: "date" },
        ],
        rows: props.slice(0, 500).map((p) => ({ numero_proposta: p.numero_proposta, nome_banco: p.nome_banco ?? "—", produto: p.produto ?? "—", status: p.status, valor: p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0, created_at: p.created_at })),
      };
    }

    async function relClientes(): Promise<ReportResult> {
      const cls = await fetchAll("clientes", "id,numero_cliente,nome,documento,tipo_pessoa,ativo,portal_acesso_ativo,responsavel_id,created_at", "created_at", "responsavel_id");
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
          { titulo: "Evolução mensal", tipo: "line", dados: serieMensal(cls.map((c) => ({ data: c.created_at }))) },
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
      const dem = await fetchAll("demandas", "id,numero,titulo,status,prioridade,prazo_sla,concluida_em,responsavel_id,created_at", "created_at", "responsavel_id");
      const agora = new Date();
      const abertas = dem.filter((d) => !["concluida", "cancelada"].includes(d.status)).length;
      const concluidas = dem.filter((d) => d.status === "concluida").length;
      const slaVencido = dem.filter((d) => !["concluida", "cancelada"].includes(d.status) && d.prazo_sla && new Date(d.prazo_sla) < agora).length;
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
        rows: dem.slice(0, 500).map((d) => ({ numero: d.numero, titulo: d.titulo, prioridade: d.prioridade, status: d.status, created_at: d.created_at })),
      };
    }

    async function relTarefas(): Promise<ReportResult> {
      const tk = await fetchAll("tasks", "id,numero,titulo,status,prioridade,prazo,concluida_em,responsavel_id,created_at", "created_at", "responsavel_id");
      const agora = new Date();
      const abertas = tk.filter((t) => !["concluida", "cancelada"].includes(t.status)).length;
      const concluidas = tk.filter((t) => t.status === "concluida").length;
      const atrasadas = tk.filter((t) => !["concluida", "cancelada"].includes(t.status) && t.prazo && new Date(t.prazo) < agora).length;
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
        rows: tk.slice(0, 500).map((t) => ({ numero: t.numero, titulo: t.titulo, prioridade: t.prioridade, status: t.status, created_at: t.created_at })),
      };
    }

    async function relFinanceiro(): Promise<ReportResult> {
      const [pag, rec] = await Promise.all([
        supabase.from("financial_payables").select("valor,valor_pago,status,vencimento,descricao,created_at").gte("created_at", de).lte("created_at", ateFim).limit(5000).then((r: any) => r.data ?? []),
        supabase.from("financial_receivables").select("valor,valor_recebido,status,vencimento,descricao,created_at").gte("created_at", de).lte("created_at", ateFim).limit(5000).then((r: any) => r.data ?? []),
      ]);
      const hojeStr = new Date().toISOString().slice(0, 10);
      const aReceber = rec.filter((r: any) => ["aberta", "parcial"].includes(r.status)).reduce((s: number, r: any) => s + (r.valor ?? 0), 0);
      const aPagar = pag.filter((r: any) => ["aberta", "parcial"].includes(r.status)).reduce((s: number, r: any) => s + (r.valor ?? 0), 0);
      const pago = pag.reduce((s: number, r: any) => s + (r.valor_pago ?? 0), 0);
      const recebido = rec.reduce((s: number, r: any) => s + (r.valor_recebido ?? 0), 0);
      const vencido = [...pag, ...rec].filter((r: any) => ["aberta", "parcial"].includes(r.status) && r.vencimento && r.vencimento < hojeStr).reduce((s: number, r: any) => s + (r.valor ?? 0), 0);
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
          { titulo: "Fluxo mensal", subtitulo: "Recebido x pago", tipo: "line", moeda: true, serie1: "Recebido", serie2: "Pago", dados: fluxoMensal(rec, pag) },
        ],
        columns: [
          { key: "tipo", label: "Tipo" },
          { key: "descricao", label: "Descrição" },
          { key: "status", label: "Status" },
          { key: "vencimento", label: "Vencimento", format: "date" },
          { key: "valor", label: "Valor", align: "right", footer: "sum", format: "brl" },
        ],
        rows: [
          ...rec.map((r: any) => ({ tipo: "Receber", descricao: r.descricao ?? "—", status: r.status, vencimento: r.vencimento, valor: r.valor ?? 0 })),
          ...pag.map((r: any) => ({ tipo: "Pagar", descricao: r.descricao ?? "—", status: r.status, vencimento: r.vencimento, valor: r.valor ?? 0 })),
        ].slice(0, 800),
      };
    }

    async function relComissoes(): Promise<ReportResult> {
      const coms = await supabase.from("comissoes").select("valor_bruto,split_parceiro,split_interno,status,usuario_responsavel_id,created_at").gte("created_at", de).lte("created_at", ateFim).limit(5000).then((r: any) => r.data ?? []);
      const prevista = coms.reduce((s: number, c: any) => s + (c.valor_bruto ?? 0), 0);
      const paga = coms.filter((c: any) => c.status === "paga_parceiro" || c.status === "encerrada").reduce((s: number, c: any) => s + (c.valor_bruto ?? 0), 0);
      const ticket = coms.length ? prevista / coms.length : 0;
      const respIds = [...new Set(coms.map((c: any) => c.usuario_responsavel_id).filter(Boolean))] as string[];
      const nomes = await nomesUsuarios(respIds);
      const userMap = new Map<string, number>();
      coms.forEach((c: any) => userMap.set(c.usuario_responsavel_id ?? "—", (userMap.get(c.usuario_responsavel_id ?? "—") ?? 0) + (c.valor_bruto ?? 0)));
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
        charts: [{ titulo: "Ranking por responsável", tipo: "barh", moeda: true, dados: [...userMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ label: nomes.get(k) ?? "—", valor: v })) }],
        columns: [
          { key: "resp", label: "Responsável" },
          { key: "valor", label: "Comissão", align: "right", footer: "sum", format: "brl" },
        ],
        rows: [...userMap.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ resp: nomes.get(k) ?? "—", valor: v })),
      };
    }

    async function relAppCliente(): Promise<ReportResult> {
      const cls = await fetchAll("clientes", "id,numero_cliente,nome,portal_acesso_ativo,created_at", "created_at", "responsavel_id");
      const habilitados = cls.filter((c) => c.portal_acesso_ativo).length;
      return {
        titulo: "Relatório do App do Cliente",
        descricao: "Adesão dos clientes ao aplicativo.",
        modulo: "App Cliente",
        kpis: [
          { label: "Habilitados", valor: int(habilitados), tone: "success" },
          { label: "Base no período", valor: int(cls.length), tone: "neutral" },
        ],
        charts: [{ titulo: "Adesão mensal", tipo: "line", dados: serieMensal(cls.filter((c) => c.portal_acesso_ativo).map((c) => ({ data: c.created_at }))) }],
        columns: [
          { key: "numero_cliente", label: "Número" },
          { key: "nome", label: "Cliente" },
          { key: "app", label: "App" },
          { key: "created_at", label: "Cadastro", format: "date" },
        ],
        rows: cls.slice(0, 500).map((c) => ({ numero_cliente: c.numero_cliente, nome: c.nome, app: c.portal_acesso_ativo ? "Habilitado" : "—", created_at: c.created_at })),
      };
    }

    function fluxoMensal(rec: any[], pag: any[]): ChartSerie[] {
      const map = new Map<string, { r: number; p: number }>();
      rec.forEach((x) => { const m = (x.created_at ?? "").slice(0, 7); const c = map.get(m) ?? { r: 0, p: 0 }; c.r += x.valor_recebido ?? 0; map.set(m, c); });
      pag.forEach((x) => { const m = (x.created_at ?? "").slice(0, 7); const c = map.get(m) ?? { r: 0, p: 0 }; c.p += x.valor_pago ?? 0; map.set(m, c); });
      return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([m, v]) => { const [y, mm] = m.split("-"); return { label: `${mm}/${y.slice(2)}`, valor: v.r, valor2: v.p }; });
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
  .inputValidator((d: { codigo: string; formato: string; registros: number; filtros: Record<string, unknown> }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: corr } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
    await supabase.from("report_exports").insert({
      correspondente_id: corr as string, user_id: userId, report_codigo: data.codigo, formato: data.formato, registros: data.registros, filtros: data.filtros as any, status: "concluido",
    } as any);
    await supabase.from("report_audit_logs").insert({
      correspondente_id: corr as string, user_id: userId, report_codigo: data.codigo, acao: "exportou", formato: data.formato, registros: data.registros, filtros: data.filtros as any,
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
  "consolidado", "comerciais", "simulacoes", "propostas", "crm", "clientes",
  "demandas", "tarefas", "financeiros", "comissoes", "app-cliente", "operacionais",
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
    const { data } = await supabase.from("report_saved_filters").select("*").order("created_at", { ascending: false }).limit(100);
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
      correspondente_id: corr as string, user_id: userId, report_codigo: data.report_codigo,
      nome: data.nome, filtros: data.filtros as any, visibilidade: data.visibilidade,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Exclui um relatório personalizado próprio. */
export const excluirFiltro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("report_saved_filters").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
