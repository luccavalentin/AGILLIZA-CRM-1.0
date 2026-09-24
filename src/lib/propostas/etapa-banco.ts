/**
 * Tradução do nome da etapa do funil do banco (retorno da HomeFin em
 * `GET /oportunidade/{id}` → `etapa[].nomeEtapa`) para o status interno.
 * Módulo puro: usado no sync (servidor) e no kanban de etapas (cliente).
 */
import type { PropostaStatus } from "./state-machine";

/** Deriva o status interno a partir do nome da etapa ativa retornada pelo banco. */
export function statusDaEtapa(nomeEtapa: string | null): PropostaStatus | null {
  if (!nomeEtapa) return null;
  const n = nomeEtapa.toLowerCase();
  // Recusa/negativa de crédito encerra o fluxo — checar ANTES de "aprov"/"análise"
  // para o status não ficar preso em "em_analise_credito" (polling infinito).
  if (
    n.includes("recus") ||
    n.includes("negad") ||
    n.includes("negat") ||
    n.includes("reprov") ||
    n.includes("indefer") ||
    n.includes("nao aprov") ||
    n.includes("não aprov")
  )
    return "credito_recusado";
  // Registro é etapa própria no provedor, depois do contrato emitido.
  if (n.includes("registr")) return "registrado";
  if (n.includes("contrato")) return "contrato_emitido";
  if (n.includes("juríd") || n.includes("jurid") || n.includes("emiss")) return "analise_juridica";
  if (n.includes("vistoria") || n.includes("engenharia") || n.includes("avaliaç"))
    return "engenharia_vistoria";
  if (n.includes("document")) return "aguardando_documentos";
  // Antes de "aprov": "aprovado com condições" contém as duas palavras.
  if (n.includes("condicion") || n.includes("ressalva")) return "credito_condicionado";
  if (n.includes("aprov")) return "credito_aprovado";
  if (
    n.includes("análise") ||
    n.includes("analise") ||
    n.includes("crédito") ||
    n.includes("credito")
  )
    return "em_analise_credito";
  return null;
}
