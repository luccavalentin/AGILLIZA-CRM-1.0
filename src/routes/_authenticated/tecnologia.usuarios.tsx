import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, EyeOff, MapPinned, UserRound, Users } from "lucide-react";
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
  dia,
  fmtNum,
  ha,
} from "@/components/tecnologia/base";
import { GraficoSerie } from "@/components/tecnologia/grafico-serie";
import { MapaBrasil, NOME_UF } from "@/components/tecnologia/mapa-brasil";
import { lerUsuarios } from "@/lib/tecnologia/tecnologia.functions";

export const Route = createFileRoute("/_authenticated/tecnologia/usuarios")({
  head: () => ({ meta: [{ title: "Usuários ativos — Gestão de Tecnologia — Agilliza" }] }),
  component: Usuarios,
});

type JanelaUsuarios = "agora" | "24h" | "30d";

const PERFIS: { chave: string; rotulo: string; cor: string }[] = [
  { chave: "corretor", rotulo: "Corretores", cor: COR.primaria },
  { chave: "imobiliaria", rotulo: "Imobiliárias", cor: COR.secundaria },
  { chave: "parceiro", rotulo: "Parceiros", cor: COR.sucesso },
  { chave: "cliente", rotulo: "Clientes", cor: COR.alerta },
  { chave: "plataforma", rotulo: "Plataforma", cor: COR.eixo },
];
const ROTULO_PERFIL: Record<string, string> = {
  corretor: "corretor",
  imobiliaria: "imobiliária",
  parceiro: "parceiro",
  cliente: "cliente",
  plataforma: "plataforma",
};
const DESCRICAO: Record<JanelaUsuarios, string> = {
  agora: "online agora (uso nos últimos 5 min)",
  "24h": "ativos nas últimas 24 horas",
  "30d": "ativos nos últimos 30 dias",
};

