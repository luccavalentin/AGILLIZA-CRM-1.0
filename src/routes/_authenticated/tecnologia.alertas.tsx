import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, BellRing, History, Lock, RotateCcw, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  EstadoErro,
  EstadoVazio,
  Esqueleto,
  Painel,
  Pulso,
  diaHora,
  fmtNum,
  ha,
  type Tom,
} from "@/components/tecnologia/base";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { cn } from "@/lib/utils";
import {
  lerAlertas,
  salvarAlertas,
  type IncidenteResumo,
} from "@/lib/tecnologia/tecnologia.functions";

export const Route = createFileRoute("/_authenticated/tecnologia/alertas")({
  head: () => ({ meta: [{ title: "Alertas — Gestão de Tecnologia — Agilliza" }] }),
  component: Alertas,
});

/** Rótulo, unidade e grupo de cada limite conhecido (`alertas.limites`, migração 0171). */
const LIMITES: Record<string, { rotulo: string; unidade: string; grupo: string; ajuda?: string }> =
  {
    taxa_erro_pct: {
      rotulo: "Taxa de falha da aplicação",
      unidade: "%",
      grupo: "Aplicação",
      ajuda: "em 15 minutos",
    },
    taxa_erro_min_requisicoes: {
      rotulo: "Mínimo de requisições para avaliar",
      unidade: "req.",
      grupo: "Aplicação",
    },
    p95_ms: { rotulo: "Tempo de resposta p95", unidade: "ms", grupo: "Aplicação" },
    banco_uso_pct: { rotulo: "Pool de conexões em uso", unidade: "%", grupo: "Banco de dados" },
    transacao_presa_s: {
      rotulo: "Transação aberta há mais de",
      unidade: "s",
      grupo: "Banco de dados",
    },
    fila_parada_min: { rotulo: "Fila parada há mais de", unidade: "min", grupo: "Fila e rotinas" },
    fila_mortas_24h: {
      rotulo: "Mensagens descartadas em 24 h",
      unidade: "msg.",
      grupo: "Fila e rotinas",
    },
    disco_pct_alerta: { rotulo: "Disco — alerta", unidade: "%", grupo: "Servidor" },
    disco_pct_critico: { rotulo: "Disco — crítico", unidade: "%", grupo: "Servidor" },
    memoria_pct: { rotulo: "Memória", unidade: "%", grupo: "Servidor" },
    backup_horas: { rotulo: "Backup válido mais antigo que", unidade: "h", grupo: "Servidor" },
    certificado_dias: {
      rotulo: "Certificado vence em menos de",
      unidade: "dias",
      grupo: "Servidor",
    },
    coletor_parado_min: {
      rotulo: "Coletor sem enviar há mais de",
      unidade: "min",
      grupo: "Servidor",
    },
    webhooks_erro_1h: { rotulo: "Webhooks com erro em 1 h", unidade: "", grupo: "Fornecedores" },
    saldo_apifull_minimo: {
      rotulo: "Saldo mínimo da APIFull",
      unidade: "R$",
      grupo: "Fornecedores",
    },
    consulta_sem_entrega_min: {
      rotulo: "Consulta paga sem entrega há",
      unidade: "min",
      grupo: "Fornecedores",
    },
    envio_bancario_erros_1h: {
      rotulo: "Falhas de envio ao banco em 1 h",
      unidade: "",
      grupo: "Fornecedores",
    },
  };
const ORDEM_GRUPOS = [
  "Aplicação",
  "Banco de dados",
  "Fila e rotinas",
  "Servidor",
  "Fornecedores",
  "Outros",
];

const SEVERIDADE: Record<IncidenteResumo["severidade"], { rotulo: string; tom: Tom }> = {
  critica: { rotulo: "Crítica", tom: "critico" },
  alta: { rotulo: "Alta", tom: "critico" },
  aviso: { rotulo: "Aviso", tom: "atencao" },
  info: { rotulo: "Informação", tom: "neutro" },
};
const STATUS: Record<IncidenteResumo["status"], string> = {
  aberto: "Aberto",
  reconhecido: "Em tratamento",
  resolvido: "Resolvido",
};

