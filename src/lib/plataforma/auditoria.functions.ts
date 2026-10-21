/**
 * Auditoria da PLATAFORMA (contas de assinantes do Corretor 2.0), no Agilliza.
 *
 * Não confundir com a auditoria do próprio Agilliza (`/admin/auditoria`): aqui é o
 * `auditoria.audit_log` do banco único — imutável e encadeado por hash. A tela só lê.
 * Mesmas consultas da antiga Gestão (`[portal]/auditoria/page.tsx`); a RLS exige
 * `auditoria.ler` (política `extra_plataforma` do audit_log). Os valores `antes`/`depois`
 * já chegam mascarados nas colunas sensíveis pela própria trigger de auditoria.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import type { Json } from "@/integrations/supabase/types";

export interface EventoAuditoria {
  id: string;
  criado_em: string;
  tenant_id: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  ator_tipo: string | null;
  detalhes: Json | null;
  antes: Json | null;
  depois: Json | null;
  ip: string | null;
  conta: string | null;
  ator: string | null;
}
export interface TabelaAuditada {
  entidade: string;
  total: number;
}
export interface PessoaAuditada {
  id: string;
  nome: string | null;
  total: number;
}
export interface ContaResumo {
  id: string;
  nome: string;
}

const UUID = z.string().uuid();

/**
 * Registros por página. O audit_log cresce rápido (toda escrita de toda conta): contar o
 * período inteiro custaria mais que a própria página, por isso a tela só sabe se há mais.
 */
export const POR_PAGINA_AUDITORIA = 100;

export const lerAuditoriaPlataforma = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.auditoria", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        q: z.string().trim().max(120).optional().nullable(),
        acao: z.string().trim().max(60).optional().nullable(),
        entidade: z.string().trim().max(120).optional().nullable(),
        // Filtro por id: só uuid válido chega ao banco (o cast de lixo derrubaria a consulta).
        conta: UUID.optional().nullable(),
        ator: UUID.optional().nullable(),
        dias: z.coerce.number().int().min(1).max(90).default(7),
        pagina: z.number().int().min(1).max(1000).default(1),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    return comPlataforma(context.userId, async (tx) => {
      const linhas = await tx.consultar<EventoAuditoria>(
        `select a.id::text as id, a.criado_em::text as criado_em, a.tenant_id::text as tenant_id,
                a.acao, a.entidade, a.entidade_id::text as entidade_id,
                a.ator_tipo, a.detalhes, a.antes, a.depois, host(a.ip) as ip,
                (select t.nome from nucleo.tenants t where t.id = a.tenant_id) as conta,
                (select u.nome from plataforma.usuarios(array[a.ator_id]) u) as ator
           from auditoria.audit_log a
          where a.criado_em > now() - make_interval(days => $1)
            and ($2::text is null or a.acao = $2)
            and ($3::text is null or a.entidade = $3)
            and ($4::uuid is null or a.tenant_id = $4::uuid)
            and ($5::text is null or a.entidade ilike '%' || $5 || '%' or a.entidade_id::text = $5)
            and ($6::uuid is null or a.ator_id = $6::uuid)
          order by a.criado_em desc, a.id desc
          limit ${POR_PAGINA_AUDITORIA + 1} offset $7`,
        [
          data.dias,
          data.acao || null,
          data.entidade || null,
          data.conta || null,
          data.q || null,
          data.ator || null,
          (data.pagina - 1) * POR_PAGINA_AUDITORIA,
        ],
      );
      // Uma linha a mais só para saber se existe a próxima página.
      const temMais = linhas.length > POR_PAGINA_AUDITORIA;
      if (temMais) linhas.pop();

      const entidades = await tx.consultar<TabelaAuditada>(
        `select a.entidade, count(*)::int as total
           from auditoria.audit_log a
          where a.criado_em > now() - make_interval(days => $1)
          group by a.entidade order by count(*) desc limit 40`,
        [data.dias],
      );

      // Quem mais mexeu no período: alimenta o filtro por pessoa e o painel lateral.
      const pessoas = await tx.consultar<PessoaAuditada>(
        `select x.ator_id::text as id, x.total, u.nome
           from (select a.ator_id, count(*)::int as total
                   from auditoria.audit_log a
                  where a.criado_em > now() - make_interval(days => $1) and a.ator_id is not null
                  group by a.ator_id order by count(*) desc limit 60) x
           left join lateral (select p.nome from plataforma.usuarios(array[x.ator_id]) p) u on true
          order by x.total desc`,
        [data.dias],
      );

      const contas = await tx.consultar<ContaResumo>(
        "select id::text as id, nome from nucleo.tenants where deleted_at is null order by nome",
      );

      return { linhas, temMais, entidades, pessoas, contas, dias: data.dias };
    });
  });
