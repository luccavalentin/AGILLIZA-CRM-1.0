/**
 * Licenças e assinantes do Corretor 2.0, administradas pelo Agilliza correspondente.
 *
 * Duas portas: a permissão do Agilliza (`saas.licencas`, aqui) e a da plataforma (no
 * banco, pela ponte). As ações chamam as MESMAS funções que a Gestão do Corretor usava —
 * situação, teste, plano e créditos ficam auditados com o operador e o motivo.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

export type TipoLicenca = "corretor" | "imobiliaria" | "parceiro";
export type SituacaoLicenca = "trial" | "ativo" | "somente_leitura" | "suspenso" | "cancelado";

export interface Licenca {
  id: string;
  tipo: TipoLicenca;
  nome: string;
  slug: string;
  status: SituacaoLicenca;
  status_motivo: string | null;
  creci: string | null;
  creci_uf: string | null;
  documento_mascarado: string | null;
  email_contato: string | null;
  celular_contato: string | null;
  criado_em: string;
  trial_ate: string | null;
  plano_id: string | null;
  plano: string | null;
  assinatura_status: string | null;
  ciclo: string | null;
  assinatura_valor: number | null;
  usuarios: number;
  score: number | null;
  faixa: string | null;
  /** Pessoa do Agilliza que cuida da conta (carteira, 0228). */
  carteira_uid: string | null;
  carteira_nome: string | null;
}

export interface PlanoLicenca {
  id: string;
  codigo: string;
  nome: string;
  publico: string;
  preco_mensal: number;
}

export interface PessoaLicenca {
  id: string;
  nome: string;
  email_mascarado: string | null;
  papel: string;
  equipe: string | null;
  ativo: boolean;
  mfa_ativo: boolean;
  status: string;
  ultimo_login_em: string | null;
  desde: string;
}

/** Detalhe montado por `plataforma.conta_detalhe` (mesmo formato da Gestão). */
export interface DetalheLicenca {
  uso: {
    clientes: number;
    imoveis: number;
    simulacoes: number;
    propostas: number;
    contratos_locacao: number;
    sites_publicados: number;
    ultima_atividade: string | null;
  };
  creditos: {
    saldo: number;
    comprados: number;
    consumidos: number;
    extrato: {
      em: string;
      tipo: string;
      quantidade: number;
      motivo: string;
      saldo: number | null;
    }[];
  };
  assinatura: {
    status: string;
    ciclo: string;
    valor: number;
    proxima_cobranca_em: string | null;
    trial_ate: string | null;
    plano: string | null;
  } | null;
  faturas: {
    id: string;
    descricao: string;
    valor: number;
    vencimento: string;
    status: string;
    pago_em: string | null;
  }[];
  sessoes_ativas: number;
}

const UUID = z.string().uuid("Conta inválida.");
const MOTIVO = z
  .string()
  .trim()
  .min(5, "Escreva o motivo (pelo menos 5 caracteres) — ele fica registrado.")
  .max(500);

async function ponte() {
  return import("./ponte.server");
}

/** Indicadores da lista, calculados no banco sobre TODAS as licenças do filtro (não só a página). */
export interface ResumoLicencas {
  total: number;
  ativas: number;
  teste: number;
  travadas: number;
  /** Receita recorrente mensal: mesma regra da tela Receita (assinatura ativa ou inadimplente). */
  mrr: number;
  usuarios: number;
}

export const POR_PAGINA_LICENCAS = 50;

/**
 * Lista as licenças (contas de corretor, imobiliária e parceiro), uma página por vez, com os
 * indicadores do filtro inteiro e os planos ativos. Antes vinham 500 linhas e os números
 * eram somados no navegador: com mais contas que isso, a lista e os totais ficavam errados.
 */
