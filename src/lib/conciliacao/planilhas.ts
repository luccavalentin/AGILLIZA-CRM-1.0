/**
 * Leitura genérica de planilhas (Meu Controle × Relatórios de bancos) e
 * cruzamento entre os dois lados. Tudo executa no navegador; o CPF completo
 * nunca sai da memória (só o mascarado é exibido/exportado).
 */
import {
  chaveCabecalho,
  mascararCpf,
  normalizarNome,
  parseDataBR,
  parseValorBR,
  somenteDigitos,
} from "./bancos";

export type LadoPlanilha = "controle" | "banco";

export interface LinhaPlanilha {
  arquivo: string;
  lado: LadoPlanilha;
  numeroProposta: string | null;
  cpf: string | null;
  nome: string | null;
  status: string | null;
  valor: number | null;
  data: string | null;
}

export type ResultadoComparativo =
  | "igual"
  | "divergente"
  | "so_controle"
  | "so_banco";

export const RESULTADO_COMPARATIVO_LABEL: Record<ResultadoComparativo, string> = {
  igual: "Coincide",
  divergente: "Divergente",
  so_controle: "Só no meu controle",
  so_banco: "Só no relatório do banco",
};

export const RESULTADO_COMPARATIVO_TONE: Record<ResultadoComparativo, string> = {
  igual: "text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  divergente: "text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10",
  so_controle: "text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10",
  so_banco: "text-red-600 dark:text-red-400 border-red-500/40 bg-red-500/10",
};

export interface SistemaResumo {
  proposta_id: string | null;
  numero_proposta: string | null;
  numero_proposta_banco: string | null;
  nome_cliente: string | null;
  situacao: string | null;
  valor: number | null;
  nome_banco: string | null;
}

export interface ItemComparativo {
  chave: string;
  numeroProposta: string | null;
  nome: string | null;
  cpf: string | null;
  controle: LinhaPlanilha | null;
  banco: LinhaPlanilha | null;
  sistema: SistemaResumo | null;
  resultado: ResultadoComparativo;
  detalhes: string[];
  situacaoSistema: "encontrada" | "nao_encontrada";
}

/** Apelidos aceitos para cada campo canônico (comparados normalizados). */
const ALIASES: Record<keyof Omit<LinhaPlanilha, "arquivo" | "lado">, string[]> = {
  numeroProposta: [
    "numeroproposta",
    "numerodaproposta",
    "nproposta",
    "nodaproposta",
    "proposta",
    "contrato",
    "numerocontrato",
    "numerodocontrato",
    "codigoproposta",
  ],
  cpf: ["cpf", "cpfcnpj", "cpfdocliente", "documento", "cpftitular"],
  nome: [
    "nomecliente",
    "cliente",
    "nome",
    "nomedoprimeirocomprador",
    "nomedocliente",
    "proponente",
    "nomeproponente",
  ],
  status: ["status", "situacao", "statusproposta", "situacaoproposta", "fase", "etapa"],
  valor: [
    "valorfinanciamento",
    "valordofinanciamento",
    "valor",
    "valorfinanciado",
    "vlrfinanciamento",
    "valorcredito",
  ],
  data: [
    "data",
    "datacadastro",
    "datadeenvio",
    "dataenvio",
    "datadeemissao",
    "dataemissao",
    "dataatualizacao",
  ],
};

function acharColuna(cabecalhos: string[], alvos: string[]): string | null {
  const norm = cabecalhos.map((h) => ({ raw: h, key: chaveCabecalho(h) }));
  for (const alvo of alvos) {
    const exato = norm.find((h) => h.key === alvo);
    if (exato) return exato.raw;
  }
  for (const alvo of alvos) {
    const parcial = norm.find((h) => h.key.includes(alvo));
    if (parcial) return parcial.raw;
  }
  return null;
}

async function registrosDoArquivo(buf: ArrayBuffer): Promise<Record<string, unknown>[]> {
  // `xlsx` (~400 kB) só é baixado quando o usuário importa uma planilha.
  const XLSX = await import("xlsx");
  const head = new Uint8Array(buf.slice(0, 8));
  const binario =
    (head[0] === 0xd0 && head[1] === 0xcf) || (head[0] === 0x50 && head[1] === 0x4b);
  if (!binario) {
    let texto = new TextDecoder("utf-8").decode(buf);
    if (texto.includes("\uFFFD")) texto = new TextDecoder("windows-1252").decode(buf);
    const wb = XLSX.read(texto, { type: "string", raw: true });
    const sheet = wb.Sheets[wb.SheetNames[0]!]!;
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  }
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
}

