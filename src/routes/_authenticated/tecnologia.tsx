import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  BellRing,
  Bug,
  Cable,
  KeyRound,
  MapPinned,
  Radar,
  ScrollText,
  Server,
  TerminalSquare,
  Waves,
} from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { Icone3D, type TomIcone3D } from "@/components/ui/icone-3d";
import { ProvedorTema, TrocaTema, classeDoTema, useTema } from "@/components/tecnologia/tema";

/**
 * Gestão de Tecnologia — centro de controle técnico do ecossistema (Agilliza + Corretor
 * 2.0). Telas nativas sobre o banco da plataforma (ponte 0175, migração 0233). O que já
 * existe em outra tela (tratar incidente, reprocessar fila, licenças, auditoria) fica
 * como atalho, não é duplicado aqui.
 */
export const Route = createFileRoute("/_authenticated/tecnologia")({
  beforeLoad: () => assertModuloPermitido("saas.tecnologia"),
  head: () => ({ meta: [{ title: "Gestão de Tecnologia — Agilliza" }] }),
  component: Layout,
});

/**
 * Submenus (C66, 26/10/2026): "Visão geral ao vivo" é a tela principal; as demais são
 * submenus com o MESMO nome do menu lateral, a mesma peça 3D e uma linha dizendo o que a
 * tela mede e de onde vem.
 */
const ABAS: {
  to: string;
  rotulo: string;
  icone: typeof Radar;
  tom: TomIcone3D;
  exato?: boolean;
  descricao: string;
}[] = [
  {
    to: "/tecnologia",
    rotulo: "Visão geral ao vivo",
    icone: Radar,
    tom: "marca",
    exato: true,
    descricao:
      "Saúde dos dois sistemas, tráfego e usuários do Agilliza Tech, erros, incidentes e licenças, com leitura a cada 12 s.",
  },
  {
    to: "/tecnologia/operacao",
    rotulo: "Operação",
    icone: Waves,
    tom: "info",
    descricao:
      "Requisições, falhas, latência p50/p95 por rota e por licença, filas e provedores na janela escolhida.",
  },
  {
    to: "/tecnologia/servidor",
    rotulo: "Servidor",
    icone: Server,
    tom: "ciano",
    descricao:
      "Disco, memória, carga, containers, backup e certificado da VPS, pela última coleta do host.",
  },
  {
    to: "/tecnologia/erros",
    rotulo: "Erros dos usuários",
    icone: Bug,
    tom: "alerta",
    descricao:
      "Erros do navegador e do servidor dos dois sistemas, agrupados, com ocorrências e pessoas afetadas.",
  },
  {
    to: "/tecnologia/logs",
    rotulo: "Logs",
    icone: TerminalSquare,
    tom: "neutro",
    descricao:
      "Requisições com erro, chamadas a provedores e execuções de rotinas numa lista só (até 14 dias).",
  },
  {
    to: "/tecnologia/usuarios",
    rotulo: "Usuários ativos",
    icone: MapPinned,
    tom: "violeta",
    descricao: "Quem usa o Agilliza Tech agora, em 24 horas e em 30 dias, por perfil e por estado.",
  },
  {
    to: "/tecnologia/alertas",
    rotulo: "Alertas",
    icone: BellRing,
    tom: "perigo",
    descricao: "Limites que abrem incidente sozinhos e quem é avisado.",
  },
];

function Layout() {
  return (
    <ProvedorTema>
      <Conteudo />
    </ProvedorTema>
  );
}

function Conteudo() {
  const { tema } = useTema();
  const classeTema = classeDoTema(tema);
  const caminho = useRouterState({ select: (s) => s.location.pathname }).replace(/\/+$/, "");
  const atual =
    ABAS.find((a) => (a.exato ? caminho === a.to : caminho.startsWith(a.to))) ?? ABAS[0];
  const verMonitoramento = usePermissao("saas.monitoramento", "view");
  const verIntegracoes = usePermissao("saas.integracoes", "view");
  const verLicencas = usePermissao("saas.licencas", "view");
  const verAuditoria = usePermissao("saas.auditoria", "view");
  const atalhos = [
    verMonitoramento && { to: "/plataforma/monitoramento", rotulo: "Incidentes", icone: Activity },
    verIntegracoes && { to: "/plataforma/integracoes", rotulo: "Filas", icone: Cable },
    verLicencas && { to: "/plataforma/licencas", rotulo: "Licenças", icone: KeyRound },
    verAuditoria && { to: "/plataforma/auditoria", rotulo: "Auditoria", icone: ScrollText },
  ].filter(Boolean) as { to: string; rotulo: string; icone: typeof Activity }[];

  return (
    // Ocupa a área inteira do conteúdo (desfaz o respiro do <main>) para o tema da central
    // cobrir tudo; o menu e a barra de cima do Agilliza não mudam.
    <div
      className={`${classeTema} -m-3 min-h-[calc(100dvh-3.5rem)] bg-background text-foreground sm:-m-4 lg:-m-6`}
    >
      <div className="mx-auto w-full max-w-[1600px] min-w-0 space-y-5 p-3 sm:p-4 md:space-y-6 md:p-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <Icone3D icone={atual.icone} tom={atual.tom} tamanho="xl" className="mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                Gestão de Tecnologia · Agilliza e Agilliza Tech
              </p>
              <h1 className="truncate text-xl font-medium tracking-tight text-foreground sm:text-2xl">
                {atual.rotulo}
              </h1>
              <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
                {atual.descricao}
              </p>
            </div>
          </div>
          <div data-tour="tecnologia-tema-atalhos" className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center">
            <TrocaTema />
            {atalhos.length > 0 && (
              <nav
                aria-label="Atalhos"
                className="no-scrollbar -mx-3 flex gap-2 self-stretch overflow-x-auto px-3 sm:mx-0 sm:self-auto sm:px-0"
              >
                {atalhos.map((a) => (
                  <Link
                    key={a.to}
                    to={a.to}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:border-[color:var(--realce)] hover:text-foreground lg:min-h-9"
                  >
                    <a.icone className="size-3.5" />
                    {a.rotulo}
                    <ArrowUpRight className="size-3 opacity-60" />
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </header>

        <nav
          data-tour="tecnologia-secoes"
          aria-label="Seções da Gestão de Tecnologia"
          className="tec-abas no-scrollbar -mx-3 flex gap-1 overflow-x-auto px-3 sm:mx-0 sm:px-1"
        >
          {ABAS.map((a) => {
            const ativa = a === atual;
            return (
              <Link
                key={a.to}
                to={a.to}
                aria-current={ativa ? "page" : undefined}
                className="tec-aba group relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icone3D icone={a.icone} tom={a.tom} tamanho="xs" />
                {a.rotulo}
              </Link>
            );
          })}
        </nav>

        <Outlet />
      </div>
    </div>
  );
}
