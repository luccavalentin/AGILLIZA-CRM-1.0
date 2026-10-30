/**
 * Financeiro da matriz — porta única do servidor para as funções do banco (fin_*).
 *
 * Cada ação está numa lista fechada com: a função do banco, o formato dos dados (zod) e
 * a permissão da matriz exigida NO SERVIDOR (o banco confere de novo por dentro, com
 * RLS e fin_pode). Nada aqui chama provedor, webhook ou move dinheiro: só registra o que
 * a pessoa autorizada fez (C45j).
 *
 * Aviso de regra (duplicidade, valor acima do saldo, soma acima da comissão do banco)
 * volta como `{ ok: false, aviso }` para a tela pedir confirmação + justificativa.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AcaoPermissao } from "@/integrations/supabase/exigir-permissao";

type Perm = [string, AcaoPermissao];

/** O que volta do banco (jsonb): serializável de ponta a ponta. */
export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

const uuid = z.string().uuid();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const texto = (max: number) => z.string().trim().max(max);
const motivo = z.string().trim().min(5, "Escreva o motivo (5 letras ou mais).").max(500);
const jsonLivre = z.record(z.string(), z.unknown());
const valor = z.number().finite().positive().max(999_999_999);

const NATUREZA = z.enum(["comissao_banco", "comissao_participante", "conta_pagar", "conta_receber"]);
/** O livro de baixas aceita também a matrícula pedida por terceiro (c1, natureza `matricula`). */
const NATUREZA_BAIXA = z.enum(["comissao_banco", "comissao_participante", "conta_pagar", "conta_receber", "matricula"]);
const PERM_NATUREZA: Record<z.infer<typeof NATUREZA_BAIXA>, string> = {
  comissao_banco: "financeiro.comissoes_bancos",
  comissao_participante: "financeiro.comissoes",
  conta_pagar: "financeiro.contas_pagar",
  conta_receber: "financeiro.contas_receber",
  matricula: "financeiro.contas_receber",
};

interface Acao {
  fn: string;
  /** Monta os argumentos nomeados da função do banco a partir dos dados validados. */
  args: z.ZodType<Record<string, unknown>>;
  /** Alternativas [módulo, ação]: basta uma. Vazio = o banco decide (ex.: a própria pessoa). */
  perm: Perm[] | ((d: Record<string, unknown>) => Perm[]);
}

const filtros = z.object({ _f: jsonLivre.default({}) });

/** Leituras (GET). */
const CONSULTAS = {
  cadastros: { fn: "fin_cadastros", args: z.object({}), perm: [] },
  painel: {
    fn: "fin_painel",
    args: z.object({ _de: data, _ate: data, _f: jsonLivre.default({}) }),
    perm: [["financeiro.painel", "view"], ["financeiro.fluxo_caixa", "view"]],
  },
  relatorio: {
    fn: "fin_relatorio",
    args: z.object({
      _tipo: z.enum(["comissoes_bancos", "comissoes_participantes", "despesas", "receitas", "movimentos", "sem_previsao", "vencidas", "diferencas"]),
      _de: data,
      _ate: data,
      _f: jsonLivre.default({}),
    }),
    perm: [],
  },
  auditoria: { fn: "fin_auditoria_listar", args: filtros, perm: [["financeiro.auditoria", "view"]] },
  detalhe: {
    fn: "fin_lancamento_detalhe",
    args: z.object({ _natureza: NATUREZA, _id: uuid }),
    perm: (d) => [[PERM_NATUREZA[d._natureza as keyof typeof PERM_NATUREZA], "view"]],
  },
  comissoesBancos: { fn: "fin_cb_listar", args: filtros, perm: [["financeiro.comissoes_bancos", "view"]] },
  comissoesParticipantes: { fn: "fin_cu_listar", args: filtros, perm: [["financeiro.comissoes", "view"]] },
  contas: {
    fn: "fin_contas_listar",
    args: z.object({ _tipo: z.enum(["pagar", "receber"]), _f: jsonLivre.default({}) }),
    perm: (d) => [[d._tipo === "pagar" ? "financeiro.contas_pagar" : "financeiro.contas_receber", "view"]],
  },
  duplicatas: {
    fn: "fin_conta_duplicatas",
    args: z.object({ _tipo: z.enum(["pagar", "receber"]), _d: jsonLivre, _exceto: uuid.nullable().default(null) }),
    perm: (d) => [[d._tipo === "pagar" ? "financeiro.contas_pagar" : "financeiro.contas_receber", "view"]],
  },
  demonstrativo: {
    fn: "fin_demonstrativo",
    args: z.object({ _pessoa: uuid, _de: data.nullable().default(null), _ate: data.nullable().default(null) }),
    perm: [],
  },
  extratos: { fn: "fin_extratos_listar", args: z.object({}), perm: [["financeiro.conciliacao", "view"]] },
  // Junção com as matrículas pedidas por terceiros (frente a4): só leitura.
  matriculasAReceber: { fn: "fin_matriculas_a_receber", args: z.object({}), perm: [["financeiro.contas_receber", "view"]] },
  matriculasDoSolicitante: {
    fn: "fin_matriculas_do_solicitante",
    args: z.object({ _chave: texto(200).min(1) }),
    perm: [["financeiro.contas_receber", "view"]],
  },
  extrato: { fn: "fin_extrato_detalhe", args: z.object({ _extrato: uuid }), perm: [["financeiro.conciliacao", "view"]] },
} satisfies Record<string, Acao>;

