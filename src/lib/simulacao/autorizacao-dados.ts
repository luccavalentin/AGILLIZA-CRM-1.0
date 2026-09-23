/**
 * Aceite de consulta de dados (`fgAutorizacaoDados`) dos participantes.
 *
 * O contrato da HomeFin exige o campo como booleano — não exige que seja
 * `true`. O único casal que o Itaú aprovou (oportunidade 0000032828) foi com
 * `false` nos dois proponentes; todos os nossos, recusados, iam com `true`.
 * Por isso o padrão passou a ser `false` para todo participante.
 *
 * `HOMEFIN_FG_AUTORIZACAO=true` volta a mandar o que está no cadastro.
 */
export function fgAutorizacaoDadosParticipante(doCadastro?: boolean | null): boolean {
  if (process.env.HOMEFIN_FG_AUTORIZACAO === "true") return doCadastro === true;
  return false;
}
