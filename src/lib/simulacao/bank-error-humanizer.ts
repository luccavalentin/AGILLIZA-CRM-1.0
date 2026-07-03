/**
 * Traduz códigos/mensagens de erro do provedor de integração bancária
 * para mensagens em português amigáveis ao usuário.
 * Módulo puro — pode ser importado no cliente e no servidor.
 */
const MAPA: Record<string, string> = {
  RENDA_INSUFICIENTE: "Renda declarada insuficiente para o valor solicitado.",
  DOC_INVALIDO: "Documento do cliente inválido ou não reconhecido pelo banco.",
  LIMITE_EXCEDIDO: "Valor de financiamento acima do limite do banco.",
  IDADE_MAX_EXCEDIDA: "Idade do cliente excede o limite permitido pelo banco no fim do contrato.",
  PRAZO_INVALIDO: "Prazo solicitado fora da faixa aceita pelo banco.",
  IMOVEL_NAO_ELEGIVEL: "Tipo ou situação do imóvel não é elegível para este banco.",
  UF_NAO_ATENDIDA: "O banco não atende financiamentos nesta UF.",
  TIMEOUT: "O banco não respondeu no tempo esperado. Tente reenviar.",
};

export function humanizarErroBanco(codigo?: string | null, mensagem?: string | null): string {
  if (codigo && MAPA[codigo]) return MAPA[codigo];
  if (mensagem && mensagem.trim().length > 0) return mensagem.trim();
  return "Não foi possível concluir a simulação neste banco.";
}
