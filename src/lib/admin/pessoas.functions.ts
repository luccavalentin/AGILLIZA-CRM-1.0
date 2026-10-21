import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole } from "@/lib/session.functions";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { soDigitos, validarTelefone } from "@/lib/crm/documento";

/** Telefone opcional: vazio passa; preenchido precisa ser um número BR válido. */
const telefoneOpcional = z
  .string()
  .optional()
  .nullable()
  .refine((v) => !v || !v.trim() || validarTelefone(v), "Telefone inválido.")
  .transform((v) => (v && v.trim() ? soDigitos(v) : undefined));

/** Papéis que NUNCA podem ser atribuídos por outro usuário do ecossistema. */
const PAPEIS_PROIBIDOS: AppRole[] = ["correspondente", "admin"];

export const criarSchema = z
  .object({
    nome: z
      .string()
      .min(2, "Informe o nome completo.")
      .transform((v) => v.trim().toUpperCase()),
    email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
    telefone: telefoneOpcional,
    nivel_acesso_id: z.string().uuid("Selecione um nível de acesso."),
    tipo_pessoa: z.string().min(1).default("usuario"),
    tipos_pessoa: z.array(z.string().min(1)).optional(),
    avatar_url: z.string().url().optional().nullable(),
    com_login: z.boolean().default(true),
    dados_parceiro: z
      .object({
        creci: z.string().optional(),
        comissao_padrao: z
          .number()
          .min(0, "A comissão não pode ser negativa.")
          .max(100, "A comissão vai até 100%.")
          .optional(),
        imobiliaria_id: z.string().uuid().optional().nullable(),
      })
      .optional(),
  })
  .refine((d) => !d.com_login || (d.email && d.email.trim().length > 0), {
    message: "Informe um e-mail para pessoas com acesso ao sistema.",
    path: ["email"],
  });

export type CriarPessoaInput = z.infer<typeof criarSchema>;
export type TipoPessoa = string;

export interface PessoaLista {
  id: string;
  nome: string | null;
  avatar_url: string | null;
  email: string | null;
  telefone: string | null;
  acesso_tipo: "sistema" | "portal_parceiro";
  tipo_pessoa: TipoPessoa;
  tipos_pessoa: TipoPessoa[];
  login_habilitado: boolean;
  ativo: boolean;
  bloqueado_em: string | null;
  roles: AppRole[];
  nivel_acesso_id: string | null;
  nivel_acesso_nome: string | null;
}

/** Chaves "modulo:acao" liberadas num nível de acesso. */
async function chavesDoNivel(admin: any, nivelId: string): Promise<Set<string>> {
  const { data, error } = await admin
    .from("permissions")
    .select("modulo, acao")
    .eq("nivel_acesso_id", nivelId)
    .eq("permitido", true);
  if (error) throw new Error("Não foi possível conferir as permissões do nível.");
  return new Set(
    ((data ?? []) as { modulo: string; acao: string }[]).map((p) => `${p.modulo}:${p.acao}`),
  );
}

/**
 * Impede escalar privilégio pela tela de Pessoas: quem não é dono/admin só dá a
 * outra pessoa (ou mexe em quem tem) um nível cujas permissões ele mesmo tem.
 * Sem isso, quem cadastra pessoas criava alguém com um nível "maior" (a senha
 * provisória é o e-mail, que ele digitou), entrava com essa conta e ganhava o
 * acesso; e "Redefinir senha" de um superior dava a mesma porta.
 */
async function garantirNivelAoAlcance(
  supabase: any,
  userId: string,
  nivelId: string,
  mensagem = "Você não pode dar um nível de acesso com mais permissões que o seu.",
) {
  const { data: tudo } = await supabase.rpc("has_any_role", {
    _user_id: userId,
    _roles: ["admin", "correspondente"],
  });
  if (tudo === true) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: eu } = await supabaseAdmin
    .from("profiles")
    .select("nivel_acesso_id")
    .eq("id", userId)
    .maybeSingle();
  const minhas = eu?.nivel_acesso_id
    ? await chavesDoNivel(supabaseAdmin, eu.nivel_acesso_id)
    : new Set<string>();
  const alvo = await chavesDoNivel(supabaseAdmin, nivelId);
  for (const chave of alvo) {
    if (!minhas.has(chave)) throw new Error(mensagem);
  }
}

