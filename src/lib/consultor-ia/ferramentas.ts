/**
 * Roteador determinístico de ferramentas do Consultor IA (C18).
 *
 * Antes de a pergunta ir para o modelo, o sistema reconhece pedidos de conta (parcela,
 * SAC/PRICE, comprometimento de renda, quanto dá para financiar, ITBI/cartório), extrai os
 * números do texto em português ("R$ 500 mil", "30 anos", "10,5% a.a.", "renda de 12 mil")
 * e CALCULA. O resultado entra no prompt como bloco de cálculo do sistema, que o modelo é
 * instruído a usar literalmente, e aparece na tela como cartão — o número nunca é inventado.
 * Falta um dado (ex.: a taxa)? O sistema pede, em vez de supor.
 *
 * Também detecta pergunta que depende de dado ATUAL (taxa de hoje, Selic, teto vigente…):
 * sem base de conhecimento cobrindo, a resposta avisa.
 *
 * Client-safe.
 */
import {
  brl,
  comprometimento,
  custosAquisicao,
  financiamentoMaximo,
  pct,
  simular,
  simulacaoEmMarkdown,
  type Custos,
  type ParametrosCalculo,
  type Simulacao,
  type SistemaAmortizacao,
} from "./calculos";

export type ResultadoFerramenta =
  | { tipo: "simulacao"; titulo: string; dados: Simulacao; markdown: string }
  | {
      tipo: "comprometimento";
      titulo: string;
      dados: { parcela: number; renda: number; percentual: number; limite: number; dentro: boolean };
      markdown: string;
    }
  | {
      tipo: "capacidade";
      titulo: string;
      dados: { renda: number; limite: number; sistema: SistemaAmortizacao; taxa_anual: number; meses: number; parcela_maxima: number; valor_maximo: number };
      markdown: string;
    }
  | { tipo: "custos"; titulo: string; dados: Custos; markdown: string }
  | { tipo: "faltando"; titulo: string; dados: { faltam: string[] }; markdown: string };

function normalizar(t: string) {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** "1.234,56" / "1234.56" / "500" → número. */
function numeroBr(s: string): number {
  const limpo = s.trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(limpo)) return Number(limpo.replace(/\./g, "").replace(",", "."));
  if (/^\d+,\d+$/.test(limpo)) return Number(limpo.replace(",", "."));
  return Number(limpo.replace(/,/g, ""));
}

const MULT: Record<string, number> = { mil: 1e3, k: 1e3, milhao: 1e6, milhoes: 1e6, mi: 1e6, mm: 1e6 };

/** Valores em dinheiro com a posição no texto e as palavras que vêm logo antes. */
export function valoresMonetarios(texto: string): Array<{ valor: number; antes: string; pos: number }> {
  const t = normalizar(texto);
  const re = /(r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)\s*(mil|k|milhao|milhoes|mi|mm)?\b/g;
  const out: Array<{ valor: number; antes: string; pos: number }> = [];
  let m: RegExpExecArray | null;
  // O rótulo de um valor é o texto entre o número anterior e ele (no máximo 40 caracteres):
  // em "imóvel de R$ 500 mil com entrada de R$ 100 mil", o 100 mil é "entrada", não "imóvel".
  let fimAnterior = 0;
  while ((m = re.exec(t))) {
    const inicioRotulo = Math.max(fimAnterior, m.index - 40);
    fimAnterior = m.index + m[0].length;
    const depois = t.slice(m.index + m[0].length, m.index + m[0].length + 8);
    // Percentual, prazo e anos não são dinheiro.
    if (/^\s*(%|por cento|a\.?a|a\.?m|anos?|meses|mes|x\b|vezes)/.test(depois)) continue;
    const temMoeda = !!m[1];
    const mult = m[3] ? MULT[m[3]] : 1;
    let v = numeroBr(m[2]!.replace(/\.(?=\d{1,2}$)/, ","));
    if (!Number.isFinite(v)) continue;
    v *= mult ?? 1;
    // Número solto pequeno sem "R$" nem "mil" não é dinheiro (ex.: "2 quartos").
    if (!temMoeda && !m[3] && v < 1000) continue;
    out.push({ valor: v, antes: t.slice(inicioRotulo, m.index), pos: m.index });
  }
  return out;
}

