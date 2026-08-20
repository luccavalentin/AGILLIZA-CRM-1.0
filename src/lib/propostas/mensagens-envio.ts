/**
 * Mensagens padronizadas de falha de envio da PROPOSTA.
 *
 * Toda mensagem responde quatro perguntas:
 *   O QUE aconteceu · POR QUE · DE QUEM / QUAL BANCO · O QUE FAZER.
 *
 * Nenhuma mensagem pode ser apenas "erro" ou "erro desconhecido": quando não
 * houver tratamento específico, mostramos o código e a mensagem crus da API
 * em "Detalhes técnicos".
 */

import { descreverParticipante, listarLabels, type CampoObrigatorio } from "./campos-obrigatorios";

export type TipoFalhaEnvio =
  | "cadastro_incompleto"
  | "recusa_credito"
  | "falha_integracao"
  | "sem_motivo_banco"
  | "campo_banco"
  | "regra_banco"
  | "desconhecido";

export type MensagemEnvio = {
  tipo: TipoFalhaEnvio;
  /** Texto principal exibido ao usuário. */
  texto: string;
  /** Ação sugerida (rótulo do botão). `null` quando não há ação. */
  acao: string | null;
  /** Sugestões acionáveis (recusa de crédito). */
  sugestoes?: string[];
  /** Payload cru da API para o bloco recolhível "Detalhes técnicos". */
  tecnico?: string | null;
  /** Reenviar resolve? Falso em recusa de crédito e em erro sem motivo. */
  permiteReenvio: boolean;
};

/** (a) Falta dado obrigatório no NOSSO cadastro — nem chegamos a chamar a API. */
export function msgCadastroIncompleto(
  banco: string,
  env: Record<string, any>,
  faltantes: CampoObrigatorio[],
): MensagemEnvio {
  return {
    tipo: "cadastro_incompleto",
    texto:
      `Não enviamos ao ${banco} porque faltam dados obrigatórios de ` +
      `${descreverParticipante(env)}: ${listarLabels(faltantes)}.`,
    acao: `Completar cadastro de ${
      String(env?.nome ?? "")
        .trim()
        .split(" ")[0] || "participante"
    }`,
    permiteReenvio: false,
  };
}

/** (b) O banco analisou e recusou o crédito. Não é erro do sistema. */
export function msgRecusaCredito(
  banco: string,
  motivo: string,
  protocolo?: string | null,
): MensagemEnvio {
  const sufixo = protocolo ? ` Protocolo ${protocolo}.` : "";
  return {
    tipo: "recusa_credito",
    texto: `${banco} recusou o crédito: ${motivo.replace(/\.$/, "")}.${sufixo}`,
    acao: null,
    sugestoes: [
      "Reduzir o valor financiado",
      "Aumentar o prazo",
      "Compor renda com cônjuge ou coproponente",
      "Simular em outro banco",
    ],
    permiteReenvio: false,
  };
}

/** (c) A proposta não chegou ao banco (tipoSituacao P/E e sem protocolo). */
export function msgFalhaIntegracao(banco: string, tecnico?: string | null): MensagemEnvio {
  return {
    tipo: "falha_integracao",
    texto: `A proposta não chegou ao ${banco}: falha de comunicação com a integração. Nenhum dado foi perdido.`,
    acao: "Reenviar",
    tecnico: tecnico ?? null,
    permiteReenvio: true,
  };
}

/** (d) O banco rejeitou sem informar motivo (retornoIntegracao vazio). */
export function msgSemMotivoBanco(
  banco: string,
  numeroProposta: string,
  tecnico?: string | null,
): MensagemEnvio {
  return {
    tipo: "sem_motivo_banco",
    texto:
      `O ${banco} rejeitou a proposta sem informar o motivo. Já registramos o ocorrido; ` +
      `acione o suporte informando a proposta ${numeroProposta}.`,
    acao: null,
    tecnico: tecnico ?? null,
    // Reenviar não resolve e duplica oportunidades na integração.
    permiteReenvio: false,
  };
}

/** (e) O banco devolveu um erro de campo específico. */
export function msgCampoBanco(
  banco: string,
  rotuloCampo: string,
  quem: string | null,
  tecnico?: string | null,
): MensagemEnvio {
  const de = quem ? ` de ${quem}` : "";
  return {
    tipo: "campo_banco",
    texto: `${banco} recusou: o campo ${rotuloCampo}${de} está vazio ou inválido.`,
    acao: "Abrir cadastro no campo",
    tecnico: tecnico ?? null,
    permiteReenvio: true,
  };
}

/** (f) Regra do banco (prazo, valor, LTV) — sempre citando o limite exato. */
export function msgRegraBanco(banco: string, regra: string): MensagemEnvio {
  return {
    tipo: "regra_banco",
    texto: `${banco}: ${regra}`,
    acao: "Ajustar a operação",
    permiteReenvio: true,
  };
}

/** (g) Sem tratamento específico — mostra o dado bruto, nunca "erro desconhecido". */
export function msgDesconhecido(banco: string, cru: unknown): MensagemEnvio {
  const tecnico =
    typeof cru === "string"
      ? cru
      : (() => {
          try {
            return JSON.stringify(cru);
          } catch {
            return String(cru);
          }
        })();
  return {
    tipo: "desconhecido",
    texto:
      `O ${banco} devolveu uma resposta que não conseguimos interpretar. ` +
      `Confira os detalhes técnicos abaixo e acione o suporte se persistir.`,
    acao: "Reenviar",
    tecnico: tecnico || null,
    permiteReenvio: true,
  };
}

/**
 * Uma mensagem de REGRA DO BANCO nunca pode ser sobrescrita por um erro
 * posterior e genérico (ex.: HTTP 500 do PUT) — ela é a informação útil.
 */
export function preservarMensagemUtil(anterior: string | null | undefined, nova: string): string {
  const a = String(anterior ?? "").trim();
  if (!a) return nova;
  const ehUtil = /m[íi]nimo|m[áa]ximo|entre R\$|prazo de|recusou|aceita/i.test(a);
  const novaGenerica = /^(HTTP|Erro interno|Internal|500|502|503|timeout)/i.test(nova.trim());
  return ehUtil && novaGenerica ? a : nova;
}
