/**
 * Filtros das propostas dos assinantes (C30/C31, 26/10/2026) — regras puras, testáveis.
 *
 * Os mesmos filtros da Gestão de propostas do Agilliza Tech (`plataforma.consultar_propostas`):
 * situação, banco, período, responsável (usuário da conta), analista, aceite, busca e página.
 * O estado mora na URL (`?situacao=&banco=&de=&ate=&resp=&analista=&aceite=&q=&pag=`), ao lado
 * do filtro de base (`?base=&conta=`). Valor torto vira "sem filtro", nunca erro na tela.
 */
import { ROTULO_PROPOSTA_ASSINANTE } from "@/lib/plataforma/rotulos-proposta-assinante";
import { searchDoFiltro, type AlvoDoFiltro } from "@/lib/plataforma/filtro-base";

export type Aceite = "todas" | "pendentes" | "minhas";

export interface FiltrosPainel {
  status: string | null;
  banco: string | null;
  de: string | null;
  ate: string | null;
  usuario: string | null;
  analista: string | null;
  aceite: Aceite;
  termo: string;
  pagina: number;
}

export const FILTROS_VAZIOS: FiltrosPainel = {
  status: null,
  banco: null,
  de: null,
  ate: null,
  usuario: null,
  analista: null,
  aceite: "todas",
  termo: "",
  pagina: 1,
};

