import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validarCPF, validarCNPJ } from "@/lib/crm/documento";
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

async function correspondenteDoUsuario(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
  return (data as string) ?? null;
}

/** O que a tela precisa saber da configuração — nunca os valores das chaves. */
export interface ConfigBureau {
  provedor: string | null;
  nome: string | null;
  base_url: string | null;
  ativo: boolean;
  /** Nomes dos campos já preenchidos, para a tela mostrar o que falta. */
  camposPreenchidos: string[];
  catalogo: ProvedorCatalogo[];
}

export const obterConfigBureau = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConfigBureau> => {
    const { supabase, userId } = context;
    const vazio: ConfigBureau = {
      provedor: null,
      nome: null,
      base_url: null,
      ativo: false,
      camposPreenchidos: [],
      catalogo: PROVEDORES_BUREAU,
    };

    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) return vazio;

    const { data } = await db(supabase)
      .from("bureau_credenciais")
      .select("provedor, nome, base_url, ativo, credenciais")
      .eq("correspondente_id", corr)
      .maybeSingle();
    if (!data) return vazio;

    // Só os NOMES dos campos preenchidos saem daqui. Valor de credencial não
    // trafega para o navegador em nenhuma hipótese.
    const creds = ((data as any).credenciais ?? {}) as Record<string, unknown>;
    return {
      provedor: (data as any).provedor,
      nome: (data as any).nome,
      base_url: (data as any).base_url,
      ativo: Boolean((data as any).ativo),
      camposPreenchidos: Object.entries(creds)
        .filter(([, v]) => String(v ?? "").trim().length > 0)
        .map(([k]) => k),
      catalogo: PROVEDORES_BUREAU,
    };
  });

export const salvarConfigBureau = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

    if (!provedorDoCatalogo(data.provedor)) {
      throw new Error("Fornecedor de bureau desconhecido.");
    }

    const { data: atual } = await db(supabase)
      .from("bureau_credenciais")
      .select("id, credenciais")
      .eq("correspondente_id", corr)
      .maybeSingle();

    // Campo enviado em branco preserva o valor guardado: a tela nunca recebe
    // o segredo de volta, então vazio significa "não mexi nele".
    const anteriores = (((atual as any)?.credenciais ?? {}) as Record<string, string>) || {};
    const mescladas: Record<string, string> = { ...anteriores };
    for (const [chave, valor] of Object.entries(data.credenciais)) {
      if (String(valor ?? "").trim().length > 0) mescladas[chave] = valor;
    }

    const linha = {
      correspondente_id: corr,
      provedor: data.provedor,
      nome: data.nome,
      base_url: data.base_url ?? null,
      credenciais: mescladas,
      ativo: data.ativo,
      criado_por: userId,
      updated_at: new Date().toISOString(),
    };

    const { error } = (atual as any)?.id
      ? await db(supabase)
          .from("bureau_credenciais")
          .update(linha as any)
          .eq("id", (atual as any).id)
      : await db(supabase)
          .from("bureau_credenciais")
          .insert(linha as any);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const consultarFichaBureau = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

    const { data: cfg } = await db(supabase)
      .from("bureau_credenciais")
      .select("provedor, base_url, credenciais, ativo")
      .eq("correspondente_id", corr)
      .maybeSingle();

    /** Toda consulta vira registro, inclusive a que falhou: é o rastro LGPD. */
    const registrar = async (erro: string) => {
      await db(supabase)
        .from("bureau_consultas")
        .insert({
          correspondente_id: corr,
          cliente_id: data.cliente_id ?? null,
          documento,
          tipo_pessoa: tipoPessoa,
          finalidade: data.finalidade,
          provedor: (cfg as any)?.provedor ?? "nenhum",
          sucesso: false,
          erro,
          ator_id: userId,
        } as any);
    };

    if (!cfg || !(cfg as any).ativo) {
      await registrar("sem_provedor");
      throw new ErroBureau("sem_provedor");
    }

    const catalogo = provedorDoCatalogo((cfg as any).provedor);
    const creds = (((cfg as any).credenciais ?? {}) as Record<string, string>) || {};
    const faltando = (catalogo?.campos ?? [])
      .map((c) => c.chave)
      .filter((c) => !String(creds[c] ?? "").trim());
    if (faltando.length > 0) {
      await registrar(`sem_credenciais: ${faltando.join(", ")}`);
      throw new ErroBureau("sem_credenciais");
    }

    const { adaptadorDe } = await import("./provedores");
    const adaptador = adaptadorDe((cfg as any).provedor);
    if (!adaptador) {
      await registrar("adaptador_ausente");
      throw new ErroBureau(
        "sem_provedor",
        `O adaptador do ${catalogo?.nome ?? (cfg as any).provedor} ainda não foi escrito. Envie a documentação da API do fornecedor para concluir a integração.`,
      );
    }

    try {
      const ficha = await adaptador.consultar(
        { documento, finalidade: data.finalidade, clienteId: data.cliente_id ?? null },
        {
          ...creds,
          base_url: (cfg as any).base_url ?? catalogo?.baseUrlPadrao ?? "",
        },
      );

      await db(supabase)
        .from("bureau_consultas")
        .insert({
          correspondente_id: corr,
          cliente_id: data.cliente_id ?? null,
          documento,
          tipo_pessoa: tipoPessoa,
          finalidade: data.finalidade,
          provedor: (cfg as any).provedor,
          sucesso: true,
          ficha: ficha as any,
          ator_id: userId,
        } as any);

      return ficha;
    } catch (e) {
      await registrar(e instanceof Error ? e.message : String(e));
      throw e;
    }
  });

export interface ConsultaHistorico {
  id: string;
  documento: string;
  tipo_pessoa: string;
  finalidade: string;
  provedor: string;
  sucesso: boolean;
  erro: string | null;
  created_at: string;
}

export const listarConsultasBureau = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConsultaHistorico[]> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) return [];
    const { data } = await db(supabase)
      .from("bureau_consultas")
      .select("id, documento, tipo_pessoa, finalidade, provedor, sucesso, erro, created_at")
      .eq("correspondente_id", corr)
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []) as unknown as ConsultaHistorico[];
  });
