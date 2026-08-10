import {
  CATALOGO_MODULOS,
  type AcessoTipo,
  type EscopoDados,
  type NivelAcesso,
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
  { value: "gestor", label: "Gestão" },
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
  gestor: "Gestão",
  comercial: "Comercial",
  analista: "Analista",
  corretor: "Corretor",
  imobiliaria: "Imobiliária",
};

export const chave = (modulo: string, acao: string) => `${modulo}:${acao}`;

export function estadoInicial(nivel: NivelAcesso): MatrizEstado {
  const estado: MatrizEstado = {};
  for (const mod of CATALOGO_MODULOS) {
    for (const a of mod.acoes) {
      const atual = nivel.permissoes.find(
          (p) => p.modulo === mod.modulo && p.acao === a.acao,
      );
      estado[chave(mod.modulo, a.acao)] = {
        permitido: atual?.permitido ?? false,
        escopo: atual?.escopo_dados ?? "proprios",
      };
    }
  }
  return estado;
}
