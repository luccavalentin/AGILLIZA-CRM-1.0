import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Loader2, Trash2, Upload } from "lucide-react";
import {
  registrarDocumento,
  removerDocumento,
  urlDocumento,
} from "@/lib/propostas/propostas.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VisualizadorArquivo } from "@/components/comum/visualizador-arquivo";
import { ToneBadge } from "@/components/crm/tone-badge";

const TIPOS_DOC = [
  "RG",
  "CPF",
  "COMP_RENDA",
  "IR",
  "EXT_BANC",
  "MATRICULA",
  "IPTU",
  "CERT_NASC",
  "CERT_CAS",
];

export function TabDocumentos({
  propostaId,
  documentos,
}: {
  propostaId: string;
  documentos: any[];
}) {
  const qc = useQueryClient();
  const registrarFn = useServerFn(registrarDocumento);
  const removerFn = useServerFn(removerDocumento);
  const urlFn = useServerFn(urlDocumento);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState("RG");
  const [parte, setParte] = useState("comprador1");
  const [uploading, setUploading] = useState(false);
  const [visualizando, setVisualizando] = useState<{ url: string; nome: string } | null>(null);

  async function onFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo acima de 10 MB. Escolha um arquivo menor.");
      return;
    }
    setUploading(true);
    try {
      const path = `${propostaId}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("documentos-proposta").upload(path, file);
      if (error) throw new Error(error.message);
      await registrarFn({
        data: {
          proposta_id: propostaId,
          nome_documento: file.name,
          tipo_documento: tipo,
          parte,
          storage_path: path,
          mime_type: file.type,
          tamanho_bytes: file.size,
        },
      });
      toast.success("Documento anexado.");
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setUploading(false);
    }
  }

  async function baixar(storage_path: string, nome: string) {
    try {
      const { url } = await urlFn({ data: { storage_path } });
      setVisualizando({ url, nome });
    } catch {
      toast.error("Não foi possível gerar o link.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_DOC.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Participante</Label>
          <Select value={parte} onValueChange={setParte}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comprador1">Comprador 1</SelectItem>
              <SelectItem value="comprador2">Comprador 2</SelectItem>
              <SelectItem value="vendedor">Vendedor</SelectItem>
              <SelectItem value="imovel">Imóvel</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-1 h-4 w-4" />
          )}
          Adicionar documento
        </Button>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Participante</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documentos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum documento anexado.
                </TableCell>
              </TableRow>
            )}
            {documentos.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.parte ?? "—"}</TableCell>
                <TableCell>{d.tipo_documento ?? "—"}</TableCell>
                <TableCell className="font-medium">{d.nome_documento}</TableCell>
                <TableCell>
                  <ToneBadge
                    tone={
                      d.status === "aprovado"
                        ? "success"
                        : d.status === "reprovado"
                          ? "danger"
                          : "info"
                    }
                  >
                    {d.status}
                  </ToneBadge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => baixar(d.storage_path, d.nome_documento ?? "documento")}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      await removerFn({ data: { id: d.id } });
                      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <VisualizadorArquivo
        arquivo={visualizando}
        open={!!visualizando}
        onOpenChange={(o: boolean) => !o && setVisualizando(null)}
      />
    </div>
  );
}
