import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Boxes, Cpu, DatabaseBackup, HardDrive, Lock, MemoryStick, Server } from "lucide-react";
import {
  BarraFina,
  COR,
  EstadoErro,
  EstadoVazio,
  Esqueleto,
  Kpi,
  Painel,
  Pulso,
  SeloAoVivo,
  Segmentos,
  diaHora,
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
import { lerServidor } from "@/lib/tecnologia/tecnologia.functions";

export const Route = createFileRoute("/_authenticated/tecnologia/servidor")({
  head: () => ({ meta: [{ title: "Servidor — Gestão de Tecnologia — Agilliza" }] }),
  component: Servidor,
});

type JanelaServidor = "24h" | "7d";

const tomPct = (v: number | null | undefined, alerta: number, critico: number): Tom =>
  v == null ? "neutro" : v >= critico ? "critico" : v >= alerta ? "atencao" : "ok";

function Servidor() {
  const [janela, setJanela] = useState<JanelaServidor>("24h");
  const lerFn = useServerFn(lerServidor);
  const q = useQuery({
    queryKey: ["tecnologia", "servidor", janela],
    queryFn: () => lerFn({ data: { janela } }),
    refetchInterval: 60_000,
    placeholderData: (a) => a,
  });
  const s = q.data;
  const host = s?.ultimo.host;
  const banco = s?.ultimo.banco;
  const worker = s?.ultimo.worker;
  const carregando = q.isLoading;
  const rotuloX = janela === "7d" ? diaHora : hora;
  const discos = host?.dados.discos ?? [];
  const disco = discos.length ? Math.max(...discos.map((d) => d.uso_pct ?? 0)) : null;
  const memoria = host?.dados.memoria?.uso_pct ?? null;
  const carga = host?.dados.cpu?.carga_1m ?? null;
  const nucleos = host?.dados.cpu?.nucleos ?? null;
  const backupOk = host?.dados.backup?.ultimo_ok ?? null;
  const backupH = backupOk ? (Date.now() - new Date(backupOk).getTime()) / 3_600_000 : null;
  const certDias = host?.dados.certificado?.dias_restantes ?? null;
  const containers = host?.dados.containers ?? [];
  const parados = host?.dados.containers_parados ?? [];
  const coletorAtrasado = host?.coletado_em
    ? Date.now() - new Date(host.coletado_em).getTime() > 15 * 60_000
    : true;

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Servidor</h2>
          <p className="text-xs text-muted-foreground">
            Máquina (VPS), containers, banco, backup e certificado — lidos pelo coletor e pelo
            worker.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmentos
            rotulo="Janela"
            valor={janela}
            opcoes={[
              { valor: "24h", rotulo: "24 horas" },
              { valor: "7d", rotulo: "7 dias" },
            ]}
            onChange={setJanela}
          />
          <SeloAoVivo
            atualizadoEm={q.dataUpdatedAt || null}
            atualizando={q.isFetching}
            falhou={q.isError}
            intervaloS={60}
            onAtualizar={() => q.refetch()}
          />
        </div>
      </div>

      {q.isError && (
        <EstadoErro
          erro={q.error}
          alternativa="Não foi possível ler as métricas do servidor."
          onTentar={() => q.refetch()}
        />
      )}

      {!carregando && !host && (
        <Painel>
          <EstadoVazio
            icone={<Server className="size-5" />}
            titulo="O coletor da VPS ainda não enviou leituras"
            texto="Disco, memória, carga, containers, backup e certificado chegam pelo coletor (infra/scripts/coletar-metricas.sh), a cada 5 minutos. Banco, worker e APIFull aparecem abaixo assim que houver leitura."
          />
        </Painel>
      )}

      {host && coletorAtrasado && (
        <p className="flex items-center gap-2 rounded-xl border border-warning/60 bg-warning/10 px-4 py-3 text-xs text-foreground">
          <Pulso tom="atencao" /> Última leitura do coletor {ha(host.coletado_em)} — os números
          podem estar desatualizados.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          rotulo="Disco (mais cheio)"
          icone={<HardDrive className="size-4" />}
          carregando={carregando}
          tom={tomPct(disco, 85, 95)}
          valor={disco == null ? "—" : fmtNum1(disco)}
          unidade={disco == null ? undefined : "%"}
          rodape={discos.length ? `${discos.length} ponto(s) de montagem` : "não medido"}
        />
        <Kpi
          rotulo="Memória"
          icone={<MemoryStick className="size-4" />}
          carregando={carregando}
          tom={tomPct(memoria, 80, 90)}
          valor={memoria == null ? "—" : fmtNum1(memoria)}
          unidade={memoria == null ? undefined : "%"}
          rodape={
            host?.dados.memoria?.total_gb ? `de ${fmtNum1(host.dados.memoria.total_gb)} GB` : "—"
          }
        />
        <Kpi
          rotulo="Carga (1 min)"
          icone={<Cpu className="size-4" />}
          carregando={carregando}
          tom={carga != null && nucleos ? tomPct((carga / nucleos) * 100, 80, 100) : "neutro"}
          valor={carga == null ? "—" : fmtNum1(carga)}
          rodape={
            nucleos ? `${nucleos} núcleos · 5 min ${fmtNum1(host?.dados.cpu?.carga_5m)}` : "—"
          }
        />
        <Kpi
          rotulo="Containers"
          icone={<Boxes className="size-4" />}
          carregando={carregando}
          tom={!host ? "neutro" : parados.length > 0 ? "critico" : "ok"}
          valor={host ? `${containers.length - parados.length}/${containers.length}` : "—"}
          rodape={
            !host ? "não medido" : parados.length ? `${parados.length} parado(s)` : "todos rodando"
          }
        />
        <Kpi
          rotulo="Último backup"
          icone={<DatabaseBackup className="size-4" />}
          carregando={carregando}
          tom={!host ? "neutro" : backupH == null ? "critico" : backupH > 26 ? "critico" : "ok"}
          valor={backupH == null ? "—" : backupH < 1 ? "<1" : fmtNum(Math.round(backupH))}
          unidade={backupH == null ? undefined : "h atrás"}
          rodape={
            host?.dados.backup?.tipo
              ? `tipo ${host.dados.backup.tipo}`
              : backupOk
                ? diaHora(backupOk)
                : "sem backup válido"
          }
        />
        <Kpi
          rotulo="Certificado HTTPS"
          icone={<Lock className="size-4" />}
          carregando={carregando}
          tom={
            certDias == null
              ? "neutro"
              : certDias < 15
                ? "critico"
                : certDias < 30
                  ? "atencao"
                  : "ok"
          }
          valor={certDias == null ? "—" : fmtNum(certDias)}
          unidade={certDias == null ? undefined : "dias"}
          rodape={host?.dados.certificado?.dominio ?? "domínio não informado ao coletor"}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Painel
          titulo="Disco e memória"
          descricao="Uso em %, com os limites de alerta."
          acoes={<MarcaServico servico="docker" className="size-4" />}
        >
          {carregando ? (
            <Esqueleto className="h-[200px] sm:h-[240px]" />
          ) : (
            <>
              <GraficoSerie
                dados={s?.host ?? []}
                chaveX="em"
                rotuloX={rotuloX}
                dominioY={[0, 100]}
                limite={{ valor: 85, rotulo: "alerta 85%" }}
                series={[
                  {
                    chave: "disco_pct",
                    rotulo: "Disco",
                    cor: COR.primaria,
                    tipo: "area",
                    formatar: fmtPct,
                  },
                  { chave: "memoria_pct", rotulo: "Memória", cor: COR.sucesso, formatar: fmtPct },
                ]}
                vazio={<EstadoVazio titulo="Sem leituras nesta janela" />}
              />
              <Legenda
                series={[
                  { rotulo: "Disco (mais cheio)", cor: COR.primaria },
                  { rotulo: "Memória", cor: COR.sucesso },
                ]}
              />
            </>
          )}
        </Painel>
        <Painel
          titulo="Carga da CPU"
          descricao={
            nucleos
              ? `Média de processos na fila (${nucleos} núcleos = 100%).`
              : "Média de processos na fila."
          }
        >
          {carregando ? (
            <Esqueleto className="h-[200px] sm:h-[240px]" />
          ) : (
            <>
              <GraficoSerie
                dados={s?.host ?? []}
                chaveX="em"
                rotuloX={rotuloX}
                limite={nucleos ? { valor: nucleos, rotulo: `${nucleos} núcleos` } : undefined}
                series={[
                  { chave: "carga_1m", rotulo: "1 min", cor: COR.primaria },
                  { chave: "carga_5m", rotulo: "5 min", cor: COR.secundaria },
                ]}
                vazio={<EstadoVazio titulo="Sem leituras nesta janela" />}
              />
              <Legenda
                series={[
                  { rotulo: "1 min", cor: COR.primaria },
                  { rotulo: "5 min", cor: COR.secundaria },
                ]}
              />
            </>
          )}
        </Painel>
        <Painel
          titulo="Banco de dados"
          descricao="Uso do pool de conexões e acerto de cache (a cada minuto)."
          acoes={<MarcaServico servico="postgres" className="size-4" />}
        >
          {carregando ? (
            <Esqueleto className="h-[200px] sm:h-[240px]" />
          ) : (
            <>
              <GraficoSerie
                dados={s?.banco ?? []}
                chaveX="em"
                rotuloX={rotuloX}
                dominioY={[0, 100]}
                series={[
                  {
                    chave: "uso_pct",
                    rotulo: "Pool em uso",
                    cor: COR.primaria,
                    tipo: "area",
                    formatar: fmtPct,
                  },
                  {
                    chave: "cache_hit_pct",
                    rotulo: "Acerto de cache",
                    cor: COR.sucesso,
                    formatar: fmtPct,
                  },
                ]}
                vazio={
                  <EstadoVazio
                    titulo="Sem leituras do banco"
                    texto="A rotina de alertas grava o retrato do banco a cada minuto."
                  />
                }
              />
              <Legenda
                series={[
                  { rotulo: "Pool em uso", cor: COR.primaria },
                  { rotulo: "Acerto de cache", cor: COR.sucesso },
                ]}
              />
              {banco && (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                  <Dado
                    rotulo="Conexões"
                    valor={`${fmtNum(banco.dados.conexoes)} / ${fmtNum(banco.dados.max_conexoes)}`}
                  />
                  <Dado
                    rotulo="Tamanho"
                    valor={
                      banco.dados.tamanho_bytes
                        ? `${fmtNum1(Number(banco.dados.tamanho_bytes) / 1_073_741_824)} GB`
                        : "—"
                    }
                  />
                  <Dado
                    rotulo="Transação mais longa"
                    valor={`${fmtNum(banco.dados.transacao_mais_longa_s)} s`}
                  />
                  <Dado
                    rotulo="Esperando bloqueio"
                    valor={fmtNum(banco.dados.aguardando_bloqueio)}
                  />
                </dl>
              )}
            </>
          )}
        </Painel>
        <Painel
          titulo="Worker e APIFull"
          descricao="Memória do processador de tarefas e saldo pré-pago da APIFull."
          acoes={<MarcaServico servico="node" className="size-4" />}
        >
          {carregando ? (
            <Esqueleto className="h-[200px] sm:h-[240px]" />
          ) : (
            <>
              <GraficoSerie
                dados={s?.worker ?? []}
                chaveX="em"
                rotuloX={rotuloX}
                series={[
                  {
                    chave: "memoria_mb",
                    rotulo: "Memória do worker (MB)",
                    cor: COR.secundaria,
                    tipo: "area",
                  },
                ]}
                vazio={<EstadoVazio titulo="Sem sinal do worker nesta janela" />}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Pulso
                    tom={
                      worker?.coletado_em &&
                      Date.now() - new Date(worker.coletado_em).getTime() < 10 * 60_000
                        ? "ok"
                        : "critico"
                    }
                  />
                  Worker {worker?.coletado_em ? `· sinal ${ha(worker.coletado_em)}` : "sem sinal"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Saldo APIFull{" "}
                  <strong className="ml-1 text-sm font-semibold text-foreground tabular-nums">
                    {fmtReais(s?.ultimo.apifull?.dados.saldo)}
                  </strong>
                </span>
              </div>
            </>
          )}
        </Painel>
      </div>

      {host && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Painel
            titulo="Containers"
            icone={<Boxes className="size-4" />}
            acoes={<MarcaServico servico="docker" className="size-4" />}
          >
            {containers.length === 0 ? (
              <EstadoVazio titulo="Nenhum container informado" />
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {containers.map((c) => {
                  const ruim = parados.includes(c.nome);
                  return (
                    <li
                      key={c.nome}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Pulso tom={ruim ? "critico" : "ok"} vivo={ruim} />
                        <span className="truncate font-mono text-xs text-foreground">{c.nome}</span>
                      </span>
                      <span
                        className={
                          ruim
                            ? "shrink-0 text-xs font-medium text-destructive"
                            : "shrink-0 text-xs text-muted-foreground"
                        }
                      >
                        {c.estado
                          .replace("running", "rodando")
                          .replace("healthy", "saudável")
                          .replace("unhealthy", "sem saúde")
                          .replace("exited", "parado")
                          .replace("ausente", "ausente")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Painel>
          <Painel titulo="Discos" icone={<HardDrive className="size-4" />}>
            <ul className="space-y-3">
              {discos.map((d) => (
                <li key={d.ponto}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-mono text-foreground">{d.ponto}</span>
                    <span className="tabular-nums text-muted-foreground">
                      <strong className="font-semibold text-foreground">{fmtPct(d.uso_pct)}</strong>
                      {d.livre_gb != null && ` · ${fmtNum1(d.livre_gb)} GB livres`}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <BarraFina
                      pct={d.uso_pct ?? 0}
                      cor={
                        (d.uso_pct ?? 0) >= 95
                          ? COR.falha
                          : (d.uso_pct ?? 0) >= 85
                            ? COR.alerta
                            : COR.primaria
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
              <MarcaServico servico="letsencrypt" className="size-4" />
              <span>
                Certificado {host.dados.certificado?.dominio ?? ""}:{" "}
                {certDias == null
                  ? host.dados.certificado?.erro
                    ? "falha na leitura"
                    : "não medido"
                  : `${certDias} dias restantes`}
              </span>
            </div>
          </Painel>
        </div>
      )}
    </div>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-muted-foreground">{rotulo}</dt>
      <dd className="font-medium tabular-nums text-foreground">{valor}</dd>
    </div>
  );
}
