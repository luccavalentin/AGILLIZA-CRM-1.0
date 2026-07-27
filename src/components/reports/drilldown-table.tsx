import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
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

/** Indica se a coluna representa uma fase/status/origem — renderizada como pílula. */
function ehColunaPilula(c: ReportColumn): "fase" | "origem" | null {
  const key = c.key.toLowerCase();
  const label = c.label.trim().toLowerCase();
  if (key === "status" || key === "fase" || label === "fase" || label === "status") return "fase";
  if (key === "origem" || label === "origem") return "origem";
  return null;
}

/** Mapa de tons por rótulo de fase/origem — cores editoriais consistentes. */
function tomPilula(tipo: "fase" | "origem", texto: string): string {
  const t = texto.toLowerCase();
  if (tipo === "origem") {
    if (t.includes("simula")) return "bg-primary/8 text-primary ring-primary/20";
    if (t.includes("contrato")) return "bg-success/10 text-success ring-success/25";
    if (t.includes("proposta")) return "bg-warning/10 text-warning ring-warning/25";
  }
  // fase / status
  if (t.includes("recus") || t.includes("cancel") || t.includes("desist"))
    return "bg-destructive/8 text-destructive ring-destructive/20";
  if (t.includes("aprov") || t.includes("emitid") || t.includes("registrad") || t.includes("contrata"))
    return "bg-success/10 text-success ring-success/25";
  if (t.includes("análise") || t.includes("analise") || t.includes("aguard") || t.includes("engenh") || t.includes("juríd") || t.includes("juridic") || t.includes("document"))
    return "bg-warning/10 text-warning ring-warning/25";
  if (t.includes("envi")) return "bg-primary/8 text-primary ring-primary/20";
  if (t.includes("simul") || t.includes("rascunh")) return "bg-muted text-muted-foreground ring-border";
  return "bg-muted text-muted-foreground ring-border";
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

  const numerico = (c: ReportColumn) =>
    c.format === "brl" || c.format === "int" || c.format === "pct";

  function ordenar(key: string) {
    if (sortKey === key) setAsc(!asc);
    else {
      setSortKey(key);
      setAsc(true);
    }
  }

  return (
    <div className="space-y-3">
      {/* Busca — pílula refinada com foco em anel */}
      <div className="print:hidden relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPagina(1);
          }}
          placeholder="Buscar no detalhamento…"
          className="h-9 rounded-full border-border/70 bg-card pl-9 shadow-[var(--shadow-card)] transition-all focus-visible:ring-2 focus-visible:ring-primary/25"
        />
      </div>

      {/* Tabela — moldura elegante com sombra suave */}
      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gradient-to-b from-muted/70 to-muted/40 backdrop-blur">
            <tr className="border-b border-border/70">
              {columns.map((c) => {
                const ativo = sortKey === c.key;
                return (
                  <th
                    key={c.key}
                    className={cn(
                      "whitespace-nowrap px-3.5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
                      alinha(c),
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => ordenar(c.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 transition-colors hover:text-foreground",
                        ativo && "text-primary",
                        alinha(c) === "text-right" && "flex-row-reverse",
                      )}
                    >
                      <span>{c.label}</span>
                      {ativo ? (
                        asc ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-12 text-center text-sm text-muted-foreground"
                >
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              visiveis.map((r, i) => (
                <tr
                  key={i}
                  className={cn(
                    "border-t border-border/50 transition-colors hover:bg-primary/[0.04]",
                    i % 2 === 1 && "bg-muted/20",
                  )}
                >
                  {columns.map((c) => {
                    const banco = ehColunaBanco(c);
                    const pilula = ehColunaPilula(c);
                    const valor = r[c.key];
                    const textoValor = formatCell(valor, c.format);
                    return (
                      <td
                        key={c.key}
                        className={cn(
                          "whitespace-nowrap px-3.5 py-2.5 text-foreground/90",
                          alinha(c),
                          numerico(c) && "font-mono font-medium tabular-nums text-foreground",
                        )}
                      >
                        {banco && valor ? (
                          <span className="inline-flex items-center gap-2">
                            <BancoLogo nome={String(valor)} size="xs" />
                            <span className="font-medium">{textoValor}</span>
                          </span>
                        ) : pilula && valor ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                              tomPilula(pilula, String(valor)),
                            )}
                          >
                            {textoValor}
                          </span>
                        ) : (
                          textoValor
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border/70 bg-gradient-to-b from-muted/50 to-muted/70 font-semibold">
              {columns.map((c, i) => (
                <td
                  key={c.key}
                  className={cn(
                    "whitespace-nowrap px-3.5 py-2.5 text-foreground",
                    alinha(c),
                    numerico(c) && "font-mono tabular-nums",
                  )}
                >
                  {i === 0 ? (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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

      {/* Paginação — refinada, com contagem tipográfica */}
      {(totalPaginas > 1 || filtradas.length > 0) && (
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-primary/60" />
            <span className="tabular-nums">
              {filtradas.length.toLocaleString("pt-BR")} registros
              {busca && ` · filtrado de ${rows.length.toLocaleString("pt-BR")}`}
            </span>
          </span>
          {totalPaginas > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pag <= 1}
                onClick={() => setPagina(pag - 1)}
                className="h-8 rounded-full px-3"
              >
                Anterior
              </Button>
              <span className="min-w-[3.5rem] text-center font-mono tabular-nums text-foreground">
                {pag} / {totalPaginas}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pag >= totalPaginas}
                onClick={() => setPagina(pag + 1)}
                className="h-8 rounded-full px-3"
              >
                Próxima
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
