/**
 * Ritmo do polling de propostas.
 *
 * A integração não tem webhook — a única forma de saber o andamento é
 * consultar `GET /oportunidade/{id}`. Em 30/09/2026 a HomeFin apontou uma
 * média de ~1.000 consultas por proposta: o ritmo antigo (2 min nas fases
 * pós-crédito) dava ~370 consultas por dia útil numa proposta condicionada,
 * que fica semanas nessa fase.
 *
 * Regras (definidas com o Lucca em 30/09/2026):
 *
 * - Itaú e Santander: a HomeFin só serve para trazer a decisão de crédito.
 *   Depois dela (aprovado, condicionado e etapas seguintes) o andamento vem do
 *   robô dos portais (`automacao-portal-banco`) e o agendador NÃO consulta
 *   mais. Recusa já é final para todos os bancos.
 * - Bradesco: o follow-up vem pela HomeFin, então continua sendo consultado,
 *   só que espaçado.
 *
 * | Fase (horário comercial)                   | Itaú / Santander | Bradesco                    |
 * |--------------------------------------------|------------------|-----------------------------|
 * | Análise de crédito, 1ª hora após o envio   | 2 min            | 5 min (a 1ª só 5 min após o envio)|
 * | Análise de crédito, depois da 1ª hora      | 10 min           | 10 min                      |
 * | Aprovada / condicionada / etapas seguintes | não consulta     | 30 min                      |
 *
 * Fora do horário comercial (antes das 8h, depois das 20h, sábado e domingo):
 * análise a cada 30 min, demais fases a cada 3 h. Proposta sem nenhuma
 * mudança há mais de 7 dias: no máximo a cada 4 h.
 *
 * Encerradas (cancelada, recusada, contrato, registrado) nem chegam aqui: quem
 * seleciona as candidatas já as exclui. Abrir a proposta e o botão "Atualizar
 * status" continuam consultando na hora.
 */
import { fonteDoAndamento } from "@/lib/bancos/etapas-banco";

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

/**
 * A decisão de crédito já saiu e o andamento dali em diante não vem da
 * HomeFin (Itaú e Santander, pelo robô dos portais). Consultar seria só carga.
 */
export function andamentoForaDaHomefin(p: PropostaParaSincronizar): boolean {
  if (FASE_ANALISE.has(String(p.status ?? ""))) return false;
  return fonteDoAndamento(p.nome_banco) === "portal_banco";
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
    intervalo = analise ? 30 : 180;
  } else if (analise) {
    // A resposta do crédito sai em minutos (Itaú/Santander em menos de 1,
    // Bradesco em ~8): o ritmo curto só vale para a primeira hora.
    const enviada = paraMs(p.enviada_em) ?? marcoDeAtividade(p);
    const primeiraHora = enviada !== null && agora - enviada < 60 * 60_000;
    intervalo = !primeiraHora ? 10 : banco === "bradesco" ? 5 : 2;
  } else {
    intervalo = 30;
  }

  const marco = marcoDeAtividade(p);
  if (marco !== null && agora - marco > 7 * 24 * 3_600_000) {
    intervalo = Math.max(intervalo, 240);
  }
  return intervalo;
}

/**
 * A proposta já pode ser consultada de novo?
 * Nunca consultada sempre pode, exceto quando o andamento não vem mais da
 * HomeFin. O Bradesco em análise espera 5 min após o envio antes da primeira
 * consulta (ele não responde antes disso).
 */
export function devesincronizar(p: PropostaParaSincronizar, agora = Date.now()): boolean {
  if (andamentoForaDaHomefin(p)) return false;
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
  // anterior leva alguns segundos — sem ela, "2 min" viraria 3 na prática.
  return agora - ultima >= intervaloMinimoMinutos(p, agora) * 60_000 - 10_000;
}

/** Filtra a lista de candidatas, mantendo só as que estão no prazo de consulta. */
export function filtrarParaSincronizar<T extends PropostaParaSincronizar>(
  propostas: readonly T[],
  agora = Date.now(),
): T[] {
  return (propostas ?? []).filter((p) => devesincronizar(p, agora));
}
