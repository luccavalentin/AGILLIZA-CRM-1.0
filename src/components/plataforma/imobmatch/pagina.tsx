import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Handshake, ImageIcon, RefreshCw, Store } from "lucide-react";
import { AdminHero } from "@/components/admin/admin-hero";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissao, usePermissoesCarregadas } from "@/hooks/use-permissao";
import { cn } from "@/lib/utils";
import { lerResumoImobMatch } from "@/lib/plataforma/imobmatch.functions";
import { AbaAnunciantes } from "./aba-anunciantes";
import { AbaDenuncias } from "./aba-denuncias";
import { AbaModerados } from "./aba-moderados";
import { AbaNumeros } from "./aba-numeros";
import { AbaProfissionais } from "./aba-profissionais";
import { AbaRevisao, CHAVE_IMOBMATCH } from "./aba-revisao";
import { CHAVE_BANNERS } from "./banners-comum";
import { Resumo } from "./comum";
import {
  ABAS_PATROCINADOS,
  AbaBanners,
  ROTULO_PATROCINADOS,
  type AbaPatrocinados,
} from "./patrocinados";

/**
 * Gestão de Parceiros e Anúncios (pedido do dono, 25/10/2026): o ImobMatch gerido pela
 * equipe Agilliza. Duas áreas, cada uma com a sua permissão:
 *   · Anúncios e parceiros (`saas.imobmatch`): revisão, denúncias, moderados, CRECI,
 *     anunciantes e números — funções `plataforma.imobmatch_*` (0283 do Corretor);
 *   · Banners patrocinados (`saas.patrocinados`): funções `plataforma.patrocinio_*` (F3).
 */

export const ABAS_IMOBMATCH = [
  "revisao",
  "denuncias",
  "moderados",
  "profissionais",
  "anunciantes",
  "numeros",
] as const;
type AbaImobMatch = (typeof ABAS_IMOBMATCH)[number];
export type AbaGestao = AbaImobMatch | AbaPatrocinados;

const ROTULO_IMOBMATCH: Record<AbaImobMatch, string> = {
  revisao: "Anúncios em revisão",
  denuncias: "Denúncias",
  moderados: "Moderados",
  profissionais: "Profissionais (CRECI)",
  anunciantes: "Anunciantes",
  numeros: "Números do ImobMatch",
};

const ehImobMatch = (a: string): a is AbaImobMatch =>
  (ABAS_IMOBMATCH as readonly string[]).includes(a);
const ehPatrocinados = (a: string): a is AbaPatrocinados =>
  (ABAS_PATROCINADOS as readonly string[]).includes(a);

/** A aba do endereço (`?aba=`) é aceita só se for uma das conhecidas. */
export const abaValida = (a: unknown): AbaGestao | undefined =>
  typeof a === "string" && (ehImobMatch(a) || ehPatrocinados(a)) ? a : undefined;

