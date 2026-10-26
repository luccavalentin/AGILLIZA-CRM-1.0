/**
 * "ID H." (pedido do dono de 26/10/2026, C33): nas telas de propostas do correspondente o
 * identificador visível é o id da oportunidade na integração bancária, escrito só "ID H. 12345".
 * O número interno (PRO-…) continua no banco e nas buscas, mas não aparece mais. O nome da
 * integração nunca vai para a tela.
 */

type ComIdH = { homefin_id_oportunidade?: string | number | null } | null | undefined;

/** Só o número do ID H. (dígitos), ou `null` quando ainda não existe. */
export function numeroIdH(p: ComIdH | string | number): string | null {
  const bruto = typeof p === "object" && p !== null ? p.homefin_id_oportunidade : p;
  if (bruto === null || bruto === undefined) return null;
  const txt = String(bruto).trim();
  if (!/^\d{1,18}$/.test(txt)) return null;
  if (/^0+$/.test(txt)) return null;
  return txt.replace(/^0+/, "");
}

/** "ID H. 12345" (ou "ID H. —" enquanto a proposta não tem oportunidade na integração). */
export function textoIdH(p: ComIdH | string | number): string {
  const n = numeroIdH(p);
  return n ? `ID H. ${n}` : "ID H. —";
}

/** Para frases ("Proposta ID H. 12345 criada."): sem número, só "Proposta". */
export function propostaComIdH(p: ComIdH | string | number): string {
  const n = numeroIdH(p);
  return n ? `Proposta ID H. ${n}` : "Proposta";
}
