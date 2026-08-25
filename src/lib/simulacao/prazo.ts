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
 * 
 * NOTA: O valor 963 é uma regra interna do Agilliza e não consta explicitamente no 
 * contrato HomeFin 1.0.1. Deve ser verificado através de logs de erro reais.
 * 
 * EVIDÊNCIA REAL BRADESCO (965 meses / 80 anos e 5 meses):
 * - idade 694 meses -> máximo 271 (soma 965)
 * - idade 742 meses -> máximo 223 (soma 965)
 * - idade 559 meses -> máximo 406 (soma 965)
 * Mantemos 963 como margem de segurança e compatibilidade com o Itaú.
 */
export const IDADE_MAX_TERMINO_MESES = 963;

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
export function prazoMaximoPorIdade(
  dataNascimento: string,
  hoje: Date = new Date(),
): number | null {
  const idade = idadeEmMesesCorridos(dataNascimento, hoje);
  if (idade == null) return null;
  const porIdade = IDADE_MAX_TERMINO_MESES - idade;
  return Math.max(0, Math.min(PRAZO_MAX, porIdade));
}

export interface ProponenteLimite {
  nome: string;
  vinculo: string;
  idadeAnos: number;
  prazoMaximo: number;
}

/**
 * Prazo máximo considerando TODOS os proponentes (titular, cônjuge e
 * coproponentes): usa o mais velho (menor prazo), garantindo que o contrato
 * seja aceito por todas as IFs. Datas inválidas/ausentes são ignoradas.
 */
export function prazoMaximoParaProponentes(
  proponentes: Array<{ nome: string; vinculo: string; dataNascimento: string | null | undefined }>,
  hoje: Date = new Date(),
): { prazo: number; limitador: ProponenteLimite | null } | null {
  const validos = proponentes.filter(p => !!p.dataNascimento);
  if (validos.length === 0) return null;

  let minPrazo = PRAZO_MAX;
  let limitador: ProponenteLimite | null = null;

  for (const p of validos) {
    const pMax = prazoMaximoPorIdade(p.dataNascimento!, hoje);
    if (pMax !== null && pMax < minPrazo) {
      minPrazo = pMax;
      limitador = {
        nome: p.nome,
        vinculo: p.vinculo,
        idadeAnos: Math.floor(idadeEmMesesCorridos(p.dataNascimento!, hoje)! / 12),
        prazoMaximo: pMax
      };
    }
  }

  return { prazo: minPrazo, limitador };
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
  titular: { nome: string; dataNascimento: string },
  adicionais: Array<{ nome: string; vinculo: string; dataNascimento: string | null | undefined }> = [],
): AjustePrazo {
  const res = prazoMaximoParaProponentes([
    { nome: titular.nome, vinculo: "Titular", dataNascimento: titular.dataNascimento },
    ...adicionais
  ]);
  
  const maximoPermitido = res?.prazo ?? PRAZO_MAX;
  const limitador = res?.limitador;

  if (prazo > maximoPermitido) {
    const msg = `Prazo ajustado de ${prazo} para ${maximoPermitido} meses (${formatarMeses(maximoPermitido)}) pela idade de ${limitador?.nome || titular.nome} (${limitador?.idadeAnos || "idade limite"} anos), o proponente limitador da operação.`;

    return {
      prazo: maximoPermitido,
      ajustado: true,
      maximoPermitido,
      mensagem: msg,
    };
  }

  return { prazo, ajustado: false, maximoPermitido };
}

export type MotivoLimitador = "idade" | "operacao" | "produto" | "limite_geral";

export interface DecisaoPrazo {
  acao: "aceitar" | "ajustar" | "rejeitar_segundo_duplicado";
  valorFinal: number | null;
  tipoAviso: "warning" | "info" | "error";
  titulo: string;
  descricao: string;
}

/**
 * Função pura que avalia um novo prazo digitado ou alterado externamente.
 * Implementa a lógica central de normalização e mensagens únicas.
 */
