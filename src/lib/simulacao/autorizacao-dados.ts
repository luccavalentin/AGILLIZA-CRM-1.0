/**
 * Aceite de consulta de dados (`fgAutorizacaoDados`) dos participantes.
 *
 * Vai `true` para todo participante, por decisão do Lucca em 23/09/2026. Antes
 * ia `false`: o único casal que o Itaú aprovou (oportunidade 0000032828) tinha
 * `false` nos dois proponentes, e os recusados iam com `true` — coincidência
 * que não se confirmou.
 */
export function fgAutorizacaoDadosParticipante(): boolean {
  return true;
}
