/**
 * Desligamento guiado, na ficha: 1) tipo, aviso e datas → 2) estimativa das verbas
 * (só para quem vê salário) → 3) checklist de saída → 4) concluir (a ficha vira
 * "desligado" com a data e o motivo).
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Circle, DoorOpen, Lock, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { usePermissao } from "@/hooks/use-permissao";
import {
  atualizarDesligamento,
  cancelarDesligamento,
  concluirDesligamento,
  estimarVerbasRescisorias,
  iniciarDesligamento,
  obterDesligamento,
} from "@/lib/rh/desligamento.functions";
import {
  AVISO_LABEL,
  TIPO_DESLIGAMENTO_LABEL,
  type AvisoPrevio,
  type ItemChecklistSaida,
  type TipoDesligamento,
} from "@/lib/rh/rescisao";
import { formatBRL, formatData, hojeISO } from "@/lib/financeiro/format";
import { mensagemDeErro } from "@/lib/erros/mensagem";

export function FichaDesligamento({ funcionarioId, desligado }: { funcionarioId: string; desligado: boolean }) {
  const qc = useQueryClient();
  const podeEditar = usePermissao("rh.funcionarios", "edit");
  const podeVerSalario = usePermissao("rh.salarios", "view");
  const fnObter = useServerFn(obterDesligamento);
  const fnIniciar = useServerFn(iniciarDesligamento);
  const fnAtualizar = useServerFn(atualizarDesligamento);
  const fnEstimar = useServerFn(estimarVerbasRescisorias);
  const fnConcluir = useServerFn(concluirDesligamento);
  const fnCancelar = useServerFn(cancelarDesligamento);

  const q = useQuery({
    queryKey: ["rh-desligamento", funcionarioId],
    queryFn: () => fnObter({ data: { funcionario_id: funcionarioId } }),
  });
  const d = q.data;
  const emAndamento = d?.status === "em_andamento";

  const [form, setForm] = useState({
    tipo: "sem_justa_causa" as TipoDesligamento,
    aviso: "indenizado" as AvisoPrevio,
    data_aviso: hojeISO(),
    data_desligamento: hojeISO(),
    motivo: "",
  });
  useEffect(() => {
    if (d)
      setForm({
        tipo: d.tipo,
        aviso: d.aviso,
        data_aviso: d.data_aviso ?? "",
        data_desligamento: d.data_desligamento,
        motivo: d.motivo ?? "",
      });
  }, [d?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["rh-desligamento", funcionarioId] });
    qc.invalidateQueries({ queryKey: ["rh-funcionario", funcionarioId] });
    qc.invalidateQueries({ queryKey: ["rh-funcionarios"] });
    qc.invalidateQueries({ queryKey: ["rh-kpis"] });
  };

  const dados = {
    tipo: form.tipo,
    aviso: form.aviso,
    data_aviso: form.data_aviso || null,
    data_desligamento: form.data_desligamento,
    motivo: form.motivo || null,
  };
  const salvar = useMutation({
    mutationFn: async () => {
      if (d && emAndamento) await fnAtualizar({ data: { id: d.id, dados } });
      else await fnIniciar({ data: { ...dados, funcionario_id: funcionarioId } });
    },
    onSuccess: () => {
      toast.success(emAndamento ? "Desligamento atualizado." : "Desligamento iniciado. Siga o checklist de saída.");
      invalidar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar.")),
  });

  const verbas = useQuery({
    queryKey: ["rh-verbas", funcionarioId, form.tipo, form.aviso, form.data_desligamento],
    enabled: podeVerSalario && !!form.data_desligamento && (emAndamento || !desligado),
    queryFn: () =>
      fnEstimar({
        data: {
          funcionario_id: funcionarioId,
          tipo: form.tipo,
          aviso: form.aviso,
          data_desligamento: form.data_desligamento,
        },
      }),
  });

  const marcar = useMutation({
    mutationFn: async (lista: ItemChecklistSaida[]) => {
      if (!d) return;
      await fnAtualizar({ data: { id: d.id, checklist: lista } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rh-desligamento", funcionarioId] }),
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível marcar.")),
  });

  const concluir = useMutation({
    mutationFn: () => fnConcluir({ data: { id: d!.id } }),
    onSuccess: () => {
      toast.success("Desligamento concluído. A ficha agora está como desligada.");
      invalidar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível concluir.")),
  });

  const checklist = (d?.checklist ?? []) as ItemChecklistSaida[];
  const feitos = checklist.filter((i) => i.feito).length;
  const bloqueado = !podeEditar || (!!d && !emAndamento) || (desligado && !emAndamento);

  if (d?.status === "concluido" || (desligado && !emAndamento)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <UserX className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">Colaborador desligado</p>
          {d && (
            <p className="text-sm text-muted-foreground">
              {TIPO_DESLIGAMENTO_LABEL[d.tipo]} · em {formatData(d.data_desligamento)} · aviso{" "}
              {AVISO_LABEL[d.aviso].toLowerCase()}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DoorOpen className="h-4 w-4 text-primary" /> {emAndamento ? "Desligamento em andamento" : "Iniciar desligamento"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            O cadastro só passa a "desligado" quando você concluir, no dia do desligamento ou depois.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tipo</Label>
            <Select value={form.tipo} disabled={bloqueado} onValueChange={(v) => setForm((p) => ({ ...p, tipo: v as TipoDesligamento }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_DESLIGAMENTO_LABEL) as TipoDesligamento[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_DESLIGAMENTO_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Aviso prévio</Label>
            <Select value={form.aviso} disabled={bloqueado} onValueChange={(v) => setForm((p) => ({ ...p, aviso: v as AvisoPrevio }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(AVISO_LABEL) as AvisoPrevio[]).map((a) => (
                  <SelectItem key={a} value={a}>
                    {AVISO_LABEL[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data do aviso</Label>
            <Input type="date" disabled={bloqueado} value={form.data_aviso} onChange={(e) => setForm((p) => ({ ...p, data_aviso: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Último dia (desligamento)</Label>
            <Input type="date" disabled={bloqueado} value={form.data_desligamento} onChange={(e) => setForm((p) => ({ ...p, data_desligamento: e.target.value }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Motivo / observações</Label>
            <Textarea rows={2} maxLength={1000} disabled={bloqueado} value={form.motivo} onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))} />
          </div>
          {podeEditar && (
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !form.data_desligamento}>
                {emAndamento ? "Salvar alterações" : "Iniciar desligamento"}
              </Button>
              {emAndamento && (
                <ConfirmDelete
                  titulo="Cancelar o desligamento?"
                  descricao="O processo é arquivado e o colaborador continua ativo."
                  confirmarLabel="Cancelar desligamento"
                  onConfirm={async () => {
                    await fnCancelar({ data: { id: d!.id } });
                    invalidar();
                  }}
                  trigger={<Button variant="outline">Cancelar processo</Button>}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Estimativa das verbas</CardTitle>
            <p className="text-xs text-muted-foreground">
              Referência para conferir com o contador (sem INSS/IRRF). Multa do FGTS é depósito na conta vinculada.
            </p>
          </CardHeader>
          <CardContent>
            {!podeVerSalario ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" /> Precisa de RH · Salários · ver.
              </p>
            ) : verbas.isLoading ? (
              <p className="text-sm text-muted-foreground">Calculando…</p>
            ) : verbas.isError ? (
              <p className="text-sm text-destructive">{mensagemDeErro(verbas.error, "Não foi possível estimar.")}</p>
            ) : verbas.data ? (
              <div className="space-y-2">
                <ul className="space-y-1 text-sm">
                  {verbas.data.linhas.map((l) => (
                    <li key={l.codigo} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">
                        {l.descricao} <span className="text-[11px] text-muted-foreground">{l.referencia}</span>
                      </span>
                      <span className={`shrink-0 tabular-nums ${l.natureza === "desconto" ? "text-destructive" : l.natureza === "informativo" ? "text-muted-foreground" : ""}`}>
                        {l.natureza === "desconto" ? "−" : ""}
                        {formatBRL(l.valor)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between border-t border-border/60 pt-2 text-sm font-semibold">
                  <span>Líquido estimado</span>
                  <span className="tabular-nums text-primary">{formatBRL(verbas.data.liquido_estimado)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Aviso de {verbas.data.aviso_dias} dias · projeção até {formatData(verbas.data.data_projetada)} ·{" "}
                  {verbas.data.ferias_vencidas_dias} dia(s) de férias adquiridas e não gozadas
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Checklist de saída {emAndamento ? `· ${feitos}/${checklist.length}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!emAndamento ? (
              <p className="text-sm text-muted-foreground">Inicie o desligamento para liberar o checklist.</p>
            ) : (
              <div className="space-y-3">
                <ul className="space-y-1.5">
                  {checklist.map((item, i) => (
                    <li key={item.chave}>
                      <button
                        type="button"
                        disabled={!podeEditar || marcar.isPending}
                        onClick={() =>
                          marcar.mutate(
                            checklist.map((x, j) =>
                              j === i ? { ...x, feito: !x.feito, feito_em: !x.feito ? new Date().toISOString() : null } : x,
                            ),
                          )
                        }
                        className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted/60 disabled:opacity-60"
                      >
                        {item.feito ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className={item.feito ? "text-muted-foreground line-through" : ""}>{item.rotulo}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {podeEditar && (
                  <ConfirmDelete
                    titulo="Concluir o desligamento?"
                    descricao={
                      feitos < checklist.length
                        ? `Ainda há ${checklist.length - feitos} item(ns) do checklist em aberto. A ficha passa a "desligado" em ${formatData(form.data_desligamento)}.`
                        : `A ficha passa a "desligado" em ${formatData(form.data_desligamento)}.`
                    }
                    confirmarLabel="Concluir"
                    onConfirm={async () => {
                      await concluir.mutateAsync();
                    }}
                    trigger={
                      <Button className="w-full" disabled={concluir.isPending}>
                        <UserX className="mr-1.5 h-4 w-4" /> Concluir desligamento
                      </Button>
                    }
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
