/**
 * Chaves dos provedores (integração bancária, Serasa, Asaas, Boa Vista, APIFull, e-mail),
 * guardadas cifradas no banco pelas funções do Corretor (`plataforma.credencial_*`, 0057).
 *
 * Nenhuma função devolve o valor de uma chave: a tela recebe só as dicas (os últimos
 * caracteres). Guardar e trocar exigem a permissão máxima da plataforma (ponte → super_admin
 * para `saas.provedores`) e a chave-mestra, usada só dentro da transação.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import {
  CATALOGO,
  campoExigido,
  faltaNoGrupo,
  type ProvedorConhecido,
} from "./provedores-catalogo";

export interface CredencialGuardada {
  provedor: string;
  ambiente: string;
  dicas: Record<string, string>;
  base_url: string | null;
  ativo: boolean;
  observacao: string | null;
  atualizado_em: string;
}

function ambiente(): "producao" | "homologacao" {
  return (process.env.PROVEDOR_AMBIENTE ?? "homologacao") === "producao"
    ? "producao"
    : "homologacao";
}

const PROVEDOR = z.enum(Object.keys(CATALOGO) as [ProvedorConhecido, ...ProvedorConhecido[]], {
  errorMap: () => ({ message: "Provedor desconhecido." }),
});

export const listarCredenciais = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.provedores", "view"])])
  .handler(async ({ context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const guardadas = await comPlataforma(context.userId, (tx) =>
      tx.consultar<CredencialGuardada>(
        `select provedor, ambiente, dicas, base_url, ativo, observacao, atualizado_em::text as atualizado_em
           from plataforma.credenciais_listar() where ambiente = $1`,
        [ambiente()],
      ),
    );
    return { ambiente: ambiente(), guardadas };
  });

export const guardarCredencial = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.provedores", "edit"])])
  .validator((d: unknown) =>
    z
      .object({
        provedor: PROVEDOR,
        campos: z.record(z.string(), z.string().max(2000)),
        baseUrl: z.string().trim().max(300).default(""),
        observacao: z.string().trim().max(300).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Mesmas conferências da Gestão: campo obrigatório vazio e formato errado param aqui,
    // com a mensagem dizendo qual campo corrigir.
    const limpo: Record<string, string> = {};
    const info = CATALOGO[data.provedor];
    for (const c of info.campos) {
      const v = (data.campos[c.chave] ?? "").trim();
      if (!v) {
        if (campoExigido(c)) throw new Error(`Preencha ${c.rotulo}.`);
        continue;
      }
      if (c.formato && !c.formato.regex.test(v)) throw new Error(c.formato.mensagem);
      limpo[c.chave] = v;
    }
    // Provedor de mais de um serviço (e-mail: SendPulse ou Resend): basta um, mas completo.
    const falta = faltaNoGrupo(info, (k) => Boolean(limpo[k]));
    if (falta) throw new Error(falta);
    if (data.baseUrl && !/^https:\/\/[\w.-]+(:\d+)?(\/\S*)?$/.test(data.baseUrl)) {
      throw new Error("A URL base precisa começar com https://.");
    }
    const { comPlataforma } = await import("./ponte.server");
    await comPlataforma(
      context.userId,
      (tx) =>
        tx.consultar("select plataforma.credencial_guardar($1, $2, $3::jsonb, $4, $5)", [
          data.provedor,
          ambiente(),
          JSON.stringify(limpo),
          data.baseUrl || null,
          data.observacao || null,
        ]),
      { kek: true },
    );
    return { ok: true as const };
  });

export const alternarCredencial = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.provedores", "edit"])])
  .validator((d: unknown) => z.object({ provedor: PROVEDOR, ativo: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select plataforma.credencial_ativar($1, $2, $3)", [
        data.provedor,
        ambiente(),
        data.ativo,
      ]),
    );
    return { ok: true as const };
  });

export const apagarCredencial = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.provedores", "edit"])])
  .validator((d: unknown) => z.object({ provedor: PROVEDOR }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select plataforma.credencial_apagar($1, $2)", [data.provedor, ambiente()]),
    );
    return { ok: true as const };
  });
