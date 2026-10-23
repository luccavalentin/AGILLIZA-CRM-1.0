/**
 * Desconto na licença (0254): o que a tela digita vira o que o servidor recebe. Funções puras,
 * testadas em desconto-licenca.test.ts. As regras de verdade (até 100%, duas casas, 1 a 120
 * faturas) também estão no servidor (zod) e no banco.
 */
import { formatBRL } from "@/lib/financeiro/format";
import type { DescontoNovo } from "@/lib/plataforma/licencas.functions";

export type Duracao = "primeira" | "proximas" | "sempre";

export interface EstadoDesconto {
  tipo: "percentual" | "valor";
  valor: string;
  duracao: Duracao;
  faturas: string;
}

export const DESCONTO_INICIAL: EstadoDesconto = {
  tipo: "percentual",
  valor: "",
  duracao: "primeira",
  faturas: "3",
};

/**
 * "12,5", "12.5", "1.250,00" → número; até duas casas. Vazio, letra ou três casas → NaN
 * (o "1.250" sem vírgula é ambíguo e cai aqui: a pessoa vê o aviso e corrige).
 */
function numero(v: string) {
  let t = v.trim();
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return Number.NaN;
  return Number(t);
}

/** O que vai para o servidor, ou null quando o formulário ainda não está certo. */
export function paraDesconto(e: EstadoDesconto): DescontoNovo | null {
  const valor = numero(e.valor);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  if (e.tipo === "percentual" && valor > 100) return null;
  if (e.tipo === "valor" && valor > 1_000_000) return null;
  const faturas = e.duracao === "primeira" ? 1 : e.duracao === "sempre" ? null : Number(e.faturas);
  if (faturas !== null && (!Number.isInteger(faturas) || faturas < 1 || faturas > 120)) return null;
  return { tipo: e.tipo, valor, faturas };
}

/** Frase do que a pessoa vai ganhar, para conferir antes de gravar. */
export function resumoDesconto(d: DescontoNovo | null): string | null {
  if (!d) return null;
  const quanto =
    d.tipo === "percentual"
      ? `${String(d.valor).replace(".", ",")}% de desconto`
      : `${formatBRL(d.valor)} de desconto`;
  if (d.faturas === null) return `${quanto} em todas as faturas, até alguém encerrar.`;
  if (d.faturas === 1) return `${quanto} na próxima fatura paga.`;
  return `${quanto} em cada uma das próximas ${d.faturas} faturas pagas.`;
}