export function extrairTaxa(texto: string): { anual: number; tipo: "efetiva" | "nominal" } | null {
  const t = normalizar(texto);
  const m = /(\d+(?:[.,]\d+)?)\s*%\s*(a\.?\s?a\.?|ao ano|a\.?\s?m\.?|ao mes)?/.exec(t);
  if (!m) return null;
  const valor = Number(m[1]!.replace(",", "."));
  if (!Number.isFinite(valor)) return null;
  const contexto = t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 20);
  // Percentual de entrada / comprometimento não é taxa.
  if (/entrada|compromet|renda|itbi|cartorio|desconto/.test(t.slice(Math.max(0, m.index - 25), m.index))) {
    const outro = /(?:taxa|juros)[^%\d]{0,20}(\d+(?:[.,]\d+)?)\s*%\s*(a\.?\s?a\.?|ao ano|a\.?\s?m\.?|ao mes)?/.exec(t);
    if (!outro) return null;
    return taxaDe(Number(outro[1]!.replace(",", ".")), outro[2] ?? "", t);
  }
  return taxaDe(valor, m[2] ?? "", contexto);
}

function taxaDe(valor: number, sufixo: string, contexto: string): { anual: number; tipo: "efetiva" | "nominal" } | null {
  if (!Number.isFinite(valor) || valor <= 0) return null;
  const mensal = /a\.?\s?m|ao mes/.test(sufixo);
  const tipo = /nominal/.test(contexto) ? "nominal" : "efetiva";
  if (mensal) return { anual: Math.round((Math.pow(1 + valor / 100, 12) - 1) * 10000) / 100, tipo: "efetiva" };
  return valor <= 60 ? { anual: valor, tipo } : null;
}

export function extrairPrazoMeses(texto: string): number | null {
  const t = normalizar(texto);
  const anos = /(\d{1,2})\s*anos/.exec(t);
  if (anos) return Number(anos[1]) * 12;
  const meses = /(\d{2,3})\s*(meses|parcelas|x\b|vezes)/.exec(t);
  if (meses) return Number(meses[1]);
  return null;
}

function extrairEntrada(texto: string, valorImovel: number | null): number | null {
  const t = normalizar(texto);
  const pctEntrada = /entrada[^%\d]{0,15}(\d+(?:[.,]\d+)?)\s*%/.exec(t);
  if (pctEntrada && valorImovel) return (valorImovel * Number(pctEntrada[1]!.replace(",", "."))) / 100;
  return null;
}

const RE_SIMULACAO = /parcel|presta|simul|\bsac\b|\bprice\b|amortiza|financ|quanto (fica|vou pagar|pago)/;
const RE_COMPROMETIMENTO = /compromet|cabe na renda|cabe no orcamento|percentual da renda/;
const RE_CAPACIDADE = /quanto (posso|consigo|da para|da pra|ele pode|ela pode) financ|valor maximo|capacidade|financiamento maximo/;
const RE_CUSTOS = /\bitbi\b|cartorio|escritura|registro do imovel|custos? (de|da|do) (compra|aquisicao|cartorio)|despesas? (de|da) compra/;

/** Pergunta que depende de dado atual (taxa de hoje, Selic, teto vigente, regra nova). */
export function precisaDadoAtual(pergunta: string): boolean {
  const t = normalizar(pergunta);
  return (
    /\b(hoje|atual|atualmente|vigente|agora|neste mes|este mes|esta semana|ultim[ao]s?)\b/.test(t) ||
    /\b(selic|ipca|incc|igp-?m|\btr\b|cdi)\b/.test(t) ||
    /taxa[s]? (de juros )?(da|do|na|no) (caixa|itau|bradesco|santander|banco do brasil|\bbb\b|inter|nubank)/.test(t) ||
    /\b(teto|limite) (do |de )?(mcmv|minha casa|sfh|fgts)/.test(t) ||
    /\b20(2[5-9]|3\d)\b/.test(t)
  );
}

