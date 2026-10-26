import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Building2,
  Gauge,
  Plug,
  Route as IconeRota,
  Timer,
  Waves,
  Workflow,
} from "lucide-react";
import {
  BarraFina,
  COR,
  EstadoErro,
  EstadoVazio,
  Esqueleto,
  Kpi,
  MiniBarras,
  Painel,
  SeloAoVivo,
  Segmentos,
  diaHora,
  fmtMs,
  fmtNum,
  fmtNum1,
  ha,
  hora,
} from "@/components/tecnologia/base";
import { GraficoSerie, Legenda } from "@/components/tecnologia/grafico-serie";
import { lerOperacao, type Janela } from "@/lib/tecnologia/tecnologia.functions";

export const Route = createFileRoute("/_authenticated/tecnologia/operacao")({
  head: () => ({ meta: [{ title: "Operação — Gestão de Tecnologia — Agilliza" }] }),
  component: Operacao,
});

const JANELAS: { valor: Janela; rotulo: string }[] = [
  { valor: "1h", rotulo: "1 hora" },
  { valor: "6h", rotulo: "6 horas" },
  { valor: "24h", rotulo: "24 horas" },
  { valor: "7d", rotulo: "7 dias" },
];
const ATUALIZA: Record<Janela, number> = { "1h": 15, "6h": 30, "24h": 60, "7d": 120 };

/** Variação contra a janela anterior: "+12% vs. anterior". */
function variacao(atual: number | null | undefined, anterior: number | null | undefined) {
  if (atual == null || !anterior) return null;
  const d = ((atual - anterior) / anterior) * 100;
  if (!Number.isFinite(d)) return null;
  return `${d >= 0 ? "+" : ""}${fmtNum1(d)}% vs. período anterior`;
}

