import * as XLSX from "xlsx-js-style";
import type { BackupCompleto } from "@/lib/admin/backup.functions";

/**
 * Exportação de backup em Excel profissional, formatado e colorido nos tons da
 * marca Agilliza — funciona como uma prévia do sistema em planilha.
 */

// Paleta institucional (RGB sem "#") — alinhada aos tokens do sistema.
const AZUL = "000F9F";
const AZUL_ESCURO = "000A70";
const CORAL = "F5333F";
const BRANCO = "FFFFFF";
const TINTA = "0B0B0F";
const CINZA = "6B7280";
const ZEBRA = "F4F6FB";
const CARTAO = "EEF0FF";
const LINHA = "D9DDF3";

type Estilo = NonNullable<XLSX.CellObject["s"]>;

const borda = (rgb = LINHA) => ({
  top: { style: "thin" as const, color: { rgb } },
  bottom: { style: "thin" as const, color: { rgb } },
  left: { style: "thin" as const, color: { rgb } },
  right: { style: "thin" as const, color: { rgb } },
});

function nomeAba(label: string, usados: Set<string>): string {
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

/** Aplica estilo a uma célula, criando-a caso não exista. */
function estilizar(ws: XLSX.WorkSheet, r: number, c: number, s: Estilo, valor?: unknown) {
  const ref = XLSX.utils.encode_cell({ r, c });
  if (!ws[ref]) {
    ws[ref] = { t: typeof valor === "number" ? "n" : "s", v: valor ?? "" } as XLSX.CellObject;
  }
  (ws[ref] as XLSX.CellObject).s = s;
}

/** Garante que a matriz de dimensões (!ref) cubra até (r,c). */
function expandirRef(ws: XLSX.WorkSheet, r: number, c: number) {
  const atual = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
  atual.e.r = Math.max(atual.e.r, r);
  atual.e.c = Math.max(atual.e.c, c);
  ws["!ref"] = XLSX.utils.encode_range(atual);
}

/** Desenha o cabeçalho de marca (faixa azul + faixa coral + subtítulo) em uma aba. */
function cabecalhoMarca(
  ws: XLSX.WorkSheet,
  colunas: number,
  titulo: string,
  subtitulo: string,
): number {
  const ultimaCol = Math.max(colunas - 1, 1);
  ws["!merges"] = ws["!merges"] ?? [];
  ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: ultimaCol } });
  ws["!merges"].push({ s: { r: 1, c: 0 }, e: { r: 1, c: ultimaCol } });
  ws["!merges"].push({ s: { r: 2, c: 0 }, e: { r: 2, c: ultimaCol } });

  expandirRef(ws, 3, ultimaCol);

  // Faixa azul com o título
  estilizar(
    ws,
    0,
    0,
    {
      font: { bold: true, sz: 18, color: { rgb: BRANCO }, name: "Calibri" },
      fill: { patternType: "solid", fgColor: { rgb: AZUL } },
      alignment: { horizontal: "left", vertical: "center", indent: 1 },
    },
    titulo,
  );
  for (let c = 1; c <= ultimaCol; c++) {
    estilizar(ws, 0, c, {
      fill: { patternType: "solid", fgColor: { rgb: AZUL } },
    });
  }
  // Faixa coral fina
  for (let c = 0; c <= ultimaCol; c++) {
    estilizar(ws, 1, c, { fill: { patternType: "solid", fgColor: { rgb: CORAL } } });
  }
  // Subtítulo
  estilizar(
    ws,
    2,
    0,
    {
      font: { bold: false, sz: 10, color: { rgb: CINZA }, name: "Calibri" },
      fill: { patternType: "solid", fgColor: { rgb: BRANCO } },
      alignment: { horizontal: "left", vertical: "center", indent: 1 },
    },
    subtitulo,
  );
  ws["!rows"] = ws["!rows"] ?? [];
  ws["!rows"][0] = { hpt: 30 };
  ws["!rows"][1] = { hpt: 4 };
  ws["!rows"][2] = { hpt: 18 };
  ws["!rows"][3] = { hpt: 6 };
  return 4; // primeira linha livre após o cabeçalho
}

