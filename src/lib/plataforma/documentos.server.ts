/**
 * CPF/CNPJ COMPLETO da base de uma conta assinante para o analista — SÓ SERVIDOR.
 *
 * `plataforma.documentos_completos_da_conta` (migração 0212 do Corretor) abre os documentos
 * das linhas que a tela mostra pelo decifrar auditado de sempre (permissão `dados.decifrar`,
 * que vem com `saas.contas`) e registra UM acesso por consulta. Precisa da chave-mestra na
 * transação: chame dentro de `comPlataforma(..., { kek: comChave() })`.
 *
 * Apoio, não trava a tela: sem a 0212, sem a chave ou sem permissão, devolve vazio e a lista
 * segue com o que já tinha.
 */
import type { TxPlataforma } from "./ponte.server";

export interface DocumentosCompletos {
  documento?: string;
  documento_conjuge?: string;
  participantes?: { nome: string; documento?: string }[];
}

/** A chave só entra na transação quando o servidor a tem (senão a ponte recusaria tudo). */
export const comChave = () => Boolean(process.env.CORRETOR_KEK);

export async function documentosCompletos(
  tx: TxPlataforma,
  tenant: string,
  tipo: "clientes" | "simulacoes" | "propostas",
  ids: string[],
): Promise<Record<string, DocumentosCompletos>> {
  if (ids.length === 0 || !comChave()) return {};
  await tx.consultar("savepoint documentos_completos");
  try {
    const r = await tx.uma<{ r: Record<string, DocumentosCompletos> }>(
      "select plataforma.documentos_completos_da_conta($1, $2, $3::uuid[]) as r",
      [tenant, tipo, ids.slice(0, 100)],
    );
    await tx.consultar("release savepoint documentos_completos");
    return r?.r ?? {};
  } catch (e) {
    await tx.consultar("rollback to savepoint documentos_completos");
    console.warn("[documentos-completos]", tipo, (e as { code?: string }).code);
    return {};
  }
}
