import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { verificarAab } from "./verificar-aab.mjs";

function java(nome, argumentos, cwd) {
  const executavel = process.env.JAVA_HOME
    ? join(process.env.JAVA_HOME, "bin", `${nome}${process.platform === "win32" ? ".exe" : ""}`)
    : nome;
  return execFileSync(executavel, argumentos, { cwd, stdio: "pipe", timeout: 60_000 });
}

test("assinatura de upload: aceita assinatura válida e rejeita pacotes incompletos", async (t) => {
  const temporarios = resolve(tmpdir());
  const pasta = mkdtempSync(join(temporarios, "agilliza-assinatura-teste-"));
  try {
    // Só exercita a assinatura JAR. Estes bytes não representam um app Android instalável.
    const conteudo = join(pasta, "conteudo");
    mkdirSync(join(conteudo, "base", "manifest"), { recursive: true });
    writeFileSync(join(conteudo, "BundleConfig.pb"), "fixture de assinatura");
    writeFileSync(join(conteudo, "base", "manifest", "AndroidManifest.xml"), "fixture");
    const semAssinatura = join(pasta, "sem-assinatura.aab");
    java("jar", ["cf", semAssinatura, "-C", conteudo, "."]);
    await t.test("rejeita o retorno zero do jarsigner para AAB sem assinatura", () => {
      java("jarsigner", ["-verify", semAssinatura]);
      assert.throws(() => verificarAab(semAssinatura), /não assinado/);
    });
    const assinado = join(pasta, "assinado.aab");
    copyFileSync(semAssinatura, assinado);
    const chave = join(pasta, "chave-exclusivamente-de-teste.jks");
    java("keytool", [
      "-genkeypair",
      "-alias",
      "teste",
      "-keystore",
      chave,
      "-storepass",
      "fixture123",
      "-keypass",
      "fixture123",
      "-keyalg",
      "RSA",
      "-keysize",
      "2048",
      "-validity",
      "2",
      "-dname",
      "CN=Fixture local de assinatura",
      "-noprompt",
    ]);
    java("jarsigner", ["-keystore", chave, "-storepass", "fixture123", assinado, "teste"]);
    let certificado;
    await t.test("aceita AAB integralmente assinado", () => {
      const resultado = verificarAab(assinado);
      assert.equal(resultado.assinaturaVerificada, true);
      certificado = resultado.certificadoUploadSha256;
      assert.match(certificado, /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/);
    });
    await t.test("confere o certificado de upload esperado", () => {
      assert.equal(verificarAab(assinado, certificado).assinaturaVerificada, true);
      assert.throws(() => verificarAab(assinado, "00".repeat(32)), /difere/);
    });
    await t.test("rejeita uma entrada adicionada depois da assinatura", () => {
      const parcial = join(pasta, "parcial.aab");
      copyFileSync(assinado, parcial);
      writeFileSync(join(conteudo, "adicionado.txt"), "não assinado");
      java("jar", ["uf", parcial, "-C", conteudo, "adicionado.txt"]);
      assert.throws(() => verificarAab(parcial), /não cobre integralmente/);
    });
    await t.test("rejeita alteração em conteúdo já assinado", () => {
      const adulterado = join(pasta, "adulterado.aab");
      copyFileSync(assinado, adulterado);
      writeFileSync(join(conteudo, "BundleConfig.pb"), "conteúdo alterado");
      java("jar", ["uf", adulterado, "-C", conteudo, "BundleConfig.pb"]);
      assert.throws(() => verificarAab(adulterado));
    });
  } finally {
    // Antes da remoção recursiva, limita o alvo à pasta temporária criada por este teste.
    if (
      dirname(resolve(pasta)) !== temporarios ||
      !pasta.startsWith(join(temporarios, "agilliza-assinatura-teste-"))
    ) {
      throw new Error("Destino temporário inesperado; limpeza recusada.");
    }
    rmSync(pasta, { recursive: true, force: true });
  }
});
