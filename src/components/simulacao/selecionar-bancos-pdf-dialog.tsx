import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/simulacao/format";

type Modo = "consolidado" | "detalhada";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  simulacao: any;
  bancos: any[];
  /** consolidado = 1 PDF comparativo; detalhada = 1 PDF por banco (com nome, renda etc.). */
  modo?: Modo;
}

/**
 * Escolha de bancos para gerar PDF.
 * - consolidado: gera 1 PDF comparativo com os bancos marcados.
 * - detalhada: gera 1 PDF individual por banco (nome do banco no arquivo,
 *   renda necessária, parcelas etc.). Cada linha também tem um botão para
 *   baixar apenas aquele banco.
 */
export function SelecionarBancosPdfDialog({
  open,
  onOpenChange,
  simulacao,
  bancos,
  modo = "consolidado",
}: Props) {
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({});
  const [gerando, setGerando] = useState(false);

  const bancosExibidos = useMemo(() => {
    const lista = bancos ?? [];
    if (modo !== "detalhada" || !simulacao?.id) return lista;
    const simIds = new Set(lista.map((b) => b?.simulacao_id).filter(Boolean));
    if (simIds.size <= 1 || !simIds.has(simulacao.id)) return lista;
    return lista.filter((b) => b?.simulacao_id === simulacao.id);
  }, [bancos, modo, simulacao?.id]);

  useEffect(() => {
    if (open) {
      const inicial: Record<string, boolean> = {};
      (bancosExibidos ?? []).forEach((b, i) => {
        // No modo detalhada começa desmarcado (usuário escolhe qual quer);
        // no consolidado começa com todos marcados.
        inicial[b.id ?? String(i)] = modo === "consolidado";
      });
      setSelecionados(inicial);
    }
  }, [open, bancosExibidos, modo]);

  const escolhidos = useMemo(
    () => (bancosExibidos ?? []).filter((b, i) => selecionados[b.id ?? String(i)]),
    [bancosExibidos, selecionados],
  );

  const todosMarcados = (bancosExibidos ?? []).length > 0 && escolhidos.length === (bancosExibidos ?? []).length;

  function alternarTodos() {
    const novo: Record<string, boolean> = {};
    (bancosExibidos ?? []).forEach((b, i) => {
      novo[b.id ?? String(i)] = !todosMarcados;
    });
    setSelecionados(novo);
  }

  async function baixarDetalhadaDeUm(banco: any) {
    const { baixarSimulacaoDetalhadaPDF } = await import("@/lib/simulacao/simulacao-pdf");
    baixarSimulacaoDetalhadaPDF({ simulacao, bancos: [banco] });
  }

  async function gerar() {
    setGerando(true);
    try {
      if (modo === "consolidado") {
        const { baixarSimulacaoPDF } = await import("@/lib/simulacao/simulacao-pdf");
        baixarSimulacaoPDF({ simulacao, bancos: escolhidos });
      } else {
        const { baixarSimulacaoDetalhadaPDF } = await import("@/lib/simulacao/simulacao-pdf");
        // Um PDF por banco selecionado — o nome do arquivo já vem com o banco.
        for (const b of escolhidos) {
          baixarSimulacaoDetalhadaPDF({ simulacao, bancos: [b] });
        }
      }
      onOpenChange(false);
    } finally {
      setGerando(false);
    }
  }

  const titulo = modo === "consolidado" ? "Comparativo consolidado" : "Simulação detalhada";
  const descricao =
    modo === "consolidado"
      ? "Selecione os bancos que devem aparecer no PDF comparativo."
      : "Escolha os bancos para baixar. Cada banco gera um PDF individual com nome, renda necessária e todas as parcelas.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-1 overflow-y-auto">
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2">
            <Checkbox checked={todosMarcados} onCheckedChange={alternarTodos} />
            <span className="text-sm font-medium text-foreground">Selecionar todos</span>
          </label>
          {(bancosExibidos ?? []).map((b, i) => {
            const key = b.id ?? String(i);
            const sistema = sistemaDoBanco(b);
            return (
              <div
                key={key}
                className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted"
              >
                <label className="flex flex-1 cursor-pointer items-center gap-3">
                  <Checkbox
                    checked={!!selecionados[key]}
                    onCheckedChange={(v) =>
                      setSelecionados((prev) => ({ ...prev, [key]: !!v }))
                    }
                  />
                  <span className="flex flex-1 flex-wrap items-center gap-2 text-sm text-foreground">
                    <span>{b.nome_banco ?? "—"}</span>
                    {sistema !== "—" ? <Badge variant="outline" className="text-[10px]">{sistema}</Badge> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {b.valor_parcela != null ? formatBRL(b.valor_parcela) : "—"}
                  </span>
                </label>
                {modo === "detalhada" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => baixarDetalhadaDeUm(b)}
                    title="Baixar apenas este banco"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={gerar} disabled={escolhidos.length === 0 || gerando}>
            <Download className="mr-1 h-4 w-4" />
            {modo === "consolidado"
              ? `Gerar PDF (${escolhidos.length})`
              : `Baixar ${escolhidos.length} PDF${escolhidos.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function sistemaDoBanco(b: any): string {
  const req = String(b?._sistema ?? b?.sistema_amortizacao ?? "").toUpperCase();
  if (req.includes("PRICE") || req === "P") return "PRICE";
  if (req.includes("SAC") || req === "S") return "SAC";
  const s = String(b?.sistema_amortizacao_banco ?? "").toUpperCase();
  if (s.includes("PRICE") || s === "P") return "PRICE";
  if (s.includes("SAC") || s === "S") return "SAC";
  return "—";
}
