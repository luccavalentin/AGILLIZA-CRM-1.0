/**
 * "Onde simular" (C29, 26/10/2026): Sua base (padrão) ou a conta de um assinante.
 *
 * A tela escolhe o destino (vindo da URL `?conta=`) e o fluxo de envio da simulação completa
 * (`use-simulacao-completa/envio.ts`) lê daqui na hora de criar — sem passar o valor por todas
 * as camadas do formulário. O servidor confere a permissão e o uuid de novo: isto só leva a escolha.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ContaDestino {
  id: string;
  nome: string;
  tipo?: string | null;
}

/** Uuid de conta saneado (minúsculo) ou `null` para qualquer valor torto. */
export function normalizarContaId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return UUID.test(t) ? t.toLowerCase() : null;
}

let atual: ContaDestino | null = null;
const ouvintes = new Set<(c: ContaDestino | null) => void>();

/** Define o destino (ou volta para Sua base com `null`). Destino torto vira Sua base. */
export function definirContaDestino(c: ContaDestino | null): void {
  const id = c ? normalizarContaId(c.id) : null;
  const novo = id && c ? { id, nome: (c.nome ?? "").trim() || "Assinante", tipo: c.tipo ?? null } : null;
  if (novo?.id === atual?.id && novo?.nome === atual?.nome) return;
  atual = novo;
  for (const o of ouvintes) o(atual);
}

export function contaDestinoAtual(): ContaDestino | null {
  return atual;
}

export function assinarContaDestino(fn: (c: ContaDestino | null) => void): () => void {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
}

/**
 * Dados de `criarSimulacao` com o destino escolhido. Sem destino, devolve os MESMOS dados
 * (nenhuma chave nova): a simulação na sua base continua idêntica.
 */
export function comContaDestino<T extends Record<string, unknown>>(
  dados: T,
  conta: ContaDestino | null = atual,
): T & { conta_assinante_id?: string } {
  const id = conta ? normalizarContaId(conta.id) : null;
  if (!id) return dados;
  return { ...dados, conta_assinante_id: id };
}
