/**
 * Banco único na VPS: o app e o Supabase rodam na mesma máquina.
 *
 * O cliente do servidor continua montado com SUPABASE_URL (o endereço público), para
 * que os links assinados de arquivo que ele gera saiam válidos para o navegador. Só o
 * tráfego muda de caminho: com SUPABASE_URL_INTERNA definido, a chamada vai pela rede
 * interna em vez de sair para a internet e voltar. Sem a variável, nada muda.
 */
export function paraRedeInterna(input: RequestInfo | URL): RequestInfo | URL {
  const publica = process.env.SUPABASE_URL;
  const interna = process.env.SUPABASE_URL_INTERNA;
  if (!publica || !interna) return input;

  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith(publica)) return input;

  const destino = interna + url.slice(publica.length);
  return typeof input === "string" || input instanceof URL ? destino : new Request(destino, input);
}
