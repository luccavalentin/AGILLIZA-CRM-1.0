/**
 * Licenças e assinantes do Agilliza Tech, administradas pelo Agilliza correspondente.
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
  /** Carteira nomeada da conta (0308), quando houver. */
  carteira_grupo_id: string | null;
  carteira_grupo_nome: string | null;
  /** Fim do acesso pago ou da cortesia (a renovação é cobrada antes dele). */
  acesso_ate: string | null;
  /** Quem indicou a conta (0501): a conta assinante, quando é uma, e o nome. */
  indicado_por: string | null;
  indicado_por_nome: string | null;
}

/** Conta assinante que pode ser escolhida como "quem indicou". */
export interface ContaIndicadora {
  id: string;
  nome: string;
  tipo: TipoLicenca;
  /** Quantas contas ela já indicou. */
  indicacoes: number;
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
  .validator((d: unknown) =>
    z
      .object({
        tipo: z.enum(["corretor", "imobiliaria", "parceiro"]).optional().nullable(),
        status: z
          .enum(["trial", "ativo", "somente_leitura", "suspenso", "cancelado"])
          .optional()
          .nullable(),
        busca: z.string().trim().max(120).optional().nullable(),
        plano: z.string().uuid().optional().nullable(),
        /** Carteira nomeada (id) ou "sem" (contas fora de carteira). */
        carteira: z.union([z.string().uuid(), z.literal("sem")]).optional().nullable(),
        /** Uma conta só (link `?conta=` do financeiro da matriz, que abre a gaveta). */
        conta: z.string().uuid().optional().nullable(),
        /** Indicação (0501): a conta que indicou ou "qualquer" (só as contas com indicação). */
        indicacao: z.union([z.string().uuid(), z.literal("qualquer")]).optional().nullable(),
        pagina: z.number().int().min(1).max(10_000).default(1),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    // A busca é texto literal: % e _ digitados não viram curinga.
    const busca = data.busca ? data.busca.replace(/[\\%_]/g, (c) => "\\" + c) : null;
    const filtros = [
      data.tipo ?? null,
      data.status ?? null,
      busca,
      data.plano ?? null,
      data.carteira && data.carteira !== "sem" ? data.carteira : null,
      data.carteira === "sem",
      data.conta ?? null,
      !!data.indicacao,
      data.indicacao && data.indicacao !== "qualquer" ? data.indicacao : null,
    ];
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
            -- a8 (C70): vinculados ao correspondente ficam na aba própria ("Sua base").
            and not t.vinculo_agilliza
            and ($1::text is null or t.tipo::text = $1)
            and ($2::text is null or t.status::text = $2)
            and ($3::text is null or t.nome ilike '%' || $3 || '%' or t.slug::text ilike '%' || $3 || '%'
                 or t.email_contato::text ilike '%' || $3 || '%')
            and ($4::uuid is null or t.plano_id = $4)
            and ($5::uuid is null or exists (select 1 from plataforma.carteira c
                                              where c.tenant_id = t.id and c.grupo_id = $5))
            and (not $6::boolean or not exists (select 1 from plataforma.carteira c
                                                 where c.tenant_id = t.id and c.grupo_id is not null))
            and ($7::uuid is null or t.id = $7)
            and (not $8::boolean or t.id in (select plataforma.contas_indicadas($9::uuid)))`;
    return comPlataforma(context.userId, async (tx) => {
      const licencas = await tx.consultar<Licenca>(
        `select t.id, t.tipo::text as tipo, t.nome, t.slug::text as slug, t.status::text as status,
                t.status_motivo, t.creci, t.creci_uf, t.documento_mascarado,
                t.email_contato::text as email_contato, t.celular_contato,
                t.criado_em::date::text as criado_em, t.trial_ate::text as trial_ate,
                t.acesso_ate::text as acesso_ate,
                t.plano_id, p.nome as plano,
                a.status::text as assinatura_status, a.ciclo::text as ciclo,
                a.valor::float8 as assinatura_valor,
                coalesce(vc.n, 0) as usuarios,
                sa.score::int as score, sa.faixa::text as faixa
           ${origem}
          order by t.criado_em desc, t.id
          limit ${POR_PAGINA_LICENCAS} offset $10`,
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
      // Carteira nomeada (0308 do Agilliza Tech). Sem `.catch`: numa transação, engolir o erro
      // deixaria as consultas seguintes falhando com "transação abortada".
      const grupos = licencas.length
        ? await tx.consultar<{ tenant_id: string; carteira_id: string; carteira_nome: string }>(
            "select tenant_id, carteira_id, carteira_nome from plataforma.carteira_grupo_das_contas($1::uuid[])",
            [licencas.map((l) => l.id)],
          )
        : [];
      const grupoDaConta = new Map(grupos.map((g) => [g.tenant_id, g]));
      // Quem indicou (0501). O módulo de licenças tem tenants.ler, que a função pede.
      const indicacoes = licencas.length
        ? await tx.consultar<{ tenant_id: string; indicado_por: string | null; indicado_por_nome: string }>(
            "select tenant_id, indicado_por, indicado_por_nome from plataforma.indicacoes_das_contas($1::uuid[])",
            [licencas.map((l) => l.id)],
          )
        : [];
      const indicacaoDaConta = new Map(indicacoes.map((i) => [i.tenant_id, i]));
      for (const l of licencas) {
        l.carteira_uid = porConta.get(l.id)?.auth_uid ?? null;
        l.carteira_nome = porConta.get(l.id)?.nome ?? null;
        l.carteira_grupo_id = grupoDaConta.get(l.id)?.carteira_id ?? null;
        l.carteira_grupo_nome = grupoDaConta.get(l.id)?.carteira_nome ?? null;
        l.indicado_por = indicacaoDaConta.get(l.id)?.indicado_por ?? null;
        l.indicado_por_nome = indicacaoDaConta.get(l.id)?.indicado_por_nome ?? null;
      }
      const planos = await tx.consultar<PlanoLicenca>(
        `select id, codigo, nome, publico::text as publico, preco_mensal::float8 as preco_mensal
           from nucleo.planos where ativo and not vinculado_agilliza order by ordem, nome`,
      );
      // Carteiras ativas, para o filtro da lista.
      const cart = await tx.uma<{ j: { id: string; nome: string }[] }>(
        "select coalesce(jsonb_agg(jsonb_build_object('id', x->>'id', 'nome', x->>'nome')), '[]'::jsonb) as j from jsonb_array_elements(plataforma.carteiras_listar(false)) x",
      );
      return {
        licencas,
        planos,
        carteiras: cart?.j ?? [],
        resumo: resumo ?? { total: 0, ativas: 0, teste: 0, travadas: 0, mrr: 0, usuarios: 0 },
      };
    });
  });

/** Pessoas, uso, créditos, assinatura e faturas de uma licença. */
export const detalheLicenca = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.licencas", "view"])])
  .validator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const pessoas = await tx.consultar<PessoaLicenca>(
        `select id, nome, email_mascarado, papel::text as papel, equipe, ativo, status,
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
  .validator((d: unknown) =>
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
  .validator((d: unknown) =>
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
  .validator((d: unknown) => z.object({ id: UUID, planoId: UUID }).parse(d))
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

/* ------------------------------------------------ mudar o tipo da conta (0590) --- */

/** Tipos que trocam entre si (parceiro fica de fora: papéis, portal e dados são outros). */
export type TipoConversivel = "corretor" | "imobiliaria";

/** O que muda (e o que impede) se a conta passar ao tipo novo. */
export interface PreviaConversaoTipo {
  tipo_atual: TipoLicenca;
  tipo_novo: TipoConversivel;
  plano_atual: string | null;
  pessoas_ativas: number;
  convites_pendentes: number;
  contratos_locacao_abertos: number;
  modulos_ganhos: string[];
  modulos_perdidos: string[];
  /** Vazio = pode converter. */
  impedimentos: string[];
}

export const previaConverterTipoLicenca = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .validator((d: unknown) =>
    z.object({ id: UUID, tipo: z.enum(["corretor", "imobiliaria"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: PreviaConversaoTipo }>(
        "select plataforma.previa_converter_tipo_conta($1, $2) as j",
        [data.id, data.tipo],
      ),
    );
    if (!r) throw new Error("A conta não foi encontrada.");
    return r.j;
  });

/**
 * Corretor ↔ imobiliária mantendo clientes, imóveis, propostas, faturas, créditos e a
 * situação da licença. Tipo e plano mudam juntos; o motivo vai para a auditoria.
 */
export const converterTipoLicenca = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .validator((d: unknown) =>
    z
      .object({
        id: UUID,
        tipo: z.enum(["corretor", "imobiliaria"]),
        planoId: z.string().uuid("Escolha o plano do novo tipo."),
        motivo: MOTIVO,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: { tipo: TipoConversivel; plano: string } }>(
        "select plataforma.converter_tipo_conta($1, $2, $3, $4) as j",
        [data.id, data.tipo, data.planoId, data.motivo],
      ),
    );
    if (!r) throw new Error("A conta não foi encontrada.");
    return r.j;
  });

/* --------------------------------------- redefinir a senha do assinante (0591) --- */

/**
 * Argon2id com os mesmos parâmetros do Corretor (`packages/db/src/autenticacao.ts`:
 * m=65536, t=3, p=1) — o login de lá confere este hash. `hash-wasm` (WASM, sem binário
 * nativo) roda igual no Node da VPS e no Worker.
 */
async function hashArgon2id(senha: string): Promise<string> {
  const { argon2id } = await import("hash-wasm");
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return argon2id({
    password: senha,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: "encoded",
  });
}

/**
 * A senha da pessoa volta a ser o próprio e-mail, com troca obrigatória no primeiro acesso
 * (decisão do dono: login e senha do assinante são sempre o e-mail). O banco confere a conta
 * e a pessoa, encerra as sessões dela e audita; o e-mail não volta para a tela.
 */
export const redefinirSenhaLicenca = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .validator((d: unknown) =>
    z.object({ id: UUID, usuarioId: z.string().uuid("Pessoa inválida.") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, async (tx) => {
      const e = await tx.uma<{ email: string }>(
        "select plataforma.email_para_redefinir_senha($1, $2) as email",
        [data.id, data.usuarioId],
      );
      if (!e?.email) throw new Error("Esta pessoa não tem e-mail de acesso.");
      const hash = await hashArgon2id(e.email);
      return tx.uma<{ j: { sessoes_encerradas: number } }>(
        "select plataforma.redefinir_senha_assinante($1, $2, $3, $4) as j",
        [data.id, data.usuarioId, e.email, hash],
      );
    });
    return { sessoesEncerradas: r?.j.sessoes_encerradas ?? 0 };
  });

/** Crédito de cortesia ou estorno, com entrada no extrato da conta. */
export const concederCreditosLicenca = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .validator((d: unknown) =>
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
 * Desconto na licença (0254): em porcentagem (até 100) ou em reais, por um número de
 * faturas (1 a 120) ou para sempre (`faturas: null`). Sem teto: quem cria licença concede.
 */
const DESCONTO = z
  .object({
    tipo: z.enum(["percentual", "valor"]),
    valor: z
      .number()
      .positive("Informe o desconto (maior que zero).")
      .max(1_000_000, "Desconto acima do permitido.")
      .refine((v) => Math.round(v * 100) === v * 100, "Use no máximo duas casas decimais."),
    faturas: z
      .number()
      .int()
      .min(1, "De 1 a 120 faturas.")
      .max(120, "De 1 a 120 faturas.")
      .nullable(),
  })
  .refine((d) => d.tipo !== "percentual" || d.valor <= 100, {
    message: "O desconto em porcentagem vai até 100%.",
    path: ["valor"],
  });

export type DescontoNovo = z.infer<typeof DESCONTO>;

/** Quem indicou: a conta assinante (conta) ou, quando não é assinante, o nome. */
const INDICACAO = z
  .object({
    conta: z.string().uuid().nullable(),
    nome: z.string().trim().max(200).nullable(),
  })
  .refine((v) => v.conta !== null || (v.nome ?? "").length >= 2, {
    message: "Escolha a conta que indicou ou escreva o nome de quem indicou.",
    path: ["nome"],
  });

export type IndicacaoNova = z.infer<typeof INDICACAO>;

/**
 * Cria a licença à mão (cortesia, teste ou pagamento) e, se escolhida, já põe a conta na
 * carteira de alguém do Agilliza. A pessoa recebe o e-mail para criar a própria senha.
 */
export const criarLicenca = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .validator((d: unknown) =>
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
        /** Carteira nomeada (0308) em que a conta já nasce. */
        carteiraGrupo: z.string().uuid().nullable().optional(),
        motivo: MOTIVO,
        desconto: DESCONTO.nullable().optional(),
        /** Quem indicou (0501): a conta assinante ou, de fora, o nome. */
        indicacao: INDICACAO.nullable().optional(),
      })
      .refine((v) => v.modalidade === "pagamento" || v.dias !== null, {
        message: "Informe os dias de acesso.",
        path: ["dias"],
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    // Licença e desconto na MESMA transação: a fatura de ativação aberta pela licença ainda
    // não saiu do banco, então já recebe o desconto (0254). Se o desconto falhar, a licença
    // também não é criada — nada fica pela metade.
    const r = await comPlataforma(context.userId, async (tx) => {
      const criada = await tx.uma<{ r: { tenant_id: string } }>(
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
      );
      const id = criada?.r.tenant_id ?? null;
      if (id && data.desconto) {
        await tx.consultar("select plataforma.conceder_desconto_licenca($1, $2, $3, $4, $5)", [
          id,
          data.desconto.tipo,
          data.desconto.valor,
          data.desconto.faturas,
          data.motivo,
        ]);
      }
      // Indicação na mesma transação: indicador inválido desfaz a criação inteira.
      if (id && data.indicacao) {
        await tx.consultar("select plataforma.definir_indicacao_licenca($1, $2, $3, null)", [
          id,
          data.indicacao.conta,
          data.indicacao.conta ? null : data.indicacao.nome,
        ]);
      }
      // Na mesma transação: carteira arquivada ou inexistente desfaz a criação inteira.
      if (id && data.carteiraGrupo) {
        await tx.consultar("select plataforma.carteira_adicionar_contas($1, $2::uuid[])", [
          data.carteiraGrupo,
          [id],
        ]);
      }
      return id;
    });
    return { id: r };
  });

/** Novo link de criar senha para o dono da conta (vale 72 horas). */
export const reenviarAcessoLicenca = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .validator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select plataforma.reenviar_acesso_licenca($1)", [data.id]),
    );
    return { ok: true as const };
  });

/* ------------------------------------------------------- desconto na licença (0254) --- */

export interface DescontoVigente {
  id: string;
  tipo: "percentual" | "valor";
  valor: number;
  rotulo: string;
  faturas_total: number | null;
  faturas_usadas: number;
  motivo: string;
  criado_em: string;
}

export interface DescontoAnterior {
  id: string;
  rotulo: string;
  faturas_total: number | null;
  faturas_usadas: number;
  motivo: string;
  criado_em: string;
  encerrado_em: string;
  encerrado_motivo: string | null;
}

/** Desconto vigente e os anteriores da licença. */
export const descontoLicenca = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.licencas", "view"])])
  .validator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: { vigente: DescontoVigente | null; anteriores: DescontoAnterior[] } }>(
        "select plataforma.desconto_da_conta($1) as j",
        [data.id],
      ),
    );
    return r?.j ?? { vigente: null, anteriores: [] };
  });

