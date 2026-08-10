import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { formatBRL, maskBRLCents, parseBRL } from "@/lib/simulacao/format";
import {
  criarCreditoMatricula,
  excluirCreditoMatricula,
} from "@/lib/matriculas/matriculas.functions";

const hoje = () => new Date().toISOString().slice(0, 10);

export function Creditos({
  lista,
  onMudou,
}: {
  lista: { id: string; data: string; valor: number; descricao: string | null }[];
  onMudou: () => void;
}) {
  const total = useMemo(() => lista.reduce((s, c) => s + Number(c.valor), 0), [lista]);
  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Compras de crédito</h2>
          <p className="text-xs text-muted-foreground">Total: {formatBRL(total)}</p>
        </div>
        <CreditoDialog onMudou={onMudou} />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma compra de crédito registrada.
                </TableCell>
              </TableRow>
            )}
            {lista.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="tabular-nums">
                  {new Date(c.data + "T00:00:00").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </TableCell>
                <TableCell>{c.descricao ?? "Compra de crédito"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatBRL(c.valor)}</TableCell>
                <TableCell className="text-right">
                  <ConfirmDelete
                    descricao="Excluir esta compra de crédito?"
                    onConfirm={async () => {
                      await excluirCreditoMatricula({ data: { id: c.id } });
                      onMudou();
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function CreditoDialog({ onMudou }: { onMudou: () => void }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(hoje());
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await criarCreditoMatricula({
        data: { data, valor: parseBRL(valor), descricao: descricao.trim() || null },
      });
      toast.success("Crédito registrado.");
      setOpen(false);
      setValor("");
      setDescricao("");
      setData(hoje());
      onMudou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Plus className="mr-1 h-4 w-4" /> Adicionar crédito
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Compra de crédito</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Valor</Label>
              <Input
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(maskBRLCents(e.target.value))}
                placeholder="0,00"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
