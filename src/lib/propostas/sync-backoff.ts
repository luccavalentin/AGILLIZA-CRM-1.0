/**
 * Escalonamento do polling de propostas.
 *
 * A integração não tem webhook — a documentação não prevê callback, então a
 * única forma de saber o desfecho é consultar `GET /oportunidade/{id}`. O cron
 * roda de 2 em 2 minutos, mas consultar TODA proposta ativa a cada rodada faz
 * uma proposta parada em análise ser consultada ~720x por dia, indefinidamente
 * (foi o que aconteceu: 26 mil GETs numa única oportunidade).
 *
 * Aqui a frequência acompanha a idade da última mudança de status: proposta
 * recém-enviada é consultada de perto, proposta parada há semanas é consultada
 * de hora em hora. Nenhuma deixa de ser consultada — só param de ser
 * consultadas na mesma cadência de uma que acabou de sair.
 */

/** Faixas de idade (desde a última mudança) e o intervalo mínimo entre consultas. */
export const FAIXAS_BACKOFF: { ateHoras: number; intervaloMinutos: number }[] = [
  { ateHoras: 2, intervaloMinutos: 2 }, // acabou de ser enviada: cadência do cron
  { ateHoras: 24, intervaloMinutos: 15 },
  { ateHoras: 24 * 7, intervaloMinutos: 60 },
  { ateHoras: Infinity, intervaloMinutos: 360 }, // parada há mais de uma semana
];

export interface PropostaParaSincronizar {
  /** Última vez que consultamos o banco por esta proposta. */
  ultima_sincronizacao_em?: string | null;
  /** Última vez que o status mudou de fato. */
  status_atualizado_em?: string | null;
  /** Momento do envio ao banco. */
  enviada_em?: string | null;
  created_at?: string | null;
}

function paraMs(v: string | null | undefined): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Marco mais recente de atividade da proposta.
 *
 * Precisa ser o MAIOR entre os três: o envio ao banco não grava
 * `status_atualizado_em` (só a sincronização grava). Usando apenas esse campo,
 * uma proposta criada há semanas e enviada hoje cairia direto na faixa de 6
 * horas — justamente quando o retorno do banco é mais provável.
 */
function marcoDeAtividade(p: PropostaParaSincronizar): number | null {
  const candidatos = [
    paraMs(p.status_atualizado_em),
    paraMs(p.enviada_em),
    paraMs(p.created_at),
  ].filter((v): v is number => v !== null);
  return candidatos.length > 0 ? Math.max(...candidatos) : null;
}

/** Intervalo mínimo, em minutos, entre duas consultas desta proposta. */
export function intervaloMinimoMinutos(p: PropostaParaSincronizar, agora = Date.now()): number {
  const referencia = marcoDeAtividade(p);
  if (referencia === null) return FAIXAS_BACKOFF[0].intervaloMinutos;
  const horasParada = (agora - referencia) / 3_600_000;
  const faixa =
    FAIXAS_BACKOFF.find((f) => horasParada <= f.ateHoras) ??
    FAIXAS_BACKOFF[FAIXAS_BACKOFF.length - 1];
  return faixa.intervaloMinutos;
}

/**
 * A proposta já pode ser consultada de novo?
 * Nunca consultada (`ultima_sincronizacao_em` nulo) sempre pode.
 */
export function devesincronizar(p: PropostaParaSincronizar, agora = Date.now()): boolean {
  const ultima = paraMs(p.ultima_sincronizacao_em);
  if (ultima === null) return true;
  return agora - ultima >= intervaloMinimoMinutos(p, agora) * 60_000;
}

/** Filtra a lista de candidatas, mantendo só as que estão no prazo de consulta. */
export function filtrarParaSincronizar<T extends PropostaParaSincronizar>(
  propostas: readonly T[],
  agora = Date.now(),
): T[] {
  return (propostas ?? []).filter((p) => devesincronizar(p, agora));
}
