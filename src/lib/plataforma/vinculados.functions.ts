/**
 * Corretores e parceiros vinculados ao Agilliza Correspondente (C70, 26/10/2026).
 *
 * O vinculado é uma conta comum do Agilliza Tech marcada como da base do correspondente:
 * usa exatamente o portal dos assinantes, sem mensalidade (nunca recebe fatura). Duas
 * portas, como nas licenças: a permissão `saas.licencas` aqui e `tenants.gerir`/`tenants.ler`
 * no banco (funções `plataforma.vinculado*`, migração 0343 do Agilliza Tech, pela ponte).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { documentoValido, normalizarCreci, somenteDigitos } from "./vinculados-regras";

export type TipoVinculado = "corretor" | "parceiro";
export type SituacaoVinculado = "ativo" | "suspenso" | "aguardando_acesso";

export interface Vinculado {
  id: string;
  tipo: TipoVinculado;
  nome: string;
  email: string | null;
  celular: string | null;
  creci: string | null;
  creci_uf: string | null;
  documento_mascarado: string | null;
  status: "trial" | "ativo" | "somente_leitura" | "suspenso" | "cancelado";
  status_motivo: string | null;
  criado_em: string;
  vinculado_em: string | null;
  origem: "cadastro" | "parceiro_agilliza" | "conta_existente";
  agilliza_parceiro_uid: string | null;
  dono_nome: string | null;
  dono_email: string | null;
  acesso_criado: boolean;
  ultimo_login_em: string | null;
  convite_valido: boolean;
  usuarios: number;
  carteira: string | null;
}

export interface ResumoVinculados {
  total: number;
  corretores: number;
  parceiros: number;
  ativos: number;
  suspensos: number;
  aguardando_acesso: number;
}

export interface ParceiroAgilliza {
  auth_uid: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  ativo: boolean;
  creci: string | null;
  razao_social: string | null;
  convertido_tenant: string | null;
  conta_existente: string | null;
}

export interface ContaExistente {
  tenant_id: string;
  tipo: TipoVinculado;
  nome: string;
  status: string;
  vinculada: boolean;
  plano: string | null;
  faturas_em_aberto: number;
}

const UUID = z.string().uuid("Conta inválida.");
const MOTIVO = z
  .string()
  .trim()
  .min(5, "Escreva o motivo (pelo menos 5 caracteres) — ele fica registrado.")
  .max(500);
const UF = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => !v || /^[A-Z]{2}$/.test(v), "UF inválida.");

async function ponte() {
  return import("./ponte.server");
}

/** Lista os vinculados (com o acesso do dono e o resumo). */
export const listarVinculados = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.licencas", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        busca: z.string().trim().max(120).optional().nullable(),
        situacao: z.enum(["ativo", "suspenso", "aguardando_acesso"]).optional().nullable(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: { itens: Vinculado[]; resumo: ResumoVinculados } }>(
        "select plataforma.vinculados_listar($1, $2) as j",
        [data.busca || null, data.situacao ?? null],
      ),
    );
    return (
      r?.j ?? {
        itens: [],
        resumo: { total: 0, corretores: 0, parceiros: 0, ativos: 0, suspensos: 0, aguardando_acesso: 0 },
      }
    );
  });

export const ESQUEMA_NOVO_VINCULADO = z
  .object({
    tipo: z.enum(["corretor", "parceiro"]),
    nome: z.string().trim().min(2, "Informe o nome.").max(200),
    documento: z.string().trim().refine(documentoValido, "CPF ou CNPJ inválido."),
    creci: z.string().trim().max(20).optional().default(""),
    creciUf: UF.optional().default(""),
    email: z.string().trim().toLowerCase().email("E-mail inválido."),
    celular: z
      .string()
      .trim()
      .refine((v) => [10, 11].includes(somenteDigitos(v).length), "Informe o celular com DDD."),
    carteira: z.string().uuid().nullable().optional().default(null),
    motivo: MOTIVO,
  })
  .refine((v) => v.tipo !== "corretor" || normalizarCreci(v.creci) !== "", {
    message: "Informe o CRECI do corretor.",
    path: ["creci"],
  })
  .refine((v) => !normalizarCreci(v.creci) || /^[A-Z]{2}$/.test(v.creciUf), {
    message: "Informe a UF do CRECI.",
    path: ["creciUf"],
  });

/** Cadastra o vinculado e manda o convite de acesso (criar senha, 72 h). */
export const criarVinculado = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .inputValidator((d: unknown) => ESQUEMA_NOVO_VINCULADO.parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ r: { tenant_id: string } }>(
        "select plataforma.vinculado_criar($1,$2,$3,$4,$5,$6,$7,$8,$9) as r",
        [
          data.tipo,
          data.nome,
          data.documento,
          normalizarCreci(data.creci) || null,
          data.creciUf || null,
          data.email,
          data.celular,
          data.carteira,
          data.motivo,
        ],
      ),
    );
    return { id: r?.r.tenant_id ?? null };
  });

