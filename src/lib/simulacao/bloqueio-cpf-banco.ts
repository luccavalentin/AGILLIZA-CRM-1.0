/**
 * Freio por CPF quando o banco não processa a simulação.
 *
 * Módulo puro (sem banco, sem rede) para ser testado.
 *
 * O padrão medido no Santander em 14 dias (11/09/2026): 192 CPFs só tiveram
 * sucesso, e 22 CPFs só tiveram falha — 86 simulações, zero sucesso, nenhum
 * deles com sucesso anterior. Em todos os casos o provedor responde 200 ao
 * `POST /integracao`, `tipoSituacao` fica em `P` e `dataHoraEnvioIntegracao`
 * nunca é preenchido: ele aceita e não despacha ao banco. Enquanto isso, outros
 * CPFs no mesmo minuto passam — não é instabilidade, é o CPF.
 *
 * Insistir não muda nada (Carlos Coutinho: 10 tentativas em 2 dias) e custa
 * caro: cada tentativa são 3 chamadas ao provedor mais 25 minutos de
 * reconciliação. Depois de `LIMITE_FALHAS_SEM_DESPACHO` encerramentos por
 * "sem despacho" do mesmo CPF no mesmo banco dentro da janela, a próxima
 * simulação desse par é encerrada na hora, com a explicação certa.
 */

/** Encerramentos "sem despacho" do mesmo CPF+banco que caracterizam o bloqueio. */
export const LIMITE_FALHAS_SEM_DESPACHO = 2;

/** Janela em que os encerramentos anteriores contam. */
export const JANELA_BLOQUEIO_HORAS = 48;

/** Marcador gravado em `raw_response._encerrada_por` pelas linhas encerradas aqui. */
export const ENCERRADA_POR_CPF_BLOQUEADO = "cpf_sem_despacho_reincidente";

/** Marcador do corte de 25 min da reconciliação (já existente). */
export const ENCERRADA_POR_SEM_DESPACHO = "sem_despacho_ao_banco";

/** Os dois marcadores contam como "o banco não processou este CPF". */
export const MARCADORES_SEM_DESPACHO = [
  ENCERRADA_POR_SEM_DESPACHO,
  ENCERRADA_POR_CPF_BLOQUEADO,
] as const;

export function cpfBloqueadoNoBanco(falhasRecentes: number): boolean {
  return Number(falhasRecentes) >= LIMITE_FALHAS_SEM_DESPACHO;
}

export function mensagemCpfBloqueado(nomeBanco: string | null | undefined, falhasRecentes: number): string {
  const banco = nomeBanco?.trim() || "banco";
  return (
    `O ${banco} não processou as últimas ${falhasRecentes} simulações deste CPF nas últimas ` +
    `${JANELA_BLOQUEIO_HORAS}h: o provedor aceita o envio e não o registra na instituição. ` +
    `Reenviar não resolve — o caso precisa ser tratado com o provedor (informe o CPF e o número ` +
    `da oportunidade). Enquanto isso, simule este cliente em outro banco.`
  );
}
