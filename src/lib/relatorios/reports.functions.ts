import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  resolverIntervalo,
  type ReportFiltros,
  type ReportResult,
  type ChartSerie,
  type ReportChart,
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
    bancos: z.array(z.string()).optional(),
    analistas: z.array(z.string()).optional(),
    comerciais: z.array(z.string()).optional(),
    corretores: z.array(z.string()).optional(),
    imobiliarias: z.array(z.string()).optional(),
  }),
});

const brl = (v: number) => (v || 0).toLocaleString("pt-BR", {  style: "currency", currency: "BRL" });
const int = (v: number) => (v || 0).toLocaleString("pt-BR");
const pct = (v: number) => `${(v || 0).toLocaleString("pt-BR", {  maximumFractionDigits: 1 })}%`;

/** Rótulos oficiais dos status de proposta (espelha components/propostas/status.ts). */
const STATUS_PROPOSTA_LABEL: Record<string, string> = {
  rascunho: "Simulação",
  enviada_banco: "Enviada ao banco",
  em_analise_credito: "Em análise de crédito",
  aguardando_documentos: "Aguardando documentos",
  credito_aprovado: "Crédito aprovado",
  credito_recusado: "Crédito recusado",
  engenharia_vistoria: "Engenharia / vistoria",
  analise_juridica: "Análise jurídica",
  contrato_emitido: "Contrato emitido",
  registrado: "Registrado",
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
/** Status ocultos no filtro (transientes/técnicos). Simulação (rascunho) fica visível. */
const STATUS_PROPOSTA_OCULTOS = new Set([
  "enviada_banco",
  "registrado",
  "erro_envio",
]);
function statusOpcoesPorCodigo(codigo: string): { value: string; label: string }[] | undefined {
  const filtrarPropostas = () =>
    opcoes(STATUS_PROPOSTA_LABEL).filter((o) => !STATUS_PROPOSTA_OCULTOS.has(o.value));
  switch (codigo) {
    case "consolidado":
    case "painel-geral":
    case "comerciais":
    case "gerencial":
    case "propostas":
    case "operacionais":
      return filtrarPropostas();
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

/**
 * Aplica os filtros de pessoa (analista, comercial, corretor, imobiliária) e banco.
 * Cada grupo é multi-seleção (OR interno) e os grupos se combinam (AND entre grupos).
 * As colunas específicas (analista_id, comercial_id, parceiro_id, nome_banco) só são
 * usadas quando presentes no `select`; caso contrário cai no responsável genérico.
 */
function aplicarFiltrosPessoa(query: any, filtros: ReportFiltros, cols: string, colResp: string) {
  const temCol = (c: string) => `,${cols.replace(/\s/g, "")},`.includes(`,${c},`);
  const naoVazio = (a?: string[]) => Array.isArray(a) && a.length > 0;

  if (temCol("analista_id") && naoVazio(filtros.analistas))
    query = query.in("analista_id", filtros.analistas);
  if (temCol("comercial_id") && naoVazio(filtros.comerciais))
    query = query.in("comercial_id", filtros.comerciais);

  const parceiros = [...(filtros.corretores ?? []), ...(filtros.imobiliarias ?? [])];
  if (temCol("parceiro_id") && parceiros.length > 0)
    query = query.in("parceiro_id", parceiros);

  if (temCol("nome_banco") && naoVazio(filtros.bancos))
    query = query.in("nome_banco", filtros.bancos);

  // Fallback: relatórios que só têm a coluna de responsável recebem a união dos ids.
  if (colResp && !temCol("analista_id") && !temCol("comercial_id") && !temCol("parceiro_id")) {
    const uniao = [
      ...(filtros.analistas ?? []),
      ...(filtros.comerciais ?? []),
      ...(filtros.corretores ?? []),
      ...(filtros.imobiliarias ?? []),
    ];
    if (uniao.length > 0) query = query.in(colResp, uniao);
  }
  return query;
}

const statusEhFiltroSimulacao = (status?: string) => status === "rascunho" || status === "simulacao";

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
        case "operacional-simulacoes":
          return await relOperacionalSimulacoes();
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
    const pessoas = await listarPessoas();
    resultado.filtrosDisponiveis = {
      ...resultado.filtrosDisponiveis,
      statuses: resultado.filtrosDisponiveis?.statuses ?? statusOpcoesPorCodigo(codigo),
      responsaveis: pessoas.todos,
      analistas: pessoas.analistas,
      comerciais: pessoas.comerciais,
      corretores: pessoas.corretores,
      imobiliarias: pessoas.imobiliarias,
    };
    return resultado;

    async function listarPessoas() {
      type Opt = { value: string; label: string };
      let q = (supabase as any)
        .from("profiles")
        .select("id,nome,ativo,tipo_pessoa,tipos_pessoa")
        .order("nome", { ascending: true })
        .limit(1000);
      if (corr) q = q.eq("correspondente_id", corr);
      const { data } = await q;
      const linhas = ((data ?? []) as any[]).filter((p) => p.ativo !== false && p.nome);
      const opt = (p: any): Opt => ({ value: p.id as string, label: p.nome as string });
      // Uma pessoa pode ter múltiplos tipos (tipos_pessoa); considere todos.
      const tiposDe = (p: any): string[] => {
        const arr = Array.isArray(p.tipos_pessoa) ? p.tipos_pessoa.filter(Boolean) : [];
        return arr.length > 0 ? arr : [p.tipo_pessoa].filter(Boolean);
      };
      const porTipo = (slug: string) =>
        linhas.filter((p) => tiposDe(p).includes(slug)).map(opt);
      return {
        todos: linhas.map(opt),
        // "usuario" = Analista; "comercial" = Comercial Agilliza (ver tipos_pessoa).
        analistas: porTipo("usuario"),
        comerciais: porTipo("comercial"),
        corretores: porTipo("corretor"),
        imobiliarias: porTipo("imobiliaria"),
      };
    }


    async function comparativoMensalPropostas(): Promise<ComparativoMensal | undefined> {
      const hojeStr = new Date().toLocaleDateString("en-CA");
      const [hy, hm] = hojeStr.split("-").map(Number);
      const inicio = new Date(hy, hm - 1 - 5, 1); // 1º dia, 5 meses atrás
      const isoDia = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const colsCmp =
        "status,nome_banco,created_at,analista_id,comercial_id,parceiro_id,usuario_responsavel_id";
      let q = (supabase as any)
        .from("propostas")
        .select(colsCmp)
        .gte("created_at", isoDia(inicio))
        .order("created_at", { ascending: true })
        .limit(20000);
      q = aplicarEscopo(q, filtros, userId, "usuario_responsavel_id");
      if (filtros.responsavel) q = q.eq("usuario_responsavel_id", filtros.responsavel);
      q = aplicarFiltrosPessoa(q, filtros, colsCmp, "usuario_responsavel_id");
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
      const colsCompact = `,${cols.replace(/\s/g, "")},`;
      const temCol = (c: string) => colsCompact.includes(`,${c},`);
      let q = (supabase as any)
        .from(table)
        .select(cols)
        .gte(dateCol, de)
        .lte(dateCol, ateFim)
        .order(dateCol, { ascending: false })
        .limit(5000);
      // Ignora registros soft-deleted em tabelas que suportam exclusão lógica.
      const TEM_SOFT_DELETE = new Set([
        "simulacoes",
        "propostas",
        "clientes",
        "tasks",
        "demandas",
      ]);
      if (TEM_SOFT_DELETE.has(table)) q = q.is("deleted_at", null);
      q = aplicarEscopo(q, filtros, userId, colResp);
      if (filtros.responsavel && colResp) q = q.eq(colResp, filtros.responsavel);
      if (filtros.banco && temCol("nome_banco")) q = q.eq("nome_banco", filtros.banco);
      if (filtros.produto && temCol("produto")) q = q.eq("produto", filtros.produto);
      if (filtros.valorMin != null && temCol("valor_financiamento"))
        q = q.gte("valor_financiamento", filtros.valorMin);
      if (filtros.valorMax != null && temCol("valor_financiamento"))
        q = q.lte("valor_financiamento", filtros.valorMax);
      q = aplicarFiltrosPessoa(q, filtros, cols, colResp);
      // Filtro por status: usa a coluna informada ou "status" quando presente no select.
      const statusCol =
        opts?.statusCol === false
          ? undefined
          : (opts?.statusCol ??
            (`,${cols.replace(/\s/g, "")},`.includes(",status,") ? "status" : undefined));
      if (filtros.status && statusCol) q = q.eq(statusCol, filtros.status);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      const buscaLc = [filtros.busca, filtros.cliente].filter(Boolean).join(" ").trim().toLowerCase();
      if (!buscaLc) return (rows ?? []) as any[];
      return ((rows ?? []) as any[]).filter((r) =>
        Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(buscaLc)),
      );
    }

    async function listarOpcoesOperacionais() {
      const [{ data: bancosCad }, { data: bancosSims }, { data: prodProps }, { data: prodSims }] =
        await Promise.all([
          supabase
            .from("homefin_bancos")
            .select("nome_banco")
            .eq("ativo", true)
            .order("nome_banco", { ascending: true }),
          supabase.from("simulacao_bancos").select("nome_banco").limit(20000),
          supabase.from("propostas").select("produto").limit(20000),
          supabase.from("simulacoes").select("produto").limit(20000),
        ]);
      const bancos = [
        ...new Set(
          [...((bancosCad ?? []) as any[]), ...((bancosSims ?? []) as any[])]
            .map((b) => String(b.nome_banco ?? ""))
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "pt-BR"));
      const produtos = [
        ...new Set(
          [
            "financiamento_imobiliario",
            "home_equity",
            ...((prodProps ?? []) as any[]).map((p) => String(p.produto ?? "")),
            ...((prodSims ?? []) as any[]).map((p) => String(p.produto ?? "")),
          ].filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "pt-BR"));
      return { bancos, produtos };
    }

    async function fetchSimulacoesRelatorio(opts?: { rascunhoComoModulo?: boolean }) {
      const cols = [
        "id",
        "numero_simulacao",
        "cliente_id",
        "tipo_simulacao",
        "status",
        "produto",
        "valor_financiamento",
        "nome_cliente",
        "usuario_responsavel_id",
        "analista_id",
        "comercial_id",
        "parceiro_id",
        "created_at",
      ].join(",");
      const sims = await fetchAll("simulacoes", cols, "created_at", "usuario_responsavel_id", {
        statusCol: opts?.rascunhoComoModulo && statusEhFiltroSimulacao(filtros.status) ? false : undefined,
      });
      if (!sims.length) return sims;

      const ids = sims.map((s) => s.id).filter(Boolean);
      const { data: bancosRows } = await supabase
        .from("simulacao_bancos")
        .select("simulacao_id,nome_banco,status_banco,valor_financiamento_max,valor_parcela")
        .in("simulacao_id", ids)
        .limit(20000);
      if (bancosRows === null) {
        const { data: bancoTeste, error: bancoError } = await supabase
          .from("simulacao_bancos")
          .select("simulacao_id")
          .limit(1);
        if (bancoError) throw new Error(bancoError.message);
        if (bancoTeste === null) throw new Error("Não foi possível carregar bancos das simulações.");
      }
      const porSim = new Map<string, any[]>();
      ((bancosRows ?? []) as any[]).forEach((b) => {
        const k = String(b.simulacao_id ?? "");
        if (!k) return;
        const cur = porSim.get(k) ?? [];
        cur.push(b);
        porSim.set(k, cur);
      });

      const bancosFiltro = [...(filtros.bancos ?? []), filtros.banco]
        .filter(Boolean)
        .map((b) => String(b).trim().toLowerCase()) as string[];
      const buscaLc = [filtros.busca, filtros.cliente].filter(Boolean).join(" ").trim().toLowerCase();
      return sims
        .map((s) => {
          const bancos = porSim.get(s.id) ?? [];
          const nomesBancos = [
            ...new Set(bancos.map((b) => String(b.nome_banco ?? "")).filter(Boolean)),
          ];
          return {
            ...s,
            bancos,
            nomes_bancos: nomesBancos,
            nome_banco: nomesBancos[0] ?? "—",
            bancos_label: nomesBancos.length ? nomesBancos.join(", ") : "—",
          };
        })
        .filter((s) => {
          if (!bancosFiltro.length) return true;
          const nomesLc = s.nomes_bancos.map((n: string) => n.trim().toLowerCase());
          return bancosFiltro.some((b) => nomesLc.includes(b));
        })

        .filter((s) => {
          if (!buscaLc) return true;
          const alvo = [
            s.numero_simulacao,
            s.nome_cliente,
            s.produto,
            s.status,
            s.bancos_label,
          ]
            .map((v) => String(v ?? ""))
            .join(" ")
            .toLowerCase();
          return alvo.includes(buscaLc);
        });
    }

    function montarResultadoSimulacoes(
      sims: any[],
      cfg?: { titulo?: string; descricao?: string; modulo?: string; statusComoModulo?: boolean },
    ): ReportResult {
      const rapidas = sims.filter((s) => s.tipo_simulacao === "simplificada").length;
      const completas = sims.filter((s) => s.tipo_simulacao === "completa").length;
      const erro = sims.filter((s) => s.status === "erro_banco").length;
      const promovidas = sims.filter((s) => s.status === "promovida").length;
      const simuladas = sims.filter((s) =>
        ["simulada", "parcialmente_simulada", "promovida"].includes(s.status),
      );
      const conv = sims.length ? (promovidas / sims.length) * 100 : 0;
      const volumeSimulado = simuladas.reduce((s, x) => s + (x.valor_financiamento ?? 0), 0);
      const ticket = simuladas.length ? volumeSimulado / simuladas.length : 0;
      const statusMap = new Map<string, number>();
      const bancoMap = new Map<string, number>();
      const produtoMap = new Map<string, number>();
      sims.forEach((s) => {
        const statusLabel = cfg?.statusComoModulo
          ? STATUS_SIMULACAO_LABEL[s.status] ?? s.status
          : STATUS_SIMULACAO_LABEL[s.status] ?? s.status;
        statusMap.set(statusLabel, (statusMap.get(statusLabel) ?? 0) + 1);
        produtoMap.set(s.produto ?? "—", (produtoMap.get(s.produto ?? "—") ?? 0) + 1);
        (s.nomes_bancos?.length ? s.nomes_bancos : ["—"]).forEach((b: string) =>
          bancoMap.set(b, (bancoMap.get(b) ?? 0) + 1),
        );
      });
      return {
        titulo: cfg?.titulo ?? "Relatório de simulações",
        descricao: cfg?.descricao ?? "Volume, tipo e conversão de simulações.",
        modulo: cfg?.modulo ?? "Simulações",
        kpis: [
          { label: "Total", valor: int(sims.length), tone: "neutral" },
          { label: "Rápidas", valor: int(rapidas), tone: "neutral" },
          { label: "Completas", valor: int(completas), tone: "brand" },
          { label: "Com erro", valor: int(erro), tone: "danger" },
          { label: "Volume simulado", valor: brl(volumeSimulado), tone: "success" },
          { label: "Conversão sim→prop", valor: pct(conv), tone: "success" },
          { label: "Ticket médio", valor: brl(ticket), tone: "brand" },
        ],
        charts: [
          { titulo: "Distribuição por status", tipo: "barh", dados: topN(statusMap, 8) },
          { titulo: "Distribuição por banco", tipo: "barh", dados: topN(bancoMap, 10) },
          { titulo: "Distribuição por produto", tipo: "barh", dados: topN(produtoMap, 8) },
          {
            titulo: "Evolução mensal",
            tipo: "line",
            dados: serieMensal(sims.map((s) => ({ data: s.created_at, valor: s.valor_financiamento ?? 0 }))),
          },
        ],
        columns: [
          { key: "numero_simulacao", label: "Número" },
          { key: "nome_cliente", label: "Cliente" },
          { key: "tipo", label: "Tipo" },
          { key: "produto", label: "Produto" },
          { key: "bancos", label: "Bancos" },
          { key: "status", label: "Status" },
          { key: "valor", label: "Financiamento", align: "right", footer: "sum", format: "brl" },
          { key: "created_at", label: "Criada em", format: "date" },
        ],
        rows: sims.slice(0, 1000).map((s) => ({
          numero_simulacao: s.numero_simulacao,
          nome_cliente: s.nome_cliente ?? "—",
          tipo: s.tipo_simulacao,
          produto: s.produto ?? "—",
          bancos: s.bancos_label ?? "—",
          status: STATUS_SIMULACAO_LABEL[s.status] ?? s.status,
          valor: s.valor_financiamento ?? 0,
          created_at: s.created_at,
        })),
      };
    }

    async function relConsolidado(): Promise<ReportResult> {
      if (statusEhFiltroSimulacao(filtros.status)) {
        const [sims, opcoesOperacionais] = await Promise.all([
          fetchSimulacoesRelatorio({ rascunhoComoModulo: true }),
          listarOpcoesOperacionais(),
        ]);
        return {
          ...montarResultadoSimulacoes(sims, {
            titulo: "Painel geral — simulações",
            descricao: "Simulações reais filtradas por período, banco, produto e responsável.",
            modulo: "Consolidado",
            statusComoModulo: true,
          }),
          filtrosDisponiveis: {
            bancos: opcoesOperacionais.bancos,
            produtos: opcoesOperacionais.produtos,
            statuses: statusOpcoesPorCodigo("consolidado"),
          },
        };
      }
      const [sims, props, cls, coms] = await Promise.all([
        fetchAll("simulacoes", "id,status,created_at", "created_at", "usuario_responsavel_id", {
          statusCol: false,
        }),
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
      const [props, sims, opcoesOperacionais] = await Promise.all([
        fetchAll(
          "propostas",
          "id,status,produto,valor_financiamento,valor_financiamento_aprovado,nome_banco,usuario_responsavel_id,analista_id,comercial_id,parceiro_id,created_at",
          "created_at",
          "usuario_responsavel_id",
          { statusCol: statusEhFiltroSimulacao(filtros.status) ? false : undefined },
        ),
        fetchSimulacoesRelatorio({ rascunhoComoModulo: true }),
        listarOpcoesOperacionais(),
      ]);
      const somenteSimulacoes = statusEhFiltroSimulacao(filtros.status);
      const propsFiltradas = somenteSimulacoes ? [] : props;
      const enviadas = propsFiltradas.filter((p) => p.status !== "rascunho");
      const aprovadas = propsFiltradas.filter((p) =>
        ["credito_aprovado", "contrato_emitido", "registrado"].includes(p.status),
      );
      const contratos = propsFiltradas.filter((p) => ["contrato_emitido", "registrado"].includes(p.status));
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
      const respIds = [
        ...new Set(
          [...enviadas, ...sims].map((p) => p.usuario_responsavel_id).filter(Boolean),
        ),
      ];
      const nomes = await nomesUsuarios(respIds);
      const userMap = new Map<string, { sims: number; props: number; contratos: number; valor: number }>();
      sims.forEach((s) => {
        const k = s.usuario_responsavel_id ?? "—";
        const cur = userMap.get(k) ?? { sims: 0, props: 0, contratos: 0, valor: 0 };
        cur.sims += 1;
        userMap.set(k, cur);
      });
      enviadas.forEach((p) => {
        const k = p.usuario_responsavel_id ?? "—";
        const cur = userMap.get(k) ?? { sims: 0, props: 0, contratos: 0, valor: 0 };
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
          { label: "Simulações", valor: int(sims.length), tone: "neutral" },
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
          { key: "sims", label: "Simulações", align: "right", footer: "sum", format: "int" },
          { key: "props", label: "Propostas", align: "right", footer: "sum", format: "int" },
          { key: "contratos", label: "Contratos", align: "right", footer: "sum", format: "int" },
          { key: "valor", label: "Valor contratado", align: "right", footer: "sum", format: "brl" },
        ],
        rows: [...userMap.entries()]
          .sort((a, b) => b[1].valor - a[1].valor)
          .slice(0, 50)
          .map(([k, v]) => ({
            resp: nomes.get(k) ?? "—",
            sims: v.sims,
            props: v.props,
            contratos: v.contratos,
            valor: v.valor,
          })),
        filtrosDisponiveis: {
          bancos: opcoesOperacionais.bancos,
          produtos: opcoesOperacionais.produtos,
          statuses: statusOpcoesPorCodigo("comerciais"),
        },
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
      const statusSimulacao = statusEhFiltroSimulacao(filtros.status);
      const statusContrato = ["contrato_emitido", "registrado"];
      const [simulacoesFiltradas, propostasFiltradas, opcoesOperacionais] = await Promise.all([
        statusSimulacao || !filtros.status
          ? fetchSimulacoesRelatorio({ rascunhoComoModulo: true })
          : Promise.resolve([] as any[]),
        statusSimulacao ? Promise.resolve([] as any[]) : fetchPropostasGerenciais(),
        listarOpcoesOperacionais(),
      ]);
      const contratosOperacionais =
        !statusSimulacao && (!filtros.status || statusContrato.includes(filtros.status))
          ? await carregarContratosGerenciais()
          : [];

      async function fetchPropostasGerenciais() {
        const cols = [
          "id",
          "cliente_id",
          "numero_proposta",
          "numero_proposta_banco",
          "nome_cliente",
          "cpf_cnpj",
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
        if (filtros.produto) q = q.eq("produto", filtros.produto);
        if (filtros.status && !statusSimulacao) q = q.eq("status", filtros.status);
        // Banco é filtrado após enriquecer com proposta_bancos; aqui removemos só o filtro de banco.
        const filtrosSemBanco = { ...filtros, banco: undefined, bancos: undefined } as ReportFiltros;
        q = aplicarFiltrosPessoa(q, filtrosSemBanco, cols, "usuario_responsavel_id");
        const { data: rowsRaw, error } = await q;
        if (error) throw new Error(error.message);
        const propsBase = (rowsRaw ?? []) as any[];
        if (!propsBase.length) return propsBase;

        const ids = propsBase.map((p) => p.id).filter(Boolean);
        const { data: bancosRows, error: bancosError } = await supabase
          .from("proposta_bancos")
          .select("proposta_id,nome_banco,numero_proposta_banco,status_banco,valor_financiamento_max,valor_parcela")
          .in("proposta_id", ids)
          .limit(20000);
        if (bancosError) throw new Error(bancosError.message);

        const porProposta = new Map<string, any[]>();
        ((bancosRows ?? []) as any[]).forEach((b) => {
          const k = String(b.proposta_id ?? "");
          if (!k) return;
          const cur = porProposta.get(k) ?? [];
          cur.push(b);
          porProposta.set(k, cur);
        });

        const bancosFiltro = [...(filtros.bancos ?? []), filtros.banco]
          .filter(Boolean)
          .map((b) => String(b).trim().toLowerCase()) as string[];
        const buscaLc = [filtros.busca, filtros.cliente].filter(Boolean).join(" ").trim().toLowerCase();
        const valorProposta = (p: any) => p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0;

        return propsBase
          .map((p) => {
            const bancos = porProposta.get(p.id) ?? [];
            const nomesBancos = [
              ...new Set(
                [p.nome_banco, ...bancos.map((b) => b.nome_banco)]
                  .map((b) => String(b ?? "").trim())
                  .filter(Boolean),
              ),
            ];
            const numeroBanco =
              p.numero_proposta_banco ||
              bancos.find((b) => b.numero_proposta_banco)?.numero_proposta_banco ||
              null;
            return {
              ...p,
              bancos,
              nomes_bancos: nomesBancos,
              nome_banco: p.nome_banco || nomesBancos[0] || "—",
              bancos_label: nomesBancos.length ? nomesBancos.join(", ") : "—",
              numero_proposta_banco: numeroBanco,
            };
          })
          .filter((p) => p.status !== "rascunho")
          .filter((p) => {
            if (!bancosFiltro.length) return true;
            const nomesLc = p.nomes_bancos.map((n: string) => n.trim().toLowerCase());
            return bancosFiltro.some((b) => nomesLc.includes(b));
          })

          .filter((p) => filtros.valorMin == null || valorProposta(p) >= filtros.valorMin!)
          .filter((p) => filtros.valorMax == null || valorProposta(p) <= filtros.valorMax!)
          .filter((p) => {
            if (!buscaLc) return true;
            const alvo = [
              p.numero_proposta,
              p.numero_proposta_banco,
              p.nome_cliente,
              p.cpf_cnpj,
              p.produto,
              p.status,
              rotuloStatus(p.status),
              p.bancos_label,
              p.analista_nome,
              p.consultor_nome,
              p.parceiro_nome,
            ]
              .map((v) => String(v ?? ""))
              .join(" ")
              .toLowerCase();
            return alvo.includes(buscaLc);
          });
      }

      async function carregarContratosGerenciais() {
        let q = (supabase as any)
          .from("clientes")
          .select("id,nome,documento,responsavel_id,contrato_emitido_em,imovel_valor")
          .not("contrato_emitido_em", "is", null)
          .gte("contrato_emitido_em", de)
          .lte("contrato_emitido_em", ate)
          .order("contrato_emitido_em", { ascending: false })
          .limit(10000);
        q = aplicarEscopo(q, filtros, userId, "responsavel_id");
        if (filtros.responsavel) q = q.eq("responsavel_id", filtros.responsavel);
        const { data: clientesRaw, error } = await q;
        if (error) throw new Error(error.message);
        const clientes = (clientesRaw ?? []) as any[];
        if (!clientes.length) return [] as any[];

        const clienteIds = clientes.map((c) => c.id).filter(Boolean);
        const propCols = [
          "id",
          "cliente_id",
          "numero_proposta",
          "numero_proposta_banco",
          "nome_cliente",
          "cpf_cnpj",
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
        const { data: propsRaw, error: propsError } = await supabase
          .from("propostas")
          .select(propCols)
          .in("cliente_id", clienteIds)
          .order("created_at", { ascending: false })
          .limit(10000);
        if (propsError) throw new Error(propsError.message);

        const propsBase = (propsRaw ?? []) as any[];
        const propIds = propsBase.map((p) => p.id).filter(Boolean);
        const porPropostaBanco = new Map<string, any[]>();
        if (propIds.length) {
          const { data: bancosRows, error: bancosError } = await supabase
            .from("proposta_bancos")
            .select("proposta_id,nome_banco,numero_proposta_banco,status_banco,valor_financiamento_max,valor_parcela")
            .in("proposta_id", propIds)
            .limit(20000);
          if (bancosError) throw new Error(bancosError.message);
          ((bancosRows ?? []) as any[]).forEach((b) => {
            const k = String(b.proposta_id ?? "");
            if (!k) return;
            const cur = porPropostaBanco.get(k) ?? [];
            cur.push(b);
            porPropostaBanco.set(k, cur);
          });
        }

        const porCliente = new Map<string, any[]>();
        for (const p of propsBase) {
          const bancos = porPropostaBanco.get(p.id) ?? [];
          const nomesBancos = [
            ...new Set(
              [p.nome_banco, ...bancos.map((b) => b.nome_banco)]
                .map((b) => String(b ?? "").trim())
                .filter(Boolean),
            ),
          ];
          const enriquecida = {
            ...p,
            bancos,
            nomes_bancos: nomesBancos,
            nome_banco: p.nome_banco || nomesBancos[0] || "—",
            bancos_label: nomesBancos.length ? nomesBancos.join(", ") : "—",
            numero_proposta_banco:
              p.numero_proposta_banco ||
              bancos.find((b) => b.numero_proposta_banco)?.numero_proposta_banco ||
              null,
          };
          const arr = porCliente.get(String(p.cliente_id)) ?? [];
          arr.push(enriquecida);
          porCliente.set(String(p.cliente_id), arr);
        }

        const bancosFiltro = [...(filtros.bancos ?? []), filtros.banco].filter(Boolean) as string[];
        const buscaLc = [filtros.busca, filtros.cliente].filter(Boolean).join(" ").trim().toLowerCase();
        const valorContrato = (p: any) => p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0;
        const naoVazio = (a?: string[]) => Array.isArray(a) && a.length > 0;
        const contemPessoa = (ids: string[] | undefined, ...vals: unknown[]) =>
          !naoVazio(ids) || vals.some((v) => typeof v === "string" && ids!.includes(v));

        return clientes
          .map((c) => {
            const candidatas = porCliente.get(String(c.id)) ?? [];
            const prop = candidatas.find((p) => statusContrato.includes(p.status)) ?? candidatas[0];
            return {
              ...(prop ?? {}),
              id: prop?.id ?? c.id,
              cliente_id: c.id,
              nome_cliente: prop?.nome_cliente ?? c.nome ?? "—",
              cpf_cnpj: prop?.cpf_cnpj ?? c.documento ?? null,
              status: prop?.status && statusContrato.includes(prop.status) ? prop.status : "contrato_emitido",
              usuario_responsavel_id: prop?.usuario_responsavel_id ?? c.responsavel_id,
              contrato_emitido_em: c.contrato_emitido_em,
              created_at: prop?.created_at ?? c.contrato_emitido_em,
              valor_financiamento_aprovado:
                prop?.valor_financiamento_aprovado ?? prop?.valor_financiamento ?? c.imovel_valor ?? 0,
            };
          })
          .filter((p) => !filtros.status || p.status === filtros.status)
          .filter((p) => !filtros.produto || p.produto === filtros.produto)
          .filter((p) => {
            if (!bancosFiltro.length) return true;
            const nomes = p.nomes_bancos?.length ? p.nomes_bancos : [p.nome_banco].filter(Boolean);
            return bancosFiltro.some((b) => nomes.includes(b));
          })
          .filter((p) => contemPessoa(filtros.analistas, p.analista_id, p.usuario_responsavel_id))
          .filter((p) => contemPessoa(filtros.comerciais, p.comercial_id))
          .filter((p) => contemPessoa([...(filtros.corretores ?? []), ...(filtros.imobiliarias ?? [])], p.parceiro_id))
          .filter((p) => filtros.valorMin == null || valorContrato(p) >= filtros.valorMin!)
          .filter((p) => filtros.valorMax == null || valorContrato(p) <= filtros.valorMax!)
          .filter((p) => {
            if (!buscaLc) return true;
            const alvo = [
              p.numero_proposta,
              p.numero_proposta_banco,
              p.nome_cliente,
              p.cpf_cnpj,
              p.produto,
              p.status,
              rotuloStatus(p.status),
              p.bancos_label,
              p.analista_nome,
              p.consultor_nome,
              p.parceiro_nome,
            ]
              .map((v) => String(v ?? ""))
              .join(" ")
              .toLowerCase();
            return alvo.includes(buscaLc);
          });
      }

      // Nomes de analistas/comerciais quando só há id (sem nome desnormalizado).
      const idsFaltando = new Set<string>();
      for (const s of simulacoesFiltradas) {
        if (s.analista_id) idsFaltando.add(s.analista_id);
        if (s.comercial_id) idsFaltando.add(s.comercial_id);
        if (s.parceiro_id) idsFaltando.add(s.parceiro_id);
        if (s.usuario_responsavel_id) idsFaltando.add(s.usuario_responsavel_id);
      }
      for (const p of propostasFiltradas) {
        if (!p.analista_nome && p.analista_id) idsFaltando.add(p.analista_id);
        if (!p.consultor_nome && p.comercial_id) idsFaltando.add(p.comercial_id);
        if (!p.parceiro_nome && p.parceiro_id) idsFaltando.add(p.parceiro_id);
        if (p.usuario_responsavel_id) idsFaltando.add(p.usuario_responsavel_id);
      }
      for (const p of contratosOperacionais) {
        if (!p.analista_nome && p.analista_id) idsFaltando.add(p.analista_id);
        if (!p.consultor_nome && p.comercial_id) idsFaltando.add(p.comercial_id);
        if (!p.parceiro_nome && p.parceiro_id) idsFaltando.add(p.parceiro_id);
        if (p.usuario_responsavel_id) idsFaltando.add(p.usuario_responsavel_id);
      }
      // Nomes gerais + perfis dos parceiros (para separar Imobiliária x Corretor)
      const parceiroIds = new Set<string>();
      for (const s of simulacoesFiltradas) if (s.parceiro_id) parceiroIds.add(s.parceiro_id);
      for (const p of propostasFiltradas) if (p.parceiro_id) parceiroIds.add(p.parceiro_id);
      for (const p of contratosOperacionais) if (p.parceiro_id) parceiroIds.add(p.parceiro_id);
      const [nomes, parceiros] = await Promise.all([
        nomesUsuarios([...idsFaltando]),
        perfisUsuarios([...parceiroIds]),
      ]);
      const nomeAnalista = (p: any) =>
        p.analista_nome || nomes.get(p.analista_id) || nomes.get(p.usuario_responsavel_id) || "Não atribuído";
      const nomeComercial = (p: any) =>
        p.consultor_nome || nomes.get(p.comercial_id) || "Não atribuído";
      const perfilParceiro = (p: any) => (p.parceiro_id ? parceiros.get(p.parceiro_id) : null);
      const nomeParceiro = (p: any) =>
        perfilParceiro(p)?.nome || p.parceiro_nome || nomes.get(p.parceiro_id) || "Não atribuído";
      const nomeImobiliaria = (p: any) => {
        const perfil = perfilParceiro(p);
        if (perfil?.tipo === "imobiliaria") return perfil.nome;
        return "—";
      };
      const nomeCorretor = (p: any) => {
        const perfil = perfilParceiro(p);
        if (perfil?.tipo === "corretor") return perfil.nome;
        return "—";
      };
      const valorProc = (p: any) => p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0;
      const valorSim = (s: any) => s.valor_financiamento ?? 0;

      const emAndamento = [
        "enviada_banco",
        "em_analise_credito",
        "aguardando_documentos",
        "credito_aprovado",
        "engenharia_vistoria",
        "analise_juridica",
      ];
      // Crédito aprovado é diferente de contrato emitido: propostas já
      // contratadas saem de "aprovadas" e contam apenas em "contratos".
      const aprovado = ["credito_aprovado"];
      const contrato = statusContrato;

      const dentro = (iso?: string) => !!iso && iso.slice(0, 10) >= de && iso.slice(0, 10) <= ate;
      const andamento = propostasFiltradas.filter((p) => emAndamento.includes(p.status) && dentro(p.created_at));
      const aprovadas = propostasFiltradas.filter((p) => aprovado.includes(p.status) && dentro(p.created_at));
      const recusadas = propostasFiltradas.filter((p) => p.status === "credito_recusado" && dentro(p.created_at));
      const contratos = contratosOperacionais;

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
            titulo: "Por analista Adm · separado por banco",
            columns: colsBreak2("Analista Adm", "Banco"),
            rows: breakdown2(rows, nomeAnalista, (p) => p.nome_banco, valFn),
          },
          {
            titulo: "Por analista Comercial · separado por banco",
            columns: colsBreak2("Analista Comercial", "Banco"),
            rows: breakdown2(rows, nomeComercial, (p) => p.nome_banco, valFn),
          },
          {
            titulo: "Por Imobiliária",
            columns: colsBreak("Imobiliária"),
            rows: breakdown(rows.filter((p) => perfilParceiro(p)?.tipo === "imobiliaria"), nomeImobiliaria, valFn),
          },
          {
            titulo: "Por Corretor",
            columns: colsBreak("Corretor"),
            rows: breakdown(rows.filter((p) => perfilParceiro(p)?.tipo === "corretor"), nomeCorretor, valFn),
          },
        ];
      };

      const totalSim = simulacoesFiltradas.reduce((s, x) => s + valorSim(x), 0);
      const totalContr = contratos.reduce((s, p) => s + valorProc(p), 0);
      const bancoGeralMap = new Map<string, number>();
      simulacoesFiltradas.forEach((s) =>
        (s.nomes_bancos?.length ? s.nomes_bancos : [s.nome_banco ?? "—"]).forEach((b: string) =>
          bancoGeralMap.set(b || "—", (bancoGeralMap.get(b || "—") ?? 0) + 1),
        ),
      );
      propostasFiltradas.filter((p) => !contrato.includes(p.status)).forEach((p) =>
        (p.nomes_bancos?.length ? p.nomes_bancos : [p.nome_banco ?? "—"]).forEach((b: string) =>
          bancoGeralMap.set(b || "—", (bancoGeralMap.get(b || "—") ?? 0) + 1),
        ),
      );
      contratos.forEach((p) =>
        (p.nomes_bancos?.length ? p.nomes_bancos : [p.nome_banco ?? "—"]).forEach((b: string) =>
          bancoGeralMap.set(b || "—", (bancoGeralMap.get(b || "—") ?? 0) + 1),
        ),
      );

      const tabelas = [
        {
          titulo: "Simulações",
          descricao: "Simulações do período conectadas aos bancos retornados pela simulação.",
          tabelas: [
            {
              titulo: "Por data",
              columns: [
                { key: "k", label: "Data", format: "date" as const },
                { key: "qtd", label: "Qtd", align: "right" as const, footer: "sum" as const, format: "int" as const },
                { key: "valor", label: "Valor", align: "right" as const, footer: "sum" as const, format: "brl" as const },
              ],
              rows: (() => {
                const porData = new Map<string, { qtd: number; valor: number }>();
                for (const s of simulacoesFiltradas) {
                  const d = String(s.created_at ?? "").slice(0, 10);
                  if (!d) continue;
                  const cur = porData.get(d) ?? { qtd: 0, valor: 0 };
                  cur.qtd += 1;
                  cur.valor += valorSim(s);
                  porData.set(d, cur);
                }
                return [...porData.entries()]
                  .sort((a, b) => b[0].localeCompare(a[0]))
                  .map(([k, v]) => ({ k, qtd: v.qtd, valor: v.valor }));
              })(),
            },
            {
              titulo: "Por banco",
              columns: colsBreak("Banco"),
              rows: breakdown(simulacoesFiltradas, (s) => s.bancos_label ?? s.nome_banco, valorSim),
            },
            {
              titulo: "Por tipo (Financiamento / Home Equity)",
              columns: colsBreak("Tipo"),
              rows: breakdown(simulacoesFiltradas, (s) => PRODUTO_LABEL(s.produto), valorSim),
            },
            {
              titulo: "Por status",
              columns: colsBreak("Status"),
              rows: breakdown(
                simulacoesFiltradas,
                (s) => STATUS_SIMULACAO_LABEL[s.status] ?? s.status,
                valorSim,
              ),
            },
            {
              titulo: "Por analista Adm",
              columns: colsBreak("Analista Adm"),
              rows: breakdown(simulacoesFiltradas, nomeAnalista, valorSim),
            },
            {
              titulo: "Por analista Comercial",
              columns: colsBreak("Analista Comercial"),
              rows: breakdown(simulacoesFiltradas, nomeComercial, valorSim),
            },
            {
              titulo: "Por Imobiliária",
              columns: colsBreak("Imobiliária"),
              rows: breakdown(
                simulacoesFiltradas.filter((p) => perfilParceiro(p)?.tipo === "imobiliaria"),
                nomeImobiliaria,
                valorSim,
              ),
            },
            {
              titulo: "Por Corretor",
              columns: colsBreak("Corretor"),
              rows: breakdown(
                simulacoesFiltradas.filter((p) => perfilParceiro(p)?.tipo === "corretor"),
                nomeCorretor,
                valorSim,
              ),
            },
          ],
        },
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
              titulo: "Por Imobiliária",
              columns: colsBreak("Imobiliária"),
              rows: breakdown(
                andamento.filter((p) => perfilParceiro(p)?.tipo === "imobiliaria"),
                nomeImobiliaria,
                valorProc,
              ),
            },
            {
              titulo: "Por Corretor",
              columns: colsBreak("Corretor"),
              rows: breakdown(
                andamento.filter((p) => perfilParceiro(p)?.tipo === "corretor"),
                nomeCorretor,
                valorProc,
              ),
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
          titulo: "Crédito recusado",
          descricao: "Propostas recusadas no período, separadas para análise de perda.",
          tabelas: secaoTabelas(recusadas, "Por data", (p) => p.created_at, valorProc),
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
        titulo: "Relatório gerencial de operações",
        descricao:
          "Visão consolidada por banco, tipo, analistas, imobiliária e fase.",
        modulo: "Gerencial",
        kpis: [
          { label: "Simulações", valor: int(simulacoesFiltradas.length), tone: "neutral" },
          { label: "Volume simulado", valor: brl(totalSim), tone: "brand" },
          { label: "Propostas", valor: int(propostasFiltradas.length), tone: "neutral" },
          { label: "Em andamento", valor: int(andamento.length), tone: "neutral" },
          { label: "Aprovadas", valor: int(aprovadas.length), tone: "success" },
          { label: "Crédito recusado", valor: int(recusadas.length), tone: "danger" },
          { label: "Contratos emitidos", valor: int(contratos.length), tone: "success" },
          { label: "Valor contratado", valor: brl(totalContr), tone: "brand" },
        ],
        charts: [
          {
            titulo: "Funil",
            subtitulo: "Andamento → Aprovadas → Contratos",
            tipo: "funnel",
            dados: [
              { label: "Simulações", valor: simulacoesFiltradas.length },
              { label: "Propostas", valor: propostasFiltradas.length },
              { label: "Em andamento", valor: andamento.length },
              { label: "Aprovadas", valor: aprovadas.length },
              { label: "Recusadas", valor: recusadas.length },
              { label: "Contratos", valor: contratos.length },
            ],
          },
          {
            titulo: "Distribuição por banco",
            subtitulo: "Simulações e propostas filtradas",
            tipo: "barh",
            dados: topN(bancoGeralMap, 10),
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
          { key: "origem", label: "Origem" },
          { key: "numero", label: "Número" },
          { key: "numero_banco", label: "Nº banco" },
          { key: "cliente", label: "Cliente" },
          { key: "nome_banco", label: "Banco" },
          { key: "produto", label: "Tipo" },
          { key: "status", label: "Fase" },
          { key: "analista", label: "Analista Adm" },
          { key: "comercial", label: "Analista Comercial" },
          { key: "imobiliaria", label: "Imobiliária" },
          { key: "corretor", label: "Corretor" },
          { key: "valor", label: "Valor", align: "right", footer: "sum", format: "brl" },
          { key: "created_at", label: "Criada em", format: "date" },
        ],
        rows: [
          ...simulacoesFiltradas.map((s) => ({ ...s, __origem: "Simulação" })),
          ...propostasFiltradas
            .filter((p) => !contrato.includes(p.status))
            .map((p) => ({ ...p, __origem: "Proposta" })),
          ...contratos.map((p) => ({ ...p, __origem: "Contrato" })),
        ]
          .slice(0, 1000)
          .map((p) => ({
            origem: p.__origem,
            numero: p.numero_proposta ?? p.numero_simulacao ?? "—",
            numero_banco: p.numero_proposta_banco ?? "—",
            cliente: p.nome_cliente ?? "—",
            nome_banco: p.bancos_label ?? p.nome_banco ?? "—",
            produto: PRODUTO_LABEL(p.produto),
            status:
              p.__origem === "Simulação"
                ? STATUS_SIMULACAO_LABEL[p.status] ?? p.status
                : rotuloStatus(p.status),
            analista: nomeAnalista(p),
            comercial: nomeComercial(p),
            imobiliaria: nomeImobiliaria(p),
            corretor: nomeCorretor(p),
            valor: p.__origem === "Simulação" ? valorSim(p) : valorProc(p),
            created_at: p.created_at,
          })),
        filtrosDisponiveis: {
          bancos: opcoesOperacionais.bancos,
          produtos: opcoesOperacionais.produtos,
          statuses: statusOpcoesPorCodigo("gerencial"),
        },
      };
    }

    async function relSimulacoes(): Promise<ReportResult> {
      const [sims, opcoesOperacionais] = await Promise.all([
        fetchSimulacoesRelatorio(),
        listarOpcoesOperacionais(),
      ]);
      return {
        ...montarResultadoSimulacoes(sims),
        filtrosDisponiveis: {
          bancos: opcoesOperacionais.bancos,
          produtos: opcoesOperacionais.produtos,
          statuses: statusOpcoesPorCodigo("simulacoes"),
        },
      };
    }

    async function relPropostas(): Promise<ReportResult> {
      if (statusEhFiltroSimulacao(filtros.status)) {
        const [sims, opcoesOperacionais] = await Promise.all([
          fetchSimulacoesRelatorio({ rascunhoComoModulo: true }),
          listarOpcoesOperacionais(),
        ]);
        return {
          ...montarResultadoSimulacoes(sims, {
            titulo: "Relatório de propostas — simulações",
            descricao: "Simulações reais filtradas por período, banco, produto e responsável.",
            modulo: "Propostas",
            statusComoModulo: true,
          }),
          filtrosDisponiveis: {
            bancos: opcoesOperacionais.bancos,
            produtos: opcoesOperacionais.produtos,
            statuses: statusOpcoesPorCodigo("propostas"),
          },
        };
      }
      const todas = await fetchAll(
        "propostas",
        "id,numero_proposta,numero_proposta_banco,nome_cliente,status,valor_financiamento,valor_financiamento_aprovado,nome_banco,produto,prazo,usuario_responsavel_id,analista_id,comercial_id,parceiro_id,created_at",
        "created_at",
        "usuario_responsavel_id",
      );

      // Apenas bancos ATIVOS aparecem no filtro (produtos vêm das propostas existentes).
      const opcoesOperacionais = await listarOpcoesOperacionais();

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
          bancos: opcoesOperacionais.bancos,
          produtos: opcoesOperacionais.produtos,
          statuses: statusOpcoesPorCodigo("propostas"),
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

    async function relOperacionalSimulacoes(): Promise<ReportResult> {
      // Consolida a operação por data: simulações, aprovações (propostas), tarefas e demandas.
      const [sims, props, tarefas, demandas] = await Promise.all([
        fetchAll(
          "simulacoes",
          "id,numero_simulacao,nome_cliente,tipo_simulacao,status,produto,valor_financiamento,usuario_responsavel_id,analista_id,comercial_id,parceiro_id,created_at",
          "created_at",
          "usuario_responsavel_id",
        ),
        fetchAll(
          "propostas",
          "id,numero_proposta,nome_cliente,status,valor_financiamento,valor_financiamento_aprovado,nome_banco,produto,usuario_responsavel_id,analista_id,comercial_id,parceiro_id,created_at",
          "created_at",
          "usuario_responsavel_id",
        ),
        fetchAll(
          "tasks",
          "id,numero,titulo,status,prioridade,prazo,concluida_em,responsavel_id,created_at",
          "created_at",
          "responsavel_id",
        ),
        fetchAll(
          "demandas",
          "id,numero,titulo,status,prioridade,prazo_sla,concluida_em,responsavel_id,created_at",
          "created_at",
          "responsavel_id",
        ),
      ]);

      const agora = new Date();

      // Simulações
      const simuladas = sims.filter((s) =>
        ["simulada", "parcialmente_simulada", "promovida"].includes(s.status),
      ).length;

      // Aprovações (crédito aprovado + contratos emitidos + registrados)
      const aprovadas = props.filter((p) =>
        ["credito_aprovado", "contrato_emitido", "registrado"].includes(p.status),
      );
      const recusadas = props.filter((p) => p.status === "credito_recusado").length;
      const decididas = aprovadas.length + recusadas;
      const taxaAprov = decididas ? (aprovadas.length / decididas) * 100 : 0;
      const volumeAprovado = aprovadas.reduce(
        (s, p) => s + (p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0),
        0,
      );

      // Tarefas
      const tarefasConcluidas = tarefas.filter((t) => t.status === "concluida").length;
      const tarefasAbertas = tarefas.filter(
        (t) => !["concluida", "cancelada"].includes(t.status),
      ).length;
      const tarefasAtrasadas = tarefas.filter(
        (t) =>
          !["concluida", "cancelada"].includes(t.status) && t.prazo && new Date(t.prazo) < agora,
      ).length;

      // Demandas
      const demandasConcluidas = demandas.filter((d) => d.status === "concluida").length;
      const demandasAbertas = demandas.filter(
        (d) => !["concluida", "cancelada"].includes(d.status),
      ).length;
      const demandasSlaVencido = demandas.filter(
        (d) =>
          !["concluida", "cancelada"].includes(d.status) &&
          d.prazo_sla &&
          new Date(d.prazo_sla) < agora,
      ).length;

      // Distribuição por módulo
      const modMap = new Map<string, number>();
      modMap.set("Simulações", sims.length);
      modMap.set("Propostas", props.length);
      modMap.set("Tarefas", tarefas.length);
      modMap.set("Demandas", demandas.length);

      // Série mensal unificada (contagem de eventos por mês)
      const eventos = [
        ...sims.map((s) => ({ data: s.created_at as string })),
        ...props.map((p) => ({ data: p.created_at as string })),
        ...tarefas.map((t) => ({ data: t.created_at as string })),
        ...demandas.map((d) => ({ data: d.created_at as string })),
      ];

      // Linhas consolidadas (top 500 por data desc)
      const linhasSim = sims.map((s) => ({
        modulo: "Simulação",
        numero: s.numero_simulacao,
        titulo: s.nome_cliente ?? "—",
        status: STATUS_SIMULACAO_LABEL[s.status] ?? s.status,
        valor: s.valor_financiamento ?? 0,
        created_at: s.created_at,
      }));
      const linhasProp = props.map((p) => ({
        modulo: "Proposta",
        numero: p.numero_proposta,
        titulo: p.nome_cliente ?? "—",
        status: rotuloStatus(p.status),
        valor: p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0,
        created_at: p.created_at,
      }));
      const linhasTk = tarefas.map((t) => ({
        modulo: "Tarefa",
        numero: t.numero,
        titulo: t.titulo,
        status: STATUS_TAREFA_LABEL[t.status] ?? t.status,
        valor: 0,
        created_at: t.created_at,
      }));
      const linhasDem = demandas.map((d) => ({
        modulo: "Demanda",
        numero: d.numero,
        titulo: d.titulo,
        status: STATUS_DEMANDA_LABEL[d.status] ?? d.status,
        valor: 0,
        created_at: d.created_at,
      }));
      const rows = [...linhasSim, ...linhasProp, ...linhasTk, ...linhasDem]
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, 1000);

      return {
        titulo: "Relatório operacional de simulações",
        descricao:
          "Visão consolidada da operação por data: simulações, aprovações, tarefas e demandas.",
        modulo: "Operacional",
        kpis: [
          { label: "Simulações", valor: int(sims.length), hint: `${int(simuladas)} simuladas`, tone: "brand" },
          { label: "Aprovações", valor: int(aprovadas.length), hint: `Taxa ${pct(taxaAprov)}`, tone: "success" },
          { label: "Volume aprovado", valor: brl(volumeAprovado), tone: "success" },
          { label: "Tarefas", valor: int(tarefas.length), hint: `${int(tarefasAbertas)} abertas · ${int(tarefasAtrasadas)} atrasadas`, tone: tarefasAtrasadas > 0 ? "danger" : "neutral" },
          { label: "Tarefas concluídas", valor: int(tarefasConcluidas), tone: "success" },
          { label: "Demandas", valor: int(demandas.length), hint: `${int(demandasAbertas)} abertas · ${int(demandasSlaVencido)} SLA vencido`, tone: demandasSlaVencido > 0 ? "danger" : "neutral" },
          { label: "Demandas concluídas", valor: int(demandasConcluidas), tone: "success" },
        ],
        charts: [
          { titulo: "Distribuição por módulo", tipo: "barh", dados: topN(modMap, 4) },
          {
            titulo: "Evolução mensal — eventos operacionais",
            subtitulo: "Simulações + Propostas + Tarefas + Demandas",
            tipo: "line",
            dados: serieMensal(eventos),
          },
        ],
        columns: [
          { key: "modulo", label: "Módulo" },
          { key: "numero", label: "Número" },
          { key: "titulo", label: "Título / Cliente" },
          { key: "status", label: "Status" },
          { key: "valor", label: "Valor", align: "right", format: "brl" },
          { key: "created_at", label: "Data", format: "date" },
        ],
        rows,
      };
    }

    async function relFinanceiro(): Promise<ReportResult> {
      const filtrarStatus = (q: any) => (filtros.status ? q.eq("status", filtros.status) : q);
      const [pag, rec, repasses, comUsr] = await Promise.all([
        filtrarStatus(
          supabase
            .from("financial_payables")
            .select("valor,valor_pago,status,vencimento,descricao,created_at,data_pagamento")
            .gte("created_at", de)
            .lte("created_at", ateFim)
            .limit(5000),
        ).then((r: any) => r.data ?? []),
        filtrarStatus(
          supabase
            .from("financial_receivables")
            .select("valor,valor_recebido,status,vencimento,descricao,created_at,data_pagamento")
            .gte("created_at", de)
            .lte("created_at", ateFim)
            .limit(5000),
        ).then((r: any) => r.data ?? []),
        (supabase as any)
          .from("comissoes")
          .select("valor_bruto,split_parceiro,split_interno,status,usuario_responsavel_id,nome_banco,created_at")
          .gte("created_at", de)
          .lte("created_at", ateFim)
          .limit(5000)
          .then((r: any) => r.data ?? []),
        (supabase as any)
          .from("comissoes_usuario")
          .select("valor_comissao,valor_base,percentual,status,usuario_id,tipo_vinculo,banco_nome,numero_proposta,created_at")
          .gte("created_at", de)
          .lte("created_at", ateFim)
          .limit(5000)
          .then((r: any) => r.data ?? []),
      ]);
      const hoje = new Date();
      const hojeStr = hoje.toISOString().slice(0, 10);
      const abertas = (r: any) => ["aberta", "parcial"].includes(r.status);
      const somaValor = (arr: any[]) => arr.reduce((s: number, r: any) => s + (r.valor ?? 0), 0);

      const recAbertas = rec.filter(abertas);
      const pagAbertas = pag.filter(abertas);
      const aReceber = somaValor(recAbertas);
      const aPagar = somaValor(pagAbertas);
      const pago = pag.reduce((s: number, r: any) => s + (r.valor_pago ?? 0), 0);
      const recebido = rec.reduce((s: number, r: any) => s + (r.valor_recebido ?? 0), 0);
      const vencidas = [...pag, ...rec].filter(
        (r: any) => abertas(r) && r.vencimento && r.vencimento < hojeStr,
      );
      const vencido = somaValor(vencidas);
      const saldoRealizado = recebido - pago;
      const saldoPrevisto = aReceber - aPagar;
      const cobertura = aPagar > 0 ? (aReceber / aPagar) * 100 : 0;
      const inadimplencia =
        aReceber > 0
          ? (somaValor(
              recAbertas.filter((r: any) => r.vencimento && r.vencimento < hojeStr),
            ) /
              aReceber) *
            100
          : 0;

      // Composição por status (somente lançamentos em aberto/parcial).
      const composicao = (arr: any[]) => {
        const m = new Map<string, number>();
        arr.forEach((r: any) => m.set(r.status, (m.get(r.status) ?? 0) + (r.valor ?? 0)));
        return [...m.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => ({ label: STATUS_FINANCEIRO_LABEL[k] ?? k, valor: v }));
      };

      // Aging de vencidos por faixa de atraso.
      const faixas = [
        { label: "1–15 dias", min: 1, max: 15 },
        { label: "16–30 dias", min: 16, max: 30 },
        { label: "31–60 dias", min: 31, max: 60 },
        { label: "60+ dias", min: 61, max: Infinity },
      ];
      const diasAtraso = (v: string) =>
        Math.floor((hoje.getTime() - new Date(v + "T00:00:00").getTime()) / 86400000);
      const aging = faixas.map((f) => ({
        label: f.label,
        valor: vencidas
          .filter((r: any) => {
            const d = diasAtraso(r.vencimento);
            return d >= f.min && d <= f.max;
          })
          .reduce((s: number, r: any) => s + (r.valor ?? 0), 0),
      }));

      const charts: ReportChart[] = [
        {
          titulo: "Fluxo mensal realizado",
          subtitulo: "Recebido x pago por mês",
          tipo: "line",
          moeda: true,
          serie1: "Recebido",
          serie2: "Pago",
          dados: fluxoMensal(rec, pag),
        },
      ];
      if (recAbertas.length > 0) {
        charts.push({
          titulo: "A receber por status",
          subtitulo: "Composição dos recebíveis em aberto",
          tipo: "donut",
          moeda: true,
          dados: composicao(recAbertas),
        });
      }
      if (pagAbertas.length > 0) {
        charts.push({
          titulo: "A pagar por status",
          subtitulo: "Composição das contas a pagar em aberto",
          tipo: "donut",
          moeda: true,
          dados: composicao(pagAbertas),
        });
      }
      if (aging.some((a) => a.valor > 0)) {
        charts.push({
          titulo: "Aging de vencidos",
          subtitulo: "Valores em atraso por faixa de dias",
          tipo: "barh",
          moeda: true,
          dados: aging,
        });
      }

      const proximos = [...pag, ...rec]
        .filter((r: any) => abertas(r) && r.vencimento && r.vencimento >= hojeStr)
        .sort((a: any, b: any) => a.vencimento.localeCompare(b.vencimento))
        .slice(0, 10);

      // Repasses (comissões do correspondente) no período.
      const repassePrev = repasses.reduce(
        (s: number, c: any) => s + (Number(c.valor_bruto) || 0),
        0,
      );
      const repassePago = repasses
        .filter((c: any) => c.status === "paga_parceiro" || c.status === "encerrada")
        .reduce((s: number, c: any) => s + (Number(c.valor_bruto) || 0), 0);
      const repasseAberto = repassePrev - repassePago;
      const repassePorBanco = new Map<string, number>();
      repasses.forEach((c: any) =>
        repassePorBanco.set(
          c.nome_banco ?? "—",
          (repassePorBanco.get(c.nome_banco ?? "—") ?? 0) + (Number(c.valor_bruto) || 0),
        ),
      );

      // Comissões por usuário (analistas, corretores, imobiliária, comercial etc.)
      const comPagas = comUsr.filter((c: any) => c.status === "paga");
      const comAPagar = comUsr.filter((c: any) => c.status === "a_pagar");
      const comTotal = comUsr.reduce(
        (s: number, c: any) => s + (Number(c.valor_comissao) || 0),
        0,
      );
      const comPagoValor = comPagas.reduce(
        (s: number, c: any) => s + (Number(c.valor_comissao) || 0),
        0,
      );
      const comAPagarValor = comAPagar.reduce(
        (s: number, c: any) => s + (Number(c.valor_comissao) || 0),
        0,
      );

      const comPorUsuario = new Map<string, number>();
      comUsr.forEach((c: any) => {
        const k = c.usuario_id ?? "—";
        comPorUsuario.set(k, (comPorUsuario.get(k) ?? 0) + (Number(c.valor_comissao) || 0));
      });
      const comPorVinculo = new Map<string, number>();
      comUsr.forEach((c: any) => {
        const k = c.tipo_vinculo ?? "outro";
        comPorVinculo.set(k, (comPorVinculo.get(k) ?? 0) + (Number(c.valor_comissao) || 0));
      });
      const nomesCom = await nomesUsuarios(
        Array.from(new Set(comUsr.map((c: any) => c.usuario_id).filter(Boolean))) as string[],
      );

      if (repassePorBanco.size > 0) {
        charts.push({
          titulo: "Repasses por banco",
          subtitulo: "Comissões previstas por instituição no período",
          tipo: "barh",
          moeda: true,
          dados: [...repassePorBanco.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([label, valor]) => ({ label, valor })),
        });
      }
      if (comPorUsuario.size > 0) {
        charts.push({
          titulo: "Comissões por usuário",
          subtitulo: "Ranking de comissões geradas no período",
          tipo: "barh",
          moeda: true,
          dados: [...comPorUsuario.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([k, v]) => ({ label: nomesCom.get(k) ?? "—", valor: v })),
        });
      }
      if (comPorVinculo.size > 0) {
        charts.push({
          titulo: "Comissões por tipo de vínculo",
          subtitulo: "Distribuição entre corretor, imobiliária, analista e demais",
          tipo: "donut",
          moeda: true,
          dados: [...comPorVinculo.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => ({
              label: (k as string).replace(/_/g, " ").replace(/^./, (s) => s.toUpperCase()),
              valor: v,
            })),
        });
      }

      return {
        titulo: "Relatório financeiro consolidado",
        descricao:
          "Contas a pagar e receber, fluxo de caixa, repasses e comissões por usuário — tudo em uma única visão.",
        modulo: "Financeiro",
        kpis: [
          {
            label: "A receber",
            valor: brl(aReceber),
            tone: "success",
            hint: `${recAbertas.length} lançamento(s) em aberto`,
          },
          {
            label: "A pagar",
            valor: brl(aPagar),
            tone: "warning",
            hint: `${pagAbertas.length} lançamento(s) em aberto`,
          },
          {
            label: "Saldo previsto",
            valor: brl(saldoPrevisto),
            tone: saldoPrevisto >= 0 ? "brand" : "danger",
            hint: "A receber − a pagar",
          },
          {
            label: "Saldo realizado",
            valor: brl(saldoRealizado),
            tone: saldoRealizado >= 0 ? "success" : "danger",
            hint: "Recebido − pago",
          },
          {
            label: "Vencido",
            valor: brl(vencido),
            tone: "danger",
            hint: `${vencidas.length} título(s) em atraso`,
          },
          {
            label: "Cobertura",
            valor: `${cobertura.toFixed(0)}%`,
            tone: cobertura >= 100 ? "success" : "warning",
            hint: `Inadimplência ${inadimplencia.toFixed(1)}%`,
          },
          {
            label: "Repasse previsto",
            valor: brl(repassePrev),
            tone: "brand",
            hint: `${repasses.length} contrato(s)`,
          },
          {
            label: "Repasse pago",
            valor: brl(repassePago),
            tone: "success",
            hint: repasseAberto > 0 ? `${brl(repasseAberto)} em aberto` : "Sem pendências",
          },
          {
            label: "Comissões usuários",
            valor: brl(comTotal),
            tone: "neutral",
            hint: `${comUsr.length} lançamento(s)`,
          },
          {
            label: "Comissões pagas",
            valor: brl(comPagoValor),
            tone: "success",
            hint: comAPagarValor > 0 ? `${brl(comAPagarValor)} a pagar` : "Em dia",
          },
        ],
        charts,
        tabelas: [
          ...(proximos.length > 0
            ? [
                {
                  titulo: "Agenda de caixa",
                  descricao: "Próximos vencimentos em aberto.",
                  tabelas: [
                    {
                      titulo: "Próximos 10 vencimentos",
                      columns: [
                        { key: "tipo", label: "Tipo" },
                        { key: "descricao", label: "Descrição" },
                        { key: "vencimento", label: "Vencimento", format: "date" as const },
                        {
                          key: "valor",
                          label: "Valor",
                          align: "right" as const,
                          format: "brl" as const,
                        },
                      ],
                      rows: proximos.map((r: any) => ({
                        tipo: rec.includes(r) ? "Receber" : "Pagar",
                        descricao: r.descricao ?? "—",
                        vencimento: r.vencimento,
                        valor: r.valor ?? 0,
                      })),
                    },
                  ],
                },
              ]
            : []),
          ...(repassePorBanco.size > 0
            ? [
                {
                  titulo: "Repasses do correspondente",
                  descricao: "Comissões geradas ao correspondente por banco.",
                  tabelas: [
                    {
                      titulo: "Total por banco",
                      columns: [
                        { key: "banco", label: "Banco" },
                        {
                          key: "valor",
                          label: "Repasse",
                          align: "right" as const,
                          footer: "sum" as const,
                          format: "brl" as const,
                        },
                      ],
                      rows: [...repassePorBanco.entries()]
                        .sort((a, b) => b[1] - a[1])
                        .map(([banco, valor]) => ({ banco, valor })),
                    },
                  ],
                },
              ]
            : []),
          ...(comPorUsuario.size > 0
            ? [
                {
                  titulo: "Comissões por usuário",
                  descricao: "Comissões geradas para corretores, imobiliária, analistas e comercial.",
                  tabelas: [
                    {
                      titulo: "Total por usuário",
                      columns: [
                        { key: "usuario", label: "Usuário" },
                        {
                          key: "valor",
                          label: "Comissão",
                          align: "right" as const,
                          footer: "sum" as const,
                          format: "brl" as const,
                        },
                      ],
                      rows: [...comPorUsuario.entries()]
                        .sort((a, b) => b[1] - a[1])
                        .map(([k, valor]) => ({ usuario: nomesCom.get(k) ?? "—", valor })),
                    },
                  ],
                },
              ]
            : []),
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
            status: STATUS_FINANCEIRO_LABEL[r.status] ?? r.status,
            vencimento: r.vencimento,
            valor: r.valor ?? 0,
          })),
          ...pag.map((r: any) => ({
            tipo: "Pagar",
            descricao: r.descricao ?? "—",
            status: STATUS_FINANCEIRO_LABEL[r.status] ?? r.status,
            vencimento: r.vencimento,
            valor: r.valor ?? 0,
          })),
        ].slice(0, 800),
      };
    }

    async function relComissoes(): Promise<ReportResult> {
      let cq = (supabase as any)
        .from("comissoes")
        .select("valor_bruto,split_parceiro,split_interno,status,usuario_responsavel_id,created_at")
        .gte("created_at", de)
        .lte("created_at", ateFim)
        .limit(5000);
      cq = aplicarEscopo(cq, filtros, userId, "usuario_responsavel_id");
      if (filtros.responsavel) cq = cq.eq("usuario_responsavel_id", filtros.responsavel);
      if (filtros.status) cq = cq.eq("status", filtros.status);
      const coms = await cq.then((r: any) => r.data ?? []);
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
        titulo: "Relatório de repasses",
        descricao: "Repasses previstos e pagos no período (comissões de contratos emitidos).",
        modulo: "Financeiro",
        kpis: [
          { label: "Repasse previsto", valor: brl(prevista), tone: "brand" },
          { label: "Repasse pago", valor: brl(paga), tone: "success" },
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
          { key: "valor", label: "Repasse", align: "right", footer: "sum", format: "brl" },
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

    async function perfisUsuarios(
      ids: string[],
    ): Promise<Map<string, { nome: string; tipo: string | null }>> {
      const out = new Map<string, { nome: string; tipo: string | null }>();
      if (!ids.length) return out;
      const { data } = await supabase
        .from("profiles")
        .select("id,nome,tipo_pessoa,tipos_pessoa")
        .in("id", ids);
      (data ?? []).forEach((p: any) => {
        // Preferir "imobiliaria"/"corretor" quando presentes em tipos_pessoa
        // (multi-tipo), caindo para tipo_pessoa primário caso contrário.
        const arr: string[] = Array.isArray(p.tipos_pessoa) ? p.tipos_pessoa.filter(Boolean) : [];
        const tipo =
          arr.find((t) => t === "imobiliaria" || t === "corretor") ?? p.tipo_pessoa ?? null;
        out.set(p.id, { nome: p.nome ?? "—", tipo });
      });
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
  "app-cliente",
  "operacionais",
  "operacional-simulacoes",
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
