/**
 * Regras do kanban de propostas (C34) — módulo puro, cliente e servidor.
 *
 * - Colunas pelas etapas reais, na ordem da máquina de estados, com "Contrato
 *   registrado" logo depois de "Contrato emitido".
 * - Soltar um cartão numa coluna passa por `avaliarSoltura`: a transição tem de existir
 *   na máquina (e no banco: formulários só Itaú/Santander); etapa que normalmente vem do
 *   banco pede confirmação; cancelar pede motivo. O servidor revalida tudo
 *   (`moverStatusProposta` / `cancelarProposta`).
 * - Dias parado na etapa com nível de alerta pelos limites configuráveis
 *   (`proposta_etapa_sla`), nunca fixos aqui.
 * - Propostas dos assinantes (Agilliza Tech) caem na coluna equivalente.
 */
import {
  STATUS_TERMINAIS,
  transicaoPermitida,
  transicaoPermitidaNoBanco,
  transicoesDoBanco,
  type PropostaStatus,
} from "./state-machine";

export interface ColunaKanban {
  destino: PropostaStatus;
  agrega: PropostaStatus[];
  /** Rótulo da coluna quando difere do rótulo do status. */
  rotulo?: string;
}

export const COLUNAS_KANBAN: ColunaKanban[] = [
  { destino: "rascunho", agrega: ["rascunho", "aguardando_envio"] },
  { destino: "enviada_banco", agrega: ["enviada_banco", "em_analise_credito"] },
  // A aprovação condicionada é crédito aprovado com exigências.
  { destino: "credito_aprovado", agrega: ["credito_aprovado", "credito_condicionado"] },
  { destino: "credito_recusado", agrega: ["credito_recusado"] },
  // Itaú e Santander: formulários do banco antes dos documentos.
  { destino: "formularios", agrega: ["formularios"] },
  {
    destino: "aguardando_documentos",
    agrega: [
      "aguardando_documentos",
      "checklist_documentacao",
      "cadastro_complementar",
      "dossie_completo",
      "envio_documentos_banco",
    ],
  },
  {
    destino: "engenharia_vistoria",
    agrega: ["engenharia_vistoria", "vistoria_agendamento", "vistoria_concluida"],
  },
  { destino: "analise_juridica", agrega: ["analise_juridica", "emissao_contrato"] },
  { destino: "contrato_emitido", agrega: ["contrato_emitido"] },
  { destino: "registrado", agrega: ["registrado"], rotulo: "Contrato registrado" },
  { destino: "erro_envio", agrega: ["erro_envio"] },
  { destino: "cancelada", agrega: ["cancelada"] },
];

const COLUNA_POR_STATUS = new Map<string, PropostaStatus>();
for (const c of COLUNAS_KANBAN) for (const s of c.agrega) COLUNA_POR_STATUS.set(s, c.destino);

export function colunaDoStatus(status: string | null | undefined): PropostaStatus | null {
  return status ? (COLUNA_POR_STATUS.get(status) ?? null) : null;
}

/** Etapas que o operador move à mão; as demais costumam voltar do banco pela integração. */
export const ETAPAS_MANUAIS: ReadonlySet<PropostaStatus> = new Set<PropostaStatus>([
  "aguardando_documentos",
  "engenharia_vistoria",
  "analise_juridica",
  "contrato_emitido",
  "registrado",
]);

export type ResultadoSoltura =
  | { tipo: "nada" }
  | { tipo: "recusada"; motivo: string }
  | { tipo: "mover"; destino: PropostaStatus }
  | { tipo: "confirmar"; destino: PropostaStatus; aviso: string }
  | { tipo: "cancelar" };

/**
 * O que acontece ao soltar um cartão (status `de`) na coluna `coluna`.
 * Recusa o que a máquina não permite; o servidor confere de novo.
 */
export function avaliarSoltura(
  de: string,
  coluna: PropostaStatus,
  nomeBanco: string | null | undefined,
  rotulos: (s: string) => string = (s) => s,
): ResultadoSoltura {
  const atual = colunaDoStatus(de);
  if (!atual) return { tipo: "recusada", motivo: "Situação da proposta desconhecida." };
  if (atual === coluna) return { tipo: "nada" };
  const deStatus = de as PropostaStatus;
  if (coluna === "cancelada") {
    return transicaoPermitida(deStatus, "cancelada")
      ? { tipo: "cancelar" }
      : { tipo: "recusada", motivo: `Uma proposta em "${rotulos(de)}" não pode ser cancelada.` };
  }
  if (!transicaoPermitida(deStatus, coluna)) {
    return {
      tipo: "recusada",
      motivo: `Transição inválida: ${rotulos(de)} → ${rotulos(coluna)}.`,
    };
  }
  if (!transicaoPermitidaNoBanco(deStatus, coluna, nomeBanco)) {
    return { tipo: "recusada", motivo: `O ${nomeBanco ?? "banco"} não tem a etapa de formulários.` };
  }
  if (!ETAPAS_MANUAIS.has(coluna)) {
    return {
      tipo: "confirmar",
      destino: coluna,
      aviso: `"${rotulos(coluna)}" costuma voltar sozinha do banco pela integração. Mover à mão só se o banco já confirmou fora do sistema.`,
    };
  }
  return { tipo: "mover", destino: coluna };
}

