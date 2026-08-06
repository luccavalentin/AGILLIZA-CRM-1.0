export type Portal = "todos" | "ativo" | "inativo";
export type StatusF = "todos" | "ativo" | "inativo";
export type Escopo = "minhas" | "geral";

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  const a = partes[0]?.[0] ?? "";
  const b = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (a + b).toUpperCase() || "?";
}

export type ClienteItem = {
  id: string;
  nome: string;
  numero_cliente: string;
  documento: string;
  documento_masc?: boolean;
  email?: string | null;
  telefone_celular?: string | null;
  etapa_nome?: string | null;
  responsavel_nome?: string | null;
  portal_acesso_ativo?: boolean;
};
