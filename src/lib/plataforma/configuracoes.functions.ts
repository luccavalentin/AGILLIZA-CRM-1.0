/**
 * Configurações globais da plataforma (Agilliza Tech + banco único), no Agilliza.
 *
 * Os números que valem para TODAS as contas de assinantes: parâmetros
 * (`plataforma.configuracoes`), bancos e taxas (`operacional.bancos`), produtos de crédito
 * (`operacional.produtos`) e feature flags (`nucleo.feature_flags`). Mesmas consultas e
 * gravações da antiga Gestão (`[portal]/configuracoes/globais.tsx` e `globais-acoes.ts`).
 * Ler exige `tenants.ler`; gravar, `config.editar` (RLS "global" do motor). Todas essas
 * tabelas são auditadas: cada alteração fica no audit log com o valor antigo.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import type { Json } from "@/integrations/supabase/types";

export interface ParametroGlobal {
  chave: string;
  valor: Json;
  descricao: string | null;
  atualizado_em: string;
}
export interface BancoGlobal {
  id: string;
  nome: string;
  ativo: boolean;
  taxa_sac: number | null;
  taxa_price: number | null;
  taxa_he_sac: number | null;
  taxa_he_price: number | null;
  sistemas: string[] | null;
  comprometimento_max: number | null;
  /** Tabela por idade (`[{ idadeAte, taxaMensal }]`) — só leitura nesta tela. */
  mip: Json | null;
  dfi_mensal: number | null;
  tarifa_mensal: number | null;
  teto_comercial_ltv: number | null;
  teto_comercial_prazo: number | null;
  financia_despesas: boolean;
  espera_cotacao: boolean;
  codigo_compe: number | null;
  taxas_propostas: Json | null;
  taxas_propostas_em: string | null;
  atualizado_em: string;
}
export interface ProdutoCredito {
  id: string;
  nome: string;
  teto: number | null;
  prazo_minimo: number | null;
  prazo_maximo: number | null;
  idade_mais_prazo_max: number | null;
  ativo: boolean;
}
export interface FeatureFlag {
  id: string;
  chave: string;
  ligado: boolean;
  descricao: string | null;
  tenant_id: string | null;
  conta: string | null;
  atualizado_em: string;
}

export const lerConfiguracoesGlobais = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.configuracoes", "view"])])
  .handler(async ({ context }) => {
    const { comPlataforma } = await import("./ponte.server");
    return comPlataforma(context.userId, async (tx) => {
      // Mesma porta da Gestão (`exigirGestao("tenants.ler")`), conferida pelo banco.
      const pode = await tx.uma<{ ler: boolean; editar: boolean }>(
        `select seguranca.auth_e_plataforma('tenants.ler') as ler,
                seguranca.auth_e_plataforma('config.editar') as editar`,
      );
      if (!pode?.ler) {
        return {
          permitido: false as const,
          podeEditar: false,
          configs: [] as ParametroGlobal[],
          bancos: [] as BancoGlobal[],
          produtos: [] as ProdutoCredito[],
          flags: [] as FeatureFlag[],
        };
      }
      const configs = await tx.consultar<ParametroGlobal>(
        `select chave, valor, descricao, atualizado_em::text as atualizado_em
           from plataforma.configuracoes order by chave`,
      );
      const bancos = await tx.consultar<BancoGlobal>(
        `select id, nome, ativo,
                taxa_sac::float8 as taxa_sac, taxa_price::float8 as taxa_price,
                taxa_he_sac::float8 as taxa_he_sac, taxa_he_price::float8 as taxa_he_price,
                sistemas::text[] as sistemas,
                comprometimento_max::float8 as comprometimento_max, mip,
                dfi_mensal::float8 as dfi_mensal, tarifa_mensal::float8 as tarifa_mensal,
                teto_comercial_ltv::float8 as teto_comercial_ltv,
                teto_comercial_prazo::int as teto_comercial_prazo,
                financia_despesas, espera_cotacao, codigo_compe::int as codigo_compe,
                taxas_propostas, taxas_propostas_em::text as taxas_propostas_em,
                atualizado_em::text as atualizado_em
           from operacional.bancos order by nome`,
      );
      const produtos = await tx.consultar<ProdutoCredito>(
        `select id, nome, teto::float8 as teto, prazo_minimo::int as prazo_minimo,
                prazo_maximo::int as prazo_maximo, idade_mais_prazo_max::int as idade_mais_prazo_max, ativo
           from operacional.produtos order by nome`,
      );
      const flags = await tx.consultar<FeatureFlag>(
        `select f.id::text as id, f.chave, f.ligado, f.descricao, f.tenant_id::text as tenant_id,
                (select t.nome from nucleo.tenants t where t.id = f.tenant_id) as conta,
                f.atualizado_em::text as atualizado_em
           from nucleo.feature_flags f order by f.chave, f.tenant_id nulls first`,
      );
      return {
        permitido: true as const,
        podeEditar: !!pode.editar,
        configs,
        bancos,
        produtos,
        flags,
      };
    });
  });

