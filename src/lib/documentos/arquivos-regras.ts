/**
 * Regras puras do gerenciador de Arquivos (sem rede, testáveis). O banco confere tudo de
 * novo (migração 20261027040040): aqui é só para a tela responder antes e montar nomes.
 */

/** Mesmas regras do gatilho `arquivos_nome_unico`: até 300 caracteres, sem barras. */
export function validarNome(nome: string): string | null {
  const n = nome.trim();
  if (!n) return "Informe um nome.";
  if (n.length > 300) return "Use no máximo 300 caracteres.";
  if (/[/\\]/.test(n)) return "O nome não pode ter barras.";
  return null;
}

/** Separa "relatorio.final.pdf" em ["relatorio.final", ".pdf"] (sem extensão: ["nome", ""]). */
export function separarExtensao(nome: string): [string, string] {
  const i = nome.lastIndexOf(".");
  if (i <= 0 || i === nome.length - 1) return [nome, ""];
  return [nome.slice(0, i), nome.slice(i)];
}

/**
 * Nome livre para "manter os dois": "contrato.pdf" → "contrato (2).pdf", "(3)"… — sem
 * diferenciar maiúsculas, como o banco.
 */
export function nomeLivre(nome: string, existentes: Iterable<string>): string {
  const ocupados = new Set(Array.from(existentes, (e) => e.trim().toLowerCase()));
  if (!ocupados.has(nome.trim().toLowerCase())) return nome;
  const [base, ext] = separarExtensao(nome.trim());
  for (let i = 2; i < 10_000; i++) {
    const candidato = `${base} (${i})${ext}`;
    if (!ocupados.has(candidato.toLowerCase())) return candidato;
  }
  return `${base} (${Date.now()})${ext}`;
}

/** Nome seguro para o caminho no bucket (o nome visível continua o original). */
export function nomeParaCaminho(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 100);
  return limpo || "arquivo";
}

/** Caminho do objeto: sempre dentro da pasta do correspondente (a política do bucket exige). */
export function caminhoNoBucket(correspondenteId: string, nome: string, id: string): string {
  return `${correspondenteId}/${id}-${nomeParaCaminho(nome)}`;
}

export type TipoPrevia = "imagem" | "pdf" | "outro";

const EXT_IMAGEM = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"]);

/** Que prévia a tela consegue mostrar. */
export function tipoDePrevia(nome: string, contentType?: string | null): TipoPrevia {
  const c = (contentType ?? "").toLowerCase();
  const ext = separarExtensao(nome)[1].slice(1).toLowerCase();
  if (c.startsWith("image/") || EXT_IMAGEM.has(ext)) return "imagem";
  if (c === "application/pdf" || ext === "pdf") return "pdf";
  return "outro";
}

/** Bytes em unidade legível (B, KB, MB, GB, TB). */
export function formatarBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return n === 0 ? "0 B" : "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0).replace(".", ",")} ${u[i]}`;
}

/** Situação da cota para a barra: percentual (0–100) e faixa de alerta. */
export function situacaoCota(usado: number, limite: number): {
  percentual: number;
  faixa: "ok" | "atencao" | "cheio";
} {
  if (!limite || limite <= 0) return { percentual: 0, faixa: "ok" };
  const p = Math.min(100, Math.max(0, (usado / limite) * 100));
  return { percentual: p, faixa: p >= 95 ? "cheio" : p >= 80 ? "atencao" : "ok" };
}

/** Etiquetas como o banco guarda: minúsculas, aparadas, até 30 caracteres, sem repetir, até 10. */
export function normalizarEtiquetas(lista: string[]): string[] {
  const s = new Set<string>();
  for (const e of lista) {
    const t = e.trim().toLowerCase().slice(0, 30);
    if (t) s.add(t);
  }
  return Array.from(s).sort().slice(0, 10);
}

/** Planos de envio quando há conflito de nome numa pasta. */
export type ResolucaoConflito = "versao" | "manter" | "pular";

/**
 * Decide nome e modo de cada arquivo do lote: conflito com o que já existe na pasta (ou com
 * outro do mesmo lote) segue a resolução escolhida.
 */
export function planejarEnvio(
  nomes: string[],
  existentes: string[],
  resolucao: ResolucaoConflito,
): { nome: string; novaVersao: boolean; pular: boolean }[] {
  const ocupados = new Set(existentes.map((e) => e.trim().toLowerCase()));
  return nomes.map((original) => {
    const conflito = ocupados.has(original.trim().toLowerCase());
    if (!conflito) {
      ocupados.add(original.trim().toLowerCase());
      return { nome: original, novaVersao: false, pular: false };
    }
    if (resolucao === "pular") return { nome: original, novaVersao: false, pular: true };
    if (resolucao === "versao") return { nome: original, novaVersao: true, pular: false };
    const novo = nomeLivre(original, ocupados);
    ocupados.add(novo.toLowerCase());
    return { nome: novo, novaVersao: false, pular: false };
  });
}
