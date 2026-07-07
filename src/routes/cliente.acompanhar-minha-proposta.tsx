import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Upload, Paperclip, Camera, FileText, Loader2 } from "lucide-react";
import { z } from "zod";
import {
  clienteObterVisaoGeral,
  clienteMeusDocumentos,
  clienteMinhasPropostas,
  clienteListarMensagens,
  clienteEnviarMensagem,
  clienteEnviarMensagemAnexo,
  clienteMarcarLida,
  clienteEnviarDocumentoPendente,
} from "@/lib/portal/cliente.functions";
import { useIncomingChatSound } from "@/hooks/use-chat-sound";
import { TimelineCliente } from "@/components/cliente/timeline-cliente";
import { ChipDocumento } from "@/components/cliente/chip-documento";
import { BradescoRetornoTimer, isBradesco } from "@/components/proposta/bradesco-timer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VisualizadorArquivo } from "@/components/comum/visualizador-arquivo";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
    <Tabs
      value={tab}
      onValueChange={(v) => navigate({ search: { tab: v as typeof tab } })}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="processo">Processo</TabsTrigger>
        <TabsTrigger value="documentos">Docs</TabsTrigger>
        <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
        <TabsTrigger value="propostas">Propostas</TabsTrigger>
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

function fileParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      resolve(res.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

function AbaMensagens() {
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [visualizando, setVisualizando] = useState<{ url: string; nome: string } | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const { data: mensagens } = useQuery({
    queryKey: ["cliente", "mensagens"],
    queryFn: () => clienteListarMensagens(),
    refetchInterval: (q: any) => (q.state.status === "error" ? false : 8000),
  });

  const enviar = useMutation({
    mutationFn: (mensagem: string) => clienteEnviarMensagem({ data: { mensagem } }),
    onSuccess: () => {
      setTexto("");
      qc.invalidateQueries({ queryKey: ["cliente", "mensagens"] });
    },
    onError: () => toast.error("Falha de conexão. Tente novamente."),
  });

  const enviarAnexo = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await fileParaBase64(file);
      return clienteEnviarMensagemAnexo({
        data: {
          mensagem: texto.trim() || undefined,
          nome_arquivo: file.name,
          mime_type: file.type || "application/octet-stream",
          conteudo_base64: base64,
        },
      });
    },
    onSuccess: () => {
      setTexto("");
      toast.success("Anexo enviado!");
      qc.invalidateQueries({ queryKey: ["cliente", "mensagens"] });
    },
    onError: () => toast.error("Falha ao enviar o anexo. Verifique o arquivo e tente novamente."),
  });

  const enviandoAnexo = enviarAnexo.isPending;

  function selecionar(file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 10MB).");
      return;
    }
    enviarAnexo.mutate(file);
  }

  // Marca as mensagens do time como lidas (uma vez por id, sem reenvio em loop).
  const marcadosRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const naoLidas = (mensagens ?? [])
      .filter((m) => m.remetente_tipo === "time" && !m.lida_em && !marcadosRef.current.has(m.id))
      .map((m) => m.id);
    if (naoLidas.length > 0) {
      naoLidas.forEach((id) => marcadosRef.current.add(id));
      clienteMarcarLida({ data: { mensagem_ids: naoLidas } })
        .then(() => qc.invalidateQueries({ queryKey: ["cliente", "notificacoes"] }))
        .catch(() => {
          naoLidas.forEach((id) => marcadosRef.current.delete(id));
        });
    }
  }, [mensagens, qc]);

  useIncomingChatSound(
    mensagens?.map((m) => ({ id: m.id, mine: m.remetente_tipo === "cliente" })),
  );

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  return (
    <div className="flex flex-col">
      <div className="min-h-[45dvh] space-y-3 pb-2">
        {(mensagens ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Envie uma mensagem ou um documento para falar com o time.
          </p>
        ) : (
          (mensagens ?? []).map((m) => {
            const doCliente = m.remetente_tipo === "cliente";
            const temAnexo = !!m.anexo_url;
            const soAnexo = temAnexo && (!m.mensagem || m.mensagem === m.anexo_nome);
            return (
              <div
                key={m.id}
                className={cn("flex flex-col", doCliente ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] overflow-hidden rounded-2xl text-sm shadow-sm",
                    doCliente
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground",
                  )}
                >
                  {temAnexo && m.anexo_is_imagem ? (
                    <button
                      type="button"
                      onClick={() =>
                        setVisualizando({ url: m.anexo_url!, nome: m.anexo_nome ?? "Anexo" })
                      }
                      className="block"
                    >
                      <img
                        src={m.anexo_url!}
                        alt={m.anexo_nome ?? "Anexo"}
                        className="max-h-64 w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ) : temAnexo ? (
                    <button
                      type="button"
                      onClick={() =>
                        setVisualizando({ url: m.anexo_url!, nome: m.anexo_nome ?? "Documento" })
                      }
                      className="flex items-center gap-2 px-3 py-2 underline underline-offset-2"
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="truncate">{m.anexo_nome ?? "Documento"}</span>
                    </button>
                  ) : null}
                  {!soAnexo && (
                    <p className="whitespace-pre-wrap px-3 py-2">{m.mensagem}</p>
                  )}
                </div>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(m.criada_em).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })
        )}
        {enviandoAnexo && (
          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando anexo…
          </div>
        )}
        <div ref={fimRef} />
      </div>

      <input
        ref={fotoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          selecionar(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={arquivoRef}
        type="file"
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
        className="hidden"
        onChange={(e) => {
          selecionar(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <form
        className="sticky bottom-0 mt-3 flex items-end gap-1.5 bg-background pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = texto.trim();
          if (v) enviar.mutate(v);
        }}
      >
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-11 w-11 shrink-0"
          disabled={enviandoAnexo}
          onClick={() => fotoRef.current?.click()}
          aria-label="Enviar foto"
        >
          <Camera className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-11 w-11 shrink-0"
          disabled={enviandoAnexo}
          onClick={() => arquivoRef.current?.click()}
          aria-label="Anexar documento"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva sua mensagem…"
          rows={1}
          className="min-h-11 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          className="h-11 w-11 shrink-0"
          disabled={enviar.isPending || enviandoAnexo || !texto.trim()}
          aria-label="Enviar mensagem"
        >
          <Send className="h-5 w-5" />
        </Button>
      </form>
      <VisualizadorArquivo
        arquivo={visualizando}
        open={!!visualizando}
        onOpenChange={(o: boolean) => !o && setVisualizando(null)}
      />
    </div>
  );
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
