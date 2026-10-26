import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
  BadgeCheck,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Wallet,
} from "lucide-react";
import { MODULOS_IMOBMATCH_GESTAO } from "@/components/app-shell/nav-config";
import { MarcaImobMatch } from "@/components/imobmatch-gestao/comum";
import { SubNavegacao, type ItemSubNavegacao } from "@/components/ui/sub-navegacao";
import { usePermissao } from "@/hooks/use-permissao";
import { assertModuloPermitido } from "@/lib/route-guards";

/**
 * ImobMatch Gestão (pedido do dono, 28/10/2026): toda a gestão sistêmica e financeira do
 * ImobMatch no Agilliza correspondente — números, moderação, profissionais e anunciantes,
 * banners, financeiro, planos e configurações. Nenhuma tela de administração do ImobMatch
 * fica fora daqui (o antigo portal da Gestão do Corretor já leva ao aviso de mudança).
 * Cada tela confere o próprio módulo; o trilho mostra só as que a pessoa pode abrir.
 */
export const Route = createFileRoute("/_authenticated/imobmatch")({
  beforeLoad: () => assertModuloPermitido("imobmatch.visao", MODULOS_IMOBMATCH_GESTAO),
  head: () => ({ meta: [{ title: "ImobMatch Gestão — Agilliza" }] }),
  component: Layout,
});

function Layout() {
  const visao = usePermissao("imobmatch.visao", "view");
  const financeiro = usePermissao("imobmatch.financeiro", "view");
  const moderacaoNova = usePermissao("imobmatch.moderacao", "view");
  const moderacaoAntiga = usePermissao("saas.imobmatch", "view");
  const banners = usePermissao("saas.patrocinados", "view");
  const planos = usePermissao("imobmatch.planos", "view");
  const config = usePermissao("imobmatch.config", "view");
  const moderacao = moderacaoNova || moderacaoAntiga;

  const itens = [
    (visao || financeiro) && {
      to: "/imobmatch",
      rotulo: "Visão geral",
      icone: LayoutDashboard,
      exato: true,
    },
    moderacao && {
      to: "/imobmatch/moderacao",
      rotulo: "Anúncios e moderação",
      icone: ShieldCheck,
      tom: "alerta",
    },
    (moderacao || financeiro) && {
      to: "/imobmatch/profissionais",
      rotulo: "Profissionais e anunciantes",
      icone: BadgeCheck,
      tom: "info",
    },
    banners && {
      to: "/imobmatch/patrocinados",
      rotulo: "Patrocinados e banners",
      icone: Megaphone,
      tom: "violeta",
    },
    financeiro && {
      to: "/imobmatch/financeiro",
      rotulo: "Financeiro",
      icone: Wallet,
      tom: "sucesso",
    },
    planos && { to: "/imobmatch/planos", rotulo: "Planos e preços", icone: Tags, tom: "ciano" },
    config && {
      to: "/imobmatch/configuracoes",
      rotulo: "Configurações",
      icone: SlidersHorizontal,
      tom: "neutro",
    },
  ].filter(Boolean) as ItemSubNavegacao[];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px] space-y-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <MarcaImobMatch compacta />
        <p className="text-xs text-muted-foreground">Gestão do ImobMatch pela equipe Agilliza</p>
      </div>
      {itens.length > 1 && <SubNavegacao rotulo="ImobMatch Gestão" itens={itens} />}
      <Outlet />
    </div>
  );
}
