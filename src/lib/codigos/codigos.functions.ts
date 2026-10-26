/**
 * Servidor de e-mail (antes "Códigos de acesso") — a tela lê e configura pelo servidor
 * (as tabelas não abrem para a API do navegador). `operacional.codigos › view` para ver
 * as mensagens capturadas; `operacional.codigos › edit` para cadastrar, editar, pausar e
 * testar as caixas vigiadas e o filtro de palavras de cada uma.
 *
 * Caixas por pessoa (decisão 16 do docs/38, 26/10/2026): cada pessoa vê SÓ as caixas liberadas
 * para ela — quem cadastrou, as pessoas que ele liberou e a administração do correspondente.
 * Quem decide é o banco (`codigos_pode_ver_caixa`/`codigos_pode_gerir_caixa`, migração
 * 20261027120002): toda leitura passa por `codigos_mensagens`/`codigos_caixas_visiveis` com o
 * id da pessoa, e toda ação numa caixa confere antes se a pessoa a gere.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { trocaExigeSenha, type CampoFiltro, type OperadorFiltro } from "./filtros";

export interface CodigoRecebido {
  id: string;
  caixa_id: string;
  recebido_em: string;
  remetente_nome: string | null;
  remetente_email: string | null;
  banco: string | null;
  assunto: string | null;
  trecho: string | null;
  codigo: string | null;
  motivo: string | null;
  caixa_email: string;
  caixa_nome: string | null;
}

export interface FiltroCaixa {
  operador: OperadorFiltro;
  campo: CampoFiltro;
  termo: string;
  ativo: boolean;
}

export interface CaixaVigiada {
  id: string;
  nome: string | null;
  email: string;
  usuario: string | null;
  imap_host: string;
  imap_port: number;
  imap_ssl: boolean;
  pasta: string;
  usar_palavras_padrao: boolean;
  ativo: boolean;
  tem_senha: boolean;
  status: "aguardando" | "conectado" | "espera" | "erro" | "desligado";
  erro: string | null;
  espera_ate: string | null;
  ultima_leitura: string | null;
  teste_em: string | null;
  teste_ok: boolean | null;
  teste_msg: string | null;
  filtros: FiltroCaixa[];
  /** Pessoas liberadas (além de quem cadastrou e da administração). */
  pessoas: string[];
  /** Quem cadastrou ou a administração: edita, pausa, testa, remove e libera pessoas. */
  pode_gerir: boolean;
}

export interface PessoaLiberavel {
  id: string;
  nome: string;
}

async function admin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

/**
 * Os códigos são de acesso aos BANCOS do correspondente: só a equipe interna os vê.
 * Teste adversarial 23/10/2026: nível de acesso novo nasce com "ver" em todo módulo
 * operacional — inclusive nível de portal do parceiro —, então um parceiro externo
 * passava a ler os códigos. A matriz sozinha não basta: aqui o portal do parceiro
 * (e quem está desativado/bloqueado) é recusado mesmo com a permissão marcada.
 */
async function exigirEquipeInterna(userId: string): Promise<void> {
  const db = await admin();
  const { data } = await db
    .from("profiles")
    .select("acesso_tipo, ativo, bloqueado_em")
    .eq("id", userId)
    .maybeSingle();
  const p = data as { acesso_tipo?: string | null; ativo?: boolean | null; bloqueado_em?: string | null } | null;
  if (!p || p.acesso_tipo !== "sistema" || p.ativo === false || p.bloqueado_em) {
    throw new Error("Você não tem permissão para esta ação.");
  }
}

/** Caixas que a pessoa vê (e se gere cada uma), decididas pelo banco. */
async function caixasDaPessoa(db: SupabaseClient, userId: string): Promise<Map<string, boolean>> {
  const { data, error } = await db.rpc("codigos_caixas_visiveis", { p_user: userId });
  if (error) throw new Error("Não foi possível carregar as caixas.");
  return new Map(((data ?? []) as { caixa_id: string; pode_gerir: boolean }[]).map((x) => [x.caixa_id, x.pode_gerir]));
}

/** Ação numa caixa: só quem a gere (quem cadastrou ou a administração). */
async function exigirGerir(db: SupabaseClient, caixaId: string, userId: string): Promise<void> {
  const { data, error } = await db.rpc("codigos_pode_gerir_caixa", { p_caixa: caixaId, p_user: userId });
  if (error || data !== true) throw new Error("Caixa não encontrada ou sem permissão para gerir.");
}

const filtroListaSchema = z
  .object({
    caixaId: z.string().uuid().nullable().optional(),
    periodo: z.enum(["24h", "7d"]).default("24h"),
    soCodigos: z.boolean().default(false),
    busca: z.string().trim().max(80).optional().nullable(),
  })
  .default({});

