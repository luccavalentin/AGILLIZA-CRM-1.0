import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { mascararDocumento, validarCPF, validarCNPJ } from "@/lib/crm/documento";
import { temPiiCliente } from "@/lib/crm/pii";
import {
  PROVEDORES_BUREAU,
  provedorDoCatalogo,
  type ProvedorCatalogo,
} from "./provedores/catalogo";
import { ErroBureau, type FichaBureau } from "./tipos";

const soDigitos = (v: string) => String(v ?? "").replace(/\D/g, "");

/**
 * As tabelas do bureau ainda não existem no schema publicado, então o cliente
 * tipado do Supabase não as conhece. Este acesso destipado é o ponto único
 * onde isso é assumido; assim que a migration
 * `20260909180000_bureau_credito.sql` for aplicada e os tipos regenerados,
 * basta trocar `db(supabase)` por `supabase` e o compilador volta a cobrir.
 */
function db(supabase: unknown): any {
  return supabase as any;
}

/**
 * Client de serviço. As chaves do bureau só são lidas e gravadas por aqui: a
 * coluna `credenciais` não é legível pela API (20261021090400), e cada função
 * confere a permissão antes de usar este client.
 */
async function clienteServico(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function correspondenteDoUsuario(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
  if (error) throw new Error("Não foi possível identificar o ecossistema.");
  return (data as string) ?? null;
}

interface LinhaConfig {
  id: string;
  provedor: string;
  nome: string;
  base_url: string | null;
  ativo: boolean;
  credenciais: Record<string, string> | null;
}

async function lerConfig(corr: string): Promise<LinhaConfig | null> {
  const admin = await clienteServico();
  const { data, error } = await admin
    .from("bureau_credenciais")
    .select("id, provedor, nome, base_url, ativo, credenciais")
    .eq("correspondente_id", corr)
    .maybeSingle();
  if (error) throw new Error("Não foi possível ler a configuração do bureau.");
  return (data as LinhaConfig | null) ?? null;
}

/** O que a tela precisa saber da configuração — nunca os valores das chaves. */
export interface ConfigBureau {
  provedor: string | null;
  nome: string | null;
  base_url: string | null;
  ativo: boolean;
  /**
   * O adaptador do fornecedor já existe? Sem ele a consulta não sai: a tela mostra
   * "Consulta indisponível" em vez de deixar a pessoa tentar e falhar.
   */
  integrado: boolean;
  /** Nomes dos campos já preenchidos, para a tela mostrar o que falta. */
  camposPreenchidos: string[];
  catalogo: ProvedorCatalogo[];
}

// A tela de consulta (CRM) só precisa saber se há bureau ativo; a de
// Integrações mostra o cadastro. Nenhuma das duas recebe o valor das chaves.
export const obterConfigBureau = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["crm.clientes", "view"], ["admin.integracoes", "view"])])
  .handler(async ({ context }): Promise<ConfigBureau> => {
    const { supabase, userId } = context;
    const vazio: ConfigBureau = {
      provedor: null,
      nome: null,
      base_url: null,
      ativo: false,
      integrado: false,
      camposPreenchidos: [],
      catalogo: PROVEDORES_BUREAU,
    };

    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) return vazio;

    const data = await lerConfig(corr);
    if (!data) return vazio;

    const creds = data.credenciais ?? {};
    const { adaptadorDe } = await import("./provedores");
    return {
      provedor: data.provedor,
      nome: data.nome,
      base_url: data.base_url,
      ativo: Boolean(data.ativo),
      integrado: adaptadorDe(data.provedor) != null,
      camposPreenchidos: Object.entries(creds)
        .filter(([, v]) => String(v ?? "").trim().length > 0)
        .map(([k]) => k),
      catalogo: PROVEDORES_BUREAU,
    };
  });

