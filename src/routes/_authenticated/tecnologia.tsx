import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
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
import { Logo } from "@/components/brand/Logo";
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

const ABAS = [
  { to: "/tecnologia", rotulo: "Visão geral", icone: Radar, exato: true },
  { to: "/tecnologia/operacao", rotulo: "Operação", icone: Waves },
  { to: "/tecnologia/servidor", rotulo: "Servidor", icone: Server },
  { to: "/tecnologia/erros", rotulo: "Erros", icone: Bug },
  { to: "/tecnologia/logs", rotulo: "Logs", icone: TerminalSquare },
  { to: "/tecnologia/usuarios", rotulo: "Usuários", icone: MapPinned },
  { to: "/tecnologia/alertas", rotulo: "Alertas", icone: BellRing },
] as const;

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
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Logo variant={tema === "escuro" ? "light" : "dark"} className="h-7 shrink-0 sm:h-8" />
            <span aria-hidden className="h-9 w-px shrink-0 bg-border" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Agilliza · Agilliza Tech</p>
              <h1 className="truncate text-xl font-medium tracking-tight text-foreground sm:text-2xl">
                Gestão de Tecnologia
              </h1>
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center">
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
          aria-label="Seções da Gestão de Tecnologia"
          className="no-scrollbar -mx-3 flex gap-1 overflow-x-auto border-b border-border px-3 sm:mx-0 sm:px-0"
        >
          {ABAS.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              activeOptions={{ exact: "exato" in a && a.exato }}
              className="group relative inline-flex min-h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground", "aria-current": "page" }}
            >
              <a.icone className="size-4" />
              {a.rotulo}
              <span
                aria-hidden
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-transparent group-aria-[current=page]:bg-[color:var(--realce)]"
              />
            </Link>
          ))}
        </nav>

        <Outlet />
      </div>
    </div>
  );
}
