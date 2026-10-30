/**
 * Planos, preços e créditos do Agilliza Tech, administrados pelo Agilliza (antes na Gestão).
 *
 * Escrita direta no catálogo (`nucleo.planos`, `nucleo.entitlements`, `nucleo.creditos_pacotes`,
 * `nucleo.creditos_custos`, `plataforma.sla_suporte`), protegida no banco pela permissão de
 * plataforma `planos.editar`. Mudar preço não mexe em assinatura existente: quem já assinou
 * segue com o valor contratado até a próxima renovação.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import type { Json } from "@/integrations/supabase/types";

export interface PlanoCatalogo {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  publico: string;
  preco_mensal: number;
  preco_anual: number | null;
  /** Pacotes (Corretor 0253): preço TOTAL de 90 e 180 dias. Nulo = não vende. */
  preco_trimestral: number | null;
  preco_semestral: number | null;
  /** Falso = o plano por dias de acesso só vende pacotes; o preço mensal fica de referência. */
  vende_mensal: boolean;
  preco_por_usuario: number | null;
  preco_por_contato: number | null;
  trial_dias: number;
  /** Plano por dias de acesso (vendido no site): cada pagamento libera estes dias. */
  dias_acesso: number | null;
  ativo: boolean;
  assinaturas: number;
  limites: { [chave: string]: Json };
}

export interface PacoteCredito {
  id: string;
  nome: string;
  quantidade: number;
  preco: number;
  ativo: boolean;
}

export interface CustoOperacao {
  operacao: string;
  creditos: number;
  atualizado_em: string;
}

export interface SlaSuporte {
  plano_codigo: string;
  plano: string | null;
  primeira_resposta_horas: number;
  resolucao_horas: number;
}

const dinheiro = z
  .number({ invalid_type_error: "Valor inválido." })
  .min(0, "Valor não pode ser negativo.")
  .max(999_999.99, "Valor muito alto.")
  .nullable();

/** Dias de acesso por pagamento: vazio = plano recorrente (mensal/anual), sem venda no site. */
const DIAS_ACESSO = z
  .number({ invalid_type_error: "Dias inválidos." })
  .int("Use dias inteiros.")
  .min(1, "De 1 a 3650 dias.")
  .max(3650, "De 1 a 3650 dias.")
  .nullable();

async function ponte() {
  return import("./ponte.server");
}

export const lerCatalogoPlanos = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.planos", "view"])])
  .handler(async ({ context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const planos = await tx.consultar<PlanoCatalogo>(
        `select p.id, p.codigo, p.nome, p.descricao, p.publico::text as publico,
                p.preco_mensal::float8 as preco_mensal, p.preco_anual::float8 as preco_anual,
                p.preco_trimestral::float8 as preco_trimestral, p.preco_semestral::float8 as preco_semestral,
                p.vende_mensal,
                p.preco_por_usuario::float8 as preco_por_usuario, p.preco_por_contato::float8 as preco_por_contato,
                p.trial_dias, p.dias_acesso, p.ativo,
                (select count(*) from nucleo.assinaturas a where a.plano_id = p.id and a.status = 'ativa')::int as assinaturas,
                coalesce((select jsonb_object_agg(e.chave, e.valor) from nucleo.entitlements e where e.plano_id = p.id), '{}') as limites
           from nucleo.planos p order by p.ordem, p.nome`,
      );
      const pacotes = await tx.consultar<PacoteCredito>(
        "select id, nome, quantidade, preco::float8 as preco, ativo from nucleo.creditos_pacotes order by ordem",
      );
      const custos = await tx.consultar<CustoOperacao>(
        "select operacao, creditos, atualizado_em::text as atualizado_em from nucleo.creditos_custos order by operacao",
      );
      const slas = await tx.consultar<SlaSuporte>(
        `select s.plano_codigo, s.primeira_resposta_horas, s.resolucao_horas,
                (select p.nome from nucleo.planos p where p.codigo = s.plano_codigo) as plano
           from plataforma.sla_suporte s order by s.plano_codigo`,
      );
      return { planos, pacotes, custos, slas };
    });
  });