/** Gera e baixa um Excel completo, formatado e colorido, com uma aba por tabela. */
export function exportarBackupXLSX(dados: BackupCompleto) {
  const wb = XLSX.utils.book_new();
  const usados = new Set<string>();
  const dataStr = new Date(dados.geradoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  // ---------------------------------------------------------------- Resumo
  const wsResumo: XLSX.WorkSheet = {};
  wsResumo["!ref"] = "A1:B1";
  wsResumo["!cols"] = [{ wch: 42 }, { wch: 18 }];
  let r = cabecalhoMarca(wsResumo, 2, "Backup Completo do Sistema", `Agilliza · Gerado em ${dataStr}`);

  // Cabeçalho da tabela de resumo
  const cabResumo = ["Módulo", "Registros"];
  cabResumo.forEach((t, c) => {
    estilizar(
      wsResumo,
      r,
      c,
      {
        font: { bold: true, sz: 11, color: { rgb: BRANCO } },
        fill: { patternType: "solid", fgColor: { rgb: AZUL_ESCURO } },
        alignment: { horizontal: c === 0 ? "left" : "center", vertical: "center", indent: c === 0 ? 1 : 0 },
        border: borda(AZUL_ESCURO),
      },
      t,
    );
  });
  r++;

  dados.tabelas.forEach((t, idx) => {
    const zebra = idx % 2 === 1;
    estilizar(
      wsResumo,
      r,
      0,
      {
        font: { sz: 10, color: { rgb: TINTA } },
        fill: { patternType: "solid", fgColor: { rgb: zebra ? ZEBRA : BRANCO } },
        alignment: { horizontal: "left", vertical: "center", indent: 1 },
        border: borda(),
      },
      t.label,
    );
    estilizar(
      wsResumo,
      r,
      1,
      {
        font: { sz: 10, bold: true, color: { rgb: AZUL } },
        fill: { patternType: "solid", fgColor: { rgb: zebra ? ZEBRA : BRANCO } },
        alignment: { horizontal: "center", vertical: "center" },
        border: borda(),
      },
      t.linhas.length,
    );
    r++;
  });

  // Linha de total
  const total = dados.tabelas.reduce((a, t) => a + t.linhas.length, 0);
  estilizar(
    wsResumo,
    r,
    0,
    {
      font: { bold: true, sz: 11, color: { rgb: AZUL_ESCURO } },
      fill: { patternType: "solid", fgColor: { rgb: CARTAO } },
      alignment: { horizontal: "left", vertical: "center", indent: 1 },
      border: borda(),
    },
    "TOTAL",
  );
  estilizar(
    wsResumo,
    r,
    1,
    {
      font: { bold: true, sz: 12, color: { rgb: CORAL } },
      fill: { patternType: "solid", fgColor: { rgb: CARTAO } },
      alignment: { horizontal: "center", vertical: "center" },
      border: borda(),
    },
    total,
  );
  expandirRef(wsResumo, r, 1);
  wsResumo["!freeze"] = { xSplit: 0, ySplit: r === 0 ? 5 : 5 } as never;
  XLSX.utils.book_append_sheet(wb, wsResumo, nomeAba("Resumo", usados));

  // ---------------------------------------------------- Uma aba por tabela
  for (const t of dados.tabelas) {
    const header = t.colunas;
    const ws: XLSX.WorkSheet = {};
    ws["!ref"] = "A1:A1";

    const ncols = Math.max(header.length, 1);
    let row = cabecalhoMarca(ws, ncols, t.label, `Agilliza · ${t.linhas.length} registro(s)`);
    const headerRow = row;

    if (!header.length) {
      estilizar(
        ws,
        row,
        0,
        {
          font: { italic: true, sz: 10, color: { rgb: CINZA } },
          alignment: { horizontal: "left", vertical: "center", indent: 1 },
        },
        "(sem registros)",
      );
      expandirRef(ws, row, 0);
      ws["!cols"] = [{ wch: 30 }];
      XLSX.utils.book_append_sheet(wb, ws, nomeAba(t.label, usados));
      continue;
    }

    // Cabeçalho das colunas
    header.forEach((c, ci) => {
      estilizar(
        ws,
        row,
        ci,
        {
          font: { bold: true, sz: 10, color: { rgb: BRANCO } },
          fill: { patternType: "solid", fgColor: { rgb: AZUL } },
          alignment: { horizontal: "left", vertical: "center", wrapText: false, indent: 1 },
          border: borda(AZUL),
        },
        c,
      );
    });
    row++;

    // Dados com zebra + bordas
    t.linhas.forEach((linha, li) => {
      const zebra = li % 2 === 1;
      header.forEach((c, ci) => {
        const v = linha[c] ?? "";
        estilizar(
          ws,
          row,
          ci,
          {
            font: { sz: 9.5, color: { rgb: TINTA } },
            fill: { patternType: "solid", fgColor: { rgb: zebra ? ZEBRA : BRANCO } },
            alignment: { horizontal: typeof v === "number" ? "right" : "left", vertical: "center", indent: 1 },
            border: borda(),
          },
          v,
        );
      });
      row++;
    });

    expandirRef(ws, row - 1, ncols - 1);

    // Largura das colunas adaptativa
    ws["!cols"] = header.map((c) => {
      const maxDado = t.linhas.reduce((m, l) => {
        const s = String(l[c] ?? "");
        return Math.max(m, s.length);
      }, c.length);
      return { wch: Math.min(Math.max(maxDado + 2, 12), 48) };
    });

    // Filtro + congelar cabeçalho (marca + colunas)
    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: headerRow, c: 0 },
        e: { r: Math.max(row - 1, headerRow), c: header.length - 1 },
      }),
    };
    ws["!freeze"] = { xSplit: 0, ySplit: headerRow + 1 } as never;

    XLSX.utils.book_append_sheet(wb, ws, nomeAba(t.label, usados));
  }

  const stamp = new Date(dados.geradoEm).toISOString().slice(0, 10);
  XLSX.writeFile(wb, `backup-agilliza-${stamp}.xlsx`);
}