/** Mensagens capturadas (com ou sem código), da mais nova para a mais antiga. */
export const listarCodigos = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["operacional.codigos", "view"])])
  .inputValidator((d: unknown) => filtroListaSchema.parse(d ?? {}))
  .handler(async ({ data: f, context }): Promise<CodigoRecebido[]> => {
    await exigirEquipeInterna(context.userId);
    const db = await admin();
    const horas = f.periodo === "7d" ? 7 * 24 : 24;
    const desde = new Date(Date.now() - horas * 3_600_000).toISOString();
    // O banco devolve só as mensagens das caixas que a pessoa vê (decisão 16 do docs/38).
    const { data, error } = await db.rpc("codigos_mensagens", {
      p_user: context.userId,
      p_caixa: f.caixaId ?? null,
      p_desde: desde,
      p_so_codigos: f.soCodigos,
      p_busca: f.busca ?? null,
      p_limite: f.periodo === "7d" ? 300 : 100,
    });
    if (error) throw new Error("Não foi possível carregar as mensagens.");
    return (data ?? []) as CodigoRecebido[];
  });


/** Caixas vigiadas, o estado da leitura e as regras de filtro (sem a senha). */
export const listarCaixas = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["operacional.codigos", "view"])])
  .handler(async ({ context }): Promise<CaixaVigiada[]> => {
    await exigirEquipeInterna(context.userId);
    const db = await admin();
    const visiveis = await caixasDaPessoa(db, context.userId);
    const ids = [...visiveis.keys()];
    if (!ids.length) return [];
    const [caixas, filtros, pessoas] = await Promise.all([
      db
        .from("codigos_caixas")
        .select(
          "id, nome, email, usuario, imap_host, imap_port, imap_ssl, pasta, usar_palavras_padrao, ativo, senha_cifrada, status, erro, espera_ate, ultima_leitura, teste_em, teste_ok, teste_msg",
        )
        .in("id", ids)
        .order("created_at"),
      db.from("codigos_filtros").select("caixa_id, operador, campo, termo, ativo").in("caixa_id", ids).order("created_at"),
      db.from("codigos_caixas_pessoas").select("caixa_id, user_id").in("caixa_id", ids),
    ]);
    if (caixas.error || filtros.error || pessoas.error) throw new Error("Não foi possível carregar as caixas.");
    const pessoasPorCaixa = new Map<string, string[]>();
    for (const x of (pessoas.data ?? []) as { caixa_id: string; user_id: string }[]) {
      pessoasPorCaixa.set(x.caixa_id, [...(pessoasPorCaixa.get(x.caixa_id) ?? []), x.user_id]);
    }
    const porCaixa = new Map<string, FiltroCaixa[]>();
    for (const f of (filtros.data ?? []) as (FiltroCaixa & { caixa_id: string })[]) {
      const { caixa_id, ...regra } = f;
      porCaixa.set(caixa_id, [...(porCaixa.get(caixa_id) ?? []), regra]);
    }
    return (caixas.data ?? []).map(({ senha_cifrada, ...c }) => ({
      ...(c as Omit<CaixaVigiada, "tem_senha" | "filtros">),
      tem_senha: Boolean(senha_cifrada),
      filtros: porCaixa.get((c as { id: string }).id) ?? [],
      pessoas: pessoasPorCaixa.get((c as { id: string }).id) ?? [],
      pode_gerir: visiveis.get((c as { id: string }).id) === true,
    }));
  });

const filtroSchema = z.object({
  operador: z.enum(["contem", "nao_contem"]),
  campo: z.enum(["qualquer", "assunto", "remetente", "corpo"]),
  termo: z.string().trim().min(2, "Cada termo precisa de ao menos 2 letras.").max(120),
  ativo: z.boolean().default(true),
});

export const caixaSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().max(80).optional().nullable(),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  usuario: z.string().trim().max(200).optional().nullable(),
  senha: z.string().max(200).optional(),
  imap_host: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/, "Servidor inválido."),
  imap_port: z.number().int().min(1).max(65535),
  imap_ssl: z.boolean().default(true),
  pasta: z
    .string()
    .trim()
    .min(1, "Informe a pasta (normalmente INBOX).")
    .max(120)
    .regex(/^[^\r\n"]+$/, "Pasta inválida."),
  usar_palavras_padrao: z.boolean().default(true),
  ativo: z.boolean(),
  filtros: z.array(filtroSchema).max(50, "Use no máximo 50 regras por caixa.").default([]),
  /** Quem mais vê a caixa (quem cadastrou e a administração sempre veem). */
  pessoas: z.array(z.string().uuid()).max(200).default([]),
});

export type DadosCaixa = z.input<typeof caixaSchema>;

/**
 * Cadastra ou altera a caixa e as regras dela. Senha nova: cifra, zera a espera e as
 * falhas (a recusa anterior pode ter sido a senha errada) e o leitor tenta na próxima volta.
 */
