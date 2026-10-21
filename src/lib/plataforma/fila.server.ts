/**
 * Peças de servidor da fila de propostas dos assinantes — SÓ SERVIDOR.
 * Carregar por import dinâmico dentro dos handlers (como `ponte.server`).
 */
import type { TxPlataforma } from "./ponte.server";
import type { PropostaAssinante } from "./fila.functions";

/** Erro com mensagem escrita para gente: `traduzir` (ponte) repassa P0001 como está. */
export function erroLegivel(mensagem: string): Error {
  return Object.assign(new Error(mensagem), { code: "P0001" });
}

/**
 * Anota em cada proposta o vínculo com o Agilliza (cópia por baixo): o número interno de lá,
 * a simulação e a proposta do Agilliza. A mesma proposta tinha números diferentes em cada sistema e a fila
 * não dizia qual era qual. Leitura de apoio: se o vínculo não puder ser lido neste
 * contexto, a lista segue como antes (savepoint para não abortar a transação).
 */
export async function anotarVinculoAgilliza(tx: TxPlataforma, propostas: PropostaAssinante[]) {
  if (propostas.length === 0) return;
  await tx.consultar("savepoint numero_agilliza");
  try {
    const vinculos = await tx.consultar<{
      id: string;
      numero: string | null;
      simulacao_id: string;
      proposta_id: string | null;
    }>(
      `select pa.proposta_id::text as id,
              coalesce(pr.numero_proposta, s.numero_simulacao) as numero,
              pa.simulacao_agilliza_id::text as simulacao_id,
              pa.proposta_agilliza_id::text as proposta_id
         from plataforma.propostas_no_agilliza pa
         left join public.propostas pr on pr.id = pa.proposta_agilliza_id
         left join public.simulacoes s on s.id = pa.simulacao_agilliza_id
        where pa.proposta_id = any($1::uuid[])`,
      [propostas.map((p) => p.id)],
    );
    const porId = new Map(vinculos.map((v) => [v.id, v]));
    for (const p of propostas) {
      const v = porId.get(p.id);
      if (v) {
        p.no_agilliza = true;
        p.numero_agilliza = v.numero ?? null;
        p.simulacao_agilliza_id = v.simulacao_id;
        p.proposta_agilliza_id = v.proposta_id;
      }
    }
    await tx.consultar("release savepoint numero_agilliza");
  } catch {
    await tx.consultar("rollback to savepoint numero_agilliza");
  }
}

export interface ResultadoPreparo {
  cliente_id: string;
  simulacao_id: string;
  numero_simulacao: string;
  cliente_reaproveitado?: boolean;
  ja_trazida: boolean;
  /** Cotações do assinante copiadas prontas (mesmos números e ids da HomeFin). */
  cotacoes: number;
  /** Linha do banco escolhido pelo assinante, na simulação do Agilliza. */
  simulacao_banco_id: string | null;
  banco_id: string | null;
  nome_banco: string | null;
  banco_cotado: boolean;
  /** O que falta do endereço do imóvel (o banco recusa sem ele) — 0210 do Corretor. */
  pendencias_imovel?: string[];
}

/** Assume a proposta se ela ainda está pendente. 23505 = outro analista assumiu antes. */
export async function assumirSePendente(userId: string, id: string, assumir: boolean) {
  if (!assumir) return false;
  const { comPlataforma } = await import("./ponte.server");
  await comPlataforma(userId, async (tx) => {
    try {
      await tx.consultar("select codigo from plataforma.assumir_proposta($1)", [id]);
    } catch (e) {
      // A mensagem do banco é clara; com o código 23xxx a ponte a trocaria por "dados inválidos".
      const err = e as { code?: string; message?: string };
      if (err.code === "23505") throw erroLegivel(err.message ?? "Esta proposta já foi assumida.");
      throw e;
    }
  });
  return true;
}

/**
 * Prepara a proposta do assinante para o envio pelo fluxo do Agilliza, POR BAIXO e sem
 * botão próprio: assume (se pendente) e garante, idempotente, o cliente e a simulação do
 * Agilliza com as MESMAS cotações que o assinante fez (`plataforma.preparar_envio_no_agilliza`,
 * migração 0208 do Corretor). O envio é o de sempre (criarProposta + envio da proposta).
 * A situação volta sozinha ao assinante (gatilhos 0178/0179/0187/0189).
 */
export async function assumirEPreparar(
  userId: string,
  id: string,
  assumir: boolean,
): Promise<ResultadoPreparo & { assumida: boolean }> {
  const { comPlataforma, comConta } = await import("./ponte.server");
  const assumida = await assumirSePendente(userId, id, assumir);
  const ctx = await comPlataforma(userId, (tx) =>
    tx.uma<{ t: string | null }>("select plataforma.contexto_da_proposta($1) ->> 't' as t", [id]),
  );
  if (!ctx?.t) throw new Error("Proposta não encontrada.");
  const r = await comConta(userId, ctx.t, async (tx) => {
    try {
      return await tx.uma<{ r: ResultadoPreparo }>(
        "select plataforma.preparar_envio_no_agilliza($1, $2) as r",
        [id, userId],
      );
    } catch (e) {
      if ((e as { code?: string }).code === "42883") {
        throw erroLegivel(
          "O envio pela simulação do assinante ainda não está disponível neste servidor (falta a migração 0208 do Corretor 2.0).",
        );
      }
      throw e;
    }
  });
  if (!r?.r) throw new Error("Não foi possível preparar o envio desta proposta.");
  return { ...r.r, assumida };
}
