/**
 * Quando uma simulação nova pode entrar numa oportunidade que já existe.
 *
 * A HomeFin modela UMA oportunidade (o negócio: imóvel, valores, participantes)
 * com N simulações dentro, uma por banco. O Agilliza criava uma oportunidade a
 * cada envio: em 30 dias foram 3.111 oportunidades para 693 clientes (média
 * 4,49; um cliente chegou a 31). Isso fragmenta o histórico do negócio do lado
 * da HomeFin.
 *
 * A regra aqui é deliberadamente conservadora: na menor dúvida devolve `null` e
 * o fluxo cria oportunidade nova, que é o comportamento de sempre. Reaproveitar
 * errado é pior do que duplicar — mexeria numa oportunidade que o banco já está
 * analisando.
 */

/** Situação da oportunidade na HomeFin: A=Ativa, T=Contrato Emitido, C=Cancelada. */
export type TipoSituacaoOportunidade = "A" | "T" | "C" | string;

/**
 * Situação da simulação na HomeFin.
 * S=Sem Integração, P=Erro ao Enviar Proposta, N=Análise Crédito,
 * A=Crédito Aprovado, R=Crédito Recusado.
 */
export type TipoSituacaoSimulacao = "S" | "P" | "N" | "A" | "R" | string;

/** Situações que significam "já tem proposta viva no banco". */
const SIMULACAO_EM_ANDAMENTO: ReadonlySet<string> = new Set(["N", "A"]);

export interface CandidataOportunidade {
  /** Id da oportunidade na HomeFin. */
  homefin_id_oportunidade: string | null;
  codigo_oportunidade_homefin?: string | null;
  cliente_id: string | null;
  produto: string | null;
  tipo_pessoa?: string | null;
  cep_imovel?: string | null;
  /** Operação da HomeFin (produto no provedor). */
  id_operacao_homefin?: number | string | null;
}

export interface SimulacaoNova {
  cliente_id: string | null;
  produto: string | null;
  tipo_pessoa?: string | null;
  cep_imovel?: string | null;
  id_operacao_homefin?: number | string | null;
}

export interface SituacaoNaHomeFin {
  tipoSituacao?: TipoSituacaoOportunidade | null;
  simulacoes?: Array<{ tipoSituacao?: TipoSituacaoSimulacao | null }> | null;
}

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const texto = (v: unknown) => String(v ?? "").trim().toLowerCase();

/**
 * O mesmo negócio? Exige cliente, produto/operação, modalidade e imóvel iguais.
 *
 * CEP ausente nos dois lados não impede — muita simulação nasce antes de o
 * cliente escolher o imóvel. Mas CEP diferente impede: aí é outro negócio.
 */
export function ehMesmoNegocio(candidata: CandidataOportunidade, nova: SimulacaoNova): boolean {
  if (!candidata.homefin_id_oportunidade) return false;
  if (!candidata.cliente_id || !nova.cliente_id) return false;
  if (candidata.cliente_id !== nova.cliente_id) return false;
  if (texto(candidata.produto) !== texto(nova.produto)) return false;

  const modalidadeA = texto(candidata.tipo_pessoa) || "pf";
  const modalidadeB = texto(nova.tipo_pessoa) || "pf";
  if (modalidadeA !== modalidadeB) return false;

  // Operação diferente no provedor é outro produto — não pode dividir oportunidade.
  const opA = soDigitos(candidata.id_operacao_homefin);
  const opB = soDigitos(nova.id_operacao_homefin);
  if (opA && opB && opA !== opB) return false;

  const cepA = soDigitos(candidata.cep_imovel);
  const cepB = soDigitos(nova.cep_imovel);
  if (cepA && cepB && cepA !== cepB) return false;

  return true;
}

/**
 * A oportunidade ainda aceita simulação nova?
 *
 * Só quando está Ativa e nenhuma simulação dela está em análise ou aprovada —
 * nesses casos o banco já está com a proposta na mão e o `PUT` da oportunidade
 * mudaria dados sob análise. Recusada (R) e erro (P) não impedem: é justamente
 * quando o operador tenta outro banco ou outra condição.
 */
export function oportunidadeAceitaNovaSimulacao(situacao: SituacaoNaHomeFin | null): boolean {
  if (!situacao) return false;
  const tipo = String(situacao.tipoSituacao ?? "").toUpperCase();
  if (tipo !== "A") return false;
  const simulacoes = situacao.simulacoes ?? [];
  return !simulacoes.some((s) => SIMULACAO_EM_ANDAMENTO.has(String(s?.tipoSituacao ?? "").toUpperCase()));
}

/**
 * Decisão final: devolve o id da oportunidade a reaproveitar, ou `null` para
 * criar uma nova.
 */
export function decidirOportunidade(
  candidata: CandidataOportunidade | null,
  nova: SimulacaoNova,
  situacao: SituacaoNaHomeFin | null,
): string | null {
  if (!candidata) return null;
  if (!ehMesmoNegocio(candidata, nova)) return null;
  if (!oportunidadeAceitaNovaSimulacao(situacao)) return null;
  return candidata.homefin_id_oportunidade;
}
