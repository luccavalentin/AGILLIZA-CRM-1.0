import * as XLSX from "xlsx";
import type { BackupCompleto } from "@/lib/admin/backup.functions";

function nomeAba(label: string, usados: Set<string>): string {
  // Excel: máx 31 chars, sem : \ / ? * [ ]
  let base = label.replace(/[:\\/?*[\]]/g, " ").slice(0, 31).trim() || "Dados";
  let nome = base;
  let i = 2;
  while (usados.has(nome.toLowerCase())) {
    const suffix = ` (${i})`;
    nome = base.slice(0, 31 - suffix.length) + suffix;
    i++;
  }
  usados.add(nome.toLowerCase());
  return nome;
}

/** Gera e baixa um Excel completo com todos os dados do sistema, uma aba por tabela. */
export function exportarBackupXLSX(dados: BackupCompleto) {
  const wb = XLSX.utils.book_new();
  const usados = new Set<string>();
  const dataStr = new Date(dados.geradoEm).toLocaleString("pt-BR");

  // Aba de resumo
  const resumoAoa: (string | number)[][] = [
    ["Backup Completo do Sistema — Agilliza"],
    [`Gerado em: ${dataStr}`],
    [],
    ["Módulo", "Registros"],
    ...dados.tabelas.map((t) => [t.label, t.linhas.length]),
    ["TOTAL", dados.tabelas.reduce((a, t) => a + t.linhas.length, 0)],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoAoa);
  wsResumo["!cols"] = [{ wch: 34 }, { wch: 14 }];
  wsResumo["!freeze"] = { xSplit: 0, ySplit: 4 } as never;
  XLSX.utils.book_append_sheet(wb, wsResumo, nomeAba("Resumo", usados));

  for (const t of dados.tabelas) {
    const header = t.colunas;
    const body = t.linhas.map((r) => header.map((c) => (r[c] ?? "") as string | number));
    const aoa: (string | number)[][] = header.length ? [header, ...body] : [["(sem registros)"]];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    if (header.length) {
      ws["!cols"] = header.map((c) => ({ wch: Math.min(Math.max(c.length + 2, 14), 40) }));
      // Filtros + congelar cabeçalho
      const ref = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: Math.max(body.length, 1), c: header.length - 1 },
      });
      ws["!autofilter"] = { ref };
      ws["!freeze"] = { xSplit: 0, ySplit: 1 } as never;
    }
    XLSX.utils.book_append_sheet(wb, ws, nomeAba(t.label, usados));
  }

  const stamp = new Date(dados.geradoEm).toISOString().slice(0, 10);
  XLSX.writeFile(wb, `backup-completo-agilliza-${stamp}.xlsx`);
}