/** Lê qualquer planilha e devolve as linhas canônicas detectadas. */
export async function lerPlanilhaGenerica(
  file: File,
  lado: LadoPlanilha,
): Promise<LinhaPlanilha[]> {
  const registros = await registrosDoArquivo(await file.arrayBuffer());
  if (!registros.length) return [];
  const cabecalhos = Object.keys(registros[0]!);
  const mapa = {
    numeroProposta: acharColuna(cabecalhos, ALIASES.numeroProposta),
    cpf: acharColuna(cabecalhos, ALIASES.cpf),
    nome: acharColuna(cabecalhos, ALIASES.nome),
    status: acharColuna(cabecalhos, ALIASES.status),
    valor: acharColuna(cabecalhos, ALIASES.valor),
    data: acharColuna(cabecalhos, ALIASES.data),
  };

  return registros
    .map((r) => ({
      arquivo: file.name,
      lado,
      numeroProposta: mapa.numeroProposta ? String(r[mapa.numeroProposta] ?? "").trim() || null : null,
      cpf: mapa.cpf ? String(r[mapa.cpf] ?? "").trim() || null : null,
      nome: mapa.nome ? String(r[mapa.nome] ?? "").trim() || null : null,
      status: mapa.status ? String(r[mapa.status] ?? "").trim() || null : null,
      valor: mapa.valor ? parseValorBR(r[mapa.valor]) : null,
      data: mapa.data ? parseDataBR(r[mapa.data]) : null,
    }))
    .filter((l) => l.numeroProposta || l.cpf || l.nome);
}

function chaveDaLinha(l: LinhaPlanilha): string {
  const num = somenteDigitos(l.numeroProposta);
  if (num) return `p:${num}`;
  const cpf = somenteDigitos(l.cpf);
  if (cpf) return `c:${cpf}`;
  return `n:${normalizarNome(l.nome)}`;
}

const TOLERANCIA = 0.01;

/** Cruza as linhas dos dois lados por nº da proposta (fallback CPF/nome). */
export function cruzarPlanilhas(
  controle: LinhaPlanilha[],
  banco: LinhaPlanilha[],
): ItemComparativo[] {
  const mapaBanco = new Map<string, LinhaPlanilha>();
  for (const l of banco) {
    const k = chaveDaLinha(l);
    if (!mapaBanco.has(k)) mapaBanco.set(k, l);
  }
  const usados = new Set<string>();
  const itens: ItemComparativo[] = [];

  for (const c of controle) {
    const k = chaveDaLinha(c);
    const b = mapaBanco.get(k) ?? null;
    if (b) usados.add(k);
    const detalhes: string[] = [];
    if (b) {
      if (
        c.valor != null &&
        b.valor != null &&
        Math.abs(c.valor - b.valor) > TOLERANCIA
      ) {
        detalhes.push(
          `Valor: controle ${c.valor.toFixed(2)} × banco ${b.valor.toFixed(2)}`,
        );
      }
      const sc = normalizarNome(c.status);
      const sb = normalizarNome(b.status);
      if (sc && sb && sc !== sb) {
        detalhes.push(`Status: controle "${c.status}" × banco "${b.status}"`);
      }
      const nc = normalizarNome(c.nome);
      const nb = normalizarNome(b.nome);
      if (nc && nb && nc !== nb && !nc.includes(nb) && !nb.includes(nc)) {
        detalhes.push(`Cliente: controle "${c.nome}" × banco "${b.nome}"`);
      }
    }
    itens.push({
      chave: k,
      numeroProposta: c.numeroProposta ?? b?.numeroProposta ?? null,
      nome: c.nome ?? b?.nome ?? null,
      cpf: mascararCpf(c.cpf ?? b?.cpf ?? null),
      controle: c,
      banco: b,
      sistema: null,
      resultado: !b ? "so_controle" : detalhes.length ? "divergente" : "igual",
      detalhes: b
        ? detalhes
        : ["Consta no meu controle e não foi encontrada nos relatórios dos bancos."],
      situacaoSistema: "nao_encontrada",
    });
  }

  for (const [k, b] of mapaBanco) {
    if (usados.has(k)) continue;
    itens.push({
      chave: k,
      numeroProposta: b.numeroProposta,
      nome: b.nome,
      cpf: mascararCpf(b.cpf),
      controle: null,
      banco: b,
      sistema: null,
      resultado: "so_banco",
      detalhes: ["Consta no relatório do banco e não foi encontrada no meu controle."],
      situacaoSistema: "nao_encontrada",
    });
  }

  return itens;
}

/** Chaves enviadas ao servidor para o cruzamento com o sistema. */
export function chavesParaSistema(itens: ItemComparativo[]) {
  return itens.map((i) => ({
    chave: i.chave,
    numero: somenteDigitos(i.controle?.numeroProposta ?? i.banco?.numeroProposta) || null,
    cpf: somenteDigitos(i.controle?.cpf ?? i.banco?.cpf) || null,
    nome: i.nome,
  }));
}