function Alertas() {
  const lerFn = useServerFn(lerAlertas);
  const salvarFn = useServerFn(salvarAlertas);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["tecnologia", "alertas"],
    queryFn: () => lerFn(),
    refetchInterval: 30_000,
  });
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const podeEditar =
    usePermissao("saas.tecnologia", "edit") && Boolean(q.data?.limites?.pode_editar);
  const valores = useMemo(() => q.data?.limites?.valores ?? {}, [q.data]);

  const grupos = useMemo(() => {
    const g = new Map<string, string[]>();
    for (const k of Object.keys(valores)) {
      const grupo = LIMITES[k]?.grupo ?? "Outros";
      g.set(grupo, [...(g.get(grupo) ?? []), k]);
    }
    return ORDEM_GRUPOS.filter((x) => g.has(x)).map((x) => [x, g.get(x)!] as const);
  }, [valores]);

  const alterados = Object.entries(rascunho).filter(
    ([k, v]) => v !== "" && Number(v) !== valores[k],
  );
  const invalido = alterados.some(([k, v]) => {
    const n = Number(v);
    return !Number.isFinite(n) || n < 0 || (k.includes("_pct") && n > 100);
  });

  const m = useMutation({
    mutationFn: () =>
      salvarFn({
        data: { valores: Object.fromEntries(alterados.map(([k, v]) => [k, Number(v)])) },
      }),
    onSuccess: () => {
      toast.success("Limites salvos. Valem na próxima avaliação (a cada minuto).");
      setRascunho({});
      void qc.invalidateQueries({ queryKey: ["tecnologia", "alertas"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar os limites.")),
  });

  return (
    <div className="space-y-5 pb-24 md:space-y-6 md:pb-0">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">
          Os limites que abrem incidentes sozinhos (e os resolvem quando o sinal volta ao normal).
        </p>
      </div>

      {q.isError && (
        <EstadoErro
          erro={q.error}
          alternativa="Não foi possível ler os alertas."
          onTentar={() => q.refetch()}
        />
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Painel
          titulo="Limites dos alertas"
          icone={<BellRing className="size-4" />}
          descricao={
            q.data?.limites?.atualizado_em
              ? `Alterados ${ha(q.data.limites.atualizado_em)}${q.data.limites.atualizado_por ? ` por ${q.data.limites.atualizado_por}` : ""}.`
              : undefined
          }
          acoes={
            !podeEditar && !q.isLoading ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Lock className="size-3" /> somente leitura
              </span>
            ) : null
          }
        >
          {q.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Esqueleto key={i} className="h-11" />
              ))}
            </div>
          ) : !grupos.length ? (
            <EstadoVazio titulo="Limites não configurados" />
          ) : (
            <div className="space-y-5">
              {grupos.map(([grupo, chaves]) => (
                <fieldset key={grupo} className="min-w-0">
                  <legend className="mb-1 text-xs font-semibold text-foreground">{grupo}</legend>
                  <ul className="divide-y divide-border">
                    {chaves.map((k) => {
                      const def = LIMITES[k];
                      const atual = valores[k];
                      const v = rascunho[k] ?? String(atual ?? "");
                      const mudou =
                        rascunho[k] !== undefined &&
                        rascunho[k] !== "" &&
                        Number(rascunho[k]) !== atual;
                      return (
                        <li
                          key={k}
                          className="flex min-h-14 items-center justify-between gap-3 py-2"
                        >
                          <label htmlFor={`lim-${k}`} className="min-w-0 text-sm">
                            <span className="block leading-snug text-foreground">
                              {def?.rotulo ?? k}
                            </span>
                            <span className="block break-all text-[11px] text-muted-foreground">
                              {def?.ajuda ?? <span className="font-mono">{k}</span>}
                              {mudou && <> · antes {fmtNum(atual)}</>}
                            </span>
                          </label>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <Input
                              id={`lim-${k}`}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={k.includes("_pct") ? 100 : undefined}
                              disabled={!podeEditar}
                              value={v}
                              onChange={(e) => setRascunho((r) => ({ ...r, [k]: e.target.value }))}
                              className={cn(
                                "h-11 w-[5.5rem] text-right tabular-nums sm:w-24",
                                mudou && "border-primary ring-1 ring-primary/30",
                              )}
                            />
                            <span className="w-9 text-xs text-muted-foreground">
                              {def?.unidade ?? ""}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              ))}
            </div>
          )}
          {podeEditar && alterados.length > 0 && (
            <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-2 border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:mt-4 md:border-0 md:bg-transparent md:p-0">
              <span className="text-xs text-muted-foreground">
                {alterados.length} limite(s) alterado(s)
                {invalido && <span className="text-destructive"> · valor inválido</span>}
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRascunho({})}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground"
                >
                  <RotateCcw className="size-4" /> Desfazer
                </button>
                <button
                  type="button"
                  disabled={invalido || m.isPending}
                  onClick={() => m.mutate()}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  <Save className="size-4" /> {m.isPending ? "Salvando…" : "Salvar"}
                </button>
              </span>
            </div>
          )}
        </Painel>

        <Painel
          titulo="Histórico de incidentes"
          icone={<History className="size-4" />}
          descricao={`${fmtNum(q.data?.totalIncidentes)} no total · os mais recentes`}
          acoes={
            <Link
              to="/plataforma/monitoramento"
              className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:text-foreground md:min-h-8"
            >
              Tratar <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          {q.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Esqueleto key={i} className="h-14" />
              ))}
            </div>
          ) : !q.data?.incidentes.length ? (
            <EstadoVazio
              titulo="Nenhum incidente registrado"
              texto="Quando um limite for ultrapassado, o incidente aparece aqui."
            />
          ) : (
            <ul className="divide-y divide-border">
              {q.data.incidentes.map((i) => {
                const sev = SEVERIDADE[i.severidade];
                return (
                  <li key={i.id} className="flex min-h-14 items-start gap-3 py-2.5">
                    <span className="mt-1.5">
                      <Pulso
                        tom={i.status === "resolvido" ? "ok" : sev.tom}
                        vivo={i.status !== "resolvido" && sev.tom === "critico"}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{i.titulo}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {sev.rotulo} · {i.categoria} · {STATUS[i.status]} · {fmtNum(i.ocorrencias)}×
                        · desde {diaHora(i.primeira_em)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {ha(i.ultima_em)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Painel>
      </div>
    </div>
  );
}
