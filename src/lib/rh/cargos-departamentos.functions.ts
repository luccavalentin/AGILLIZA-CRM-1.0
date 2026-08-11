import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
