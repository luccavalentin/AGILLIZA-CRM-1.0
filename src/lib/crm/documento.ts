/** Utilitários de documento (CPF/CNPJ) e mascaramento de PII — client-safe. */

/** Remove tudo que não for dígito. */
export function soDigitos(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

/** Valida CPF (11 dígitos) com dígitos verificadores. */
export function validarCPF(cpf: string): boolean {
  const d = soDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (fatorInicial: number) => {
    let soma = 0;
    for (let i = 0; i < fatorInicial - 1; i++) {
      soma += parseInt(d[i], 10) * (fatorInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calc(10) === parseInt(d[9], 10) && calc(11) === parseInt(d[10], 10);
}

/** Valida CNPJ (14 dígitos). */
export function validarCNPJ(cnpj: string): boolean {
  const d = soDigitos(cnpj);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (tamanho: number) => {
    const nums = d.substring(0, tamanho);
    const pesos =
      tamanho === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += parseInt(nums[i], 10) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calc(12) === parseInt(d[12], 10) && calc(13) === parseInt(d[13], 10);
}

/** Valida documento conforme tipo de pessoa. */
export function validarDocumento(doc: string, tipo: "PF" | "PJ"): boolean {
  return tipo === "PF" ? validarCPF(doc) : validarCNPJ(doc);
}

/** Formata documento para exibição (CPF ou CNPJ). */
export function formatarDocumento(doc: string): string {
  const d = soDigitos(doc);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return d;
}

/** Mascara documento para quem não tem permissão pii:view. */
export function mascararDocumento(doc: string): string {
  const d = soDigitos(doc);
  if (d.length === 11) return `***.***.${d.slice(6, 9)}-**`;
  if (d.length === 14) return `**.***.***/${d.slice(8, 12)}-**`;
  return "***";
}

/** Formata celular BR. */
export function formatarCelular(v: string): string {
  const d = soDigitos(v);
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return v ?? "";
}

/** Máscara progressiva de telefone/celular BR enquanto digita (até 11 dígitos). */
export function mascararTelefone(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Valida celular/telefone BR: DDD válido (11-99) + 10 (fixo) ou 11 (celular)
 * dígitos. Para celular (11 dígitos), o nono dígito deve ser 9.
 */
export function validarTelefone(v: string): boolean {
  const d = soDigitos(v);
  if (d.length !== 10 && d.length !== 11) return false;
  const ddd = parseInt(d.slice(0, 2), 10);
  if (ddd < 11) return false;
  if (d.length === 11 && d[2] !== "9") return false;
  return true;
}

/** Valida e-mail com formato padrão. */
export function validarEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v ?? "").trim());
}

/** Máscara progressiva de CPF (000.000.000-00). */
export function mascararCPF(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Máscara progressiva de CNPJ (00.000.000/0000-00). */
export function mascararCNPJ(v: string): string {
  const d = soDigitos(v).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Aplica a máscara de documento conforme o tipo de pessoa. */
export function mascararDocumentoTipo(v: string, tipo: "PF" | "PJ"): string {
  return tipo === "PF" ? mascararCPF(v) : mascararCNPJ(v);
}
