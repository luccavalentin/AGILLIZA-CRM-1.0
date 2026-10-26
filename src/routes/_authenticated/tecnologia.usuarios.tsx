import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, EyeOff, MapPinned, Radio, UserRound, Users } from "lucide-react";
import {
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
import { MapaBrasil } from "@/components/tecnologia/mapa-brasil";
import { RoscaUsuarios, TabelaUfs } from "@/components/tecnologia/central";
import { lerUsuarios } from "@/lib/tecnologia/tecnologia.functions";

export const Route = createFileRoute("/_authenticated/tecnologia/usuarios")({
  head: () => ({ meta: [{ title: "Usuários ativos — Gestão de Tecnologia — Agilliza" }] }),
  component: Usuarios,
});

type JanelaUsuarios = "agora" | "24h" | "30d";

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

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            Medido pelas sessões do Agilliza Tech (corretores, imobiliárias, parceiros e clientes).
            Quem usa o Agilliza correspondente só aparece, como "Plataforma", ao abrir telas da
            plataforma pela ponte.
          </p>
        </div>
        <div data-tour="tecnologia-usuarios-recorte" className="flex flex-wrap items-center gap-2">
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

      <div data-tour="tecnologia-usuarios-indicadores" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi
          rotulo="Online agora"
          janela="5 min"
          cor="verde"
          icone={<Radio />}
          carregando={carregando}
          valor={fmtNum(u?.online_agora)}
          tom="ok"
          rodape="usaram nos últimos 5 minutos"
        />
        <Kpi
          rotulo="Ativos em 24 horas"
          janela="24 h"
          cor="azul"
          icone={<Users className="size-4" />}
          carregando={carregando}
          valor={fmtNum(u?.ativos_24h)}
        />
        <Kpi
          rotulo="Ativos em 30 dias"
          janela="30 dias"
          cor="roxo"
          icone={<CalendarDays className="size-4" />}
          carregando={carregando}
          valor={fmtNum(u?.ativos_30d)}
        />
      </div>

      <div data-tour="tecnologia-usuarios-mapa" className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Painel
          titulo="Por estado"
          icone={<MapPinned className="size-4" />}
          descricao={`Pessoas ${DESCRICAO[janela]}, pela UF do CRECI da conta.`}
        >
          {carregando ? (
            <Esqueleto className="mx-auto aspect-square w-full max-w-[520px]" />
          ) : (
            <div className="grid grid-cols-1 items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
              <MapaBrasil
                porUf={u?.por_uf ?? {}}
                online={janela === "agora" ? u?.por_uf : undefined}
                rotuloValor="pessoas"
              />
              <div className="min-w-0">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Estados com mais pessoas
                </p>
                <TabelaUfs porUf={u?.por_uf ?? {}} limite={8} />
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
              <RoscaUsuarios
                porPerfil={u?.por_perfil ?? {}}
                total={totalRecorte}
                rotuloCentro={
                  janela === "agora"
                    ? "online agora"
                    : janela === "24h"
                      ? "em 24 horas"
                      : "em 30 dias"
                }
              />
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
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color:var(--realce-suave)] text-xs font-semibold text-[color:var(--realce)]">
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
