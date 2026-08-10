import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Send,
  Ban,
  Loader2,
  Download,
  RefreshCw,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  cancelarProposta,
  moverStatusProposta,
  sincronizarProposta,
} from "@/lib/propostas/propostas.functions";
import { useEnviarProposta } from "@/hooks/use-enviar-proposta";
import { descreverParticipante } from "@/lib/propostas/campos-obrigatorios";
import { bancoJaEnviado } from "@/components/proposta/status-bancos-proposta";
import { TRANSICOES, type PropostaStatus } from "@/lib/propostas/state-machine";
import { statusProposta } from "@/components/propostas/status";
import {
  baixarPropostaDetalhadaPDF,
  baixarPropostaConsolidadoPDF,
} from "@/lib/propostas/pdf-lazy";
import { cn } from "@/lib/utils";

export function AcoesTopo({
  proposta,
  propostaId,
  bancos,
  envolvidos,
  documentos,
  followups,
  onCadastroIncompleto,
}: {
  proposta: any;
  propostaId: string;
  bancos: any[];
  envolvidos?: any[];
  documentos?: any[];
  followups?: any[];
  onCadastroIncompleto?: () => void;
}) {
  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const { enviar: handleEnviar, busy: enviarBusy } = useEnviarProposta();
  const cancelarFn = useServerFn(cancelarProposta);
  const moverFn = useServerFn(moverStatusProposta);
  const sincronizarFn = useServerFn(sincronizarProposta);
  
  const [busy, setBusy] = useState(false);
  const isBusy = busy || enviarBusy;

  const status = proposta.status as PropostaStatus;
  const proximos = (status && TRANSICOES[status] ? TRANSICOES[status] : []).filter((s) => s !== "cancelada");

  const pendencias = useMemo(() => {
    const { faltantesEnvolvido } = require("@/lib/propostas/campos-obrigatorios");
    return (envolvidos ?? []).map(env => ({
      env,
      faltantes: faltantesEnvolvido(env || {}),
      descrever: descreverParticipante(env || {})
    })).filter(p => p.faltantes && p.faltantes.length > 0);
  }, [envolvidos]);

  const bloqueado = pendencias.length > 0;

  async function enviar() {
    if (jaEnviou && bancosPendentes.length === 0) {
      toast.info("Nenhum banco novo selecionado. Selecione outro banco para enviar.");
      return;
    }

    try {
      await handleEnviar({
        propostaId,
        bancoId: "todos",
        envolvidos,
        onCadastroIncompleto: () => onCadastroIncompleto?.()
      });
    } catch (e) {
      // toast já mostrado pelo hook
    }
  }

  async function sincronizar() {
    setBusy(true);
    try {
      const r = await sincronizarFn({ data: { proposta_id: propostaId } });
      toast.success(
        r.atualizado
          ? `Situação atualizada${r.etapa ? `: ${r.etapa}` : ""}.`
          : "Nenhuma novidade do banco.",
      );
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao consultar o banco.");
    } finally {
      setBusy(false);
    }
  }

  async function mover(novo: string) {
    setBusy(true);
    try {
      await moverFn({ data: { proposta_id: propostaId, novo_status: novo } });
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transição inválida.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelar() {
    if (motivo.trim().length < 5) {
      toast.error("Informe um motivo com pelo menos 5 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await cancelarFn({ data: { proposta_id: propostaId, motivo } });
      toast.success("Proposta cancelada.");
      setCancelOpen(false);
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao cancelar.");
    } finally {
      setBusy(false);
    }
  }

  const bancosPendentes = (bancos ?? []).filter(
    (b: any) => b.selecionado && !bancoJaEnviado(b),
  );
  const jaEnviou = Boolean(proposta.enviada_em);
  const podeEnviarNovos =
    jaEnviou &&
    bancosPendentes.length > 0 &&
    !["cancelada", "registrado", "credito_recusado", "contrato_emitido"].includes(status);

  const temDecisao = proximos.length > 0 || (status !== "cancelada" && status !== "registrado");

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
      <div className="flex flex-wrap items-center gap-2">
        {(status === "rascunho" || status === "erro_envio") && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button size="sm" onClick={enviar} disabled={isBusy}>
                    {isBusy ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-1 h-4 w-4" />
                    )}
                    {bloqueado ? "Completar cadastro e enviar" : (proposta.enviada_em ? "Reenviar" : "Enviar ao banco")}
                  </Button>
                </span>
              </TooltipTrigger>
              {bloqueado && (
                <TooltipContent className="max-w-xs space-y-2">
                  <p className="font-semibold text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Dados incompletos
                  </p>
                  <ul className="text-xs space-y-1">
                    {pendencias.map((p, i) => (
                      <li key={i}>• Faltam dados obrigatórios de {p.descrever}. Clique para preencher agora.</li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">Clique para abrir o cadastro.</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )}
        {podeEnviarNovos && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button size="sm" onClick={enviar} disabled={isBusy} variant="secondary">
                    {isBusy ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-1 h-4 w-4" />
                    )}
                    {bloqueado ? "Completar cadastro e enviar" : `Enviar a ${bancosPendentes.length > 1 ? `${bancosPendentes.length} novos bancos` : "novo banco"}`}
                  </Button>
                </span>
              </TooltipTrigger>
              {bloqueado && (
                <TooltipContent className="max-w-xs space-y-2">
                  <p className="font-semibold text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Dados incompletos
                  </p>
                  <ul className="text-xs space-y-1">
                    {pendencias.map((p, i) => (
                      <li key={i}>• {descreverParticipante(p.env)}</li>
                    ))}
                  </ul>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )}
        {proposta.homefin_id_oportunidade && status !== "cancelada" && (
          <Button size="sm" variant="outline" onClick={sincronizar} disabled={busy}>
            {busy ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-4 w-4" />
            )}
            Atualizar status
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary">
              <Download className="mr-1 h-4 w-4" /> Baixar PDF
              <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Documentos da proposta</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                const gerar = async () => {
                  const t = toast.loading("Gerando ficha da proposta…");
                  try {
                    const { baixarPropostaOficialPDF } = await import(
                      "@/lib/propostas/proposta-oficial-pdf"
                    );
                    await new Promise((r) => setTimeout(r, 30));
                    baixarPropostaOficialPDF({
                      proposta,
                      bancos: bancos ?? [],
                      envolvidos: envolvidos ?? [],
                      documentos: documentos ?? [],
                      followups: followups ?? [],
                    });
                    toast.success("Ficha da proposta gerada.", { id: t });
                  } catch (err) {
                    console.error("Falha ao gerar ficha da proposta", err);
                    toast.error(
                      err instanceof Error ? err.message : "Falha ao gerar a ficha da proposta.",
                      { id: t },
                    );
                  }
                };
                void gerar();
              }}
            >
              Ficha da proposta (cadastro, checklist, etapas)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Extrato para o cliente</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                const gerar = async () => {
                  const t = toast.loading("Gerando cronograma detalhado…");
                  try {
                    await new Promise((r) => setTimeout(r, 30));
                    baixarPropostaDetalhadaPDF({ proposta, bancos });
                    toast.success("Cronograma gerado.", { id: t });
                  } catch (err) {
                    console.error(err);
                    toast.error(
                      err instanceof Error ? err.message : "Falha ao gerar o cronograma.",
                      { id: t },
                    );
                  }
                };
                void gerar();
              }}
              disabled={(bancos ?? []).length === 0}
            >
              Cronograma detalhado (todas as parcelas)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                const gerar = async () => {
                  const t = toast.loading("Gerando comparativo consolidado…");
                  try {
                    await new Promise((r) => setTimeout(r, 30));
                    baixarPropostaConsolidadoPDF({ proposta, bancos });
                    toast.success("Comparativo gerado.", { id: t });
                  } catch (err) {
                    console.error(err);
                    toast.error(
                      err instanceof Error ? err.message : "Falha ao gerar o comparativo.",
                      { id: t },
                    );
                  }
                };
                void gerar();
              }}
              disabled={(bancos ?? []).length === 0}
            >
              Comparativo consolidado
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {temDecisao && (
        <div className="flex flex-wrap items-center gap-2 sm:border-l sm:border-border sm:pl-2">
          {proximos.map((s) => {
            const tone = statusProposta(s).tone;
            const isRecusa = s === "credito_recusado";
            const isAprova = s === "credito_aprovado";
            return (
              <Button
                key={s}
                size="sm"
                variant={isRecusa ? "destructive" : "secondary"}
                onClick={() => mover(s)}
                disabled={busy}
                className={cn(
                  isAprova && "bg-success text-success-foreground hover:bg-success/90",
                )}
              >
                {isRecusa ? "✕" : "→"} {statusProposta(s).label}
              </Button>
            );
          })}
          {status !== "cancelada" && status !== "registrado" && (
            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="destructive">
                  <Ban className="mr-1 h-4 w-4" /> Cancelar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancelar proposta</DialogTitle>
                </DialogHeader>
                <Label>Motivo do cancelamento</Label>
                <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCancelOpen(false)}>
                    Voltar
                  </Button>
                  <Button variant="destructive" onClick={cancelar} disabled={busy}>
                    Confirmar cancelamento
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </div>
  );
}
