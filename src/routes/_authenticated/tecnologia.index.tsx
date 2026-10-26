import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  ArrowRight,
  Bug,
  History,
  KeyRound,
  MapPinned,
  ShieldAlert,
  Users,
  Zap,
} from "lucide-react";
import {
  EstadoErro,
  Esqueleto,
  Kpi,
  Pulso,
  SeloAoVivo,
  Segmentos,
  diaHora,
  fmtMs,
  fmtNum,
  fmtNum1,
  fmtPct,
  fmtReais,
  ha,
  hora,
  type Tom,
} from "@/components/tecnologia/base";
import {
  AtividadeRecente,
  CartaoFerramentas,
  GraficoAcessos,
  LicencasRecentes,
  MiniArea,
  RoscaUsuarios,
  TabelaUfs,
} from "@/components/tecnologia/central";
import { Legenda } from "@/components/tecnologia/grafico-serie";
import { MapaBrasil } from "@/components/tecnologia/mapa-brasil";
import { MarcaServico } from "@/components/tecnologia/marcas";
import { COR } from "@/components/tecnologia/base";
import {
  lerAcessos,
  lerUsuarios,
  lerVisaoGeral,
  type Janela,
  type Sonda,
} from "@/lib/tecnologia/tecnologia.functions";

export const Route = createFileRoute("/_authenticated/tecnologia/")({
  head: () => ({ meta: [{ title: "Visão geral — Gestão de Tecnologia — Agilliza" }] }),
  component: VisaoGeral,
});

const INTERVALO_S = 12;
const JANELAS: { valor: Janela; rotulo: string }[] = [
  { valor: "1h", rotulo: "1h" },
  { valor: "6h", rotulo: "6h" },
  { valor: "24h", rotulo: "24h" },
  { valor: "7d", rotulo: "7d" },
];

