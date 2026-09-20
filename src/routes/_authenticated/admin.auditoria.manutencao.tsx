import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminHero } from "@/components/admin/admin-hero";
import { Wrench, AlertCircle, CheckCircle2, Loader2, Info, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  obterSumarioDestravamento,
  destravarSimulacoes,
  obterSaudeSistema,
} from "@/lib/admin/manutencao.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/auditoria/manutencao")({
  head: () => ({ meta: [{ title: "Manutenção do Sistema — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.parametros"),
  component: PaginaManutencao,
});

function PaginaManutencao() {
  const qc = useQueryClient();
  const { data: sumario, isLoading } = useQuery({
    queryKey: ["admin-manutencao-sumario"],
    queryFn: () => obterSumarioDestravamento(),
    refetchInterval: 30000,
  });

  const { data: saude, isLoading: carregandoSaude } = useQuery({
    queryKey: ["admin-saude-sistema"],
    queryFn: () => obterSaudeSistema(),
    refetchInterval: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (confirm: boolean) => destravarSimulacoes({ data: { confirm } }),
    onSuccess: (res) => {
      toast.success("Operação concluída com sucesso.");
      qc.invalidateQueries({ queryKey: ["admin-manutencao-sumario"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao processar.");
    },
  });

  const temAlgo =
    (sumario?.locksVencidos || 0) > 0 ||
    (sumario?.presasComId || 0) > 0 ||
    (sumario?.presasSemId || 0) > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <AdminHero
        icon={<Wrench className="h-5 w-5" />}
        titulo="Manutenção do Sistema"
        descricao="Ferramentas administrativas para correção de estados e limpeza de dados órfãos."
        acoes={
          <Link to={"/admin/auditoria" as any}>
            <Button variant="ghost" size="sm">
              Voltar para Auditoria
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6">
        {/*
          Painel de sinais vitais: até 19/09/2026 não existia nada que dissesse
          "isto está parado". O relatório somou errado por meses sem ninguém
          perceber; estes números são os que teriam denunciado.
        */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Saúde do sistema
            </CardTitle>
            <CardDescription>
              Agendadores, envios presos e tamanho do banco. Atualiza a cada minuto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {carregandoSaude || !saude ? (
              <p className="text-sm text-muted-foreground">Medindo…</p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Sinal
                    rotulo="Simulações presas (30 min)"
                    valor={saude.simulacoes_presas}
                    ruimAcimaDe={0}
                  />
                  <Sinal rotulo="Locks vencidos" valor={saude.locks_vencidos} ruimAcimaDe={0} />
                  <Sinal
                    rotulo="Bancos sem retorno (24 h)"
                    valor={saude.bancos_sem_retorno_24h}
                    ruimAcimaDe={0}
                  />
                  <Sinal
                    rotulo="Propostas sem sincronizar (2 h)"
                    valor={saude.propostas_sem_sincronizar_2h}
                    ruimAcimaDe={0}
                  />
                  <Sinal rotulo="Falhas HTTP (1 h)" valor={saude.http_falhas_1h} ruimAcimaDe={0} />
                  <Sinal
                    rotulo="Banco de dados"
                    valor={`${saude.banco_mb} MB`}
                    detalhe={`${saude.logs_mb} MB são logs da HomeFin`}
                  />
                </div>

                <div className="rounded-lg border border-border">
                  <p className="border-b border-border px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                    Agendadores
                  </p>
                  <ul className="divide-y divide-border">
                    {saude.agendadores.map((a) => {
                      const atrasado = a.minutos_atras == null || a.minutos_atras > 90;
                      return (
                        <li
                          key={a.nome}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          <span className="text-foreground">{a.nome}</span>
                          <span
                            className={cn(
                              "tabular-nums",
                              atrasado ? "text-destructive" : "text-muted-foreground",
                            )}
                          >
                            {a.minutos_atras == null
                              ? "nunca rodou"
                              : a.minutos_atras < 1
                                ? "agora há pouco"
                                : `há ${a.minutos_atras} min`}
                            {a.falhas_24h > 0 && ` · ${a.falhas_24h} falha(s) em 24 h`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Destravar Simulações
            </CardTitle>
            <CardDescription>
              Libera locks expirados e reprocessa simulações que ficaram presas no estado
              "Enviando".
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-4 text-center">
                <p className="text-2xl font-bold">{isLoading ? "..." : sumario?.locksVencidos}</p>
                <p className="text-xs text-muted-foreground uppercase font-medium">
                  Locks Vencidos
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 text-center">
                <p className="text-2xl font-bold">{isLoading ? "..." : sumario?.presasComId}</p>
                <p className="text-xs text-muted-foreground uppercase font-medium">
                  Com ID HomeFin
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 text-center">
                <p className="text-2xl font-bold">{isLoading ? "..." : sumario?.presasSemId}</p>
                <p className="text-xs text-muted-foreground uppercase font-medium">
                  Nunca Enviadas
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <Info className="h-4 w-4" />O que será feito:
              </div>
              <ul className="list-disc list-inside space-y-1 opacity-90">
                <li>Locks com mais de 2 minutos serão removidos.</li>
                <li>Simulações com ID HomeFin presas há 30min serão reconsultadas na API.</li>
                <li>Simulações que nunca chegaram à HomeFin (30min+) serão marcadas com erro.</li>
                <li>
                  Registros criados nos últimos 30 minutos <strong>não serão afetados</strong>.
                </li>
              </ul>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => mutation.mutate(true)}
                disabled={!temAlgo || mutation.isPending}
                className="gap-2"
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wrench className="h-4 w-4" />
                )}
                Executar Limpeza
              </Button>
            </div>

            {mutation.isSuccess && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 p-3 rounded-md border border-emerald-100">
                <CheckCircle2 className="h-4 w-4" />
                Última execução concluída. {mutation.data?.locksLiberados} locks e{" "}
                {mutation.data?.simulacoesReconsultadas + mutation.data?.simulacoesEncerradas}{" "}
                simulações processadas.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Um número da saúde do sistema, vermelho quando passa do aceitável. */
function Sinal({
  rotulo,
  valor,
  detalhe,
  ruimAcimaDe,
}: {
  rotulo: string;
  valor: number | string;
  detalhe?: string;
  ruimAcimaDe?: number;
}) {
  const ruim = ruimAcimaDe != null && typeof valor === "number" && valor > ruimAcimaDe;
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p
        className={cn(
          "text-2xl font-bold tabular-nums",
          ruim ? "text-destructive" : "text-foreground",
        )}
      >
        {valor}
      </p>
      <p className="mt-0.5 line-clamp-2 break-words text-xs font-medium leading-snug text-muted-foreground">
        {rotulo}
      </p>
      {detalhe && <p className="text-[11px] text-muted-foreground/80">{detalhe}</p>}
    </div>
  );
}
