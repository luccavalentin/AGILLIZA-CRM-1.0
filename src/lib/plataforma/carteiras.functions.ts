/**
 * Carteiras de contas do Agilliza Tech (pedido do dono de 26/10/2026, item C50).
 *
 * Toda regra mora no banco do Agilliza Tech (migração 0308): criar, renomear, trocar o
 * responsável, arquivar só vazia, uma conta numa carteira por vez, produção da carteira.
 * Aqui só a porta do Agilliza (`saas.licencas`: ver para ler, editar para mudar) e a ponte.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

export interface ResponsavelCarteira {
  usuario_id: string;
  nome: string;
  /** Pessoa do Agilliza por trás do operador-espelho (null em responsável antigo da plataforma). */
  auth_uid: string | null;
}

export interface Carteira {
  id: string;
  nome: string;
  descricao: string | null;
  arquivada_em: string | null;
  criada_em: string;
  responsavel: ResponsavelCarteira;
  contas: number;
  ativas: number;
  mrr: number;
}

export interface ContaDaCarteira {
  id: string;
  nome: string;
  tipo: "corretor" | "imobiliaria" | "parceiro";
  status: string;
  plano: string | null;
  vinculo_agilliza: boolean;
  desde: string;
  simulacoes: number;
  propostas: number;
  contratos: number;
  registrados: number;
  valor_contratos: number;
  mrr: number;
  ultima_atividade: string | null;
}

export interface DetalheCarteira {
  id: string;
  nome: string;
  descricao: string | null;
  arquivada_em: string | null;
  criada_em: string;
  dias: number;
  responsavel: ResponsavelCarteira;
  contas: ContaDaCarteira[];
  totais: {
    contas: number;
    simulacoes: number;
    propostas: number;
    contratos: number;
    registrados: number;
    valor_contratos: number;
    mrr: number;
  };
}

export const PERIODOS_CARTEIRA = [30, 90, 365] as const;

const ID = z.string().uuid("Carteira inválida.");
const NOME = z
  .string()
  .trim()
  .min(2, "O nome da carteira tem de 2 a 80 letras.")
  .max(80, "O nome da carteira tem de 2 a 80 letras.");
const DESCRICAO = z.string().trim().max(500, "A descrição vai até 500 letras.");

async function ponte() {
  return import("./ponte.server");
}

/** Carteiras com responsável, contas e receita mensal, e quantas contas estão sem carteira. */
export const listarCarteiras = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.licencas", "view"])])
  .validator((d: unknown) =>
    z.object({ arquivadas: z.boolean().default(false) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ j: Carteira[] }>("select plataforma.carteiras_listar($1) as j", [
        data.arquivadas,
      ]);
      // A tabela de carteira (conta → analista) é lida pela política de quem lê contas (0037).
      const sem = await tx.uma<{ n: number }>(
        `select count(*)::int as n from nucleo.tenants t
          where t.tipo <> 'plataforma' and t.deleted_at is null and t.status <> 'cancelado'
            and not exists (select 1 from plataforma.carteira c where c.tenant_id = t.id and c.grupo_id is not null)`,
      );
      return { carteiras: r?.j ?? [], semCarteira: sem?.n ?? 0 };
    });
  });

/** Produção da carteira no período (30, 90 ou 365 dias) e as contas dela. */
export const detalheCarteira = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.licencas", "view"])])
  .validator((d: unknown) =>
    z
      .object({
        id: ID,
        dias: z
          .number()
          .int()
          .refine((v) => (PERIODOS_CARTEIRA as readonly number[]).includes(v), "Período inválido."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: DetalheCarteira }>("select plataforma.carteira_detalhe($1, $2) as j", [
        data.id,
        data.dias,
      ]),
    );
    if (!r?.j) throw new Error("Carteira não encontrada.");
    return r.j;
  });

export const criarCarteira = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .validator((d: unknown) =>
    z
      .object({
        nome: NOME,
        descricao: DESCRICAO.default(""),
        responsavel: z.string().uuid("Escolha o responsável pela carteira."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ id: string }>("select plataforma.carteira_criar($1, $2, $3) as id", [
        data.nome,
        data.descricao || null,
        data.responsavel,
      ]),
    );
    return { id: r?.id ?? null };
  });

/** Renomeia, muda a descrição e/ou o responsável (o banco reatribui as contas). */
export const editarCarteira = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .validator((d: unknown) =>
    z
      .object({
        id: ID,
        nome: NOME,
        descricao: DESCRICAO.default(""),
        responsavel: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select plataforma.carteira_editar($1, $2, $3, $4)", [
        data.id,
        data.nome,
        data.descricao,
        data.responsavel,
      ]),
    );
    return { ok: true as const };
  });

export const arquivarCarteira = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .validator((d: unknown) => z.object({ id: ID, arquivar: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select plataforma.carteira_arquivar($1, $2)", [data.id, data.arquivar]),
    );
    return { ok: true as const };
  });

export const adicionarContasCarteira = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .validator((d: unknown) =>
    z
      .object({
        id: ID,
        contas: z
          .array(z.string().uuid("Conta inválida."))
          .min(1, "Escolha ao menos uma conta.")
          .max(500, "No máximo 500 contas por vez."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ n: number }>("select plataforma.carteira_adicionar_contas($1, $2::uuid[]) as n", [
        data.id,
        data.contas,
      ]),
    );
    return { adicionadas: Number(r?.n ?? 0) };
  });

export const removerContaCarteira = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .validator((d: unknown) =>
    z.object({ id: ID, conta: z.string().uuid("Conta inválida.") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select plataforma.carteira_remover_conta($1, $2)", [data.id, data.conta]),
    );
    return { ok: true as const };
  });