/** Lê a pergunta, calcula o que der e diz o que faltou. */
export function executarFerramentas(pergunta: string, p: ParametrosCalculo): ResultadoFerramenta[] {
  const t = normalizar(pergunta);
  const out: ResultadoFerramenta[] = [];
  const valores = valoresMonetarios(pergunta);
  const renda = valores.find((v) => /renda|ganha|salario|recebe|familiar/.test(v.antes))?.valor ?? null;
  // "parcela de R$ 300 mil" num pedido de simulação é o valor a financiar, não a parcela.
  const parcelaInformada =
    valores.find((v) => /parcela|prestacao/.test(v.antes) && v.valor <= 50_000)?.valor ?? null;
  const imovel =
    valores.find((v) => /imovel|apartamento|casa|vale|valor de compra|avaliad|preco|custa/.test(v.antes))?.valor ?? null;
  const financiadoExplicito = valores.find((v) => /financ|emprest|credito|financiar/.test(v.antes))?.valor ?? null;
  const entradaValor =
    valores.find((v) => /entrada|sinal|recursos proprios|fgts/.test(v.antes))?.valor ?? extrairEntrada(pergunta, imovel);
  const semRotulo = valores.filter((v) => ![renda, parcelaInformada, imovel, financiadoExplicito, entradaValor].includes(v.valor));
  const taxaPergunta = extrairTaxa(pergunta);
  const taxa = taxaPergunta ?? (p.taxa_referencia_anual != null ? { anual: p.taxa_referencia_anual, tipo: "efetiva" as const } : null);
  const meses = extrairPrazoMeses(pergunta);
  const sistemas: SistemaAmortizacao[] = /\bsac\b/.test(t) && !/\bprice\b/.test(t) ? ["SAC"] : /\bprice\b/.test(t) && !/\bsac\b/.test(t) ? ["PRICE"] : ["SAC", "PRICE"];
  const notaSeguros = "\n\n_Sem os seguros obrigatórios (MIP/DFI) e a tarifa de administração, que variam por banco e pela idade do proponente._";

  // Financiamento máximo pela renda.
  if (RE_CAPACIDADE.test(t)) {
    const faltam = [!renda && "renda", !taxa && "taxa de juros anual", !meses && "prazo"].filter(Boolean) as string[];
    if (faltam.length) out.push(faltando(faltam, "Quanto dá para financiar"));
    else {
      for (const s of sistemas) {
        const r = financiamentoMaximo(renda!, taxa!.anual, meses!, s, p.comprometimento_max_percentual, taxa!.tipo);
        out.push({
          tipo: "capacidade",
          titulo: `Financiamento máximo pela renda (${s})`,
          dados: { renda: renda!, limite: p.comprometimento_max_percentual, sistema: s, taxa_anual: taxa!.anual, meses: meses!, ...r },
          markdown:
            `Renda ${brl(renda!)} × limite de ${pct(p.comprometimento_max_percentual)} = parcela máxima **${brl(r.parcela_maxima)}**. ` +
            `Com ${pct(taxa!.anual)} a.a. em ${meses} meses (${s}${s === "SAC" ? ", pela 1ª parcela" : ""}): financiamento máximo **${brl(r.valor_maximo)}**.` +
            notaSeguros,
        });
      }
    }
  }

  // Simulação de parcela.
  const querSimular =
    RE_SIMULACAO.test(t) &&
    !RE_CAPACIDADE.test(t) &&
    !(RE_COMPROMETIMENTO.test(t) && parcelaInformada) &&
    !(RE_CUSTOS.test(t) && !/parcel|presta/.test(t));
  let simulacaoBase: Simulacao | null = null;
  if (querSimular) {
    let financiado = financiadoExplicito;
    if (!financiado && imovel) financiado = entradaValor ? imovel - entradaValor : null;
    if (!financiado && !imovel && semRotulo.length === 1) financiado = semRotulo[0]!.valor;
    const faltam = [
      !financiado && (imovel ? "valor da entrada (ou o valor a financiar)" : "valor a financiar"),
      !taxa && "taxa de juros anual",
      !meses && "prazo (em anos ou meses)",
    ].filter(Boolean) as string[];
    if (faltam.length) out.push(faltando(faltam, "Simulação de parcela"));
    else if (financiado! > 0) {
      for (const s of sistemas) {
        const sim = simular(s, financiado!, taxa!.anual, meses!, taxa!.tipo);
        simulacaoBase ??= sim;
        out.push({
          tipo: "simulacao",
          titulo: `Simulação ${s}`,
          dados: sim,
          markdown:
            simulacaoEmMarkdown(sim) +
            (taxaPergunta ? "" : `\n\n_Taxa de referência cadastrada pela conta (${pct(taxa!.anual)} a.a.), não a taxa de hoje de um banco._`) +
            notaSeguros,
        });
      }
    }
  }

  // Comprometimento de renda.
  if (RE_COMPROMETIMENTO.test(t) || (renda && (parcelaInformada || simulacaoBase) && /renda/.test(t))) {
    const parcela = parcelaInformada ?? simulacaoBase?.primeira_parcela ?? null;
    if (!renda || !parcela) out.push(faltando([!renda && "renda mensal", !parcela && "valor da parcela"].filter(Boolean) as string[], "Comprometimento de renda"));
    else {
      const perc = comprometimento(parcela, renda);
      const dentro = perc <= p.comprometimento_max_percentual;
      out.push({
        tipo: "comprometimento",
        titulo: "Comprometimento de renda",
        dados: { parcela, renda, percentual: perc, limite: p.comprometimento_max_percentual, dentro },
        markdown: `Parcela ${brl(parcela)} sobre renda ${brl(renda)} = **${pct(perc)}** da renda (limite da conta: ${pct(p.comprometimento_max_percentual)}) → **${dentro ? "dentro" : "acima"} do limite**.`,
      });
    }
  }

  // Custos de aquisição (ITBI, cartório, avaliação, certidões).
  if (RE_CUSTOS.test(t)) {
    const valorImovel = imovel ?? (semRotulo.length === 1 ? semRotulo[0]!.valor : null);
    if (!valorImovel) out.push(faltando(["valor do imóvel"], "Custos de aquisição"));
    else {
      const municipio = /em ([a-z\s]{3,40}?)(?:[,.?/-]|\s(?:sp|rj|mg|pr|sc|rs|ba|pe|ce|go|df)\b|$)/.exec(t)?.[1]?.trim() ?? null;
      const c = custosAquisicao(valorImovel, p, municipio);
      out.push({
        tipo: "custos",
        titulo: "Custos de aquisição",
        dados: c,
        markdown:
          `| Item | Valor |\n|:--|--:|\n| ITBI (${pct(c.itbi_percentual)} — ${c.itbi_origem}) | ${brl(c.itbi)} |\n` +
          `| Escritura e registro (${pct(c.cartorio_percentual)}) | ${brl(c.cartorio)} |\n| Avaliação do banco | ${brl(c.avaliacao_banco)} |\n` +
          `| Certidões | ${brl(c.certidoes)} |\n| **Total estimado** | **${brl(c.total)}** |\n\n` +
          `_Parâmetros cadastrados pela conta; confira a alíquota do ITBI e a tabela de emolumentos do município/estado._`,
      });
    }
  }
  return out;
}

function faltando(faltam: string[], titulo: string): ResultadoFerramenta {
  return {
    tipo: "faltando",
    titulo,
    dados: { faltam },
    markdown: `Para calcular (${titulo.toLowerCase()}) falta: ${faltam.join(", ")}.`,
  };
}

/** Bloco que vai para o prompt: o modelo usa ESTES números, sem refazer as contas. */
export function blocoParaPrompt(resultados: ResultadoFerramenta[]): string {
  if (!resultados.length) return "(nenhum cálculo foi pedido nesta pergunta)";
  return resultados.map((r, i) => `### CÁLCULO ${i + 1} — ${r.titulo}\n${r.markdown}`).join("\n\n");
}