export const salvarPlanoCatalogo = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.planos", "edit"])])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        nome: z.string().trim().min(2, "Informe o nome do plano.").max(80),
        descricao: z.string().trim().max(500).nullable(),
        preco_mensal: dinheiro,
        preco_anual: dinheiro,
        preco_trimestral: dinheiro,
        preco_semestral: dinheiro,
        vende_mensal: z.boolean(),
        preco_por_usuario: dinheiro,
        preco_por_contato: dinheiro,
        trial_dias: z
          .number()
          .int()
          .min(0, "O teste vai de 0 a 90 dias.")
          .max(90, "O teste vai de 0 a 90 dias."),
        ativo: z.boolean(),
        dias_acesso: DIAS_ACESSO,
      })
      // O banco também recusa (0253: planos_vende_algum_periodo); aqui a frase é a da tela.
      .refine(
        (v) =>
          v.vende_mensal ||
          v.preco_trimestral != null ||
          v.preco_semestral != null ||
          v.preco_anual != null,
        {
          message:
            "O plano precisa vender algum período: ligue o mensal ou informe o preço de um pacote.",
          path: ["vende_mensal"],
        },
      )
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ id: string }>(
        `update nucleo.planos
            set nome = $2, descricao = $3, preco_mensal = coalesce($4::numeric, 0), preco_anual = $5::numeric,
                preco_por_usuario = $6::numeric, preco_por_contato = $7::numeric, trial_dias = $8::int, ativo = $9,
                dias_acesso = $10::int, preco_trimestral = $11::numeric, preco_semestral = $12::numeric,
                vende_mensal = $13::boolean, atualizado_em = now()
          where id = $1 returning id`,
        [
          data.id,
          data.nome,
          data.descricao || null,
          data.preco_mensal,
          data.preco_anual,
          data.preco_por_usuario,
          data.preco_por_contato,
          data.trial_dias,
          data.ativo,
          data.dias_acesso,
          data.preco_trimestral,
          data.preco_semestral,
          data.vende_mensal,
        ],
      ),
    );
    if (!r) throw new Error("O plano não foi encontrado.");
    return { ok: true as const };
  });

/** Um limite do plano (ex.: usuarios = 5; -1 = sem limite; true/false para recurso). */
export const salvarLimitePlano = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.planos", "edit"])])
  .validator((d: unknown) =>
    z
      .object({
        planoId: z.string().uuid(),
        chave: z
          .string()
          .trim()
          .regex(
            /^[a-z][a-z0-9_.]{1,40}$/,
            "Chave inválida: letras minúsculas, ponto e sublinhado.",
          ),
        valor: z.string().trim().min(1, "Informe o valor."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let json: unknown;
    try {
      json = JSON.parse(data.valor);
    } catch {
      throw new Error(
        'O valor precisa ser um número (50), -1 para ilimitado, true/false ou "texto".',
      );
    }
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar(
        `insert into nucleo.entitlements (plano_id, chave, valor) values ($1, $2, $3::jsonb)
         on conflict (plano_id, chave) do update set valor = excluded.valor`,
        [data.planoId, data.chave, JSON.stringify(json)],
      ),
    );
    return { ok: true as const };
  });

export const removerLimitePlano = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.planos", "edit"])])
  .validator((d: unknown) =>
    z.object({ planoId: z.string().uuid(), chave: z.string().trim().min(1).max(41) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("delete from nucleo.entitlements where plano_id = $1 and chave = $2", [
        data.planoId,
        data.chave,
      ]),
    );
    return { ok: true as const };
  });

export const salvarPacoteCredito = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.planos", "edit"])])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        nome: z.string().trim().min(2, "Informe o nome do pacote.").max(80),
        quantidade: z.number().int().min(1, "Quantidade inválida.").max(1_000_000),
        preco: z.number().min(0, "Preço inválido.").max(999_999.99),
        ativo: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ id: string }>(
        "update nucleo.creditos_pacotes set nome = $2, quantidade = $3, preco = $4, ativo = $5 where id = $1 returning id",
        [data.id, data.nome, data.quantidade, data.preco, data.ativo],
      ),
    );
    if (!r) throw new Error("Pacote não encontrado.");
    return { ok: true as const };
  });