/** Concede (ou troca) o desconto da licença; vale a partir da próxima fatura. */
export const concederDescontoLicenca = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .validator((d: unknown) =>
    z.object({ id: UUID, desconto: DESCONTO, motivo: MOTIVO }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: { id: string; rotulo: string } }>(
        "select plataforma.conceder_desconto_licenca($1, $2, $3, $4, $5) as j",
        [data.id, data.desconto.tipo, data.desconto.valor, data.desconto.faturas, data.motivo],
      ),
    );
    return { rotulo: r?.j.rotulo ?? null };
  });

/** Encerra o desconto vigente (as faturas já abertas com ele continuam como estão). */
export const encerrarDescontoLicenca = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .validator((d: unknown) => z.object({ id: UUID, motivo: MOTIVO }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ ok: boolean }>("select plataforma.encerrar_desconto_licenca($1, $2) as ok", [
        data.id,
        data.motivo,
      ]),
    );
    return { encerrado: r?.ok ?? false };
  });

/* ---------------------------------------------------- indicação da licença (0501) --- */

/** Busca a conta assinante que indicou (nome, endereço ou e-mail; no máximo 20). */
export const buscarContasIndicacao = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .validator((d: unknown) => z.object({ busca: z.string().trim().max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.busca.length < 2) return [] as ContaIndicadora[];
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, (tx) =>
      tx.consultar<ContaIndicadora>(
        "select id, nome, tipo, indicacoes from plataforma.contas_para_indicacao($1)",
        [data.busca],
      ),
    );
  });

/** Liga a licença a quem indicou, troca ou tira (com null). Fica no histórico da conta. */
export const definirIndicacaoLicenca = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .validator((d: unknown) => z.object({ id: UUID, indicacao: INDICACAO.nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select plataforma.definir_indicacao_licenca($1, $2, $3, null)", [
        data.id,
        data.indicacao?.conta ?? null,
        data.indicacao?.conta ? null : (data.indicacao?.nome ?? null),
      ]),
    );
    return { ok: true as const };
  });