export const listarLicencas = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.licencas", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        tipo: z.enum(["corretor", "imobiliaria", "parceiro"]).optional().nullable(),
        status: z
          .enum(["trial", "ativo", "somente_leitura", "suspenso", "cancelado"])
          .optional()
          .nullable(),
        busca: z.string().trim().max(120).optional().nullable(),
        pagina: z.number().int().min(1).max(10_000).default(1),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    // A busca é texto literal: % e _ digitados não viram curinga.
    const busca = data.busca ? data.busca.replace(/[\\%_]/g, (c) => "\\" + c) : null;
    const filtros = [data.tipo ?? null, data.status ?? null, busca];
    // Assinatura vigente: no máximo uma por conta (índice assinaturas_uma_vigente). A antiga
    // junção por `cancelada_em is null` também pegava assinatura encerrada e duplicava a conta.
    const origem = `
           from nucleo.tenants t
           left join nucleo.planos p on p.id = t.plano_id
           left join receita.saude sa on sa.tenant_id = t.id
           left join nucleo.assinaturas a
             on a.tenant_id = t.id and a.cancelada_em is null
            and a.status in ('trial', 'ativa', 'inadimplente')
           left join (select v.tenant_id, count(*)::int as n
                        from nucleo.vinculos v where v.ativo group by v.tenant_id) vc
             on vc.tenant_id = t.id
          where t.deleted_at is null and t.tipo <> 'plataforma'
            and ($1::text is null or t.tipo::text = $1)
            and ($2::text is null or t.status::text = $2)
            and ($3::text is null or t.nome ilike '%' || $3 || '%' or t.slug::text ilike '%' || $3 || '%'
                 or t.email_contato::text ilike '%' || $3 || '%')`;
    return comPlataforma(context.userId, async (tx) => {
      const licencas = await tx.consultar<Licenca>(
        `select t.id, t.tipo::text as tipo, t.nome, t.slug::text as slug, t.status::text as status,
                t.status_motivo, t.creci, t.creci_uf, t.documento_mascarado,
                t.email_contato::text as email_contato, t.celular_contato,
                t.criado_em::date::text as criado_em, t.trial_ate::text as trial_ate,
                t.plano_id, p.nome as plano,
                a.status::text as assinatura_status, a.ciclo::text as ciclo,
                a.valor::float8 as assinatura_valor,
                coalesce(vc.n, 0) as usuarios,
                sa.score::int as score, sa.faixa::text as faixa
           ${origem}
          order by t.criado_em desc, t.id
          limit ${POR_PAGINA_LICENCAS} offset $4`,
        [...filtros, (data.pagina - 1) * POR_PAGINA_LICENCAS],
      );
      const resumo = await tx.uma<ResumoLicencas>(
        `select count(*)::int as total,
                (count(*) filter (where t.status = 'ativo'))::int as ativas,
                (count(*) filter (where t.status = 'trial'))::int as teste,
                (count(*) filter (where t.status in ('suspenso', 'somente_leitura')))::int as travadas,
                coalesce(sum(a.valor / case a.ciclo when 'anual' then 12 when 'trimestral' then 3 else 1 end)
                           filter (where a.status in ('ativa', 'inadimplente')), 0)::float8 as mrr,
                coalesce(sum(vc.n), 0)::int as usuarios
           ${origem}`,
        filtros,
      );
      // Carteira de cada conta da página (quem não gere a carteira simplesmente não vê).
      const carteiras = licencas.length
        ? await tx
            .consultar<{ tenant_id: string; auth_uid: string | null; nome: string }>(
              "select tenant_id, auth_uid, nome from plataforma.carteiras_das_contas($1::uuid[])",
              [licencas.map((l) => l.id)],
            )
            .catch(() => [])
        : [];
      const porConta = new Map(carteiras.map((c) => [c.tenant_id, c]));
      for (const l of licencas) {
        l.carteira_uid = porConta.get(l.id)?.auth_uid ?? null;
        l.carteira_nome = porConta.get(l.id)?.nome ?? null;
      }
      const planos = await tx.consultar<PlanoLicenca>(
        `select id, codigo, nome, publico::text as publico, preco_mensal::float8 as preco_mensal
           from nucleo.planos where ativo order by ordem, nome`,
      );
      return {
        licencas,
        planos,
        resumo: resumo ?? { total: 0, ativas: 0, teste: 0, travadas: 0, mrr: 0, usuarios: 0 },
      };
    });
  });

/** Pessoas, uso, créditos, assinatura e faturas de uma licença. */
export const detalheLicenca = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.licencas", "view"])])
  .inputValidator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const pessoas = await tx.consultar<PessoaLicenca>(
        `select id, nome, email_mascarado, papel::text as papel, equipe, ativo, mfa_ativo, status,
                ultimo_login_em::text as ultimo_login_em, desde::text as desde
           from plataforma.pessoas_da_conta($1)`,
        [data.id],
      );
      const d = await tx.uma<{ r: DetalheLicenca | null }>(
        "select plataforma.conta_detalhe($1) as r",
        [data.id],
      );
      return { pessoas, detalhe: d?.r ?? null };
    });
  });

/** Suspende, reativa, põe em somente leitura ou cancela. O motivo vai para a auditoria. */
export const alterarSituacaoLicenca = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: UUID,
        status: z.enum(["trial", "ativo", "somente_leitura", "suspenso", "cancelado"]),
        motivo: MOTIVO,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select nucleo.alterar_status_tenant($1, $2::nucleo.status_tenant, $3)", [
        data.id,
        data.status,
        data.motivo,
      ]),
    );
    return { ok: true as const };
  });

