/**
 * Filtros da listagem de propostas (parte pura, para teste).
 *
 * A busca vale para número da proposta, número do banco, nome do cliente e
 * CPF/CNPJ. O CPF só entra quando o termo tem dígito: `cpf_cnpj.ilike.%%`
 * casava com todas as linhas, e procurar por nome devolvia a lista inteira.
 */
export function clausulasDeBusca(termo: string): string[] {
  const q = String(termo ?? "").trim();
  if (!q) return [];
  const clausulas = [
    `numero_proposta.ilike.%${q}%`,
    `numero_proposta_banco.ilike.%${q}%`,
    `nome_cliente.ilike.%${q}%`,
  ];
  const digitos = q.replace(/\D/g, "");
  if (digitos) clausulas.push(`cpf_cnpj.ilike.%${digitos}%`);
  return clausulas;
}
