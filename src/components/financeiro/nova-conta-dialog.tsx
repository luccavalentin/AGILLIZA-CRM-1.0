import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMinhaSessao } from "@/lib/session.functions";
import { criarConta, listarConfigs, type ContaTipo } from "@/lib/financeiro/financeiro.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
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
import { Paperclip, Plus } from "lucide-react";
import { hojeISO } from "@/lib/financeiro/format";

export function NovaContaDialog({ tipo }: { tipo: ContaTipo }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [vencimento, setVencimento] = useState(hojeISO());
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [ccId, setCcId] = useState<string>("");
  const [recorrencia, setRecorrencia] = useState<
    "nenhuma" | "mensal" | "anual" | "parcelado"
  >("nenhuma");
  const [parcelas, setParcelas] = useState(2);
  const [file, setFile] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  const { data: cfg } = useQuery({ queryKey: ["fin-configs"], queryFn: () => listarConfigs() });

  const criar = useMutation({
    mutationFn: (comprovante_path?: string) =>
      criarConta({
        data: {
          tipo,
          descricao: descricao.trim(),
          valor,
          vencimento,
          categoria_id: categoriaId || undefined,
          cost_center_id: ccId || undefined,
          comprovante_path,
          recorrencia,
          parcelas: recorrencia === "parcelado" ? parcelas : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Conta criada.");
      qc.invalidateQueries({ queryKey: ["fin-contas", tipo] });
      setOpen(false);
      setDescricao("");
      setValor(0);
      setFile(null);
      setCategoriaId("");
      setCcId("");
      setRecorrencia("nenhuma");
      setParcelas(2);
      setVencimento(hojeISO());
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao criar conta."),
  });

  async function submit() {
    if (!descricao.trim()) return toast.error("Informe a descrição.");
    if (valor <= 0) return toast.error("Informe um valor válido.");
    setEnviando(true);
    try {
      let comprovante_path: string | undefined;
      if (file) {
        if (file.size > 10 * 1024 * 1024) throw new Error("Arquivo acima de 10 MB.");
        const sessao = await getMinhaSessao();
        const cid = sessao?.profile?.correspondente_id;
        if (!cid) throw new Error("Correspondente não identificado.");
        // Sanitiza o nome do arquivo: o Storage rejeita chaves com espaços,
        // vírgulas e acentos ("Invalid key"). Mantém só caracteres seguros.
        const ponto = file.name.lastIndexOf(".");
        const ext = ponto >= 0 ? file.name.slice(ponto + 1).toLowerCase() : "";
        const nomeBase = (ponto >= 0 ? file.name.slice(0, ponto) : file.name)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 80);
        const nomeSeguro = `${nomeBase || "comprovante"}${ext ? `.${ext}` : ""}`;
        const path = `${cid}/${crypto.randomUUID()}-${nomeSeguro}`;
        const { error } = await supabase.storage.from("financeiro-comprovantes").upload(path, file);
        if (error) throw error;
        comprovante_path = path;
      }
      await criar.mutateAsync(comprovante_path);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" /> Nova conta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto p-4 sm:max-w-lg md:p-6">
        <DialogHeader>
          <DialogTitle>Nova conta a {tipo === "pagar" ? "pagar" : "receber"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Cartório, marketing…"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <CurrencyInput value={valor} onChange={setValor} />
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento</Label>
              <Input
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Recorrência</Label>
              <Select value={recorrencia} onValueChange={(v) => setRecorrencia(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Nenhuma</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {recorrencia === "parcelado" && (
              <div className="space-y-1.5">
                <Label>Parcelas da duplicata</Label>
                <Input
                  type="number"
                  min={2}
                  max={360}
                  value={parcelas || ""}
                  onChange={(e) => setParcelas(Math.max(2, Number(e.target.value) || 2))}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {(cfg?.categorias ?? [])
                    .filter(
                      (c: any) =>
                        !c.tipo ||
                        c.tipo === (tipo === "pagar" ? "despesa" : "receita"),
                    )
                    .map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Centro de custo</Label>
              <Select value={ccId} onValueChange={setCcId}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {(cfg?.centrosCusto ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Anexo (opcional)</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground hover:bg-muted/50">
              <Paperclip className="h-4 w-4" />
              {file ? file.name : "Selecionar comprovante"}
              <input
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={enviando || criar.isPending}>
            {enviando || criar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
