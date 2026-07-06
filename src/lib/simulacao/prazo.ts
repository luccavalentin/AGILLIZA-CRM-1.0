/**
 * Regras de prazo do financiamento habitacional (vigentes em 2026).
 *
 * Regra de idade (SFH/SBPE): a soma da idade do proponente mais o prazo do
 * financiamento não pode ultrapassar 80 anos e 6 meses (966 meses) ao término
 * do contrato. Além disso, o prazo máximo de contrato é de 420 meses (35 anos)
 * e o mínimo é de 60 meses (5 anos).
 */

export const PRAZO_MIN = 60;
export const PRAZO_MAX = 420;

/** Idade máxima permitida ao término do contrato: 80 anos e 6 meses. */
export const IDADE_MAX_TERMINO_MESES = 80 * 12 + 6; // 966

/** Calcula a idade atual (em meses) a partir da data de nascimento (YYYY-MM-DD). */
export function idadeEmMeses(dataNascimento: string, hoje: Date = new Date()): number | null {
  if (!dataNascimento) return null;
  const nasc = new Date(dataNascimento + (dataNascimento.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(nasc.getTime())) return null;
  let meses = (hoje.getFullYear() - nasc.getFullYear()) * 12 + (hoje.getMonth() - nasc.getMonth());
  if (hoje.getDate() < nasc.getDate()) meses -= 1;
  return Math.max(0, meses);
}

/**
 * Prazo máximo permitido (em meses) para a idade informada, respeitando o teto
 * de 966 meses ao término e o limite absoluto de 420 meses. Retorna `null`
 * quando não há data de nascimento válida (sem restrição por idade).
 */
export function prazoMaximoPorIdade(dataNascimento: string, hoje: Date = new Date()): number | null {
  const idade = idadeEmMeses(dataNascimento, hoje);
  if (idade == null) return null;
  const porIdade = IDADE_MAX_TERMINO_MESES - idade;
  return Math.max(0, Math.min(PRAZO_MAX, porIdade));
}

/** Formata meses como "X anos" ou "X anos e Y meses". */
export function formatarMeses(meses: number): string {
  const anos = Math.floor(meses / 12);
  const rest = meses % 12;
  if (rest === 0) return `${anos} ${anos === 1 ? "ano" : "anos"}`;
  return `${anos} ${anos === 1 ? "ano" : "anos"} e ${rest} ${rest === 1 ? "mês" : "meses"}`;
}

export interface AjustePrazo {
  prazo: number;
  ajustado: boolean;
  mensagem?: string;
  maximoPermitido: number;
}

/**
 * Valida e, se necessário, ajusta o prazo digitado conforme a regra de idade.
 * Quando o prazo excede o máximo permitido para a idade, retorna o valor
 * ajustado e uma mensagem personalizada.
 */
export function ajustarPrazoPorIdade(prazo: number, dataNascimento: string): AjustePrazo {
  const maxIdade = prazoMaximoPorIdade(dataNascimento);
  const maximoPermitido = maxIdade == null ? PRAZO_MAX : maxIdade;

  if (prazo > maximoPermitido) {
    return {
      prazo: maximoPermitido,
      ajustado: true,
      maximoPermitido,
      mensagem:
        maxIdade == null
          ? `Você digitou ${prazo} meses, mas o máximo permitido é ${PRAZO_MAX} meses (${formatarMeses(PRAZO_MAX)}). Ajustamos o campo automaticamente.`
          : `Você digitou ${prazo} meses, mas o máximo permitido para essa idade é ${maximoPermitido} ${
              maximoPermitido === 1 ? "mês" : "meses"
            } (${formatarMeses(
              maximoPermitido,
            )}), pois a soma da idade com o prazo não pode ultrapassar 80 anos e 6 meses ao fim do contrato. Ajustamos o campo automaticamente.`,
    };
  }

  return { prazo, ajustado: false, maximoPermitido };
}
