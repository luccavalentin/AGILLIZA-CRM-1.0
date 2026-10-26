import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole } from "@/lib/session.functions";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { soDigitos, validarTelefone } from "@/lib/crm/documento";
import { gerarSenhaProvisoria } from "@/lib/admin/senha-provisoria";

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

/** Chaves "modulo:acao" liberadas num nível de acesso, com o escopo de dados de cada uma. */
async function chavesDoNivel(admin: any, nivelId: string): Promise<Map<string, string | null>> {
  const { data, error } = await admin
    .from("permissions")
    .select("modulo, acao, escopo_dados")
    .eq("nivel_acesso_id", nivelId)
    .eq("permitido", true);
  if (error) throw new Error("Não foi possível conferir as permissões do nível.");
  return new Map(
    ((data ?? []) as { modulo: string; acao: string; escopo_dados: string | null }[]).map((p) => [
      `${p.modulo}:${p.acao}`,
      p.escopo_dados,
    ]),
  );
}

/**
 * Alcance do escopo de dados. Sem escopo gravado vale "todos" (o mais amplo), para a
 * comparação nunca favorecer quem está dando o nível.
 */
const ALCANCE_ESCOPO: Record<string, number> = {
  proprios: 1,
  equipe: 2,
  personalizado: 3,
  todos: 4,
};
function alcance(escopo: string | null | undefined): number {
  return ALCANCE_ESCOPO[escopo ?? "todos"] ?? 4;
}

/**
 * Impede escalar privilégio pela tela de Pessoas: quem não é dono/admin só dá a
 * outra pessoa (ou mexe em quem tem) um nível cujas permissões ele mesmo tem.
 * Sem isso, quem cadastra pessoas criava alguém com um nível "maior" (a senha
 * provisória é o e-mail, que ele digitou), entrava com essa conta e ganhava o
 * acesso; e "Redefinir senha" de um superior dava a mesma porta. (Desde 26/10/2026 a
 * senha provisória é sorteada e vai só para o e-mail da pessoa — esta trava continua.)
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
    : new Map<string, string | null>();
  const alvo = await chavesDoNivel(supabaseAdmin, nivelId);
  // Teste adversarial 23/10/2026: comparar só "modulo:acao" deixava quem vê os PRÓPRIOS
  // clientes criar alguém (cuja senha provisória ele digitou) que vê TODOS. O escopo
  // de dados do alvo também não pode passar o de quem dá o nível.
  for (const [chave, escopo] of alvo) {
    if (!minhas.has(chave)) throw new Error(mensagem);
    if (alcance(escopo) > alcance(minhas.get(chave))) throw new Error(mensagem);
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

/**
 * Sem o envio de e-mail ninguém recebe a senha sorteada: a pessoa ficaria com um acesso
 * que não abre. Confere ANTES de mexer no Auth (auditoria de 26/10/2026): a ponte com a
 * plataforma, a credencial do e-mail com remetente e — quando a pessoa já existe — o
 * freio de envios e o perfil (`authUid`; `perfilAtivo` só na redefinição).
 */
async function exigirEnvioDeEmail(alvo?: { authUid: string; perfilAtivo: boolean }): Promise<void> {
  const { ponteConfigurada, emailConfiguradoNaPlataforma, conferirEnvioDeSenha } =
    await import("@/lib/plataforma/ponte.server");
  if (!ponteConfigurada()) {
    throw new Error(
      "O envio da senha por e-mail não está configurado neste servidor. Nada foi alterado.",
    );
  }
  if (!(await emailConfiguradoNaPlataforma())) {
    throw new Error(
      "O e-mail da plataforma não está configurado (Chaves dos provedores › E-mail transacional, com remetente). Sem ele a senha não chega à pessoa. Nada foi alterado.",
    );
  }
  if (alvo) await conferirEnvioDeSenha(alvo.authUid, alvo.perfilAtivo);
}

/** Manda a senha provisória só para o e-mail da pessoa (nunca volta para a tela). */
async function enviarSenha(
  authUid: string,
  senha: string,
): Promise<{ senha_enviada: boolean; aviso_envio: string | null }> {
  const { enviarSenhaProvisoriaPorEmail } = await import("@/lib/plataforma/ponte.server");
  const r = await enviarSenhaProvisoriaPorEmail(authUid, senha);
  return r.ok
    ? { senha_enviada: true, aviso_envio: null }
    : {
        senha_enviada: false,
        aviso_envio: `${r.motivo} A senha não chegou à pessoa: use “Redefinir senha” para enviar outra.`,
      };
}

