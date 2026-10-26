/**
 * Controle de matrículas — regras puras (sem rede nem banco) usadas pela tela e testadas
 * à parte. Quem decide de verdade é o banco (migração 20261027040021); aqui é só o que a
 * tela mostra e oferece.
 *
 * Fluxo: pedida → em_andamento → [aguardando_recarga] → concluida → paga. Ou cancelada.
 */
export type StatusMatricula = "pedida" | "em_andamento" | "aguardando_recarga" | "concluida" | "cancelada";
export type TipoSolicitante = "usuario" | "assinante" | "externo";

export const ROTULO_STATUS: Record<StatusMatricula, string> = {
  pedida: "Pedida",
  em_andamento: "Em andamento",
  aguardando_recarga: "Aguardando recarga",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const STATUS_ABERTOS: StatusMatricula[] = ["pedida", "em_andamento", "aguardando_recarga"];

export interface LinhaMatricula {
  status: StatusMatricula;
  solicitante: string;
  corretor: string | null;
  solicitante_tipo: TipoSolicitante;
  solicitante_conta_nome: string | null;
  analista_id: string | null;
  valor: number;
  reembolsado: boolean;
}

/** Quem pediu (e deve pagar). Registro antigo: quem pediu estava em "corretor". */
export function nomeDoSolicitante(s: LinhaMatricula): string {
  if (s.solicitante_tipo === "assinante") return s.solicitante_conta_nome || s.solicitante;
  if (s.solicitante_tipo === "usuario") return s.solicitante;
  return s.corretor?.trim() || s.solicitante;
}

export function rotuloOrigem(s: Pick<LinhaMatricula, "solicitante_tipo" | "solicitante_conta_nome">): string {
  if (s.solicitante_tipo === "assinante") return `Assinante: ${s.solicitante_conta_nome ?? "conta"}`;
  if (s.solicitante_tipo === "usuario") return "Agilliza";
  return "Registro manual";
}

export type AcaoMatricula =
  | "assumir"
  | "aguardar_recarga"
  | "concluir"
  | "cancelar"
  | "marcar_paga"
  | "desfazer_pagamento";

/** O que a pessoa pode fazer com o pedido agora (o banco confere de novo). */
export function acoesDisponiveis(s: LinhaMatricula, eu: string | null, podeEditar: boolean): AcaoMatricula[] {
  if (!podeEditar) return [];
  const doOutro = s.analista_id !== null && s.analista_id !== eu;
  const acoes: AcaoMatricula[] = [];
  if (STATUS_ABERTOS.includes(s.status)) {
    if (!doOutro && (s.analista_id === null || s.status === "pedida")) acoes.push("assumir");
    if (!doOutro && s.status !== "aguardando_recarga") acoes.push("aguardar_recarga");
    if (!doOutro) acoes.push("concluir");
    acoes.push("cancelar");
  }
  if (s.status === "concluida") acoes.push(s.reembolsado ? "desfazer_pagamento" : "marcar_paga");
  return acoes;
}

export interface ResumoMatriculas {
  abertos: number;
  aguardandoRecarga: number;
  aReceber: number;
  recebido: number;
}

export function resumir(lista: LinhaMatricula[]): ResumoMatriculas {
  let abertos = 0;
  let aguardandoRecarga = 0;
  let aReceber = 0;
  let recebido = 0;
  for (const s of lista) {
    if (STATUS_ABERTOS.includes(s.status)) abertos++;
    if (s.status === "aguardando_recarga") aguardandoRecarga++;
    if (s.status === "concluida") {
      if (s.reembolsado) recebido += Number(s.valor);
      else aReceber += Number(s.valor);
    }
  }
  return { abertos, aguardandoRecarga, aReceber: arred(aReceber), recebido: arred(recebido) };
}

function arred(n: number): number {
  return Math.round(n * 100) / 100;
}

export const TIPOS_ARQUIVO = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const TETO_ARQUIVO = 20 * 1024 * 1024;

/** Arquivo da matrícula ou do comprovante: PDF ou imagem, até 20 MB. Devolve o erro ou null. */
export function erroDoArquivo(arquivo: { type: string; size: number; name: string }): string | null {
  const mime = (arquivo.type || "").split(";")[0]!.trim().toLowerCase();
  if (!(TIPOS_ARQUIVO as readonly string[]).includes(mime)) return "Envie PDF, JPG, PNG ou WebP.";
  if (arquivo.size <= 0) return "O arquivo está vazio.";
  if (arquivo.size > TETO_ARQUIVO) return "O arquivo passa de 20 MB.";
  return null;
}

/** Nome seguro para o caminho no armazenamento (sem barra, sem acento, curto). */
export function nomeSeguro(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(-80);
  return limpo || "arquivo";
}

/** Custo digitado ("1.234,56") → número. Inválido ou fora da faixa → null. */
export function custoValido(texto: string): number | null {
  if (texto.includes("-")) return null;
  const n = Number(texto.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 100_000) return null;
  return Math.round(n * 100) / 100;
}
