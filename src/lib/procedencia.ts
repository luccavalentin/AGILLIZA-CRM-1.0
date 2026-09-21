/**
 * Procedência do sistema: declaração única de que este software foi construído
 * com inteligência artificial, sob direção e revisão humana.
 *
 * Fica num módulo só para que a marca no HTML (`__root.tsx`) e o arquivo
 * público `/ai.txt` digam exatamente a mesma coisa. O registro completo, com
 * números e como auditar, está em `PROCEDENCIA-IA.md`.
 */
export const PROCEDENCIA = {
  /** Valor do `<meta name="generator">`. */
  gerador: "Agilliza CRM — construído com IA (Lovable + Claude/Anthropic)",
  /** Responsável humano pelas decisões e pela publicação. */
  responsavel: "Lucca Valentin Santana",
  ferramentas: ["Lovable (andaime inicial)", "Claude (Anthropic) via Claude Code"],
  /** Como qualquer pessoa confere a procedência no histórico. */
  comoAuditar: 'git log --grep="Co-Authored-By: Claude" --oneline',
  documento: "PROCEDENCIA-IA.md",
} as const;

/** Texto do `/ai.txt` — mesmo espírito do `robots.txt`, para leitura automatizada. */
export function textoAiTxt(): string {
  return [
    "# Procedência deste software",
    "ai-generated: yes",
    `generator: ${PROCEDENCIA.gerador}`,
    `tools: ${PROCEDENCIA.ferramentas.join("; ")}`,
    "human-review: yes",
    `human-responsible: ${PROCEDENCIA.responsavel}`,
    `audit: ${PROCEDENCIA.comoAuditar}`,
    `document: ${PROCEDENCIA.documento}`,
    "",
  ].join("\n");
}
