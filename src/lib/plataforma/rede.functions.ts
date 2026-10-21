/**
 * Rede de Corretores do Corretor 2.0, verificada pelo Agilliza correspondente.
 *
 * É a antiga tela "Rede (verificação)" da Gestão (`/gestao/rede`): conferir o CRECI de
 * quem pede entrada e mediar as disputas de parceria. Duas portas: a permissão do Agilliza
 * (`saas.marketplace`, aqui — o mesmo módulo do marketplace) e a da plataforma
 * (`rede.verificar`, no banco, pela ponte). As consultas e as atualizações são as MESMAS
 * da Gestão: `rede.participantes` (políticas `extra_sel`/`extra_plataforma`) e
 * `rede.disputas` (só a plataforma escreve, `extra_mediar`), migração 0013.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import type { Json } from "@/integrations/supabase/types";

export type StatusParticipante = "pendente" | "verificado" | "recusado" | "suspenso";
export type StatusDisputa = "aberta" | "em_mediacao" | "resolvida" | "improcedente";

export interface ParticipanteRede {
  tenant_id: string;
  status: string;
  creci: string | null;
  creci_uf: string | null;
  como_empresa: boolean;
  regioes: string[] | null;
  motivo: string | null;
  reputacao: number | null;
  negocios_fechados: number;
  verificado_em: string | null;
  criado_em: string;
  conta: string | null;
  conta_tipo: string | null;
  verificador: string | null;
}

export interface DisputaRede {
  id: string;
  parceria_id: string;
  motivo: string;
  /** Retrato da parceria na abertura (`to_jsonb` da linha de `rede.parcerias`). */
  historico: Json;
  status: string;
  resolucao: string | null;
  criado_em: string;
  resolvida_em: string | null;
  aberta_por: string | null;
  mediador: string | null;
  percentual: number | null;
  valor_negocio: number | null;
  dono: string | null;
  solicitante: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ponte() {
  return import("./ponte.server");
}

export const GRUPOS_PARTICIPANTE = ["todos", "pendentes", "verificados", "fora"] as const;
export type GrupoParticipante = (typeof GRUPOS_PARTICIPANTE)[number];
export const POR_PAGINA_PARTICIPANTES = 50;

/**
 * Participantes (CRECI a conferir primeiro, filtrados e paginados no banco), as contagens de
 * cada grupo, disputas (abertas primeiro) e a régua de proteção. Antes vinham 200 participantes
 * e os grupos eram contados sobre eles: com a rede maior, "Verificados" ficava errado.
 */