export function GestaoParceirosAnuncios({
  abaPedida,
  onAba,
}: {
  abaPedida: AbaGestao | undefined;
  onAba: (a: AbaGestao) => void;
}) {
  const verImobMatch = usePermissao("saas.imobmatch", "view");
  const verBanners = usePermissao("saas.patrocinados", "view");
  const carregadas = usePermissoesCarregadas();
  const qc = useQueryClient();

  const padrao: AbaGestao = verImobMatch || !verBanners ? "revisao" : "patrocinadores";
  let aba: AbaGestao = abaPedida ?? padrao;
  if (carregadas && ehImobMatch(aba) && !verImobMatch && verBanners) aba = "patrocinadores";
  if (carregadas && ehPatrocinados(aba) && !verBanners) aba = "revisao";
  const area = ehPatrocinados(aba) ? "banners" : "imobmatch";
  const irPara = onAba;

  const resumoFn = useServerFn(lerResumoImobMatch);
  const resumo = useQuery({
    queryKey: [...CHAVE_IMOBMATCH, "resumo"],
    queryFn: () => resumoFn(),
    staleTime: 20_000,
    enabled: verImobMatch,
  });
  const r = resumo.data;
  const contagem: Partial<Record<AbaImobMatch, number>> = {
    revisao: r?.revisao,
    denuncias: r?.denuncias,
    moderados: r?.moderados,
    profissionais: r?.creci_pendentes,
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        secao="Plataforma · ImobMatch"
        icon={<Handshake className="h-5 w-5" />}
        titulo="Gestão de Parceiros e Anúncios"
        descricao="Revisar endereços repetidos, julgar denúncias, moderar anúncios, conferir CRECI e acompanhar o ImobMatch. Toda decisão fica registrada e o anunciante é avisado."
        acoes={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              qc.invalidateQueries({ queryKey: CHAVE_IMOBMATCH });
              qc.invalidateQueries({ queryKey: CHAVE_BANNERS });
            }}
          >
            <RefreshCw className={cn("mr-2 size-4", resumo.isFetching && "animate-spin")} />{" "}
            Atualizar
          </Button>
        }
      />

      {verImobMatch && verBanners && (
        <div
          className="inline-flex w-full rounded-lg bg-muted p-1 sm:w-auto"
          role="tablist"
          aria-label="Área"
        >
          {(
            [
              {
                id: "imobmatch",
                rotulo: "Anúncios e parceiros",
                curto: "Anúncios",
                icone: Store,
                ir: "revisao",
              },
              {
                id: "banners",
                rotulo: "Banners patrocinados",
                curto: "Banners",
                icone: ImageIcon,
                ir: "patrocinadores",
              },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              role="tab"
              aria-selected={area === o.id}
              onClick={() => irPara(o.ir)}
              className={cn(
                "inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors sm:flex-none",
                area === o.id
                  ? "bg-background text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <o.icone className="size-4" aria-hidden />
              <span className="sm:hidden">{o.curto}</span>
              <span className="hidden sm:inline">{o.rotulo}</span>
            </button>
          ))}
        </div>
      )}

      {area === "imobmatch" && verImobMatch && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Resumo
              rotulo="Em revisão"
              valor={String(r?.revisao ?? 0)}
              detalhe="mesmo endereço de outra conta"
              alerta={(r?.revisao ?? 0) > 0}
              carregando={resumo.isLoading}
              onClick={() => irPara("revisao")}
            />
            <Resumo
              rotulo="Denúncias a julgar"
              valor={String(r?.denuncias ?? 0)}
              detalhe="anúncios denunciados"
              alerta={(r?.denuncias ?? 0) > 0}
              carregando={resumo.isLoading}
              onClick={() => irPara("denuncias")}
            />
            <Resumo
              rotulo="CRECI a conferir"
              valor={String(r?.creci_pendentes ?? 0)}
              detalhe="pedidos de verificação"
              alerta={(r?.creci_pendentes ?? 0) > 0}
              carregando={resumo.isLoading}
              onClick={() => irPara("profissionais")}
            />
            <Resumo
              rotulo="Anúncios no ar"
              valor={String(r?.no_ar ?? 0)}
              detalhe={`${r?.moderados ?? 0} moderado(s)`}
              carregando={resumo.isLoading}
              onClick={() => irPara("numeros")}
            />
          </div>

          <Tabs value={aba} onValueChange={(v) => irPara(v as AbaGestao)}>
            <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
              <TabsList className="h-auto min-h-10 w-max">
                {ABAS_IMOBMATCH.map((a) => (
                  <TabsTrigger key={a} value={a} className="min-h-8 gap-1.5">
                    {ROTULO_IMOBMATCH[a]}
                    {!!contagem[a] && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 text-[11px] tabular-nums",
                          a === "moderados"
                            ? "bg-muted-foreground/15 text-muted-foreground"
                            : "bg-amber-500/15 text-amber-800 dark:text-amber-300",
                        )}
                      >
                        {contagem[a]}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <TabsContent value="revisao" className="mt-4">
              <AbaRevisao />
            </TabsContent>
            <TabsContent value="denuncias" className="mt-4">
              <AbaDenuncias />
            </TabsContent>
            <TabsContent value="moderados" className="mt-4">
              <AbaModerados />
            </TabsContent>
            <TabsContent value="profissionais" className="mt-4">
              <AbaProfissionais />
            </TabsContent>
            <TabsContent value="anunciantes" className="mt-4">
              <AbaAnunciantes />
            </TabsContent>
            <TabsContent value="numeros" className="mt-4">
              <AbaNumeros />
            </TabsContent>
          </Tabs>
        </>
      )}

      {area === "banners" && verBanners && (
        <Tabs value={aba} onValueChange={(v) => irPara(v as AbaGestao)}>
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <TabsList className="h-auto min-h-10 w-max">
              {ABAS_PATROCINADOS.map((a) => (
                <TabsTrigger key={a} value={a} className="min-h-8">
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
      )}
    </div>
  );
}