export const salvarParametroGlobal = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.configuracoes", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        chave: z.string().regex(/^[a-z][a-z0-9_.]{2,60}$/, { message: "Chave inválida." }),
        valorJson: z.string().max(20_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let valor: unknown;
    try {
      valor = JSON.parse(data.valorJson);
    } catch {
      throw new Error(
        'O valor precisa ser JSON: um número (30), true/false, "texto" entre aspas ou um objeto.',
      );
    }
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ chave: string }>(
        `update plataforma.configuracoes
            set valor = $2::jsonb, atualizado_por = seguranca.auth_usuario_id(), atualizado_em = now()
          where chave = $1 returning chave`,
        [data.chave, JSON.stringify(valor)],
      ),
    );
    if (!r) throw new Error("Parâmetro não encontrado (ou o banco recusou a alteração).");
    return { ok: true as const, chave: r.chave };
  });

const ID_BANCO = z.string().regex(/^[a-z0-9_-]{2,40}$/, { message: "Banco inválido." });
/** Número obrigatório dentro da faixa que a coluna aceita (todas são NOT NULL). */
const numero = (rotulo: string, max: number) =>
  z
    .number({
      invalid_type_error: `${rotulo}: informe um número.`,
      required_error: `${rotulo}: informe um número.`,
    })
    .finite()
    .min(0, { message: `${rotulo}: não pode ser negativo.` })
    .max(max, { message: `${rotulo}: o máximo é ${max}.` });

/**
 * Taxas e limites de um banco. São elas que entram na simulação de todas as contas — por isso
 * a alteração é auditada e o valor antigo fica registrado.
 *
 * O MIP NÃO é gravado aqui: no banco ele é uma tabela por idade (jsonb), e a gravação da
 * Gestão trocava essa tabela por um número solto, quebrando a simulação.
 */
export const salvarBancoGlobal = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.configuracoes", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: ID_BANCO,
        ativo: z.boolean(),
        taxa_sac: numero("SAC", 100),
        taxa_price: numero("Price", 100),
        taxa_he_sac: numero("Home equity — SAC", 100),
        taxa_he_price: numero("Home equity — Price", 100),
        // Frações (0,30 = 30%), como a coluna guarda.
        comprometimento_max: numero("Comprometimento máximo", 1),
        dfi_mensal: numero("DFI", 1),
        tarifa_mensal: numero("Tarifa mensal", 10_000),
        teto_comercial_ltv: numero("LTV máximo comercial", 1),
        teto_comercial_prazo: numero("Prazo máximo comercial", 600).int({
          message: "Prazo máximo comercial: use meses inteiros.",
        }),
        financia_despesas: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ id: string }>(
        `update operacional.bancos
            set ativo = $2, taxa_sac = $3, taxa_price = $4, taxa_he_sac = $5, taxa_he_price = $6,
                comprometimento_max = $7, dfi_mensal = $8, tarifa_mensal = $9,
                teto_comercial_ltv = $10, teto_comercial_prazo = $11, financia_despesas = $12,
                atualizado_em = now()
          where id = $1 returning id`,
        [
          data.id,
          data.ativo,
          data.taxa_sac,
          data.taxa_price,
          data.taxa_he_sac,
          data.taxa_he_price,
          data.comprometimento_max,
          data.dfi_mensal,
          data.tarifa_mensal,
          data.teto_comercial_ltv,
          data.teto_comercial_prazo,
          data.financia_despesas,
        ],
      ),
    );
    if (!r) throw new Error("Banco não encontrado (ou o banco de dados recusou a alteração).");
    return { ok: true as const };
  });

/** Aprova as taxas que vieram propostas pelo provedor (limpa a proposta e aplica os valores). */
export const aprovarTaxasBanco = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.configuracoes", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: ID_BANCO }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ id: string }>(
        `update operacional.bancos b
            set taxa_sac = coalesce((b.taxas_propostas ->> 'taxa_sac')::numeric, b.taxa_sac),
                taxa_price = coalesce((b.taxas_propostas ->> 'taxa_price')::numeric, b.taxa_price),
                taxa_he_sac = coalesce((b.taxas_propostas ->> 'taxa_he_sac')::numeric, b.taxa_he_sac),
                taxa_he_price = coalesce((b.taxas_propostas ->> 'taxa_he_price')::numeric, b.taxa_he_price),
                taxas_propostas = null, taxas_propostas_em = null,
                taxas_aprovadas_por = seguranca.auth_usuario_id(), atualizado_em = now()
          where b.id = $1 and b.taxas_propostas is not null returning b.id`,
        [data.id],
      ),
    );
    if (!r) throw new Error("Não há taxa proposta para este banco.");
    return { ok: true as const };
  });

/** Liga ou desliga um recurso — para todas as contas ou só para uma. */
export const alternarFeatureFlag = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.configuracoes", "edit"])])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid({ message: "Flag inválida." }), ligado: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ chave: string }>(
        "update nucleo.feature_flags set ligado = $2, atualizado_em = now() where id = $1 returning chave",
        [data.id, data.ligado],
      ),
    );
    if (!r) throw new Error("Flag não encontrada (ou o banco recusou a alteração).");
    return { ok: true as const, chave: r.chave };
  });