/** Bancos que operam com o correspondente (ids do Agilliza Tech, `operacional.bancos`). */
export const BANCOS_ASSINANTES: { id: string; nome: string }[] = [
  { id: "bradesco", nome: "Bradesco" },
  { id: "caixa", nome: "Caixa" },
  { id: "inter", nome: "Inter" },
  { id: "itau", nome: "Itaú" },
  { id: "santander", nome: "Santander" },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BANCO = /^[a-z_]{2,30}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

function txt(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function dataValida(v: unknown): string | null {
  const s = txt(v);
  if (!s || !DATA.test(s)) return null;
  const d = new Date(`${s}T12:00:00Z`);
  // "2026-02-31" vira março no Date: só vale se a data voltar igual.
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}

export function statusValido(v: unknown): string | null {
  const s = txt(v);
  return s && Object.prototype.hasOwnProperty.call(ROTULO_PROPOSTA_ASSINANTE, s) ? s : null;
}

/** Normaliza o que veio da tela/URL. Período invertido é trocado (de ≤ até). */
export function normalizarFiltros(bruto: Partial<Record<keyof FiltrosPainel, unknown>>): FiltrosPainel {
  let de = dataValida(bruto.de);
  let ate = dataValida(bruto.ate);
  if (de && ate && de > ate) [de, ate] = [ate, de];
  const banco = txt(bruto.banco);
  const usuario = txt(bruto.usuario);
  const analista = txt(bruto.analista);
  const aceite = txt(bruto.aceite);
  const pagina = Number(txt(bruto.pagina) ?? 1);
  return {
    status: statusValido(bruto.status),
    banco: banco && BANCO.test(banco) ? banco : null,
    de,
    ate,
    usuario: usuario && UUID.test(usuario) ? usuario.toLowerCase() : null,
    analista:
      analista === "sem" ? "sem" : analista && UUID.test(analista) ? analista.toLowerCase() : null,
    aceite: aceite === "pendentes" || aceite === "minhas" ? aceite : "todas",
    termo: (txt(bruto.termo) ?? "").slice(0, 120),
    pagina: Number.isInteger(pagina) && pagina >= 1 && pagina <= 1000 ? pagina : 1,
  };
}

/** URL → filtros. */
export function lerFiltrosDaUrl(search: Record<string, unknown> | null | undefined): FiltrosPainel {
  const s = search ?? {};
  return normalizarFiltros({
    status: s.situacao,
    banco: s.banco,
    de: s.de,
    ate: s.ate,
    usuario: s.resp,
    analista: s.analista,
    aceite: s.aceite,
    termo: s.q,
    pagina: s.pag,
  });
}

/** Filtros → URL (sem os padrões, para o endereço ficar limpo). */
export function paramsDosFiltros(f: FiltrosPainel): Record<string, string> {
  const n = normalizarFiltros(f);
  const p: Record<string, string> = {};
  if (n.status) p.situacao = n.status;
  if (n.banco) p.banco = n.banco;
  if (n.de) p.de = n.de;
  if (n.ate) p.ate = n.ate;
  if (n.usuario) p.resp = n.usuario;
  if (n.analista) p.analista = n.analista;
  if (n.aceite !== "todas") p.aceite = n.aceite;
  if (n.termo) p.q = n.termo;
  if (n.pagina > 1) p.pag = String(n.pagina);
  return p;
}

/** Chaves de URL deste painel (para limpar sem mexer no resto do endereço). */
export const CHAVES_URL_PAINEL = ["situacao", "banco", "de", "ate", "resp", "analista", "aceite", "q", "pag"];

/**
 * Entrada de `listarPropostasDoGrupo`. Responsável só vale com UMA conta escolhida (os usuários
 * são da conta); "Sua base" com tudo junto esconde o que já foi levado ao Agilliza.
 */
export function payloadDosFiltros(f: FiltrosPainel, alvo: Pick<AlvoDoFiltro, "grupo" | "licenca" | "semNoAgilliza">) {
  if (!alvo.grupo) return null;
  const n = normalizarFiltros(f);
  return {
    grupo: alvo.grupo,
    licenca: alvo.licenca ?? null,
    termo: n.termo || null,
    status: n.status,
    banco: n.banco,
    de: n.de,
    ate: n.ate,
    usuario: alvo.licenca ? n.usuario : null,
    analista: n.analista,
    aceite: n.aceite,
    semNoAgilliza: alvo.semNoAgilliza,
    pagina: n.pagina,
  };
}

export interface ChipFiltro {
  chave: keyof FiltrosPainel;
  rotulo: string;
}

const dataBr = (s: string) => s.split("-").reverse().join("/");

/** Chips dos filtros ativos (cada um com o "x" que tira só ele). */
export function chipsAtivos(
  f: FiltrosPainel,
  nomes: { usuarios?: Record<string, string>; analistas?: Record<string, string> } = {},
): ChipFiltro[] {
  const n = normalizarFiltros(f);
  const chips: ChipFiltro[] = [];
  if (n.termo) chips.push({ chave: "termo", rotulo: `Busca: “${n.termo}”` });
  if (n.status) chips.push({ chave: "status", rotulo: ROTULO_PROPOSTA_ASSINANTE[n.status] });
  if (n.banco)
    chips.push({
      chave: "banco",
      rotulo: BANCOS_ASSINANTES.find((b) => b.id === n.banco)?.nome ?? n.banco,
    });
  if (n.de || n.ate)
    chips.push({
      chave: n.de ? "de" : "ate",
      rotulo: n.de && n.ate ? `${dataBr(n.de)} a ${dataBr(n.ate)}` : n.de ? `Desde ${dataBr(n.de)}` : `Até ${dataBr(n.ate!)}`,
    });
  if (n.usuario) chips.push({ chave: "usuario", rotulo: `Responsável: ${nomes.usuarios?.[n.usuario] ?? "selecionado"}` });
  if (n.analista)
    chips.push({
      chave: "analista",
      rotulo: n.analista === "sem" ? "Sem analista" : `Analista: ${nomes.analistas?.[n.analista] ?? "selecionado"}`,
    });
  if (n.aceite !== "todas") chips.push({ chave: "aceite", rotulo: n.aceite === "pendentes" ? "Esperando analista" : "Minhas" });
  return chips;
}

/** Tira um filtro (período sai inteiro) e volta à página 1. */
export function semFiltro(f: FiltrosPainel, chave: keyof FiltrosPainel): FiltrosPainel {
  const extra = chave === "de" || chave === "ate" ? { de: null, ate: null } : { [chave]: FILTROS_VAZIOS[chave] };
  return { ...f, ...extra, pagina: 1 };
}

/** Rótulo do identificador da integração: sempre "ID H." (nunca o nome do provedor). */
export function rotuloIdH(id: string | number | null | undefined): string {
  const s = id == null ? "" : String(id).trim();
  return s ? `ID H. ${s}` : "ID H. —";
}

/** Etapas da mini-esteira (mesma régua do Agilliza Tech, com "Contrato registrado"). */
export const ESTEIRA_ASSINANTE = [
  { id: "fila", rotulo: "Fila", status: ["aguardando_correspondente", "em_envio", "erro_envio"] },
  { id: "credito", rotulo: "Crédito", status: ["enviada", "em_analise", "condicionada", "aprovada", "recusada"] },
  { id: "documentos", rotulo: "Documentos", status: ["formularios", "aguardando_documentos"] },
  { id: "engenharia", rotulo: "Engenharia", status: ["engenharia_vistoria"] },
  { id: "juridico", rotulo: "Jurídico", status: ["analise_juridica"] },
  { id: "contrato", rotulo: "Contrato emitido", status: ["contrato"] },
  { id: "registro", rotulo: "Contrato registrado", status: ["registrado"] },
] as const;

/** Índice da etapa da esteira (-1 = cancelada/desconhecida). */
export function etapaDaEsteira(status: string): number {
  return ESTEIRA_ASSINANTE.findIndex((e) => (e.status as readonly string[]).includes(status));
}

/**
 * Situação de interligação de uma proposta do assinante com o Agilliza (C31): o que a fila
 * mostra e o que o próximo passo é. Pura, para testar o caminho fila → levar → envio → retorno.
 */
export function passoDaInterligacao(p: {
  status: string;
  pendente: boolean;
  minha: boolean;
  no_agilliza?: boolean;
  proposta_agilliza_id?: string | null;
}): "assumir" | "levar_e_enviar" | "acompanhar" | "encerrada" | "com_outro" {
  if (["cancelada", "recusada", "registrado"].includes(p.status) && !p.proposta_agilliza_id) return "encerrada";
  if (p.proposta_agilliza_id) return "acompanhar";
  if (p.pendente) return "assumir";
  if (p.minha && ["aguardando_correspondente", "erro_envio"].includes(p.status)) return "levar_e_enviar";
  if (["aguardando_correspondente", "erro_envio"].includes(p.status)) return "com_outro";
  return "acompanhar";
}

/** Parâmetros da URL desta tela: filtro de base (C07/C30) + filtros do painel dos assinantes. */
export type BuscaPropostas = {
  base?: "assinantes";
  origem?: "agilliza" | "vinculados";
  conta?: string;
  situacao?: string;
  banco?: string;
  de?: string;
  ate?: string;
  resp?: string;
  analista?: string;
  aceite?: string;
  q?: string;
  pag?: string;
  /** Endereço antigo (menu Plataforma): vira `base=assinantes`. */
  aba?: "assinantes";
};

export function validarBuscaPropostas(search: Record<string, unknown>): BuscaPropostas {
  const legado = search.aba === "assinantes" && !search.base ? { ...search, base: "assinantes" } : search;
  return { ...searchDoFiltro(legado), ...paramsDosFiltros(lerFiltrosDaUrl(legado)) };
}