/** Ações que gravam (POST). */
const EXECUCOES = {
  // Comissões dos bancos
  cbLancar: { fn: "fin_cb_lancar", args: z.object({ _d: jsonLivre }), perm: [["financeiro.comissoes_bancos", "create"]] },
  cbInformar: {
    fn: "fin_cb_informar",
    args: z.object({ _id: uuid, _valor: z.number().finite().min(0).max(999_999_999), _observacao: texto(500).nullable().default(null) }),
    perm: [["financeiro.comissoes_bancos", "create"], ["financeiro.comissoes_bancos", "edit"]],
  },
  cbCorrigir: {
    fn: "fin_cb_corrigir_previsao",
    args: z.object({ _id: uuid, _valor: z.number().finite().min(0).max(999_999_999), _motivo: motivo }),
    perm: [["financeiro.comissoes_bancos", "edit"]],
  },
  cbContestar: { fn: "fin_cb_contestar", args: z.object({ _id: uuid, _motivo: motivo }), perm: [["financeiro.comissoes_bancos", "edit"]] },
  cbResolver: {
    fn: "fin_cb_resolver_contestacao",
    args: z.object({ _id: uuid, _motivo: motivo }),
    perm: [["financeiro.comissoes_bancos", "edit"]],
  },
  cbCancelar: { fn: "fin_cb_cancelar", args: z.object({ _id: uuid, _motivo: motivo }), perm: [["financeiro.comissoes_bancos", "edit"]] },
  cbEncerrarDiferenca: {
    fn: "fin_cb_encerrar_com_diferenca",
    args: z.object({ _id: uuid, _motivo: motivo }),
    perm: [["financeiro.comissoes_bancos", "receber"]],
  },
  cbGerarFaltantes: { fn: "fin_cb_gerar_faltantes", args: z.object({}), perm: [["financeiro.comissoes_bancos", "create"]] },
  regraBanco: { fn: "fin_regra_banco_salvar", args: z.object({ _d: jsonLivre }), perm: [["financeiro.comissoes_bancos", "regras"]] },
  regraEncerrar: {
    fn: "fin_regra_encerrar",
    args: z.object({ _tipo: z.enum(["banco", "participante"]), _id: uuid, _motivo: texto(300).nullable().default(null) }),
    perm: (d) => [[d._tipo === "banco" ? "financeiro.comissoes_bancos" : "financeiro.comissoes", "regras"]],
  },
  // Corretores e parceiros
  cuLancar: { fn: "fin_cu_lancar", args: z.object({ _d: jsonLivre }), perm: [["financeiro.comissoes", "create"]] },
  cuAprovar: { fn: "fin_cu_aprovar", args: z.object({ _ids: z.array(uuid).min(1).max(500) }), perm: [["financeiro.comissoes", "aprovar"]] },
  cuContestar: { fn: "fin_cu_contestar", args: z.object({ _id: uuid, _motivo: motivo }), perm: [] },
  cuAjustar: {
    fn: "fin_cu_ajustar",
    args: z.object({ _id: uuid, _novo: valor, _motivo: motivo }),
    perm: [["financeiro.comissoes", "edit"]],
  },
  cuResolver: {
    fn: "fin_cu_resolver_contestacao",
    args: z.object({ _id: uuid, _manter: z.boolean(), _novo: valor.nullable().default(null), _motivo: motivo }),
    perm: [["financeiro.comissoes", "edit"]],
  },
  cuCancelar: { fn: "fin_cu_cancelar", args: z.object({ _id: uuid, _motivo: motivo }), perm: [["financeiro.comissoes", "edit"]] },
  cuGerarFaltantes: { fn: "fin_cu_gerar_faltantes", args: z.object({ _prop_id: uuid }), perm: [["financeiro.comissoes", "create"]] },
  participantes: {
    fn: "fin_participantes_salvar",
    args: z.object({
      _prop_id: uuid,
      _itens: z.array(z.object({ pessoa_id: uuid, papel: z.enum(["originou", "atendeu", "participou"]), observacao: texto(300).optional() })).max(20),
    }),
    perm: [["financeiro.comissoes", "create"]],
  },
  regraParticipante: { fn: "fin_regra_participante_salvar", args: z.object({ _d: jsonLivre }), perm: [["financeiro.comissoes", "regras"]] },
  // Contas
  contaSalvar: {
    fn: "fin_conta_salvar",
    args: z.object({ _tipo: z.enum(["pagar", "receber"]), _d: jsonLivre }),
    perm: (d) => {
      const m = d._tipo === "pagar" ? "financeiro.contas_pagar" : "financeiro.contas_receber";
      return [[m, (d._d as { id?: string })?.id ? "edit" : "create"], [m, "create"]];
    },
  },
  contaConfirmarRascunho: {
    fn: "fin_conta_confirmar_rascunho",
    args: z.object({ _id: uuid, _d: jsonLivre }),
    perm: [["financeiro.contas_pagar", "create"]],
  },
  contaCancelar: {
    fn: "fin_conta_cancelar",
    args: z.object({ _tipo: z.enum(["pagar", "receber"]), _id: uuid, _motivo: motivo }),
    perm: (d) => [[d._tipo === "pagar" ? "financeiro.contas_pagar" : "financeiro.contas_receber", "edit"]],
  },
  contaDescartarRascunho: { fn: "fin_conta_descartar_rascunho", args: z.object({ _id: uuid }), perm: [["financeiro.contas_pagar", "create"]] },
  // Livro de baixas
  baixa: {
    fn: "fin_registrar_baixa",
    args: z.object({
      _natureza: NATUREZA_BAIXA,
      _alvo: uuid,
      _valor: valor,
      _data: data,
      _conta_bancaria: uuid.nullable().default(null),
      _forma: texto(60).nullable().default(null),
      _documento: texto(120).nullable().default(null),
      _observacao: texto(500).nullable().default(null),
      _anexo: uuid.nullable().default(null),
      _permitir_excedente: z.boolean().default(false),
    }),
    perm: (d) => [
      [
        PERM_NATUREZA[d._natureza as keyof typeof PERM_NATUREZA],
        d._natureza === "comissao_banco" ? "receber" : d._natureza === "comissao_participante" ? "pagar" : "baixar",
      ],
    ],
  },
  estornar: { fn: "fin_estornar_baixa", args: z.object({ _id: uuid, _motivo: motivo }), perm: [] },
  // Cadastros, parâmetros e anexos
  cadastro: {
    fn: "fin_cadastro_salvar",
    args: z.object({ _entidade: z.enum(["categoria", "centro", "forma", "conta_bancaria", "fornecedor"]), _d: jsonLivre }),
    perm: (d) =>
      d._entidade === "fornecedor"
        ? [["financeiro.regras", "edit"], ["financeiro.contas_pagar", "create"]]
        : [["financeiro.regras", "edit"]],
  },
  parametros: { fn: "fin_parametros_salvar", args: z.object({ _d: jsonLivre }), perm: [["financeiro.regras", "edit"]] },
  anexo: {
    fn: "fin_anexo_registrar",
    args: z.object({
      _pasta: z.enum(["comissoes-bancos", "repasses", "comissoes", "contas-pagar", "contas-receber", "conciliacao"]),
      _entidade: texto(60),
      _entidade_id: uuid.nullable().default(null),
      _caminho: texto(400),
      _nome: texto(200),
      _tipo: texto(120).nullable().default(null),
      _tamanho: z.number().int().min(0).max(26_214_400).nullable().default(null),
    }),
    perm: [],
  },
  // Conciliação
  importarExtrato: {
    fn: "fin_importar_extrato",
    args: z.object({
      _conta: uuid,
      _arquivo: texto(200).min(1),
      _sha: z.string().regex(/^[0-9a-f]{64}$/),
      _formato: z.enum(["ofx", "csv"]),
      _linhas: z
        .array(
          z.object({
            data,
            valor: z.number().finite(),
            descricao: texto(300),
            documento: texto(120).nullable(),
            fitid: texto(120).nullable(),
            ordem: z.number().int().min(0),
          }),
        )
        .min(1)
        .max(5000),
      _confirmar: z.boolean().default(false),
      _anexo: uuid.nullable().default(null),
    }),
    perm: [["financeiro.conciliacao", "create"]],
  },
  conciliar: {
    fn: "fin_conciliar",
    args: z.object({
      _linha: uuid,
      _tipo: z.enum(["baixa", "comissao_banco", "conta_receber", "conta_pagar", "comissao_participante", "matricula"]),
      _alvo: uuid,
      _permitir_excedente: z.boolean().default(false),
    }),
    perm: [["financeiro.conciliacao", "conciliar"]],
  },
  desfazerConciliacao: {
    fn: "fin_desfazer_conciliacao",
    args: z.object({ _id: uuid, _motivo: motivo }),
    perm: [["financeiro.conciliacao", "conciliar"]],
  },
  rejeitarSugestao: {
    fn: "fin_rejeitar_sugestao",
    args: z.object({ _linha: uuid, _tipo: texto(40), _alvo: uuid }),
    perm: [["financeiro.conciliacao", "conciliar"]],
  },
  ignorarLinha: {
    fn: "fin_ignorar_linha",
    args: z.object({ _linha: uuid, _motivo: texto(300).nullable().default(null), _reabrir: z.boolean().default(false) }),
    perm: [["financeiro.conciliacao", "conciliar"]],
  },
} satisfies Record<string, Acao>;

