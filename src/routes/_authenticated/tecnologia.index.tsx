import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowRight,
  Bug,
  Clock,
  Cpu,
  Gauge,
  HardDrive,
  Inbox,
  Wallet,
  ShieldCheck,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import {
  COR,
  EstadoErro,
  EstadoVazio,
  Esqueleto,
  Kpi,
  Painel,
  Pulso,
  SeloAoVivo,
  fmtMs,
  fmtNum,
  fmtNum1,
  fmtPct,
  fmtReais,
  ha,
  hora,
  type Tom,
} from "@/components/tecnologia/base";
import { GraficoSerie, Legenda } from "@/components/tecnologia/grafico-serie";
import { MarcaServico } from "@/components/tecnologia/marcas";
import { lerVisaoGeral, type Sonda } from "@/lib/tecnologia/tecnologia.functions";

export const Route = createFileRoute("/_authenticated/tecnologia/")({
  head: () => ({ meta: [{ title: "Visão geral — Gestão de Tecnologia — Agilliza" }] }),
  component: VisaoGeral,
});

const INTERVALO_S = 12;

function VisaoGeral() {
  const lerFn = useServerFn(lerVisaoGeral);
  const q = useQuery({
    queryKey: ["tecnologia", "visao-geral"],
    queryFn: () => lerFn(),
    refetchInterval: INTERVALO_S * 1000,
    placeholderData: (a) => a,
  });
  const r = q.data?.resumo;
  const serie = q.data?.serie ?? [];
  const carregando = q.isLoading;

  const taxa = r?.requisicoes_15min.taxa_falha ?? null;
  const p95 = r?.requisicoes_15min.p95_ms ?? null;
  const host = r?.coletas.host;
  const worker = r?.coletas.worker;
  const apifull = r?.coletas.apifull;
  const disco = Math.max(0, ...(host?.dados.discos ?? []).map((d) => d.uso_pct ?? 0));
  const workerParado =
    !worker?.coletado_em || Date.now() - new Date(worker.coletado_em).getTime() > 10 * 60_000;

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Visão geral ao vivo</h2>
          <p className="text-xs text-muted-foreground">
            Saúde dos dois sistemas, tráfego, erros e filas — atualiza sozinho.
          </p>
        </div>
        <SeloAoVivo
          atualizadoEm={q.dataUpdatedAt || null}
          atualizando={q.isFetching}
          falhou={q.isError}
          intervaloS={INTERVALO_S}
          onAtualizar={() => q.refetch()}
        />
      </div>

      {q.isError && !q.data && (
        <EstadoErro
          erro={q.error}
          alternativa="Não foi possível ler a visão geral."
          onTentar={() => q.refetch()}
        />
      )}

      {/* Saúde dos sistemas */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(q.data?.sondas ?? [null, null]).map((s, i) => (
          <CartaoSistema key={s?.sistema ?? i} sonda={s} falhou={q.isError} />
        ))}
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          rotulo="Requisições por minuto"
          icone={<Zap className="size-4" />}
          carregando={carregando}
          valor={fmtNum1(r?.requisicoes_5min.por_minuto)}
          rodape={`${fmtNum(r?.requisicoes_5min.total)} nos últimos 5 min`}
        />
        <Kpi
          rotulo="Taxa de falha (15 min)"
          icone={<AlertTriangle className="size-4" />}
          carregando={carregando}
          tom={taxa == null ? "neutro" : taxa >= 5 ? "critico" : taxa >= 1 ? "atencao" : "ok"}
          valor={fmtNum1(taxa)}
          unidade={taxa == null ? undefined : "%"}
          rodape={`${fmtNum(r?.requisicoes_15min.falhas)} falha(s) de ${fmtNum(r?.requisicoes_15min.total)}`}
        />
        <Kpi
          rotulo="Tempo de resposta p95"
          icone={<Gauge className="size-4" />}
          carregando={carregando}
          tom={p95 == null ? "neutro" : p95 >= 3000 ? "critico" : p95 >= 1500 ? "atencao" : "ok"}
          valor={p95 == null ? "—" : p95 >= 1000 ? fmtNum1(p95 / 1000) : fmtNum(p95)}
          unidade={p95 == null ? undefined : p95 >= 1000 ? "s" : "ms"}
          rodape="95% das respostas abaixo disso"
        />
        <Kpi
          rotulo="Usuários online"
          icone={<Users className="size-4" />}
          carregando={carregando}
          valor={fmtNum(r?.online_agora)}
          rodape={
            <Link
              to="/tecnologia/usuarios"
              className="-my-3.5 inline-flex items-center gap-1 py-3.5 hover:text-foreground"
            >
              por estado e perfil <ArrowRight className="size-3" />
            </Link>
          }
        />
        <Kpi
          rotulo="Incidentes abertos"
          icone={<ShieldCheck className="size-4" />}
          carregando={carregando}
          tom={
            (r?.incidentes.criticos ?? 0) > 0
              ? "critico"
              : (r?.incidentes.abertos ?? 0) > 0
                ? "atencao"
                : "ok"
          }
          valor={fmtNum(r?.incidentes.abertos)}
          rodape={`${fmtNum(r?.incidentes.criticos)} crítico(s)`}
        />
        <Kpi
          rotulo="Erros novos (1 h)"
          icone={<Bug className="size-4" />}
          carregando={carregando}
          tom={(r?.erros_cliente.novos_1h ?? 0) > 0 ? "atencao" : "ok"}
          valor={fmtNum(r?.erros_cliente.novos_1h)}
          rodape={
            <Link
              to="/tecnologia/erros"
              className="-my-3.5 inline-flex items-center gap-1 py-3.5 hover:text-foreground"
            >
              {fmtNum(r?.erros_cliente.abertos)} grupo(s) em aberto{" "}
              <ArrowRight className="size-3" />
            </Link>
          }
        />
      </div>

      {/* Última hora */}
      <Painel
        titulo="Última hora"
        descricao="Requisições, falhas do servidor e tempo de resposta (p95), minuto a minuto."
        icone={<Clock className="size-4" />}
        acoes={
          <Link
            to="/tecnologia/operacao"
            className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:text-foreground sm:min-h-8"
          >
            Operação <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        {carregando ? (
          <Esqueleto className="h-[200px] sm:h-[240px]" />
        ) : (
          <>
            <GraficoSerie
              dados={serie}
              chaveX="inicio"
              rotuloX={hora}
              series={[
                { chave: "requisicoes", rotulo: "Requisições", cor: COR.primaria, tipo: "area" },
                { chave: "falhas", rotulo: "Falhas (5xx)", cor: COR.falha, tipo: "barra" },
                {
                  chave: "p95_ms",
                  rotulo: "p95",
                  cor: COR.alerta,
                  eixo: "dir",
                  formatar: (v) => fmtMs(v),
                },
              ]}
              vazio={
                <EstadoVazio
                  titulo="Sem telemetria nesta hora"
                  texto={
                    r?.telemetria_desde
                      ? "Ninguém usou o Corretor na última hora."
                      : "A telemetria das requisições ainda não registrou nada neste ambiente."
                  }
                />
              }
            />
            {serie.length > 0 && (
              <Legenda
                series={[
                  { rotulo: "Requisições", cor: COR.primaria },
                  { rotulo: "Falhas (5xx)", cor: COR.falha },
                  { rotulo: "p95 (eixo à direita)", cor: COR.alerta },
                ]}
              />
            )}
          </>
        )}
      </Painel>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Painel titulo="Fila e rotinas" icone={<Workflow className="size-4" />}>
          <Linhas
            carregando={carregando}
            linhas={[
              [
                "Mensagens na fila",
                fmtNum(r?.fila.pendentes),
                (r?.fila.pendentes ?? 0) > 50 ? "atencao" : "ok",
              ],
              [
                "Mais antiga esperando",
                r?.fila.mais_antiga ? ha(r.fila.mais_antiga) : "nenhuma",
                "neutro",
              ],
              [
                "Descartadas em 24 h",
                fmtNum(r?.fila.mortas_24h),
                (r?.fila.mortas_24h ?? 0) > 0 ? "atencao" : "ok",
              ],
              [
                "Rotinas com erro",
                fmtNum(r?.jobs_com_erro),
                (r?.jobs_com_erro ?? 0) > 0 ? "critico" : "ok",
              ],
              [
                "Processador (worker)",
                workerParado
                  ? `sem sinal ${ha(worker?.coletado_em)}`
                  : `vivo · ${worker?.dados.memoria_mb ?? "—"} MB`,
                workerParado ? "critico" : "ok",
              ],
            ]}
          />
        </Painel>

        <Painel
          titulo="Servidor"
          icone={<HardDrive className="size-4" />}
          acoes={<MarcaServico servico="docker" className="size-4" />}
        >
          {!carregando && !host ? (
            <EstadoVazio
              icone={<Cpu className="size-5" />}
              titulo="Coletor sem leitura"
              texto="O coletor de métricas da VPS ainda não enviou dados para este banco."
              className="py-6"
            />
          ) : (
            <Linhas
              carregando={carregando}
              linhas={[
                [
                  "Disco (mais cheio)",
                  fmtPct(disco),
                  disco >= 95 ? "critico" : disco >= 85 ? "atencao" : "ok",
                ],
                [
                  "Memória",
                  fmtPct(host?.dados.memoria?.uso_pct),
                  (host?.dados.memoria?.uso_pct ?? 0) >= 90 ? "atencao" : "ok",
                ],
                [
                  "Containers parados",
                  fmtNum(host?.dados.containers_parados?.length ?? 0),
                  (host?.dados.containers_parados?.length ?? 0) > 0 ? "critico" : "ok",
                ],
                [
                  "Último backup válido",
                  host?.dados.backup?.ultimo_ok ? ha(host.dados.backup.ultimo_ok) : "não medido",
                  !host?.dados.backup?.ultimo_ok ? "atencao" : "ok",
                ],
                ["Leitura", ha(host?.coletado_em), "neutro"],
              ]}
            />
          )}
        </Painel>

        <Painel
          titulo="Saldo APIFull"
          icone={<Wallet className="size-4" />}
          className="md:col-span-2 xl:col-span-1"
        >
          {carregando ? (
            <Esqueleto className="h-20" />
          ) : apifull ? (
            <div>
              <p className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                {fmtReais(apifull.dados.saldo)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {apifull.dados.erro ? "Última leitura falhou · " : "Saldo pré-pago · "}lido{" "}
                {ha(apifull.coletado_em)}
              </p>
            </div>
          ) : (
            <EstadoVazio
              icone={<Inbox className="size-5" />}
              titulo="Sem leitura de saldo"
              texto="O worker lê o saldo a cada 15 min quando a chave da APIFull está cadastrada."
              className="py-6"
            />
          )}
        </Painel>
      </div>
    </div>
  );
}

function Linhas({ linhas, carregando }: { linhas: [string, string, Tom][]; carregando: boolean }) {
  if (carregando) {
    return (
      <div className="space-y-3">
        {linhas.map(([r]) => (
          <Esqueleto key={r} className="h-5" />
        ))}
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {linhas.map(([rotulo, valor, tom]) => (
        <li key={rotulo} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
          <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <Pulso tom={tom} vivo={tom === "critico"} />
            <span className="truncate">{rotulo}</span>
          </span>
          <span className="shrink-0 text-right font-medium tabular-nums text-foreground">
            {valor}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CartaoSistema({ sonda, falhou }: { sonda: Sonda | null; falhou?: boolean }) {
  const nome =
    sonda?.sistema === "corretor"
      ? "Corretor 2.0"
      : sonda?.sistema === "agilliza"
        ? "Agilliza"
        : "…";
  const tom: Tom = !sonda
    ? "neutro"
    : sonda.ok
      ? sonda.ms != null && sonda.ms > 1500
        ? "atencao"
        : "ok"
      : "critico";
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-background">
        {sonda ? (
          <MarcaServico servico={sonda.sistema} className="size-6" />
        ) : (
          <Esqueleto className="size-6 rounded-md" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{nome}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {!sonda
            ? falhou
              ? "sem leitura — a consulta falhou"
              : "sondando…"
            : sonda.ok
              ? `Respondeu em ${fmtMs(sonda.ms)} · banco ${sonda.banco ?? "—"}`
              : `Fora do ar · ${sonda.detalhe ?? sonda.banco ?? "sem resposta"}`}
        </p>
      </div>
      <span
        className="inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium"
        style={{
          borderColor: `color-mix(in oklab, ${tom === "critico" ? "var(--destructive)" : tom === "atencao" ? "var(--warning)" : "var(--success)"} 45%, transparent)`,
        }}
      >
        <Pulso tom={tom} />
        {!sonda ? "…" : sonda.ok ? (tom === "atencao" ? "Lento" : "Operando") : "Fora do ar"}
      </span>
    </div>
  );
}