function Operacao() {
  const [janela, setJanela] = useState<Janela>("1h");
  const lerFn = useServerFn(lerOperacao);
  const q = useQuery({
    queryKey: ["tecnologia", "operacao", janela],
    queryFn: () => lerFn({ data: { janela } }),
    refetchInterval: ATUALIZA[janela] * 1000,
    placeholderData: (a) => a,
  });
  const r = q.data?.resumo;
  const serie = q.data?.serie ?? [];
  const carregando = q.isLoading;
  const rotuloX = janela === "7d" ? diaHora : hora;
  const maiorP95 = Math.max(1, ...(q.data?.lentas ?? []).map((l) => l.p95_ms ?? 0));

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Operação</h2>
          <p className="text-xs text-muted-foreground">
            Tráfego, falhas e latência do Agilliza Tech, rota a rota e licença a licença.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmentos rotulo="Janela" valor={janela} opcoes={JANELAS} onChange={setJanela} />
          <SeloAoVivo
            atualizadoEm={q.dataUpdatedAt || null}
            atualizando={q.isFetching}
            falhou={q.isError}
            intervaloS={ATUALIZA[janela]}
            onAtualizar={() => q.refetch()}
          />
        </div>
      </div>

      {q.isError && (
        <EstadoErro
          erro={q.error}
          alternativa="Não foi possível ler a operação."
          onTentar={() => q.refetch()}
        />
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          rotulo="Requisições"
          cor="azul"
          icone={<Waves className="size-4" />}
          carregando={carregando}
          valor={fmtNum(r?.requisicoes)}
          rodape={variacao(r?.requisicoes, r?.anterior.requisicoes) ?? "sem período anterior"}
        />
        <Kpi
          rotulo="Taxa de falha"
          cor="vermelho"
          icone={<AlertTriangle />}
          carregando={carregando}
          tom={(r?.taxa_falha ?? 0) >= 5 ? "critico" : (r?.taxa_falha ?? 0) >= 1 ? "atencao" : "ok"}
          valor={fmtNum1(r?.taxa_falha)}
          unidade="%"
          rodape={`${fmtNum(r?.falhas)} falhas · ${fmtNum(r?.recusas)} recusas`}
        />
        <Kpi
          rotulo="p95"
          cor="amarelo"
          icone={<Gauge className="size-4" />}
          carregando={carregando}
          tom={
            (r?.p95_ms ?? 0) >= 3000 ? "critico" : (r?.p95_ms ?? 0) >= 1500 ? "atencao" : "neutro"
          }
          valor={fmtMs(r?.p95_ms)}
          rodape={`p50 ${fmtMs(r?.p50_ms)}`}
        />
        <Kpi
          rotulo="Licenças ativas"
          cor="verde"
          icone={<Building2 className="size-4" />}
          carregando={carregando}
          valor={fmtNum(r?.licencas)}
          rodape={`${fmtNum(r?.sessoes_ativas)} sessões abertas agora`}
        />
        <Kpi
          rotulo="Chamadas a provedores"
          cor="roxo"
          icone={<Plug className="size-4" />}
          carregando={carregando}
          tom={(r?.provedor_falhas ?? 0) > 0 ? "atencao" : "neutro"}
          valor={fmtNum(r?.provedor_chamadas)}
          rodape={`${fmtNum(r?.provedor_falhas)} com falha`}
        />
        <Kpi
          rotulo="Fila"
          cor="marca"
          icone={<Workflow className="size-4" />}
          carregando={carregando}
          tom={(r?.fila_mortas ?? 0) > 0 ? "atencao" : "neutro"}
          valor={fmtNum(r?.fila_pendentes)}
          rodape={`${fmtNum(r?.fila_mortas)} descartadas · ${fmtNum(r?.jobs_falhas)} rotinas com erro`}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Painel titulo="Tráfego" descricao="Requisições, falhas do servidor (5xx) e recusas (4xx).">
          {carregando ? (
            <Esqueleto className="h-[200px] sm:h-[240px]" />
          ) : (
            <>
              <GraficoSerie
                dados={serie}
                chaveX="inicio"
                rotuloX={rotuloX}
                series={[
                  { chave: "requisicoes", rotulo: "Requisições", cor: COR.primaria, tipo: "area" },
                  { chave: "recusas", rotulo: "Recusas (4xx)", cor: COR.alerta },
                  { chave: "falhas", rotulo: "Falhas (5xx)", cor: COR.falha, tipo: "barra" },
                ]}
                vazio={<EstadoVazio titulo="Sem requisições nesta janela" />}
              />
              <Legenda
                series={[
                  { rotulo: "Requisições", cor: COR.primaria },
                  { rotulo: "Recusas (4xx)", cor: COR.alerta },
                  { rotulo: "Falhas (5xx)", cor: COR.falha },
                ]}
              />
            </>
          )}
        </Painel>
        <Painel titulo="Latência" descricao="Mediana (p50) e p95 do tempo de resposta.">
          {carregando ? (
            <Esqueleto className="h-[200px] sm:h-[240px]" />
          ) : (
            <>
              <GraficoSerie
                dados={serie}
                chaveX="inicio"
                rotuloX={rotuloX}
                limite={{ valor: 3000, rotulo: "limite 3 s" }}
                series={[
                  { chave: "p50_ms", rotulo: "p50", cor: COR.secundaria, formatar: fmtMs },
                  { chave: "p95_ms", rotulo: "p95", cor: COR.primaria, formatar: fmtMs },
                ]}
                vazio={<EstadoVazio titulo="Sem medições nesta janela" />}
              />
              <Legenda
                series={[
                  { rotulo: "p50", cor: COR.secundaria },
                  { rotulo: "p95", cor: COR.primaria },
                ]}
              />
            </>
          )}
        </Painel>
        <Painel
          titulo="Fila e rotinas"
          descricao="Mensagens esperando na fila e rotinas que falharam."
        >
          {carregando ? (
            <Esqueleto className="h-[200px] sm:h-[240px]" />
          ) : (
            <>
              <GraficoSerie
                dados={serie}
                chaveX="inicio"
                rotuloX={rotuloX}
                series={[
                  { chave: "fila", rotulo: "Na fila", cor: COR.secundaria, tipo: "area" },
                  {
                    chave: "jobs_falhas",
                    rotulo: "Rotinas com erro",
                    cor: COR.falha,
                    tipo: "barra",
                  },
                ]}
              />
              <Legenda
                series={[
                  { rotulo: "Na fila", cor: COR.secundaria },
                  { rotulo: "Rotinas com erro", cor: COR.falha },
                ]}
              />
            </>
          )}
        </Painel>
        <Painel
          titulo="Provedores"
          descricao="Chamadas a bancos, birôs, cobrança e demais integrações."
        >
          {carregando ? (
            <Esqueleto className="h-[200px] sm:h-[240px]" />
          ) : (
            <>
              <GraficoSerie
                dados={serie}
                chaveX="inicio"
                rotuloX={rotuloX}
                series={[
                  {
                    chave: "provedor_chamadas",
                    rotulo: "Chamadas",
                    cor: COR.sucesso,
                    tipo: "area",
                  },
                  { chave: "provedor_falhas", rotulo: "Com falha", cor: COR.falha, tipo: "barra" },
                ]}
              />
              <Legenda
                series={[
                  { rotulo: "Chamadas", cor: COR.sucesso },
                  { rotulo: "Com falha", cor: COR.falha },
                ]}
              />
            </>
          )}
        </Painel>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Painel
          titulo="Rotas mais lentas"
          icone={<Timer className="size-4" />}
          descricao="Pelo p95 na janela."
        >
          {carregando ? (
            <Esqueleto className="h-48" />
          ) : !q.data?.lentas.length ? (
            <EstadoVazio
              icone={<IconeRota className="size-5" />}
              titulo="Nenhuma rota medida nesta janela"
            />
          ) : (
            <ol className="space-y-3">
              {q.data.lentas.map((l, i) => (
                <li key={l.rota} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="w-4 shrink-0 text-right text-[11px] font-semibold text-muted-foreground tabular-nums">
                        {i + 1}
                      </span>
                      <span className="truncate font-mono text-xs text-foreground" title={l.rota}>
                        {l.rota}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                      {fmtMs(l.p95_ms)}
                    </span>
                  </div>
                  <div className="mt-1.5 pl-6">
                    <BarraFina
                      pct={((l.p95_ms ?? 0) / maiorP95) * 100}
                      cor={(l.p95_ms ?? 0) >= 3000 ? COR.falha : COR.primaria}
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {l.tipo} · {fmtNum(l.requisicoes)} req. · p50 {fmtMs(l.p50_ms)} · máx{" "}
                      {fmtMs(l.max_ms)}
                      {l.falhas > 0 && (
                        <span className="text-destructive"> · {l.falhas} falha(s)</span>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Painel>

        <Painel
          titulo="Licenças com mais erro"
          icone={<Building2 className="size-4" />}
          descricao="Falhas e recusas por conta, com a tendência de uso na janela."
        >
          {carregando ? (
            <Esqueleto className="h-48" />
          ) : !q.data?.licencas.length ? (
            <EstadoVazio titulo="Nenhuma licença com atividade nesta janela" />
          ) : (
            <ul className="divide-y divide-border">
              {q.data.licencas.map((l) => (
                <li
                  key={l.tenant_id}
                  className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_96px_auto]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{l.nome}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {l.tipo} · {l.status} · última atividade {ha(l.ultima_atividade)}
                    </p>
                  </div>
                  <MiniBarras
                    valores={l.tendencia}
                    rotulo={`Uso de ${l.nome} na janela`}
                    className="order-last col-span-2 h-4 max-w-[180px] sm:order-none sm:col-span-1 sm:max-w-none sm:self-center"
                  />
                  <div className="text-right text-xs tabular-nums">
                    <p
                      className={
                        l.falhas > 0 ? "font-semibold text-destructive" : "text-muted-foreground"
                      }
                    >
                      {fmtNum(l.falhas)} falha(s)
                    </p>
                    <p className="text-muted-foreground">
                      {fmtNum(l.recusas)} recusa(s) · {fmtNum(l.requisicoes)} req.
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>

      {r?.telemetria_desde && (
        <p className="text-center text-[11px] text-muted-foreground">
          Telemetria guardada desde {diaHora(r.telemetria_desde)} (retenção de 14 dias).
        </p>
      )}
    </div>
  );
}