export type ConsultaFinanceiro = keyof typeof CONSULTAS;
export type ExecucaoFinanceiro = keyof typeof EXECUCOES;

export type AvisoFinanceiro = {
  ok: false;
  aviso: "duplicidade" | "excedente" | "soma";
  mensagem: string;
  detalhe: Json;
};
export type RespostaExecucao<T = Json> = { ok: true; dados: T } | AvisoFinanceiro;

async function conferirPermissao(supabase: any, userId: string, alternativas: Perm[]) {
  if (!alternativas.length) return;
  for (const [modulo, acao] of alternativas) {
    const { data, error } = await supabase.rpc("usuario_tem_permissao", { _user_id: userId, _modulo: modulo, _acao: acao });
    if (error) throw new Error("Não foi possível conferir sua permissão.");
    if (data) return;
  }
  throw new Error("Você não tem permissão para esta ação.");
}

/** Erro do banco → mensagem para a tela (as regras do banco já falam português). */
function traduzir(e: { message?: string; code?: string }): Error {
  const msg = e?.message ?? "";
  const codigo = e?.code ?? "";
  if (codigo === "42501" && /permission denied|row-level security/i.test(msg)) {
    return new Error("Você não tem permissão para esta ação.");
  }
  if (["42501", "P0001", "P0002", "22023", "55000", "23505"].includes(codigo) && msg) return new Error(msg);
  if (codigo === "22P02") return new Error("Algum dado chegou em formato inválido.");
  if (codigo === "40001" || codigo === "40P01" || codigo === "55P03") {
    return new Error("Outra pessoa estava mexendo no mesmo lançamento. Tente de novo.");
  }
  console.error("[financeiro]", codigo, msg);
  return new Error("Não foi possível concluir a operação no financeiro.");
}

