/**
 * Ritmo do polling de propostas.
 *
 * A integração não tem webhook — a única forma de saber o andamento é
 * consultar `GET /oportunidade/{id}`. Em 30/09/2026 a HomeFin apontou uma
 * média de ~1.000 consultas por proposta: o ritmo antigo (2 min nas fases
 * pós-crédito) dava ~370 consultas por dia útil numa proposta condicionada,
 * que fica semanas nessa fase.
 *
 * Regra (definida com o Lucca em 01/10/2026): o objetivo da integração é
 * simulação → aprovação ou reprovação, e acaba aí. É o que o fluxograma da
 * HomeFin descreve — ele termina em "proposta enviada para integração
 * bancária", e as rotas GET são só "apoio de consulta". Por isso:
 *
 * - Só se consulta ENQUANTO a decisão de crédito não saiu.
 * - Saiu a decisão (aprovado, condicionado ou qualquer etapa seguinte), o
 *   sistema não consulta mais sozinho, em NENHUM banco. Itaú e Santander
 *   seguem pelo robô dos portais.
 * - Única exceção, aberta em 02/10/2026 e alargada em 04/10/2026: a proposta
 *   pós-crédito que JÁ ENVIOU documento é consultada de 3 em 3 horas, para
 *   trazer a análise deles e os comentários do banco. Documento analisado,
 *   aprovado ou recusado não chega de nenhuma outra forma — a API não tem
 *   webhook, e o retorno ficava parado até alguém clicar em "Atualizar
 *   status". Quem não enviou documento segue sem consulta nenhuma, que é a
 *   maioria e era o peso do volume.
 *
 *   Era 1 vez por dia útil, sem fim de semana: na op 34038 os documentos
 *   subiram numa sexta 11h42 e a integração passou sábado e domingo sem uma
 *   única leitura — nem a análise nem os comentários apareciam. O custo de
 *   3 em 3 horas é 8 leituras por dia na proposta que está de fato esperando
 *   retorno de documento, e nenhuma em todas as outras.
 *
 * | Análise de crédito (horário comercial) | Itaú / Santander | Bradesco                           |
 * |----------------------------------------|------------------|------------------------------------|
 * | 1ª hora após o envio                   | 2 min            | 5 min (a 1ª só 5 min após o envio) |
 * | Depois da 1ª hora                      | 10 min           | 10 min                             |
 *
 * Fora do horário comercial (antes das 8h, depois das 20h, sábado e domingo):
 * a cada 30 min.
 *
 * Análise sem decisão há mais de 24 h: a resposta do crédito sai em minutos,
 * então depois de um dia a proposta está travada, não "quase saindo". Passa a
 * 1 consulta por dia útil (em 01/10/2026 três propostas do Santander nessa
 * situação respondiam por quase todo o acompanhamento).
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
  /**
   * A proposta já enviou documento à HomeFin. É o que autoriza a única
   * consulta automática do pós-crédito (ver `acompanhaDocumentos`).
   */
  tem_documento_enviado?: boolean | null;
  created_at?: string | null;
}

const FASE_ANALISE = new Set(["rascunho", "enviada_banco", "em_analise_credito"]);

/** Pós-crédito com documento na HomeFin: de 3 em 3 horas. */
const INTERVALO_POS_CREDITO_MINUTOS = 3 * 60;

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

/** A decisão de crédito já saiu: dali em diante não há consulta automática. */
export function creditoDecidido(p: PropostaParaSincronizar): boolean {
  return !FASE_ANALISE.has(String(p.status ?? ""));
}

function agoraEmBrasilia(agora: number): { dia: string; hora: number } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(agora));
  return {
    dia: partes.find((p) => p.type === "weekday")?.value ?? "",
    hora: Number(partes.find((p) => p.type === "hour")?.value ?? "0"),
  };
}

/** Sábado ou domingo, no horário de Brasília. */
export function emFimDeSemana(agora = Date.now()): boolean {
  const { dia } = agoraEmBrasilia(agora);
  return dia === "Sat" || dia === "Sun";
}

/** Dias úteis das 8h às 20h, no horário de Brasília. */
export function emHorarioComercial(agora = Date.now()): boolean {
  if (emFimDeSemana(agora)) return false;
  const { hora } = agoraEmBrasilia(agora);
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
  const banco = bancoDe(p.nome_banco);

  // Pós-crédito só chega aqui quem acompanha documentos (ver
  // `devesincronizar`): de 3 em 3 horas, em qualquer dia e horário — a HomeFin
  // analisa quando analisa, e o retorno não chega por nenhum outro caminho.
  if (creditoDecidido(p)) return INTERVALO_POS_CREDITO_MINUTOS;
  // Análise travada há mais de um dia: uma vez por dia, em qualquer horário.
  if (analiseParada(p, agora)) return 24 * 60;

  if (!emHorarioComercial(agora)) return 30;
  // A resposta do crédito sai em minutos (Itaú/Santander em menos de 1,
  // Bradesco em ~8): o ritmo curto só vale para a primeira hora.
  const inicio = paraMs(p.enviada_em) ?? marcoDeAtividade(p);
  const primeiraHora = inicio !== null && agora - inicio < 60 * 60_000;
  if (!primeiraHora) return 10;
  return banco === "bradesco" ? 5 : 2;
}

/**
 * Pós-crédito, a única consulta automática que sobra: a análise dos documentos.
 * Vale só para quem já enviou documento, de 3 em 3 horas (o intervalo vem de
 * `intervaloMinimoMinutos`). O mesmo GET traz também os comentários do banco.
 *
 * Sem recorte de dia ou horário: a leitura de sábado é o que faz o retorno de
 * uma sexta à tarde aparecer antes de segunda.
 */
function acompanhaDocumentos(p: PropostaParaSincronizar): boolean {
  return Boolean(p.tem_documento_enviado);
}

/** Em análise (ou rascunho) sem decisão há mais de 24 h. */
function analiseParada(p: PropostaParaSincronizar, agora: number): boolean {
  if (!FASE_ANALISE.has(String(p.status ?? ""))) return false;
  const inicio = paraMs(p.enviada_em) ?? marcoDeAtividade(p);
  return inicio !== null && agora - inicio > 24 * 3_600_000;
}

/**
 * A proposta já pode ser consultada de novo?
 * Com o crédito decidido, nunca. Em análise, a nunca consultada sempre pode.
 * O Bradesco em análise espera 5 min após o envio antes da primeira
 * consulta (ele não responde antes disso).
 */
export function devesincronizar(p: PropostaParaSincronizar, agora = Date.now()): boolean {
  if (creditoDecidido(p) && !acompanhaDocumentos(p)) return false;
  // A consulta diária da análise parada não roda no fim de semana: a de
  // segunda cobre o período.
  if (analiseParada(p, agora) && emFimDeSemana(agora)) return false;
  const enviada = paraMs(p.enviada_em);
  if (bancoDe(p.nome_banco) === "bradesco" && enviada !== null && agora - enviada < 5 * 60_000) {
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