export const salvarConfigBureau = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["admin.integracoes", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        provedor: z.string().min(1),
        nome: z.string().min(1),
        base_url: z.string().url().nullable().optional(),
        /** Só o que o usuário digitou agora; o resto é preservado. */
        credenciais: z.record(z.string(), z.string()).default({}),
        ativo: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Ecossistema não identificado.");

    const catalogo = provedorDoCatalogo(data.provedor);
    if (!catalogo) throw new Error("Fornecedor de bureau desconhecido.");

    const atual = await lerConfig(corr);

    // Campo enviado em branco preserva o valor guardado: a tela nunca recebe
    // o segredo de volta, então vazio significa "não mexi nele". Na troca de
    // fornecedor nada do anterior é aproveitado (campos de mesmo nome, como
    // "usuario", não são a mesma chave em outro contrato).
    const mesmoProvedor = atual?.provedor === data.provedor;
    const anteriores = mesmoProvedor ? (atual?.credenciais ?? {}) : {};
    const camposValidos = new Set(catalogo.campos.map((c) => c.chave));
    const mescladas: Record<string, string> = {};
    for (const [chave, valor] of Object.entries(anteriores)) {
      if (camposValidos.has(chave)) mescladas[chave] = valor;
    }
    for (const [chave, valor] of Object.entries(data.credenciais)) {
      if (camposValidos.has(chave) && String(valor ?? "").trim().length > 0) {
        mescladas[chave] = valor;
      }
    }

    const linha = {
      correspondente_id: corr,
      provedor: data.provedor,
      nome: data.nome,
      base_url: data.base_url ?? null,
      credenciais: mescladas,
      ativo: data.ativo,
      updated_at: new Date().toISOString(),
    };

    const admin = await clienteServico();
    const { error } = atual?.id
      ? await admin.from("bureau_credenciais").update(linha).eq("id", atual.id)
      : await admin.from("bureau_credenciais").insert({ ...linha, criado_por: userId });
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const consultarFichaBureau = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["crm.clientes", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        documento: z.string().min(11),
        finalidade: z.string().min(3),
        cliente_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<FichaBureau> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Ecossistema não identificado.");

    const documento = soDigitos(data.documento);
    const tipoPessoa: "F" | "J" = documento.length > 11 ? "J" : "F";
    const valido = tipoPessoa === "F" ? validarCPF(documento) : validarCNPJ(documento);
    if (!valido) throw new ErroBureau("documento_invalido");

    const cfg = await lerConfig(corr);

    /**
     * Toda consulta vira registro, inclusive a que falhou: é o rastro LGPD.
     * Gravado em nome do usuário (a política confere conta e autor) e antes de
     * chamar o fornecedor; sem registro, a consulta não sai.
     */
    const registrar = async (erro: string): Promise<string> => {
      const { data: reg, error } = await db(supabase)
        .from("bureau_consultas")
        .insert({
          correspondente_id: corr,
          cliente_id: data.cliente_id ?? null,
          documento,
          tipo_pessoa: tipoPessoa,
          finalidade: data.finalidade,
          provedor: cfg?.provedor ?? "nenhum",
          sucesso: false,
          erro,
          ator_id: userId,
        })
        .select("id")
        .single();
      if (error || !reg) {
        throw new Error(
          "Não foi possível registrar a consulta no histórico. Por exigência da LGPD, a consulta não foi feita.",
        );
      }
      return reg.id as string;
    };

    if (!cfg || !cfg.ativo) {
      await registrar("sem_provedor");
      throw new ErroBureau("sem_provedor");
    }

    const catalogo = provedorDoCatalogo(cfg.provedor);
    const creds = cfg.credenciais ?? {};
    const faltando = (catalogo?.campos ?? [])
      .map((c) => c.chave)
      .filter((c) => !String(creds[c] ?? "").trim());
    if (faltando.length > 0) {
      await registrar(`sem_credenciais: ${faltando.join(", ")}`);
      throw new ErroBureau("sem_credenciais");
    }

    const { adaptadorDe } = await import("./provedores");
    const adaptador = adaptadorDe(cfg.provedor);
    if (!adaptador) {
      await registrar("adaptador_ausente");
      throw new ErroBureau(
        "sem_provedor",
        `O adaptador do ${catalogo?.nome ?? cfg.provedor} ainda não foi escrito. Envie a documentação da API do fornecedor para concluir a integração.`,
      );
    }

    // Registro antes da chamada; o resultado é anotado nele depois, pelo
    // servidor (pela API ninguém altera o histórico).
    const registroId = await registrar("sem_retorno");
    const concluir = async (campos: Record<string, unknown>) => {
      const admin = await clienteServico();
      const { error } = await admin.from("bureau_consultas").update(campos).eq("id", registroId);
      // O rastro (quem, quando, documento, finalidade) já está gravado; aqui só
      // falta o resultado. Não derruba a ficha que o fornecedor já cobrou.
      if (error) console.error("[bureau] resultado da consulta não anotado", registroId, error.message);
    };

    let ficha: FichaBureau;
    try {
      ficha = await adaptador.consultar(
        { documento, finalidade: data.finalidade, clienteId: data.cliente_id ?? null },
        {
          ...creds,
          base_url: cfg.base_url ?? catalogo?.baseUrlPadrao ?? "",
        },
      );
    } catch (e) {
      await concluir({ erro: e instanceof Error ? e.message : String(e) });
      throw e;
    }

    await concluir({ sucesso: true, erro: null, ficha });
    return ficha;
  });

