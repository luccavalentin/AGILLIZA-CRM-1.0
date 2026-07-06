import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, FileText, Download, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ToneBadge } from "@/components/crm/tone-badge";
import { supabase } from "@/integrations/supabase/client";
import {
  listarDocumentos,
  anexarDocumento,
  revisarDocumento,
  urlDocumento,
} from "@/lib/crm/clientes.functions";

const CATEGORIAS = [
  { v: "comprador", l: "Comprador / Titular" },
  { v: "conjuge", l: "Cônjuge / Composição" },
  { v: "vendedor", l: "Vendedor" },
  { v: "imovel", l: "Imóvel" },
  { v: "outros", l: "Outros" },
];

const statusTone: Record<string, "success" | "warning" | "danger" | "muted" | "info"> = {
  aprovado: "success",
  recebido: "info",
  pendente: "warning",
  reprovado: "danger",
  expirado: "danger",
};

export function DocumentosTab({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();
  const listar = useServerFn(listarDocumentos);
  const anexar = useServerFn(anexarDocumento);
  const revisar = useServerFn(revisarDocumento);
  const gerarUrl = useServerFn(urlDocumento);

  const [categoria, setCategoria] = useState("comprador");
  const [tipo, setTipo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const { data: docs, isLoading } = useQuery({
    queryKey: ["cliente-docs", clienteId],
    queryFn: () => listar({ data: { cliente_id: clienteId } }),
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Arquivo acima de 10 MB.");
    if (!tipo.trim()) return toast.error("Informe o tipo do documento.");
    setEnviando(true);
    try {
      const path = `${clienteId}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("cliente-documentos").upload(path, file);
      if (upErr) throw upErr;
      await anexar({
        data: {
          cliente_id: clienteId,
          categoria: categoria as any,
          tipo_documento: tipo.trim(),
          nome_arquivo: file.name,
          storage_path: path,
          mime_type: file.type,
          tamanho_bytes: file.size,
        },
      });
      toast.success("Documento anexado.");
      setTipo("");
      qc.invalidateQueries({ queryKey: ["cliente-docs", clienteId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha no upload.");
    } finally {
      setEnviando(false);
    }
  }

  async function baixar(storage_path: string) {
    try {
      const { url } = await gerarUrl({ data: { storage_path } });
      window.open(url, "_blank");
    } catch {
      toast.error("Falha ao gerar link.");
    }
  }

  async function marcar(id: string, status: "aprovado" | "reprovado") {
    await revisar({ data: { id, status } });
    qc.invalidateQueries({ queryKey: ["cliente-docs", clienteId] });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Categoria</label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c.v} value={c.v}>
                    {c.l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Tipo (ex.: RG, IR, Matrícula)</label>
            <Input className="w-52" value={tipo} onChange={(e) => setTipo(e.target.value)} />
          </div>
          <Button asChild disabled={enviando} className="relative">
            <label>
              {enviando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Enviar arquivo
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="sr-only"
                onChange={onFile}
                disabled={enviando}
              />
            </label>
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (docs?.length ?? 0) === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum documento anexado.</p>
      ) : (
        <div className="space-y-2">
          {docs!.map((d: any) => (
            <div
              key={d.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <FileText className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{d.nome_arquivo}</p>
                <p className="text-xs text-muted-foreground">
                  {CATEGORIAS.find((c) => c.v === d.categoria)?.l} · {d.tipo_documento} · v
                  {d.versao}
                </p>
              </div>
              <ToneBadge tone={statusTone[d.status] ?? "muted"}>{d.status}</ToneBadge>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => baixar(d.storage_path)}
                title="Baixar"
              >
                <Download className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => marcar(d.id, "aprovado")}
                title="Aprovar"
              >
                <Check className="size-4 text-success" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => marcar(d.id, "reprovado")}
                title="Reprovar"
              >
                <X className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