/** O nível escolhido precisa ser do próprio ecossistema ou um modelo global. */
function garantirNivelDoEcossistema(
  nivel: { correspondente_id?: string | null },
  correspondenteId: string,
) {
  if (nivel.correspondente_id && nivel.correspondente_id !== correspondenteId) {
    throw new Error("Nível de acesso inválido.");
  }
}

function gerarSenhaTemporaria(): string {
  const alfa = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const num = "23456789";
  const especial = "!@#$%&*";
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let base = "";
  for (let i = 0; i < 8; i++) base += pick(alfa);
  return `${pick(alfa).toUpperCase()}${base}${pick(num)}${pick(num)}${pick(especial)}`;
}

/** Lista todas as pessoas do ecossistema do usuário logado (equipe + parceiros). */
export const listarPessoas = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["admin.pessoas", "view"], ["admin.regras", "view"])])
  .handler(async ({ context }): Promise<PessoaLista[]> => {
    const { supabase, userId } = context;

    const { data: me } = await supabase
      .from("profiles")
      .select("correspondente_id")
      .eq("id", userId)
      .maybeSingle();

    const correspondenteId = me?.correspondente_id;
    if (!correspondenteId) return [];

    const { data: pessoas, error } = await supabase
      .from("profiles")
      .select(
        "id, nome, avatar_url, foto_url, email, telefone, acesso_tipo, tipo_pessoa, tipos_pessoa, login_habilitado, ativo, bloqueado_em, nivel_acesso_id",
      )
      .eq("correspondente_id", correspondenteId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    if (!pessoas || pessoas.length === 0) return [];

    const ids = pessoas.map((p) => p.id);
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids);

    const rolesByUser = new Map<string, AppRole[]>();
    (roleRows ?? []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesByUser.set(r.user_id, arr);
    });

    // Nome do nível de acesso (papel/função = nível de acesso).
    const nivelIds = Array.from(
      new Set(pessoas.map((p) => p.nivel_acesso_id).filter(Boolean)),
    ) as string[];
    const nomeByNivel = new Map<string, string>();
    if (nivelIds.length > 0) {
      const { data: niveis } = await supabase
        .from("access_levels")
        .select("id, nome")
        .in("id", nivelIds);
      (niveis ?? []).forEach((n) => nomeByNivel.set(n.id, n.nome));
    }

    return pessoas.map((p) => {
      const tps = ((p as { tipos_pessoa?: string[] | null }).tipos_pessoa ?? []).filter(Boolean);
      const primario = (p.tipo_pessoa ?? "usuario") as TipoPessoa;
      return {
        ...p,
        avatar_url: p.foto_url ?? p.avatar_url ?? null,
        tipo_pessoa: primario,
        tipos_pessoa: (tps.length > 0 ? tps : [primario]) as TipoPessoa[],
        login_habilitado: p.login_habilitado ?? true,
        roles: rolesByUser.get(p.id) ?? [],
        nivel_acesso_nome: p.nivel_acesso_id ? (nomeByNivel.get(p.nivel_acesso_id) ?? null) : null,
      };
    });
  });

export interface ResultadoCriarPessoa {
  id: string;
  email: string;
  senha_temporaria: string;
}

/**
 * Cria uma nova pessoa no ecossistema (equipe interna ou parceiro).
 * Exige pode_gerenciar_pessoas. Gera senha temporária exibida uma única vez.
 * NÃO envia e-mail — o correspondente repassa a senha manualmente.
 */
