/**
 * Rótulos do RH exibidos ao usuário. Um só lugar para todas as telas:
 * antes a mesma situação aparecia como "Experiência" numa tela e
 * "Em experiência" em outra, e tipos de ocorrência saíam sem acento.
 * Os valores gravados no banco não mudam.
 */
import type { StatusFuncionario, TipoContrato } from "@/lib/rh/funcionarios.functions";
import type { FeriasStatus, LancamentoStatus, OcorrenciaTipo } from "@/lib/rh/submodulos.functions";

export const STATUS_FUNCIONARIO_LABEL: Record<StatusFuncionario, string> = {
  ativo: "Ativo",
  experiencia: "Em experiência",
  afastado: "Afastado",
  ferias: "Em férias",
  desligado: "Desligado",
};

export const CONTRATO_LABEL: Record<TipoContrato, string> = {
  clt: "CLT",
  pj: "PJ",
  estagio: "Estágio",
  autonomo: "Autônomo",
  temporario: "Temporário",
  aprendiz: "Aprendiz",
};

export const FERIAS_STATUS_LABEL: Record<FeriasStatus, string> = {
  planejada: "Planejada",
  aprovada: "Aprovada",
  em_curso: "Em curso",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const LANCAMENTO_STATUS_LABEL: Record<LancamentoStatus, string> = {
  previsto: "Previsto",
  recebido: "Recebido",
  descontado: "Descontado",
  pago: "Pago",
  cancelado: "Cancelado",
};

export const OCORRENCIA_LABEL: Record<OcorrenciaTipo, string> = {
  falta: "Falta",
  atestado: "Atestado",
  advertencia: "Advertência",
  licenca: "Licença",
  suspensao: "Suspensão",
  elogio: "Elogio",
  outro: "Outro",
};

/** Rótulo de um valor; cai no próprio valor se não houver mapeamento. */
export function rotulo(mapa: Record<string, string>, valor: string | null | undefined): string {
  if (!valor) return "—";
  return mapa[valor] ?? valor;
}
