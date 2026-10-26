/**
 * Prazos por etapa do kanban (C34): quantos dias parada até o alerta e até o crítico.
 * O padrão geral vem do banco; o correspondente ajusta os dele (quem edita propostas).
 */
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RotateCcw, Timer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { statusProposta } from "@/components/propostas/status";
import { definirPrazoKanban, type PrazosDoKanban } from "@/lib/propostas/kanban.functions";
import type { PropostaStatus } from "@/lib/propostas/state-machine";
import { mensagemDeErro } from "@/lib/erros/mensagem";

const ETAPAS: PropostaStatus[] = [
  "rascunho",
  "enviada_banco",
  "credito_aprovado",
  "formularios",
  "aguardando_documentos",
  "engenharia_vistoria",
  "analise_juridica",
  "contrato_emitido",
  "erro_envio",
];

type Linha = { alerta: string; critico: string };

export function PrazosKanbanDialog({
  aberto,
  onAberto,
  dados,
}: {
  aberto: boolean;
  onAberto: (v: boolean) => void;
  dados: PrazosDoKanban | undefined;
}) {
  const qc = useQueryClient();
  const salvarFn = useServerFn(definirPrazoKanban);
  const [linhas, setLinhas] = useState<Record<string, Linha>>({});
  const [salvando, setSalvando] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto || !dados) return;
    const l: Record<string, Linha> = {};
    for (const e of ETAPAS) {
      const p = dados.prazos[e];
      l[e] = { alerta: p ? String(p.dias_alerta) : "", critico: p ? String(p.dias_critico) : "" };
    }
    setLinhas(l);
  }, [aberto, dados]);

  async function salvar(etapa: PropostaStatus, voltarAoPadrao = false) {
    const l = linhas[etapa];
    const alerta = voltarAoPadrao ? null : Number(l?.alerta);
    const critico = voltarAoPadrao ? null : Number(l?.critico);
    if (!voltarAoPadrao) {
      if (!Number.isInteger(alerta) || !Number.isInteger(critico) || alerta! < 1 || critico! > 365) {
        return toast.error("Use dias inteiros de 1 a 365.");
      }
      if (alerta! >= critico!) return toast.error("O alerta vem antes do crítico.");
    }
    setSalvando(etapa);
    try {
      await salvarFn({ data: { etapa: etapa as never, dias_alerta: alerta, dias_critico: critico } });
      await qc.invalidateQueries({ queryKey: ["propostas", "kanban-prazos"] });
      toast.success(voltarAoPadrao ? "Etapa voltou ao padrão." : "Prazo salvo.");
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível salvar o prazo."));
    } finally {
      setSalvando(null);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={onAberto}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" /> Prazos por etapa
          </DialogTitle>
          <DialogDescription>
            Dias parada na etapa até o cartão ficar amarelo (alerta) e vermelho (crítico).
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-1.5 overflow-y-auto px-6 py-2">
          <div className="grid grid-cols-[minmax(0,1fr)_4.25rem_4.25rem_4.5rem] items-center gap-2 px-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Etapa</span>
            <span className="text-center">Alerta</span>
            <span className="text-center">Crítico</span>
            <span />
          </div>
          {ETAPAS.map((e) => {
            const l = linhas[e] ?? { alerta: "", critico: "" };
            const ajustada = dados?.ajustadas.includes(e);
            return (
              <div
                key={e}
                className="grid grid-cols-[minmax(0,1fr)_4.25rem_4.25rem_4.5rem] items-center gap-2 rounded-lg border border-border/60 bg-card px-2 py-1.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-foreground">
                    {statusProposta(e).label}
                  </span>
                  <span className="text-[10.5px] text-muted-foreground">
                    {ajustada ? "ajuste do correspondente" : "padrão geral"}
                  </span>
                </span>
                <Input
                  inputMode="numeric"
                  aria-label={`Dias até o alerta em ${statusProposta(e).label}`}
                  disabled={!dados?.podeEditar}
                  value={l.alerta}
                  onChange={(ev) =>
                    setLinhas((x) => ({ ...x, [e]: { ...l, alerta: ev.target.value.replace(/\D/g, "").slice(0, 3) } }))
                  }
                  className="h-8 px-2 text-center tabular-nums"
                />
                <Input
                  inputMode="numeric"
                  aria-label={`Dias até o crítico em ${statusProposta(e).label}`}
                  disabled={!dados?.podeEditar}
                  value={l.critico}
                  onChange={(ev) =>
                    setLinhas((x) => ({ ...x, [e]: { ...l, critico: ev.target.value.replace(/\D/g, "").slice(0, 3) } }))
                  }
                  className="h-8 px-2 text-center tabular-nums"
                />
                <span className="flex justify-end gap-1">
                  {dados?.podeEditar && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 px-2 text-xs"
                        disabled={salvando !== null}
                        onClick={() => salvar(e)}
                      >
                        {salvando === e ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
                      </Button>
                      {ajustada && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          aria-label="Voltar ao padrão"
                          title="Voltar ao padrão"
                          disabled={salvando !== null}
                          onClick={() => salvar(e, true)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </>
                  )}
                </span>
              </div>
            );
          })}
          {!dados?.podeEditar && (
            <p className="px-1 pt-1 text-[11.5px] text-muted-foreground">
              Só quem edita propostas ajusta os prazos.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onAberto(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