export const criarPessoaComAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => criarSchema.parse(data))
  .handler(async ({ data, context }): Promise<ResultadoCriarPessoa> => {
    const { supabase, userId } = context;

    const { data: me } = await supabase
      .from("profiles")
      .select("correspondente_id")
      .eq("id", userId)
      .maybeSingle();
    const correspondenteId = me?.correspondente_id;
    if (!correspondenteId) throw new Error("Ecossistema não identificado.");

    // Papel e portal são derivados do nível de acesso selecionado.
    const { data: nivel } = await supabase
      .from("access_levels")
      .select("id, papel, acesso_tipo, correspondente_id")
      .eq("id", data.nivel_acesso_id)
      .maybeSingle();
    if (!nivel) throw new Error("Nível de acesso inválido.");
    garantirNivelDoEcossistema(nivel, correspondenteId);

    const papel = (nivel.papel ?? "comercial") as AppRole;
    const acessoTipo = (nivel.acesso_tipo ?? "sistema") as "sistema" | "portal_parceiro";
    if (PAPEIS_PROIBIDOS.includes(papel)) {
      throw new Error("Papel não permitido.");
    }

    // Autorização:
    //  - quem gerencia pessoas pode criar qualquer nível permitido;
    //  - quem apenas cadastra clientes pode criar cadastros de parceiro
    //    (imobiliária/corretor) ou comercial, para vincular na hora.
    const { data: podeGerenciar } = await supabase.rpc("pode_gerenciar_pessoas", {
      _user_id: userId,
    });
    let autorizado = podeGerenciar === true;
    if (!autorizado) {
      const inlinePermitido = acessoTipo === "portal_parceiro" || papel === "comercial";
      if (inlinePermitido) {
        const { data: podeCliente } = await supabase.rpc("usuario_tem_permissao", {
          _user_id: userId,
          _modulo: "crm.clientes",
          _acao: "create",
        });
        autorizado = podeCliente === true;
      }
    }
    if (!autorizado) throw new Error("Você não tem permissão para gerenciar pessoas.");
    await garantirNivelAoAlcance(supabase, userId, data.nivel_acesso_id);

    const comLogin = data.com_login;
    // Tipos de pessoa (múltiplos): o primeiro é o "primário".
    const tiposList = (
      data.tipos_pessoa && data.tipos_pessoa.length > 0 ? data.tipos_pessoa : [data.tipo_pessoa]
    ).filter(Boolean);
    const tipoPrimario = tiposList[0] ?? "usuario";
    // Senha provisória = o próprio e-mail (regra do dono, 21/10/2026). Ela só
    // serve para a primeira entrada: `senha_provisoria` no app_metadata (que só o
    // servidor escreve) prende a pessoa na troca de senha até ela definir a dela.
    // Sem login: e-mail sintético + senha aleatória; a conta fica banida no Auth.
    const emailReal = comLogin ? (data.email ?? "").trim().toLowerCase() : "";
    const emailAuth = comLogin ? emailReal : `semlogin+${crypto.randomUUID()}@parceiro.local`;
    const senha = comLogin ? emailReal : gerarSenhaTemporaria();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: emailAuth,
      password: senha,
      email_confirm: true,
      app_metadata: { senha_provisoria: comLogin },
      user_metadata: {
        full_name: data.nome,
        nome: data.nome,
        telefone: data.telefone ?? null,
        correspondente_id: correspondenteId,
        papel,
        acesso_tipo: acessoTipo,
        nivel_acesso_id: data.nivel_acesso_id,
        tipo_pessoa: tipoPrimario,
        login_habilitado: comLogin,
      },
    });

    if (createErr || !created?.user) {
      // Quem cadastra é o administrador da conta: dizer que o e-mail já existe
      // é o que ele precisa para resolver (a mensagem genérica não explicava nada).
      if (createErr && /already|exists|registered/i.test(createErr.message ?? "")) {
        throw new Error(
          "Este e-mail já está cadastrado. Use outro e-mail ou procure a pessoa na lista.",
        );
      }
      throw new Error("Não foi possível criar a pessoa. Verifique os dados e tente novamente.");
    }

    // Sem login: bane a conta no Auth (aparece nas buscas, mas não entra).
    if (!comLogin) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(created.user.id, {
          ban_duration: "876000h",
        });
      } catch {
        /* best-effort */
      }
    }

    // Garante tipo_pessoa/login_habilitado no profile (a trigger já lê o metadata,
    // mas reforçamos aqui para robustez). Se qualquer passo pós-createUser falhar,
    // removemos o usuário do Auth para evitar cadastros órfãos (atomicidade manual).
    try {
      const { error: updErr } = await supabaseAdmin
        .from("profiles")
        .update({
          tipo_pessoa: tipoPrimario,
          tipos_pessoa: tiposList,
          login_habilitado: comLogin,
          email: comLogin ? emailReal : null,
          // A foto informada no cadastro era aceita e descartada.
          ...(data.avatar_url ? { avatar_url: data.avatar_url, foto_url: data.avatar_url } : {}),
        } as never)
        .eq("id", created.user.id);
      if (updErr) throw updErr;

      // Parceiro precisa da ficha de parceiro: é dela que saem a lista de
      // /crm/parceiros, o portal do parceiro e o % de comissão padrão. Antes o
      // formulário enviava a comissão e nada a gravava.
      if (
        acessoTipo === "portal_parceiro" &&
        tiposList.some((t) => t === "imobiliaria" || t === "corretor")
      ) {
        const dp = data.dados_parceiro;
        const { error: parcErr } = await supabaseAdmin.from("parceiro_detalhes").insert({
          profile_id: created.user.id,
          correspondente_id: correspondenteId,
          creci: dp?.creci?.trim() || null,
          percentual_comissao: dp?.comissao_padrao ?? 0,
          imobiliaria_id: dp?.imobiliaria_id ?? null,
          tipo_pessoa: tiposList.includes("imobiliaria") ? "pj" : "pf",
        } as never);
        if (parcErr) throw parcErr;
      }

      // Auditoria (o trigger já criou profiles + user_roles).
      const { registrarAuditoria } = await import("@/lib/admin/audit.server");
      await registrarAuditoria({
        supabase,
        userId,
        correspondenteId,
        acao: "pessoa.criar",
        entidade: "profiles",
        entidadeId: created.user.id,
        payloadNovo: {
          nome: data.nome,
          acesso_tipo: acessoTipo,
          papel,
          tipo_pessoa: data.tipo_pessoa,
          com_login: comLogin,
        },
      });
    } catch (postErr) {
      // Rollback: remove o auth user para não deixar cadastro parcial no ecossistema.
      try {
        await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      } catch {
        /* best-effort: se falhar aqui, o admin deve limpar manualmente */
      }
      throw new Error(
        postErr instanceof Error && postErr.message
          ? `Falha ao finalizar cadastro: ${postErr.message}`
          : "Falha ao finalizar cadastro. Tente novamente.",
      );
    }

    return {
      id: created.user.id,
      email: comLogin ? emailReal : "",
      senha_temporaria: comLogin ? senha : "",
    };
  });