/** O cartão pode ser arrastado? (há ao menos uma etapa para onde ele pode ir) */
export function podeArrastar(status: string): boolean {
  return (transicoesDoBanco(status as PropostaStatus, null).length ?? 0) > 0;
}

/** Próximas etapas manuais oferecidas nas ações rápidas do cartão. */
export function proximasEtapasManuais(status: string, nomeBanco: string | null | undefined): PropostaStatus[] {
  return transicoesDoBanco(status as PropostaStatus, nomeBanco).filter((s) => ETAPAS_MANUAIS.has(s));
}

/* ───────────────────────── Dias parado / SLA ───────────────────────── */

export interface LimiteEtapa {
  dias_alerta: number;
  dias_critico: number;
}
export type PrazosKanban = Partial<Record<PropostaStatus, LimiteEtapa>>;
export type NivelSla = "ok" | "alerta" | "critico" | "sem";

/** Colunas sem relógio: o processo acabou ali. */
const SEM_SLA = new Set<PropostaStatus>(["registrado", "cancelada", "credito_recusado"]);

export function diasParado(desde: string | null | undefined, agora: Date): number | null {
  if (!desde) return null;
  // "2026-10-23 11:00:00+00" (texto do Postgres) → ISO que o Date entende.
  const iso = (desde.includes("T") ? desde : desde.replace(" ", "T")).replace(/([+-]\d{2})$/, "$1:00");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((agora.getTime() - d.getTime()) / 86_400_000));
}

export function nivelSla(status: string, dias: number | null, prazos: PrazosKanban): NivelSla {
  const coluna = colunaDoStatus(status);
  if (!coluna || dias === null || SEM_SLA.has(coluna)) return "sem";
  const l = prazos[coluna];
  if (!l) return "sem";
  if (dias >= l.dias_critico) return "critico";
  if (dias >= l.dias_alerta) return "alerta";
  return "ok";
}

/**
 * Junta o padrão geral e o ajuste do correspondente (o ajuste vence). Linhas tortas
 * (alerta ≥ crítico, etapa desconhecida) são ignoradas.
 */
export function montarPrazos(
  linhas: { correspondente_id: string | null; etapa: string; dias_alerta: number; dias_critico: number }[],
): PrazosKanban {
  const p: PrazosKanban = {};
  const validas = linhas.filter(
    (l) =>
      colunaDoStatus(l.etapa) === l.etapa &&
      Number.isFinite(l.dias_alerta) &&
      Number.isFinite(l.dias_critico) &&
      l.dias_alerta >= 1 &&
      l.dias_alerta < l.dias_critico,
  );
  for (const l of validas.filter((x) => !x.correspondente_id))
    p[l.etapa as PropostaStatus] = { dias_alerta: l.dias_alerta, dias_critico: l.dias_critico };
  for (const l of validas.filter((x) => x.correspondente_id))
    p[l.etapa as PropostaStatus] = { dias_alerta: l.dias_alerta, dias_critico: l.dias_critico };
  return p;
}

/* ───────────────────────── Assinantes (Agilliza Tech) ───────────────────────── */

/** Situação da proposta do assinante → coluna do kanban. */
const STATUS_ASSINANTE: Record<string, PropostaStatus> = {
  aguardando_correspondente: "rascunho",
  em_envio: "enviada_banco",
  enviada: "enviada_banco",
  em_analise: "enviada_banco",
  aprovada: "credito_aprovado",
  condicionada: "credito_aprovado",
  recusada: "credito_recusado",
  formularios: "formularios",
  aguardando_documentos: "aguardando_documentos",
  engenharia_vistoria: "engenharia_vistoria",
  analise_juridica: "analise_juridica",
  contrato: "contrato_emitido",
  registrado: "registrado",
  erro_envio: "erro_envio",
  cancelada: "cancelada",
};

export function colunaDoStatusAssinante(status: string | null | undefined): PropostaStatus | null {
  return status ? (STATUS_ASSINANTE[status] ?? null) : null;
}

/* ───────────────────────── Somatórios ───────────────────────── */

export function resumoColuna<T extends { valor_financiamento?: number | string | null }>(
  cartoes: T[],
): { quantidade: number; soma: number } {
  let soma = 0;
  for (const c of cartoes) {
    const v = Number(c.valor_financiamento);
    if (Number.isFinite(v)) soma += v;
  }
  return { quantidade: cartoes.length, soma };
}

export function ehTerminal(status: string): boolean {
  return STATUS_TERMINAIS.includes(status as PropostaStatus) && status !== "contrato_emitido";
}
