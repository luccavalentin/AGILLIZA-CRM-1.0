/**
 * Chamadas do navegador ao financeiro da matriz (porta única `matriz.functions`).
 * As telas usam estas funções dentro do react-query; a chave de cache é sempre
 * ["financeiro", ...] para uma única invalidação depois de qualquer gravação.
 */
import type { QueryClient } from "@tanstack/react-query";
import {
  consultarFinanceiro,
  executarFinanceiro,
  type AvisoFinanceiro,
  type ConsultaFinanceiro,
  type ExecucaoFinanceiro,
  type RespostaExecucao,
} from "./matriz.functions";

export type { AvisoFinanceiro, RespostaExecucao };

export async function consultar<T>(acao: ConsultaFinanceiro, args: Record<string, unknown> = {}): Promise<T> {
  return (await consultarFinanceiro({ data: { acao, args } })) as unknown as T;
}

export async function executar<T = unknown>(
  acao: ExecucaoFinanceiro,
  args: Record<string, unknown> = {},
): Promise<RespostaExecucao<T>> {
  return (await executarFinanceiro({ data: { acao, args } })) as unknown as RespostaExecucao<T>;
}

/** Igual a `executar`, mas aviso de regra vira erro (para ações que não pedem confirmação). */
export async function executarOuFalhar<T = unknown>(acao: ExecucaoFinanceiro, args: Record<string, unknown> = {}): Promise<T> {
  const r = await executar<T>(acao, args);
  if (!r.ok) throw new Error(r.mensagem);
  return r.dados;
}

export function invalidarFinanceiro(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["financeiro"] });
}

/** Primeiro e último dia do mês corrente (AAAA-MM-DD). */
export function mesAtual(base = new Date()): { de: string; ate: string } {
  const de = new Date(base.getFullYear(), base.getMonth(), 1);
  const ate = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { de: iso(de), ate: iso(ate) };
}

export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  return isoLocal(new Date(a, m - 1, d + dias));
}
