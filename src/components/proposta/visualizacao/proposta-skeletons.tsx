import * as React from "react";
import { Loader2, FileText, ArrowLeft, RefreshCw, AlertCircle, Ban, Trash2, Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useRouter, Link } from "@tanstack/react-router";

export function PropostaSkeleton() {
  return (
    <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground animate-pulse">Carregando proposta...</p>
    </div>
  );
}

export function PropostaNaoEncontrada() {
  const router = useRouter();
  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6 text-center">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <div className="p-4 bg-muted rounded-full">
          <FileText className="h-12 w-12" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Proposta não encontrada</h1>
      </div>
      <p className="text-muted-foreground">Não foi possível localizar os dados desta proposta.</p>
      <Button variant="outline" onClick={() => router.navigate({ to: "/operacional/propostas" })} className="mt-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para a lista
      </Button>
    </div>
  );
}

export function PropostaErro({ error, reset, id }: { error: any; reset: () => void; id: string }) {
  const router = useRouter();
  const e = error as any;
  
  const isPermissionError = e?.message?.includes("permissão") || e?.status === 403;
  const isNetworkError = e?.message?.includes("fetch") || e?.message?.includes("Network Error") || e?.name === "TypeError";
  const prop = e?.proposta || e?.data?.proposta;
  const isDeleted = prop?.deleted_at;

  if (isPermissionError) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-6 text-center">
        <div className="flex flex-col items-center gap-4 text-destructive">
          <div className="p-4 bg-destructive/10 rounded-full">
            <Ban className="h-12 w-12" />
          </div>
          <h1 className="text-2xl font-bold">Acesso Negado</h1>
        </div>
        <p className="text-muted-foreground">Você não tem permissão para acessar o registro específico.</p>
        <Button variant="outline" onClick={() => router.navigate({ to: "/operacional/propostas" })} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para a lista
        </Button>
      </div>
    );
  }

  if (isDeleted) {
     return (
      <div className="p-8 max-w-2xl mx-auto space-y-6 text-center">
        <div className="flex flex-col items-center gap-4 text-destructive">
          <div className="p-4 bg-destructive/10 rounded-full">
            <Trash2 className="h-12 w-12" />
          </div>
          <h1 className="text-2xl font-bold">Esta proposta foi excluída</h1>
        </div>
        <p className="text-muted-foreground">Esta proposta não está mais disponível pois foi removida.</p>
        <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => router.navigate({ to: "/operacional/propostas" })}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para a lista
            </Button>
        </div>
      </div>
    );
  }

  const title = isNetworkError ? "Falha de conexão" : "Erro ao carregar proposta";
  const msg = isNetworkError ? "Não foi possível conectar ao servidor. Verifique sua internet." : (e?.message || "Ocorreu um erro inesperado ao tentar abrir esta proposta.");

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 text-destructive">
        <AlertCircle className="h-8 w-8" />
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      
      <p className="text-muted-foreground">{msg}</p>

      <Accordion type="single" collapsible className="w-full border rounded-lg bg-muted/30">
        <AccordionItem value="details" className="border-none">
          <AccordionTrigger className="px-4 py-2 hover:no-underline text-xs text-muted-foreground">
            Detalhes técnicos
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <pre className="text-[10px] overflow-auto max-h-[300px] p-3 bg-black/5 rounded font-mono">
              {JSON.stringify({
                name: e?.name,
                message: e?.message,
                stack: e?.stack,
                cause: e?.cause,
                data: e?.data
              }, null, 2)}
            </pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex gap-3">
        <Button onClick={() => reset()} size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
        <Button variant="ghost" size="sm" onClick={() => router.navigate({ to: "/operacional/propostas" })}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
