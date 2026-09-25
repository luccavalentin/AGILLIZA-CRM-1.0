import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, Loader2, SendHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DocumentacaoBadge } from "@/components/propostas/documentacao-badge";
import { HistoricoComentarios } from "@/components/proposta/historico-comentarios";
import { adicionarFollowup, listarComentariosProposta } from "@/lib/propostas/propostas.functions";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { cn } from "@/lib/utils";

/**
 * Comentários da proposta em formato de chat, sem sair da tela: documentos
 * rejeitados fixados no topo, a conversa do FUP no meio e o campo de mensagem
 * embaixo. Aberto pelo menu "⋯" da consulta de propostas, pelo selo de
 * documentação e pelo card do CRM.
 */
export function ComentariosPropostaDialog({
  open,
  onOpenChange,
  propostaId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  propostaId: string;
}) {
  const qc = useQueryClient();
  const enviar = useServerFn(adicionarFollowup);
  const q = useQuery({
    queryKey: ["proposta-comentarios", propostaId],
    queryFn: () => listarComentariosProposta({ data: { proposta_id: propostaId } }),
    enabled: open,
  });
  const d = q.data;

  const [texto, setTexto] = useState("");
  // Interno fica só no Agilliza; externo também vai para a HomeFin.
  const [externo, setExterno] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  // Como num chat: abre e segue sempre na mensagem mais nova.
  const totalMensagens = d?.followups.length ?? 0;
  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [totalMensagens]);

  async function mandar() {
    const comentario = texto.trim();
    if (!comentario || enviando) return;
    setEnviando(true);
    try {
      await enviar({
        data: { proposta_id: propostaId, tipo: externo ? "externo" : "interno", comentario },
      });
      setTexto("");
      await qc.invalidateQueries({ queryKey: ["proposta-comentarios", propostaId] });
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível enviar a mensagem."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Comentários da proposta{d ? ` ${d.numero_proposta}` : ""}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{d?.nome_cliente ?? "Conversa do FUP e retorno da análise dos documentos."}</span>
            <Link
              to="/operacional/propostas/$id"
              params={{ id: propostaId }}
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Abrir proposta
            </Link>
          </DialogDescription>
        </DialogHeader>

        {q.isLoading && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando conversa…
          </div>
        )}
        {q.error && (
          <p className="py-4 text-sm text-destructive">
            {mensagemDeErro(q.error, "Não foi possível carregar os comentários.")}
          </p>
        )}

        {d && (
          <div className="flex flex-col gap-3">
            {d.documentacao && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Documentação
                </span>
                <DocumentacaoBadge situacao={d.documentacao} />
              </div>
            )}

            {d.recusados.length > 0 && (
              <section className="rounded-lg border border-destructive/25 bg-destructive/5 p-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {d.recusados.length === 1
                    ? "Documento rejeitado"
                    : `${d.recusados.length} documentos rejeitados`}
                </p>
                <ul className="space-y-1.5">
                  {d.recusados.map((r, i) => (
                    <li key={`${r.nome_vaga}-${i}`} className="text-sm">
                      <span className="font-medium text-foreground">
                        {r.nome_vaga ?? "Documento"}
                      </span>
                      {r.mensagem && <span className="text-muted-foreground"> — {r.mensagem}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Conversa: rola sozinha até a mensagem mais nova. */}
            <div className="h-[46vh] min-h-56 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-3">
              <HistoricoComentarios followups={d.followups} />
              <div ref={fimRef} />
            </div>

            {/* Campo de mensagem, como num chat: Enter envia, Shift+Enter quebra linha. */}
            <div className="rounded-xl border border-border/60 bg-background p-2 focus-within:ring-2 focus-within:ring-ring/40">
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    mandar();
                  }
                }}
                placeholder="Escreva uma mensagem…"
                rows={2}
                maxLength={4000}
                disabled={enviando}
                className="min-h-0 resize-none border-0 p-1 shadow-none focus-visible:ring-0"
                aria-label="Mensagem"
              />
              <div className="mt-1 flex items-center justify-between gap-2">
                <div
                  className="inline-flex rounded-lg bg-muted p-0.5 text-xs"
                  role="radiogroup"
                  aria-label="Para quem vai a mensagem"
                >
                  {[
                    { valor: false, rotulo: "Interno" },
                    { valor: true, rotulo: "Enviar à HomeFin" },
                  ].map((o) => (
                    <button
                      key={o.rotulo}
                      type="button"
                      role="radio"
                      aria-checked={externo === o.valor}
                      onClick={() => setExterno(o.valor)}
                      className={cn(
                        "rounded-md px-2.5 py-1 font-medium transition-colors",
                        externo === o.valor
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {o.rotulo}
                    </button>
                  ))}
                </div>
                <Button
                  size="sm"
                  onClick={mandar}
                  disabled={enviando || texto.trim().length === 0}
                  className="gap-1.5"
                >
                  {enviando ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <SendHorizontal className="h-3.5 w-3.5" />
                  )}
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
