/**
 * Simulação feita no Agilliza para a conta de um assinante (C29, 26/10/2026) — SÓ SERVIDOR.
 *
 * A simulação nasce no Agilliza pelo fluxo de sempre e, quando há conta de destino, NASCE TAMBÉM
 * na conta do assinante pela ponte (`comConta` → `plataforma.simulacao_do_agilliza_na_conta`,
 * migração 0318 do Agilliza Tech). Os gatilhos de lá levam o retorno dos bancos que chegar depois.
 * A simulação do Agilliza nunca falha por causa da cópia: o resultado é um aviso e o detalhe
 * oferece "Levar à conta de novo".
 *
 * As dependências (ponte e cliente admin) são injetadas para os testes não falarem com banco.
 */
import { z } from "zod";
import type { TxPlataforma } from "./ponte.server";

export const CONTA_DESTINO = z.string().uuid("Conta de destino inválida.");

/** Resultado da cópia na conta, para a tela avisar. */
export interface ResultadoNaConta {
  ok: boolean;
  mensagem: string;
  conta_nome?: string | null;
  simulacao_conta_id?: string | null;
  codigo?: string | null;
}

export interface DependenciasNaConta {
  comConta: <R>(uid: string, licenca: string, fn: (tx: TxPlataforma) => Promise<R>) => Promise<R>;
  comPlataforma: <R>(uid: string, fn: (tx: TxPlataforma) => Promise<R>) => Promise<R>;
  /** Grava a marca na simulação do Agilliza (cliente admin, escopo já conferido). */
  marcar: (simulacaoId: string, patch: Record<string, unknown>) => Promise<void>;
}

/**
 * Lê `dados.conta_assinante_id` de `criarSimulacao`: ausente/vazio → `null` (sua base, nada muda);
 * presente e torto → erro (nunca simula "sem querer" na base própria achando que foi para a conta).
 */
export function contaDestinoDosDados(dados: Record<string, unknown> | null | undefined): string | null {
  const v = dados?.conta_assinante_id;
  if (v === undefined || v === null || v === "") return null;
  const r = CONTA_DESTINO.safeParse(typeof v === "string" ? v.trim() : v);
  if (!r.success) throw new Error("Conta de destino inválida.");
  return r.data.toLowerCase();
}

/** Nome da conta (para o selo "Feita para…"). Falha de leitura não impede a cópia. */
async function nomeDaConta(dep: DependenciasNaConta, uid: string, licenca: string): Promise<string | null> {
  try {
    const r = await dep.comPlataforma(uid, (tx) =>
      tx.uma<{ r: { contas: { nome: string }[] } }>("select plataforma.contas_para_filtro($1::jsonb) as r", [
        JSON.stringify({ id: licenca, pagina: 1, por_pagina: 5 }),
      ]),
    );
    return r?.r?.contas?.[0]?.nome ?? null;
  } catch {
    return null;
  }
}

/**
 * Cria (ou reaproveita) a cópia da simulação do Agilliza na conta e grava a marca.
 * Sem conta, devolve `null` sem tocar na ponte.
 */
export async function levarSimulacaoParaContaServidor(
  dep: DependenciasNaConta,
  args: { userId: string; simulacaoId: string; licenca: string | null },
): Promise<ResultadoNaConta | null> {
  if (!args.licenca) return null;
  const nome = await nomeDaConta(dep, args.userId, args.licenca);
  try {
    const r = await dep.comConta(args.userId, args.licenca, (tx) =>
      tx.uma<{ r: { simulacao_id: string; codigo: string; ja_existia: boolean } }>(
        "select plataforma.simulacao_do_agilliza_na_conta($1, $2) as r",
        [args.simulacaoId, args.userId],
      ),
    );
    const copia = r?.r;
    if (!copia?.simulacao_id) throw new Error("A conta não devolveu a simulação.");
    await dep.marcar(args.simulacaoId, {
      conta_assinante_id: args.licenca,
      conta_assinante_simulacao_id: copia.simulacao_id,
      ...(nome ? { conta_assinante_nome: nome } : {}),
    });
    return {
      ok: true,
      mensagem: `Simulação também criada na carteira de ${nome ?? "assinante"} (${copia.codigo}).`,
      conta_nome: nome,
      simulacao_conta_id: copia.simulacao_id,
      codigo: copia.codigo,
    };
  } catch (e) {
    // A marca fica (com a conta escolhida), para "Levar à conta de novo" no detalhe.
    await dep
      .marcar(args.simulacaoId, {
        conta_assinante_id: args.licenca,
        ...(nome ? { conta_assinante_nome: nome } : {}),
      })
      .catch(() => undefined);
    const motivo = e instanceof Error && e.message ? e.message : "a conta não respondeu";
    return {
      ok: false,
      mensagem: `A simulação foi criada na sua base, mas não chegou à conta${nome ? ` de ${nome}` : ""}: ${motivo} Use "Levar à conta de novo" no detalhe.`,
      conta_nome: nome,
    };
  }
}

/** Dados da simulação rápida guardada na conta (a calculadora do Agilliza não grava nada lá). */
export const DADOS_RAPIDA_NA_CONTA = z
  .object({
    valor_imovel: z.number().positive().max(1_000_000_000),
    valor_financiamento: z.number().positive().max(1_000_000_000),
    prazo: z.number().int().min(12).max(420),
    produto: z.enum(["financiamento", "home_equity"]).default("financiamento"),
    sistema: z.enum(["SAC", "PRICE"]).default("SAC"),
    tipo_imovel: z.string().trim().max(4).optional().nullable(),
    uso_imovel: z.string().trim().max(12).optional().nullable(),
    situacao_imovel: z.string().trim().max(12).optional().nullable(),
    uf: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/)
      .optional()
      .nullable(),
    nome: z.string().trim().max(120).optional().nullable(),
    documento: z
      .string()
      .trim()
      .max(20)
      .regex(/^[\d.\-/ ]*$/, "Documento inválido.")
      .optional()
      .nullable(),
    nascimento: z.string().date().optional().nullable(),
    renda: z.number().min(0).max(100_000_000).optional().nullable(),
    resultado: z
      .array(
        z.object({
          banco: z.string().trim().min(1).max(60),
          parcela: z.number().min(0).max(100_000_000),
          ultima_parcela: z.number().min(0).max(100_000_000).optional(),
          taxa_ano: z.number().min(0).max(100).optional(),
          cet_ano: z.number().min(0).max(100).optional(),
          renda_minima: z.number().min(0).max(100_000_000).optional(),
        }),
      )
      .max(20, "No máximo 20 bancos no resultado."),
  })
  .refine((d) => d.valor_financiamento <= d.valor_imovel, {
    message: "O financiamento não pode passar do valor do imóvel.",
    path: ["valor_financiamento"],
  });
export type DadosRapidaNaConta = z.infer<typeof DADOS_RAPIDA_NA_CONTA>;
