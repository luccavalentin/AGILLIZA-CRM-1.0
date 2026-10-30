/**
 * Base de uma conta assinante (corretor/imobiliária) nas telas NATIVAS do Agilliza.
 *
 * Arquitetura (migração 0211 do Corretor): leitura por adaptador + espelho sob demanda.
 *  - Listar não copia nada: lê do Corretor (`plataforma.simulacoes_da_conta` / `crm_da_licenca`)
 *    e devolve no formato que os cartões e a tabela do Agilliza já usam.
 *  - Agir (ver, editar, baixar, enviar) espelha a simulação — ou o cliente — no Agilliza,
 *    idempotente, e daí seguem as telas e o fluxo nativos.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

const UUID = z.string().uuid();

interface SimulacaoContaBruta {
  id: string;
  codigo: string;
  status: string;
  produto: string | null;
  sistema: string | null;
  valor_imovel: number | null;
  valor_financiamento: number | null;
  prazo: number | null;
  criado_em: string;
  homefin_codigo_oportunidade: string | null;
  nome_conjuge: string | null;
  cliente: string | null;
  responsavel: string | null;
  conta: string;
  /** Conta (licença) da linha: vem nas listas de grupo (0315). */
  licenca_id?: string | null;
  homefin_id_oportunidade?: string | null;
  simulacao_agilliza_id: string | null;
  bancos: {
    banco_id: string;
    nome_banco: string;
    sistema: string;
    estado: string;
    parcela: number | null;
    taxa_juros_aa: number | null;
    cet_aa: number | null;
    prazo: number | null;
    erro: string | null;
  }[];
}

/** Situação do Corretor → a do Agilliza (mesmo selo nos cartões). */
const STATUS_AGILLIZA: Record<string, string> = {
  rascunho: "rascunho",
  calculada: "rascunho",
  enviando: "enviando",
  enviada: "enviando",
  cotada: "simulada",
  parcial: "parcialmente_simulada",
  erro: "erro_banco",
  proposta: "promovida",
  aprovada: "promovida",
  condicionada: "promovida",
  recusada: "promovida",
  arquivada: "cancelada",
};

/** Linha no formato da lista de simulações do Agilliza, com a conta de origem. */
export function simulacaoDaContaNoFormatoAgilliza(s: SimulacaoContaBruta) {
  return noFormatoAgilliza(s);
}

function noFormatoAgilliza(s: SimulacaoContaBruta) {
  return {
    id: s.id,
    numero_simulacao: s.codigo,
    nome_cliente: s.cliente,
    nome_conjuge: s.nome_conjuge,
    nome_responsavel: s.responsavel,
    produto: s.produto === "home_equity" ? "home_equity" : "financiamento_imobiliario",
    status: STATUS_AGILLIZA[s.status] ?? s.status,
    valor_imovel: s.valor_imovel,
    valor_financiamento: s.valor_financiamento,
    prazo: s.prazo,
    created_at: s.criado_em,
    codigo_oportunidade_homefin: s.homefin_codigo_oportunidade,
    homefin_id_oportunidade: s.homefin_id_oportunidade ?? null,
    bancos: (s.bancos ?? []).map((b, i) => ({
      id: `${s.id}-${i}`,
      banco_id: b.banco_id,
      nome_banco: b.nome_banco,
      sistema_amortizacao: b.sistema,
      status_banco:
        b.estado === "cotado" ? "simulada" : b.estado === "erro" ? "erro" : "aguardando",
      valor_parcela: b.parcela,
      taxa_juros_ano: b.taxa_juros_aa,
      taxa_cet_ano: b.cet_aa,
      mensagem_banco: b.erro,
      selecionado: true,
    })),
    /** Conta (licença) de origem — o selo discreto da lista. */
    _conta: s.conta,
    /** Espelho no Agilliza, quando já existe (ver/editar vão direto). */
    _simulacao_agilliza_id: s.simulacao_agilliza_id,
    /** Conta da linha (nas listas de grupo cada linha pode ser de uma conta). */
    _licenca: s.licenca_id ?? null,
  };
}

export type SimulacaoDaContaNativa = ReturnType<typeof noFormatoAgilliza>;

export const listarSimulacoesDaContaNativas = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.contas", "view"])])
  .validator((d: unknown) =>
    z
      .object({
        licenca: UUID,
        termo: z.string().trim().max(120).optional().nullable(),
        pagina: z.number().int().min(1).max(1000).default(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ r: { simulacoes: SimulacaoContaBruta[]; total: number; por_pagina: number } }>(
        "select plataforma.simulacoes_da_conta($1::jsonb) as r",
        [
          JSON.stringify({
            licenca: data.licenca,
            termo: data.termo || null,
            pagina: data.pagina,
            por_pagina: 20,
          }),
        ],
      ),
    );
    return {
      itens: (r?.r?.simulacoes ?? []).map(noFormatoAgilliza),
      total: Number(r?.r?.total ?? 0),
      porPagina: Number(r?.r?.por_pagina ?? 20),
    };
  });

function semMigracao(e: unknown): never {
  const { code } = e as { code?: string };
  if (code === "42883") {
    throw Object.assign(
      new Error(
        // Falta a migração 0211 do Corretor neste banco (detalhe para quem mantém, não para a tela).
        "Abrir a base da conta no Agilliza ainda não está disponível neste servidor.",
      ),
      { code: "P0001" },
    );
  }
  throw e;
}

/** Simulação do assinante no Agilliza (idempotente): o id para as telas nativas. */
export const espelharSimulacaoDaConta = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.contas", "view"])])
  .validator((d: unknown) => z.object({ licenca: UUID, simulacaoId: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comConta } = await import("./ponte.server");
    const r = await comConta(context.userId, data.licenca, (tx) =>
      tx
        .uma<{
          r: {
            simulacao_id: string;
            numero_simulacao: string;
            cliente_id: string;
            ja_espelhada: boolean;
            pendencias_imovel: string[];
          };
        }>("select plataforma.espelhar_simulacao_no_agilliza($1, $2) as r", [
          data.simulacaoId,
          context.userId,
        ])
        .catch(semMigracao),
    );
    if (!r?.r) throw new Error("Não foi possível abrir esta simulação no Agilliza.");
    return r.r;
  });

/** Cliente do assinante no Agilliza (idempotente pelo CPF): o id da ficha nativa. */
export const espelharClienteDaConta = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.contas", "view"])])
  .validator((d: unknown) => z.object({ licenca: UUID, clienteId: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comConta } = await import("./ponte.server");
    const r = await comConta(context.userId, data.licenca, (tx) =>
      tx
        .uma<{ r: { cliente_id: string; reaproveitado: boolean } }>(
          "select plataforma.espelhar_cliente_no_agilliza($1, $2) as r",
          [data.clienteId, context.userId],
        )
        .catch(semMigracao),
    );
    if (!r?.r) throw new Error("Não foi possível abrir este cliente no Agilliza.");
    return r.r;
  });
