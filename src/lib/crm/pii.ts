import { mascararDocumento } from "@/lib/crm/documento";

/**
 * Campos de documento que só quem tem `crm.clientes` › `pii:view` vê inteiros: mascarados
 * em `getCliente` (e nas telas que repetem a ficha) e ignorados em `atualizarCliente`
 * para quem não tem.
 */
export const CAMPOS_PII_CLIENTE = [
  "documento",
  "documento_secundario",
  "numero_documento",
  "conjuge_cpf",
  "conjuge_numero_documento",
] as const;

/** Mesmos documentos no cadastro do vendedor do imóvel. */
export const CAMPOS_PII_VENDEDOR = [
  "documento",
  "documento_secundario",
  "numero_documento",
] as const;

/** Admin/correspondente ou `crm.clientes` › `pii:view`. Uso no servidor. */
export async function temPiiCliente(supabase: any, userId: string): Promise<boolean> {
  const { data: tudo } = await supabase.rpc("has_any_role", {
    _user_id: userId,
    _roles: ["admin", "correspondente"],
  });
  if (tudo) return true;
  const { data } = await supabase.rpc("usuario_tem_permissao", {
    _user_id: userId,
    _modulo: "crm.clientes",
    _acao: "pii:view",
  });
  return Boolean(data);
}

/** Mascara, no próprio objeto, os campos indicados que vierem preenchidos. */
export function mascararCamposPii<T extends Record<string, unknown>>(
  obj: T,
  campos: readonly string[],
): T {
  const o = obj as Record<string, unknown>;
  for (const campo of campos) {
    if (o[campo]) o[campo] = mascararDocumento(String(o[campo]));
  }
  return obj;
}
