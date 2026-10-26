/**
 * Regras puras da Consulta Ficha (C16, 26/10/2026): o mesmo fluxo da Consulta Ficha dos
 * assinantes no Agilliza Tech — (1) quem consultar, (2) finalidade e base legal LGPD com a
 * autorização do titular, (3) consultar — e o mesmo resultado (medidor de score + fatores).
 *
 * Fica fora dos componentes para ser testado sem tela: documento torto, ficha parcial do
 * fornecedor, histórico com falha e configuração incompleta passam todos por aqui.
 */
import type { FichaBureau, RestricaoBureau } from "@/lib/bureau/tipos";
import { validarCNPJ, validarCPF } from "@/lib/crm/documento";

// ───────────────────────────── Documento ─────────────────────────────

export interface AnaliseDocumento {
  digitos: string;
  tipo: "F" | "J" | null;
  valido: boolean;
  /** Mensagem para a tela; `null` quando está certo. */
  erro: string | null;
}

/** Lê o que a pessoa digitou (com ou sem pontuação, colado com espaço, letras soltas). */
export function analisarDocumento(texto: string | null | undefined): AnaliseDocumento {
  const digitos = String(texto ?? "")
    .replace(/\D/g, "")
    .slice(0, 14);
  if (!digitos) return { digitos, tipo: null, valido: false, erro: "Digite o CPF ou CNPJ." };
  if (digitos.length !== 11 && digitos.length !== 14) {
    return {
      digitos,
      tipo: null,
      valido: false,
      erro: "Complete o CPF (11 dígitos) ou CNPJ (14).",
    };
  }
  const tipo = digitos.length === 11 ? "F" : "J";
  const valido = tipo === "F" ? validarCPF(digitos) : validarCNPJ(digitos);
  return {
    digitos,
    tipo,
    valido,
    erro: valido ? null : "CPF ou CNPJ inválido: confira os dígitos.",
  };
}

