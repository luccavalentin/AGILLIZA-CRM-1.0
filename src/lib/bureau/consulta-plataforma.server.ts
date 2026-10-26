/**
 * Consulta Ficha do correspondente pelo MESMO caminho do Agilliza Tech (0319, 26/10/2026) — SÓ SERVIDOR.
 *
 * APIFull (Serasa Premium) pela fila do worker do Agilliza Tech, com a credencial cadastrada em
 * Configurações gerais › Chaves dos provedores. O correspondente não paga crédito (contrato
 * próprio): o pedido nasce pago pelo contrato e o custo do fornecedor entra em "Consultas pagas".
 * A permissão da pessoa (Clientes) é conferida no próprio banco. Aqui só a orquestração, com as
 * dependências injetáveis para teste (fornecedor e ponte simulados).
 */
import type { TxPlataforma } from "@/lib/plataforma/ponte.server";
import type { FichaBureau } from "./tipos";
import { fichaDaApifull, type ResultadoDaPlataforma } from "./apifull-ficha";

export interface DependenciasConsulta {
  /** A ponte está configurada neste servidor (PONTE_DATABASE_URL)? */
  ponteConfigurada: () => boolean;
  /** A chave de cifragem do Agilliza Tech está neste servidor (CORRETOR_KEK)? */
  temChave: () => boolean;
  /** Credencial da APIFull cadastrada (null = sem chave). */
  credencial: () => Promise<{ segredo: Record<string, string> } | null>;
  ponte: <R>(fn: (tx: TxPlataforma) => Promise<R>, opcoes?: { kek?: boolean }) => Promise<R>;
}

export const MSG_SEM_PONTE =
  "A gestão da plataforma não está configurada neste servidor: a consulta não pode sair.";
export const MSG_SEM_CHAVE_CIFRAGEM =
  "A chave de cifragem do Agilliza Tech não está configurada neste servidor: a consulta não pode sair.";
export const MSG_SEM_CREDENCIAL =
  "A chave da APIFull não está cadastrada. Cadastre-a em Configurações gerais › Chaves dos provedores.";
export const MSG_DESLIGADA =
  "A consulta Serasa Premium está desligada na plataforma (Configurações gerais › Consultas pagas).";
export const MSG_SEM_CUSTO =
  "O custo do fornecedor da consulta não está cadastrado (Configurações gerais › Consultas pagas).";

export interface Prontidao {
  pronto: boolean;
  motivo: string | null;
}

/** Pode consultar agora? Diz exatamente o que falta (sem chave, desligada, sem custo…). */
export async function prontidaoDaConsulta(dep: DependenciasConsulta): Promise<Prontidao> {
  if (!dep.ponteConfigurada()) return { pronto: false, motivo: MSG_SEM_PONTE };
  if (!dep.temChave()) return { pronto: false, motivo: MSG_SEM_CHAVE_CIFRAGEM };
  const cred = await dep.credencial().catch(() => null);
  if (!cred?.segredo?.APIFULL_TOKEN?.trim()) return { pronto: false, motivo: MSG_SEM_CREDENCIAL };
  const d = await dep
    .ponte((tx) => tx.uma<{ d: { ativo: boolean; custo: number | null } }>(
      "select plataforma.consulta_ficha_disponivel() as d",
    ))
    .catch(() => null);
  if (!d?.d) return { pronto: false, motivo: "A plataforma não respondeu agora. Tente de novo em instantes." };
  if (!d.d.ativo) return { pronto: false, motivo: MSG_DESLIGADA };
  if (d.d.custo == null) return { pronto: false, motivo: MSG_SEM_CUSTO };
  return { pronto: true, motivo: null };
}

export type BaseLegal = "consentimento" | "protecao_credito" | "execucao_contrato" | "legitimo_interesse";

/** Pede a consulta (nasce paga pelo contrato, na fila do worker). */
export async function solicitarNaPlataforma(
  dep: DependenciasConsulta,
  a: {
    userId: string;
    documento: string;
    nome: string | null;
    finalidade: string;
    base: BaseLegal;
    autorizou: boolean;
  },
): Promise<{ pedidoId: string; existente: boolean }> {
  const pronto = await prontidaoDaConsulta(dep);
  if (!pronto.pronto) throw Object.assign(new Error(pronto.motivo ?? "Consulta indisponível."), { code: "P0001" });
  const r = await dep.ponte(
    (tx) =>
      tx.uma<{ r: { pedido_id: string; existente: boolean } }>(
        "select plataforma.solicitar_consulta_ficha_correspondente($1, $2, $3, $4, $5, $6) as r",
        [a.userId, a.documento, a.nome, a.finalidade, a.base, a.autorizou],
      ),
    { kek: true },
  );
  if (!r?.r?.pedido_id) throw new Error("A plataforma não devolveu o pedido da consulta.");
  return { pedidoId: r.r.pedido_id, existente: Boolean(r.r.existente) };
}

export type Andamento =
  | { situacao: "na_fila" | "executando" | "reconciliar" }
  | { situacao: "concluida"; ficha: FichaBureau }
  | { situacao: "falhou"; mensagem: string };

const FALHAS: Record<string, string> = {
  saldo: "O fornecedor está sem saldo de consultas. A equipe da plataforma já foi avisada.",
  rejeicao: "O fornecedor recusou a consulta deste documento.",
  fornecedor: "O fornecedor não entregou o resultado. Tente de novo mais tarde.",
  interna: "A consulta não foi concluída. Tente de novo mais tarde.",
  ambigua: "O fornecedor não respondeu de forma conclusiva; a plataforma confere o extrato.",
};

/** Lê a situação do pedido; concluído, devolve a ficha no formato do Agilliza. */
export async function acompanharNaPlataforma(
  dep: DependenciasConsulta,
  a: { userId: string; pedidoId: string; documento: string },
): Promise<Andamento> {
  const r = await dep.ponte(
    (tx) =>
      tx.uma<{ r: ResultadoDaPlataforma & { situacao: string; tipo_falha: string | null } }>(
        "select plataforma.resultado_consulta_ficha_correspondente($1, $2) as r",
        [a.userId, a.pedidoId],
      ),
    { kek: dep.temChave() },
  );
  const x = r?.r;
  if (!x) throw new Error("Consulta não encontrada.");
  if (x.situacao === "concluida") return { situacao: "concluida", ficha: fichaDaApifull(a.documento, x) };
  if (x.situacao === "falhou" || x.situacao === "nao_executada") {
    return { situacao: "falhou", mensagem: FALHAS[x.tipo_falha ?? "interna"] ?? FALHAS.interna };
  }
  if (x.situacao === "executando" || x.situacao === "reconciliar") return { situacao: x.situacao };
  return { situacao: "na_fila" };
}

/** Dependências reais (carregar só no servidor). */
export async function dependenciasReaisConsulta(): Promise<DependenciasConsulta> {
  const { comPonteDireta, credencialDoSistema } = await import("@/lib/plataforma/ponte.server");
  return {
    ponteConfigurada: () => Boolean(process.env.PONTE_DATABASE_URL),
    temChave: () => Boolean(process.env.CORRETOR_KEK),
    credencial: () => credencialDoSistema("apifull"),
    ponte: comPonteDireta,
  };
}