export function avaliarNovoPrazo(params: {
  campo: "prazo" | "prazo_2";
  valorDigitado: number | null;
  prazoPrincipal: number;
  prazoSegundo: number | null;
  prazoMaximoEfetivo: number;
  prazoMaximoIdade: number | null;
  limitadorPrazo: ProponenteLimite | null;
  motivoLimitador: MotivoLimitador;
}): DecisaoPrazo {
  const {
    campo,
    valorDigitado,
    prazoPrincipal,
    prazoSegundo,
    prazoMaximoEfetivo,
    prazoMaximoIdade,
    limitadorPrazo,
    motivoLimitador,
  } = params;

  const valor = Number(valorDigitado) || 0;
  const isPrincipal = campo === "prazo";
  const label = isPrincipal ? "Prazo Principal" : "Segundo Prazo";

  // 1. Verifica se ultrapassa o teto
  const houveAjuste = valor > prazoMaximoEfetivo;

  // 2. Verifica duplicidade (específico para Segundo Prazo)
  if (!isPrincipal && valor > 0) {
    // Se o valor digitado for igual ao principal, ou se o ajuste o tornaria igual
    const valorParaComparar = houveAjuste ? prazoMaximoEfetivo : valor;
    if (valorParaComparar === prazoPrincipal) {
      let desc = `O prazo máximo permitido `;
      if (motivoLimitador === "idade" && limitadorPrazo) {
        desc += `pela idade do proponente limitador (${limitadorPrazo.nome}) é ${prazoMaximoEfetivo} meses (${formatarMeses(prazoMaximoEfetivo)}), `;
      } else if (motivoLimitador === "operacao") {
        desc += `para esta operação é ${prazoMaximoEfetivo} meses, `;
      } else if (motivoLimitador === "produto") {
        desc += `para este produto é ${prazoMaximoEfetivo} meses, `;
      } else {
        desc += `é ${prazoMaximoEfetivo} meses, `;
      }
      desc += `porém esse valor já está sendo utilizado como Prazo Principal. Informe um Segundo Prazo diferente e inferior a ${prazoMaximoEfetivo} meses para comparação.`;

      return {
        acao: "rejeitar_segundo_duplicado",
        valorFinal: null,
        tipoAviso: "info",
        titulo: "Segundo Prazo já utilizado",
        descricao: desc,
      };
    }
  }

  // 3. Se não houve ajuste pelo teto, aceita
  if (!houveAjuste) {
    return {
      acao: "aceitar",
      valorFinal: valor,
      tipoAviso: "info",
      titulo: "",
      descricao: "",
    };
  }

  // 4. Houve ajuste pelo teto: Monta a mensagem para o popup de confirmação
  let titulo = "Prazo acima do permitido";
  let desc = `Você informou ${valor} meses no ${label}, porém o prazo máximo permitido `;

  if (motivoLimitador === "idade" && limitadorPrazo) {
    desc += `pela idade do proponente limitador (${limitadorPrazo.nome}, ${limitadorPrazo.idadeAnos} anos) é ${prazoMaximoEfetivo} meses (${formatarMeses(prazoMaximoEfetivo)}). `;
  } else if (motivoLimitador === "operacao") {
    desc += `para esta operação é ${prazoMaximoEfetivo} meses. `;
  } else if (motivoLimitador === "produto") {
    desc += `para este produto é ${prazoMaximoEfetivo} meses. `;
  } else {
    desc += `é ${prazoMaximoEfetivo} meses. `;
  }
  desc += `\n\nO prazo precisa ser ajustado antes de enviar a simulação aos bancos.`;

  return {
    acao: "ajustar",
    valorFinal: prazoMaximoEfetivo,
    tipoAviso: "warning",
    titulo,
    descricao: desc,
  };
}

/**
 * Estado civil que implica cônjuge. Aceita tanto o código usado nas
 * simulações (CA/UE) quanto o texto gravado no CRM, porque simulações
 * duplicadas e cadastros antigos carregam as duas formas.
 */
export function ehCasado(estadoCivil: string | null | undefined): boolean {
  const v = String(estadoCivil ?? "").trim().toLowerCase();
  return v === "ca" || v === "ue" || v === "casado" || v === "uniao_estavel";
}
