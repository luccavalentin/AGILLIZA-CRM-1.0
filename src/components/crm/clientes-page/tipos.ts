import { iniciaisDoNome } from "@/components/shared/iniciais";
export type Portal = "todos" | "ativo" | "inativo";
export type StatusF = "todos" | "ativo" | "inativo";
export type Escopo = "minhas" | "geral";

export function iniciais(nome: string) {
  return iniciaisDoNome(nome);
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
  /** `false` esconde a lixeira (sem permissão de excluir em Clientes). */
  pode_excluir?: boolean;
  /** Base de uma conta assinante: a licença de origem (selo discreto na lista). */
  _conta?: string | null;
};
