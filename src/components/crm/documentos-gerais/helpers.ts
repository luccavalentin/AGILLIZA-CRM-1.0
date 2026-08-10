import type { DGCliente } from "@/lib/crm/documentos-gerais.functions";

export const brl = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function fmtData(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export const SEM_CORRETOR = "Sem corretor vinculado";
export const SEM_CORRETOR_KEY = "__sem_corretor__";
export const SEM_IMOB = "Sem imobiliária";
export const SEM_IMOB_KEY = "__sem_imob__";
export const SEM_COMERCIAL_KEY = "__sem_comercial__";
export const RAIZ_KEY = "__raiz_principal__";
export const RAIZ_NOME = "Pasta Comercial e documentos de clientes";

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "di", "du"]);

/** Formata nomes em Maiúscula/minúscula corretas ("NOVA SOLUÇÃO" → "Nova Solução"). */
export function titulo(s: string | null | undefined): string {
  if (!s || !s.trim()) return "—";
  return s.toLowerCase().replace(/\S+/g, (palavra, offset: number) => {
    if (offset !== 0 && MINUSCULAS.has(palavra)) return palavra;
    return palavra.charAt(0).toUpperCase() + palavra.slice(1);
  });
}

/** Primeiro nome já formatado ("LUCCA VALENTIN" → "Lucca"). */
export function primeiroNome(s: string | null | undefined): string {
  const t = titulo(s);
  return t === "—" ? "" : t.split(" ")[0];
}

/** Formata documento (CPF/CNPJ) completo para exibição interna do CRM. */
export function formatarDocumento(v: string | null | undefined): string | null {
  if (!v) return null;
  const digits = v.replace(/\D/g, "");
  if (digits.length === 11) {
    return `CPF: ${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 14) {
    return `CNPJ: ${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  return v;
}

export type PastaTipo = "raiz" | "comercial" | "imob" | "corretor" | "analista";
export type Aba = "cliente" | "comercial" | "imobiliaria" | "corretor" | "analista" | "lixeira";
export type OrdemChave = "nome-asc" | "nome-desc" | "docs-desc" | "docs-asc";
export type ModoLista = "grid" | "lista";
export type Visao = "hierarquia" | "imobiliarias" | "corretores" | "analistas" | "clientes";

export interface PastaNode {
  key: string;
  nome: string;
  tipo: PastaTipo;
  subpastas: PastaNode[];
  clientes: DGCliente[];
  total_clientes: number;
  analistas?: Map<string, string>;
}

export const PASTA_BADGE: Record<PastaTipo, { label: string; classe: string }> = {
  raiz: { label: "Pasta principal", classe: "border-primary/25 bg-primary/10 text-primary" },
  comercial: {
    label: "Comercial Agilliza",
    classe: "border-primary/25 bg-primary/10 text-primary",
  },
  imob: { label: "Imobiliária", classe: "border-primary/25 bg-primary/10 text-primary" },
  corretor: { label: "Corretor", classe: "border-primary/25 bg-primary/10 text-primary" },
  analista: { label: "Analista", classe: "border-primary/25 bg-primary/10 text-primary" },
};

export function garantirFilho(
  pai: PastaNode,
  key: string,
  nome: string,
  tipo: PastaTipo,
): PastaNode {
  let filho = pai.subpastas.find((p) => p.key === key);
  if (!filho) {
    filho = { key, nome, tipo, subpastas: [], clientes: [], total_clientes: 0 };
    pai.subpastas.push(filho);
  }
  return filho;
}

export function finalizar(node: PastaNode): number {
  let total = node.clientes.length;
  for (const s of node.subpastas) total += finalizar(s);
  node.subpastas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  node.clientes.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  node.total_clientes = total;
  return total;
}