export interface ConsultaHistorico {
  id: string;
  /** Inteiro só para quem vê dados sensíveis; os demais recebem mascarado. */
  documento: string;
  tipo_pessoa: string;
  finalidade: string;
  provedor: string;
  sucesso: boolean;
  erro: string | null;
  created_at: string;
  cliente_id: string | null;
  /** Nome do cadastro (CRM) ou o devolvido na ficha. */
  nome: string | null;
  /** Score como o fornecedor devolveu (a tela leva para 0–1.000). */
  score: number | null;
  score_maximo: number | null;
  apontamentos: number | null;
  /** Quem consultou. */
  responsavel: string | null;
}

const UUID = z.string().uuid();

function numeroOuNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Nomes por id numa consulta só (clientes do CRM ou pessoas que consultaram). */
async function nomesPorId(
  supabase: any,
  tabela: "clientes" | "profiles",
  ids: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const unicos = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!unicos.length) return {};
  const { data, error } = await supabase.from(tabela).select("id, nome").in("id", unicos);
  // Nome é complemento do histórico: sem ele a linha mostra o documento.
  if (error) return {};
  const mapa: Record<string, string> = {};
  for (const r of (data ?? []) as { id: string; nome: string | null }[]) {
    if (r.nome) mapa[r.id] = r.nome;
  }
  return mapa;
}

/**
 * Histórico de consultas do ecossistema (as 50 mais recentes). Com `cliente_id`, só as
 * daquele cliente (a Consulta Ficha aberta a partir da ficha do cliente).
 */
export const listarConsultasBureau = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["crm.clientes", "view"])])
  .inputValidator((d: unknown) =>
    z.object({ cliente_id: UUID.nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<ConsultaHistorico[]> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) return [];
    let consulta = db(supabase)
      .from("bureau_consultas")
      .select(
        "id, documento, tipo_pessoa, finalidade, provedor, sucesso, erro, created_at, cliente_id, ator_id, nome_ficha:ficha->>nome, score:ficha->score->>valor, score_maximo:ficha->score->>maximo, apontamentos:ficha->>totalRestricoes",
      )
      .eq("correspondente_id", corr);
    if (data.cliente_id) consulta = consulta.eq("cliente_id", data.cliente_id);
    const [consultas, podePii] = await Promise.all([
      consulta.order("created_at", { ascending: false }).limit(50),
      temPiiCliente(supabase, userId),
    ]);
    if (consultas.error) throw new Error("Não foi possível carregar o histórico de consultas.");
    const linhas = (consultas.data ?? []) as Array<Record<string, any>>;
    const [clientes, pessoas] = await Promise.all([
      nomesPorId(
        supabase,
        "clientes",
        linhas.map((l) => l.cliente_id),
      ),
      nomesPorId(
        supabase,
        "profiles",
        linhas.map((l) => l.ator_id),
      ),
    ]);
    return linhas.map((c) => ({
      id: c.id,
      documento: podePii ? c.documento : mascararDocumento(c.documento ?? ""),
      tipo_pessoa: c.tipo_pessoa,
      finalidade: c.finalidade,
      provedor: c.provedor,
      sucesso: Boolean(c.sucesso),
      erro: c.erro ?? null,
      created_at: c.created_at,
      cliente_id: c.cliente_id ?? null,
      nome: (c.cliente_id && clientes[c.cliente_id]) || c.nome_ficha || null,
      score: numeroOuNull(c.score),
      score_maximo: numeroOuNull(c.score_maximo),
      apontamentos: numeroOuNull(c.apontamentos),
      responsavel: (c.ator_id && pessoas[c.ator_id]) || null,
    }));
  });

