import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ScrollText, ShieldCheck } from "lucide-react";
import { CabecalhoGestao, PaginaGestao } from "@/components/plataforma/kit";
import { AbaAuditoria } from "@/components/plataforma/auditoria/aba-auditoria";
import { AbaLgpd } from "@/components/plataforma/lgpd/aba-lgpd";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissao, usePermissoesCarregadas } from "@/hooks/use-permissao";
import { assertModuloPermitido } from "@/lib/route-guards";

/**
 * Auditoria da plataforma e LGPD numa aba só (pedido do dono, 26/10/2026: "AUDITORIA DA
 * PLATAFORMA E LGPD DEVEM ESTAR NA MESMA ABA"). Cada aba exige o seu módulo
 * (`saas.auditoria` | `saas.lgpd`); a rota abre para quem vê qualquer um dos dois, como o
 * menu. O endereço antigo `/plataforma/lgpd` redireciona para `?aba=lgpd`.
 */
const ABAS = ["auditoria", "lgpd"] as const;
type Aba = (typeof ABAS)[number];

/** A aba do endereço (`?aba=`) é aceita só se for uma das conhecidas. */
const abaValida = (a: unknown): Aba | undefined =>
  typeof a === "string" && (ABAS as readonly string[]).includes(a) ? (a as Aba) : undefined;

export const Route = createFileRoute("/_authenticated/plataforma/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria e LGPD — Gestão de sistemas — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>): { aba?: Aba } => ({ aba: abaValida(s.aba) }),
  beforeLoad: () => assertModuloPermitido("saas.auditoria", ["saas.lgpd"]),
  component: Pagina,
});

function Pagina() {
  const { aba: pedida } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const verAuditoria = usePermissao("saas.auditoria", "view");
  const verLgpd = usePermissao("saas.lgpd", "view");
  const carregadas = usePermissoesCarregadas();

  // A aba pedida vale se a pessoa pode vê-la; senão, a que ela pode.
  let aba: Aba = pedida ?? (verAuditoria || !verLgpd ? "auditoria" : "lgpd");
  if (carregadas && aba === "auditoria" && !verAuditoria && verLgpd) aba = "lgpd";
  if (carregadas && aba === "lgpd" && !verLgpd && verAuditoria) aba = "auditoria";
  const duas = verAuditoria && verLgpd;

  return (
    <PaginaGestao>
      <CabecalhoGestao
        icone={aba === "lgpd" ? <ShieldCheck /> : <ScrollText />}
        titulo="Auditoria e LGPD"
        descricao={
          aba === "lgpd"
            ? "Pedidos de titulares das contas de assinantes, termos vigentes e consentimentos. O prazo legal de resposta é de 15 dias."
            : "Quem mudou o quê, quando e em qual conta de assinante. O registro não pode ser alterado depois de gravado."
        }
      />

      <Tabs
        value={aba}
        onValueChange={(v) =>
          navigate({ search: { aba: v as Aba }, replace: true, resetScroll: false })
        }
      >
        {duas && (
          <TabsList className="h-auto w-full justify-start sm:w-auto">
            <TabsTrigger value="auditoria" className="min-h-11 flex-1 gap-1.5 sm:min-h-8 sm:flex-none">
              <ScrollText className="size-4" /> Auditoria
            </TabsTrigger>
            <TabsTrigger value="lgpd" className="min-h-11 flex-1 gap-1.5 sm:min-h-8 sm:flex-none">
              <ShieldCheck className="size-4" /> LGPD
            </TabsTrigger>
          </TabsList>
        )}
        {(verAuditoria || !carregadas) && (
          <TabsContent value="auditoria" className="mt-4">
            {aba === "auditoria" && <AbaAuditoria />}
          </TabsContent>
        )}
        {(verLgpd || !carregadas) && (
          <TabsContent value="lgpd" className="mt-4">
            {aba === "lgpd" && <AbaLgpd />}
          </TabsContent>
        )}
      </Tabs>
    </PaginaGestao>
  );
}
