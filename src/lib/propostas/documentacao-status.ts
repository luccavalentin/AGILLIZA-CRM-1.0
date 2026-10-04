/**
 * Situação da documentação da proposta — o selo que aparece abaixo de
 * "Documentos" na régua, na consulta de propostas e no CRM.
 *
 * Fonte: `proposta_documentos_homefin`, uma linha por arquivo que o Agilliza
 * enviou, com a situação que a HomeFin devolve no checklist (`tipoSituacao`
 * P/I/A/R/D + `situacaoIntegracao`, ver `situacaoDoItem`):
 *   - `homefin`  → recebido, em análise na HomeFin (I) ou aguardando análise;
 *   - `aprovado` → aprovado pela HomeFin (A);
 *   - `enviado`  → aprovado e já repassado ao banco;
 *   - `erro`     → recusado na análise (R, com `comentarioAnalise`) ou pelo banco.
 *
 * O selo — e o semáforo do SLA — é da HomeFin: só existe para proposta com
 * documento enviado a ela. Proposta cujos documentos seguem por outro caminho
 * (ex.: direto no portal do banco) não tem selo nenhum, em vez de um
 * "aguardando" que nunca sairia do lugar.
 *
 * Módulo puro: usado no servidor (lista, CRM, ficha) e na tela (contagem do SLA).
 */

/** Prazo da HomeFin para analisar um documento recebido: D+2 dias úteis. */
export const SLA_DOCUMENTOS_DIAS_UTEIS = 2;

/** Expediente da HomeFin, no horário de Brasília: das 09h às 18h, seg a sex. */
export const JORNADA_INICIO_HORA = 9;
export const JORNADA_FIM_HORA = 18;
/** Um dia útil de SLA são as horas de expediente, não 24 h de calendário. */
export const HORAS_UTEIS_POR_DIA = JORNADA_FIM_HORA - JORNADA_INICIO_HORA;

/** Faltando menos que isto de EXPEDIENTE para o prazo, o selo fica amarelo. */
export const SLA_ALERTA_HORAS = 4;

/**
 * Onde o selo aparece: da etapa Documentos em diante. Antes disso a proposta
 * ainda está no crédito e o selo confundiria — quem mostra que a documentação
 * começou é a própria régua, ao passar para Documentos.
 */
const STATUS_COM_SELO = new Set([
  "aguardando_documentos",
  // Legados granulares que o stepper também trata como "Documentos".
  "checklist_documentacao",
  "cadastro_complementar",
  "dossie_completo",
  "envio_documentos_banco",
  "engenharia_vistoria",
  "vistoria_agendamento",
  "vistoria_concluida",
  "analise_juridica",
  "emissao_contrato",
  "contrato_emitido",
  "registrado",
]);

export interface DocumentoHomefinLinha {
  situacao: string | null;
  mensagem: string | null;
  nome_vaga: string | null;
  enviado_em: string | null;
  atualizado_em: string | null;
}

/**
 * Quando a HomeFin disse alguma coisa pela última vez nesta proposta: a
 * decisão de documento mais recente (aprovado, repassado ao banco ou recusado)
 * ou o comentário mais novo do banco. É o que o selo compara com a última vez
 * que a pessoa abriu os comentários para decidir se pisca.
 *
 * `null` quando ainda não houve retorno nenhum — documento só enviado e
 * esperando não é novidade, é o estado normal de quem acabou de subir.
 */
export interface ComNovidade {
  novidadeEm: string | null;
}

export type SituacaoDocumentacao = ComNovidade &
  /** Recebido na HomeFin e em análise. `recebidoEm` = o mais antigo ainda na fila. */
  (| { tipo: "em_analise"; recebidoEm: string; prazo: string; emAnalise: number; total: number }
    /** Pelo menos um recusado — pede ação e leitura dos comentários. */
    | { tipo: "rejeitado"; rejeitados: number; emAnalise: number; total: number }
    /** Tudo aprovado pela HomeFin (`noBanco` = quantos já foram repassados). */
    | { tipo: "aprovado"; aprovados: number; noBanco: number; total: number }
  );

const FUSO = "America/Sao_Paulo";

/**
 * Minutos que Brasília está à frente do UTC naquele instante (hoje, -180).
 * Lido do fuso em vez de fixado: o Brasil não tem horário de verão desde
 * 2019, mas se voltar a ter o prazo continua certo.
 */
function offsetBrasilia(ms: number): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const v = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? "0");
  const comoUtc = Date.UTC(
    v("year"),
    v("month") - 1,
    v("day"),
    v("hour"),
    v("minute"),
    v("second"),
  );
  return Math.round((comoUtc - ms) / 60_000);
}

