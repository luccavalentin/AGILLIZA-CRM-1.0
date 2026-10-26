import { createFileRoute, redirect } from "@tanstack/react-router";
import { abaValida, type AbaGestao } from "@/components/plataforma/imobmatch/pagina";
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

export const Route = createFileRoute("/_authenticated/plataforma/parceiros-anuncios")({
  validateSearch: (s: Record<string, unknown>): { aba?: AbaGestao } => ({ aba: abaValida(s.aba) }),
  beforeLoad: ({ search }) => {
    const aba = search.aba;
    if (aba && (ABAS_PATROCINADOS as readonly string[]).includes(aba)) {
      throw redirect({
        to: "/imobmatch/patrocinados",
        search: { aba: aba as AbaPatrocinados },
        replace: true,
      });
    }
    if (aba === "profissionais" || aba === "anunciantes") {
      throw redirect({ to: "/imobmatch/profissionais", search: { aba }, replace: true });
    }
    if (aba === "numeros") throw redirect({ to: "/imobmatch", replace: true });
    throw redirect({
      to: "/imobmatch/moderacao",
      search: {
        aba:
          aba && (MODERACAO as readonly string[]).includes(aba) ? (aba as AbaModeracao) : undefined,
      },
      replace: true,
    });
  },
});
