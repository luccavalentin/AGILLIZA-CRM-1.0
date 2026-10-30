/**
 * Base das contas assinantes (corretores e imobiliárias do Agilliza Tech) no Agilliza.
 *
 * - Clientes: `plataforma.crm_da_licenca` (permissão de plataforma crm.ler_todos), com o
 *   CPF/CNPJ COMPLETO para o analista (`documentos.server`, migração 0212: decifrar auditado,
 *   um acesso registrado por consulta). A ficha é a nativa do Agilliza (conta-nativa).
 * - Propostas: `filtro-base.functions` (`listarPropostasDoGrupo`, com ou sem uma conta).
 * - Simulações: telas nativas pela ponte (conta-nativa.functions).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

export const ETAPA_CLIENTE_ASSINANTE: Record<string, string> = {
  lead: "Lead",
  qualificado: "Qualificado",
  simulacao: "Em simulação",
  proposta: "Em proposta",
  aprovado: "Aprovado",
  condicionado: "Condicionado",
  contrato: "Contrato",
  ganho: "Ganho",
  perdido: "Perdido",
  inativo: "Inativo",
};

export interface ContaAssinante {
  id: string;
  nome: string;
  tipo: string;
}

export interface ClienteDaConta {
  id: string;
  codigo: string;
  nome: string;
  documento_mascarado: string | null;
  email: string | null;
  celular: string | null;
  status_funil: string;
  responsavel: string | null;
  criado_em: string;
  /** CPF/CNPJ completo (0212), quando o servidor consegue abrir. */
  documento?: string | null;
}

const UUID = z.string().uuid();

export const listarClientesDaConta = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.contas", "view"])])
  .validator((d: unknown) =>
    z
      .object({
        licenca: UUID,
        termo: z.string().trim().max(120).optional().nullable(),
        etapa: z.string().max(30).optional().nullable(),
        pagina: z.number().int().min(1).max(1000).default(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const { comChave, documentosCompletos } = await import("./documentos.server");
    // Mesma regra da base própria (listarClientes): CPF/CNPJ inteiro só para quem tem
    // "Ver dados sensíveis" em Clientes (ou é admin/correspondente). Os demais ficam
    // com o documento mascarado e nem disparam o decifrar auditado.
    const podePii = await podeVerDadosSensiveis(context.supabase, context.userId);
    return comPlataforma(
      context.userId,
      async (tx) => {
        const r = await tx.uma<{ r: { clientes: ClienteDaConta[]; total: number } }>(
          "select plataforma.crm_da_licenca($1, $2, $3, null, null, null, $4) as r",
          [
            data.licenca,
            data.termo || null,
            data.etapa && ETAPA_CLIENTE_ASSINANTE[data.etapa] ? data.etapa : null,
            data.pagina,
          ],
        );
        const clientes = r?.r?.clientes ?? [];
        if (!podePii) {
          for (const c of clientes) c.documento = null;
          return { clientes, total: Number(r?.r?.total ?? 0) };
        }
        // O analista vê o documento inteiro, como na base própria (uma consulta auditada).
        const docs = await documentosCompletos(
          tx,
          data.licenca,
          "clientes",
          clientes.map((c) => c.id),
        );
        for (const c of clientes) c.documento = docs[c.id]?.documento ?? null;
        return { clientes, total: Number(r?.r?.total ?? 0) };
      },
      { kek: podePii && comChave() },
    );
  });

/** `crm.clientes` › `pii:view` (ou papel amplo), a mesma regra de `temPii` em clientes.functions. */
export async function podeVerDadosSensiveis(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<boolean> {
  const { data: amplo } = await supabase.rpc("has_any_role", {
    _user_id: userId,
    _roles: ["admin", "correspondente"],
  });
  if (amplo) return true;
  const { data: pode } = await supabase.rpc("usuario_tem_permissao", {
    _user_id: userId,
    _modulo: "crm.clientes",
    _acao: "pii:view",
  });
  return pode === true;
}
