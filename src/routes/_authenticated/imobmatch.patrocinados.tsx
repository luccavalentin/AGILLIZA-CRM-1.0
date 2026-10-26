import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Megaphone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CabecalhoGestao, PaginaGestao } from "@/components/plataforma/kit";
import { CHAVE_BANNERS } from "@/components/plataforma/imobmatch/banners-comum";
import {
  ABAS_PATROCINADOS,
  AbaBanners,
  ROTULO_PATROCINADOS,
  type AbaPatrocinados,
} from "@/components/plataforma/imobmatch/patrocinados";
import { assertModuloPermitido } from "@/lib/route-guards";

/**
 * ImobMatch Gestão › Patrocinados e banners: patrocinadores, fila de criativos (com a
 * prévia), pacotes e preços, campanhas no ar e métricas — as abas que já existiam, com as
 * funções `plataforma.patrocinio_*` (0275–0278 do Corretor) e a permissão `saas.patrocinados`.
 */
export const Route = createFileRoute("/_authenticated/imobmatch/patrocinados")({
  head: () => ({ meta: [{ title: "Patrocinados e banners — ImobMatch Gestão — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>): { aba?: AbaPatrocinados } => ({
    aba:
      typeof s.aba === "string" && (ABAS_PATROCINADOS as readonly string[]).includes(s.aba)
        ? (s.aba as AbaPatrocinados)
        : undefined,
  }),
  beforeLoad: () => assertModuloPermitido("saas.patrocinados"),
  component: Pagina,
});

function Pagina() {
  const { aba = "patrocinadores" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();
  return (
    <PaginaGestao>
      <CabecalhoGestao
        secao="ImobMatch Gestão"
        titulo="Patrocinados e banners"
        icone={<Megaphone />}
        descricao="Patrocinadores, a fila de criativos com a prévia do banner, pacotes e preços, campanhas no ar e as métricas de entrega."
        acoes={
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-9"
            onClick={() => void qc.invalidateQueries({ queryKey: CHAVE_BANNERS })}
          >
            <RefreshCw className="mr-1.5 size-4" /> Atualizar
          </Button>
        }
      />
      <Tabs
        value={aba}
        onValueChange={(v) =>
          void navigate({ search: { aba: v as AbaPatrocinados }, replace: true })
        }
      >
        <div
          data-tour="imobmatch-patrocinados-abas"
          className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0"
        >
          <TabsList className="h-auto min-h-10 w-max">
            {ABAS_PATROCINADOS.map((a) => (
              <TabsTrigger key={a} value={a} className="min-h-11 sm:min-h-8">
                {ROTULO_PATROCINADOS[a]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {ABAS_PATROCINADOS.map((a) => (
          <TabsContent key={a} value={a} className="mt-4">
            <AbaBanners aba={a} />
          </TabsContent>
        ))}
      </Tabs>
    </PaginaGestao>
  );
}
