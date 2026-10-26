/**
 * Leitura de boleto (FEBRABAN) — sem rede, sem provedor: só aritmética sobre os dígitos.
 *
 * Boleto bancário: código de barras de 44 dígitos ou linha digitável de 47.
 *   - campos 1–3 da linha com dígito verificador módulo 10;
 *   - dígito geral (5ª posição do código de barras) módulo 11;
 *   - fator de vencimento (posições 6–9): dias desde 07/10/1997; ao chegar a 9999
 *     (21/02/2025) recomeça em 1000 no dia 22/02/2025 (regra FEBRABAN). Quando os dois
 *     ciclos são possíveis, vale a data mais próxima da referência;
 *   - valor (posições 10–19), em centavos.
 * Arrecadação (contas de consumo, tributos): começa com 8; código de 44 ou linha de 48
 * (4 blocos de 11 + dígito). O 3º dígito diz o módulo (6/7 → 10; 8/9 → 11) e se o valor
 * é efetivo (6/8: posições 5–15). Vencimento não é padronizado nesse tipo.
 *
 * O resultado é sempre um RASCUNHO para a pessoa conferir — nada aqui salva ou paga.
 */

export type TipoBoleto = "bancario" | "arrecadacao";

export interface AnaliseBoleto {
  valido: boolean;
  tipo: TipoBoleto | null;
  linhaDigitavel: string | null;
  codigoBarras: string | null;
  banco: string | null;
  valor: number | null;
  /** AAAA-MM-DD; null quando o código não traz (fator 0000 ou arrecadação). */
  vencimento: string | null;
  erros: string[];
  avisos: string[];
}

export function somenteDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Módulo 10 (campos da linha e arrecadação 6/7): pesos 2,1 da direita para a esquerda. */
export function modulo10(numero: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    let p = Number(numero[i]) * peso;
    if (p > 9) p = Math.floor(p / 10) + (p % 10);
    soma += p;
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}

