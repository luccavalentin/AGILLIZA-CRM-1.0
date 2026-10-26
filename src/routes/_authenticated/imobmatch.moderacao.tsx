import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  EyeOff,
  Flag,
  MessagesSquare,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CabecalhoGestao,
  FaixaIndicadores,
  Indicador,
  PaginaGestao,
} from "@/components/plataforma/kit";
import { AbaChat } from "@/components/plataforma/imobmatch/aba-chat";
import { AbaComunidade } from "@/components/plataforma/imobmatch/aba-comunidade";
import { AbaDenuncias } from "@/components/plataforma/imobmatch/aba-denuncias";
import { AbaModerados } from "@/components/plataforma/imobmatch/aba-moderados";
import { AbaRevisao, CHAVE_IMOBMATCH } from "@/components/plataforma/imobmatch/aba-revisao";
import { inteiro } from "@/components/imobmatch-gestao/comum";
import { assertModuloPermitido } from "@/lib/route-guards";
import { lerResumoImobMatch } from "@/lib/plataforma/imobmatch.functions";
import { cn } from "@/lib/utils";

const ABAS = ["revisao", "denuncias", "comunidade", "chat", "moderados"] as const;
type Aba = (typeof ABAS)[number];
const ROTULO: Record<Aba, string> = {
  revisao: "Em revisão",
  denuncias: "Denúncias",
  comunidade: "Comunidade",
  chat: "Chat",
  moderados: "Moderados",
};

/**
 * ImobMatch Gestão › Anúncios e moderação: revisão de endereço repetido, denúncias, a
 * Comunidade, o chat e os anúncios moderados. As abas são as da antiga "Gestão de Parceiros
 * e Anúncios" (`components/plataforma/imobmatch`), com as funções `plataforma.imobmatch_*`
 * (0283), da comunidade (0311) e do chat (0352) do Corretor.
 */
export const Route = createFileRoute("/_authenticated/imobmatch/moderacao")({
  head: () => ({ meta: [{ title: "Anúncios e moderação — ImobMatch Gestão — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>): { aba?: Aba } => ({
    aba:
      typeof s.aba === "string" && (ABAS as readonly string[]).includes(s.aba)
        ? (s.aba as Aba)
        : undefined,
  }),
  beforeLoad: () => assertModuloPermitido("imobmatch.moderacao", ["saas.imobmatch"]),
  component: Pagina,
});

function Pagina() {
  const { aba = "revisao" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const irPara = (a: Aba) => void navigate({ search: { aba: a }, replace: true });
  const qc = useQueryClient();
  const resumoFn = useServerFn(lerResumoImobMatch);
  const resumo = useQuery({
    queryKey: [...CHAVE_IMOBMATCH, "resumo"],
    queryFn: () => resumoFn(),
    staleTime: 20_000,
  });
  const r = resumo.data;
  const contagem: Partial<Record<Aba, number>> = {
    revisao: r?.revisao,
    denuncias: r?.denuncias,
    moderados: r?.moderados,
  };

  return (
    <PaginaGestao>
      <CabecalhoGestao
        secao="ImobMatch Gestão"
        titulo="Anúncios e moderação"
        icone={<ShieldCheck />}
        descricao="Revise endereços repetidos, julgue denúncias, modere a Comunidade e o chat. Toda decisão fica registrada com o motivo e quem publicou é avisado."
        acoes={
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-9"
            onClick={() => void qc.invalidateQueries({ queryKey: CHAVE_IMOBMATCH })}
          >
            <RefreshCw className={cn("mr-1.5 size-4", resumo.isFetching && "animate-spin")} />{" "}
            Atualizar
          </Button>
        }
      />

      <FaixaIndicadores>
        <Indicador
          rotulo="Em revisão"
          valor={inteiro(r?.revisao)}
          detalhe="mesmo endereço de outra conta"
          icone={<ShieldAlert />}
          tom={(r?.revisao ?? 0) > 0 ? "alerta" : "sucesso"}
          carregando={resumo.isLoading}
          onClick={() => irPara("revisao")}
          ativo={aba === "revisao"}
        />
        <Indicador
          rotulo="Denúncias a julgar"
          valor={inteiro(r?.denuncias)}
          detalhe="anúncios denunciados"
          icone={<Flag />}
          tom={(r?.denuncias ?? 0) > 0 ? "perigo" : "sucesso"}
          carregando={resumo.isLoading}
          onClick={() => irPara("denuncias")}
          ativo={aba === "denuncias"}
        />
        <Indicador
          rotulo="Moderados"
          valor={inteiro(r?.moderados)}
          detalhe="fora do ar por decisão da equipe"
          icone={<EyeOff />}
          tom="neutro"
          carregando={resumo.isLoading}
          onClick={() => irPara("moderados")}
          ativo={aba === "moderados"}
        />
        <Indicador
          rotulo="Anúncios no ar"
          valor={inteiro(r?.no_ar)}
          detalhe="no portal agora"
          icone={<Building2 />}
          tom="sucesso"
          carregando={resumo.isLoading}
        />
      </FaixaIndicadores>

      <Tabs value={aba} onValueChange={(v) => irPara(v as Aba)}>
        <div
          data-tour="imobmatch-moderacao-abas"
          className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0"
        >
          <TabsList className="h-auto min-h-10 w-max">
            {ABAS.map((a) => (
              <TabsTrigger key={a} value={a} className="min-h-11 gap-1.5 sm:min-h-8">
                {a === "chat" && <MessagesSquare className="size-3.5" aria-hidden />}
                {ROTULO[a]}
                {!!contagem[a] && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] tabular-nums",
                      a === "moderados"
                        ? "bg-muted-foreground/15 text-muted-foreground"
                        : "bg-warning/20 text-warning-foreground",
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
        <TabsContent value="comunidade" className="mt-4">
          <AbaComunidade />
        </TabsContent>
        <TabsContent value="chat" className="mt-4">
          <AbaChat />
        </TabsContent>
        <TabsContent value="moderados" className="mt-4">
          <AbaModerados />
        </TabsContent>
      </Tabs>
    </PaginaGestao>
  );
}