function Usuarios() {
  const [janela, setJanela] = useState<JanelaUsuarios>("agora");
  const lerFn = useServerFn(lerUsuarios);
  const q = useQuery({
    queryKey: ["tecnologia", "usuarios", janela],
    queryFn: () => lerFn({ data: { janela } }),
    refetchInterval: janela === "agora" ? 15_000 : 60_000,
    placeholderData: (a) => a,
  });
  const u = q.data;
  const carregando = q.isLoading;
  const totalRecorte = Object.values(u?.por_perfil ?? {}).reduce((a, b) => a + b, 0);
  const ufs = Object.entries(u?.por_uf ?? {})
    .filter(([uf]) => uf !== "sem_uf")
    .sort((a, b) => b[1] - a[1]);
  const maiorUf = Math.max(1, ...ufs.map(([, n]) => n));

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Usuários ativos</h2>
          <p className="text-xs text-muted-foreground">
            Quem está usando o ecossistema, de onde e com qual perfil — Brasil inteiro.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmentos
            rotulo="Recorte"
            valor={janela}
            onChange={setJanela}
            opcoes={[
              { valor: "agora", rotulo: "Agora" },
              { valor: "24h", rotulo: "24 horas" },
              { valor: "30d", rotulo: "30 dias" },
            ]}
          />
          <SeloAoVivo
            atualizadoEm={q.dataUpdatedAt || null}
            atualizando={q.isFetching}
            falhou={q.isError}
            intervaloS={janela === "agora" ? 15 : 60}
            onAtualizar={() => q.refetch()}
          />
        </div>
      </div>

      {q.isError && (
        <EstadoErro
          erro={q.error}
          alternativa="Não foi possível ler os usuários ativos."
          onTentar={() => q.refetch()}
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi
          rotulo="Online agora"
          icone={<Pulso tom="ok" />}
          carregando={carregando}
          valor={fmtNum(u?.online_agora)}
          tom="ok"
          rodape="usaram nos últimos 5 minutos"
        />
        <Kpi
          rotulo="Ativos em 24 horas"
          icone={<Users className="size-4" />}
          carregando={carregando}
          valor={fmtNum(u?.ativos_24h)}
        />
        <Kpi
          rotulo="Ativos em 30 dias"
          icone={<CalendarDays className="size-4" />}
          carregando={carregando}
          valor={fmtNum(u?.ativos_30d)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Painel
          titulo="Por estado"
          icone={<MapPinned className="size-4" />}
          descricao={`Pessoas ${DESCRICAO[janela]}, pela UF do CRECI da conta.`}
        >
          {carregando ? (
            <Esqueleto className="mx-auto aspect-[6/9] w-full max-w-[340px]" />
          ) : (
            <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
              <MapaBrasil porUf={u?.por_uf ?? {}} rotuloValor="pessoas" />
              <div className="min-w-0">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Estados com mais pessoas
                </p>
                {ufs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Ninguém com UF definida neste recorte.
                  </p>
                ) : (
                  <ol className="space-y-2.5">
                    {ufs.slice(0, 8).map(([uf, n]) => (
                      <li key={uf}>
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="truncate text-foreground">
                            <strong className="font-semibold">{uf}</strong> · {NOME_UF[uf] ?? uf}
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-foreground">
                            {fmtNum(n)}
                          </span>
                        </div>
                        <div className="mt-1">
                          <BarraFina pct={(n / maiorUf) * 100} />
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                {(u?.sem_uf ?? 0) > 0 && (
                  <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground">
                    <strong className="font-semibold text-foreground">{fmtNum(u?.sem_uf)}</strong>{" "}
                    pessoa(s) sem UF — conta sem CRECI/UF cadastrado (equipe da plataforma e contas
                    que não informaram).
                  </p>
                )}
              </div>
            </div>
          )}
        </Painel>

        <div className="grid min-w-0 grid-cols-1 gap-3">
          <Painel
            titulo="Por perfil"
            icone={<UserRound className="size-4" />}
            descricao={`Pessoas ${DESCRICAO[janela]}.`}
          >
            {carregando ? (
              <Esqueleto className="h-40" />
            ) : totalRecorte === 0 ? (
              <EstadoVazio titulo="Ninguém neste recorte" className="py-6" />
            ) : (
              <>
                <div
                  className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
                  aria-hidden
                >
                  {PERFIS.map((p) => {
                    const n = u?.por_perfil[p.chave] ?? 0;
                    return n > 0 ? (
                      <span
                        key={p.chave}
                        style={{ width: `${(n / totalRecorte) * 100}%`, background: p.cor }}
                      />
                    ) : null;
                  })}
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-3">
                  {PERFIS.map((p) => (
                    <li key={p.chave} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: p.cor }}
                        />
                        <span className="truncate">{p.rotulo}</span>
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {fmtNum(u?.por_perfil[p.chave] ?? 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Painel>

          <Painel
            titulo="Tendência de 30 dias"
            icone={<CalendarDays className="size-4" />}
            descricao="Pessoas distintas que usaram o sistema em cada dia."
          >
            {carregando ? (
              <Esqueleto className="h-[150px]" />
            ) : (
              <>
                <GraficoSerie
                  dados={u?.tendencia_30d ?? []}
                  chaveX="dia"
                  rotuloX={dia}
                  altura="h-[150px] sm:h-[170px]"
                  series={[
                    { chave: "usuarios", rotulo: "Pessoas", cor: COR.primaria, tipo: "barra" },
                  ]}
                />
                {u?.retrato_desde && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Retrato diário guardado desde {dia(u.retrato_desde)}; antes disso, só o último
                    uso de cada sessão.
                  </p>
                )}
              </>
            )}
          </Painel>
        </div>
      </div>

      <Painel
        titulo="Quem está online"
        icone={<Pulso tom="ok" />}
        descricao="Último uso nos últimos 5 minutos (até 200 pessoas)."
      >
        {carregando ? (
          <Esqueleto className="h-32" />
        ) : !u?.lista_permitida ? (
          <EstadoVazio
            icone={<EyeOff className="size-5" />}
            titulo="Lista nominal restrita"
            texto="Nomes de quem está online só aparecem para quem pode ver as contas (permissão de licenças). Os números acima continuam valendo."
          />
        ) : !u.online?.length ? (
          <EstadoVazio titulo="Ninguém online agora" />
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {u.online.map((p, i) => (
              <li
                key={`${p.nome}-${i}`}
                className="flex min-h-14 items-center gap-3 rounded-lg border border-border px-3 py-2"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {p.nome
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((x) => x[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{p.nome}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {ROTULO_PERFIL[p.perfil] ?? p.perfil}
                    {p.conta ? ` · ${p.conta}` : ""}
                    {p.uf ? ` · ${p.uf}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {ha(p.ultimo_uso_em)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Painel>
    </div>
  );
}