/** Quantos créditos cada operação consome (consulta de ficha, SMS…). */
export const salvarCustoOperacao = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.planos", "edit"])])
  .validator((d: unknown) =>
    z
      .object({
        operacao: z.string().trim().min(1).max(60),
        creditos: z
          .number()
          .int()
          .min(0, "De 0 a 1000 créditos.")
          .max(1000, "De 0 a 1000 créditos."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ operacao: string }>(
        "update nucleo.creditos_custos set creditos = $2, atualizado_em = now() where operacao = $1 returning operacao",
        [data.operacao, data.creditos],
      ),
    );
    if (!r) throw new Error("Operação não encontrada.");
    return { ok: true as const };
  });

/** Prazo de suporte por plano (primeira resposta e resolução, em horas). */
export const salvarSlaPlano = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.planos", "edit"])])
  .validator((d: unknown) =>
    z
      .object({
        plano_codigo: z.string().trim().min(1).max(60),
        primeira: z.number().int().min(1, "De 1 a 720 horas.").max(720, "De 1 a 720 horas."),
        resolucao: z.number().int().min(1, "De 1 a 720 horas.").max(720, "De 1 a 720 horas."),
      })
      .refine((v) => v.resolucao >= v.primeira, {
        message: "O prazo de resolução não pode ser menor que o da primeira resposta.",
        path: ["resolucao"],
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ plano_codigo: string }>(
        `update plataforma.sla_suporte set primeira_resposta_horas = $2, resolucao_horas = $3
          where plano_codigo = $1 returning plano_codigo`,
        [data.plano_codigo, data.primeira, data.resolucao],
      ),
    );
    if (!r) throw new Error("Plano sem SLA cadastrado.");
    return { ok: true as const };
  });

/**
 * Plano novo, vendido no site por dias de acesso (0193): aparece sozinho na página de vendas
 * do Corretor quando está à venda; o cliente paga e a conta fica liberada pelos dias.
 */
export const criarPlanoCatalogo = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.planos", "edit"])])
  .validator((d: unknown) =>
    z
      .object({
        nome: z.string().trim().min(2, "Informe o nome do plano.").max(80),
        publico: z.enum(["corretor", "imobiliaria", "parceiro"], {
          errorMap: () => ({ message: "Escolha para quem é o plano." }),
        }),
        descricao: z.string().trim().max(500).nullable(),
        preco: z
          .number({ invalid_type_error: "Preço inválido." })
          .min(0, "Preço não pode ser negativo.")
          .max(999_999.99, "Preço muito alto."),
        dias_acesso: z
          .number({ invalid_type_error: "Informe os dias de acesso." })
          .int("Use dias inteiros.")
          .min(1, "De 1 a 3650 dias.")
          .max(3650, "De 1 a 3650 dias."),
        ativo: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const base =
      data.nome
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 40) || "plano";
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ id: string }>(
        `insert into nucleo.planos (codigo, nome, publico, descricao, preco_mensal, dias_acesso, ativo, trial_dias, ordem)
         values ($1 || '_' || substr(md5(random()::text), 1, 5), $2, $3, $4, $5::numeric, $6::int, $7, 0,
                 (select coalesce(max(ordem), 0) + 1 from nucleo.planos))
         returning id`,
        [
          base,
          data.nome,
          data.publico,
          data.descricao || null,
          data.preco,
          data.dias_acesso,
          data.ativo,
        ],
      ),
    );
    if (!r) throw new Error("Não foi possível criar o plano.");
    return { ok: true as const, id: r.id };
  });
