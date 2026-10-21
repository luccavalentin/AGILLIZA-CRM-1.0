/**
 * Ações da matriz de permissões que não cabem em `exigirPermissao` (o tipo de lá só
 * aceita view/create/edit/delete/export), como "atribuir", "transferir" e "encerrar".
 * Mesma regra do servidor (`usuario_tem_permissao`: admin/correspondente passam; os
 * demais conforme o nível de acesso). Chamar dentro do handler, antes de gravar.
 */
export async function exigirAcao(
  supabase: any,
  userId: string,
  modulo: string,
  acao: string,
  mensagem = "Você não tem permissão para esta ação.",
): Promise<void> {
  const { data, error } = await supabase.rpc("usuario_tem_permissao", {
    _user_id: userId,
    _modulo: modulo,
    _acao: acao,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error(mensagem);
}

/**
 * Garante que todas as pessoas indicadas são do mesmo correspondente. Necessário quando
 * a gravação usa o cliente administrativo (sem RLS) e recebe ids vindos da tela.
 */
export async function exigirMesmoCorrespondente(
  supabaseAdmin: any,
  corr: string,
  ids: (string | null | undefined)[],
  mensagem = "Há pessoas fora do seu ecossistema.",
): Promise<void> {
  const unicos = [...new Set(ids.filter(Boolean) as string[])];
  if (unicos.length === 0) return;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("id", unicos)
    .eq("correspondente_id", corr);
  if (error) throw new Error(error.message);
  if ((data ?? []).length !== unicos.length) throw new Error(mensagem);
}