/**
 * O relógio de parede de Brasília, deslocado para ser lido com `getUTC*`.
 * Todo o cálculo de expediente acontece neste espaço; no fim volta para o
 * instante real.
 */
function paraRelogio(ms: number): number {
  return ms + offsetBrasilia(ms) * 60_000;
}
function doRelogio(relogioMs: number, referenciaMs: number): number {
  return relogioMs - offsetBrasilia(referenciaMs) * 60_000;
}

function emFimDeSemanaRelogio(ms: number): boolean {
  const dia = new Date(ms).getUTCDay();
  return dia === 0 || dia === 6;
}

/** Hora cheia do mesmo dia, no espaço do relógio. */
function horaDoDia(ms: number, hora: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hora, 0, 0, 0);
}

/**
 * O primeiro instante de expediente a partir daqui. Dentro do expediente, é o
 * próprio instante; fora dele, a abertura do próximo dia útil — é isso que faz
 * o SLA congelar à noite e no fim de semana.
 */
function proximoExpediente(ms: number): number {
  let cur = ms;
  // Caminhada de no máximo alguns dias; o teto evita laço infinito.
  for (let i = 0; i < 400; i++) {
    if (emFimDeSemanaRelogio(cur)) {
      cur = horaDoDia(cur + 24 * 3_600_000, JORNADA_INICIO_HORA);
      continue;
    }
    const abre = horaDoDia(cur, JORNADA_INICIO_HORA);
    const fecha = horaDoDia(cur, JORNADA_FIM_HORA);
    if (cur < abre) return abre;
    if (cur < fecha) return cur;
    cur = horaDoDia(cur + 24 * 3_600_000, JORNADA_INICIO_HORA);
  }
  return cur;
}

/**
 * Soma `minutos` de EXPEDIENTE a um instante: o relógio só anda das 09h às 18h
 * de dias úteis, em Brasília. Feriados não entram.
 */
export function somarMinutosUteis(inicio: Date, minutos: number): Date {
  const ref = inicio.getTime();
  let cur = proximoExpediente(paraRelogio(ref));
  let faltam = Math.max(0, minutos);
  for (let i = 0; i < 2000 && faltam > 0; i++) {
    const fecha = horaDoDia(cur, JORNADA_FIM_HORA);
    const disponivel = (fecha - cur) / 60_000;
    if (faltam <= disponivel) {
      cur += faltam * 60_000;
      faltam = 0;
    } else {
      faltam -= disponivel;
      cur = proximoExpediente(fecha);
    }
  }
  return new Date(doRelogio(cur, ref));
}

/** Minutos de EXPEDIENTE entre dois instantes (0 se `ate` não for depois). */
export function minutosUteisEntre(de: Date, ate: Date): number {
  const fim = paraRelogio(ate.getTime());
  let cur = proximoExpediente(paraRelogio(de.getTime()));
  let total = 0;
  for (let i = 0; i < 2000 && cur < fim; i++) {
    const fechaDia = horaDoDia(cur, JORNADA_FIM_HORA);
    const ate2 = Math.min(fechaDia, fim);
    if (ate2 > cur) total += (ate2 - cur) / 60_000;
    if (ate2 >= fim) break;
    cur = proximoExpediente(fechaDia);
  }
  return Math.round(total);
}

/**
 * Soma `dias` dias úteis (segunda a sexta) a partir de `inicio`, mantendo a
 * hora. Mantida para quem precisa só da data, sem jornada.
 */
export function somarDiasUteis(inicio: Date, dias: number): Date {
  const d = new Date(inicio.getTime());
  let faltam = dias;
  while (faltam > 0) {
    d.setDate(d.getDate() + 1);
    const semana = d.getDay();
    if (semana !== 0 && semana !== 6) faltam--;
  }
  return d;
}

/**
 * Prazo do SLA de análise para um documento recebido em `recebidoEm`.
 *
 * D+2 úteis conta EXPEDIENTE, não calendário: 2 × 9 h das 09h às 18h. Um
 * documento recebido sexta às 17h vence terça às 16h, porque o relógio para às
 * 18h de sexta e só volta a andar segunda às 09h. Contado no calendário, o selo
 * mostrava "faltam 3d 18h" num prazo de dois dias.
 */
export function prazoSlaDocumentos(recebidoEm: string | Date): Date {
  const inicio = recebidoEm instanceof Date ? recebidoEm : new Date(recebidoEm);
  return somarMinutosUteis(inicio, SLA_DOCUMENTOS_DIAS_UTEIS * HORAS_UTEIS_POR_DIA * 60);
}

