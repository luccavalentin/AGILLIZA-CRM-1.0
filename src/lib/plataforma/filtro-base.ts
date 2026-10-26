/**
 * Filtro de base do correspondente (pedido do dono de 26/10/2026: C07, C08, C27, C29, C30).
 *
 * Um filtro só para Clientes, Consulta simulações, Simulação e Propostas:
 *  - **Sua base** (padrão): o próprio Agilliza (equipe e parceiros) + as contas do Agilliza Tech
 *    vinculadas diretamente ao correspondente (`nucleo.tenants.vinculo_agilliza`). Dá para olhar
 *    tudo junto, só o Agilliza, todas as vinculadas ou uma vinculada.
 *  - **Assinantes**: as demais licenças (corretores e imobiliárias), todas juntas (paginado no
 *    servidor) ou uma escolhida por busca.
 *
 * O estado mora na URL (`?base=assinantes&conta=<uuid>`, `?origem=agilliza`), então voltar,
 * recarregar e compartilhar o endereço mantêm o filtro. Aqui só regras puras (testáveis).
 */

export type Grupo = "vinculados" | "assinantes";
export type OrigemSuaBase = "tudo" | "agilliza" | "vinculados";

export interface ContaFiltro {
  id: string;
  nome: string;
  tipo: string;
  vinculo_agilliza?: boolean;
  documento_mascarado?: string | null;
  creci?: string | null;
  creci_uf?: string | null;
  situacao?: string | null;
  clientes?: number;
}

export type FiltroBase =
  | { base: "sua"; origem: OrigemSuaBase; contaId: string | null }
  | { base: "assinantes"; contaId: string | null };

export const FILTRO_PADRAO: FiltroBase = { base: "sua", origem: "tudo", contaId: null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function texto(v: unknown): string | null {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}

/** Lê o filtro da URL. Qualquer valor torto cai no padrão (Sua base, tudo). */
export function lerFiltroBase(search: Record<string, unknown> | null | undefined): FiltroBase {
  const s = search ?? {};
  const base = texto(s.base);
  const conta = texto(s.conta);
  const contaId = conta && UUID.test(conta) ? conta.toLowerCase() : null;
  if (base === "assinantes") return { base: "assinantes", contaId };
  const origemTxt = texto(s.origem);
  const origem: OrigemSuaBase =
    origemTxt === "agilliza" || origemTxt === "vinculados" ? origemTxt : "tudo";
  // Uma vinculada específica só faz sentido em "vinculados".
  if (contaId) return { base: "sua", origem: "vinculados", contaId };
  return { base: "sua", origem, contaId: null };
}

/** Parâmetros de URL do filtro (sem os padrões, para o endereço ficar limpo). */
export function paramsDoFiltro(f: FiltroBase): {
  base?: string;
  origem?: string;
  conta?: string;
} {
  if (f.base === "assinantes") return { base: "assinantes", ...(f.contaId ? { conta: f.contaId } : {}) };
  return {
    ...(f.origem !== "tudo" ? { origem: f.origem } : {}),
    ...(f.contaId ? { conta: f.contaId } : {}),
  };
}

/** O que cada tela precisa buscar com o filtro atual. */
export interface AlvoDoFiltro {
  /** Mostrar a base própria do Agilliza (lista de sempre). */
  agilliza: boolean;
  /** Grupo do Agilliza Tech a listar (ou nenhum). */
  grupo: Grupo | null;
  /** Conta específica do grupo (ou todas). */
  licenca: string | null;
  /** Em "Sua base" com tudo junto, o que já foi levado ao Agilliza aparece só pela cópia de lá. */
  semNoAgilliza: boolean;
}

export function alvoDoFiltro(f: FiltroBase): AlvoDoFiltro {
  if (f.base === "assinantes") {
    return { agilliza: false, grupo: "assinantes", licenca: f.contaId, semNoAgilliza: false };
  }
  if (f.origem === "agilliza") {
    return { agilliza: true, grupo: null, licenca: null, semNoAgilliza: false };
  }
  if (f.origem === "vinculados") {
    return { agilliza: false, grupo: "vinculados", licenca: f.contaId, semNoAgilliza: true };
  }
  return { agilliza: true, grupo: "vinculados", licenca: null, semNoAgilliza: true };
}

export function tipoDaConta(tipo: string | null | undefined): string {
  return tipo === "imobiliaria" ? "Imobiliária" : tipo === "corretor" ? "Corretor" : "Conta";
}

/** Iniciais para o avatar da conta ("Imobiliária Alfa" → "IA"; "beto" → "B"). */
export function iniciais(nome: string | null | undefined): string {
  const partes = (nome ?? "")
    .normalize("NFC")
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((p) => p.length > 0 && !/^(de|da|do|das|dos|e)$/i.test(p));
  if (partes.length === 0) return "?";
  const [a, b] = [partes[0], partes.length > 1 ? partes[partes.length - 1] : ""];
  return (a.charAt(0) + (b ? b.charAt(0) : "")).toUpperCase();
}

/** Rótulo curto do filtro para o título e para os chips. */
export function rotuloDoFiltro(f: FiltroBase, conta?: ContaFiltro | null): string {
  if (f.base === "assinantes") {
    return f.contaId ? (conta?.nome ?? "Assinante") : "Todos os assinantes";
  }
  if (f.origem === "agilliza") return "Sua base · só o Agilliza";
  if (f.origem === "vinculados") {
    return f.contaId ? `Sua base · ${conta?.nome ?? "conta vinculada"}` : "Sua base · vinculados";
  }
  return "Sua base";
}

/** O filtro difere do padrão? (mostra "Limpar"). */
export function filtroAtivo(f: FiltroBase): boolean {
  return !(f.base === "sua" && f.origem === "tudo" && !f.contaId);
}

/** Máscara de CPF/CNPJ para listas (LGPD): nunca mostra o documento inteiro. */
export function documentoSeguro(doc: string | null | undefined): string {
  const d = (doc ?? "").replace(/\D/g, "");
  if (!doc) return "";
  if (d.length === 11) return `***.${d.slice(3, 6)}.***-${d.slice(9)}`;
  if (d.length === 14) return `**.${d.slice(2, 5)}.***/****-${d.slice(12)}`;
  // Já mascarado pelo servidor (ou outro formato): devolve como veio, sem dígitos contínuos longos.
  return /\d{6,}/.test(doc) ? "" : doc;
}

/**
 * Para o `validateSearch` das rotas que validam a URL: devolve só os parâmetros do filtro, já
 * saneados (sem isso a rota descartaria `base`, `origem` e `conta`).
 */
export function searchDoFiltro(search: Record<string, unknown>): {
  base?: "assinantes";
  origem?: "agilliza" | "vinculados";
  conta?: string;
} {
  const f = lerFiltroBase(search);
  const p = paramsDoFiltro(f);
  return {
    ...(p.base === "assinantes" ? { base: "assinantes" as const } : {}),
    ...(p.origem === "agilliza" || p.origem === "vinculados" ? { origem: p.origem } : {}),
    ...(p.conta ? { conta: p.conta } : {}),
  };
}
