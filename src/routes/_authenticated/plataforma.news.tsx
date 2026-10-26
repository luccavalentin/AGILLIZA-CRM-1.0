import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Inbox, Newspaper, PenLine, RefreshCw, Rss, TrendingUp } from "lucide-react";
import { AdminHero } from "@/components/admin/admin-hero";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Indicador3D } from "@/components/ui/indicador-3d";
import { Estado3D } from "@/components/ui/estado-3d";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { lerCuradoriaNews } from "@/lib/plataforma/news.functions";
import { QK_NEWS, ha } from "@/components/plataforma/news-comum";
import { FilaCuradoriaNews } from "@/components/plataforma/news-fila";
import { PostsNews, PublicarNews } from "@/components/plataforma/news-publicar";
import { AudienciaNews } from "@/components/plataforma/news-audiencia";
import { FontesNews, IndicadoresNews } from "@/components/plataforma/news-fontes";
import { MetricasNews } from "@/components/plataforma/news-metricas";

export const Route = createFileRoute("/_authenticated/plataforma/news")({
  head: () => ({ meta: [{ title: "Agilliza News — Plataforma — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.news"),
  component: Pagina,
});

/**
 * Agilliza News (C60) — o que corretores, imobiliárias e a equipe do Agilliza leem.
 * Fila do coletor de RSS, publicar (matéria escrita aqui ou link com prévia), o que está no
 * ar, métricas no padrão dos gerenciadores de anúncio e as fontes do coletor.
 */
function Pagina() {
  const lerFn = useServerFn(lerCuradoriaNews);
  const q = useQuery({ queryKey: QK_NEWS, queryFn: () => lerFn(), refetchInterval: 60_000 });
  const pode = usePermissao("saas.news", "edit");
  const d = q.data;
  const noticias = d?.noticias ?? [];
  const fontes = d?.fontes ?? [];
  const indicadores = d?.indicadores ?? [];
  const categorias = d?.categorias ?? [];
  const naFila = d?.contagem.na_fila ?? 0;
  const publicadas = d?.contagem.publicadas ?? 0;
  const feeds = fontes.filter((f) => f.url_rss);
  const semColeta = feeds.length > 0 && feeds.every((f) => !f.ultima_coleta_em);
  const comErro = feeds.filter((f) => f.ativa && f.erro).length;
  const ultimaColeta = feeds
    .map((f) => f.ultima_coleta_em)
    .filter((x): x is string => !!x)
    .sort()
    .at(-1);
  const noAr = d?.feed.length ?? 0;
  const carregando = q.isLoading;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        secao="Gestão de sistemas"
        icon={<Newspaper className="h-5 w-5" />}
        titulo="Agilliza News"
        descricao="O que corretores, imobiliárias e a equipe leem: a fila do coletor, as publicações da Agilliza, o que está no ar e quanto cada item rendeu."
        acoes={
          <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`mr-2 size-4 ${q.isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        }
      />

      {q.isError && (
        <Estado3D
          tipo="erro"
          compacto
          descricao={mensagemDeErro(q.error, "Não foi possível carregar a curadoria da News.")}
          acao={<Button onClick={() => q.refetch()}>Tentar de novo</Button>}
        />
      )}

      <div data-tour="plataforma-news-indicadores" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Indicador3D
          icone={Inbox}
          tom={naFila ? "alerta" : "neutro"}
          rotulo="Na fila"
          natureza="para curar"
          valor={naFila}
          detalhe="coletadas pelo RSS"
          carregando={carregando}
        />
        <Indicador3D
          icone={Newspaper}
          rotulo="No ar"
          natureza="itens"
          valor={noAr}
          detalhe={`${publicadas} matéria(s) de portal publicadas`}
          carregando={carregando}
        />
        <Indicador3D
          icone={Rss}
          tom={comErro ? "perigo" : "sucesso"}
          rotulo="Coletor de RSS"
          natureza={`${feeds.filter((f) => f.ativa).length} fonte(s) ativa(s)`}
          valor={ultimaColeta ? ha(ultimaColeta) : "aguardando"}
          detalhe={comErro ? `${comErro} fonte(s) com erro` : "todas lendo normalmente"}
          carregando={carregando}
        />
        <Indicador3D
          icone={TrendingUp}
          tom="info"
          rotulo="Indicadores"
          natureza="Banco Central"
          valor={indicadores.filter((i) => i.ativo).length}
          detalhe={
            indicadores.some((i) => i.ativo && Number(i.pontos) === 0)
              ? "há indicador sem série"
              : "todos com série"
          }
          carregando={carregando}
        />
      </div>

      <Tabs defaultValue="fila">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="fila">
            <Inbox className="mr-1 size-3.5" /> Fila ({naFila})
          </TabsTrigger>
          <TabsTrigger value="publicar">
            <PenLine className="mr-1 size-3.5" /> Publicar
          </TabsTrigger>
          <TabsTrigger value="audiencia">
            <Newspaper className="mr-1 size-3.5" /> No ar
          </TabsTrigger>
          <TabsTrigger value="metricas">
            <BarChart3 className="mr-1 size-3.5" /> Métricas
          </TabsTrigger>
          <TabsTrigger value="fontes">
            <Rss className="mr-1 size-3.5" /> Fontes e coletor
          </TabsTrigger>
        </TabsList>
        <TabsContent value="fila" className="mt-4">
          <FilaCuradoriaNews
            noticias={noticias}
            categorias={categorias}
            carregando={carregando}
            semColeta={semColeta}
            pode={pode}
          />
        </TabsContent>
        <TabsContent value="publicar" className="mt-4 space-y-4">
          <PublicarNews categorias={categorias} pode={pode} />
          <PostsNews
            posts={d?.posts ?? []}
            categorias={categorias}
            carregando={carregando}
            pode={pode}
          />
        </TabsContent>
        <TabsContent value="audiencia" className="mt-4">
          <AudienciaNews feed={d?.feed ?? []} carregando={carregando} pode={pode} />
        </TabsContent>
        <TabsContent value="metricas" className="mt-4">
          <MetricasNews />
        </TabsContent>
        <TabsContent value="fontes" className="mt-4 grid gap-4 lg:grid-cols-2">
          <FontesNews
            fontes={fontes}
            coletas={d?.coletas ?? []}
            categorias={categorias}
            carregando={carregando}
            pode={pode}
          />
          <IndicadoresNews indicadores={indicadores} carregando={carregando} pode={pode} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