/** Concede, estende (1 a 365 dias) ou encerra (0) o teste grátis. */
export const concederTesteLicenca = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: UUID,
        dias: z.number().int().min(0, "De 0 a 365 dias.").max(365, "De 0 a 365 dias."),
        motivo: MOTIVO,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ ate: string | null }>("select plataforma.conceder_teste($1, $2, $3)::text as ate", [
        data.id,
        data.dias,
        data.motivo,
      ]),
    );
    return { ate: r?.ate ?? null };
  });

/** Troca o plano (preço e cobrança seguem na assinatura). */
export const mudarPlanoLicenca = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: UUID, planoId: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ nome: string }>("select plataforma.mudar_plano($1, $2) as nome", [
        data.id,
        data.planoId,
      ]),
    );
    if (!r) throw new Error("A conta não foi encontrada.");
    return { plano: r.nome };
  });

/** Crédito de cortesia ou estorno, com entrada no extrato da conta. */
export const concederCreditosLicenca = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: UUID,
        quantidade: z
          .number()
          .int()
          .min(1, "De 1 a 10.000 créditos.")
          .max(10_000, "De 1 a 10.000 créditos."),
        motivo: z.enum(["bonus_plano", "estorno"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ saldo: number }>(
        "select nucleo.movimentar_creditos($1, 'entrada', $2, $3)::int as saldo",
        [data.id, data.quantidade, data.motivo],
      ),
    );
    return { saldo: r?.saldo ?? null };
  });

/* ------------------------------------------------ licença manual e carteira (0228) --- */

export interface PessoaCarteira {
  auth_uid: string;
  nome: string;
  email: string | null;
  papeis: string[];
  contas: number;
}

/** Pessoas do Agilliza que podem cuidar de contas (a lista de "Carteira de"). */
export const pessoasParaCarteira = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .handler(async ({ context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: PessoaCarteira[] }>("select plataforma.pessoas_agilliza_para_carteira() as j"),
    );
    return r?.j ?? [];
  });

const DOCUMENTO = z
  .string()
  .trim()
  .max(20)
  .refine((v) => !v || [11, 14].includes(v.replace(/\D/g, "").length), "CPF ou CNPJ inválido.");

/**
 * Cria a licença à mão (cortesia, teste ou pagamento) e, se escolhida, já põe a conta na
 * carteira de alguém do Agilliza. A pessoa recebe o e-mail para criar a própria senha.
 */
export const criarLicenca = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        tipo: z.enum(["corretor", "imobiliaria", "parceiro"]),
        nome: z.string().trim().min(2, "Informe o nome.").max(200),
        email: z.string().trim().toLowerCase().email("E-mail inválido."),
        documento: DOCUMENTO.optional().default(""),
        celular: z.string().trim().max(20).optional().default(""),
        creci: z.string().trim().max(20).optional().default(""),
        creciUf: z.string().trim().max(2).optional().default(""),
        planoId: UUID,
        modalidade: z.enum(["cortesia", "teste", "pagamento"]),
        dias: z.number().int().min(1, "De 1 a 365 dias.").max(365, "De 1 a 365 dias.").nullable(),
        carteira: z.string().uuid().nullable(),
        motivo: MOTIVO,
      })
      .refine((v) => v.modalidade === "pagamento" || v.dias !== null, {
        message: "Informe os dias de acesso.",
        path: ["dias"],
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ r: { tenant_id: string } }>(
        "select plataforma.criar_licenca_manual($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) as r",
        [
          data.tipo,
          data.nome,
          data.email,
          data.documento || null,
          data.celular || null,
          data.creci || null,
          data.creciUf || null,
          data.planoId,
          data.modalidade,
          data.modalidade === "pagamento" ? null : data.dias,
          data.carteira,
          data.motivo,
        ],
      ),
    );
    return { id: r?.r.tenant_id ?? null };
  });

/** Põe a conta na carteira de uma pessoa do Agilliza (ou tira, com null). */
export const definirCarteira = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .inputValidator((d: unknown) =>
    z.object({ id: UUID, carteira: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select plataforma.definir_carteira($1, $2)", [data.id, data.carteira]),
    );
    return { ok: true as const };
  });

/** Novo link de criar senha para o dono da conta (vale 72 horas). */
export const reenviarAcessoLicenca = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select plataforma.reenviar_acesso_licenca($1)", [data.id]),
    );
    return { ok: true as const };
  });
