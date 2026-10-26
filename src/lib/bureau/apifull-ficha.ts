/**
 * Relatório Serasa Premium (APIFull, pelo Agilliza Tech) → ficha do Agilliza (`FichaBureau`).
 *
 * O corpo da APIFull não tem formato fixo ("os campos dependem da base consultada"): o resumo é o
 * mesmo do Agilliza Tech (`apifull-resumo.ts`). O que não dá para ler fica nulo — a tela diz "não
 * informado", nunca "nada consta" por engano. Puro (sem rede, sem banco): testado em
 * `apifull-ficha.test.ts`.
 */
import { resumirConsulta, type ResumoConsulta } from "./apifull-resumo";
import type { FichaBureau, RestricaoBureau, ScoreBureau, SituacaoCadastral } from "./tipos";

export interface ResultadoDaPlataforma {
  /** Score e faixa já gravados pelo worker na conclusão. */
  score?: number | null;
  faixa?: string | null;
  /** Resumo gravado pelo worker (nome, pendências, protestos, cheques, ações, apontamentos). */
  resumo?: Record<string, unknown> | null;
  /** Corpo devolvido pelo fornecedor (decifrado pela plataforma só para quem pediu). */
  resultado?: unknown;
  concluida_em?: string | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

function faixaDoScore(score: number | null): ScoreBureau["faixa"] {
  if (score == null) return null;
  if (score < 300) return "muito_baixo";
  if (score < 500) return "baixo";
  if (score < 700) return "medio";
  if (score < 850) return "alto";
  return "muito_alto";
}

function situacao(texto: string | null): SituacaoCadastral {
  const t = (texto ?? "").toLowerCase();
  if (!t) return "desconhecida";
  if (/regular|ativa/.test(t)) return "regular";
  if (/suspens/.test(t)) return "suspensa";
  if (/cancel|baixad|nula|inapta/.test(t)) return "cancelada";
  if (/pend/.test(t)) return "pendente";
  return "desconhecida";
}

/** Uma linha por categoria contada (o relatório não traz o detalhe de forma estável). */
function restricoesDoResumo(r: ResumoConsulta): RestricaoBureau[] {
  const linhas: [number | null, string, string][] = [
    [r.pendencias, "Serasa", "Pendências financeiras"],
    [r.protestos, "Cartório", "Protestos"],
    [r.cheques, "Banco Central", "Cheques sem fundo"],
    [r.acoes, "Judicial", "Ações judiciais e falências"],
  ];
  return linhas
    .filter(([n]) => n != null && n > 0)
    .map(([n, origem, tipo]) => ({
      origem,
      tipo,
      descricao: `${n} ocorrência${n === 1 ? "" : "s"} no relatório`,
      valor: null,
      credor: null,
      data: null,
      local: null,
    }));
}

export function fichaDaApifull(
  documento: string,
  r: ResultadoDaPlataforma,
  agora: () => string = () => new Date().toISOString(),
): FichaBureau {
  const lido = resumirConsulta(r.resultado ?? {});
  const gravado = (r.resumo ?? {}) as Record<string, unknown>;
  const resumo: ResumoConsulta = {
    score: num(r.score) ?? lido.score,
    faixa: r.faixa ?? lido.faixa,
    nome: (typeof gravado.nome === "string" && gravado.nome) || lido.nome,
    situacao: lido.situacao,
    pendencias: num(gravado.pendencias) ?? lido.pendencias,
    protestos: num(gravado.protestos) ?? lido.protestos,
    cheques: num(gravado.cheques) ?? lido.cheques,
    acoes: num(gravado.acoes) ?? lido.acoes,
    valorTotal: lido.valorTotal,
  };
  const score = resumo.score != null && resumo.score >= 0 && resumo.score <= 1000 ? resumo.score : null;
  const contados = [resumo.pendencias, resumo.protestos, resumo.cheques, resumo.acoes].filter(
    (n): n is number => n != null,
  );
  const apontamentos = num(gravado.apontamentos);
  const doc = documento.replace(/\D/g, "");
  return {
    documento: doc,
    tipoPessoa: doc.length > 11 ? "J" : "F",
    nome: resumo.nome,
    nascimentoOuFundacao: null,
    situacaoCadastral: situacao(resumo.situacao),
    score:
      score == null
        ? null
        : { valor: score, maximo: 1000, faixa: faixaDoScore(score), probabilidadeInadimplencia: null, modelo: resumo.faixa },
    restricoes: restricoesDoResumo(resumo),
    totalRestricoes: apontamentos ?? (contados.length ? contados.reduce((a, b) => a + b, 0) : 0),
    valorTotalRestricoes: resumo.valorTotal ?? 0,
    consultasAnteriores: [],
    participacoes: [],
    contatos: [],
    rendaPresumida: null,
    consultadoEm: r.concluida_em ?? agora(),
    provedor: "Serasa Premium",
  };
}