function VisaoGeral() {
  const lerFn = useServerFn(lerVisaoGeral);
  const acessosFn = useServerFn(lerAcessos);
  const usuariosFn = useServerFn(lerUsuarios);
  const [janela, setJanela] = useState<Janela>("1h");

  const q = useQuery({
    queryKey: ["tecnologia", "visao-geral"],
    queryFn: () => lerFn(),
    refetchInterval: INTERVALO_S * 1000,
    placeholderData: (a) => a,
  });
  const qAcessos = useQuery({
    queryKey: ["tecnologia", "acessos", janela],
    queryFn: () => acessosFn({ data: { janela } }),
    refetchInterval: { "1h": 15_000, "6h": 30_000, "24h": 60_000, "7d": 120_000 }[janela],
    placeholderData: (a) => a,
  });
  // O mapa pinta pela atividade de 30 dias (muda devagar); o ponto "ao vivo" vem da visão geral.
  const qMapa = useQuery({
    queryKey: ["tecnologia", "usuarios", "30d"],
    queryFn: () => usuariosFn({ data: { janela: "30d" } }),
    refetchInterval: 5 * 60_000,
    placeholderData: (a) => a,
  });

  const r = q.data?.resumo;
  const painel = q.data?.painel;
  const online = q.data?.online;
  const serie = q.data?.serie ?? [];
  const carregando = q.isLoading;
  const taxa = r?.requisicoes_15min.taxa_falha ?? null;
  const p95 = r?.requisicoes_15min.p95_ms ?? null;

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            Fontes: telemetria do portal do Agilliza Tech (requisições e sessões), erros dos dois
            sistemas, incidentes, licenças e o coletor da VPS. Cada número diz a sua janela.
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
          alternativa="Não foi possível ler a central."
          onTentar={() => q.refetch()}
        />
      )}

      <FaixaSaude sondas={q.data?.sondas ?? null} resumo={r ?? null} falhou={q.isError} />

      {/* Indicadores */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Kpi
          cor="vermelho"
          icone={<Users />}
          rotulo="Usuários online no Agilliza Tech"
          janela="5 min"
          carregando={carregando}
          valor={fmtNum(r?.online_agora)}
          rodape={`sessão usada nos últimos 5 min · ${fmtNum(online?.ativos_24h)} em 24 h`}
        />
        <Kpi
          cor="azul"
          icone={<Zap />}
          rotulo="Requisições por minuto (Agilliza Tech)"
          janela="média de 5 min"
          carregando={carregando}
          valor={fmtNum1(r?.requisicoes_5min.por_minuto)}
          rodape={`${fmtNum(r?.requisicoes_5min.total)} em 5 min · falha (5xx) ${taxa == null ? "sem dados" : `${fmtNum1(taxa)}%`} em 15 min`}
          tom={taxa == null ? "neutro" : taxa >= 5 ? "critico" : taxa >= 1 ? "atencao" : "neutro"}
        />
        <Kpi
          cor="amarelo"
          icone={<Bug />}
          rotulo="Grupos de erro novos"
          janela="1 h"
          carregando={carregando}
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
        <Kpi
          cor="roxo"
          icone={<ShieldAlert />}
          rotulo="Incidentes abertos"
          janela="agora"
          carregando={carregando}
          valor={fmtNum(r?.incidentes.abertos)}
          rodape={`${fmtNum(r?.incidentes.criticos)} crítico(s)`}
          tom={(r?.incidentes.criticos ?? 0) > 0 ? "critico" : "neutro"}
        />
        <Kpi
          cor="verde"
          icone={<KeyRound />}
          rotulo="Licenças ativas"
          janela="agora"
          carregando={carregando}
          valor={fmtNum(painel?.licencas.ativas)}
          rodape={`+${fmtNum(painel?.licencas.novas_7d)} novas em 7 dias · ${fmtNum(painel?.licencas.teste)} em teste`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MiniArea
              titulo="Tráfego"
              valor={fmtNum1(r?.requisicoes_5min.por_minuto)}
              unidade="req/min"
              rodape="média de 5 min · gráfico da última hora"
              dados={serie as unknown as Record<string, unknown>[]}
              chave="requisicoes"
              cor="#9b7bff"
              carregando={carregando}
            />
            <MiniArea
              titulo="Tempo de resposta p95"
              valor={p95 == null ? "—" : p95 >= 1000 ? fmtNum1(p95 / 1000) : fmtNum(p95)}
              unidade={p95 == null ? undefined : p95 >= 1000 ? "s" : "ms"}
              rodape="15 min · linha da última hora"
              dados={serie as unknown as Record<string, unknown>[]}
              chave="p95_ms"
              cor="#f59e0b"
              carregando={carregando}
            />
            <MiniArea
              titulo="Mensagens na fila"
              valor={fmtNum(r?.fila.pendentes)}
              rodape={`agora (pendentes, em processo ou com erro) · ${fmtNum(r?.fila.mortas_24h)} descartada(s) em 24 h`}
              dados={serie as unknown as Record<string, unknown>[]}
              chave="fila"
              cor="#2fd39a"
              carregando={carregando}
            />
          </div>

          <CartaoFerramentas
            titulo="Acessos e latência"
            subtitulo="Requisições e falhas (eixo à esquerda) e p95 (eixo à direita)."
            icone={<Activity className="size-4" />}
            onAtualizar={() => qAcessos.refetch()}
            atualizando={qAcessos.isFetching}
            extra={
              <Segmentos rotulo="Janela" valor={janela} opcoes={JANELAS} onChange={setJanela} />
            }
          >
            {(telaCheia) =>
              qAcessos.isLoading ? (
                <Esqueleto className="h-[240px] sm:h-[300px]" />
              ) : (
                <>
                  <GraficoAcessos
                    dados={qAcessos.data ?? []}
                    rotuloX={janela === "7d" ? diaHora : hora}
                    telaCheia={telaCheia}
                  />
                  <Legenda
                    series={[
                      { rotulo: "Requisições", cor: COR.primaria },
                      { rotulo: "Falhas (5xx)", cor: COR.falha },
                      { rotulo: "p95 em ms (eixo à direita)", cor: COR.alerta },
                    ]}
                  />
                </>
              )
            }
          </CartaoFerramentas>
        </div>

        <CartaoFerramentas
          titulo="Usuários online"
          subtitulo="Agilliza Tech, por perfil e por estado (sessão usada nos últimos 5 min)."
          icone={<Users className="size-4" />}
          onAtualizar={() => q.refetch()}
          atualizando={q.isFetching}
        >
          {() =>
            carregando ? (
              <Esqueleto className="mx-auto aspect-square w-full max-w-[200px] rounded-full" />
            ) : (
              <div className="space-y-4">
                <RoscaUsuarios
                  porPerfil={online?.por_perfil ?? {}}
                  total={online?.online_agora ?? 0}
                />
                <TabelaUfs porUf={online?.por_uf ?? {}} limite={5} />
              </div>
            )
          }
        </CartaoFerramentas>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
        <CartaoFerramentas
          titulo="Brasil ao vivo"
          subtitulo="Cor: pessoas ativas em 30 dias · ponto verde: gente online agora."
          icone={<MapPinned className="size-4" />}
          onAtualizar={() => {
            void qMapa.refetch();
            void q.refetch();
          }}
          atualizando={qMapa.isFetching}
        >
          {() =>
            qMapa.isLoading ? (
              <Esqueleto className="mx-auto aspect-square w-full max-w-[520px]" />
            ) : (
              <MapaBrasil
                porUf={qMapa.data?.por_uf ?? {}}
                online={online?.por_uf}
                rotuloValor="pessoas em 30 dias"
              />
            )
          }
        </CartaoFerramentas>

        <CartaoFerramentas
          titulo="Atividade recente"
          subtitulo="Últimas 48 horas."
          icone={<History className="size-4" />}
          onAtualizar={() => q.refetch()}
          atualizando={q.isFetching}
          className="xl:max-h-[760px] xl:overflow-y-auto"
        >
          {() => <AtividadeRecente eventos={painel?.atividade ?? []} carregando={carregando} />}
        </CartaoFerramentas>
      </div>

      <CartaoFerramentas
        titulo="Licenças e usuários recentes"
        subtitulo="As últimas contas criadas, com quem responde por elas."
        icone={<KeyRound className="size-4" />}
        onAtualizar={() => q.refetch()}
        atualizando={q.isFetching}
        extra={
          <Link
            to="/plataforma/licencas"
            className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[color:var(--realce)] hover:underline lg:min-h-8"
          >
            Ver todas <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        {() => (
          <LicencasRecentes
            itens={painel?.recentes ?? null}
            permitido={Boolean(painel?.lista_permitida)}
            carregando={carregando}
          />
        )}
      </CartaoFerramentas>
    </div>
  );
}

/** Faixa de saúde: os dois sistemas e a infraestrutura em selos que quebram linha (sem rolar de lado). */
function FaixaSaude({
  sondas,
  resumo: r,
  falhou,
}: {
  sondas: Sonda[] | null;
  resumo: import("@/lib/tecnologia/tecnologia.functions").ResumoTecnologia | null;
  falhou: boolean;
}) {
  const host = r?.coletas.host;
  const worker = r?.coletas.worker;
  const apifull = r?.coletas.apifull;
  const disco = host ? Math.max(0, ...(host.dados.discos ?? []).map((d) => d.uso_pct ?? 0)) : null;
  const parados = host?.dados.containers_parados?.length ?? 0;
  const workerVivo =
    worker?.coletado_em && Date.now() - new Date(worker.coletado_em).getTime() < 10 * 60_000;
  const backup = host?.dados.backup?.ultimo_ok ?? null;
  const backupH = backup ? (Date.now() - new Date(backup).getTime()) / 3_600_000 : null;

  const selos: {
    chave: string;
    marca?: "agilliza" | "corretor" | "docker" | "postgres" | "node";
    rotulo: string;
    valor: string;
    tom: Tom;
  }[] = [];
  for (const s of sondas ?? []) {
    selos.push({
      chave: s.sistema,
      marca: s.sistema,
      rotulo: s.sistema === "corretor" ? "Agilliza Tech" : "Agilliza",
      valor: s.ok ? fmtMs(s.ms) : "fora do ar",
      tom: !s.ok ? "critico" : s.ms != null && s.ms > 1500 ? "atencao" : "ok",
    });
  }
  if (!sondas)
    selos.push({
      chave: "sondas",
      rotulo: "Sistemas",
      valor: falhou ? "sem leitura" : "sondando…",
      tom: falhou ? "critico" : "neutro",
    });
  selos.push({
    chave: "worker",
    marca: "node",
    rotulo: "Worker",
    valor: workerVivo
      ? `${worker?.dados.memoria_mb ?? "—"} MB`
      : `sem sinal ${ha(worker?.coletado_em)}`,
    tom: !r ? "neutro" : workerVivo ? "ok" : "critico",
  });
  selos.push({
    chave: "disco",
    marca: "docker",
    rotulo: "Disco",
    valor: disco == null ? "não medido" : fmtPct(disco),
    tom: disco == null ? "neutro" : disco >= 95 ? "critico" : disco >= 85 ? "atencao" : "ok",
  });
  selos.push({
    chave: "containers",
    rotulo: "Containers",
    valor: host ? (parados ? `${parados} parado(s)` : "todos rodando") : "não medido",
    tom: !host ? "neutro" : parados ? "critico" : "ok",
  });
  selos.push({
    chave: "backup",
    marca: "postgres",
    rotulo: "Backup",
    valor:
      backupH == null
        ? "não medido"
        : backupH < 1
          ? "há menos de 1 h"
          : `há ${Math.round(backupH)} h`,
    tom: !host ? "neutro" : backupH == null || backupH > 26 ? "critico" : "ok",
  });
  selos.push({
    chave: "apifull",
    rotulo: "APIFull",
    valor: apifull ? fmtReais(apifull.dados.saldo) : "sem leitura",
    tom: "neutro",
  });

  return (
    <ul aria-label="Saúde dos sistemas" className="flex flex-wrap gap-2">
      {selos.map((s) => (
        <li
          key={s.chave}
          className="tec-cartao inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs"
        >
          <Pulso
            tom={s.tom}
            vivo={s.tom === "critico" || s.chave === "agilliza" || s.chave === "corretor"}
          />
          {s.marca && <MarcaServico servico={s.marca} className="size-4" />}
          <span className="text-muted-foreground">{s.rotulo}</span>
          <span className="font-semibold tabular-nums text-foreground">{s.valor}</span>
        </li>
      ))}
    </ul>
  );
}
