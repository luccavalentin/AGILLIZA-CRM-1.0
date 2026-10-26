import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, ExternalLink, Newspaper, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Icone3D } from "@/components/ui/icone-3d";
import { Estado3D } from "@/components/ui/estado-3d";
import { ArtigoMarkdown } from "@/components/conhecimento/artigo-markdown";
import {
  lerNewsDaEquipe,
  registrarEventosNewsEquipe,
  type ItemNewsEquipe,
} from "@/lib/plataforma/news.functions";

/**
 * Agilliza News para a equipe do Agilliza (C60): o que foi publicado para "todos" ou "só a
 * equipe". `NewsEquipeWidget` serve ao Painel geral (frente a1 encaixa); a página
 * `/news` mostra tudo. As leituras entram nas métricas da News (portal "agilliza").
 */

function quando(iso: string | null) {
  if (!iso) return "";
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "agora há pouco";
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d < 30 ? `há ${d} dia${d > 1 ? "s" : ""}` : new Date(iso).toLocaleDateString("pt-BR");
}

function useMetricasEquipe() {
  const fn = useServerFn(registrarEventosNewsEquipe);
  const vistos = useRef(new Set<string>());
  return {
    impressoes: (itens: ItemNewsEquipe[]) => {
      const novos = itens.filter((i) => !vistos.current.has(i.id));
      novos.forEach((i) => vistos.current.add(i.id));
      if (novos.length)
        void fn({
          data: {
            eventos: novos.map((i) => ({
              tipo: "impressao" as const,
              item_tipo: i.tipo,
              item_id: i.id,
            })),
          },
        });
    },
    evento: (e: {
      tipo: "leitura" | "clique" | "tempo";
      item: ItemNewsEquipe;
      segundos?: number;
    }) =>
      void fn({
        data: {
          eventos: [
            {
              tipo: e.tipo,
              item_tipo: e.item.tipo,
              item_id: e.item.id,
              ...(e.segundos ? { segundos: e.segundos } : {}),
            },
          ],
        },
      }),
  };
}

