import {
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
} from "lucide-react";

/** Formata bytes em unidade legível (B, KB, MB, GB). */
export function formatBytes(n: number | null): string {
  if (!n) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

/** Normaliza um nome de arquivo para uso seguro em storage path. */
export function sanitizePath(nome: string): string {
  return nome.replace(/[^\w.\-]+/g, "_").slice(0, 100);
}

/** Ícone e tonalidade do bloco conforme o tipo de arquivo. */
export function estiloArquivo(
  content: string | null,
  nome: string,
): { Icon: typeof FileText; classe: string } {
  const c = (content ?? "").toLowerCase();
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  if (c.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext))
    return { Icon: FileImage, classe: "from-sky-500/20 to-sky-500/5 text-sky-600 dark:text-sky-400" };
  if (c === "application/pdf" || ext === "pdf")
    return { Icon: FileType, classe: "from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400" };
  if (["xls", "xlsx", "csv"].includes(ext) || c.includes("spreadsheet"))
    return {
      Icon: FileSpreadsheet,
      classe: "from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    };
  if (["zip", "rar", "7z"].includes(ext))
    return { Icon: FileArchive, classe: "from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400" };
  return { Icon: FileText, classe: "from-muted-foreground/20 to-muted-foreground/5 text-muted-foreground" };
}
