/**
 * Carta de análise de crédito: quais propostas podem emitir, o texto do
 * parecer e os campos que preenchem o documento.
 *
 * Módulo puro (sem banco, sem rede, sem PDF) para ser testado.
 */
import { formatBRL, maskCpfCnpj } from "@/lib/simulacao/format";

export type ModeloCarta = "modelo1" | "modelo2" | "modelo3";

export const MODELOS_CARTA: { id: ModeloCarta; nome: string; descricao: string }[] = [
  { id: "modelo1", nome: "Institucional escuro", descricao: "Capa com a marca em destaque" },
  { id: "modelo2", nome: "Casa própria", descricao: "Capa clara com o telhado" },
  { id: "modelo3", nome: "Executivo", descricao: "Capa com foto e resumo" },
];

/** Status do banco que permitem emitir carta. */
const STATUS_COM_CARTA = new Set(["aprovada", "condicionado"]);

const ehBradesco = (nomeBanco: unknown) =>
  String(nomeBanco ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .includes("bradesco");

export function bancoPermiteCarta(banco: { status_banco?: unknown } | null | undefined): boolean {
  return STATUS_COM_CARTA.has(String(banco?.status_banco ?? ""));
}

/**
 * Texto do parecer. Nunca é editável na carta: o resultado tem de refletir a
 * decisão informada pela instituição financeira.
 *
 * Bradesco nunca sai "aprovado", só "pré-aprovado" — aprovado ou com condição.
 */
export function parecerDaCarta(banco: {
  nome_banco?: unknown;
  status_banco?: unknown;
}): { curto: string; capa: string } | null {
  const status = String(banco?.status_banco ?? "");
  if (!STATUS_COM_CARTA.has(status)) return null;
  if (ehBradesco(banco?.nome_banco)) {
    return { curto: "PRÉ-APROVADO", capa: "PROPOSTA PRÉ-APROVADA" };
  }
  if (status === "condicionado") {
    return { curto: "APROVADO COM CONDIÇÕES", capa: "PROPOSTA APROVADA COM CONDIÇÕES" };
  }
  return { curto: "APROVADO", capa: "PROPOSTA APROVADA" };
}

/** Campos da carta. Todos são texto já formatado, prontos para o PDF. */
export interface CamposCarta {
  numeroAnalise: string;
  data: string;
  banco: string;
  proponente1Nome: string;
  proponente1Cpf: string;
  proponente2Nome: string;
  proponente2Cpf: string;
  produto: string;
  valorImovel: string;
  valorFinanciamento: string;
  primeiraParcela: string;
  sistemaAmortizacao: string;
  prazo: string;
  indexador: string;
  taxaJuros: string;
  rendaFamiliar: string;
  agencia: string;
  // Preenchidos pelo usuário
  vencimento: string;
  fgtsAprovado: string;
  subsidio: string;
  construtora: string;
  empreendimento: string;
  unidade: string;
  textoFgts: string;
  observacoes: string;
}

/** Campos que o sistema não tem e o usuário completa (ordem do formulário). */
export const CAMPOS_MANUAIS: {
  chave: keyof CamposCarta;
  rotulo: string;
  placeholder: string;
  naoSeAplica?: boolean;
  multilinha?: boolean;
  data?: boolean;
}[] = [
  {
    chave: "vencimento",
    rotulo: "Data de vencimento",
    placeholder: "dd/mm/aaaa",
    naoSeAplica: true,
    data: true,
  },
  { chave: "agencia", rotulo: "Agência de vinculação", placeholder: "0000", naoSeAplica: true },
  { chave: "fgtsAprovado", rotulo: "FGTS aprovado", placeholder: "R$ 0,00", naoSeAplica: true },
  { chave: "subsidio", rotulo: "Subsídio apurado", placeholder: "R$ 0,00", naoSeAplica: true },
  {
    chave: "construtora",
    rotulo: "Construtora",
    placeholder: "Nome da construtora",
    naoSeAplica: true,
  },
  {
    chave: "empreendimento",
    rotulo: "Empreendimento",
    placeholder: "Nome do empreendimento",
    naoSeAplica: true,
  },
  { chave: "unidade", rotulo: "Unidade", placeholder: "Bloco / apartamento", naoSeAplica: true },
  {
    chave: "textoFgts",
    rotulo: "Utilização e validação do FGTS",
    placeholder: "Situação do FGTS dos proponentes: aptidão, saldo considerado, pendências…",
    multilinha: true,
  },
  {
    chave: "observacoes",
    rotulo: "Observações da proposta",
    placeholder: "Condições específicas, ressalvas e pendências desta proposta…",
    multilinha: true,
  },
];

export const NAO_SE_APLICA = "Não se aplica";

const PRODUTOS: Record<string, string> = {
  financiamento_imobiliario: "Financiamento Imobiliário",
  home_equity: "Home Equity",
};

const SISTEMAS: Record<string, string> = { S: "SAC", P: "PRICE", SAC: "SAC", PRICE: "PRICE" };

const INDEXADORES: Record<string, string> = { TR: "TR", "TAXA REFERENCIAL": "TR", IPCA: "IPCA" };

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const dinheiro = (v: unknown) => {
  const n = num(v);
  return n == null ? "" : formatBRL(n);
};
const dataBR = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/**
 * 1º e 2º proponentes. O 1º é o titular (CPF da proposta); o 2º é o cônjuge
 * dele ou, sem cônjuge, o próximo participante.
 */
export function proponentesDaCarta(
  proposta: any,
  envolvidos: any[],
): { p1: { nome: string; cpf: string }; p2: { nome: string; cpf: string } | null } {
  const lista = (envolvidos ?? []).filter((e) => e && e.tipo_situacao !== "I");
  const cpfProposta = soDigitos(proposta?.cpf_cnpj);
  const titular =
    lista.find((e) => soDigitos(e.cpf_cnpj) === cpfProposta && cpfProposta) ??
    lista.find((e) => !e.conjuge_de) ??
    null;
  const conjuge = titular
    ? lista.find((e) => String(e.conjuge_de ?? "") === String(titular.id))
    : null;
  const outro = conjuge ?? lista.find((e) => e !== titular) ?? null;

  const p1 = {
    nome: String(titular?.nome ?? proposta?.nome_cliente ?? "").trim(),
    cpf: maskCpfCnpj(soDigitos(titular?.cpf_cnpj ?? proposta?.cpf_cnpj)),
  };
  const p2 = outro
    ? { nome: String(outro.nome ?? "").trim(), cpf: maskCpfCnpj(soDigitos(outro.cpf_cnpj)) }
    : null;
  return { p1, p2 };
}

/** Valores iniciais da carta a partir da proposta e do banco escolhido. */
export function camposIniciaisCarta({
  proposta,
  banco,
  envolvidos,
  hoje = new Date(),
}: {
  proposta: any;
  banco: any;
  envolvidos: any[];
  hoje?: Date;
}): CamposCarta {
  const { p1, p2 } = proponentesDaCarta(proposta, envolvidos);
  const sistema = String(
    banco?.sistema_amortizacao_banco ?? proposta?.sistema_amortizacao ?? "",
  ).toUpperCase();
  const prazo =
    num(proposta?.prazo_aprovado) ?? num(banco?.prazo_pagamento_max) ?? num(proposta?.prazo);
  const indexadorBruto = String(
    banco?.codigo_indexador ?? proposta?.codigo_indexador_aprovado ?? "",
  ).trim();
  const taxa = num(banco?.taxa_juros_ano) ?? num(proposta?.taxa_juros_ano_aprovado);

  return {
    numeroAnalise: String(banco?.numero_proposta_banco ?? proposta?.numero_proposta ?? "").trim(),
    data: dataBR(hoje),
    banco: String(banco?.nome_banco ?? "").trim(),
    proponente1Nome: p1.nome,
    proponente1Cpf: p1.cpf,
    proponente2Nome: p2?.nome ?? NAO_SE_APLICA,
    proponente2Cpf: p2?.cpf ?? "",
    produto: PRODUTOS[String(proposta?.produto ?? "")] ?? "Financiamento Imobiliário",
    valorImovel: dinheiro(proposta?.valor_imovel),
    valorFinanciamento: dinheiro(
      proposta?.valor_financiamento_aprovado ?? proposta?.valor_financiamento,
    ),
    primeiraParcela: dinheiro(banco?.valor_parcela ?? proposta?.valor_parcela_aprovado),
    sistemaAmortizacao: SISTEMAS[sistema] ?? sistema,
    prazo: prazo ? `${prazo} meses` : "",
    indexador: INDEXADORES[indexadorBruto.toUpperCase()] ?? indexadorBruto,
    taxaJuros: taxa ? `${taxa.toFixed(2).replace(".", ",")}% a.a.` : "",
    rendaFamiliar: dinheiro(proposta?.renda_total),
    agencia: String(banco?.agencia ?? proposta?.agencia ?? "").trim(),
    // Validade padrão da carta: 30 dias a partir da emissão.
    vencimento: dataBR(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 30)),
    fgtsAprovado:
      proposta?.utiliza_fgts === true || proposta?.utiliza_fgts === "S" ? "" : NAO_SE_APLICA,
    subsidio: "",
    construtora: "",
    empreendimento: "",
    unidade: "",
    textoFgts: "",
    observacoes: "",
  };
}

/** Campos manuais de uma linha que estão em branco (sairão como "Não se aplica"). */
export function camposEmBrancoCarta(c: CamposCarta): string[] {
  return CAMPOS_MANUAIS.filter((f) => !f.multilinha && !String(c[f.chave] ?? "").trim()).map(
    (f) => f.rotulo,
  );
}

/**
 * Campos prontos para o PDF: nada é obrigatório — campo manual deixado em
 * branco sai como "Não se aplica" em vez de travar a emissão.
 */
export function camposParaPdf(c: CamposCarta): CamposCarta {
  const saida = { ...c };
  for (const f of CAMPOS_MANUAIS) {
    if (f.multilinha) continue;
    if (!String(saida[f.chave] ?? "").trim()) saida[f.chave] = NAO_SE_APLICA;
  }
  return saida;
}

/** Máscara dd/mm/aaaa enquanto o usuário digita (aceita só números). */
export function mascaraData(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
