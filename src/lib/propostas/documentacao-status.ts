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

/** Faltando menos que isto para o prazo, o selo fica amarelo (perto de estourar). */
export const SLA_ALERTA_HORAS = 12;

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

export type SituacaoDocumentacao =
  /** Recebido na HomeFin e em análise. `recebidoEm` = o mais antigo ainda na fila. */
  | { tipo: "em_analise"; recebidoEm: string; prazo: string; emAnalise: number; total: number }
  /** Pelo menos um recusado — pede ação e leitura dos comentários. */
  | { tipo: "rejeitado"; rejeitados: number; emAnalise: number; total: number }
  /** Tudo aprovado pela HomeFin (`noBanco` = quantos já foram repassados). */
  | { tipo: "aprovado"; aprovados: number; noBanco: number; total: number };

/**
 * Soma `dias` dias úteis (segunda a sexta) a partir de `inicio`, mantendo a
 * hora. Feriados não entram: o prazo é o D+2 que a HomeFin combina.
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

/** Prazo do SLA de análise para um documento recebido em `recebidoEm`. */
export function prazoSlaDocumentos(recebidoEm: string | Date): Date {
  const inicio = recebidoEm instanceof Date ? recebidoEm : new Date(recebidoEm);
  return somarDiasUteis(inicio, SLA_DOCUMENTOS_DIAS_UTEIS);
}

/**
 * Tempo até o prazo, pronto para o selo: "1d 04h", "5h 12min", "12min".
 * Depois do prazo, `vencido` e o tempo de atraso.
 */
export function tempoAtePrazo(
  prazo: string | Date,
  agora: Date = new Date(),
): { vencido: boolean; urgente: boolean; texto: string } {
  const fim = prazo instanceof Date ? prazo : new Date(prazo);
  const diff = fim.getTime() - agora.getTime();
  const vencido = diff <= 0;
  const minutos = Math.floor(Math.abs(diff) / 60_000);
  const d = Math.floor(minutos / 1440);
  const h = Math.floor((minutos % 1440) / 60);
  const m = minutos % 60;
  const texto =
    d > 0
      ? `${d}d ${String(h).padStart(2, "0")}h`
      : h > 0
        ? `${h}h ${String(m).padStart(2, "0")}min`
        : `${Math.max(m, vencido ? 1 : 0)}min`;
  // Perto de estourar: menos de SLA_ALERTA_HORAS para vencer.
  return { vencido, urgente: !vencido && diff < SLA_ALERTA_HORAS * 3_600_000, texto };
}

/**
 * Resume os documentos da proposta num selo só.
 *
 * Prioridade: recusado (pede ação) > em análise (conta o SLA) > aprovado.
 * Só da etapa Documentos em diante, e só com documento enviado à HomeFin.
 */
export function situacaoDocumentacao(
  status: string | null | undefined,
  linhas: DocumentoHomefinLinha[] | null | undefined,
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

  if (rejeitados > 0) return { tipo: "rejeitado", rejeitados, emAnalise: naFila.length, total };

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
    };
  }

  return { tipo: "aprovado", aprovados, noBanco, total };
}
