import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BANCOS_CONCILIACAO, bancoPorId } from "@/lib/conciliacao/bancos";
import { lerArquivoBanco } from "@/lib/conciliacao/exportar-lazy";
import { processarConciliacao } from "@/lib/conciliacao/conciliacao.functions";

/** Upload do relatório oficial do banco + disparo do cruzamento. */
export function NovaConciliacaoDialog({
  open,
  onOpenChange,
  periodoPadrao,
  onConcluido,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  periodoPadrao: string;
  onConcluido: (loteId: string) => void;
}) {
  const processar = useServerFn(processarConciliacao);
  const [bancoId, setBancoId] = useState("bradesco");
  const [periodo, setPeriodo] = useState(periodoPadrao);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const banco = bancoPorId(bancoId);

  async function enviar() {
    if (!banco || !arquivo) return;
    setBusy(true);
    try {
      const linhas = await lerArquivoBanco(arquivo, banco);
      if (!linhas.length) {
        toast.error("Não foi possível ler linhas neste arquivo.", {
          description:
            "Confira se o arquivo é o relatório oficial do banco selecionado e se a aba/cabeçalho estão intactos.",
        });
        return;
      }
      const { loteId } = await processar({
        data: {
          bancoLabel: banco.label,
          periodo,
          nomeArquivo: arquivo.name,
          linhas,
        },
      });
      toast.success(`Comparativo concluído — ${linhas.length} linhas lidas.`);
      onOpenChange(false);
      setArquivo(null);
      onConcluido(loteId);
    } catch (e) {
      toast.error("Falha ao conciliar", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo comparativo de dados</DialogTitle>
          <DialogDescription>
            Envie o relatório oficial do banco. O sistema apenas compara — nenhuma proposta é criada
            ou alterada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Banco</Label>
            <Select value={bancoId} onValueChange={setBancoId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BANCOS_CONCILIACAO.map((b) => (
                  <SelectItem key={b.id} value={b.id} disabled={!b.disponivel}>
                    {b.label}
                    {b.disponivel ? "" : " (layout não mapeado)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="periodo-conc">Mês de referência</Label>
            <Input
              id="periodo-conc"
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="arquivo-conc">Arquivo do banco</Label>
            <Input
              id="arquivo-conc"
              type="file"
              accept={banco?.accept}
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              {banco?.formato === "tab"
                ? "Bradesco: arquivo .xls exportado como texto tabulado."
                : `Itaú/XLSX: aba “${banco?.aba ?? "primeira aba"}”.`}{" "}
              O CPF é lido apenas para o cruzamento e gravado mascarado.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={enviar}
            disabled={busy || !arquivo || !banco?.disponivel || !/^\d{4}-\d{2}$/.test(periodo)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Conciliar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
