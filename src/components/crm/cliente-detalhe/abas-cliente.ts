/**
 * Seções (abas) da ficha do cliente, na ordem pedida pelo dono em 26/10/2026 (item C09):
 * Vínculo de atendimento, Dados do comprador, Dados do vendedor, Imóvel, IQ, Documentos,
 * Negócios, Demandas & Tarefas, Histórico e, por último, o Resumo.
 *
 * - A ficha abre em "Vínculo de atendimento".
 * - "App cliente" virou o interruptor do cabeçalho (C10) e "Registro de interações" saiu
 *   (C11): links antigos com essas abas abrem a aba padrão.
 *
 * Só dados (sem ícones nem React) para o teste conferir a ordem sem montar a tela.
 */
export const ABAS_CLIENTE = [
  { v: "vinculo", label: "Vínculo de atendimento" },
  { v: "dados", label: "Dados do comprador" },
  { v: "vendedores", label: "Dados do vendedor" },
  { v: "imovel", label: "Imóvel" },
  { v: "iq", label: "IQ" },
  { v: "documentos", label: "Documentos" },
  { v: "negocios", label: "Negócios" },
  { v: "atividades", label: "Demandas & Tarefas" },
  { v: "historico", label: "Histórico" },
  { v: "resumo", label: "Resumo" },
] as const;

export type AbaCliente = (typeof ABAS_CLIENTE)[number]["v"];

export const ABA_CLIENTE_PADRAO: AbaCliente = "vinculo";

/** Nomes antigos (ou de outra tela) que ainda chegam por link e o destino de cada um. */
const ABAS_ANTIGAS: Record<string, AbaCliente> = {
  comprador: "dados",
  vendedor: "vendedores",
  "dados-vendedor": "vendedores",
  demandas: "atividades",
  tarefas: "atividades",
};

const VALIDAS = new Set<string>(ABAS_CLIENTE.map((a) => a.v));

/**
 * Aba a abrir a partir do que veio na URL. Qualquer coisa desconhecida, removida
 * ("mensagens"/"app", "interacoes") ou torta cai na aba padrão, nunca numa tela vazia.
 */
export function abaClienteInicial(pedida: unknown): AbaCliente {
  if (typeof pedida !== "string") return ABA_CLIENTE_PADRAO;
  const chave = pedida.trim().toLowerCase();
  if (VALIDAS.has(chave)) return chave as AbaCliente;
  // `hasOwn`: "constructor"/"toString" na URL não podem cair no protótipo do objeto.
  return Object.hasOwn(ABAS_ANTIGAS, chave) ? ABAS_ANTIGAS[chave]! : ABA_CLIENTE_PADRAO;
}
