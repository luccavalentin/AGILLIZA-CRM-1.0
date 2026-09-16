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

/**
 * Teto de simulações numa oportunidade. Em 16/09 um cliente reenviado em
 * sequência empilhou 58 simulações numa só oportunidade.
 */
export const MAX_SIMULACOES_POR_OPORTUNIDADE = 20;

/**
 * Valores que ficam CONGELADOS na oportunidade quando ela é criada: renda,
 * composição de renda, sistema de amortização e valores. Reaproveitar não
 * reenvia nada disso — por isso só vale quando a simulação nova tem exatamente
 * os mesmos valores da simulação que CRIOU a oportunidade.
 *
 * Sem esta checagem, em 16/09 as simulações PRICE entraram em oportunidades
 * criadas por simulações SAC e o Bradesco passou a recusar toda PRICE com
 * "Renda mensal menor que renda mínima" (código 119) — no dia anterior eram
 * 11 PRICE aceitas e nenhuma recusa.
 */
interface ValoresCongelados {
  sistema_amortizacao?: string | null;
  renda_total?: number | string | null;
  renda_conjuge?: number | string | null;
  compoe_renda_conjuge?: boolean | null;
  possui_conjuge?: boolean | null;
  valor_imovel?: number | string | null;
  valor_financiamento?: number | string | null;
  utiliza_fgts?: string | null;
}

/** A simulação que criou a oportunidade (a mais antiga com aquele id). */
export interface CandidataOportunidade extends ValoresCongelados {
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

export interface SimulacaoNova extends ValoresCongelados {
  cliente_id: string | null;
  produto: string | null;
  tipo_pessoa?: string | null;
  cep_imovel?: string | null;
  id_operacao_homefin?: number | string | null;
}

export interface SituacaoNaHomeFin {
  tipoSituacao?: TipoSituacaoOportunidade | null;
  simulacoes?: Array<{
    tipoSituacao?: TipoSituacaoSimulacao | null;
    valorParcelaBanco?: number | string | null;
  }> | null;
}

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
/** Centavos, para comparar "33000" com 33000.00 sem ruído de ponto flutuante. */
const centavos = (v: unknown) => Math.round((Number(v) || 0) * 100);

/**
 * Os valores gravados na criação da oportunidade continuam valendo para a
 * simulação nova? Renda da composição só conta quando há composição.
 */
export function valoresCongeladosIguais(a: ValoresCongelados, b: ValoresCongelados): boolean {
  const sistema = (v: unknown) => (String(v ?? "").toUpperCase() === "P" ? "P" : "S");
  if (sistema(a.sistema_amortizacao) !== sistema(b.sistema_amortizacao)) return false;
  if (centavos(a.renda_total) !== centavos(b.renda_total)) return false;
  if (centavos(a.valor_imovel) !== centavos(b.valor_imovel)) return false;
  if (centavos(a.valor_financiamento) !== centavos(b.valor_financiamento)) return false;
  if (Boolean(a.possui_conjuge) !== Boolean(b.possui_conjuge)) return false;
  const compoeA = Boolean(a.possui_conjuge && a.compoe_renda_conjuge);
  const compoeB = Boolean(b.possui_conjuge && b.compoe_renda_conjuge);
  if (compoeA !== compoeB) return false;
  if (compoeA && centavos(a.renda_conjuge) !== centavos(b.renda_conjuge)) return false;
  const fgts = (v: unknown) => (String(v ?? "N").toUpperCase() === "S" ? "S" : "N");
  if (fgts(a.utiliza_fgts) !== fgts(b.utiliza_fgts)) return false;
  return true;
}
const texto = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase();

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

  return valoresCongeladosIguais(candidata, nova);
}

/**
 * A oportunidade ainda aceita simulação nova?
 *
 * Só quando está Ativa e nenhuma simulação dela está em análise ou aprovada —
 * nesses casos o banco já está com a proposta na mão e o `PUT` da oportunidade
 * mudaria dados sob análise.
 *
 * Também recusa quando alguma simulação ficou SEM PARCELA: o banco recusou,
 * não respondeu ou o provedor nem despachou. "P" não serve de sinal — é o
 * estado de toda simulação sem proposta, inclusive as que deram certo. Antes
 * do reaproveitamento, reenviar criava oportunidade nova, e isso é o que a
 * própria mensagem de erro recomenda ("reenvie uma vez"). Em 16/09 as 21
 * tentativas do Santander de um cliente caíram na mesma oportunidade quebrada
 * e nenhuma foi despachada ao banco.
 */
export function oportunidadeAceitaNovaSimulacao(situacao: SituacaoNaHomeFin | null): boolean {
  if (!situacao) return false;
  const tipo = String(situacao.tipoSituacao ?? "").toUpperCase();
  if (tipo !== "A") return false;
  const simulacoes = situacao.simulacoes ?? [];
  if (simulacoes.length >= MAX_SIMULACOES_POR_OPORTUNIDADE) return false;
  if (
    simulacoes.some((s) => SIMULACAO_EM_ANDAMENTO.has(String(s?.tipoSituacao ?? "").toUpperCase()))
  )
    return false;
  return simulacoes.every((s) => Number(s?.valorParcelaBanco) > 0);
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