/** Carrega o perfil alvo garantindo que pertence ao mesmo ecossistema do solicitante. */
async function carregarAlvo(supabase: any, userId: string, alvoId: string) {
  const { data: pode } = await supabase.rpc("pode_gerenciar_pessoas", { _user_id: userId });
  if (!pode) throw new Error("Você não tem permissão para gerenciar pessoas.");
  if (alvoId === userId) throw new Error("Você não pode alterar o seu próprio cadastro por aqui.");

  const { data: me } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  const correspondenteId = me?.correspondente_id;
  if (!correspondenteId) throw new Error("Ecossistema não identificado.");

  const { data: alvo } = await supabase
    .from("profiles")
    .select(
      "id, nome, email, telefone, acesso_tipo, ativo, bloqueado_em, nivel_acesso_id, correspondente_id",
    )
    .eq("id", alvoId)
    .maybeSingle();
  if (!alvo || alvo.correspondente_id !== correspondenteId) {
    throw new Error("Pessoa não encontrada no seu ecossistema.");
  }

  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", alvoId);
  const papeis = (roles ?? []).map((r: { role: AppRole }) => r.role) as AppRole[];
  if (papeis.some((p) => PAPEIS_PROIBIDOS.includes(p))) {
    throw new Error("Este cadastro não pode ser gerenciado.");
  }
  // Ninguém mexe (senha, e-mail, bloqueio, exclusão) em quem tem mais acesso que ele.
  if (alvo.nivel_acesso_id) {
    await garantirNivelAoAlcance(
      supabase,
      userId,
      alvo.nivel_acesso_id,
      "Esta pessoa tem um nível de acesso com mais permissões que o seu.",
    );
  }

  return { correspondenteId, alvo };
}