function preparar(lista: Record<string, Acao>, nome: string, bruto: unknown) {
  const acao = lista[nome];
  if (!acao) throw new Error("Ação desconhecida.");
  const args = acao.args.parse(bruto ?? {});
  const perm = typeof acao.perm === "function" ? acao.perm(args) : acao.perm;
  return { acao, args, perm };
}

export const consultarFinanceiro = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ acao: z.enum(Object.keys(CONSULTAS) as [ConsultaFinanceiro, ...ConsultaFinanceiro[]]), args: z.unknown() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { acao, args, perm } = preparar(CONSULTAS, data.acao, data.args);
    await conferirPermissao(context.supabase, context.userId, perm);
    const { data: r, error } = await (context.supabase as any).rpc(acao.fn, args);
    if (error) throw traduzir(error);
    return (r ?? null) as Json;
  });

export const executarFinanceiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ acao: z.enum(Object.keys(EXECUCOES) as [ExecucaoFinanceiro, ...ExecucaoFinanceiro[]]), args: z.unknown() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<RespostaExecucao<Json>> => {
    const { acao, args, perm } = preparar(EXECUCOES, data.acao, data.args);
    await conferirPermissao(context.supabase, context.userId, perm);
    const { data: r, error } = await (context.supabase as any).rpc(acao.fn, args);
    if (error) {
      const dica = (error as { hint?: string }).hint;
      if (error.code === "P0001" && (dica === "duplicidade" || dica === "excedente" || dica === "soma")) {
        let detalhe: Json = null;
        try {
          detalhe = error.details ? (JSON.parse(error.details) as Json) : null;
        } catch {
          detalhe = null;
        }
        return { ok: false, aviso: dica, mensagem: error.message, detalhe };
      }
      throw traduzir(error);
    }
    return { ok: true, dados: (r ?? null) as Json };
  });

