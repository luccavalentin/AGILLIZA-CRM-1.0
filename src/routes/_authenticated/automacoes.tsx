import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import {
  SiFacebook,
  SiGoogle,
  SiInstagram,
  SiTiktok,
  SiWhatsapp,
  SiYoutube,
} from "@icons-pack/react-simple-icons";
import {
  BarChart3,
  CalendarDays,
  Images,
  LayoutList,
  PenSquare,
  Waypoints,
  Workflow,
} from "lucide-react";
import type { ComponentType } from "react";
import { SiLinkedIn } from "@/components/automacoes/marca-rede";
import { PageHeader } from "@/components/shared/page-header";
import { SubNavegacao } from "@/components/ui/sub-navegacao";
import { PaginaGestao } from "@/components/plataforma/kit";
import { assertModuloPermitido } from "@/lib/route-guards";
import { estadoAutomacoes } from "@/lib/social/automacoes.functions";

type Busca = { post?: string };

/**
 * Automações do Agilliza: a AgillizaTech agenda e publica nas próprias redes, no modelo do
 * Postei — Calendário, Posts, Novo post, Mídia, Relatórios e Redes. Chave própria
 * (`AUTOMACOES_AGILLIZA`, padrão ligada), independente do "Em breve" dos assinantes.
 */
export const Route = createFileRoute("/_authenticated/automacoes")({
  head: () => ({ meta: [{ title: "Automações — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>): Busca => ({
    post: typeof s.post === "string" && /^[0-9a-f-]{36}$/i.test(s.post) ? s.post : undefined,
  }),
  beforeLoad: async ({ search, location }) => {
    await assertModuloPermitido("marketing.automacoes");
    // Link antigo (aviso do sino): /automacoes?post=<id> → detalhe do post.
    if (
      search.post &&
      (location.pathname === "/automacoes" || location.pathname === "/automacoes/")
    ) {
      throw redirect({ to: "/automacoes/posts/$id", params: { id: search.post } });
    }
  },
  loader: () => estadoAutomacoes(),
  component: Layout,
});

const SUBMENU = [
  { to: "/automacoes", rotulo: "Calendário", icone: CalendarDays, exato: true },
  { to: "/automacoes/posts", rotulo: "Posts", icone: LayoutList },
  { to: "/automacoes/novo", rotulo: "Novo post", icone: PenSquare },
  { to: "/automacoes/midia", rotulo: "Mídia", icone: Images },
  { to: "/automacoes/relatorios", rotulo: "Relatórios", icone: BarChart3 },
  { to: "/automacoes/redes", rotulo: "Redes", icone: Waypoints },
];

function Layout() {
  const estado = Route.useLoaderData();
  if (!estado.ativo) return <Previa />;
  return (
    <PaginaGestao className="automacoes-pagina">
      <div className="space-y-3 print:hidden">
        <PageHeader
          secao="Marketing"
          icone={<Workflow className="h-5 w-5" />}
          titulo="Automações"
          descricao="Agende e publique posts, vídeos e stories nas redes da AgillizaTech, todas de uma vez, e acompanhe o resultado."
        />
        <SubNavegacao rotulo="Automações" itens={SUBMENU} />
      </div>
      <Outlet />
    </PaginaGestao>
  );
}

type Marca = ComponentType<{ className?: string; color?: string; title?: string }>;

const REDES: { nome: string; Icone: Marca }[] = [
  { nome: "Instagram", Icone: SiInstagram as Marca },
  { nome: "Facebook", Icone: SiFacebook as Marca },
  { nome: "WhatsApp", Icone: SiWhatsapp as Marca },
  { nome: "TikTok", Icone: SiTiktok as Marca },
  { nome: "YouTube", Icone: SiYoutube as Marca },
  { nome: "LinkedIn", Icone: SiLinkedIn },
  { nome: "Google", Icone: SiGoogle as Marca },
];

/** Servidor com `AUTOMACOES_AGILLIZA=0`: só a prévia, nada conecta nem publica. */
function Previa() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <PageHeader
        secao="Marketing"
        icone={<Workflow className="h-5 w-5" />}
        titulo="Automações"
        descricao="Divulgue nas redes sociais direto do Agilliza."
      />
      <section className="rounded-2xl border bg-card px-4 pb-6 pt-8 text-center shadow-sm sm:px-8 sm:pt-10">
        <span className="inline-flex h-[26px] items-center gap-[7px] rounded-full bg-[rgb(242_182_87/0.16)] pl-[9px] pr-[11px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9a5b00] shadow-[inset_0_0_0_1px_rgb(242_182_87/0.45)]">
          <span className="selo-em-breve-ponto" aria-hidden />
          Desligada neste servidor
        </span>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
          Suas redes, num lugar só
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          As Automações estão desligadas neste servidor (AUTOMACOES_AGILLIZA=0).
        </p>
        <ul
          data-tour="automacoes-redes"
          aria-label="Redes"
          className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-2 sm:gap-3"
        >
          {REDES.map(({ nome, Icone }) => (
            <li
              key={nome}
              className="flex w-[calc((100%-24px)/4)] flex-col items-center gap-2 rounded-xl border bg-background px-1 pb-2.5 pt-3 sm:w-[96px] sm:px-2 sm:pb-3.5 sm:pt-4"
            >
              <span className="grid h-[42px] w-[42px] place-items-center rounded-xl bg-muted/60 sm:h-12 sm:w-12">
                <Icone className="h-7 w-7" color="default" title={nome} />
              </span>
              <span className="text-[11.5px] font-medium text-foreground sm:text-[12.5px]">
                {nome}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
