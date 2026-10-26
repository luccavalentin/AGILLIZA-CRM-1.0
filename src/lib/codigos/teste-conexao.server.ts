/**
 * Liga o "Testar conexão" às peças de verdade (IMAP, DNS, banco). SÓ SERVIDOR.
 * A regra está em `teste-conexao.ts`.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ImapFlow } from "imapflow";
import { decifrarSenha } from "./cripto.server";
import { hostPermitido } from "./rede.server";
import { executarTeste, type CaixaParaTeste, type ResultadoTeste } from "./teste-conexao";

export async function testarCaixa(db: SupabaseClient, id: string): Promise<ResultadoTeste> {
  const { data, error } = await db
    .from("codigos_caixas")
    .select(
      "id, email, usuario, imap_host, imap_port, imap_ssl, pasta, senha_cifrada, status, espera_ate, teste_em",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error("Caixa não encontrada.");
  const linha = data as CaixaParaTeste & { senha_cifrada: string };
  const caixa: CaixaParaTeste = { ...linha, tem_senha: Boolean(linha.senha_cifrada) };
  const leitor = `teste:${randomUUID().slice(0, 8)}`;

  const r = await executarTeste(caixa, {
    agora: () => Date.now(),
    hostPermitido,
    assumir: async () => {
      const { data: ok } = await db.rpc("codigos_assumir_caixa", {
        p_caixa: id,
        p_leitor: leitor,
        p_segundos: 30,
      });
      return ok === true;
    },
    soltar: async () => {
      await db.rpc("codigos_soltar_caixa", { p_caixa: id, p_leitor: leitor });
    },
    conectar: async () => {
      const cliente = new ImapFlow({
        host: caixa.imap_host,
        port: caixa.imap_port,
        secure: caixa.imap_ssl,
        auth: { user: caixa.usuario || caixa.email, pass: decifrarSenha(linha.senha_cifrada) },
        logger: false,
        emitLogs: false,
        socketTimeout: 15_000,
        greetingTimeout: 10_000,
        connectionTimeout: 10_000,
      });
      cliente.on("error", () => {});
      try {
        await cliente.connect();
        const st = await cliente.status(caixa.pasta, { messages: true });
        return { mensagens: typeof st.messages === "number" ? st.messages : null };
      } finally {
        await cliente.logout().catch(() => cliente.close());
      }
    },
  });

  if (r.tentou) {
    await db
      .from("codigos_caixas")
      .update({ teste_em: new Date().toISOString(), teste_ok: r.ok, teste_msg: r.mensagem.slice(0, 300) })
      .eq("id", id);
  }
  return r;
}
