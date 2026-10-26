/**
 * Permissão do RH conferida no servidor (a mesma regra do banco: `usuario_tem_permissao`,
 * admin/correspondente passam). As server functions usam `exigirPermissao` na entrada;
 * isto serve para as decisões finas dentro delas (ex.: mandar o salário só a quem vê).
 */
export async function pode(supabase: any, userId: string, modulo: string, acao: string): Promise<boolean> {
  const { data } = await supabase.rpc("usuario_tem_permissao", {
    _user_id: userId,
    _modulo: modulo,
    _acao: acao,
  });
  return Boolean(data);
}

export async function exigir(supabase: any, userId: string, modulo: string, acao: string, mensagem: string) {
  if (!(await pode(supabase, userId, modulo, acao))) throw new Error(mensagem);
}

/** Colunas sensíveis de `rh_funcionarios` (fora do SELECT direto; ver `rh_dados_sensiveis`). */
export const CAMPOS_SENSIVEIS = [
  "salario_atual",
  "salario_desde",
  "banco_nome",
  "banco_agencia",
  "banco_conta",
  "banco_tipo_conta",
  "banco_pix",
] as const;

export type CampoSensivel = (typeof CAMPOS_SENSIVEIS)[number];

export interface DadosSensiveis {
  funcionario_id: string;
  salario_atual: number;
  salario_desde: string | null;
  banco_nome: string | null;
  banco_agencia: string | null;
  banco_conta: string | null;
  banco_tipo_conta: string | null;
  banco_pix: string | null;
}

/** Salário e banco pela função do banco (recusa sem `rh.salarios:view`). */
export async function dadosSensiveis(supabase: any, ids: string[]): Promise<Map<string, DadosSensiveis>> {
  const mapa = new Map<string, DadosSensiveis>();
  if (ids.length === 0) return mapa;
  for (let i = 0; i < ids.length; i += 1000) {
    const { data, error } = await supabase.rpc("rh_dados_sensiveis", { p_ids: ids.slice(i, i + 1000) });
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as any[]) {
      mapa.set(r.funcionario_id, { ...r, salario_atual: Number(r.salario_atual ?? 0) });
    }
  }
  return mapa;
}

export const SEM_EMPRESA =
  "Seu usuário não está vinculado a uma empresa. Peça ao administrador para revisar o cadastro.";

export async function correspondenteId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  const cid = data?.correspondente_id as string | undefined;
  if (!cid) throw new Error(SEM_EMPRESA);
  return cid;
}
