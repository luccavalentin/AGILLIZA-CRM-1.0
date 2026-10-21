/**
 * LGPD da plataforma (Corretor 2.0 + banco único), no Agilliza.
 *
 * Mesmas leituras e gravações da antiga Gestão (`[portal]/lgpd/page.tsx` e `acoes.ts`):
 *  - pedidos de titulares (art. 18) em `auditoria.solicitacoes_titular` — a RLS exige
 *    `lgpd.atender` para ler e para atualizar;
 *  - termos (`auditoria.termos_versoes`) e consentimentos (`auditoria.consentimentos`);
 *  - exclusão definitiva: `seguranca.destruir_chaves_tenant`, que exige `lgpd.excluir`.
 *    Pela ponte (0181), só administradores do Agilliza abrem como super_admin; para os
 *    demais o próprio banco recusa, e a mensagem dele chega à tela.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

export const STATUS_PEDIDO = [
  "aberta",
  "em_atendimento",
  "aguardando_titular",
  "concluida",
  "negada",
] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

export interface PedidoTitular {
  id: string;
  tenant_id: string | null;
  tipo: string;
  titular_nome: string | null;
  titular_email: string | null;
  descricao: string | null;
  status: string;
  prazo_em: string | null;
  resposta: string | null;
  concluida_em: string | null;
  criado_em: string;
  atrasada: boolean;
  conta: string | null;
  atendente: string | null;
}
export interface TermoVersao {
  id: string;
  documento: string;
  perfil: string;
  versao: string;
  vigente_desde: string | null;
  hash: string;
  aceites: number;
}
export interface ConsentimentoResumo {
  tipo: string;
  total: number;
  vigentes: number;
}
export interface ContaLgpd {
  id: string;
  nome: string;
  tipo: string;
}

export const RECORTES_PEDIDO = ["todos", "abertos", "atrasados"] as const;
export type RecortePedido = (typeof RECORTES_PEDIDO)[number];
export const POR_PAGINA_PEDIDOS_LGPD = 50;

export const lerLgpd = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.lgpd", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        recorte: z.enum(RECORTES_PEDIDO).default("todos"),
        pagina: z.number().int().min(1).max(10_000).default(1),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    return comPlataforma(context.userId, async (tx) => {
      // Os cartões contam todos os pedidos; a lista vem filtrada e em páginas. Antes eram os
      // 200 primeiros, e "em aberto"/"fora do prazo" eram contados só sobre eles.
      const resumo = await tx.uma<{ total: number; abertos: number; atrasados: number }>(
        `select count(*)::int as total,
                (count(*) filter (where concluida_em is null))::int as abertos,
                (count(*) filter (where concluida_em is null and prazo_em < now()))::int as atrasados
           from auditoria.solicitacoes_titular`,
      );
      const pedidos = await tx.consultar<PedidoTitular>(
        `select p.id::text as id, p.tenant_id::text as tenant_id, p.tipo, p.titular_nome,
                p.titular_email::text as titular_email, p.descricao, p.status,
                p.prazo_em::text as prazo_em, p.resposta, p.concluida_em::text as concluida_em,
                p.criado_em::text as criado_em,
                coalesce(p.prazo_em < now() and p.concluida_em is null, false) as atrasada,
                (select t.nome from nucleo.tenants t where t.id = p.tenant_id) as conta,
                (select u.nome from plataforma.usuarios(array[p.atendido_por]) u) as atendente
           from auditoria.solicitacoes_titular p
          where case $1::text
                  when 'abertos' then p.concluida_em is null
                  when 'atrasados' then p.concluida_em is null and p.prazo_em < now()
                  else true
                end
          order by (p.concluida_em is null) desc, p.prazo_em, p.id
          limit ${POR_PAGINA_PEDIDOS_LGPD} offset $2`,
        [data.recorte, (data.pagina - 1) * POR_PAGINA_PEDIDOS_LGPD],
      );

      const termos = await tx.consultar<TermoVersao>(
        `select id::text as id, documento, perfil, versao, vigente_desde::text as vigente_desde,
                left(conteudo_hash, 12) as hash,
                (select count(*)::int from auditoria.termos_aceites a where a.termo_id = termos_versoes.id) as aceites
           from auditoria.termos_versoes
          order by documento, perfil, versao desc`,
      );

      const consentimentos = await tx.consultar<ConsentimentoResumo>(
        `select tipo, count(*)::int as total,
                (count(*) filter (where revogado_em is null and concedido))::int as vigentes
           from auditoria.consentimentos group by tipo order by count(*) desc`,
      );

      const contas = await tx.consultar<ContaLgpd>(
        `select id::text as id, nome, tipo::text as tipo
           from nucleo.tenants where deleted_at is null and tipo <> 'plataforma' order by nome`,
      );

      // O mesmo `pode(s, ...)` da Gestão, respondido pelo banco com o contexto desta pessoa.
      const pode = await tx.uma<{ atender: boolean; excluir: boolean }>(
        `select seguranca.auth_e_plataforma('lgpd.atender') as atender,
                seguranca.auth_e_plataforma('lgpd.excluir') as excluir`,
      );

      return {
        pedidos,
        resumo: resumo ?? { total: 0, abertos: 0, atrasados: 0 },
        termos,
        consentimentos,
        contas,
        pode: { atender: !!pode?.atender, excluir: !!pode?.excluir },
      };
    });
  });

export const atenderPedidoTitular = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.lgpd", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid({ message: "Pedido inválido." }),
        status: z.enum(STATUS_PEDIDO, {
          errorMap: () => ({ message: "Situação inválida." }),
        }),
        resposta: z.string().trim().max(5000).default(""),
      })
      .refine(
        (v) => !(v.status === "concluida" || v.status === "negada") || v.resposta.length >= 10,
        {
          message: "Concluir ou negar exige uma resposta ao titular (mínimo 10 caracteres).",
          path: ["resposta"],
        },
      )
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ id: string }>(
        `update auditoria.solicitacoes_titular
            set status = $2, resposta = coalesce(nullif($3, ''), resposta),
                atendido_por = seguranca.auth_usuario_id(),
                concluida_em = case when $2 in ('concluida', 'negada') then now() else null end
          where id = $1 returning id::text as id`,
        [data.id, data.status, data.resposta],
      ),
    );
    if (!r) throw new Error("Pedido não encontrado (ou o banco recusou a alteração).");
    return { ok: true as const };
  });

/** Compara nomes sem diferenciar maiúsculas, acentos e espaços repetidos. */
function normalizarNome(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Destrói a chave de criptografia da conta: o dado cifrado dela deixa de ser legível para
 * sempre. Não há desfazer, nem backup que reverta — o backup guarda o texto cifrado.
 * Confirmação forte: a pessoa digita o nome da conta, conferido aqui contra o banco.
 */
export const destruirChavesConta = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.lgpd", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: z.string().uuid({ message: "Escolha a conta." }),
        motivo: z
          .string()
          .trim()
          .min(20, { message: "Descreva o embasamento do pedido (mínimo 20 caracteres)." })
          .max(2000),
        confirmacaoNome: z
          .string()
          .trim()
          .min(1, { message: "Digite o nome da conta para confirmar." })
          .max(300),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    // A conferência fica numa transação só de leitura, antes da destruição: nome que não
    // confere não chega nem a abrir a transação que destrói.
    const conta = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ nome: string }>(
        `select nome from nucleo.tenants
          where id = $1 and deleted_at is null and tipo <> 'plataforma'`,
        [data.tenantId],
      ),
    );
    if (!conta) throw new Error("Conta não encontrada.");
    if (normalizarNome(conta.nome) !== normalizarNome(data.confirmacaoNome)) {
      throw new Error("O nome digitado não confere com o nome da conta. Nada foi destruído.");
    }
    // Quem não tem `lgpd.excluir` recebe a recusa do próprio banco (42501), com a mensagem dele.
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select seguranca.destruir_chaves_tenant($1, $2)", [data.tenantId, data.motivo]),
    );
    return { ok: true as const };
  });
