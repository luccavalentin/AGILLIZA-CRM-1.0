import { execFileSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

function ferramenta(nome) {
  return process.env.JAVA_HOME
    ? join(process.env.JAVA_HOME, "bin", `${nome}${process.platform === "win32" ? ".exe" : ""}`)
    : nome;
}

function java(nome, argumentos) {
  return execFileSync(ferramenta(nome), argumentos, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
    maxBuffer: 16 * 1024 * 1024,
  });
}

/** Verifica a assinatura de upload; não substitui bundletool, testes ou a análise da loja. */
export function verificarAab(caminho, certificadoEsperado) {
  const arquivo = resolve(caminho);
  if (!arquivo.toLowerCase().endsWith(".aab") || !existsSync(arquivo)) {
    throw new Error("Informe um arquivo .aab existente.");
  }
  const entradas = java("jar", ["tf", arquivo]).split(/\r?\n/);
  if (
    !entradas.includes("BundleConfig.pb") ||
    !entradas.includes("base/manifest/AndroidManifest.xml")
  ) {
    throw new Error("O arquivo não tem a estrutura básica de um Android App Bundle.");
  }
  if (!entradas.some((nome) => /^META-INF\/[^/]+\.(RSA|DSA|EC)$/i.test(nome))) {
    throw new Error(
      "AAB não assinado: o Gradle pode terminar com sucesso sem gerar uma assinatura.",
    );
  }
  const idioma = ["-J-Duser.language=en", "-J-Duser.country=US"];
  const verificacao = java("jarsigner", [...idioma, "-verify", arquivo]);
  // jarsigner pode retornar código zero para arquivo sem assinatura ou parcialmente assinado.
  if (
    !/jar verified\./i.test(verificacao) ||
    /unsigned entries|jar is unsigned/i.test(verificacao)
  ) {
    throw new Error("A assinatura não cobre integralmente o AAB.");
  }
  const certificado = java("keytool", [...idioma, "-printcert", "-rfc", "-jarfile", arquivo]);
  const pem = certificado.match(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/,
  )?.[0];
  if (!pem) throw new Error("Não foi possível identificar o certificado de upload.");
  const sha256 = new X509Certificate(pem).fingerprint256;
  if (certificadoEsperado) {
    const normalizar = (valor) => valor.replace(/:/g, "").trim().toUpperCase();
    if (!/^[A-F0-9]{64}$/.test(normalizar(certificadoEsperado))) {
      throw new Error("A impressão SHA-256 esperada deve conter 64 dígitos hexadecimais.");
    }
    if (normalizar(sha256) !== normalizar(certificadoEsperado)) {
      throw new Error("O certificado do AAB difere do certificado de upload esperado.");
    }
  }
  return { arquivo, assinaturaVerificada: true, certificadoUploadSha256: sha256 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [arquivo, certificado] = process.argv.slice(2);
    if (!arquivo)
      throw new Error(
        "Uso: node scripts/verificar-aab.mjs arquivo.aab [SHA256-do-certificado-de-upload]",
      );
    console.log(JSON.stringify(verificarAab(arquivo, certificado), null, 2));
  } catch (erro) {
    // Não imprimir stderr de ferramentas de assinatura: a mensagem do verificador basta.
    console.error(
      `Pacote rejeitado: ${erro instanceof Error ? erro.message.split("\n")[0] : "falha na verificação"}`,
    );
    process.exitCode = 1;
  }
}
