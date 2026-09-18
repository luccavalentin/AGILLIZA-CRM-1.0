/**
 * Ritmo do polling de propostas.
 *
 * A integração não tem webhook — a única forma de saber o andamento é
 * consultar `GET /oportunidade/{id}`. Consultar toda proposta ativa o tempo
 * todo custava ~110 mil chamadas por semana com 6 usuários, 99,8% delas com a
 * resposta idêntica à anterior (levantamento de 18/09/2026).
 *
 * Regras (definidas com o Lucca em 18/09/2026), em horário comercial:
 *
 * | Fase                                      | Itaú / Santander | Bradesco                     |
 * |-------------------------------------------|------------------|------------------------------|
 * | Análise de crédito (enviada, em análise)  | 1 min            | 5 min após o envio, depois 3 |
 * | Aprovada / condicionada / etapas seguintes| 2 min            | 10 min                       |
 *
 * Fora do horário comercial (antes das 8h, depois das 20h, sábado e domingo):
 * análise a cada 15 min, demais fases a cada 1 h. O Bradesco leva ~8 min para
 * responder o crédito (mediana de 30 dias), Itaú e Santander menos de 1 min.
 *
 * Proposta sem nenhuma mudança há mais de 30 dias: no máximo de hora em hora
 * (foi o caso das 26 mil consultas numa única oportunidade parada).
 *
 * Encerradas (cancelada, recusada, contrato, registrado) nem chegam aqui: quem
 * seleciona as candidatas já as exclui. Abrir a proposta e o botão "Atualizar
 * status" continuam consultando na hora.
 */

export interface PropostaParaSincronizar {
  status?: string | null;
  nome_banco?: string | null;
  /** Última vez que consultamos o banco por esta proposta (estado do servidor). */
  ultima_consulta_em?: string | null;
  /** Última leitura gravada na proposta (pode ficar até 15 min para trás). */
  ultima_sincronizacao_em?: string | null;
  /** Última vez que o status mudou de fato. */
  status_atualizado_em?: string | null;
  /** Momento do envio ao banco. */
  enviada_em?: string | null;
  created_at?: string | null;
}

const FASE_ANALISE = new Set(["rascunho", "enviada_banco", "em_analise_credito"]);

function paraMs(v: string | null | undefined): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

function normalizar(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

type Banco = "bradesco" | "itau" | "santander" | "outro";

function bancoDe(nome: unknown): Banco {
  const n = normalizar(nome);
  if (n.includes("bradesco")) return "bradesco";
  if (n.includes("itau")) return "itau";
  if (n.includes("santander")) return "santander";
  return "outro";
}

/** Dias úteis das 8h às 20h, no horário de Brasília. */
export function emHorarioComercial(agora = Date.now()): boolean {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(agora));
  const dia = partes.find((p) => p.type === "weekday")?.value ?? "";
  const hora = Number(partes.find((p) => p.type === "hour")?.value ?? "0");
  if (dia === "Sat" || dia === "Sun") return false;
  return hora >= 8 && hora < 20;
}

/**
 * Marco mais recente de atividade da proposta: o MAIOR entre mudança de
 * status, envio e criação (o envio não grava `status_atualizado_em`).
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
  const analise = FASE_ANALISE.has(String(p.status ?? ""));
  const banco = bancoDe(p.nome_banco);

  let intervalo: number;
  if (!emHorarioComercial(agora)) {
    intervalo = analise ? 15 : 60;
  } else if (analise) {
    intervalo = banco === "bradesco" ? 3 : 1;
  } else {
    intervalo = banco === "bradesco" ? 10 : 2;
  }

  const marco = marcoDeAtividade(p);
  if (marco !== null && agora - marco > 30 * 24 * 3_600_000) {
    intervalo = Math.max(intervalo, 60);
  }
  return intervalo;
}

/**
 * A proposta já pode ser consultada de novo?
 * Nunca consultada sempre pode. O Bradesco em análise espera 5 min após o
 * envio antes da primeira consulta (ele não responde antes disso).
 */
export function devesincronizar(p: PropostaParaSincronizar, agora = Date.now()): boolean {
  const analise = FASE_ANALISE.has(String(p.status ?? ""));
  const enviada = paraMs(p.enviada_em);
  if (
    analise &&
    bancoDe(p.nome_banco) === "bradesco" &&
    enviada !== null &&
    agora - enviada < 5 * 60_000
  ) {
    return false;
  }
  const leituras = [paraMs(p.ultima_consulta_em), paraMs(p.ultima_sincronizacao_em)].filter(
    (v): v is number => v !== null,
  );
  if (leituras.length === 0) return true;
  const ultima = Math.max(...leituras);
  // Tolerância de 10 s: o agendador roda de minuto em minuto e a consulta
  // anterior leva alguns segundos — sem ela, "1 min" viraria 2 na prática.
  return agora - ultima >= intervaloMinimoMinutos(p, agora) * 60_000 - 10_000;
}

/** Filtra a lista de candidatas, mantendo só as que estão no prazo de consulta. */
export function filtrarParaSincronizar<T extends PropostaParaSincronizar>(
  propostas: readonly T[],
  agora = Date.now(),
): T[] {
  return (propostas ?? []).filter((p) => devesincronizar(p, agora));
}
