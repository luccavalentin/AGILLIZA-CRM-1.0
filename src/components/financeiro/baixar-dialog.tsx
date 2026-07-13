import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMinhaSessao } from "@/lib/session.functions";
import { baixarConta, listarConfigs, type ContaTipo } from "@/lib/financeiro/financeiro.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { CurrencyInput } from "@/components/simulacao/currency-input";
import { Paperclip } from "lucide-react";
import { hojeISO, formatBRL } from "@/lib/financeiro/format";

interface Props {
  tipo: ContaTipo;
  conta: { id: string; valor: number; valor_pago: number; descricao: string } | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function BaixarDialog({ tipo, conta, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const restante = conta ? conta.valor - conta.valor_pago : 0;
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(hojeISO());
  const [formaId, setFormaId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  const { data: cfg } = useQuery({ queryKey: ["fin-configs"], queryFn: () => listarConfigs() });

  // Reseta o formulário sempre que abrir ou trocar de conta (evita usar valor residual).
  useEffect(() => {
    if (open) {
      setValor(0);
      setData(hojeISO());
      setFormaId("");
      setFile(null);
    }
  }, [open, conta?.id]);

  const mut = useMutation({
    mutationFn: (args: { comprovante_path?: string; valorFinal: number }) =>
      baixarConta({
        data: {
          tipo,
          id: conta!.id,
          valor: args.valorFinal,
          data_pagamento: data,
          payment_method_id: formaId || undefined,
          comprovante_path: args.comprovante_path,
        },
      }),
    onSuccess: () => {
      toast.success(tipo === "pagar" ? "Pagamento registrado." : "Recebimento confirmado.");
      qc.invalidateQueries({ queryKey: ["fin-contas", tipo] });
      qc.invalidateQueries({ queryKey: ["fin-kpis"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha na baixa."),
  });

  async function submit() {
    const v = valor > 0 ? valor : restante;
    if (v <= 0) return toast.error("Informe o valor.");
    setEnviando(true);
    try {
      let path: string | undefined;
      if (file) {
        if (file.size > 10 * 1024 * 1024) throw new Error("Arquivo acima de 10 MB.");
        const sessao = await getMinhaSessao();
        const cid = sessao?.profile?.correspondente_id;
        if (!cid) throw new Error("Correspondente não identificado.");
        const p = `${cid}/${crypto.randomUUID()}-${file.name}`;
        const { error } = await supabase.storage.from("financeiro-comprovantes").upload(p, file);
        if (error) throw error;
        path = p;
      }
      await mut.mutateAsync({ comprovante_path: path, valorFinal: v });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] p-4 sm:max-w-md md:p-6">
        <DialogHeader>
          <DialogTitle>{tipo === "pagar" ? "Baixar conta" : "Confirmar recebimento"}</DialogTitle>
        </DialogHeader>
        {conta && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {conta.descricao} · Saldo devedor{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatBRL(restante)}
              </span>
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Valor</Label>
                <CurrencyInput value={valor || restante} onChange={setValor} />
              </div>
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={formaId} onValueChange={setFormaId}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {(cfg?.formasPagamento ?? []).map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Comprovante (opcional)</Label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground hover:bg-muted/50">
                <Paperclip className="h-4 w-4" />
                {file ? file.name : "Anexar comprovante"}
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={enviando || mut.isPending}>
            {enviando || mut.isPending ? "Registrando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