export const atualizarSchema = z.object({
  id: z.string().uuid(),
  nome: z
    .string()
    .min(2, "Informe o nome completo.")
    .transform((v) => v.trim().toUpperCase()),
  telefone: telefoneOpcional,
  nivel_acesso_id: z.string().uuid("Selecione um nível de acesso."),
  tipo_pessoa: z.string().min(1).optional(),
  tipos_pessoa: z.array(z.string().min(1)).optional(),
  avatar_url: z.string().url().optional().nullable(),
});

/** Atualiza dados básicos e o nível de acesso (papel/portal) de uma pessoa. */
export const atualizarPessoa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["admin.pessoas", "edit"])])
  .inputValidator((data: unknown) => atualizarSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { correspondenteId, alvo } = await carregarAlvo(supabase, userId, data.id);

    const { data: nivel } = await supabase
      .from("access_levels")
      .select("id, papel, acesso_tipo, correspondente_id")
      .eq("id", data.nivel_acesso_id)
      .maybeSingle();
    if (!nivel) throw new Error("Nível de acesso inválido.");
    garantirNivelDoEcossistema(nivel, correspondenteId);

    const papel = (nivel.papel ?? "comercial") as AppRole;
    const acessoTipo = (nivel.acesso_tipo ?? "sistema") as "sistema" | "portal_parceiro";
    if (PAPEIS_PROIBIDOS.includes(papel)) throw new Error("Papel não permitido.");
    if (data.nivel_acesso_id !== alvo.nivel_acesso_id) {
      await garantirNivelAoAlcance(supabase, userId, data.nivel_acesso_id);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Tipos de pessoa múltiplos (primeiro = primário).
    const tiposList = (
      data.tipos_pessoa && data.tipos_pessoa.length > 0
        ? data.tipos_pessoa
        : data.tipo_pessoa
          ? [data.tipo_pessoa]
          : []
    ).filter(Boolean);

    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({
        nome: data.nome,
        telefone: data.telefone ?? null,
        nivel_acesso_id: data.nivel_acesso_id,
        acesso_tipo: acessoTipo,
        avatar_url: data.avatar_url,
        foto_url: data.avatar_url,
        ...(tiposList.length > 0 ? { tipo_pessoa: tiposList[0], tipos_pessoa: tiposList } : {}),
      } as never)
      .eq("id", data.id);
    if (upErr) throw new Error("Não foi possível atualizar a pessoa.");

    // Sincroniza o papel (mantém os papéis protegidos intocados).
    // Falha aqui deixava o nível novo com o papel antigo (sem aviso).
    const { error: delRoleErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.id)
      .not("role", "in", `(${PAPEIS_PROIBIDOS.join(",")})`);
    if (delRoleErr) throw new Error("Não foi possível atualizar o papel da pessoa.");
    const { error: upRoleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.id, role: papel }, { onConflict: "user_id,role" });
    if (upRoleErr) throw new Error("Não foi possível atualizar o papel da pessoa.");

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId,
      acao: "pessoa.atualizar",
      entidade: "profiles",
      entidadeId: data.id,
      payloadAnterior: { nome: alvo.nome, nivel_acesso_id: alvo.nivel_acesso_id },
      payloadNovo: { nome: data.nome, nivel_acesso_id: data.nivel_acesso_id, papel },
    });

    return { ok: true };
  });

/**
 * Habilita o login de uma pessoa que foi cadastrada sem acesso (imobiliária/corretor).
 * Define o e-mail real, gera senha provisória, desbane no Auth e marca login_habilitado.
 */
