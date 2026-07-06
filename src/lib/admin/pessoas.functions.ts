import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole } from "@/lib/session.functions";

/** Papéis que NUNCA podem ser atribuídos por outro usuário do ecossistema. */
const PAPEIS_PROIBIDOS: AppRole[] = ["correspondente", "admin"];

export const criarSchema = z.object({
  nome: z.string().min(2, "Informe o nome completo."),
  email: z.string().email("E-mail inválido."),
  telefone: z.string().optional(),
  nivel_acesso_id: z.string().uuid("Selecione um nível de acesso."),
  dados_parceiro: z
    .object({
      creci: z.string().optional(),
      comissao_padrao: z.number().optional(),
      imobiliaria_id: z.string().uuid().optional().nullable(),
    })
    .optional(),
});

export type CriarPessoaInput = z.infer<typeof criarSchema>;

export interface PessoaLista {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  acesso_tipo: "sistema" | "portal_parceiro";
  ativo: boolean;
  bloqueado_em: string | null;
  roles: AppRole[];
  nivel_acesso_id: string | null;
  nivel_acesso_nome: string | null;
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
  .middleware([requireSupabaseAuth])
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
        "id, nome, email, telefone, acesso_tipo, ativo, bloqueado_em, nivel_acesso_id",
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

    return pessoas.map((p) => ({
      ...p,
      roles: rolesByUser.get(p.id) ?? [],
    }));
  });

export interface ResultadoCriarPessoa {
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

    const { data: pode } = await supabase.rpc("pode_gerenciar_pessoas", {
      _user_id: userId,
    });
    if (!pode) throw new Error("Você não tem permissão para gerenciar pessoas.");

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
      .select("id, papel, acesso_tipo")
      .eq("id", data.nivel_acesso_id)
      .maybeSingle();
    if (!nivel) throw new Error("Nível de acesso inválido.");

    const papel = (nivel.papel ?? "comercial") as AppRole;
    const acessoTipo = (nivel.acesso_tipo ?? "sistema") as "sistema" | "portal_parceiro";
    if (PAPEIS_PROIBIDOS.includes(papel)) {
      throw new Error("Papel não permitido.");
    }


    const senha = gerarSenhaTemporaria();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: senha,
        email_confirm: true,
        user_metadata: {
          full_name: data.nome,
          nome: data.nome,
          telefone: data.telefone ?? null,
          correspondente_id: correspondenteId,
          papel,
          acesso_tipo: acessoTipo,
          nivel_acesso_id: data.nivel_acesso_id,

        },
      });

    if (createErr || !created?.user) {
      // Mensagem genérica; não vaza se o e-mail já existe.
      throw new Error("Não foi possível criar a pessoa. Verifique os dados e tente novamente.");
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
      },

    });

    return { email: data.email, senha_temporaria: senha };
  });