/**
 * Tempo de EXPEDIENTE até o prazo, pronto para o selo: "1d 04h", "5h 12min",
 * "12min". Um "d" é um dia útil de 9 h, não 24 h — senão o selo diria "2d" para
 * um prazo que vence na tarde seguinte. Depois do prazo, `vencido` e o atraso,
 * também em expediente.
 */
export function tempoAtePrazo(
  prazo: string | Date,
  agora: Date = new Date(),
): { vencido: boolean; urgente: boolean; texto: string } {
  const fim = prazo instanceof Date ? prazo : new Date(prazo);
  const vencido = fim.getTime() <= agora.getTime();
  const minutos = vencido ? minutosUteisEntre(fim, agora) : minutosUteisEntre(agora, fim);
  const porDia = HORAS_UTEIS_POR_DIA * 60;
  const d = Math.floor(minutos / porDia);
  const h = Math.floor((minutos % porDia) / 60);
  const m = minutos % 60;
  const texto =
    d > 0
      ? `${d}d ${String(h).padStart(2, "0")}h`
      : h > 0
        ? `${h}h ${String(m).padStart(2, "0")}min`
        : `${Math.max(m, vencido ? 1 : 0)}min`;
  // Perto de estourar: menos de SLA_ALERTA_HORAS de expediente para vencer.
  return { vencido, urgente: !vencido && minutos < SLA_ALERTA_HORAS * 60, texto };
}

/** Situações que são retorno da HomeFin, e não o documento parado na fila. */
const SITUACOES_DECIDIDAS = new Set(["aprovado", "enviado", "erro"]);

/**
 * O retorno mais recente da HomeFin nesta proposta: a última decisão de
 * documento ou o último comentário do banco, o que vier depois.
 */
function momentoDaNovidade(
  docs: DocumentoHomefinLinha[],
  ultimoComentarioBanco: string | null | undefined,
): string | null {
  const momentos = docs
    .filter((d) => SITUACOES_DECIDIDAS.has(String(d.situacao ?? "")))
    .map((d) => d.atualizado_em)
    .filter((v): v is string => Boolean(v));
  if (ultimoComentarioBanco) momentos.push(ultimoComentarioBanco);
  if (momentos.length === 0) return null;
  // Datas ISO em UTC ordenam como texto; as do banco vêm todas assim.
  return momentos.reduce((a, b) => (new Date(a) >= new Date(b) ? a : b));
}

/**
 * Resume os documentos da proposta num selo só.
 *
 * Prioridade: recusado (pede ação) > em análise (conta o SLA) > aprovado.
 * Só da etapa Documentos em diante, e só com documento enviado à HomeFin.
 *
 * `ultimoComentarioBanco` entra só no `novidadeEm` — é o que faz o selo piscar
 * quando o banco comenta sem mexer em documento nenhum.
 */
export function situacaoDocumentacao(
  status: string | null | undefined,
  linhas: DocumentoHomefinLinha[] | null | undefined,
  ultimoComentarioBanco?: string | null,
): SituacaoDocumentacao | null {
  const s = String(status ?? "");
  if (!STATUS_COM_SELO.has(s)) return null;

  const docs = linhas ?? [];
  if (docs.length === 0) return null;

  const total = docs.length;
  const rejeitados = docs.filter((d) => d.situacao === "erro").length;
  const naFila = docs.filter((d) => d.situacao === "homefin");
  const noBanco = docs.filter((d) => d.situacao === "enviado").length;
  const aprovados = docs.filter((d) => d.situacao === "aprovado").length + noBanco;
  const novidadeEm = momentoDaNovidade(docs, ultimoComentarioBanco);

  if (rejeitados > 0)
    return { tipo: "rejeitado", rejeitados, emAnalise: naFila.length, total, novidadeEm };

  if (naFila.length > 0) {
    const maisAntigo = naFila
      .map((d) => d.enviado_em ?? d.atualizado_em)
      .filter((v): v is string => Boolean(v))
      .sort()[0];
    // Sem data de envio não há como contar o prazo; conta a partir de agora.
    const recebidoEm = maisAntigo ?? new Date().toISOString();
    return {
      tipo: "em_analise",
      recebidoEm,
      prazo: prazoSlaDocumentos(recebidoEm).toISOString(),
      emAnalise: naFila.length,
      total,
      novidadeEm,
    };
  }

  return { tipo: "aprovado", aprovados, noBanco, total, novidadeEm };
}
