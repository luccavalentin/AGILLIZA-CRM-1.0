/**
 * Download da matrícula pronta pelo portal do assinante — SÓ SERVIDOR.
 *
 * O Agilliza Tech emite um vale de uso único (2 min) para o pedido da conta, depois de
 * conferir quem pediu (`operacional.baixar_matricula`, 0323). Aqui o vale é trocado — uma vez
 * só — pelo caminho do arquivo, e a pessoa vai para uma URL assinada de 60 s do bucket
 * privado `matriculas`. Vale inválido, vencido ou já usado: 404, sem dizer qual.
 */
export function valeValido(vale: string): boolean {
  return /^[0-9a-f]{48}$/.test(vale);
}

export async function baixarMatriculaPorVale(vale: string): Promise<Response> {
  const negado = () =>
    new Response("Endereço vencido ou inválido. Volte ao portal e clique em Baixar de novo.", {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  if (!valeValido(vale)) return negado();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).rpc("matricula_resgatar_download", { p_token: vale });
  const linha = (Array.isArray(data) ? data[0] : null) as { caminho: string; nome: string } | null;
  if (error || !linha?.caminho) return negado();
  const { data: assinada, error: e2 } = await supabaseAdmin.storage
    .from("matriculas")
    .createSignedUrl(linha.caminho, 60, { download: linha.nome });
  if (e2 || !assinada?.signedUrl) return negado();
  return new Response(null, {
    status: 302,
    headers: { location: assinada.signedUrl, "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}
