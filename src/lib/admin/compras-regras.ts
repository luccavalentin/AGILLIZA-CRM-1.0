/**
 * Regras puras dos pedidos de compra (Diversos > Pedidos e Aprovação de compras, C67).
 * Validação usada no servidor (compras.functions.ts) e na tela, testada em
 * compras-regras.test.ts.
 */
import { z } from "zod";

/**
 * Valor digitado → número. "1.500,50" (pt-BR) e "1500.5" (o valor vindo do banco, na
 * edição) dão o mesmo; texto que não é número dá NaN — e o botão não envia.
 */
export function lerValor(v: string): number {
  const t = v.trim().replace(/^R\$\s*/i, "");
  if (!t) return NaN;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return /^\d+(\.\d{1,2})?$/.test(normal) ? Number(normal) : NaN;
}

/** Teto de sanidade de um pedido (evita "1500000000" digitado por engano virar pedido). */
export const VALOR_MAXIMO_PEDIDO = 10_000_000;

export const esquemaPedido = z.object({
  descricao: z
    .string()
    .trim()
    .min(3, "Descreva o que precisa ser comprado.")
    .max(500, "Descrição longa demais (até 500 caracteres)."),
  valor: z
    .number()
    .finite("Valor inválido.")
    .positive("Informe um valor maior que zero.")
    .max(VALOR_MAXIMO_PEDIDO, "Valor acima do permitido para um pedido."),
  categoria: z.string().trim().max(60, "Categoria longa demais.").optional().nullable(),
});

/**
 * Decisão: aprovar com observação opcional; RECUSAR exige o motivo (pelo menos 5
 * caracteres), que fica no histórico do pedido e o solicitante vê.
 */
export const esquemaDecisao = z
  .object({
    id: z.string().uuid(),
    aprovar: z.boolean(),
    observacao: z.string().trim().max(500, "Motivo longo demais.").optional().nullable(),
  })
  .refine((d) => d.aprovar || (d.observacao ?? "").trim().length >= 5, {
    message: "Escreva o motivo da recusa (pelo menos 5 caracteres).",
    path: ["observacao"],
  });

export type StatusCompra = "pendente" | "aprovada" | "recusada";

export const ROTULO_STATUS: Record<StatusCompra, string> = {
  pendente: "Aguardando aprovação",
  aprovada: "Aprovado",
  recusada: "Recusado",
};

/** Resumo de uma lista de pedidos (quantidade e valor por situação). */
export function resumoCompras(lista: { status: string; valor: number }[]) {
  const r = {
    total: lista.length,
    pendentes: 0,
    valorPendente: 0,
    aprovadas: 0,
    valorAprovado: 0,
    recusadas: 0,
  };
  for (const c of lista) {
    const v = Number(c.valor) || 0;
    if (c.status === "pendente") {
      r.pendentes += 1;
      r.valorPendente += v;
    } else if (c.status === "aprovada") {
      r.aprovadas += 1;
      r.valorAprovado += v;
    } else if (c.status === "recusada") r.recusadas += 1;
  }
  return r;
}
