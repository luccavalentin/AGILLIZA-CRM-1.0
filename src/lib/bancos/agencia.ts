/**
 * Agência do Bradesco tem 4 dígitos. Digitada sem o zero à esquerda ("347"),
 * seguia assim para a integração e a proposta voltou recusada sem motivo
 * (PRO-000357, 15/09/2026). Aqui ela é completada ("0347"); nos demais bancos
 * só removemos o que não é dígito.
 */
export const DIGITOS_AGENCIA_BRADESCO = 4;

export function ehAgenciaDoBradesco(nomeBanco: unknown): boolean {
  return /bradesco/i.test(String(nomeBanco ?? ""));
}

/** Só dígitos; no Bradesco, completa com zeros à esquerda até 4. Vazia continua vazia. */
export function normalizarAgencia(valor: unknown, nomeBanco?: unknown): string {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  if (!digitos) return "";
  if (ehAgenciaDoBradesco(nomeBanco) && digitos.length < DIGITOS_AGENCIA_BRADESCO) {
    return digitos.padStart(DIGITOS_AGENCIA_BRADESCO, "0");
  }
  return digitos;
}

/** Mensagem de erro quando a agência não cabe no formato do banco; `null` se válida. */
export function erroAgencia(valor: unknown, nomeBanco?: unknown): string | null {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  if (!digitos) return null;
  if (ehAgenciaDoBradesco(nomeBanco) && digitos.length > DIGITOS_AGENCIA_BRADESCO) {
    return "Agência do Bradesco tem 4 dígitos.";
  }
  if (digitos.length > 5) return "Agência inválida: informe até 5 dígitos, só números.";
  return null;
}

/**
 * Campos bancários do participante no `PUT /oportunidade/{id}/participante/{id}`.
 *
 * A agência escolhida no envio ia só no corpo do PUT da simulação, campo que a
 * integração não aceita (`UpdateSimulationRequest` não tem `agencia`): ela era
 * descartada em silêncio e a simulação voltava com `agencia: null` — as 20
 * propostas Bradesco com agência gravada até 16/09/2026 (PRO-000375, 379, 385,
 * 386) chegaram ao banco sem ela. O único lugar do pedido que recebe agência é
 * o participante (`idBanco` + `codigoAgencia`), então ela vai no proponente
 * principal, apontando para o banco de destino.
 *
 * O PUT do participante substitui o registro: quem não recebe a agência deste
 * envio mantém os dados bancários que já tinha na integração.
 */
export function dadosBancariosParticipante({
  participante,
  ehPrincipal,
  agencia,
  nomeBanco,
  idBancoDestino,
  contaCorrente,
  digitoConta,
}: {
  participante: any;
  ehPrincipal: boolean;
  agencia: unknown;
  nomeBanco?: unknown;
  idBancoDestino: unknown;
  /** Conta conferida no "Continuar proposta"; vazia mantém a da integração. */
  contaCorrente?: unknown;
  digitoConta?: unknown;
}): {
  idBanco?: number;
  codigoAgencia?: string;
  codigoContaCorrente?: string;
  digitoContaCorrente?: string;
} {
  const texto = (v: unknown) => {
    const s = String(v ?? "").trim();
    return s || undefined;
  };
  const numero = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const atuais = {
    idBanco: numero(participante?.idBanco),
    codigoAgencia: texto(participante?.codigoAgencia),
    codigoContaCorrente: texto(participante?.codigoContaCorrente),
    digitoContaCorrente: texto(participante?.digitoContaCorrente),
  };

  const agenciaEnvio = normalizarAgencia(agencia, nomeBanco);
  const idBanco = numero(idBancoDestino);
  if (!ehPrincipal || !agenciaEnvio || !idBanco) return atuais;

  // A conta só continua valendo se já era deste mesmo banco.
  const mesmoBanco = atuais.idBanco === idBanco;
  const conta = String(contaCorrente ?? "").replace(/\D/g, "");
  if (conta) {
    return {
      idBanco,
      codigoAgencia: agenciaEnvio,
      codigoContaCorrente: conta,
      digitoContaCorrente: texto(digitoConta),
    };
  }
  return {
    idBanco,
    codigoAgencia: agenciaEnvio,
    codigoContaCorrente: mesmoBanco ? atuais.codigoContaCorrente : undefined,
    digitoContaCorrente: mesmoBanco ? atuais.digitoContaCorrente : undefined,
  };
}