export const salvarCaixa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["operacional.codigos", "edit"])])
  .inputValidator((d: unknown) => caixaSchema.parse(d))
  .handler(async ({ data, context }) => {
    await exigirEquipeInterna(context.userId);
    const db = await admin();
    const { cifrarSenha } = await import("./cripto.server");
    const usuario = data.usuario?.trim() ? data.usuario.trim() : null;
    if (data.id) await exigirGerir(db, data.id, context.userId);
    if (data.id && !data.senha) {
      const { data: atual } = await db
        .from("codigos_caixas")
        .select("email, usuario, imap_host, imap_port, imap_ssl, senha_cifrada")
        .eq("id", data.id)
        .maybeSingle();
      if (!atual) throw new Error("Caixa não encontrada.");
      const a = atual as {
        email: string;
        usuario: string | null;
        imap_host: string;
        imap_port: number;
        imap_ssl: boolean;
        senha_cifrada: string;
      };
      if (a.senha_cifrada && trocaExigeSenha(a, { ...data, usuario })) {
        throw new Error(
          "Para trocar o e-mail, o usuário, o servidor, a porta ou desligar o SSL, informe a senha da caixa de novo.",
        );
      }
    }
    const campos: Record<string, unknown> = {
      nome: data.nome?.trim() || null,
      email: data.email,
      usuario,
      imap_host: data.imap_host,
      imap_port: data.imap_port,
      imap_ssl: data.imap_ssl,
      pasta: data.pasta,
      usar_palavras_padrao: data.usar_palavras_padrao,
      ativo: data.ativo,
      status: data.ativo ? "aguardando" : "desligado",
      updated_at: new Date().toISOString(),
    };
    if (data.senha) {
      Object.assign(campos, {
        senha_cifrada: cifrarSenha(data.senha),
        falhas: 0,
        espera_ate: null,
        erro: null,
      });
    }
    let id = data.id;
    if (id) {
      const { error } = await db.from("codigos_caixas").update(campos).eq("id", id);
      if (error) throw new Error(mensagem(error.message));
    } else {
      if (!data.senha) throw new Error("Informe a senha da caixa.");
      const { data: nova, error } = await db
        .from("codigos_caixas")
        .insert({ ...campos, criado_por: context.userId })
        .select("id")
        .single();
      if (error) throw new Error(mensagem(error.message));
      id = (nova as { id: string }).id;
    }
    const { error: erroFiltros } = await db.rpc("codigos_substituir_filtros", {
      p_caixa: id,
      p_filtros: data.filtros,
      p_autor: context.userId,
    });
    if (erroFiltros) throw new Error("A caixa foi salva, mas as regras de filtro não. Tente de novo.");
    const { error: erroPessoas } = await db.rpc("codigos_definir_pessoas", {
      p_caixa: id,
      p_pessoas: data.pessoas,
      p_autor: context.userId,
    });
    if (erroPessoas) throw new Error("A caixa foi salva, mas a lista de pessoas não. Confira as pessoas escolhidas.");
    return { id: id! };
  });

/** Pausa ou retoma a leitura (o leitor solta a conexão na próxima volta). */
export const pausarCaixa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["operacional.codigos", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), ativo: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirEquipeInterna(context.userId);
    const db = await admin();
    await exigirGerir(db, data.id, context.userId);
    const { data: feito, error } = await db
      .from("codigos_caixas")
      .update({
        ativo: data.ativo,
        status: data.ativo ? "aguardando" : "desligado",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("id");
    if (error || !feito?.length) throw new Error("Caixa não encontrada.");
    return { ok: true };
  });

/** Testa o login e a pasta da caixa sem atrapalhar o leitor (ver teste-conexao.ts). */
export const testarConexaoCaixa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["operacional.codigos", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirEquipeInterna(context.userId);
    const db = await admin();
    await exigirGerir(db, data.id, context.userId);
    const { testarCaixa } = await import("./teste-conexao.server");
    const r = await testarCaixa(db, data.id);
    return { ok: r.ok, mensagem: r.mensagem };
  });

/** Remove a caixa (e as mensagens e regras dela). O leitor solta a conexão na próxima volta. */
export const removerCaixa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["operacional.codigos", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirEquipeInterna(context.userId);
    const db = await admin();
    await exigirGerir(db, data.id, context.userId);
    const { error } = await db.from("codigos_caixas").delete().eq("id", data.id);
    if (error) throw new Error("Não foi possível remover a caixa.");
    return { ok: true };
  });

/** Pessoas da equipe interna do correspondente que podem ser liberadas numa caixa. */
export const listarPessoasLiberaveis = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["operacional.codigos", "edit"])])
  .handler(async ({ context }): Promise<PessoaLiberavel[]> => {
    await exigirEquipeInterna(context.userId);
    const db = await admin();
    const { data, error } = await db.rpc("codigos_pessoas_disponiveis", { p_user: context.userId });
    if (error) throw new Error("Não foi possível carregar a equipe.");
    return ((data ?? []) as PessoaLiberavel[]).filter((p) => p.id !== context.userId);
  });

function mensagem(msg: string): string {
  if (/codigos_caixas_email_uniq|duplicate key/i.test(msg)) return "Esta caixa já está cadastrada.";
  return "Não foi possível salvar a caixa.";
}
