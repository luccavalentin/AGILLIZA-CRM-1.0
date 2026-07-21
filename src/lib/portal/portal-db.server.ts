/**
 * Cliente Supabase para o Portal do Cliente.
 *
 * O portal NÃO usa autenticação do Supabase — a sessão é selada em cookie
 * HttpOnly próprio. As operações rodam somente no servidor e usam o cliente
 * administrativo para chamar as funções portal_* sem depender de permissões
 * públicas diretas nas RPCs.
 *
 * Server-only: importar apenas dentro de handlers de server functions.
 */
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type PortalDbClient = typeof supabaseAdmin;

export function portalDb(): PortalDbClient {
  return supabaseAdmin as PortalDbClient;
}

void ({} as Database);