/** Máscara enquanto digita: 000.000.000-00 até 11 dígitos, 00.000.000/0000-00 depois. */
export function mascararDigitacao(v: string): string {
  const d = String(v ?? "")
    .replace(/\D/g, "")
    .slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** Documento que veio mascarado do servidor (sem permissão de dado sensível). */
export function documentoMascarado(doc: string | null | undefined): boolean {
  return Boolean(doc && doc.includes("*"));
}

// ───────────────────────────── LGPD ─────────────────────────────

export const BASES_LEGAIS = [
  {
    valor: "consentimento",
    rotulo: "Consentimento do titular",
    ajuda: "O cliente autorizou a consulta (guarde a autorização).",
  },
  {
    valor: "protecao_credito",
    rotulo: "Proteção do crédito",
    ajuda: "Análise de risco antes de conceder crédito ou financiamento.",
  },
  {
    valor: "execucao_contrato",
    rotulo: "Procedimentos preliminares de contrato",
    ajuda: "Etapa anterior a um contrato pedido pelo próprio titular.",
  },
  {
    valor: "legitimo_interesse",
    rotulo: "Legítimo interesse",
    ajuda: "Interesse legítimo documentado e proporcional.",
  },
] as const;

export type BaseLegal = (typeof BASES_LEGAIS)[number]["valor"];

export const FINALIDADE_PADRAO = "Análise de crédito para financiamento imobiliário";

/** Tamanho máximo da finalidade digitada (o registro guarda também a base legal). */
export const FINALIDADE_MAX = 300;

export type ModoConsulta = "crm" | "digitar";

export interface ClienteEscolhido {
  id: string;
  nome: string;
  /** Inteiro para quem vê dado sensível; mascarado ou vazio para os demais. */
  documento: string | null;
  celular?: string | null;
}

export interface FormularioConsulta {
  modo: ModoConsulta;
  cliente: ClienteEscolhido | null;
  documento: string;
  finalidade: string;
  base: BaseLegal;
  autorizou: boolean;
}

export interface ErrosFormulario {
  quem: string | null;
  finalidade: string | null;
  autorizacao: string | null;
}

/** Documento que de fato vai para o bureau (o do cadastro ou o digitado). */
export function documentoDaConsulta(f: FormularioConsulta): string {
  if (f.modo === "crm") {
    const doc = f.cliente?.documento ?? "";
    // Com o documento mascarado, a pessoa digita o CPF no campo (mesmo no modo CRM).
    return documentoMascarado(doc) || !doc ? analisarDocumento(f.documento).digitos : analisarDocumento(doc).digitos;
  }
  return analisarDocumento(f.documento).digitos;
}

export function validarFormulario(f: FormularioConsulta): ErrosFormulario {
  let quem: string | null = null;
  if (f.modo === "crm") {
    if (!f.cliente) quem = "Escolha um cliente do CRM ou digite os dados.";
    else {
      const doc = f.cliente.documento ?? "";
      const precisaDigitar = !doc || documentoMascarado(doc);
      const a = analisarDocumento(precisaDigitar ? f.documento : doc);
      if (precisaDigitar && !a.digitos) {
        quem = doc
          ? "Seu acesso não mostra o documento completo deste cliente. Digite o CPF/CNPJ."
          : "Este cliente não tem CPF/CNPJ no CRM. Digite o documento para consultar.";
      } else if (!a.valido) quem = a.erro;
    }
  } else {
    quem = analisarDocumento(f.documento).erro;
  }
  const finalidade =
    f.finalidade.trim().length < 5
      ? "Descreva a finalidade (mínimo 5 caracteres)."
      : f.finalidade.trim().length > FINALIDADE_MAX
        ? `A finalidade passa de ${FINALIDADE_MAX} caracteres.`
        : null;
  const autorizacao =
    f.base === "consentimento" && !f.autorizou
      ? "Com base no consentimento, confirme a autorização do titular."
      : null;
  return { quem, finalidade, autorizacao };
}

export function formularioValido(e: ErrosFormulario): boolean {
  return !e.quem && !e.finalidade && !e.autorizacao;
}

/**
 * Texto gravado no histórico (LGPD): a finalidade, a base legal e se a autorização foi
 * confirmada — o registro do Agilliza guarda tudo na coluna `finalidade`.
 */
export function finalidadeRegistrada(finalidade: string, base: BaseLegal, autorizou: boolean): string {
  const rotulo = BASES_LEGAIS.find((b) => b.valor === base)?.rotulo ?? "Não informada";
  const texto = finalidade.replace(/\s+/g, " ").trim().slice(0, FINALIDADE_MAX);
  return `${texto} · Base legal: ${rotulo}${autorizou ? " · autorização do titular confirmada" : ""}`;
}

/** Finalidade do histórico sem os complementos (para a coluna curta da tabela). */
export function finalidadeCurta(registrada: string | null | undefined): string {
  return String(registrada ?? "").split(" · Base legal:")[0].trim() || "—";
}

// ───────────────────────────── Disponibilidade ─────────────────────────────

export interface ConfigDisponibilidade {
  provedor: string | null;
  ativo: boolean;
  integrado?: boolean;
  camposPreenchidos: string[];
  catalogo: { chave: string; nome: string; campos: { chave: string }[] }[];
}

export type MotivoIndisponivel = "sem_provedor" | "inativo" | "sem_credenciais" | "nao_integrado";

export interface Disponibilidade {
  disponivel: boolean;
  motivo: MotivoIndisponivel | null;
  /** Nome do fornecedor contratado (Serasa Experian, SPC…), quando há. */
  fornecedor: string | null;
  faltando: string[];
}

export function disponibilidade(cfg: ConfigDisponibilidade | null | undefined): Disponibilidade {
  if (!cfg || !cfg.provedor) {
    return { disponivel: false, motivo: "sem_provedor", fornecedor: null, faltando: [] };
  }
  const cat = cfg.catalogo.find((c) => c.chave === cfg.provedor) ?? null;
  const fornecedor = cat?.nome ?? cfg.provedor;
  if (!cfg.ativo) return { disponivel: false, motivo: "inativo", fornecedor, faltando: [] };
  const preenchidos = new Set(cfg.camposPreenchidos ?? []);
  const faltando = (cat?.campos ?? []).map((c) => c.chave).filter((c) => !preenchidos.has(c));
  if (faltando.length) {
    return { disponivel: false, motivo: "sem_credenciais", fornecedor, faltando };
  }
  if (cfg.integrado === false) {
    return { disponivel: false, motivo: "nao_integrado", fornecedor, faltando: [] };
  }
  return { disponivel: true, motivo: null, fornecedor, faltando: [] };
}

/** Explicação para quem administra (quem só consulta vê "Consulta indisponível"). */
export function explicarIndisponivel(d: Disponibilidade): string {
  switch (d.motivo) {
    case "sem_provedor":
      return "Nenhum bureau contratado. Cadastre o fornecedor e as chaves em Integrações.";
    case "inativo":
      return `O ${d.fornecedor ?? "bureau"} está desativado em Integrações.`;
    case "sem_credenciais":
      return `Faltam chaves do ${d.fornecedor ?? "bureau"} em Integrações.`;
    case "nao_integrado":
      return `A integração com o ${d.fornecedor ?? "bureau"} ainda está em homologação.`;
    default:
      return "";
  }
}

// ───────────────────────────── Resultado ─────────────────────────────

export type Tom = "sucesso" | "alerta" | "perigo" | "neutro";

/** Score levado à escala 0–1.000 do medidor (fornecedor pode usar outra escala). */
export function scoreNaEscala(valor: unknown, maximo: unknown): number | null {
  const v = Number(valor);
  if (valor == null || valor === "" || !Number.isFinite(v)) return null;
  const m = Number(maximo);
  const escala = Number.isFinite(m) && m > 0 ? m : 1000;
  return Math.round(Math.max(0, Math.min(1000, (v / escala) * 1000)));
}

export function tomScore(score: number | null): Tom {
  if (score == null) return "neutro";
  return score > 700 ? "sucesso" : score > 500 ? "alerta" : "perigo";
}

const FAIXA_ROTULO: Record<string, string> = {
  muito_baixo: "Risco muito alto",
  baixo: "Risco alto",
  medio: "Risco moderado",
  alto: "Risco baixo",
  muito_alto: "Risco muito baixo",
};

export type ChaveFator = "pendencias" | "protestos" | "cheques" | "acoes";

export const ROTULO_FATOR: Record<ChaveFator, string> = {
  pendencias: "Pendências e negativações",
  protestos: "Protestos",
  cheques: "Cheques sem fundo",
  acoes: "Ações e falências",
};

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Em qual fator a restrição entra (pela origem e pelo tipo que o fornecedor deu). */
export function fatorDaRestricao(r: Partial<RestricaoBureau> | null | undefined): ChaveFator {
  const t = semAcento(`${r?.origem ?? ""} ${r?.tipo ?? ""} ${r?.descricao ?? ""}`);
  if (/protest/.test(t)) return "protestos";
  if (/cheque|\bccf\b/.test(t)) return "cheques";
  if (/acao|acoes|judicial|falenc|recuperacao|execu/.test(t)) return "acoes";
  return "pendencias";
}

export interface FatorResumo {
  chave: ChaveFator;
  rotulo: string;
  /** `null` = o fornecedor não informou (nunca vira "nada consta"). */
  valor: number | null;
}

export interface ResumoFicha {
  titulo: string | null;
  score: number | null;
  scoreOriginal: number | null;
  maximoOriginal: number | null;
  faixa: string | null;
  tom: Tom;
  /** Total de apontamentos; `null` quando o fornecedor não informou restrições. */
  apontamentos: number | null;
  valorTotal: number | null;
  fatores: FatorResumo[];
  situacao: string | null;
  probabilidade: number | null;
}

const SITUACAO_ROTULO: Record<string, string> = {
  regular: "Situação regular",
  pendente: "Pendente de regularização",
  suspensa: "Situação suspensa",
  cancelada: "Situação cancelada",
};

function numeroOuNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Ficha do bureau → o que o cartão de resultado mostra. A ficha pode chegar parcial (um
 * fornecedor sem score, outro sem lista de restrições, um terceiro com só o total): o que
 * não veio fica `null` e a tela escreve "não informado".
 */
export function resumirFicha(ficha: Partial<FichaBureau> | null | undefined): ResumoFicha {
  const f = (ficha ?? {}) as Partial<FichaBureau>;
  const s = f.score && typeof f.score === "object" ? f.score : null;
  const scoreOriginal = numeroOuNull(s?.valor);
  const maximoOriginal = numeroOuNull(s?.maximo);
  const score = scoreNaEscala(scoreOriginal, maximoOriginal);

  const lista = Array.isArray(f.restricoes) ? f.restricoes.filter(Boolean) : null;
  const total = numeroOuNull(f.totalRestricoes);
  let fatores: FatorResumo[];
  if (lista) {
    const cont: Record<ChaveFator, number> = { pendencias: 0, protestos: 0, cheques: 0, acoes: 0 };
    for (const r of lista) cont[fatorDaRestricao(r)] += 1;
    // Total maior que a lista (fornecedor resumiu): a diferença conta como pendência.
    if (total != null && total > lista.length) cont.pendencias += total - lista.length;
    fatores = (Object.keys(cont) as ChaveFator[]).map((k) => ({
      chave: k,
      rotulo: ROTULO_FATOR[k],
      valor: cont[k],
    }));
  } else {
    fatores = (Object.keys(ROTULO_FATOR) as ChaveFator[]).map((k) => ({
      chave: k,
      rotulo: ROTULO_FATOR[k],
      valor: k === "pendencias" && total != null ? total : null,
    }));
  }
  const conhecidos = fatores.filter((x) => x.valor != null);
  const apontamentos = conhecidos.length
    ? conhecidos.reduce((soma, x) => soma + (x.valor ?? 0), 0)
    : null;

  const valorInformado = numeroOuNull(f.valorTotalRestricoes);
  const somaLista = lista
    ? lista.reduce((soma, r) => soma + (numeroOuNull(r?.valor) ?? 0), 0)
    : 0;
  const valorTotal =
    valorInformado != null && valorInformado > 0 ? valorInformado : somaLista > 0 ? somaLista : null;

  const faixa = s?.faixa ? (FAIXA_ROTULO[s.faixa] ?? null) : null;
  const sit = f.situacaoCadastral ? (SITUACAO_ROTULO[f.situacaoCadastral] ?? null) : null;
  const prob = numeroOuNull(s?.probabilidadeInadimplencia);

  return {
    titulo: (typeof f.nome === "string" && f.nome.trim()) || null,
    score,
    scoreOriginal,
    maximoOriginal,
    faixa,
    tom: tomScore(score),
    apontamentos,
    valorTotal,
    fatores,
    situacao: sit,
    probabilidade: prob != null && prob >= 0 && prob <= 100 ? prob : null,
  };
}

export function tomDoFator(valor: number | null): Tom {
  return valor == null ? "neutro" : valor > 0 ? "perigo" : "sucesso";
}

export function pluralizar(n: number, singular: string, plural?: string): string {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? singular : (plural ?? `${singular}s`)}`;
}

// ───────────────────────────── Histórico ─────────────────────────────

export interface LinhaHistorico {
  sucesso: boolean;
  erro: string | null;
  created_at: string;
}

/** Até quanto tempo um registro "sem retorno" ainda pode estar em andamento. */
const JANELA_ANDAMENTO_MS = 3 * 60_000;

export function situacaoDoHistorico(
  l: LinhaHistorico,
  agora: number = Date.now(),
): { tom: Tom | "info"; texto: string } {
  if (l.sucesso) return { tom: "sucesso", texto: "Concluída" };
  const erro = (l.erro ?? "").trim();
  if (erro === "sem_retorno") {
    const t = new Date(l.created_at).getTime();
    if (Number.isFinite(t) && agora - t < JANELA_ANDAMENTO_MS) {
      return { tom: "info", texto: "Consultando" };
    }
    return { tom: "alerta", texto: "Sem retorno do fornecedor" };
  }
  if (erro === "sem_provedor") return { tom: "neutro", texto: "Sem bureau configurado" };
  if (erro.startsWith("sem_credenciais")) return { tom: "alerta", texto: "Chaves incompletas" };
  if (erro === "adaptador_ausente") return { tom: "neutro", texto: "Fornecedor em homologação" };
  return { tom: "perigo", texto: "Não entregue" };
}

/** "há 5 min", "ontem", "12/10/2026" — leitura rápida do histórico. */
export function quandoRelativo(iso: string, agora: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const seg = Math.round((agora - t) / 1000);
  if (seg < 60) return "agora";
  const min = Math.round(seg / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  return new Date(t).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
