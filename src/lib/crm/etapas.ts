/**
 * Etapas COMERCIAIS da esteira (pré-proposta): movimentação manual liberada.
 * As demais (credito_enviado em diante) são sincronizadas pelos triggers
 * proposta_sincronizar_esteira / simulacao_sincronizar_esteira — quem move é a
 * proposta. Regra única para o painel do CRM, a ficha do cliente e o servidor.
 */
export const ETAPAS_COMERCIAIS = new Set(["cadastro_basico", "cadastro_completo", "simulacao"]);

export const etapaEhComercial = (codigo: string) => ETAPAS_COMERCIAIS.has(codigo);

export const MSG_ETAPA_SINCRONIZADA =
  "Esta etapa é atualizada automaticamente pela proposta. Movimente pelo kanban de propostas.";
