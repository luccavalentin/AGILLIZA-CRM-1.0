import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Paperclip, ListChecks } from "lucide-react";
import { z } from "zod";
import {
  clienteObterVisaoGeral,
  clienteMeusDocumentos,
  clienteMinhasPropostas,
  clienteEnviarDocumentoPendente,
} from "@/lib/portal/cliente.functions";
import { TimelineCliente } from "@/components/cliente/timeline-cliente";
import { CabecalhoPagina } from "@/components/cliente/cabecalho-pagina";
import { ChipDocumento } from "@/components/cliente/chip-documento";
import { ChatCliente } from "@/components/cliente/chat-cliente";
import { BradescoRetornoTimer, isBradesco } from "@/components/proposta/bradesco-timer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";


const searchSchema = z.object({
  tab: z.enum(["processo", "documentos", "mensagens", "propostas"]).catch("processo"),
});

export const Route = createFileRoute("/cliente/acompanhar-minha-proposta")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Acompanhar — Meu Financiamento" }] }),
  component: Acompanhar,
});

function moeda(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Acompanhar() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        icon={ListChecks}
        titulo="Acompanhar minha proposta"
        subtitulo="Processo, documentos, mensagens e propostas em um só lugar"
      />

      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { tab: v as typeof tab } })}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-4 gap-1">
          <TabsTrigger value="processo" className="truncate px-1 text-xs sm:px-3 sm:text-sm">
            Processo
          </TabsTrigger>
          <TabsTrigger value="documentos" className="truncate px-1 text-xs sm:px-3 sm:text-sm">
            Docs
          </TabsTrigger>
          <TabsTrigger value="mensagens" className="truncate px-1 text-xs sm:px-3 sm:text-sm">
            Mensagens
          </TabsTrigger>
          <TabsTrigger value="propostas" className="truncate px-1 text-xs sm:px-3 sm:text-sm">
            Propostas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="processo" className="mt-4">
          <AbaProcesso />
        </TabsContent>
        <TabsContent value="documentos" className="mt-4">
          <AbaDocumentos />
        </TabsContent>
        <TabsContent value="mensagens" className="mt-4">
          <AbaMensagens />
        </TabsContent>
        <TabsContent value="propostas" className="mt-4">
          <AbaPropostas />
        </TabsContent>
      </Tabs>
    </div>
  );
}


function AbaProcesso() {
  const { data, isLoading } = useQuery({
    queryKey: ["cliente", "visao-geral"],
    queryFn: () => clienteObterVisaoGeral(),
  });
  if (isLoading || !data) return <Skeleton className="h-96 w-full rounded-lg" />;
  return (
    <Card className="border-border">
      <CardContent className="pt-6">
        <TimelineCliente etapas={data.etapas} />
      </CardContent>
    </Card>
  );
}

function AbaDocumentos() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipoAlvo, setTipoAlvo] = useState<string>("Documento");
  const { data, isLoading } = useQuery({
    queryKey: ["cliente", "documentos"],
    queryFn: () => clienteMeusDocumentos(),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const buf = await file.arrayBuffer();
      // Converte para base64 em blocos para não travar a UI thread com arquivos grandes.
      const bytes = new Uint8Array(buf);
      let bin = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      const base64 = btoa(bin);
      return clienteEnviarDocumentoPendente({
        data: {
          tipo: tipoAlvo,
          nome_arquivo: file.name,
          mime_type: file.type || "application/octet-stream",
          conteudo_base64: base64,
        },
      });
    },
    onSuccess: () => {
      toast.success("Documento enviado! Vamos analisar em breve.");
      qc.invalidateQueries({ queryKey: ["cliente", "documentos"] });
      qc.invalidateQueries({ queryKey: ["cliente", "visao-geral"] });
    },
    onError: () => toast.error("Falha ao enviar. Verifique o arquivo e tente novamente."),
  });

  function escolher(tipo: string) {
    setTipoAlvo(tipo);
    inputRef.current?.click();
  }

  if (isLoading || !data) return <Skeleton className="h-64 w-full rounded-lg" />;

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload.mutate(f);
          e.target.value = "";
        }}
      />
      {data.length === 0 ? (
        <Card className="border-border">
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            Nenhum documento solicitado no momento.
          </CardContent>
        </Card>
      ) : (
        data.map((d) => (
          <Card key={d.id} className="border-border">
            <CardContent className="space-y-2 pt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{d.tipo_documento ?? d.nome_arquivo}</span>
                <ChipDocumento status={d.status} />
              </div>
              {(d.status === "pendente" || d.status === "reprovado") && (
                <Button
                  size="lg"
                  className="w-full"
                  disabled={upload.isPending}
                  onClick={() => escolher(d.tipo_documento ?? "Documento")}
                >
                  <Upload className="mr-2 h-5 w-5" />
                  {d.status === "reprovado" ? "Reenviar" : "Enviar / Substituir"}
                </Button>
              )}
            </CardContent>
          </Card>
        ))
      )}
      <Button
        variant="outline"
        size="lg"
        className="w-full"
        disabled={upload.isPending}
        onClick={() => escolher("Documento adicional")}
      >
        <Paperclip className="mr-2 h-5 w-5" /> Enviar outro documento
      </Button>
    </div>
  );
}



function AbaMensagens() {
  return <ChatCliente altura="h-[48dvh] max-h-[480px] min-h-[240px]" />;
}

function AbaPropostas() {
  const { data, isLoading } = useQuery({
    queryKey: ["cliente", "propostas"],
    queryFn: () => clienteMinhasPropostas(),
  });
  if (isLoading || !data) return <Skeleton className="h-40 w-full rounded-lg" />;
  if (data.length === 0)
    return (
      <Card className="border-border">
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          Nenhuma proposta ativa no momento.
        </CardContent>
      </Card>
    );
  return (
    <div className="space-y-3">
      {data.map((p) => (
        <Card key={p.id} className="border-border">
          <CardContent className="space-y-2 pt-4">
            <p className="font-semibold">{p.banco ?? "Banco"}</p>
            <p className="text-sm text-muted-foreground">
              {p.produto ?? "Financiamento"} · {moeda(p.valor)}
            </p>
            <p className="text-sm font-medium text-primary">{p.status_amigavel}</p>
            {isBradesco(p.banco) && p.enviada_em && (
              <BradescoRetornoTimer
                enviadoEm={p.enviada_em}
                retornado={
                  !["Enviada para aprovação de crédito", "Em aprovação de crédito"].includes(
                    p.status_amigavel,
                  )
                }
              />
            )}
          </CardContent>
        </Card>

      ))}
    </div>
  );
}
