import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Inbox, Newspaper, RefreshCw, Rss, TrendingUp } from "lucide-react";
import { AdminHero } from "@/components/admin/admin-hero";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { lerCuradoriaNews } from "@/lib/plataforma/news.functions";
import { QK_NEWS } from "@/components/plataforma/news-comum";
import { FilaCuradoriaNews } from "@/components/plataforma/news-fila";
import { PostsNews, PublicarNews } from "@/components/plataforma/news-publicar";
import { AudienciaNews } from "@/components/plataforma/news-audiencia";
import { FontesNews, IndicadoresNews } from "@/components/plataforma/news-fontes";

export const Route = createFileRoute("/_authenticated/plataforma/news")({
  head: () => ({ meta: [{ title: "Agilliza News — Plataforma — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.news"),
  component: Pagina,
});

/**
 * Curadoria da Agilliza News — o que corretores e imobiliárias leem no Corretor 2.0.
 * A notícia crua não ajuda ninguém: o que vai ao ar é a leitura que diz o que aquilo muda
 * na parcela do cliente.
 */
function Pagina() {
  const lerFn = useServerFn(lerCuradoriaNews);
  const q = useQuery({ queryKey: QK_NEWS, queryFn: () => lerFn() });
  const pode = usePermissao("saas.news", "edit");
  const d = q.data;
  const noticias = d?.noticias ?? [];
  const fontes = d?.fontes ?? [];
  const indicadores = d?.indicadores ?? [];
  const categorias = d?.categorias ?? [];
  // Contados no banco: a lista traz só as 200 mais recentes.
  const naFila = d?.contagem.na_fila ?? 0;
  const publicadas = d?.contagem.publicadas ?? 0;
  const semSerie = indicadores.filter((i) => i.ativo && Number(i.pontos) === 0);
  const semColeta = fontes.length > 0 && fontes.every((f) => !f.ultima_coleta_em);
  const carregando = q.isLoading;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        secao="Plataforma"
        icon={<Newspaper className="h-5 w-5" />}
        titulo="Agilliza News"
        descricao="Curadoria do que corretores e imobiliárias leem no Corretor: a fila que chega das fontes, as publicações da Agilliza e a reação de quem lê."
        acoes={
          <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`mr-2 size-4 ${q.isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        }
      />

      {q.isError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(q.error, "Não foi possível carregar a curadoria da News.")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metrica
          icone={<Inbox className="size-4" />}
          rotulo="Na fila"
          valor={naFila}
          detalhe="esperando curadoria"
          alerta={naFila > 0}
        />
        <Metrica
          icone={<Newspaper className="size-4" />}
          rotulo="Publicadas"
          valor={publicadas}
          detalhe="matérias no ar"
        />
        <Metrica
          icone={<Rss className="size-4" />}
          rotulo="Fontes ativas"
          valor={fontes.filter((f) => f.ativa).length}
          detalhe={`${fontes.length} cadastrada(s)`}
        />
        <Metrica
          icone={<TrendingUp className="size-4" />}
          rotulo="Indicadores"
          valor={indicadores.filter((i) => i.ativo).length}
          detalhe={semSerie.length ? `${semSerie.length} sem série coletada` : "todos com série"}
          alerta={semSerie.length > 0}
        />
      </div>

      <Tabs defaultValue="fila">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="fila">Fila ({naFila})</TabsTrigger>
          <TabsTrigger value="publicar">Publicar</TabsTrigger>
          <TabsTrigger value="audiencia">No ar e audiência</TabsTrigger>
          <TabsTrigger value="fontes">Fontes e indicadores</TabsTrigger>
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
        <TabsContent value="fontes" className="mt-4 grid gap-4 lg:grid-cols-2">
          <FontesNews fontes={fontes} carregando={carregando} pode={pode} />
          <IndicadoresNews indicadores={indicadores} carregando={carregando} pode={pode} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metrica({
  icone,
  rotulo,
  valor,
  detalhe,
  alerta,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: number;
  detalhe: string;
  alerta?: boolean;
}) {
  return (
    <section
      className={`min-w-0 rounded-lg border bg-card p-3 ${alerta ? "border-amber-400/70" : "border-border"}`}
    >
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icone} {rotulo}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      <p className="truncate text-xs text-muted-foreground">{detalhe}</p>
    </section>
  );
}
