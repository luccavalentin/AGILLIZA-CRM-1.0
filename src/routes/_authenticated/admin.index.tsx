import type { ReactNode } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Bell,
  Building2,
  Cable,
  Cpu,
  DatabaseBackup,
  FolderOpen,
  KeySquare,
  Landmark,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
} from "lucide-react";
import { MODULOS_CONFIGURACOES_GERAIS } from "@/components/app-shell/nav-config";
import {
  CabecalhoGestao,
  EstadoVazio,
  IconeGestao,
  PaginaGestao,
  Selo,
  type Tom,
} from "@/components/plataforma/kit";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { usePermissoesCarregadas } from "@/hooks/use-permissao";
import { getMinhasPermissoes } from "@/lib/permissions.functions";
import { assertModuloPermitido } from "@/lib/route-guards";

/**
 * Configurações gerais — página inicial (pedido do dono, 26/10/2026, item C68: "ADMINISTRAÇÃO
 * DEVE SE CHAMAR CONFIGURAÇÕES GERAIS E PARÂMETROS DEVEM ESTAR DENTRO DELA").
 *
 * Um cartão por área, agrupados por assunto. Cada cartão aparece só para quem vê o módulo
 * daquela tela (os mesmos módulos do menu); o selo diz se a pessoa pode alterar ou só
 * consultar. A rota abre para quem vê qualquer uma das áreas (como o item do menu).
 */
export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Configurações gerais — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.pessoas", MODULOS_CONFIGURACOES_GERAIS),
  component: Pagina,
});

interface Area {
  titulo: string;
  descricao: string;
  to: string;
  modulo: string;
  icone: ReactNode;
  tom?: Tom;
}

const BLOCOS: { titulo: string; descricao: string; areas: Area[] }[] = [
  {
    titulo: "Pessoas e acesso",
    descricao: "Quem entra no sistema, com qual papel, e como cada um é avisado.",
    areas: [
      {
        titulo: "Pessoas e permissões",
        descricao: "Equipe interna e parceiros, papéis e a matriz de permissões organizada como o menu.",
        to: "/admin/pessoas",
        modulo: "admin.pessoas",
        icone: <UserCog />,
      },
      {
        titulo: "Notificações",
        descricao: "Quais avisos saem, por qual canal e para quem.",
        to: "/admin/notificacoes",
        modulo: "admin.notificacoes",
        icone: <Bell />,
      },
    ],
  },
  {
    titulo: "Operação",
    descricao: "Dados da empresa, bancos parceiros e inteligência artificial.",
    areas: [
      {
        titulo: "Parâmetros",
        descricao: "Dados da empresa, contatos, endereço e padrões usados em todo o sistema.",
        to: "/admin/parametros",
        modulo: "admin.parametros",
        icone: <Building2 />,
      },
      {
        titulo: "Bancos",
        descricao: "Bancos com que o correspondente opera, logos e acessos.",
        to: "/admin/bancos",
        modulo: "admin.integracoes",
        icone: <Landmark />,
      },
      {
        titulo: "APIs de IA",
        descricao: "Provedores de IA, modelos e limites de uso.",
        to: "/admin/apis-ia",
        modulo: "admin.integracoes",
        icone: <Cpu />,
      },
    ],
  },
  {
    titulo: "Integrações e Agilliza Tech",
    descricao: "Chaves dos provedores, filas de integração e regras globais da plataforma.",
    areas: [
      {
        titulo: "Chaves dos provedores",
        descricao: "Credenciais cifradas das integrações; a tela nunca mostra o valor.",
        to: "/plataforma/provedores",
        modulo: "saas.provedores",
        icone: <KeySquare />,
      },
      {
        titulo: "Integrações e filas",
        descricao: "Saúde das integrações, filas, reprocessamento e falhas.",
        to: "/plataforma/integracoes",
        modulo: "saas.integracoes",
        icone: <Cable />,
      },
      {
        titulo: "Configurações do Agilliza Tech",
        descricao: "Parâmetros globais que valem para todas as contas de assinantes.",
        to: "/plataforma/configuracoes",
        modulo: "saas.configuracoes",
        icone: <SlidersHorizontal />,
      },
    ],
  },
  {
    titulo: "Segurança e dados",
    descricao: "Rastro de tudo o que muda, exportações e cópias de segurança.",
    areas: [
      {
        titulo: "Auditoria e logs",
        descricao: "Quem fez o quê no Agilliza, com antes e depois.",
        to: "/admin/auditoria",
        modulo: "admin.auditoria",
        icone: <ShieldCheck />,
      },
      {
        titulo: "Exportações",
        descricao: "Relatórios e bases exportados, com histórico.",
        to: "/relatorios/exportacoes",
        modulo: "relatorios.geral",
        icone: <FolderOpen />,
      },
      {
        titulo: "Backup",
        descricao: "Cópias do banco e dos documentos, para guardar fora do sistema.",
        to: "/admin/backup",
        modulo: "admin.backup",
        icone: <DatabaseBackup />,
      },
    ],
  },
];

