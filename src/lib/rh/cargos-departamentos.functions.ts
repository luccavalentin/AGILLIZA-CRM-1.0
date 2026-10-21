import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

export interface Cargo {
  id: string;
  nome: string;
  cbo: string | null;
  ativo: boolean;
}
export interface Departamento {
  id: string;
  nome: string;
  responsavel_id: string | null;
  ativo: boolean;
}

async function corresp(supabase: any, userId: string): Promise<string | undefined> {
  const { data } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.correspondente_id;
}

export const listarCargos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Cargo[]> => {
    const { data, error } = await context.supabase
      .from("rh_cargos")
      .select("id, nome, cbo, ativo")
      .eq("ativo", true)
      .order("nome");
    if (error) throw new Error(error.message);
    return (data ?? []) as Cargo[];
  });

export const criarCargo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ nome: z.string().min(1), cbo: z.string().optional().nullable() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<Cargo> => {
    const { supabase, userId } = context;
    const correspondenteId = await corresp(supabase, userId);
    if (!correspondenteId) throw new Error("Ecossistema não identificado.");
    const { data: row, error } = await supabase
      .from("rh_cargos")
      .insert({ ...data, correspondente_id: correspondenteId } as never)
      .select("id, nome, cbo, ativo")
      .single();
    if (error) throw new Error(error.message);
    return row as Cargo;
  });

export const listarDepartamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Departamento[]> => {
    const { data, error } = await context.supabase
      .from("rh_departamentos")
      .select("id, nome, responsavel_id, ativo")
      .eq("ativo", true)
      .order("nome");
    if (error) throw new Error(error.message);
    return (data ?? []) as Departamento[];
  });

export const criarDepartamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        nome: z.string().min(1),
        responsavel_id: z.string().uuid().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<Departamento> => {
    const { supabase, userId } = context;
    const correspondenteId = await corresp(supabase, userId);
    if (!correspondenteId) throw new Error("Ecossistema não identificado.");
    const { data: row, error } = await supabase
      .from("rh_departamentos")
      .insert({ ...data, correspondente_id: correspondenteId } as never)
      .select("id, nome, responsavel_id, ativo")
      .single();
    if (error) throw new Error(error.message);
    return row as Departamento;
  });

/*
 * Editar e desativar. Desativar, não apagar: funcionário e histórico salarial
 * apontam para o cargo/departamento, e o registro antigo precisa continuar legível.
 * Desativado sai das listas de escolha (listar* filtra `ativo`).
 */
const editarSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().trim().min(1, "Informe o nome."),
  cbo: z.string().trim().optional().nullable(),
});

export const editarCargo = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.configuracoes", "edit"])])
  .inputValidator((data: unknown) => editarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("rh_cargos")
      .update({ nome: data.nome, cbo: data.cbo || null } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const editarDepartamento = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.configuracoes", "edit"])])
  .inputValidator((data: unknown) => editarSchema.omit({ cbo: true }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("rh_departamentos")
      .update({ nome: data.nome } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const desativarCargoOuDepartamento = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.configuracoes", "delete"], ["rh.configuracoes", "edit"])])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), tipo: z.enum(["cargo", "departamento"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from(data.tipo === "cargo" ? "rh_cargos" : "rh_departamentos")
      .update({ ativo: false } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
