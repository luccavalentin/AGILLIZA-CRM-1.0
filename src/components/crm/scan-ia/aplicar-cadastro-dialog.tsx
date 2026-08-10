import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { previaAplicacao, aplicarAoCadastro } from "@/lib/crm/scan-ia.functions";
import { CONFIANCA_LABEL } from "@/lib/crm/scan-ia-tipos";

type Escolha = "manter" | "substituir";

const TOM_FAIXA: Record<string, string> = {
  alta: "border-success/40 bg-success/5",
  media: "border-warning/40 bg-warning/5",
  revisar: "border-destructive/60 bg-destructive/5",
};

export function AplicarCadastroDialog({
  leituraId,
  aberto,
  onOpenChange,
}: {
  leituraId: string;
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});

  const previa = useQuery({
    queryKey: ["scan-ia-previa", leituraId],
    queryFn: () => previaAplicacao({ data: { leitura_id: leituraId } }),
    enabled: aberto,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!previa.data) return;
    const m: Record<string, boolean> = {};
    for (const c of previa.data.campos) {
      // Baixa confiança nunca vem marcada; conflito nunca vem pré-decidido.
      m[c.campo_id] = c.aplicavel && !c.conflito && c.faixa !== "revisar";
    }
    setMarcados(m);
    setEscolhas({});
  }, [previa.data]);

  const conflitosPendentes = useMemo(() => {
    if (!previa.data) return 0;
    return previa.data.campos.filter(
      (c) => c.aplicavel && c.conflito && !escolhas[c.campo_id],
    ).length;
  }, [previa.data, escolhas]);

  const aplicar = useMutation({
    mutationFn: () =>
      aplicarAoCadastro({
        data: {
          leitura_id: leituraId,
          decisoes: (previa.data?.campos ?? []).map((c) => ({
            campo_id: c.campo_id,
            aplicar: c.conflito
              ? escolhas[c.campo_id] === "substituir"
              : !!marcados[c.campo_id],
            escolha: c.conflito ? escolhas[c.campo_id] : undefined,
          })),
        },
      }),
    onSuccess: (r) => {
      toast.success(
        r.arquivado
          ? `${r.aplicados} campo(s) aplicados e documento arquivado na aba Documentos do cliente.`
          : `${r.aplicados} campo(s) aplicados ao cadastro.`,
      );
      if (!r.arquivado && r.erro_arquivo) {
        toast.warning(`Não foi possível arquivar o documento: ${r.erro_arquivo}`);
      }
      qc.invalidateQueries({ queryKey: ["scan-ia-leitura", leituraId] });
      qc.invalidateQueries({ queryKey: ["scan-ia-leituras"] });
      qc.invalidateQueries({ queryKey: ["scan-ia-previa", leituraId] });
      qc.invalidateQueries({ queryKey: ["cliente-docs"] });
      onOpenChange(false);
      // Depois de aplicar, leva o operador direto ao cadastro do cliente no CRM.
      const clienteId = previa.data?.cliente_id;
      if (clienteId) {
        navigate({ to: "/crm/clientes/$id", params: { id: clienteId } });
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao aplicar."),
  });

  const nenhumMarcado =
    (previa.data?.campos ?? []).every(
      (c) => !marcados[c.campo_id] && escolhas[c.campo_id] !== "substituir",
    ) && (previa.data?.campos.length ?? 0) > 0;

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Aplicar ao cadastro</DialogTitle>
          <DialogDescription>
            Revise cada campo. Nada é gravado sem a sua confirmação — a IA apenas sugere.
          </DialogDescription>
        </DialogHeader>

        {previa.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !previa.data ? (
          <p className="text-sm text-destructive">Não foi possível carregar a prévia.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
              Aplicando em <strong className="text-foreground">{previa.data.cliente_nome ?? "—"}</strong>.
              Campos de baixa confiança começam desmarcados e conflitos exigem escolha manual.
            </div>

            {previa.data.campos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum campo extraído nesta leitura.</p>
            ) : (
              previa.data.campos.map((c) => (
                <div
                  key={c.campo_id}
                  className={`rounded-lg border p-3 ${c.conflito ? "border-warning bg-warning/5" : (TOM_FAIXA[c.faixa] ?? "")}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{c.rotulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {CONFIANCA_LABEL[c.faixa]} · {Math.round(c.confianca * 100)}%
                      </p>
                    </div>
                    {!c.aplicavel ? (
                      <Badge variant="outline">Sem destino no cadastro</Badge>
                    ) : c.conflito ? (
                      <Badge variant="secondary" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> Conflito
                      </Badge>
                    ) : (
                      <Checkbox
                        checked={!!marcados[c.campo_id]}
                        onCheckedChange={(v) =>
                          setMarcados((m) => ({ ...m, [c.campo_id]: v === true }))
                        }
                        aria-label={`Aplicar ${c.rotulo}`}
                      />
                    )}
                  </div>

                  {c.conflito ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setEscolhas((e) => ({ ...e, [c.campo_id]: "manter" }))}
                        className={`rounded-md border p-2 text-left text-xs transition-colors ${
                          escolhas[c.campo_id] === "manter"
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary"
                        }`}
                      >
                        <span className="block font-semibold">Manter valor atual</span>
                        <span className="block break-words text-muted-foreground">
                          {c.valor_atual}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEscolhas((e) => ({ ...e, [c.campo_id]: "substituir" }))}
                        className={`rounded-md border p-2 text-left text-xs transition-colors ${
                          escolhas[c.campo_id] === "substituir"
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary"
                        }`}
                      >
                        <span className="block font-semibold">Substituir pelo documento</span>
                        <span className="block break-words text-muted-foreground">{c.valor}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1 text-xs">
                      <p className="break-words">
                        <span className="text-muted-foreground">Valor do documento: </span>
                        <span className="font-medium">{c.valor}</span>
                      </p>
                      {c.valor_atual ? (
                        <p className="break-words text-muted-foreground">
                          Valor atual no cadastro: {c.valor_atual}
                        </p>
                      ) : null}
                      {!c.aplicavel && c.motivo_nao_aplicavel ? (
                        <p className="text-muted-foreground">{c.motivo_nao_aplicavel}</p>
                      ) : null}
                      {c.faixa === "revisar" && c.aplicavel ? (
                        <p className="font-medium text-destructive">
                          Confira este campo com atenção — a IA teve baixa certeza.
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {conflitosPendentes > 0
              ? `${conflitosPendentes} conflito(s) aguardando sua escolha.`
              : "Todas as decisões foram tomadas."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                aplicar.isPending ||
                previa.isLoading ||
                conflitosPendentes > 0 ||
                nenhumMarcado ||
                (previa.data?.campos.length ?? 0) === 0
              }
              onClick={() => aplicar.mutate()}
            >
              Confirmar e aplicar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
