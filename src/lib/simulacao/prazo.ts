/**
 * Regras de prazo do financiamento habitacional (vigentes em 2026).
 *
 * Regra de idade (SFH/SBPE): a soma da idade do proponente mais o prazo do
 * financiamento não pode ultrapassar o teto de idade ao TÉRMINO do contrato.
 * Bradesco e Santander usam o teto de 80 anos e 6 meses (966 meses). O Itaú é
 * sempre mais restritivo: aceita exatamente 3 parcelas a menos que os demais,
 * ou seja, teto equivalente a 963 meses. Como enviamos o MESMO prazo para
 * todos os bancos numa única simulação, adotamos a lógica do Itaú (963 meses);
 * caso contrário o Itaú recusa o prazo e retorna um "Erro interno do servidor"
 * genérico. Todas as IFs contam a idade de forma "corrida": o mês em curso do
 * proponente já é considerado como iniciado (idade arredondada para cima).
 *
 * Para que a mesma simulação/proposta seja aceita por TODAS as IFs sem erro,
 * calculamos o prazo pela regra mais restritiva (idade corrida) e, quando há
 * mais de um proponente, usamos o mais velho (menor prazo). O prazo máximo de
 * contrato é 420 meses (35 anos) e o mínimo é 60 meses (5 anos).
 */

export const PRAZO_MIN = 60;
export const PRAZO_MAX = 420;

/**
 * Idade máxima permitida ao término do contrato. Usamos a lógica do Itaú (a IF
 * mais restritiva), que sempre concede 3 parcelas a menos que Bradesco/Santander
 * — equivalente a 963 meses (80 anos e 6 meses menos 3) — para que o mesmo prazo
 * seja aceito por Bradesco, Santander e Itaú sem erro.
 */
export const IDADE_MAX_TERMINO_MESES = 966 - 3; // 963 (lógica Itaú)

function parseData(dataNascimento: string): Date | null {
  if (!dataNascimento) return null;
  const nasc = new Date(dataNascimento + (dataNascimento.length === 10 ? "T00:00:00" : ""));
  return Number.isNaN(nasc.getTime()) ? null : nasc;
}

/**
 * Idade atual em meses CHEIOS a partir da data de nascimento (YYYY-MM-DD).
 * Uso: exibição da idade do proponente.
 */
export function idadeEmMeses(dataNascimento: string, hoje: Date = new Date()): number | null {
  const nasc = parseData(dataNascimento);
  if (!nasc) return null;
  let meses = (hoje.getFullYear() - nasc.getFullYear()) * 12 + (hoje.getMonth() - nasc.getMonth());
  if (hoje.getDate() < nasc.getDate()) meses -= 1;
  return Math.max(0, meses);
}

/**
 * Idade em meses "corridos": o mês em curso conta como iniciado (arredonda para
 * cima quando há fração de mês). É essa contagem que as IFs usam para validar a
 * idade ao término do contrato — por isso é a base do cálculo de prazo máximo.
 */
export function idadeEmMesesCorridos(
  dataNascimento: string,
  hoje: Date = new Date(),
): number | null {
  const nasc = parseData(dataNascimento);
  if (!nasc) return null;
  const cheios = idadeEmMeses(dataNascimento, hoje)!;
  // Há fração de mês sempre que o dia de hoje não coincide exatamente com o dia
  // de nascimento (aniversário mensal). Nesse caso somamos o mês em curso.
  const temFracao = hoje.getDate() !== nasc.getDate();
  return cheios + (temFracao ? 1 : 0);
}

/**
 * Prazo máximo permitido (em meses) para a idade informada, respeitando o teto
 * ao término (idade corrida) e o limite absoluto de 420 meses. Retorna `null`
 * quando não há data de nascimento válida (sem restrição por idade).
 */
export function prazoMaximoPorIdade(dataNascimento: string, hoje: Date = new Date()): number | null {
  const idade = idadeEmMesesCorridos(dataNascimento, hoje);
  if (idade == null) return null;
  const porIdade = IDADE_MAX_TERMINO_MESES - idade;
  return Math.max(0, Math.min(PRAZO_MAX, porIdade));
}

/**
 * Prazo máximo considerando TODOS os proponentes (titular, cônjuge e
 * coproponentes): usa o mais velho (menor prazo), garantindo que o contrato
 * seja aceito por todas as IFs. Datas inválidas/ausentes são ignoradas.
 * Retorna `null` quando nenhuma data válida foi informada.
 */
export function prazoMaximoParaProponentes(
  datas: Array<string | null | undefined>,
  hoje: Date = new Date(),
): number | null {
  const todasDatas = datas.filter((d): d is string => !!d);
  if (todasDatas.length === 0) return null;

  const maximos = todasDatas
    .map((d) => prazoMaximoPorIdade(d, hoje))
    .filter((m): m is number => m != null);
  if (maximos.length === 0) return null;
  return Math.min(...maximos);
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
 * Valida e, se necessário, ajusta o prazo digitado conforme a regra de idade,
 * considerando o proponente mais velho entre a data principal e as datas
 * adicionais (cônjuge/coproponentes). Quando o prazo excede o máximo permitido,
 * retorna o valor ajustado e uma mensagem explicativa.
 */
export function ajustarPrazoPorIdade(
  prazo: number,
  dataNascimento: string,
  datasAdicionais: Array<string | null | undefined> = [],
): AjustePrazo {
  const maxIdade = prazoMaximoParaProponentes([dataNascimento, ...datasAdicionais]);
  const maximoPermitido = maxIdade == null ? PRAZO_MAX : maxIdade;

  if (prazo > maximoPermitido) {
    return {
      prazo: maximoPermitido,
      ajustado: true,
      maximoPermitido,
      mensagem:
        maxIdade == null
          ? `Você digitou ${prazo} meses, mas o máximo permitido é ${PRAZO_MAX} meses (${formatarMeses(PRAZO_MAX)}). Ajustamos o campo automaticamente.`
          : `Você digitou ${prazo} meses, mas o máximo permitido para a idade do proponente é ${maximoPermitido} ${
              maximoPermitido === 1 ? "mês" : "meses"
            } (${formatarMeses(
              maximoPermitido,
            )}), respeitando o limite de idade ao fim do contrato da instituição mais restritiva (Itaú). Ajustamos o campo automaticamente.`,
    };
  }

  return { prazo, ajustado: false, maximoPermitido };
}
