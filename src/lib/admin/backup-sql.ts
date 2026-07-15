// ============================================================================
// Backup em SQL — gera um arquivo .sql com comandos INSERT de todo o sistema.
// Diferente do Excel (para leigos), o SQL é técnico e preserva os códigos/IDs
// reais, servindo para restauração/migração do banco de dados.
// ============================================================================

import type { BackupCompleto } from "@/lib/admin/backup.functions";

type Valor = string | number | boolean | null;

/** Escapa um valor para literal SQL do PostgreSQL. */
function sqlLiteral(v: Valor): string {
  if (v === null || v === undefined || v === "") return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  // Aspas simples duplicadas para escapar.
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Monta o conteúdo .sql completo a partir do backup. */
export function gerarBackupSQL(dados: BackupCompleto): string {
  const dataStr = new Date(dados.geradoEm).toLocaleString("pt-BR");
  const partes: string[] = [];

  partes.push("-- ============================================================");
  partes.push("-- Backup completo do sistema Agilliza (SQL)");
  partes.push(`-- Gerado em: ${dataStr}`);
  partes.push("-- Formato: comandos INSERT do PostgreSQL");
  partes.push("-- ============================================================");
  partes.push("");
  partes.push("BEGIN;");
  partes.push("");

  for (const t of dados.tabelas) {
    partes.push(`-- ---------- ${t.label} (${t.linhas.length} registro(s)) ----------`);
    if (t.linhas.length === 0 || t.colunas.length === 0) {
      partes.push(`-- (sem registros)`);
      partes.push("");
      continue;
    }
    const cols = t.colunas.map((c) => `"${c}"`).join(", ");
    for (const linha of t.linhas) {
      const valores = t.colunas.map((c) => sqlLiteral(linha[c] ?? null)).join(", ");
      partes.push(
        `INSERT INTO public.${t.tabela} (${cols}) VALUES (${valores}) ON CONFLICT (id) DO NOTHING;`,
      );
    }
    partes.push("");
  }

  partes.push("COMMIT;");
  partes.push("");
  return partes.join("\n");
}

/** Gera e baixa o arquivo .sql no navegador. */
export function exportarBackupSQL(dados: BackupCompleto) {
  const conteudo = gerarBackupSQL(dados);
  const blob = new Blob([conteudo], { type: "application/sql;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date(dados.geradoEm).toISOString().slice(0, 10);
  a.href = url;
  a.download = `backup-agilliza-${stamp}.sql`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