export const habilitarLoginPessoa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["admin.pessoas", "edit"])])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), email: z.string().email("E-mail inválido.") }).parse(data),
  )
  .handler(async ({ data, context }): Promise<ResultadoCriarPessoa> => {
    const { supabase, userId } = context;
    const { correspondenteId } = await carregarAlvo(supabase, userId, data.id);

    const email = data.email.trim().toLowerCase();
    const senha = email;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      email,
      email_confirm: true,
      password: senha,
      app_metadata: { senha_provisoria: true },
      ban_duration: "none",
    });
    if (authErr) {
      throw new Error("Não foi possível habilitar o login. Verifique o e-mail e tente novamente.");
    }

    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ email, login_habilitado: true, ativo: true, bloqueado_em: null })
      .eq("id", data.id);
    if (upErr) throw new Error("Não foi possível habilitar o login.");

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId,
      acao: "pessoa.habilitar_login",
      entidade: "profiles",
      entidadeId: data.id,
      payloadNovo: { email },
    });

    return { id: data.id, email, senha_temporaria: senha };
  });

/** Ativa ou desativa (bloqueia) o acesso de uma pessoa. */
export const alternarStatusPessoa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["admin.pessoas", "edit"])])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), ativar: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { correspondenteId } = await carregarAlvo(supabase, userId, data.id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        ativo: data.ativar,
        bloqueado_em: data.ativar ? null : new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error("Não foi possível alterar o status da pessoa.");

    // Bloqueia/desbloqueia o login também no Auth.
    try {
      await supabaseAdmin.auth.admin.updateUserById(data.id, {
        ban_duration: data.ativar ? "none" : "876000h",
      });
    } catch {
      /* best-effort */
    }

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId,
      acao: data.ativar ? "pessoa.ativar" : "pessoa.desativar",
      entidade: "profiles",
      entidadeId: data.id,
    });

    return { ok: true };
  });

/** Gera uma nova senha temporária para a pessoa (exibida uma única vez). */
export const resetarSenhaPessoa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["admin.pessoas", "edit"])])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<ResultadoCriarPessoa> => {
    const { supabase, userId } = context;
    const { correspondenteId, alvo } = await carregarAlvo(supabase, userId, data.id);

    // Volta à senha provisória = o próprio e-mail, com troca obrigatória na entrada.
    const senha = (alvo.email ?? "").trim().toLowerCase();
    if (!senha) throw new Error("Esta pessoa não tem e-mail de acesso.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      password: senha,
      app_metadata: { senha_provisoria: true },
    });
    if (error) throw new Error("Não foi possível redefinir a senha.");

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId,
      acao: "pessoa.resetar_senha",
      entidade: "profiles",
      entidadeId: data.id,
    });

    return { id: data.id, email: alvo.email ?? "", senha_temporaria: senha };
  });

/**
 * Troca o e-mail de acesso. A API administrativa do Auth exige a chave de serviço,
 * então roda aqui no servidor (antes era chamada do navegador e voltava 403).
 */
export const alterarEmailPessoa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["admin.pessoas", "edit"])])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { correspondenteId, alvo } = await carregarAlvo(supabase, userId, data.id);
    if ((alvo.email ?? "").toLowerCase() === data.email) return { ok: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      email: data.email,
      email_confirm: true,
    });
    if (error) {
      throw new Error(
        /already|exists|registered/i.test(error.message)
          ? "Este e-mail já está em uso por outra pessoa."
          : "Não foi possível trocar o e-mail.",
      );
    }
    await supabaseAdmin.from("profiles").update({ email: data.email }).eq("id", data.id);

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId,
      acao: "pessoa.alterar_email",
      entidade: "profiles",
      entidadeId: data.id,
      payloadNovo: { email: data.email },
    });
    return { ok: true };
  });

/** Exclui definitivamente uma pessoa (remove o acesso ao sistema). */
export const excluirPessoa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["admin.pessoas", "edit"])])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { correspondenteId, alvo } = await carregarAlvo(supabase, userId, data.id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error("Não foi possível excluir a pessoa.");

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId,
      acao: "pessoa.excluir",
      entidade: "profiles",
      entidadeId: data.id,
      payloadAnterior: { nome: alvo.nome },
    });

    return { ok: true };
  });