function Pagina() {
  const carregadas = usePermissoesCarregadas();
  return (
    <PaginaGestao>
      <CabecalhoGestao
        secao="Configurações gerais"
        icone={<SlidersHorizontal />}
        titulo="Configurações gerais"
        descricao="Tudo o que configura o ecossistema num lugar só: pessoas e permissões, parâmetros, bancos, integrações, Agilliza Tech e segurança."
      />
      {!carregadas ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-[14px]" />
          ))}
        </div>
      ) : (
        <Blocos />
      )}
    </PaginaGestao>
  );
}

function Blocos() {
  // A mesma matriz do menu e de `usePermissao` (já em cache pelo shell), lida uma vez para
  // todos os cartões.
  const { data } = useQuery({
    queryKey: ["minhas-permissoes"],
    queryFn: () => getMinhasPermissoes(),
    staleTime: 5 * 60_000,
  });
  const pode = (modulo: string, acao: "view" | "edit") =>
    !!data && (data.todas || data.chaves.includes(`${modulo}:${acao}`));

  const visiveis = BLOCOS.map((b) => ({
    ...b,
    areas: b.areas.filter((a) => pode(a.modulo, "view")),
  })).filter((b) => b.areas.length > 0);

  if (visiveis.length === 0) {
    return (
      <EstadoVazio
        icone={<SlidersHorizontal />}
        titulo="Nenhuma área liberada"
        descricao="Peça a quem administra o sistema para liberar as áreas de Configurações gerais no seu papel."
      />
    );
  }

  return (
    <div className="space-y-6">
      {visiveis.map((b) => (
        <section key={b.titulo} aria-labelledby={`bloco-${b.titulo}`} className="space-y-3">
          <div>
            <h2 id={`bloco-${b.titulo}`} className="text-[15px] font-semibold text-foreground">
              {b.titulo}
            </h2>
            <p className="text-sm text-muted-foreground">{b.descricao}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {b.areas.map((a) => (
              <Link
                key={a.to}
                to={a.to as string}
                className="group flex min-h-[8rem] flex-col gap-3 rounded-[14px] border border-border/80 bg-card p-4 shadow-[0_1px_2px_rgb(16_24_40/0.04)] transition-all hover:-translate-y-px hover:border-primary/30 hover:shadow-[0_6px_16px_-10px_rgb(0_10_112/0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
              >
                <div className="flex items-start justify-between gap-3">
                  <IconeGestao icone={a.icone} tom={a.tom ?? "marca"} tamanho="lg" />
                  <ArrowUpRight
                    className="size-4 text-muted-foreground transition-colors group-hover:text-primary"
                    aria-hidden
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{a.titulo}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{a.descricao}</p>
                </div>
                <div className="mt-auto">
                  {pode(a.modulo, "edit") ? (
                    <Selo tom="sucesso" ponto>
                      Você pode alterar
                    </Selo>
                  ) : (
                    <Selo>Só consulta</Selo>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
