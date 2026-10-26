import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  ABAS_PATROCINADOS,
  type AbaPatrocinados,
} from "@/components/plataforma/imobmatch/patrocinados";

/**
 * Endereço antigo da "Gestão de Parceiros e Anúncios" (Gestão de sistemas). Desde 28/10/2026
 * a gestão do ImobMatch é o menu próprio ImobMatch Gestão: favorito, notificação ou link
 * antigo leva à tela nova, na mesma aba. Cada tela nova confere a própria permissão.
 */
const MODERACAO = ["revisao", "denuncias", "comunidade", "chat", "moderados"] as const;
type AbaModeracao = (typeof MODERACAO)[number];
const PROFISSIONAIS = ["profissionais", "anunciantes"] as const;
type AbaProfissionais = (typeof PROFISSIONAIS)[number];

const ehDe = <T extends string>(lista: readonly T[], a: string | undefined): a is T =>
  !!a && (lista as readonly string[]).includes(a);

export const Route = createFileRoute("/_authenticated/plataforma/parceiros-anuncios")({
  validateSearch: (s: Record<string, unknown>): { aba?: string } => ({
    aba: typeof s.aba === "string" ? s.aba : undefined,
  }),
  beforeLoad: ({ search }) => {
    const aba = search.aba;
    if (ehDe<AbaPatrocinados>(ABAS_PATROCINADOS, aba)) {
      throw redirect({ to: "/imobmatch/patrocinados", search: { aba }, replace: true });
    }
    if (ehDe<AbaProfissionais>(PROFISSIONAIS, aba)) {
      throw redirect({ to: "/imobmatch/profissionais", search: { aba }, replace: true });
    }
    if (aba === "numeros") throw redirect({ to: "/imobmatch", replace: true });
    throw redirect({
      to: "/imobmatch/moderacao",
      search: { aba: ehDe<AbaModeracao>(MODERACAO, aba) ? aba : undefined },
      replace: true,
    });
  },
});