/**
 * Leitura de boleto em PDF: devolve um RASCUNHO para conferência (nunca salva nem paga).
 * Imagem não passa por aqui: o navegador tenta o leitor de código de barras dele e, se não
 * houver, pede a linha digitada/colada.
 */
export const lerBoletoPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ nome: texto(200), base64: z.string().max(14_500_000, "Arquivo acima de 10 MB.") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await conferirPermissao(context.supabase, context.userId, [["financeiro.contas_pagar", "create"]]);
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.length > 10 * 1024 * 1024) throw new Error("Arquivo acima de 10 MB.");
    const { extrairTextoPdf } = await import("./pdf-texto.server");
    const { encontrarCodigosNoTexto, dadosDoTexto } = await import("./boleto");
    let texto = "";
    try {
      texto = extrairTextoPdf(new Uint8Array(bytes));
    } catch (e) {
      throw new Error((e as Error).message || "Não foi possível ler o PDF.");
    }
    const codigos = encontrarCodigosNoTexto(texto);
    return {
      temTexto: texto.length > 20,
      codigos: codigos.map((c) => ({
        tipo: c.tipo,
        linhaDigitavel: c.linhaDigitavel,
        codigoBarras: c.codigoBarras,
        banco: c.banco,
        valor: c.valor,
        vencimento: c.vencimento,
        avisos: c.avisos,
      })),
      dados: dadosDoTexto(texto),
    };
  });
