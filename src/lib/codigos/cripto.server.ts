/**
 * Senha da caixa vigiada: cifrada no servidor (AES-256-GCM) antes de ir ao banco.
 * A chave sai da KEK do servidor por HKDF, com rótulo próprio — a mesma KEK nunca
 * cifra duas coisas diferentes com a mesma chave. SÓ SERVIDOR.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

function chave(): Buffer {
  const kek = process.env.CORRETOR_KEK;
  if (!kek) throw new Error("A chave de cifragem não está configurada neste servidor.");
  return Buffer.from(hkdfSync("sha256", kek, "agilliza", "codigos-de-acesso-v1", 32));
}

export function cifrarSenha(senha: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(senha, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), dados.toString("base64")].join(".");
}

export function decifrarSenha(cifrada: string): string {
  const [versao, iv, tag, dados] = cifrada.split(".");
  if (versao !== "v1" || !iv || !tag || !dados) throw new Error("Senha da caixa em formato desconhecido.");
  const d = createDecipheriv("aes-256-gcm", chave(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(dados, "base64")), d.final()]).toString("utf8");
}
