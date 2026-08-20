/**
 * Rótulos legíveis dos campos da simulação completa.
 * Usado para dizer ao usuário EXATAMENTE qual campo falta preencher,
 * em vez da mensagem genérica "preencha os campos com asterisco".
 */
export const ROTULOS_CAMPOS_SIMULACAO: Record<string, string> = {
  nome_cliente: "Nome do proponente",
  cpf_cliente: "CPF do proponente",
  cpf: "CPF do proponente",
  data_nascimento: "Data de nascimento do proponente",
  email: "E-mail do proponente",
  sexo: "Sexo do proponente",
  sexo_conjuge: "Sexo do cônjuge",
  telefone: "Telefone do proponente",
  celular: "Celular do proponente",
  estado_civil: "Estado civil",
  regime_casamento: "Regime de casamento",
  renda_total: "Renda do proponente (SAC)",
  renda_price: "Renda do proponente (PRICE)",
  profissao: "Profissão",
  nome_conjuge: "Nome do cônjuge",
  cpf_conjuge: "CPF do cônjuge",
  data_nascimento_conjuge: "Data de nascimento do cônjuge",
  renda_conjuge: "Renda do cônjuge",
  produto: "Produto",
  tipo_imovel: "Tipo do imóvel",
  finalidade: "Finalidade",
  valor_imovel: "Valor do imóvel",
  valor_financiamento: "Valor do financiamento",
  valor_entrada: "Valor de entrada",
  prazo: "Prazo (meses)",
  sistema_amortizacao: "Sistema de amortização",
  cep_imovel: "CEP do imóvel",
  cidade_imovel: "Cidade do imóvel",
  uf_imovel: "UF do imóvel",
  bancos_ids: "Bancos",
  bancos_sac_ids: "Bancos — SAC",
  bancos_price_ids: "Bancos — PRICE",
  consentimento_lgpd: "Consentimento LGPD",
  consentimento_consulta: "Autorização de consulta",
};

export function rotuloCampoSimulacao(chave: string): string {
  return (
    ROTULOS_CAMPOS_SIMULACAO[chave] ??
    chave.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/**
 * Monta a mensagem de erro nomeando exatamente os campos pendentes.
 */
export function mensagemCamposPendentes(chaves: string[]): string {
  const nomes = Array.from(new Set(chaves.map(rotuloCampoSimulacao)));
  if (nomes.length === 0) return "Revise os campos destacados.";
  if (nomes.length === 1) return `Falta preencher: ${nomes[0]}.`;
  const mostrados = nomes.slice(0, 6);
  const resto = nomes.length - mostrados.length;
  return `Faltam preencher: ${mostrados.join(", ")}${resto > 0 ? ` e mais ${resto}` : ""}.`;
}