/**
 * A pessoa ainda está na senha provisória (troca obrigatória no primeiro acesso pendente)
 * e tem login de verdade (não a conta banida de quem foi cadastrado sem login).
 */
export function senhaProvisoriaPendente(
  u:
    | { app_metadata?: Record<string, unknown> | null; banned_until?: string | null }
    | null
    | undefined,
): boolean {
  if (!u || u.app_metadata?.senha_provisoria !== true) return false;
  return !(u.banned_until && new Date(u.banned_until).getTime() > Date.now());
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
  /**
   * A senha provisória entrou na fila de e-mail da PRÓPRIA pessoa. Ela nunca volta para
   * a tela de quem cadastrou (decisão 15 do backtest de 23/10/2026).
   */
  senha_enviada: boolean;
  /** Quando não deu para enfileirar: o que aconteceu e o que fazer. */
  aviso_envio: string | null;
}

/**
 * Cria uma nova pessoa no ecossistema (equipe interna ou parceiro).
 * Exige pode_gerenciar_pessoas. Com login, sorteia a senha provisória e a envia por
 * e-mail só para a pessoa; no primeiro acesso ela define a dela (troca obrigatória).
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
    // Senha provisória sorteada (decisão 15 do backtest de 23/10/2026; antes era o
    // próprio e-mail e quem cadastrava a conhecia). Vai só para o e-mail da pessoa e só
    // serve para a primeira entrada: `senha_provisoria` no app_metadata (que só o
    // servidor escreve) prende a pessoa na troca de senha até ela definir a dela.
    // Sem login: e-mail sintético + senha sorteada; a conta fica banida no Auth.
    if (comLogin) await exigirEnvioDeEmail();
    const emailReal = comLogin ? (data.email ?? "").trim().toLowerCase() : "";
    const emailAuth = comLogin ? emailReal : `semlogin+${crypto.randomUUID()}@parceiro.local`;
    const senha = gerarSenhaProvisoria();

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

    const envio = comLogin
      ? await enviarSenha(created.user.id, senha)
      : { senha_enviada: false, aviso_envio: null };
    return { id: created.user.id, email: comLogin ? emailReal : "", ...envio };
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
 * Define o e-mail real, sorteia a senha provisória (enviada só para esse e-mail), desbane
 * no Auth e marca login_habilitado.
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
    await exigirEnvioDeEmail({ authUid: data.id, perfilAtivo: false });
    const senha = gerarSenhaProvisoria();
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

    return { id: data.id, email, ...(await enviarSenha(data.id, senha)) };
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

/**
 * Sorteia uma nova senha provisória e a envia só para o e-mail da pessoa (quem
 * redefine não a vê). No próximo acesso ela define a dela.
 */
export const resetarSenhaPessoa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["admin.pessoas", "edit"])])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<ResultadoCriarPessoa> => {
    const { supabase, userId } = context;
    const { correspondenteId, alvo } = await carregarAlvo(supabase, userId, data.id);

    // Senha provisória sorteada, só por e-mail, com troca obrigatória na entrada.
    if (!(alvo.email ?? "").trim()) throw new Error("Esta pessoa não tem e-mail de acesso.");
    // O freio e o perfil são conferidos ANTES da troca: senão a senha mudava e o e-mail
    // era recusado depois, e a pessoa ficava sem senha válida.
    await exigirEnvioDeEmail({ authUid: data.id, perfilAtivo: true });
    const senha = gerarSenhaProvisoria();
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

    return { id: data.id, email: alvo.email ?? "", ...(await enviarSenha(data.id, senha)) };
  });

export interface ResultadoSenhasAntigas {
  /** Pessoas com acesso ainda na senha provisória (troca obrigatória pendente). */
  pendentes: number;
  /** Até 20 nomes, para quem vai confirmar saber de quem se trata. */
  nomes: string[];
  /** Só quando `confirmar`: quantas senhas novas entraram na fila de e-mail. */
  enviadas: number;
  falhas: { nome: string; motivo: string }[];
}

/**
 * Contas criadas antes de 26/10/2026 ainda podem estar com a senha provisória igual ao
 * próprio e-mail (auditoria de 26/10/2026). Esta ação do administrador sorteia senha nova
 * e manda por e-mail a quem AINDA está com a troca obrigatória pendente — quem já definiu
 * a própria senha não é tocado. Sem `confirmar`, só conta (nada muda). Cada pessoa passa
 * pelas mesmas travas da redefinição (perfil ativo, freio de envios), conferidas ANTES de
 * trocar a senha no Auth. Só administrador ou correspondente.
 */