function somaModulo11(numero: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += Number(numero[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  return soma % 11;
}

/** Dígito geral do boleto bancário: 11 − resto; 0, 10 e 11 viram 1. */
export function modulo11Bancario(numero: string): number {
  const dv = 11 - somaModulo11(numero);
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

/** Módulo 11 da arrecadação: resto 0 ou 1 → 0; resto 10 → 1; senão 11 − resto. */
export function modulo11Arrecadacao(numero: string): number {
  const resto = somaModulo11(numero);
  if (resto === 0 || resto === 1) return 0;
  if (resto === 10) return 1;
  return 11 - resto;
}

const DIA_MS = 86_400_000;
const BASE_ANTIGA = Date.UTC(1997, 9, 7);
const BASE_NOVA = Date.UTC(2025, 1, 22); // fator 1000 do novo ciclo

function isoUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Data do fator de vencimento, escolhendo o ciclo mais próximo da referência. */
export function vencimentoDoFator(fator: number, referencia: Date = new Date()): string | null {
  if (!Number.isFinite(fator) || fator <= 0) return null;
  const ref = Date.UTC(referencia.getFullYear(), referencia.getMonth(), referencia.getDate());
  const antiga = BASE_ANTIGA + fator * DIA_MS;
  if (fator < 1000) return isoUTC(antiga);
  const nova = BASE_NOVA + (fator - 1000) * DIA_MS;
  return isoUTC(Math.abs(nova - ref) < Math.abs(antiga - ref) ? nova : antiga);
}

/** Linha digitável bancária (47) → código de barras (44). */
function barrasDaLinhaBancaria(l: string): string {
  return l.slice(0, 4) + l.slice(32, 47) + l.slice(4, 9) + l.slice(10, 20) + l.slice(21, 31);
}

/** Código de barras bancário (44) → linha digitável (47), com os DVs dos campos. */
function linhaDasBarrasBancarias(c: string): string {
  const campo1 = c.slice(0, 4) + c.slice(19, 24);
  const campo2 = c.slice(24, 34);
  const campo3 = c.slice(34, 44);
  return (
    campo1 + modulo10(campo1) + campo2 + modulo10(campo2) + campo3 + modulo10(campo3) + c[4] + c.slice(5, 19)
  );
}

function moduloArrecadacao(c: string): ((n: string) => number) | null {
  const id = c[2];
  if (id === "6" || id === "7") return modulo10;
  if (id === "8" || id === "9") return modulo11Arrecadacao;
  return null;
}

function vazia(erros: string[] = [], avisos: string[] = []): AnaliseBoleto {
  return {
    valido: false,
    tipo: null,
    linhaDigitavel: null,
    codigoBarras: null,
    banco: null,
    valor: null,
    vencimento: null,
    erros,
    avisos,
  };
}

function analisarBancario(codigo: string, linha: string, referencia: Date, erros: string[]): AnaliseBoleto {
  const avisos: string[] = [];
  const dvGeral = modulo11Bancario(codigo.slice(0, 4) + codigo.slice(5));
  if (Number(codigo[4]) !== dvGeral) erros.push("O dígito verificador geral não confere (código digitado errado ou adulterado).");
  if (codigo[3] !== "9") avisos.push("Moeda diferente de real (9): confira o boleto.");
  const fator = Number(codigo.slice(5, 9));
  const centavos = Number(codigo.slice(9, 19));
  const vencimento = vencimentoDoFator(fator, referencia);
  if (!vencimento) avisos.push("O código não traz vencimento: confira no documento.");
  if (centavos === 0) avisos.push("O código não traz valor (boleto de valor aberto): informe o valor.");
  return {
    valido: erros.length === 0,
    tipo: "bancario",
    linhaDigitavel: linha,
    codigoBarras: codigo,
    banco: codigo.slice(0, 3),
    valor: centavos > 0 ? centavos / 100 : null,
    vencimento,
    erros,
    avisos,
  };
}

function analisarArrecadacao(codigo: string, linha: string, erros: string[]): AnaliseBoleto {
  const avisos: string[] = ["Conta de arrecadação: o vencimento não vem no código, confira no documento."];
  const mod = moduloArrecadacao(codigo);
  if (!mod) {
    erros.push("Identificador de valor inválido no código de arrecadação.");
    return { ...vazia(erros, avisos), tipo: "arrecadacao", codigoBarras: codigo, linhaDigitavel: linha };
  }
  if (Number(codigo[3]) !== mod(codigo.slice(0, 3) + codigo.slice(4))) {
    erros.push("O dígito verificador geral não confere (código digitado errado ou adulterado).");
  }
  const efetivo = codigo[2] === "6" || codigo[2] === "8";
  const centavos = efetivo ? Number(codigo.slice(4, 15)) : 0;
  if (!efetivo) avisos.push("O código traz quantidade de moeda, não valor: informe o valor.");
  return {
    valido: erros.length === 0,
    tipo: "arrecadacao",
    linhaDigitavel: linha,
    codigoBarras: codigo,
    banco: null,
    valor: centavos > 0 ? centavos / 100 : null,
    vencimento: null,
    erros,
    avisos,
  };
}

/**
 * Analisa linha digitável (47/48) ou código de barras (44), com ou sem pontos e espaços.
 * `referencia` decide o ciclo do fator de vencimento (padrão: hoje).
 */
export function analisarBoleto(entrada: string, referencia: Date = new Date()): AnaliseBoleto {
  const d = somenteDigitos(entrada);
  if (!d) return vazia(["Informe a linha digitável ou o código de barras."]);
  if (d.length === 47) {
    const erros: string[] = [];
    const campos: Array<[number, number, number]> = [
      [0, 9, 9],
      [10, 20, 20],
      [21, 31, 31],
    ];
    campos.forEach(([ini, fim, dv], i) => {
      if (modulo10(d.slice(ini, fim)) !== Number(d[dv])) erros.push(`O dígito do campo ${i + 1} não confere.`);
    });
    return analisarBancario(barrasDaLinhaBancaria(d), d, referencia, erros);
  }
  if (d.length === 48) {
    if (d[0] !== "8") return vazia(["Linha de 48 dígitos é de arrecadação e começa com 8."]);
    const erros: string[] = [];
    const mod = moduloArrecadacao(d);
    let codigo = "";
    for (let b = 0; b < 4; b++) {
      const bloco = d.slice(b * 12, b * 12 + 11);
      const dv = Number(d[b * 12 + 11]);
      if (mod && mod(bloco) !== dv) erros.push(`O dígito do bloco ${b + 1} não confere.`);
      codigo += bloco;
    }
    return analisarArrecadacao(codigo, d, erros);
  }
  if (d.length === 44) {
    if (d[0] === "8") {
      const mod = moduloArrecadacao(d);
      const linha = mod
        ? [0, 1, 2, 3].map((b) => d.slice(b * 11, b * 11 + 11) + mod(d.slice(b * 11, b * 11 + 11))).join("")
        : null;
      return analisarArrecadacao(d, linha ?? d, []);
    }
    return analisarBancario(d, linhaDasBarrasBancarias(d), referencia, []);
  }
  return vazia([
    `Foram lidos ${d.length} dígitos: a linha digitável tem 47 (bancário) ou 48 (arrecadação) e o código de barras, 44.`,
  ]);
}

/** Linha digitável com a pontuação de sempre (para mostrar). */
export function formatarLinhaDigitavel(linha: string | null | undefined): string {
  const d = somenteDigitos(linha);
  if (d.length === 47) {
    return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d[32]} ${d.slice(33)}`;
  }
  if (d.length === 48) {
    return [0, 1, 2, 3].map((b) => `${d.slice(b * 12, b * 12 + 11)}-${d[b * 12 + 11]}`).join(" ");
  }
  return d;
}

/**
 * Procura códigos de boleto num texto (PDF): sequências de dígitos com pontos, espaços e
 * hífens que somem 44, 47 ou 48. Devolve primeiro os válidos.
 */
export function encontrarCodigosNoTexto(texto: string, referencia: Date = new Date()): AnaliseBoleto[] {
  const achados = new Map<string, AnaliseBoleto>();
  const candidatos = texto.match(/\d[\d.\s-]{38,70}\d/g) ?? [];
  for (const bruto of candidatos) {
    const d = somenteDigitos(bruto);
    const tentativas = new Set<string>();
    // só a linha digitável (3–4 dígitos verificadores): 44 dígitos soltos passam no DV geral por acaso (1 em 9)
    for (const tam of [48, 47]) {
      if (d.length === tam) tentativas.add(d);
      // texto colado de PDF às vezes junta números vizinhos: tenta janelas
      if (d.length > tam) for (let i = 0; i + tam <= d.length && i < 8; i++) tentativas.add(d.slice(i, i + tam));
    }
    for (const t of tentativas) {
      if (achados.has(t)) continue;
      const a = analisarBoleto(t, referencia);
      if (a.valido) achados.set(t, a);
    }
  }
  return [...achados.values()];
}

/** CPF/CNPJ formatados que aparecem no texto (só dígitos). */
export function documentosNoTexto(texto: string): string[] {
  const docs = new Set<string>();
  // Só formatados (com pontuação) ou logo depois de "CNPJ/CPF": dígitos soltos da linha digitável não contam.
  for (const m of texto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) ?? []) docs.add(somenteDigitos(m));
  for (const m of texto.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/g) ?? []) docs.add(somenteDigitos(m));
  for (const m of texto.matchAll(/(?:CNPJ|CPF)(?:\/CPF|\/CNPJ)?\s*:?\s*(\d{14}|\d{11})(?!\d)/gi)) docs.add(m[1]);
  return [...docs].filter((d) => d.length === 11 || d.length === 14);
}

export interface DadosDoTexto {
  beneficiario: string | null;
  documento: string | null;
  vencimento: string | null;
  valor: number | null;
}

function valorBR(s: string): number | null {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** Beneficiário, documento, vencimento e valor escritos no boleto (heurística; sempre conferir). */
export function dadosDoTexto(texto: string): DadosDoTexto {
  const t = texto.replace(/\s+/g, " ");
  const benef = t.match(/(?:benefici[aá]rio|cedente)\s*:?\s*([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .&'\/-]{3,80}?)(?=\s+(?:CNPJ|CPF|\d{2}\.\d{3}|ag[eê]ncia|endere|$))/i);
  const venc = t.match(/vencimento\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  const valor = t.match(/valor\s+(?:do\s+)?(?:documento|cobrado|a\s+pagar)?\s*:?\s*(?:R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  const docs = documentosNoTexto(t);
  return {
    beneficiario: benef ? benef[1].trim() : null,
    documento: docs.find((d) => d.length === 14) ?? docs[0] ?? null,
    vencimento: venc ? `${venc[3]}-${venc[2]}-${venc[1]}` : null,
    valor: valor ? valorBR(valor[1]) : null,
  };
}

function normalizarNome(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(ltda|me|epp|eireli|s\/?a|sa|cia|companhia|de|da|do|das|dos|e)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type ConferenciaBeneficiario = "confere" | "diverge" | "sem_dados";

/** Beneficiário do boleto x fornecedor escolhido: documento manda; sem documento, o nome. */
export function conferirBeneficiario(
  boleto: { documento?: string | null; beneficiario?: string | null },
  fornecedor: { documento?: string | null; nome?: string | null } | null,
): ConferenciaBeneficiario {
  if (!fornecedor) return "sem_dados";
  const docB = somenteDigitos(boleto.documento);
  const docF = somenteDigitos(fornecedor.documento);
  if (docB && docF) return docB === docF ? "confere" : "diverge";
  const nb = normalizarNome(boleto.beneficiario ?? "");
  const nf = normalizarNome(fornecedor.nome ?? "");
  if (!nb || !nf) return "sem_dados";
  const pb = new Set(nb.split(" ").filter((p) => p.length >= 3));
  const comuns = nf.split(" ").filter((p) => p.length >= 3 && pb.has(p)).length;
  return comuns > 0 ? "confere" : "diverge";
}

export interface AlertasRascunho {
  vencido: boolean;
  divergencias: string[];
}

/** Alertas do rascunho: vencido e valores do código x valores escritos no documento. */
export function alertasDoRascunho(
  analise: AnaliseBoleto | null,
  texto: DadosDoTexto | null,
  hojeISO: string,
): AlertasRascunho {
  const divergencias: string[] = [];
  const venc = analise?.vencimento ?? texto?.vencimento ?? null;
  if (analise?.valor != null && texto?.valor != null && Math.abs(analise.valor - texto.valor) > 0.009) {
    divergencias.push("O valor do código de barras é diferente do valor escrito no boleto.");
  }
  if (analise?.vencimento && texto?.vencimento && analise.vencimento !== texto.vencimento) {
    divergencias.push("O vencimento do código é diferente do vencimento escrito no boleto.");
  }
  return { vencido: !!venc && venc < hojeISO, divergencias };
}
