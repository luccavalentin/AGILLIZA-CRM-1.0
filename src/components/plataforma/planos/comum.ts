/**
 * Formatação e regras de tela do catálogo de planos (Planos, preços e créditos).
 * Puras: testadas em `comum.test.ts`.
 */
import { formatBRL } from "@/lib/financeiro/format";
import type { PlanoCatalogo } from "@/lib/plataforma/planos.functions";

/** "1.234,50" ou "1234.5" → número; vazio → null; inválido → NaN. */
export function numero(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : NaN;
}

/** Número → "79,90" (máscara de moeda pt-BR; até 4 casas para preço por contato). */
export const texto = (n: number | null | undefined) =>
  n == null ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/** Reescreve o que foi digitado no formato da máscara ao sair do campo. */
export const normalizarMoeda = (v: string) => {
  const n = numero(v);
  return n == null || Number.isNaN(n) ? v : texto(n);
};

/** Ajuda do campo de pacote: "= R$ 287,70 por mês no site." ou "Vazio = não vende." */
export const porMes = (v: string, meses: number) => {
  const n = numero(v);
  return n == null || Number.isNaN(n)
    ? "Vazio = não vende."
    : `= ${formatBRL(Math.round((n / meses) * 100) / 100)} por mês no site.`;
};

/** Plural de verdade: "1 assinatura ativa" / "2 assinaturas ativas". */
export const assinaturasAtivas = (n: number) =>
  `${n.toLocaleString("pt-BR")} ${n === 1 ? "assinatura ativa" : "assinaturas ativas"}`;

const RECURSO: Record<string, string> = {
  usuarios: "Usuários",
  imoveis: "Imóveis",
  clientes: "Clientes",
  contatos: "Contatos",
  financeiro: "Financeiro",
  ia: "IA",
  site: "Site",
  locacao: "Locação",
  creditos: "Créditos",
  marketplace: "Marketplace",
  simulacoes: "Simulações",
  propostas: "Propostas",
  armazenamento: "Armazenamento",
};
const ATRIBUTO: Record<string, string> = { max: "", creditos_mes: "créditos por mês", por_mes: "por mês" };
const capitalizar = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Nome e valor legíveis de um limite: `imoveis.max: 50` → ["Imóveis", "até 50"]. */
export function partesLimite(chave: string, valor: unknown): [string, string] {
  const [base, ...resto] = chave.split(".");
  const nome = RECURSO[base] ?? capitalizar(base.replace(/_/g, " "));
  const sub = resto
    .map((r) => ATRIBUTO[r] ?? r.replace(/_/g, " "))
    .filter(Boolean)
    .join(" ");
  const titulo = sub ? `${nome} · ${sub}` : nome;
  let v: string;
  if (valor === -1 || valor === "-1") v = "sem limite";
  else if (valor === true) v = "incluído";
  else if (valor === false) v = "não incluído";
  else if (typeof valor === "number")
    v = resto[0] === "max" ? `até ${valor.toLocaleString("pt-BR")}` : valor.toLocaleString("pt-BR");
  else if (typeof valor === "string") v = capitalizar(valor.replace(/_/g, " "));
  else v = JSON.stringify(valor);
  return [titulo, v];
}

export const rotuloLimite = (chave: string, valor: unknown) => partesLimite(chave, valor).join(": ");

export interface PeriodoVitrine {
  nome: string;
  total: number;
  meses: number;
}

/** O que o site mostra, do que está gravado: mensal (se vende) e os pacotes com preço (0253). */
export function vitrineDoPlano(p: PlanoCatalogo): PeriodoVitrine[] {
  return [
    p.vende_mensal !== false && { nome: "Mensal", total: p.preco_mensal, meses: 1 },
    p.preco_trimestral != null && { nome: "Trimestral", total: p.preco_trimestral, meses: 3 },
    p.preco_semestral != null && { nome: "Semestral", total: p.preco_semestral, meses: 6 },
    p.preco_anual != null && { nome: "Anual", total: p.preco_anual, meses: 12 },
  ].filter((x): x is PeriodoVitrine => Boolean(x));
}

/** Menor preço mensal que o plano oferece (o "a partir de" do cartão). */
export function menorMensal(p: PlanoCatalogo): number {
  const opcoes = vitrineDoPlano(p).map((v) => v.total / v.meses);
  return opcoes.length ? Math.min(...opcoes) : p.preco_mensal;
}

/** Horas → "4 h", "1 d", "2 d 6 h" (ajuda dos prazos de suporte). */
export function horasLegiveis(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return "—";
  const d = Math.floor(h / 24);
  const r = h % 24;
  if (!d) return `${r} h`;
  return r ? `${d} d ${r} h` : `${d} d`;
}
