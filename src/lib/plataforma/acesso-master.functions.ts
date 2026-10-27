/**
 * Acesso master (0581 do Agilliza Tech, pedido do dono de 26/10/2026): um login só —
 * adm@agilliza.net.br, senha = o e-mail — que abre todos os portais. No Agilliza Tech o
 * master tem identidades PRÓPRIAS (contas de demonstração de corretor, imobiliária e
 * parceiro, um cliente e um consumidor do ImobMatch); nunca entra em conta de assinante.
 *
 * Daqui, cada botão pede ao banco uma entrada de uso único (2 minutos) e abre o portal já
 * logado. Só o próprio login master emite (o banco confere); preparar é de administrador.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

export type PortalMaster = "corretor" | "imobiliaria" | "parceiro" | "cliente" | "imobmatch";

async function ponte() {
  return import("./ponte.server");
}

const url = (v: string | undefined, padrao: string) => (v || padrao).trim().replace(/\/+$/, "");

/** Argon2id com os parâmetros do Agilliza Tech (o login de lá confere este hash). */
async function hashArgon2id(senha: string): Promise<string> {
  const { argon2id } = await import("hash-wasm");
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return argon2id({
    password: senha,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: "encoded",
  });
}

/** Abre um portal do master: devolve o endereço com a entrada de uso único. */
export const abrirPortalMaster = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.tecnologia", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({ portal: z.enum(["corretor", "imobiliaria", "parceiro", "cliente", "imobmatch"]) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ t: string }>("select plataforma.emitir_entrada_master($1) as t", [data.portal]),
    );
    if (!r?.t) throw new Error("Não foi possível abrir o portal agora.");
    const base =
      data.portal === "imobmatch"
        ? url(process.env.IMOBMATCH_URL_PUBLICA, "https://imobmatch.agillizatech.com.br")
        : url(process.env.CORRETOR_URL_PUBLICA, "https://agillizatech.com.br");
    return { url: `${base}/entrar/master?t=${encodeURIComponent(r.t)}` };
  });

/**
 * Prepara (ou refaz a senha de) o acesso master: o login master do Agilliza ganha as
 * identidades no Agilliza Tech, com a senha = o próprio e-mail (decisão do dono, sem troca
 * obrigatória). Só administrador; o master é quem chama.
 */
export const prepararAcessoMaster = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.tecnologia", "edit"])])
  .handler(async ({ context }) => {
    const email = String((context.claims as { email?: string } | undefined)?.email ?? "")
      .trim()
      .toLowerCase();
    if (!email) throw new Error("O seu login não tem e-mail.");
    const hash = await hashArgon2id(email);
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ r: { criado: boolean } }>("select plataforma.preparar_acesso_master($1, $2) as r", [
        email,
        hash,
      ]),
    );
    return { criado: r?.r.criado ?? false };
  });
