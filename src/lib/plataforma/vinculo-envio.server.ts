/**
 * Envio para aprovação de uma simulação que veio de uma conta assinante — SÓ SERVIDOR.
 *
 * Chamado pelo `criarProposta` do Agilliza (o mesmo de sempre), antes de criar a proposta:
 * quando a simulação do Agilliza é o espelho de uma simulação do assinante (ou foi refeita a
 * partir dele), a proposta do lado do assinante nasce PRIMEIRO — como o Corretor cria ao
 * "Enviar para aprovação" — já assumida pelo analista e vinculada a esta simulação. A proposta
 * do Agilliza que nasce em seguida é ligada pelo gatilho que já existe (0178/0179) e a situação
 * volta ao assinante pelo caminho de sempre. Migração 0211 do Corretor.
 *
 * Para a base própria do Agilliza nada muda: sem ponte, sem permissão de plataforma ou sem
 * espelho, a função não faz nada.
 */
export async function vincularEnvioAoAssinante({
  userId,
  simulacaoId,
  codigoBanco,
}: {
  userId: string;
  simulacaoId: string;
  codigoBanco: number | null | undefined;
}): Promise<{ propostaAssinante: string | null }> {
  if (!codigoBanco || !process.env.PONTE_DATABASE_URL) return { propostaAssinante: null };
  const { comPlataforma, comConta } = await import("./ponte.server");

  let alvo: { tenant_id: string; simulacao_id: string; simulacao_banco_id: string | null } | null =
    null;
  try {
    alvo =
      (
        await comPlataforma(userId, (tx) =>
          tx.uma<{
            r: {
              tenant_id: string;
              simulacao_id: string;
              simulacao_banco_id: string | null;
            } | null;
          }>("select plataforma.simulacao_do_assinante_no_envio($1, $2) as r", [
            simulacaoId,
            codigoBanco,
          ]),
        )
      )?.r ?? null;
  } catch {
    // Quem não opera a plataforma (ou servidor sem a 0211) envia a base própria como sempre.
    return { propostaAssinante: null };
  }
  // Banco que o assinante não cotou (incluído depois no Agilliza): não há cotação do lado dele
  // para a proposta; o envio segue como envio do Agilliza.
  if (!alvo?.simulacao_banco_id) return { propostaAssinante: null };

  const r = await comConta(userId, alvo.tenant_id, (tx) =>
    tx.uma<{ r: { proposta_id: string; codigo: string } }>(
      "select plataforma.proposta_do_assinante_no_envio($1, $2, $3, $4) as r",
      [alvo!.simulacao_id, alvo!.simulacao_banco_id, simulacaoId, userId],
    ),
  );
  const propostaId = r?.r?.proposta_id ?? null;
  if (propostaId) {
    // Já é do analista que envia: não fica "pendente" na fila dos assinantes.
    await comPlataforma(userId, async (tx) => {
      await tx.consultar("savepoint assumir");
      try {
        await tx.consultar("select plataforma.assumir_proposta($1)", [propostaId]);
        await tx.consultar("release savepoint assumir");
      } catch {
        await tx.consultar("rollback to savepoint assumir"); // já assumida: segue
      }
    });
  }
  return { propostaAssinante: propostaId };
}
