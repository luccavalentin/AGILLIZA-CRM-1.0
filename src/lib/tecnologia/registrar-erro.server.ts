/**
 * Registro de erros do SERVIDOR do Agilliza na Gestão de Tecnologia — SÓ SERVIDOR.
 *
 * Chamado de `src/server.ts` (falha de renderização/handler) depois do `console.error` de
 * sempre: o comportamento atual não muda, só ganha a cópia resumida (sem dado pessoal) no
 * banco. Freio próprio do processo: o mesmo erro 1× a cada 5 min, no máximo 60 por hora.
 */
import { criarFreio, linhaDaPilha, limparTexto, rotaSemDado, perfilDaRota } from "./erros-cliente";

const freio = criarFreio({ tetoPorHora: 60, semAmostraAte: 30, amostra: 0.25 });

export function registrarErroDoServidor(erro: unknown, url?: string): void {
  try {
    const e = erro as { name?: unknown; message?: unknown; stack?: unknown } | null;
    const bruto =
      e && typeof e === "object" && "message" in e ? String(e.message ?? "") : String(erro ?? "");
    const mensagem = limparTexto(bruto);
    if (!mensagem) return;
    const tipo =
      typeof e?.name === "string" && /^[A-Za-z][A-Za-z0-9_.$]{0,59}$/.test(e.name) ? e.name : null;
    const pilha = linhaDaPilha(typeof e?.stack === "string" ? e.stack : "");
    if (!freio(`${tipo}|${mensagem}|${pilha}`)) return;
    let rota = "/";
    try {
      rota = rotaSemDado(url ? new URL(url).pathname : "/");
    } catch {
      /* URL estranha: fica a raiz */
    }
    void import("@/lib/plataforma/ponte.server")
      .then((m) =>
        m.registrarErroNaPlataforma({
          mensagem,
          pilha,
          tipo,
          rota,
          versao: process.env.AGILLIZA_VERSAO ?? null,
          origem: "servidor",
          perfil: perfilDaRota(rota),
        }),
      )
      .catch(() => {});
  } catch {
    // Nunca um segundo erro em cima do primeiro.
  }
}
