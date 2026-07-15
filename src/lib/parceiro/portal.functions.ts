import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole } from "@/lib/session.functions";

const PAPEIS_PARCEIRO: AppRole[] = ["imobiliaria", "corretor"];

interface ContextoParceiro {
  parceiroId: string;
  correspondenteId: string;
  clienteIds: string[];
}

/**
 * Valida que o usuário logado é um parceiro ativo e devolve o escopo
 * (ids de clientes vinculados). Lança erro caso contrário.
 * Usa o client autenticado (RLS) para validar e o admin apenas para leitura
 * estritamente escopada ao próprio parceiro.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolverContexto(supabase: any, userId: string): Promise<ContextoParceiro> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, correspondente_id, acesso_tipo, ativo, bloqueado_em")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || !profile.ativo || profile.bloqueado_em) {
    throw new Error("Acesso restrito.");
  }
  if (profile.acesso_tipo !== "portal_parceiro") {
    throw new Error("Acesso restrito ao Portal do Parceiro.");
  }

  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (roleRows ?? []).map((r: { role: AppRole }) => r.role);
  if (!roles.some((r: AppRole) => PAPEIS_PARCEIRO.includes(r))) {
    throw new Error("Acesso restrito ao Portal do Parceiro.");
  }

  const { data: vinculos } = await supabase
    .from("cliente_parceiros")
    .select("cliente_id")
    .eq("parceiro_id", userId);

  return {
    parceiroId: userId,
    correspondenteId: profile.correspondente_id ?? "",
    clienteIds: (vinculos ?? []).map((v: { cliente_id: string }) => v.cliente_id),
  };
}

export interface ResumoParceiro {
  nome: string | null;
  email: string | null;
  papel: "imobiliaria" | "corretor" | null;
  creci: string | null;
  razao_social: string | null;
  logo_url: string | null;
  percentual_comissao: number;
  totalClientes: number;
  totalSimulacoes: number;
  totalPropostas: number;
  comissaoPendente: number;
}

export const getResumoParceiro = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResumoParceiro> => {
    const { supabase, userId } = context;
    const ctx = await resolverContexto(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profile }, { data: det }, { data: roleRows }] = await Promise.all([
      supabaseAdmin.from("profiles").select("nome, email").eq("id", userId).maybeSingle(),
      supabaseAdmin
        .from("parceiro_detalhes")
        .select("creci, razao_social, logo_url, percentual_comissao")
        .eq("profile_id", userId)
        .maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    ]);

    const roles = (roleRows ?? []).map((r) => r.role as AppRole);
    const papel = roles.includes("imobiliaria")
      ? "imobiliaria"
      : roles.includes("corretor")
        ? "corretor"
        : null;

    let totalSimulacoes = 0;
    let totalPropostas = 0;
    if (ctx.clienteIds.length > 0) {
      const [{ count: cSim }, { count: cProp }] = await Promise.all([
        supabaseAdmin
          .from("simulacoes")
          .select("id", { count: "exact", head: true })
          .in("cliente_id", ctx.clienteIds)
          .is("deleted_at", null),
        supabaseAdmin
          .from("propostas")
          .select("id", { count: "exact", head: true })
          .in("cliente_id", ctx.clienteIds)
          .is("deleted_at", null),
      ]);
      totalSimulacoes = cSim ?? 0;
      totalPropostas = cProp ?? 0;
    }

    const { data: comissoes } = await supabaseAdmin
      .from("comissoes")
      .select("split_parceiro, status")
      .eq("parceiro_id", userId);
    const comissaoPendente = (comissoes ?? [])
      .filter((c) => c.status !== "paga_parceiro" && c.status !== "encerrada")
      .reduce((acc, c) => acc + Number(c.split_parceiro ?? 0), 0);

    return {
      nome: profile?.nome ?? null,
      email: profile?.email ?? null,
      papel,
      creci: det?.creci ?? null,
      razao_social: det?.razao_social ?? null,
      logo_url: det?.logo_url ?? null,
      percentual_comissao: Number(det?.percentual_comissao ?? 0),
      totalClientes: ctx.clienteIds.length,
      totalSimulacoes,
      totalPropostas,
      comissaoPendente,
    };
  });
