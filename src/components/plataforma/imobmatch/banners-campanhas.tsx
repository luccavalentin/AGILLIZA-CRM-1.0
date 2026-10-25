/**
 * Aba "Campanhas no ar": as campanhas pela situação calculada no banco (no ar primeiro), com
 * período, praça e pacote — e pausar (com motivo) ou retomar. Pausa da plataforma o
 * patrocinador não desfaz.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Megaphone, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import {
  lerCampanhas,
  pausarBanner,
  type CampanhaBanner,
  type SituacaoCampanha,
} from "@/lib/plataforma/patrocinados.functions";
import {
  CHAVE_BANNERS,
  ROTULO_PERIODO,
  SITUACAO_CAMPANHA,
  SeloCampanha,
  praca,
} from "./banners-comum";
import { Vazio } from "./comum";

const FILTROS: (SituacaoCampanha | "todas")[] = [
  "no_ar",
  "agendada",
  "pausada",
  "em_analise",
  "aguardando_pagamento",
  "encerrada",
  "todas",
];

export function AbaCampanhas() {
  const lerFn = useServerFn(lerCampanhas);
  const [filtro, setFiltro] = useState<SituacaoCampanha | "todas">("no_ar");
  const q = useQuery({
    queryKey: [...CHAVE_BANNERS, "campanhas", filtro],
    queryFn: () => lerFn({ data: { conta: null, situacao: filtro === "todas" ? null : filtro } }),
    staleTime: 20_000,
    placeholderData: (a) => a,
  });
  const itens = q.data ?? [];

  return (
    <section className="min-w-0 rounded-xl border border-border bg-card">
      <div className="border-b border-border p-3 sm:p-4">
        <div
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label="Situação"
        >
          {FILTROS.map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={filtro === f ? "default" : "outline"}
              aria-pressed={filtro === f}
              className="shrink-0 rounded-full"
              onClick={() => setFiltro(f)}
            >
              {f === "todas" ? "Todas" : SITUACAO_CAMPANHA[f].rotulo}
            </Button>
          ))}
        </div>
      </div>
      {q.isLoading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : q.isError ? (
        <p className="m-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(q.error, "Não foi possível ler as campanhas.")}
        </p>
      ) : itens.length === 0 ? (
        <div className="p-4">
          <Vazio
            icone={<Megaphone className="size-5" aria-hidden />}
            titulo="Nenhuma campanha nesta situação"
            texto="As campanhas dos patrocinadores aparecem aqui conforme a situação: no ar, agendadas, pausadas…"
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {itens.map((c) => (
            <Campanha key={c.id} c={c} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Campanha({ c }: { c: CampanhaBanner }) {
  const podeModerar = usePermissao("saas.patrocinados", "edit");
  const qc = useQueryClient();
  const fn = useServerFn(pausarBanner);
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const pausadaPelaPlataforma = c.status === "pausada" && c.pausada_por === "plataforma";
  const podePausar = c.status === "ativa" && c.situacao !== "cancelada";
  const m = useMutation({
    mutationFn: (pausar: boolean) => fn({ data: { alvo: "campanha", id: c.id, pausar, motivo } }),
    onSuccess: (_, pausar) => {
      toast.success(pausar ? "Campanha pausada." : "Campanha retomada.");
      qc.invalidateQueries({ queryKey: CHAVE_BANNERS });
      setAberto(false);
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível mudar a campanha.")),
  });

  return (
    <li className="space-y-2 p-3 sm:p-4">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="break-words font-medium">{c.nome}</span>
            <SeloCampanha situacao={c.situacao} />
          </p>
          <p className="break-words text-xs text-muted-foreground">
            {c.patrocinador ?? "—"} · {c.espaco_nome ?? c.espaco} · {praca(c)}
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {c.inicio ? formatData(c.inicio) : "—"} a {c.fim ? formatData(c.fim) : "—"}
            {c.periodo ? ` · ${ROTULO_PERIODO[c.periodo] ?? c.periodo}` : ""}
            {c.preco != null ? ` · ${formatBRL(Number(c.preco))}` : ""} · {c.aprovados}/
            {c.criativos} criativo(s) aprovado(s)
          </p>
          {c.pausa_motivo && c.status === "pausada" && (
            <p className="mt-1 text-xs">
              <span className="font-medium">
                Pausada {c.pausada_por === "plataforma" ? "pela equipe" : "pelo patrocinador"}:
              </span>{" "}
              {c.pausa_motivo}
            </p>
          )}
        </div>
        {podeModerar &&
          (pausadaPelaPlataforma ? (
            <Button
              variant="outline"
              size="sm"
              disabled={m.isPending}
              onClick={() => m.mutate(false)}
            >
              {m.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Play className="mr-2 size-4" />
              )}
              Retomar
            </Button>
          ) : (
            podePausar && (
              <Button variant="outline" size="sm" onClick={() => setAberto((v) => !v)}>
                <Pause className="mr-2 size-4" /> Pausar
              </Button>
            )
          ))}
      </div>
      {aberto && (
        <div className="space-y-2 rounded-lg border border-amber-400/60 p-3">
          <Label htmlFor={`pausa-${c.id}`}>Motivo da pausa (obrigatório)</Label>
          <Textarea
            id={`pausa-${c.id}`}
            rows={2}
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: o site de destino está fora do ar."
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button
              disabled={motivo.trim().length < 5 || m.isPending}
              onClick={() => m.mutate(true)}
            >
              {m.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Pausar campanha
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
