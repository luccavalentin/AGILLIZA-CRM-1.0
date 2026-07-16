import type {
  AcessoTipo,
  EscopoDados,
  NivelAcesso,
} from "@/lib/admin/regras-modulos.functions";

export type MatrizEstado = Record<
  string,
  { permitido: boolean; escopo: EscopoDados }
>;

export const ESCOPOS: { value: EscopoDados; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "equipe", label: "Equipe" },
  { value: "proprios", label: "Somente os meus" },
  { value: "personalizado", label: "Personalizado" },
];

export const PAPEIS_ALVO: { value: string; label: string }[] = [
  { value: "gestor", label: "Gestor" },
  { value: "comercial", label: "Comercial" },
  { value: "analista", label: "Analista" },
  { value: "financeiro", label: "Financeiro" },
  { value: "corretor", label: "Corretor" },
  { value: "imobiliaria", label: "Imobiliária" },
];

export const PORTAIS: { value: AcessoTipo; label: string }[] = [
  { value: "sistema", label: "Portal do Correspondente" },
  { value: "portal_parceiro", label: "Portal do Parceiro" },
];

export const PAPEL_LABEL: Record<string, string> = {
  gestor: "Gestor",
  comercial: "Comercial",
  analista: "Analista",
  corretor: "Corretor",
  imobiliaria: "Imobiliária",
};

export const chave = (modulo: string, acao: string) => `${modulo}:${acao}`;

export function estadoInicial(nivel: NivelAcesso): MatrizEstado {
  const estado: MatrizEstado = {};
  // Import lazily via caller to avoid circular; we accept the catálogo as argument below when needed.
  return estado;
}

// Helper importado no painel — mantido aqui por proximidade semântica com o restante das constantes.
export { estadoInicialFromCatalogo } from "./estado-inicial";
