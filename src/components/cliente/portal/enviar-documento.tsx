import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { clienteEnviarDocumento, type PastaCliente } from "@/lib/portal/cliente-portal.functions";
import { problemaNoArquivo } from "@/lib/portal/jornada";

function paraBase64(arq: File): Promise<string> {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.onerror = () => falha(new Error("Não foi possível ler o arquivo."));
    r.readAsDataURL(arq);
  });
}

function useEnviar(aoEnviar?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      arq: File;
      documentoId: string | null;
      pastaId: string | null;
      categoria: "comprador" | "vendedor" | "imovel" | "outros" | null;
      tipo: string | null;
    }) => {
      const problema = problemaNoArquivo(v.arq);
      if (problema) throw new Error(problema);
      return clienteEnviarDocumento({
        data: {
          documentoId: v.documentoId,
          pastaId: v.pastaId,
          categoria: v.categoria,
          tipo: v.tipo,
          nome_arquivo: v.arq.name,
          mime_type: v.arq.type || "application/octet-stream",
          conteudo_base64: await paraBase64(v.arq),
        },
      });
    },
    onSuccess: (r) => {
      toast.success(`Recebido! Guardamos na pasta "${r.pasta}" e a equipe vai conferir.`);
      qc.invalidateQueries({ queryKey: ["cliente"] });
      aoEnviar?.();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível enviar o arquivo.")),
  });
}

/**
 * Envio direto de uma pendência: um toque abre a câmera/arquivos e o documento entra
 * no registro (e na pasta) que a equipe pediu.
 */
export function EnviarPendencia({
  documentoId,
  rotulo = "Enviar",
  variante = "default",
}: {
  documentoId: string;
  rotulo?: string;
  variante?: "default" | "outline";
}) {
  const input = useRef<HTMLInputElement>(null);
  const enviar = useEnviar();
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const arq = e.target.files?.[0];
          e.target.value = "";
          if (arq) enviar.mutate({ arq, documentoId, pastaId: null, categoria: null, tipo: null });
        }}
      />
      <Button
        size="sm"
        variant={variante}
        className="min-h-9 shrink-0"
        disabled={enviar.isPending}
        onClick={() => input.current?.click()}
      >
        {enviar.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Camera className="mr-1.5 size-4" />}
        {enviar.isPending ? "Enviando…" : rotulo}
      </Button>
    </>
  );
}

const CATEGORIAS: { id: "comprador" | "vendedor" | "imovel" | "outros"; nome: string }[] = [
  { id: "comprador", nome: "Comprador / Titular e Cônjuge" },
  { id: "vendedor", nome: "Vendedor e Cônjuge" },
  { id: "imovel", nome: "Imóvel" },
  { id: "outros", nome: "Outros" },
];

/** "Enviar outro documento": o cliente diz o que é e em qual pasta entra. */
export function EnviarNovoDocumento({ pastas }: { pastas: PastaCliente[] }) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState("");
  const [destino, setDestino] = useState("");
  const [arq, setArq] = useState<File | null>(null);
  const enviar = useEnviar(() => {
    setAberto(false);
    setTipo("");
    setDestino("");
    setArq(null);
  });
  const opcoes = pastas.length
    ? pastas.map((p) => ({ valor: `pasta:${p.id}`, nome: p.nome }))
    : CATEGORIAS.map((c) => ({ valor: `cat:${c.id}`, nome: c.nome }));
  const problema = arq ? problemaNoArquivo(arq) : null;

  return (
    <>
      <Button onClick={() => setAberto(true)} className="min-h-10 w-full sm:w-auto">
        <FileUp className="mr-1.5 size-4" /> Enviar documento
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar documento</DialogTitle>
            <DialogDescription>PDF ou foto de até 10 MB. A equipe confere e avisa por aqui.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nd-tipo">Que documento é?</Label>
              <Input id="nd-tipo" placeholder="Ex.: comprovante de residência" value={tipo} maxLength={120} onChange={(e) => setTipo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Pasta</Label>
              <Select value={destino} onValueChange={setDestino}>
                <SelectTrigger aria-label="Pasta do documento">
                  <SelectValue placeholder="Escolha a pasta" />
                </SelectTrigger>
                <SelectContent>
                  {opcoes.map((o) => (
                    <SelectItem key={o.valor} value={o.valor}>
                      {o.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nd-arq">Arquivo</Label>
              <Input id="nd-arq" type="file" accept="application/pdf,image/*" onChange={(e) => setArq(e.target.files?.[0] ?? null)} />
              {problema && <p className="text-xs text-destructive">{problema}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={!arq || !!problema || tipo.trim().length < 2 || !destino || enviar.isPending}
              onClick={() =>
                arq &&
                enviar.mutate({
                  arq,
                  documentoId: null,
                  pastaId: destino.startsWith("pasta:") ? destino.slice(6) : null,
                  categoria: destino.startsWith("cat:") ? (destino.slice(4) as "comprador") : null,
                  tipo: tipo.trim(),
                })
              }
            >
              {enviar.isPending ? "Enviando…" : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
