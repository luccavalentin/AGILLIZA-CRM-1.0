import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ExternalLink, ImageIcon, Loader2, PenLine, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatData } from "@/lib/financeiro/format";
import {
  apontarMateria,
  publicarPost,
  type CategoriaNews,
  type PostNews,
} from "@/lib/plataforma/news.functions";
import { enviarCapaNews } from "@/lib/plataforma/midias.functions";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { SeletorCategoria, useAcaoNews } from "./news-comum";

/**
 * Como a Agilliza alimenta a News. Dois caminhos, diferentes de propósito:
 *  · apontar uma matéria de um portal — guarda endereço, título e chamada, nunca o texto;
 *  · escrever aqui — conteúdo próprio, que abre dentro do sistema.
 */
export function PublicarNews({ categorias, pode }: { categorias: CategoriaNews[]; pode: boolean }) {
  if (!pode) {
    return (
      <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Você pode acompanhar a News, mas publicar é de quem tem permissão de edição neste módulo.
      </p>
    );
  }
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="font-semibold">Alimentar a News</h2>
        <p className="text-sm text-muted-foreground">
          Aponte uma matéria de um portal ou escreva a leitura da Agilliza.
        </p>
      </div>
      <Tabs defaultValue="apontar">
        <TabsList className="flex-wrap">
          <TabsTrigger value="apontar">
            <ExternalLink className="mr-1 size-3.5" /> Apontar matéria
          </TabsTrigger>
          <TabsTrigger value="escrever">
            <PenLine className="mr-1 size-3.5" /> Escrever aqui
          </TabsTrigger>
        </TabsList>
        <TabsContent value="apontar" className="mt-4">
          <Apontar categorias={categorias} />
        </TabsContent>
        <TabsContent value="escrever" className="mt-4">
          <EditorPost categorias={categorias} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function Apontar({ categorias }: { categorias: CategoriaNews[] }) {
  const fn = useServerFn(apontarMateria);
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const [resumo, setResumo] = useState("");
  const [categoria, setCategoria] = useState(categorias[0]?.id ?? "geral");
  const [fonte, setFonte] = useState("");
  const enviar = useAcaoNews(
    () => fn({ data: { url, titulo, resumo, categoria, fonte } }),
    "Não foi possível apontar a matéria.",
  );

  return (
    <div className="grid gap-4">
      <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        A matéria abre no site do veículo. Nada do texto dele é copiado para cá — ele continua
        contando a visualização e entregando a publicidade.
      </p>
      <div className="space-y-1">
        <Label htmlFor="news-ap-url">Endereço da matéria</Label>
        <Input
          id="news-ap-url"
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
        />
        <p className="text-xs text-muted-foreground">
          Cole o link como ele está na barra do navegador.
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="news-ap-titulo">Título</Label>
        <Input
          id="news-ap-titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Como a matéria vai aparecer na lista"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="news-ap-resumo">Chamada (opcional)</Label>
        <Textarea
          id="news-ap-resumo"
          rows={2}
          value={resumo}
          onChange={(e) => setResumo(e.target.value)}
          placeholder="Uma ou duas linhas dizendo por que isto interessa a um corretor."
        />
        <p className="text-xs text-muted-foreground">
          Escreva com as suas palavras — não cole o primeiro parágrafo da matéria.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SeletorCategoria
          id="news-ap-categoria"
          valor={categoria}
          onChange={setCategoria}
          opcoes={categorias}
        />
        <div className="space-y-1">
          <Label htmlFor="news-ap-fonte">Veículo (opcional)</Label>
          <Input
            id="news-ap-fonte"
            value={fonte}
            onChange={(e) => setFonte(e.target.value)}
            placeholder="Valor Econômico, G1…"
          />
        </div>
      </div>
      <div>
        <Button
          disabled={enviar.isPending}
          onClick={() =>
            enviar.mutate(undefined, {
              onSuccess: () => {
                setUrl("");
                setTitulo("");
                setResumo("");
              },
            })
          }
        >
          <Check className="mr-1 size-4" /> Pôr no ar
        </Button>
      </div>
    </div>
  );
}

/** Escrever (ou editar) uma publicação própria. Sem `post`, cria uma nova. */
function EditorPost({
  categorias,
  post,
  onPronto,
}: {
  categorias: CategoriaNews[];
  post?: PostNews;
  onPronto?: () => void;
}) {
  const fn = useServerFn(publicarPost);
  const [titulo, setTitulo] = useState(post?.titulo ?? "");
  const [corpo, setCorpo] = useState(post?.corpo ?? "");
  const [categoria, setCategoria] = useState(
    post?.categoria ??
      (categorias.some((c) => c.id === "agilliza") ? "agilliza" : (categorias[0]?.id ?? "geral")),
  );
  const enviarCapaFn = useServerFn(enviarCapaNews);
  const seletorCapa = useRef<HTMLInputElement>(null);
  // `undefined` = não mexeu (mantém a capa atual); `null` = tirou; objeto = capa nova.
  const [capa, setCapa] = useState<{ id: string; url: string | null } | null | undefined>(
    undefined,
  );
  const [subindo, setSubindo] = useState(false);
  const capaVisivel =
    capa === undefined
      ? post?.capa_midia_id
        ? { id: post.capa_midia_id, url: post.capa_url }
        : null
      : capa;

  const escolherCapa = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setSubindo(true);
    try {
      const forma = new FormData();
      forma.append("arquivo", arquivo);
      forma.append("destino", "capa_news");
      const r = await enviarCapaFn({ data: forma });
      setCapa({ id: r.id, url: r.url });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível enviar a capa."));
    } finally {
      setSubindo(false);
      if (seletorCapa.current) seletorCapa.current.value = "";
    }
  };

  const salvar = useAcaoNews(
    (publicar: boolean) =>
      fn({
        data: {
          id: post?.id ?? null,
          titulo,
          corpo,
          categoria,
          publicar,
          ...(capa === undefined ? {} : { capaMidiaId: capa?.id ?? null }),
        },
      }),
    "Não foi possível publicar.",
  );
  const sufixo = post ? `-${post.id}` : "";
  const opcoes =
    post && !categorias.some((c) => c.id === post.categoria)
      ? [...categorias, { id: post.categoria, nome: post.categoria }]
      : categorias;

  const agir = (publicar: boolean) =>
    salvar.mutate(publicar, {
      onSuccess: () => {
        if (!post && publicar) {
          setTitulo("");
          setCorpo("");
          setCapa(undefined);
        }
        onPronto?.();
      },
    });

  return (
    <div className="grid gap-4">
      <div className="space-y-1">
        <Label htmlFor={`news-post-titulo${sufixo}`}>Título</Label>
        <Input
          id={`news-post-titulo${sufixo}`}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="O que o corte da Selic muda na parcela de um financiamento de R$ 400 mil"
        />
      </div>
      <SeletorCategoria
        id={`news-post-categoria${sufixo}`}
        valor={categoria}
        onChange={setCategoria}
        opcoes={opcoes}
      />
      <div className="space-y-2">
        <Label htmlFor={`news-post-capa${sufixo}`}>Capa (opcional)</Label>
        {capaVisivel && (
          <div className="overflow-hidden rounded-md border border-border bg-muted/40">
            {capaVisivel.url ? (
              <img
                src={capaVisivel.url}
                alt="Capa da publicação"
                className="aspect-[16/9] w-full max-w-md object-cover"
              />
            ) : (
              <p className="flex items-center gap-1 p-3 text-xs text-muted-foreground">
                <ImageIcon className="size-3.5" /> Esta publicação tem capa.
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={seletorCapa}
            id={`news-post-capa${sufixo}`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => void escolherCapa(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={subindo}
            onClick={() => seletorCapa.current?.click()}
          >
            {subindo ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <ImageIcon className="mr-1 size-4" />
            )}
            {capaVisivel ? "Trocar capa" : "Enviar capa"}
          </Button>
          {capaVisivel && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setCapa(null)}>
              <Trash2 className="mr-1 size-4" /> Tirar capa
            </Button>
          )}
          <span className="text-xs text-muted-foreground">JPG, PNG ou WebP até 5 MB.</span>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`news-post-corpo${sufixo}`}>Texto</Label>
        <Textarea
          id={`news-post-corpo${sufixo}`}
          rows={12}
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          placeholder="Escreva para quem vende imóvel, não para quem lê jornal de economia. Número, exemplo, e o que fazer com isso."
        />
        <p className="text-xs text-muted-foreground">
          {corpo.trim().length}/80 caracteres no mínimo · o tempo de leitura é calculado sozinho
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={salvar.isPending} onClick={() => agir(true)}>
          <Check className="mr-1 size-4" /> Publicar
        </Button>
        <Button variant="outline" disabled={salvar.isPending} onClick={() => agir(false)}>
          {post?.status === "publicado" ? "Tirar do ar (rascunho)" : "Salvar rascunho"}
        </Button>
        {onPronto && (
          <Button variant="ghost" onClick={onPronto}>
            <X className="mr-1 size-4" /> Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}

const STATUS_POST: Record<string, string> = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  arquivado: "Arquivado",
};

/** Publicações próprias da Agilliza: rascunhos para retomar e as que estão no ar. */
export function PostsNews({
  posts,
  categorias,
  carregando,
  pode,
}: {
  posts: PostNews[];
  categorias: CategoriaNews[];
  carregando: boolean;
  pode: boolean;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const nomeCat = (id: string) => categorias.find((c) => c.id === id)?.nome ?? id;

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="font-semibold">Publicações da Agilliza</h2>
        <p className="text-sm text-muted-foreground">
          O que foi escrito aqui. Rascunho só aparece para a curadoria.
        </p>
      </div>
      {carregando ? (
        <Skeleton className="h-32" />
      ) : !posts.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhuma publicação própria ainda.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {posts.map((p) => (
            <li key={p.id} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 break-words font-medium">{p.titulo}</span>
                <Badge variant={p.status === "publicado" ? "default" : "outline"}>
                  {STATUS_POST[p.status] ?? p.status}
                </Badge>
                {p.fixado && <Badge variant="outline">Destaque</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {nomeCat(p.categoria)}
                {p.autor ? ` · ${p.autor}` : ""}
                {p.publicado_em
                  ? ` · publicado em ${formatData(p.publicado_em)}`
                  : ` · atualizado em ${formatData(p.atualizado_em)}`}
                {p.tempo_leitura_min ? ` · ${p.tempo_leitura_min} min` : ""}
              </p>
              {editando === p.id ? (
                <div className="rounded-md border border-border p-3">
                  <EditorPost categorias={categorias} post={p} onPronto={() => setEditando(null)} />
                </div>
              ) : (
                pode && (
                  <Button size="sm" variant="outline" onClick={() => setEditando(p.id)}>
                    <PenLine className="mr-1 size-4" /> Editar
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
