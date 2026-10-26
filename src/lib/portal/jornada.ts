/**
 * Regras puras do portal do cliente do correspondente (C15): como a jornada, o status
 * da proposta e o ID aparecem para o cliente. Sem acesso a banco — testável.
 */

export type StatusEtapa = "concluida" | "atual" | "proxima";

export interface EtapaJornada {
  ordem: number;
  codigo: string;
  nome: string;
  descricao_cliente: string | null;
  status: StatusEtapa;
  concluida_em: string | null;
  data_marco?: string | null;
}

/** A etapa de agora (a primeira "atual"; sem nenhuma, a primeira não concluída). */
export function etapaAtual(etapas: EtapaJornada[]): EtapaJornada | null {
  return etapas.find((e) => e.status === "atual") ?? etapas.find((e) => e.status !== "concluida") ?? null;
}

/** Quanto da jornada já foi feito, de 0 a 100. */
export function progressoJornada(etapas: EtapaJornada[]): number {
  if (!etapas.length) return 0;
  const feitas = etapas.filter((e) => e.status === "concluida").length;
  return Math.round((feitas / etapas.length) * 100);
}

/** Nome da etapa para o cliente: "Contrato Emitido" vira "Contrato emitido". */
export function nomeEtapa(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  return palavras
    .map((p, i) => {
      if (i === 0) return p[0].toUpperCase() + p.slice(1);
      // "Emitido" → "emitido"; siglas ("FGTS") ficam como estão.
      return /^[A-ZÀ-Ý][a-zà-ÿ]+$/.test(p) ? p.toLowerCase() : p;
    })
    .join(" ");
}

export type TomStatus = "sucesso" | "info" | "alerta" | "neutro" | "perigo";

/** Status da proposta na linguagem do cliente (nunca o código interno nem a integração). */
const STATUS_PROPOSTA: Record<string, { rotulo: string; tom: TomStatus }> = {
  credito_aprovado: { rotulo: "Crédito aprovado", tom: "sucesso" },
  credito_condicionado: { rotulo: "Aprovado com condições", tom: "alerta" },
  formularios: { rotulo: "Formulários do banco", tom: "info" },
  aguardando_documentos: { rotulo: "Coleta de documentos", tom: "info" },
  checklist_documentacao: { rotulo: "Coleta de documentos", tom: "info" },
  cadastro_complementar: { rotulo: "Coleta de documentos", tom: "info" },
  dossie_completo: { rotulo: "Coleta de documentos", tom: "info" },
  envio_documentos_banco: { rotulo: "Coleta de documentos", tom: "info" },
  engenharia_vistoria: { rotulo: "Vistoria do imóvel", tom: "info" },
  vistoria_agendamento: { rotulo: "Vistoria do imóvel", tom: "info" },
  vistoria_concluida: { rotulo: "Vistoria do imóvel", tom: "info" },
  analise_juridica: { rotulo: "Análise jurídica", tom: "info" },
  emissao_contrato: { rotulo: "Emissão do contrato", tom: "info" },
  contrato_emitido: { rotulo: "Contrato emitido", tom: "sucesso" },
  registrado: { rotulo: "Contrato registrado", tom: "sucesso" },
  cancelada: { rotulo: "Cancelada", tom: "neutro" },
  credito_recusado: { rotulo: "Não aprovada", tom: "perigo" },
};

export function statusProposta(status: string | null | undefined): { rotulo: string; tom: TomStatus } {
  return (status && STATUS_PROPOSTA[status]) || { rotulo: "Em andamento", tom: "info" };
}

/**
 * O identificador da proposta do correspondente aparece como "ID H." e o da simulação
 * como "ID" — nunca o nome da integração.
 */
export function rotuloIdProposta(id: string | number | null | undefined): string | null {
  const v = String(id ?? "").trim();
  return v ? `ID H. ${v}` : null;
}

export function rotuloIdSimulacao(id: string | number | null | undefined): string | null {
  const v = String(id ?? "").trim();
  return v ? `ID ${v}` : null;
}

/** Tipos de arquivo aceitos no envio pelo cliente (o mesmo que a equipe aceita). */
export const TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const TAMANHO_MAXIMO = 10 * 1024 * 1024;

export function problemaNoArquivo(arq: { size: number; type: string; name: string }): string | null {
  if (arq.size <= 0) return "O arquivo está vazio.";
  if (arq.size > TAMANHO_MAXIMO) return "O arquivo passa de 10 MB. Tire uma foto menor ou envie em PDF.";
  const ext = arq.name.split(".").pop()?.toLowerCase() ?? "";
  const porExtensao = ["pdf", "jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext);
  if (!TIPOS_ACEITOS.includes(arq.type) && !porExtensao) return "Envie PDF ou foto (JPG, PNG, WEBP ou HEIC).";
  return null;
}

/** Primeiro nome para o "Olá, Ana". */
export function primeiroNome(nome: string | null | undefined): string {
  const p = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : "";
}

/** Saudação pela hora de Brasília. */
export function saudacao(agora: Date = new Date()): string {
  const h = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(agora),
  );
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}