export const redefinirSenhasProvisoriasAntigas = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["admin.pessoas", "edit"])])
  .inputValidator((d: unknown) => z.object({ confirmar: z.boolean() }).parse(d))
  .handler(async ({ data, context }): Promise<ResultadoSenhasAntigas> => {
    const { supabase, userId } = context;
    const { data: topo } = await supabase.rpc("has_any_role", {
      _user_id: userId,
      _roles: ["admin", "correspondente"],
    });
    if (topo !== true) {
      throw new Error(
        "Só o administrador ou o correspondente redefine as senhas provisórias antigas.",
      );
    }
    const { data: me } = await supabase
      .from("profiles")
      .select("correspondente_id")
      .eq("id", userId)
      .maybeSingle();
    const correspondenteId = me?.correspondente_id;
    if (!correspondenteId) throw new Error("Ecossistema não identificado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: perfis, error } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, email")
      .eq("correspondente_id", correspondenteId)
      .eq("login_habilitado", true)
      .eq("ativo", true)
      .is("bloqueado_em", null)
      .is("deleted_at", null)
      .in("acesso_tipo", ["sistema", "portal_parceiro"])
      .not("email", "is", null)
      .neq("id", userId)
      .limit(1000);
    if (error) throw new Error("Não foi possível listar as pessoas.");

    const pendentes: { id: string; nome: string }[] = [];
    for (const p of (perfis ?? []) as { id: string; nome: string | null; email: string | null }[]) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(p.id);
      if (senhaProvisoriaPendente(u?.user))
        pendentes.push({ id: p.id, nome: p.nome ?? p.email ?? p.id });
    }
    const resultado: ResultadoSenhasAntigas = {
      pendentes: pendentes.length,
      nomes: pendentes.slice(0, 20).map((p) => p.nome),
      enviadas: 0,
      falhas: [],
    };
    if (!data.confirmar || pendentes.length === 0) return resultado;

    await exigirEnvioDeEmail();
    const { conferirEnvioDeSenha } = await import("@/lib/plataforma/ponte.server");
    for (const p of pendentes) {
      try {
        await conferirEnvioDeSenha(p.id, true);
        const senha = gerarSenhaProvisoria();
        const { error: e } = await supabaseAdmin.auth.admin.updateUserById(p.id, {
          password: senha,
          app_metadata: { senha_provisoria: true },
        });
        if (e) throw new Error("Não foi possível trocar a senha no Auth.");
        const envio = await enviarSenha(p.id, senha);
        if (envio.senha_enviada) resultado.enviadas += 1;
        else
          resultado.falhas.push({
            nome: p.nome,
            motivo: envio.aviso_envio ?? "E-mail não enfileirado.",
          });
      } catch (e) {
        resultado.falhas.push({
          nome: p.nome,
          motivo: e instanceof Error && e.message ? e.message : "Falhou.",
        });
      }
    }

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId,
      acao: "pessoa.redefinir_senhas_provisorias_antigas",
      entidade: "profiles",
      payloadNovo: {
        pendentes: resultado.pendentes,
        enviadas: resultado.enviadas,
        falhas: resultado.falhas.length,
      },
    });
    return resultado;
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
  .handler(async ({ data, context }): Promise<{ ok: true; aviso: string | null }> => {
    const { supabase, userId } = context;
    const { correspondenteId, alvo } = await carregarAlvo(supabase, userId, data.id);
    const antigo = (alvo.email ?? "").trim().toLowerCase();
    if (antigo === data.email) return { ok: true, aviso: null };

    // Auditoria de 26/10/2026: trocar o e-mail por um seu e depois "Redefinir senha" dava a
    // senha da pessoa a quem trocou. Agora o e-mail antigo é avisado na hora e recebe cópia
    // das senhas provisórias por 72 h — por isso a troca exige a ponte com a plataforma.
    const { ponteConfigurada, registrarTrocaDeEmail } =
      await import("@/lib/plataforma/ponte.server");
    if (antigo && !ponteConfigurada()) {
      throw new Error(
        "O aviso por e-mail não está configurado neste servidor; o e-mail de acesso não foi trocado.",
      );
    }

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
      payloadAnterior: { email: antigo || null },
      payloadNovo: { email: data.email },
    });
    const avisado = antigo ? await registrarTrocaDeEmail(data.id, antigo, data.email) : true;
    return {
      ok: true,
      aviso: avisado
        ? null
        : "O e-mail foi trocado, mas o aviso ao e-mail antigo não entrou na fila. Avise a pessoa por outro canal.",
    };
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