/** Números do topo da tela: consultas do mês, total concluído e score médio (0–1.000). */
export const resumoConsultasBureau = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["crm.clientes", "view"])])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) return { mes: 0, total: 0, scoreMedio: null as number | null };
    // Início do mês no fuso de São Paulo (o servidor pode estar em UTC).
    const partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());
    const ano = partes.find((p) => p.type === "year")?.value;
    const mesAtual = partes.find((p) => p.type === "month")?.value;
    const inicioMes = `${ano}-${mesAtual}-01T00:00:00-03:00`;
    const base = () =>
      db(supabase)
        .from("bureau_consultas")
        .select("id", { count: "exact", head: true })
        .eq("correspondente_id", corr)
        .eq("sucesso", true);
    const [mes, total, scores] = await Promise.all([
      base().gte("created_at", inicioMes),
      base(),
      db(supabase)
        .from("bureau_consultas")
        .select("score:ficha->score->>valor, maximo:ficha->score->>maximo")
        .eq("correspondente_id", corr)
        .eq("sucesso", true)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (mes.error || total.error || scores.error) {
      throw new Error("Não foi possível carregar os números das consultas.");
    }
    const valores = ((scores.data ?? []) as Array<{ score: unknown; maximo: unknown }>)
      .map((r) => {
        const v = numeroOuNull(r.score);
        const m = numeroOuNull(r.maximo);
        return v == null ? null : (v / (m && m > 0 ? m : 1000)) * 1000;
      })
      .filter((v): v is number => v != null);
    return {
      mes: (mes.count as number | null) ?? 0,
      total: (total.count as number | null) ?? 0,
      scoreMedio: valores.length
        ? Math.round(valores.reduce((a, b) => a + b, 0) / valores.length)
        : null,
    };
  });

/**
 * Uma consulta do histórico com a ficha guardada (o "Relatório completo"). Quem não vê
 * dado sensível recebe o documento mascarado e a ficha sem os contatos.
 */
export const obterConsultaBureau = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["crm.clientes", "view"])])
  .inputValidator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Consulta não encontrada.");
    const [r, podePii] = await Promise.all([
      db(supabase)
        .from("bureau_consultas")
        .select("id, documento, finalidade, sucesso, erro, created_at, cliente_id, ator_id, ficha")
        .eq("id", data.id)
        .eq("correspondente_id", corr)
        .maybeSingle(),
      temPiiCliente(supabase, userId),
    ]);
    if (r.error) throw new Error("Não foi possível abrir a consulta.");
    if (!r.data) throw new Error("Consulta não encontrada.");
    const linha = r.data as Record<string, any>;
    const ficha = (linha.ficha ?? null) as FichaBureau | null;
    const [clientes, pessoas] = await Promise.all([
      nomesPorId(supabase, "clientes", [linha.cliente_id]),
      nomesPorId(supabase, "profiles", [linha.ator_id]),
    ]);
    return {
      id: linha.id as string,
      documento: podePii ? (linha.documento as string) : mascararDocumento(linha.documento ?? ""),
      finalidade: linha.finalidade as string,
      sucesso: Boolean(linha.sucesso),
      erro: (linha.erro ?? null) as string | null,
      created_at: linha.created_at as string,
      cliente_id: (linha.cliente_id ?? null) as string | null,
      cliente: ((linha.cliente_id && clientes[linha.cliente_id]) || null) as string | null,
      responsavel: ((linha.ator_id && pessoas[linha.ator_id]) || null) as string | null,
      ficha: (ficha && !podePii
        ? { ...ficha, documento: mascararDocumento(ficha.documento ?? ""), contatos: [] }
        : ficha) as FichaBureau | null,
    };
  });

/** Cliente do CRM para abrir a Consulta Ficha já escolhido (`?cliente=`). */
export const clienteParaFichaBureau = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["crm.clientes", "view"])])
  .inputValidator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [r, podePii] = await Promise.all([
      supabase
        .from("clientes")
        .select("id, nome, documento, telefone_celular")
        .eq("id", data.id)
        .is("deleted_at", null)
        .maybeSingle(),
      temPiiCliente(supabase, userId),
    ]);
    if (r.error || !r.data) return null;
    const c = r.data as {
      id: string;
      nome: string;
      documento: string | null;
      telefone_celular: string | null;
    };
    return {
      id: c.id,
      nome: c.nome,
      documento: c.documento ? (podePii ? c.documento : mascararDocumento(c.documento)) : null,
      celular: c.telefone_celular,
    };
  });