/** Novo link de criar senha para o dono da conta vinculada. */
export const reenviarConviteVinculado = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select plataforma.vinculado_reenviar_convite($1)", [data.id]),
    );
    return { ok: true as const };
  });

/** Suspende ou reativa a conta vinculada. */
export const situacaoVinculado = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .inputValidator((d: unknown) =>
    z.object({ id: UUID, acao: z.enum(["suspender", "reativar"]), motivo: MOTIVO }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ s: string }>("select plataforma.vinculado_situacao($1, $2, $3) as s", [
        data.id,
        data.acao,
        data.motivo,
      ]),
    );
    return { status: r?.s ?? null };
  });

export const ESQUEMA_DESVINCULAR = z
  .object({
    id: UUID,
    destino: z.enum(["assinante", "encerrar"]),
    planoId: z.string().uuid().nullable().optional().default(null),
    diasTeste: z.number().int().min(0, "De 0 a 365 dias.").max(365, "De 0 a 365 dias.").default(0),
    motivo: MOTIVO,
  })
  .refine((v) => v.destino !== "assinante" || !!v.planoId, {
    message: "Escolha o plano de assinante.",
    path: ["planoId"],
  });

/** Desvincula: vira assinante comum (plano e teste escolhidos) ou a conta é encerrada. Nada é apagado. */
export const desvincularVinculado = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .inputValidator((d: unknown) => ESQUEMA_DESVINCULAR.parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ r: { status: string } }>(
        "select plataforma.vinculado_desvincular($1, $2, $3, $4, $5) as r",
        [
          data.id,
          data.destino,
          data.destino === "assinante" ? data.planoId : null,
          data.destino === "assinante" ? data.diasTeste : null,
          data.motivo,
        ],
      ),
    );
    return { status: r?.r.status ?? null };
  });

/** Procura a conta do Agilliza Tech pelo e-mail do dono (para vincular uma conta que já existe). */
export const buscarContaParaVincular = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().trim().toLowerCase().email("E-mail inválido.") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: ContaExistente | null }>("select plataforma.vinculado_conta_por_email($1) as j", [
        data.email,
      ]),
    );
    return r?.j ?? null;
  });

/** Vincula uma conta que já existe no Agilliza Tech (encerra a assinatura dela). */
export const vincularContaExistente = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: UUID, motivo: MOTIVO }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select plataforma.vinculado_vincular_conta($1, $2)", [data.id, data.motivo]),
    );
    return { ok: true as const };
  });

/** Parceiros do portal antigo do Agilliza, com o que já foi convertido. */
export const listarParceirosParaConverter = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .handler(async ({ context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ j: ParceiroAgilliza[] }>("select plataforma.vinculados_parceiros_agilliza() as j"),
    );
    return r?.j ?? [];
  });

export const ESQUEMA_CONVERTER = z
  .object({
    authUid: z.string().uuid("Parceiro inválido."),
    tipo: z.enum(["corretor", "parceiro"]),
    documento: z
      .string()
      .trim()
      .optional()
      .default("")
      .refine((v) => !v || documentoValido(v), "CPF ou CNPJ inválido."),
    celular: z
      .string()
      .trim()
      .optional()
      .default("")
      .refine((v) => !v || [10, 11].includes(somenteDigitos(v).length), "Celular com DDD."),
    creci: z.string().trim().max(20).optional().default(""),
    creciUf: UF.optional().default(""),
    carteira: z.string().uuid().nullable().optional().default(null),
    motivo: MOTIVO,
  })
  .refine((v) => !normalizarCreci(v.creci) || /^[A-Z]{2}$/.test(v.creciUf), {
    message: "Informe a UF do CRECI.",
    path: ["creciUf"],
  });

/**
 * "Converter parceiro do Agilliza em vinculado". Nome e e-mail vêm do cadastro do
 * Agilliza (lidos no banco). Depois, marca o aviso do portal antigo do parceiro.
 */
export const converterParceiroEmVinculado = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.licencas", "edit"])])
  .inputValidator((d: unknown) => ESQUEMA_CONVERTER.parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ r: { tenant_id: string; conta_existente: boolean } }>(
        "select plataforma.vinculado_converter_parceiro($1,$2,$3,$4,$5,$6,$7,$8) as r",
        [
          data.authUid,
          data.tipo,
          data.documento || null,
          data.celular || null,
          normalizarCreci(data.creci) || null,
          data.creciUf || null,
          data.carteira,
          data.motivo,
        ],
      ),
    );
    const tenantId = r?.r.tenant_id ?? null;
    // O aviso do portal antigo ("seu acesso novo já foi criado"). Se falhar, a conversão já
    // valeu: o parceiro só continua vendo o convite genérico.
    if (tenantId) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("parceiro_portal_novo" as never).upsert(
          {
            profile_id: data.authUid,
            tenant_id: tenantId,
            convertido_por: context.userId,
            convertido_em: new Date().toISOString(),
          } as never,
          { onConflict: "profile_id" },
        );
      } catch (e) {
        console.error("[vinculados] aviso do portal antigo não gravado", (e as Error).message);
      }
    }
    return { id: tenantId, contaExistente: r?.r.conta_existente ?? false };
  });
