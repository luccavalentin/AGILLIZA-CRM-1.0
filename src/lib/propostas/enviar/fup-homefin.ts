/**
 * FUP da oportunidade na HomeFin (`GET /fup/list?idOportunidade=`). É por ele
 * que chegam os retornos escritos do banco e da HomeFin — "Laudo Solicitado",
 * pendência de engenharia, recado do analista —, que as atividades da
 * oportunidade não trazem.
 */

export type FupHomefin = {
  idFupOportunidade?: number;
  tipoFup?: string;
  titulo?: string | null;
  comentario?: string | null;
  dataHoraCriacao?: string | null;
};

export type FollowupGravado = {
  tipo: string;
  titulo: string | null;
  comentario: string | null;
  created_at: string;
};

export type FupNovo = { titulo: string; comentario: string; created_at: string };

const texto = (v: unknown) => String(v ?? "").trim();

/**
 * FUPs da lista que ainda não estão na proposta. O que saiu do próprio CRM
 * (enviado à integração) volta na lista e não se repete: basta o mesmo título
 * e texto. O que já veio da HomeFin compara também a data, para um recado
 * repetido em outro dia entrar de novo.
 */
export function fupsNovos(lista: FupHomefin[], atuais: FollowupGravado[]): FupNovo[] {
  const nossos = new Set(
    atuais.filter((a) => a.tipo !== "homefin_fup").map((a) => `${texto(a.titulo)}|${texto(a.comentario)}`),
  );
  const importados = new Set(
    atuais
      .filter((a) => a.tipo === "homefin_fup")
      .map((a) => `${texto(a.titulo)}|${texto(a.comentario)}|${new Date(a.created_at).getTime()}`),
  );
  const vistos = new Set<string>();
  const novos: FupNovo[] = [];
  for (const f of Array.isArray(lista) ? lista : []) {
    const titulo = texto(f?.titulo);
    const comentario = texto(f?.comentario);
    if (!titulo && !comentario) continue;
    const d = f?.dataHoraCriacao ? new Date(f.dataHoraCriacao) : null;
    if (!d || Number.isNaN(d.getTime())) continue;
    const chave = `${titulo}|${comentario}|${d.getTime()}`;
    if (nossos.has(`${titulo}|${comentario}`) || importados.has(chave) || vistos.has(chave)) continue;
    vistos.add(chave);
    novos.push({ titulo, comentario: comentario || titulo, created_at: d.toISOString() });
  }
  return novos.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
}