function ListaNews({
  itens,
  onAbrir,
}: {
  itens: ItemNewsEquipe[];
  onAbrir: (i: ItemNewsEquipe) => void;
}) {
  return (
    <ul className="divide-y divide-border">
      {itens.map((i) => (
        <li key={`${i.tipo}-${i.id}`}>
          <button
            type="button"
            onClick={() => onAbrir(i)}
            className="group flex w-full gap-3 py-3 text-left"
          >
            {i.imagem_url && (
              <img
                src={i.imagem_url}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="hidden h-16 w-24 shrink-0 rounded-lg object-cover sm:block"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                {i.fixado && <Pin className="size-3 text-primary" />}
                {i.categoria_nome && (
                  <Badge variant="secondary" className="h-5 font-normal">
                    {i.categoria_nome}
                  </Badge>
                )}
                <span>
                  {i.fonte}
                  {i.publicado_em ? ` · ${quando(i.publicado_em)}` : ""}
                </span>
              </div>
              <p className="mt-1 flex items-start gap-1 font-medium leading-snug group-hover:text-primary">
                {i.titulo}
                {i.externa && (
                  <ExternalLink className="mt-1 size-3 shrink-0 text-muted-foreground" />
                )}
              </p>
              {i.resumo && (
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{i.resumo}</p>
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function LeitorPost({
  item,
  onFechar,
  onTempo,
}: {
  item: ItemNewsEquipe | null;
  onFechar: () => void;
  onTempo: (item: ItemNewsEquipe, segundos: number) => void;
}) {
  const tempoRef = useRef(onTempo);
  tempoRef.current = onTempo;
  // Tempo de leitura: do abrir ao fechar o post (vai uma vez, com o item que estava aberto).
  useEffect(() => {
    if (!item) return;
    const ini = Date.now();
    return () => tempoRef.current(item, Math.min(3600, Math.round((Date.now() - ini) / 1000)));
  }, [item]);
  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        {item && (
          <div className="space-y-4">
            <SheetHeader className="text-left">
              <p className="text-[11px] text-muted-foreground">
                {item.categoria_nome} · {item.fonte} · {quando(item.publicado_em)}
                {item.tempo_leitura_min ? ` · ${item.tempo_leitura_min} min` : ""}
              </p>
              <SheetTitle className="text-2xl leading-tight">{item.titulo}</SheetTitle>
              {item.resumo && <p className="text-muted-foreground">{item.resumo}</p>}
            </SheetHeader>
            {item.formato === "markdown" ? (
              <ArtigoMarkdown conteudo={item.corpo ?? ""} />
            ) : (
              <div className="space-y-3 whitespace-pre-line text-[15px] leading-relaxed">
                {item.corpo}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function useAbrir() {
  const m = useMetricasEquipe();
  const [lendo, setLendo] = useState<ItemNewsEquipe | null>(null);
  const abrir = (i: ItemNewsEquipe) => {
    if (i.externa && i.url_externa) {
      m.evento({ tipo: "clique", item: i });
      window.open(i.url_externa, "_blank", "noopener,noreferrer");
      return;
    }
    m.evento({ tipo: "leitura", item: i });
    setLendo(i);
  };
  return { m, lendo, setLendo, abrir };
}

/**
 * Bloco para o Painel geral: as 5 mais recentes (destaques primeiro). `embutido`: só a lista,
 * para entrar num cartão do próprio painel (cabeçalho e moldura 3D são de quem embute).
 */
export function NewsEquipeWidget({ embutido = false }: { embutido?: boolean } = {}) {
  const fn = useServerFn(lerNewsDaEquipe);
  const q = useQuery({
    queryKey: ["news-equipe", 5],
    queryFn: () => fn({ data: { limite: 5 } }),
    staleTime: 120_000,
  });
  const { m, lendo, setLendo, abrir } = useAbrir();
  useEffect(() => {
    if (q.data?.length) m.impressoes(q.data);
  }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const corpo = (
    <>
      {q.isLoading ? (
        <Skeleton className="h-40" />
      ) : q.isError ? (
        <Estado3D
          compacto
          tipo="erro"
          descricao="Não foi possível carregar a News."
          acao={
            <Button variant="outline" size="sm" onClick={() => q.refetch()}>
              Tentar de novo
            </Button>
          }
        />
      ) : !(q.data ?? []).length ? (
        <Estado3D
          compacto
          icone={Newspaper}
          titulo="Nada publicado para a equipe agora"
          descricao="Quando a curadoria publicar para todos ou para a equipe, aparece aqui."
        />
      ) : (
        <ListaNews itens={q.data!} onAbrir={abrir} />
      )}
      <LeitorPost
        item={lendo}
        onFechar={() => setLendo(null)}
        onTempo={(item, s) => s >= 3 && m.evento({ tipo: "tempo", item, segundos: s })}
      />
    </>
  );
  if (embutido) return corpo;
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icone3D icone={Newspaper} tamanho="sm" /> Agilliza News
        </h2>
        <Button asChild variant="ghost" size="sm" className="h-8">
          <Link to="/news">
            Ver tudo <ChevronRight className="ml-1 size-4" />
          </Link>
        </Button>
      </div>
      {corpo}
    </section>
  );
}

/** Página inteira da News para a equipe. */
export function NewsEquipePagina() {
  const fn = useServerFn(lerNewsDaEquipe);
  const q = useQuery({
    queryKey: ["news-equipe", 60],
    queryFn: () => fn({ data: { limite: 60 } }),
  });
  const { m, lendo, setLendo, abrir } = useAbrir();
  useEffect(() => {
    if (q.data?.length) m.impressoes(q.data);
  }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {q.isLoading ? (
        <Skeleton className="h-80" />
      ) : q.isError ? (
        <Estado3D
          tipo="erro"
          descricao="Não foi possível carregar a News."
          acao={<Button onClick={() => q.refetch()}>Tentar de novo</Button>}
        />
      ) : !(q.data ?? []).length ? (
        <Estado3D
          icone={Newspaper}
          titulo="Nada publicado para a equipe agora"
          descricao="Quando a curadoria publicar para todos ou para a equipe, aparece aqui."
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card px-4 shadow-sm">
          <ListaNews itens={q.data!} onAbrir={abrir} />
        </div>
      )}
      <LeitorPost
        item={lendo}
        onFechar={() => setLendo(null)}
        onTempo={(item, s) => s >= 3 && m.evento({ tipo: "tempo", item, segundos: s })}
      />
    </div>
  );
}