/** Aplica o resultado do cruzamento com o sistema sobre os itens. */
export function aplicarSistema(
  itens: ItemComparativo[],
  encontrados: Record<string, SistemaResumo>,
): ItemComparativo[] {
  return itens.map((i) => {
    const s = encontrados[i.chave];
    if (!s) {
      return {
        ...i,
        sistema: null,
        situacaoSistema: "nao_encontrada" as const,
        detalhes: [...i.detalhes, "Não localizada no sistema Agilliza."],
      };
    }
    const detalhes = [...i.detalhes];
    const valorPlanilha = i.banco?.valor ?? i.controle?.valor ?? null;
    if (
      valorPlanilha != null &&
      s.valor != null &&
      Math.abs(valorPlanilha - s.valor) > TOLERANCIA
    ) {
      detalhes.push(
        `Valor: planilha ${valorPlanilha.toFixed(2)} × sistema ${s.valor.toFixed(2)}`,
      );
    }
    return {
      ...i,
      sistema: s,
      situacaoSistema: "encontrada" as const,
      detalhes,
      resultado:
        i.resultado === "igual" && detalhes.length > 0 ? "divergente" : i.resultado,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Etapas do funil — classificação a partir do texto de status         */
/* ------------------------------------------------------------------ */

export type EtapaComparativo =
  | "contrato_emitido"
  | "aprovado"
  | "pre_aprovado"
  | "nao_aprovado"
  | "avaliacao_imovel"
  | "credito_analise"
  | "documentos"
  | "cancelado"
  | "outros";

export const ETAPA_COMPARATIVO_LABEL: Record<EtapaComparativo, string> = {
  contrato_emitido: "Contrato emitido",
  aprovado: "Aprovado",
  pre_aprovado: "Pré-aprovado",
  nao_aprovado: "Não aprovado",
  avaliacao_imovel: "Avaliação do imóvel",
  credito_analise: "Crédito em análise",
  documentos: "Enviar documentos",
  cancelado: "Cancelado / desistência",
  outros: "Sem etapa identificada",
};

export const ETAPA_COMPARATIVO_TONE: Record<EtapaComparativo, string> = {
  contrato_emitido: "text-emerald-700 dark:text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  aprovado: "text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  pre_aprovado: "text-teal-600 dark:text-teal-400 border-teal-500/40 bg-teal-500/10",
  nao_aprovado: "text-red-600 dark:text-red-400 border-red-500/40 bg-red-500/10",
  avaliacao_imovel: "text-violet-600 dark:text-violet-400 border-violet-500/40 bg-violet-500/10",
  credito_analise: "text-blue-600 dark:text-blue-400 border-blue-500/40 bg-blue-500/10",
  documentos: "text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10",
  cancelado: "text-slate-600 dark:text-slate-400 border-slate-500/40 bg-slate-500/10",
  outros: "text-muted-foreground border-border bg-muted/40",
};

/** Ordem lógica do funil, usada nos filtros e na ordenação. */
export const ETAPAS_COMPARATIVO: EtapaComparativo[] = [
  "documentos",
  "credito_analise",
  "pre_aprovado",
  "aprovado",
  "avaliacao_imovel",
  "contrato_emitido",
  "nao_aprovado",
  "cancelado",
  "outros",
];

/** Classifica um texto livre de status (planilha ou sistema) em uma etapa. */
export function classificarEtapa(texto: unknown): EtapaComparativo | null {
  const t = normalizarNome(texto);
  if (!t) return null;
  if (/(nao enviad|sem envio|aguardando documento)/.test(t)) return "documentos";
  if (/(contrato|instrumento|escritur|assinad|formaliz|registrad|liberad|emitid)/.test(t))
    return "contrato_emitido";
  if (/(cancel|desist|expirad|encerrad|arquivad|distrat)/.test(t)) return "cancelado";
  if (/(recus|reprov|negad|indeferid|nao aprovad|inapt|restri)/.test(t)) return "nao_aprovado";
  if (/(vistoria|avaliac|engenharia|laudo|imovel|pericia|conformidade)/.test(t))
    return "avaliacao_imovel";
  if (/(pre aprovad|preaprovad|condicion|pendencia|ressalva|aprovad[ao] com)/.test(t))
    return "pre_aprovado";
  if (/(aprovad|deferid|apto|credito ok)/.test(t)) return "aprovado";
  if (/(document|dossie|pasta|checklist|anexo|pendente de envio|enviar doc)/.test(t))
    return "documentos";
  if (/(analis|andamento|estudo|processament|em aberto|aguardand|enviad|cadastrad|digitad|simulac)/.test(t))
    return "credito_analise";
  return "outros";
}

/**
 * Etapa consolidada de um item: prioriza o que o banco informou, depois o
 * sistema e por último o controle interno.
 */
export function etapaDoItem(i: ItemComparativo): EtapaComparativo {
  return (
    classificarEtapa(i.banco?.status) ??
    classificarEtapa(i.sistema?.situacao) ??
    classificarEtapa(i.controle?.status) ??
    "outros"
  );
}
