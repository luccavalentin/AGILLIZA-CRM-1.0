/**
 * CÓPIA FIEL de `packages/integrations/src/apifull/resumo.ts` do Agilliza Tech (26/10/2026): a Consulta
 * Ficha do correspondente usa o mesmo fornecedor e o mesmo resumo. Mudou lá, mude aqui (o teste
 * `apifull-ficha.test.ts` cobre os mesmos casos).
 */

export type ResumoConsulta = {
  /** Score de 0 a 1000, quando o corpo traz um número reconhecível. */
  score: number | null;
  /** Faixa ou classificação de risco, como o fornecedor escreveu. */
  faixa: string | null;
  /** Nome ou razão social do titular. */
  nome: string | null;
  /** Situação do documento na Receita (regular, suspenso…). */
  situacao: string | null;
  /** Pendências financeiras / negativações (PEFIN, REFIN, dívidas). null = não informado. */
  pendencias: number | null;
  protestos: number | null;
  cheques: number | null;
  acoes: number | null;
  /** Soma dos valores em aberto que deu para ler, em reais. */
  valorTotal: number | null;
};

const MAX_PROFUNDIDADE = 6;

type No = { chave: string; valor: unknown; caminho: string };

/** Achata o corpo em pares (chave, valor) com o caminho, até uma profundidade segura. */
function percorrer(raiz: unknown): No[] {
  const saida: No[] = [];
  const visitar = (v: unknown, caminho: string, prof: number) => {
    if (!v || typeof v !== "object" || prof > MAX_PROFUNDIDADE) return;
    if (Array.isArray(v)) {
      v.forEach((x, i) => visitar(x, `${caminho}[${i}]`, prof + 1));
      return;
    }
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const c = caminho ? `${caminho}.${k}` : k;
      saida.push({ chave: k, valor: x, caminho: c });
      visitar(x, c, prof + 1);
    }
  };
  visitar(raiz, "", 0);
  return saida;
}

function numero(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.trim().replace(/^R\$\s*/i, "");
    if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(t))
      return Number(t.replace(/\./g, "").replace(",", "."));
    if (/^-?\d+([.,]\d+)?$/.test(t)) return Number(t.replace(",", "."));
  }
  return null;
}

function texto(v: unknown): string | null {
  if (typeof v === "string" && v.trim() && v.trim().length <= 160) return v.trim();
  return null;
}

/** Conta uma categoria: lista com o nome dela, ou campo de quantidade/total com o nome dela. */
function contar(nos: No[], nome: RegExp): number | null {
  let achou = false;
  let total = 0;
  for (const n of nos) {
    if (!nome.test(n.chave)) continue;
    if (Array.isArray(n.valor)) {
      achou = true;
      total += n.valor.length;
    }
  }
  if (achou) return total;
  for (const n of nos) {
    if (!nome.test(n.caminho)) continue;
    if (/quantidade|qtd|total|ocorr/i.test(n.chave)) {
      const x = numero(n.valor);
      if (x !== null && x >= 0) {
        achou = true;
        total += x;
      }
    }
  }
  return achou ? total : null;
}

/** Lê o resumo do corpo da APIFull (com ou sem o envelope `{ status, dados }`). */
export function resumirConsulta(corpo: unknown): ResumoConsulta {
  const dados =
    corpo && typeof corpo === "object" && "dados" in (corpo as object)
      ? (corpo as { dados: unknown }).dados
      : corpo;
  const nos = percorrer(dados);

  let score: number | null = null;
  for (const n of nos) {
    if (!/score|pontua/i.test(n.chave) || /data|modelo|tipo|motivo|descri/i.test(n.chave)) continue;
    const x = numero(n.valor);
    if (x !== null && x >= 0 && x <= 1000) {
      score = Math.round(x);
      break;
    }
    if (n.valor && typeof n.valor === "object" && !Array.isArray(n.valor)) {
      for (const [k, v] of Object.entries(n.valor as Record<string, unknown>)) {
        const y = /score|pontua|valor|value|numero/i.test(k) ? numero(v) : null;
        if (y !== null && y >= 0 && y <= 1000) {
          score = Math.round(y);
          break;
        }
      }
      if (score !== null) break;
    }
  }

  const primeiroTexto = (re: RegExp, evitar?: RegExp) => {
    for (const n of nos) {
      if (re.test(n.chave) && !(evitar && evitar.test(n.chave))) {
        const t = texto(n.valor);
        if (t) return t;
      }
    }
    return null;
  };

  const faixa = primeiroTexto(/faixa|classifica|risco|rating/i, /data|motivo|codigo|c[oó]d/i);
  const nome = primeiroTexto(
    /^(nome|nome_?completo|razao_?social|razaoSocial|nomeRazaoSocial|nome_razao_social)$/i,
  );
  const situacao = primeiroTexto(/situa[cç][aã]o(_?cadastral|_?receita|_?cpf|_?cnpj)?$/i);

  const pendencias = contar(nos, /pend[eê]ncia|negativa|pefin|refin|d[ií]vida|restri[cç]/i);
  const protestos = contar(nos, /protesto/i);
  const cheques = contar(nos, /cheque/i);
  const acoes = contar(nos, /a[cç][oõ]es|a[cç][aã]o_?judicial|falenc|recupera/i);

  let valorTotal: number | null = null;
  for (const n of nos) {
    if (/valor_?total|total_?d[ií]vidas?|valorTotal|total_?pend/i.test(n.chave)) {
      const x = numero(n.valor);
      if (x !== null && x >= 0) {
        valorTotal = (valorTotal ?? 0) + x;
      }
    }
  }

  return { score, faixa, nome, situacao, pendencias, protestos, cheques, acoes, valorTotal };
}