export const lerModeracaoRede = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.marketplace", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        grupo: z.enum(GRUPOS_PARTICIPANTE).default("todos"),
        pagina: z.number().int().min(1).max(10_000).default(1),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const contagem = await tx.uma<{
        todos: number;
        pendentes: number;
        verificados: number;
        fora: number;
      }>(
        `select count(*)::int as todos,
                (count(*) filter (where status = 'pendente'))::int as pendentes,
                (count(*) filter (where status = 'verificado'))::int as verificados,
                (count(*) filter (where status not in ('pendente', 'verificado')))::int as fora
           from rede.participantes`,
      );
      const participantes = await tx.consultar<ParticipanteRede>(
        `select p.tenant_id, p.status, p.creci, p.creci_uf::text as creci_uf, p.como_empresa, p.regioes,
                p.motivo, p.reputacao::float8 as reputacao, p.negocios_fechados::int as negocios_fechados,
                p.verificado_em::text as verificado_em, p.criado_em::text as criado_em,
                (select t.nome from nucleo.tenants t where t.id = p.tenant_id) as conta,
                (select t.tipo::text from nucleo.tenants t where t.id = p.tenant_id) as conta_tipo,
                (select u.nome from plataforma.usuarios(array[p.verificado_por]) u) as verificador
           from rede.participantes p
          where case $1::text
                  when 'pendentes' then p.status = 'pendente'
                  when 'verificados' then p.status = 'verificado'
                  when 'fora' then p.status not in ('pendente', 'verificado')
                  else true
                end
          order by (p.status = 'pendente') desc, p.criado_em desc, p.tenant_id
          limit ${POR_PAGINA_PARTICIPANTES} offset $2`,
        [data.grupo, (data.pagina - 1) * POR_PAGINA_PARTICIPANTES],
      );

      // As duas partes entram pelo nome: o retrato guardado na abertura só tem os ids das contas.
      const disputas = await tx.consultar<DisputaRede>(
        `select d.id, d.parceria_id, d.motivo, d.historico, d.status, d.resolucao,
                d.criado_em::text as criado_em, d.resolvida_em::text as resolvida_em,
                (select t.nome from nucleo.tenants t where t.id = d.aberta_por_tenant) as aberta_por,
                (select u.nome from plataforma.usuarios(array[d.mediador_id]) u) as mediador,
                (select pa.percentual_acordado::float8 from rede.parcerias pa where pa.id = d.parceria_id) as percentual,
                (select pa.valor_negocio::float8 from rede.parcerias pa where pa.id = d.parceria_id) as valor_negocio,
                (select t.nome from rede.parcerias pa join nucleo.tenants t on t.id = pa.dono_tenant_id
                  where pa.id = d.parceria_id) as dono,
                (select t.nome from rede.parcerias pa join nucleo.tenants t on t.id = pa.solicitante_tenant_id
                  where pa.id = d.parceria_id) as solicitante
           from rede.disputas d
          order by (d.resolvida_em is null) desc, d.criado_em desc
          limit 100`,
      );

      // A régua das decisões: quanto tempo quem apresentou o cliente fica protegido.
      const protecao = await tx.uma<{ dias: number | null }>(
        `select (valor #>> '{}')::int as dias from plataforma.configuracoes
          where chave = 'rede.dias_protecao_cliente'`,
      );

      return {
        participantes,
        contagem: contagem ?? { todos: 0, pendentes: 0, verificados: 0, fora: 0 },
        disputas,
        diasProtecao: protecao?.dias ?? null,
      };
    });
  });

/** Verifica (CRECI conferido), recusa, suspende ou devolve para pendente. */
export const verificarParticipante = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.marketplace", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: z.string().regex(UUID, "Participante inválido."),
        status: z.enum(["pendente", "verificado", "recusado", "suspenso"], {
          message: "Situação inválida.",
        }),
        motivo: z.string().max(1000, "Motivo longo demais.").default(""),
      })
      .superRefine((v, ctx) => {
        if ((v.status === "recusado" || v.status === "suspenso") && v.motivo.trim().length < 10) {
          ctx.addIssue({
            code: "custom",
            path: ["motivo"],
            message: "Recusar ou suspender exige motivo (mínimo 10 caracteres).",
          });
        }
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ tenant_id: string }>(
        `update rede.participantes
            set status = $2, motivo = nullif($3, ''),
                verificado_em = case when $2 = 'verificado' then now() else null end,
                verificado_por = case when $2 = 'verificado' then seguranca.auth_usuario_id() else null end
          where tenant_id = $1 returning tenant_id`,
        [data.tenantId, data.status, data.motivo.trim()],
      ),
    );
    if (!r) throw new Error("Participante não encontrado.");
    return { status: data.status };
  });

/** Registra a mediação. Encerrar (resolvida/improcedente) exige a decisão por escrito. */
export const mediarDisputa = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.marketplace", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().regex(UUID, "Disputa inválida."),
        status: z.enum(["aberta", "em_mediacao", "resolvida", "improcedente"], {
          message: "Situação inválida.",
        }),
        resolucao: z.string().max(5000, "Decisão longa demais.").default(""),
      })
      .superRefine((v, ctx) => {
        if (
          (v.status === "resolvida" || v.status === "improcedente") &&
          v.resolucao.trim().length < 20
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["resolucao"],
            message:
              "Encerrar a disputa exige a decisão por escrito (mínimo 20 caracteres). As duas partes a leem.",
          });
        }
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ id: string }>(
        `update rede.disputas
            set status = $2, resolucao = nullif($3, ''), mediador_id = seguranca.auth_usuario_id(),
                resolvida_em = case when $2 in ('resolvida', 'improcedente') then now() else null end
          where id = $1 returning id`,
        [data.id, data.status, data.resolucao.trim()],
      ),
    );
    if (!r) throw new Error("Disputa não encontrada.");
    return { ok: true as const };
  });
