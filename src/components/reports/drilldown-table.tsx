import { useMemo, useState } from "react";
import { ArrowUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReportColumn, ReportRow } from "@/lib/relatorios/shared";
import { formatCell, footerValue } from "@/lib/relatorios/report-format";
import { BancoLogo } from "@/components/bancos/banco-logo";

const PAGE = 25;

/** Indica se a coluna representa um banco (para exibir o logo ao lado do nome). */
function ehColunaBanco(c: ReportColumn): boolean {
  const key = c.key.toLowerCase();
  return (
    key === "nome_banco" ||
    key === "banco" ||
    key.endsWith("_banco") ||
    c.label.trim().toLowerCase() === "banco"
  );
}


/** Tabela detalhada com busca, ordenação, paginação e rodapé de totais. */
export function DrilldownTable({ columns, rows }: { columns: ReportColumn[]; rows: ReportRow[] }) {
  const [busca, setBusca] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [asc, setAsc] = useState(true);
  const [pagina, setPagina] = useState(1);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let out = rows;
    if (q)
      out = rows.filter((r) =>
        columns.some((c) =>
          String(r[c.key] ?? "")
            .toLowerCase()
            .includes(q),
        ),
      );
    if (sortKey) {
      out = [...out].sort((a, b) => {
        const va = a[sortKey],
          vb = b[sortKey];
        const na = Number(va),
          nb = Number(vb);
        const cmp =
          Number.isFinite(na) && Number.isFinite(nb)
            ? na - nb
            : String(va ?? "").localeCompare(String(vb ?? ""));
        return asc ? cmp : -cmp;
      });
    }
    return out;
  }, [rows, columns, busca, sortKey, asc]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE));
  const pag = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice((pag - 1) * PAGE, pag * PAGE);

  const alinha = (c: ReportColumn) =>
    c.align === "right" || c.format === "brl" || c.format === "int" || c.format === "pct"
      ? "text-right"
      : c.align === "center"
        ? "text-center"
        : "text-left";

  function ordenar(key: string) {
    if (sortKey === key) setAsc(!asc);
    else {
      setSortKey(key);
      setAsc(true);
    }
  }

  return (
    <div className="space-y-3">
      <div className="print:hidden relative max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPagina(1);
          }}
          placeholder="Buscar no detalhamento…"
          className="pl-8"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted/60">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                    alinha(c),
                  )}
                >
                  <button
                    type="button"
                    onClick={() => ordenar(c.key)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {c.label}
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  Nenhum registro.
                </td>
              </tr>
            ) : (
              visiveis.map((r, i) => (
                <tr key={i} className={cn("border-t border-border", i % 2 === 1 && "bg-muted/25")}>
                  {columns.map((c) => {
                    const banco = ehColunaBanco(c);
                    const valor = r[c.key];
                    return (
                      <td
                        key={c.key}
                        className={cn(
                          "whitespace-nowrap px-3 py-2 text-foreground",
                          alinha(c),
                          (c.format === "brl" || c.format === "int" || c.format === "pct") &&
                            "font-mono tabular-nums",
                        )}
                      >
                        {banco && valor ? (
                          <span className="inline-flex items-center gap-2">
                            <BancoLogo nome={String(valor)} size="xs" />
                            {formatCell(valor, c.format)}
                          </span>
                        ) : (
                          formatCell(valor, c.format)
                        )}
                      </td>
                    );
                  })}

                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/60 font-semibold">
              {columns.map((c, i) => (
                <td
                  key={c.key}
                  className={cn(
                    "whitespace-nowrap px-3 py-2 text-foreground",
                    alinha(c),
                    (c.format === "brl" || c.format === "int" || c.format === "pct") &&
                      "font-mono tabular-nums",
                  )}
                >
                  {i === 0 ? (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Totais
                    </span>
                  ) : (
                    footerValue(filtradas, c)
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="print:hidden flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular-nums">{filtradas.length} registros</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pag <= 1}
              onClick={() => setPagina(pag - 1)}
            >
              Anterior
            </Button>
            <span className="tabular-nums">
              {pag}/{totalPaginas}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pag >= totalPaginas}
              onClick={() => setPagina(pag + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
