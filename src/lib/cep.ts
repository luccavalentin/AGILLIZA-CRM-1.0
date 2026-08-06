/**
 * Utilitários compartilhados de CEP: máscara e consulta automática de endereço.
 * Usado por todos os campos de CEP do sistema para garantir validação e
 * preenchimento automático consistentes (ViaCEP).
 */

export interface EnderecoCep {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

/** Mantém apenas os 8 dígitos do CEP. */
export function apenasDigitosCep(raw: string): string {
  return (raw ?? "").replace(/\D/g, "").slice(0, 8);
}

/** Aplica a máscara 00000-000. */
export function mascararCep(raw: string): string {
  const d = apenasDigitosCep(raw);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** Valida se o CEP possui 8 dígitos. */
export function cepValido(raw: string): boolean {
  return apenasDigitosCep(raw).length === 8;
}

/**
 * Consulta o endereço pelo CEP (ViaCEP). Retorna o endereço normalizado,
 * `null` quando o CEP não existe, ou lança em falha de rede.
 */
export async function consultarCep(raw: string): Promise<EnderecoCep | null> {
  const cep = apenasDigitosCep(raw);
  if (cep.length !== 8) return null;
  const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  const dados = await resp.json();
  if (dados?.erro) return null;
  return {
    logradouro: dados.logradouro ?? "",
    bairro: dados.bairro ?? "",
    cidade: dados.localidade ?? "",
    uf: dados.uf ?? "",
  };
}
