import type { ProvedorBureau } from "../tipos";

/**
 * Adaptadores implementados.
 *
 * Vazio de propósito: nenhum contrato de bureau foi fechado ainda. Quando
 * houver, o adaptador do fornecedor entra aqui e o resto do módulo — tela,
 * histórico, auditoria, permissões — já está pronto e não muda.
 *
 * Deliberadamente NÃO existe um adaptador de demonstração com dados
 * inventados: ficha de crédito falsa levaria alguém a negar ou aprovar
 * crédito para uma pessoa real com base em restrição que não existe.
 */
const ADAPTADORES: Record<string, ProvedorBureau> = {};

export function adaptadorDe(chave: string): ProvedorBureau | null {
  return ADAPTADORES[chave] ?? null;
}
