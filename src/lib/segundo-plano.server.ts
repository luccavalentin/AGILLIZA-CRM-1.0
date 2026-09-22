import { AsyncLocalStorage } from "node:async_hooks";

type ContextoRequisicao = { waitUntil?: (p: Promise<unknown>) => void };

const contexto = new AsyncLocalStorage<ContextoRequisicao>();

/**
 * Guarda o `waitUntil` do Worker para que tarefas da requisição sobrevivam à
 * resposta. O Nitro chama a entrada só com a Request e pendura o `waitUntil`
 * nela (`req.waitUntil`); o `ctx` fica como segunda opção.
 */
export function comContextoDaRequisicao<T>(request: unknown, ctx: unknown, fn: () => T): T {
  const r = request as { waitUntil?: (p: Promise<unknown>) => void } | null;
  const c = ctx as { waitUntil?: (p: Promise<unknown>) => void } | null;
  const waitUntil =
    typeof r?.waitUntil === "function"
      ? r.waitUntil.bind(r)
      : typeof c?.waitUntil === "function"
        ? c.waitUntil.bind(c)
        : undefined;
  return contexto.run({ waitUntil }, fn);
}

/**
 * Roda a tarefa sem segurar a resposta. No Worker, `waitUntil` mantém a
 * execução viva por até ~30 s depois da resposta; sem ele (dev), a tarefa
 * segue solta no processo.
 */
export function emSegundoPlano(rotulo: string, tarefa: () => Promise<unknown>): void {
  const p = tarefa().catch((e) => console.error(`[segundo-plano] ${rotulo}`, e));
  const waitUntil = contexto.getStore()?.waitUntil;
  if (waitUntil) waitUntil(p);
}
