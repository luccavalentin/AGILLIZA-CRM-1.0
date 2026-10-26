import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  Check,
  ExternalLink,
  Globe2,
  ImageIcon,
  Link2,
  Loader2,
  PenLine,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Estado3D } from "@/components/ui/estado-3d";
import { EditorMarkdown } from "@/components/conhecimento/editor-markdown";
import { formatData } from "@/lib/financeiro/format";
import {
  apontarMateria,
  PUBLICOS_NEWS,
  previaLinkNews,
  publicarPost,
  tirarDoArNews,
  type CategoriaNews,
  type PostNews,
} from "@/lib/plataforma/news.functions";
import { contextoBase } from "@/lib/conhecimento/base.functions";
import { enviarImagemArtigo } from "@/lib/conhecimento/upload";
import { enviarCapaNews } from "@/lib/plataforma/midias.functions";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { SeletorCategoria, useAcaoNews } from "./news-comum";
import {
  AGENDA_PADRAO,
  CamposAgendaNews,
  agendaDe,
  agendaParaEnvio,
  type AgendaNews,
} from "./news-agenda";

/**
 * Como a Agilliza alimenta a News. Dois caminhos, diferentes de propósito:
 *  · apontar uma matéria de um portal — o servidor busca título, descrição e imagem de
 *    pré-visualização (com proteção contra SSRF); guarda endereço e chamada, nunca o texto;
 *  · escrever aqui — editor rico (títulos, listas, tabelas, imagens, links), capa, resumo,
 *    agenda (início/fim), público e destaque. Abre dentro do sistema.
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
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div>
        <h2 className="font-semibold">Publicar na Agilliza News</h2>
        <p className="text-sm text-muted-foreground">
          Escreva uma matéria da Agilliza ou aponte um link de um portal. Artigos da Base de
          conhecimento vão para a News pela própria base.
        </p>
      </div>
      <Tabs defaultValue="escrever">
        <TabsList className="flex-wrap">
          <TabsTrigger value="escrever">
            <PenLine className="mr-1 size-3.5" /> Escrever matéria
          </TabsTrigger>
          <TabsTrigger value="apontar">
            <Link2 className="mr-1 size-3.5" /> Colar um link
          </TabsTrigger>
        </TabsList>
        <TabsContent value="escrever" className="mt-4">
          <EditorPost categorias={categorias} />
        </TabsContent>
        <TabsContent value="apontar" className="mt-4">
          <Apontar categorias={categorias} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function Apontar({ categorias }: { categorias: CategoriaNews[] }) {
  const fn = useServerFn(apontarMateria);
  const previaFn = useServerFn(previaLinkNews);
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const [resumo, setResumo] = useState("");
  const [categoria, setCategoria] = useState(categorias[0]?.id ?? "geral");
  const [fonte, setFonte] = useState("");
  const [imagem, setImagem] = useState<string | null>(null);
  const [descricaoVeiculo, setDescricaoVeiculo] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [agenda, setAgenda] = useState<AgendaNews>(AGENDA_PADRAO);

  const buscar = async () => {
    if (!url.trim()) return;
    setBuscando(true);
    try {
      const p = await previaFn({ data: { url: url.trim() } });
      if (p.titulo && !titulo) setTitulo(p.titulo);
      if (p.veiculo && !fonte) setFonte(p.veiculo);
      setImagem(p.imagem_url);
      setDescricaoVeiculo(p.descricao);
      toast.success("Prévia carregada. Revise o título e escreva a chamada com as suas palavras.");
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível ler este endereço."));
    } finally {
      setBuscando(false);
    }
  };

  const enviar = useAcaoNews(
    () =>
      fn({
        data: {
          url,
          titulo,
          resumo,
          categoria,
          fonte,
          imagem_url: imagem,
          fixada: agenda.destaque,
          ...agendaParaEnvio(agenda),
        },
      }),
    "Não foi possível pôr a matéria no ar.",
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="grid gap-4">
        <div className="space-y-1">
          <Label htmlFor="news-ap-url">Endereço da matéria</Label>
          <div className="flex gap-2">
            <Input
              id="news-ap-url"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => url && !titulo && void buscar()}
              placeholder="https://..."
            />
            <Button
              type="button"
              variant="outline"
              disabled={buscando || !url.trim()}
              onClick={() => void buscar()}
            >
              {buscando ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Search className="mr-1 size-4" />
              )}
              Prévia
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="news-ap-titulo">Título</Label>
          <Input id="news-ap-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="news-ap-resumo">Chamada (com as suas palavras)</Label>
          <Textarea
            id="news-ap-resumo"
            rows={3}
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
            placeholder="Por que isto interessa a um corretor ou a um correspondente."
          />
          {descricaoVeiculo && (
            <p className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
              <strong>Descrição do veículo (referência, não é copiada):</strong> {descricaoVeiculo}
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SeletorCategoria
            id="news-ap-categoria"
            valor={categoria}
            onChange={setCategoria}
            opcoes={categorias}
          />
          <div className="space-y-1">
            <Label htmlFor="news-ap-fonte">Veículo</Label>
            <Input
              id="news-ap-fonte"
              value={fonte}
              onChange={(e) => setFonte(e.target.value)}
              placeholder="Valor Econômico, G1…"
            />
          </div>
        </div>
        <CamposAgendaNews idBase="news-ap" valor={agenda} onChange={setAgenda} />
        <div>
          <Button
            disabled={enviar.isPending}
            onClick={() =>
              enviar.mutate(undefined, {
                onSuccess: () => {
                  setUrl("");
                  setTitulo("");
                  setResumo("");
                  setImagem(null);
                  setDescricaoVeiculo(null);
                  setAgenda(AGENDA_PADRAO);
                },
              })
            }
          >
            <Check className="mr-1 size-4" /> Pôr no ar
          </Button>
        </div>
      </div>

      {/* Como o assinante vai ver o cartão */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Prévia do cartão
        </p>
        <article className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
          {imagem ? (
            <div className="relative aspect-[16/8] bg-muted">
              <img
                src={imagem}
                alt=""
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute right-2 top-2 size-7"
                onClick={() => setImagem(null)}
                aria-label="Tirar imagem"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex aspect-[16/8] items-center justify-center bg-muted/50 text-muted-foreground">
              <ImageIcon className="size-6" />
            </div>
          )}
          <div className="space-y-1.5 p-4">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <Badge variant="secondary">
                {categorias.find((c) => c.id === categoria)?.nome ?? categoria}
              </Badge>
              {fonte && <span>{fonte}</span>}
              {agenda.destaque && <Star className="size-3 text-amber-500" />}
            </div>
            <p className="flex items-start gap-1 font-semibold leading-snug">
              {titulo || "Título da matéria"}{" "}
              <ExternalLink className="mt-1 size-3 shrink-0 text-muted-foreground" />
            </p>
            {resumo && <p className="line-clamp-3 text-sm text-muted-foreground">{resumo}</p>}
            <p className="text-[11px] text-muted-foreground">
              <Globe2 className="mr-1 inline size-3" />
              {PUBLICOS_NEWS.find((p) => p.id === agenda.publico)?.nome}
            </p>
          </div>
        </article>
        <p className="text-xs text-muted-foreground">
          A matéria abre no site do veículo; a imagem é a de pré-visualização dele (endereço, nada é
          copiado).
        </p>
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
  const ctxFn = useServerFn(contextoBase);
  const ctx = useQuery({
    queryKey: ["conhecimento-contexto"],
    queryFn: () => ctxFn(),
    staleTime: 300_000,
  });
  const [titulo, setTitulo] = useState(post?.titulo ?? "");
  const [resumo, setResumo] = useState(post?.resumo ?? "");
  const [corpo, setCorpo] = useState(post?.corpo ?? "");
  const [categoria, setCategoria] = useState(
    post?.categoria ??
      (categorias.some((c) => c.id === "agilliza") ? "agilliza" : (categorias[0]?.id ?? "geral")),
  );
  const [agenda, setAgenda] = useState<AgendaNews>(post ? agendaDe(post) : AGENDA_PADRAO);
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
          resumo,
          categoria,
          publicar,
          formato: "markdown",
          fixado: agenda.destaque,
          ...agendaParaEnvio(agenda),
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
  const corr = ctx.data?.correspondenteId ?? null;

  const agir = (publicar: boolean) =>
    salvar.mutate(publicar, {
      onSuccess: () => {
        if (!post && publicar) {
          setTitulo("");
          setResumo("");
          setCorpo("");
          setCapa(undefined);
          setAgenda(AGENDA_PADRAO);
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
          className="text-base font-medium"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`news-post-resumo${sufixo}`}>Resumo (aparece no cartão)</Label>
        <Textarea
          id={`news-post-resumo${sufixo}`}
          rows={2}
          maxLength={400}
          value={resumo}
          onChange={(e) => setResumo(e.target.value)}
          placeholder="Duas linhas que fazem a pessoa querer abrir."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SeletorCategoria
          id={`news-post-categoria${sufixo}`}
          valor={categoria}
          onChange={setCategoria}
          opcoes={opcoes}
        />
        <div className="space-y-1">
          <Label htmlFor={`news-post-capa${sufixo}`}>Capa</Label>
          <div className="flex flex-wrap items-center gap-2">
            {capaVisivel?.url && (
              <img
                src={capaVisivel.url}
                alt="Capa"
                className="h-10 w-16 rounded-md border border-border object-cover"
              />
            )}
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
              {capaVisivel ? "Trocar" : "Enviar capa"}
            </Button>
            {capaVisivel && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setCapa(null)}>
                <Trash2 className="mr-1 size-4" /> Tirar
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`news-post-corpo${sufixo}`}>Texto</Label>
        <EditorMarkdown
          id={`news-post-corpo${sufixo}`}
          valor={corpo}
          onChange={setCorpo}
          onEnviarImagem={corr ? (f) => enviarImagemArtigo(corr, f) : undefined}
          placeholder="Escreva para quem vende imóvel: número, exemplo e o que fazer com isso."
        />
      </div>
      <CamposAgendaNews idBase={`news-post${sufixo}`} valor={agenda} onChange={setAgenda} />
      <div className="flex flex-wrap gap-2">
        <Button disabled={salvar.isPending} onClick={() => agir(true)}>
          <Check className="mr-1 size-4" />{" "}
          {post?.status === "publicado" ? "Salvar e manter no ar" : "Publicar"}
        </Button>
        <Button variant="outline" disabled={salvar.isPending} onClick={() => agir(false)}>
          {post?.status === "publicado" ? "Voltar para rascunho" : "Salvar rascunho"}
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
  arquivado: "Fora do ar",
};

function situacaoAgenda(p: PostNews): string | null {
  const agora = Date.now();
  if (p.status !== "publicado") return null;
  if (p.inicio_em && new Date(p.inicio_em).getTime() > agora)
    return `Agendado para ${formatData(p.inicio_em)}`;
  if (p.fim_em && new Date(p.fim_em).getTime() <= agora) return "Prazo encerrado";
  if (p.fim_em) return `No ar até ${formatData(p.fim_em)}`;
  return "No ar, sem prazo";
}

/** Publicações próprias da Agilliza: rascunhos para retomar, as que estão no ar e as agendadas. */
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
  const tirarFn = useServerFn(tirarDoArNews);
  const tirar = useAcaoNews(
    (id: string) => tirarFn({ data: { tipo: "post", id } }),
    "Não foi possível tirar do ar.",
  );
  const nomeCat = (id: string) => categorias.find((c) => c.id === id)?.nome ?? id;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div>
        <h2 className="font-semibold">Publicações da Agilliza</h2>
        <p className="text-sm text-muted-foreground">
          Rascunhos, agendadas e no ar. Editar depois de publicado atualiza na hora.
        </p>
      </div>
      {carregando ? (
        <Skeleton className="h-32" />
      ) : !posts.length ? (
        <Estado3D
          compacto
          icone={PenLine}
          titulo="Nenhuma publicação própria ainda"
          descricao="Escreva a primeira matéria acima."
        />
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
                {p.origem === "base_conhecimento" && (
                  <Badge variant="secondary" className="gap-1">
                    <BookOpen className="size-3" /> Base de conhecimento
                  </Badge>
                )}
                <Badge variant="outline">
                  {PUBLICOS_NEWS.find((x) => x.id === p.publico)?.nome ?? p.publico}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {nomeCat(p.categoria)}
                {p.autor ? ` · ${p.autor}` : ""}
                {situacaoAgenda(p)
                  ? ` · ${situacaoAgenda(p)}`
                  : ` · atualizado em ${formatData(p.atualizado_em)}`}
                {p.tempo_leitura_min ? ` · ${p.tempo_leitura_min} min` : ""}
              </p>
              {editando === p.id ? (
                <div className="rounded-xl border border-border p-3">
                  <EditorPost categorias={categorias} post={p} onPronto={() => setEditando(null)} />
                </div>
              ) : (
                pode && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditando(p.id)}>
                      <PenLine className="mr-1 size-4" /> Editar
                    </Button>
                    {p.status === "publicado" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={tirar.isPending}
                        onClick={() => tirar.mutate(p.id)}
                      >
                        Tirar do ar
                      </Button>
                    )}
                  </div>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
