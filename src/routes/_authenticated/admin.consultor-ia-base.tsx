import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpDown,
  BookMarked,
  BookOpen,
  Calculator,
  Download,
  FileDown,
  FilePen,
  Globe2,
  History,
  ImagePlus,
  Library,
  Loader2,
  Megaphone,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Estado3D } from "@/components/ui/estado-3d";
import { Icone3D } from "@/components/ui/icone-3d";
import { cn } from "@/lib/utils";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  CATEGORIAS_BASE,
  excluirItemBase,
  listarBaseConhecimento,
  salvarItemBase,
  type AnexoBase,
  type ItemBase,
} from "@/lib/consultor-ia/consultor-ia.functions";
import {
  contextoBase,
  criarCategoriaBase,
  listarCategoriasBase,
  listarVersoesArtigo,
  restaurarVersaoArtigo,
  urlAnexoBase,
} from "@/lib/conhecimento/base.functions";
import { minutosDeLeitura, sumario, textoPuro } from "@/lib/conhecimento/markdown";
import { enviarAnexoArtigo, enviarImagemArtigo } from "@/lib/conhecimento/upload";
import { gerarCompendioPDF, gerarVerbetePDF } from "@/lib/consultor-ia/pdf-lazy";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { ArtigoMarkdown } from "@/components/conhecimento/artigo-markdown";
import { EditorMarkdown } from "@/components/conhecimento/editor-markdown";
import { ParametrosConsultorDialog } from "@/components/conhecimento/parametros-consultor-dialog";
import { PublicarNewsDialog } from "@/components/conhecimento/publicar-news-dialog";

export const Route = createFileRoute("/_authenticated/admin/consultor-ia-base")({
  head: () => ({
    meta: [
      { title: "Base de conhecimento — Agilliza" },
      {
        name: "description",
        content:
          "Artigos de crédito imobiliário da Agilliza: escreva, versione, publique e leve à Agilliza News.",
      },
    ],
  }),
  beforeLoad: () => assertModuloPermitido("admin.parametros"),
  component: BibliotecaPage,
});

type Rascunho = {
  id?: string;
  categoria: string;
  titulo: string;
  resumo: string;
  conteudo: string;
  tags: string[];
  ativo: boolean;
  global: boolean;
  capa_url: string | null;
  anexos: AnexoBase[];
};

const VAZIO: Rascunho = {
  categoria: "Duvidas_Frequentes",
  titulo: "",
  resumo: "",
  conteudo: "",
  tags: [],
  ativo: true,
  // Artigo novo vale só para a própria conta; "global" é escolha consciente (QA 20/10).
  global: false,
  capa_url: null,
  anexos: [],
};

type Ordem = "relevancia" | "recentes" | "antigos" | "az";
type Filtro = "todos" | "publicado" | "rascunho" | "news";

const STOP = new Set([
  "a",
  "o",
  "as",
  "os",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "um",
  "uma",
  "para",
  "por",
  "com",
  "que",
  "qual",
  "quais",
  "como",
  "quando",
  "onde",
  "no",
  "na",
  "nos",
  "nas",
  "ao",
  "aos",
  "se",
  "sobre",
]);
const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const termosDe = (q: string) =>
  normalizar(q)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
const nomeCategoria = (c: string) => c.replace(/_/g, " ");

function relevancia(it: ItemBase, termos: string[]) {
  if (!termos.length) return 0;
  const titulo = normalizar(it.titulo);
  const tags = normalizar(it.tags.join(" "));
  const corpo = normalizar(`${it.resumo ?? ""} ${textoPuro(it.conteudo)}`);
  let score = 0;
  for (const t of termos) {
    if (titulo.includes(t)) score += 8;
    if (tags.includes(t)) score += 5;
    score += Math.min(corpo.split(t).length - 1, 6);
  }
  return score;
}

function trechoDestaque(it: ItemBase, termos: string[]) {
  if (it.resumo && !termos.length) return it.resumo;
  const plano = textoPuro(it.conteudo);
  if (!termos.length) return plano.slice(0, 230);
  const alvo = normalizar(plano);
  const pos = termos
    .map((t) => alvo.indexOf(t))
    .filter((p) => p >= 0)
    .sort((a, b) => a - b)[0];
  if (pos === undefined) return it.resumo ?? plano.slice(0, 230);
  const ini = Math.max(0, pos - 90);
  return `${ini > 0 ? "… " : ""}${plano.slice(ini, ini + 240)}…`;
}

function dataCurta(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function BibliotecaPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [tagsSel, setTagsSel] = useState<string[]>([]);
  const [ordem, setOrdem] = useState<Ordem>("relevancia");
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const [lendo, setLendo] = useState<ItemBase | null>(null);
  const [versoesDe, setVersoesDe] = useState<ItemBase | null>(null);
  const [newsDe, setNewsDe] = useState<ItemBase | null>(null);
  const [parametros, setParametros] = useState(false);

  const itensQ = useQuery({
    queryKey: ["consultor-ia-base"],
    queryFn: () => listarBaseConhecimento({ data: { incluirInativos: true } }),
  });
  const ctx = useQuery({
    queryKey: ["conhecimento-contexto"],
    queryFn: () => contextoBase(),
    staleTime: 300_000,
  });
  const cats = useQuery({
    queryKey: ["consultor-ia-categorias"],
    queryFn: () => listarCategoriasBase(),
  });
  const podeEditar = ctx.data?.podeEditar ?? false;
  const podeNews = ctx.data?.podePublicarNews ?? false;

  const base = useMemo(() => itensQ.data ?? [], [itensQ.data]);
  const termos = useMemo(() => termosDe(q), [q]);
  const listaCategorias = useMemo(() => {
    const nomes = new Set<string>([
      ...(cats.data?.map((c) => c.nome) ?? CATEGORIAS_BASE),
      ...base.map((b) => b.categoria),
    ]);
    return [...nomes];
  }, [cats.data, base]);

  const catalogoTags = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const it of base) for (const t of it.tags) mapa.set(t, (mapa.get(t) ?? 0) + 1);
    return [...mapa.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 40);
  }, [base]);

  const contagem = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const it of base) mapa.set(it.categoria, (mapa.get(it.categoria) ?? 0) + 1);
    return mapa;
  }, [base]);

  const resultados = useMemo(() => {
    const lista = base.filter((it) => {
      if (categoria !== "todas" && it.categoria !== categoria) return false;
      if (filtro === "publicado" && it.status !== "publicado") return false;
      if (filtro === "rascunho" && it.status !== "rascunho") return false;
      if (filtro === "news" && !it.news_post_id) return false;
      if (tagsSel.length && !tagsSel.every((t) => it.tags.includes(t))) return false;
      return !termos.length || relevancia(it, termos) > 0;
    });
    return lista.sort((a, b) => {
      if (ordem === "az") return a.titulo.localeCompare(b.titulo);
      if (ordem === "recentes") return +new Date(b.updated_at) - +new Date(a.updated_at);
      if (ordem === "antigos") return +new Date(a.updated_at) - +new Date(b.updated_at);
      const r = relevancia(b, termos) - relevancia(a, termos);
      return r !== 0 ? r : +new Date(b.updated_at) - +new Date(a.updated_at);
    });
  }, [base, categoria, filtro, tagsSel, termos, ordem]);

  const excluir = useMutation({
    mutationFn: (id: string) => excluirItemBase({ data: { id } }),
    onSuccess: async () => {
      setLendo(null);
      await qc.invalidateQueries({ queryKey: ["consultor-ia-base"] });
      toast.success("Artigo removido da base.");
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Falha ao remover.")),
  });

  const abrirEdicao = (it: ItemBase) =>
    setEditando({
      id: it.id,
      categoria: it.categoria,
      titulo: it.titulo,
      resumo: it.resumo ?? "",
      conteudo: it.conteudo,
      tags: it.tags,
      ativo: it.ativo,
      global: it.correspondente_id === null,
      capa_url: it.capa_url,
      anexos: it.anexos,
    });

  const total = base.length;
  const publicados = base.filter((b) => b.status === "publicado").length;
  const rascunhos = total - publicados;
  const naNews = base.filter((b) => b.news_post_id).length;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm sm:p-6">
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <Icone3D icone={Library} tamanho="lg" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
                  Base de conhecimento
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                  Conhecimento em crédito imobiliário
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Artigos da equipe — com versões, rascunho e publicação. O que está publicado
                  alimenta o Consultor IA e pode ir para a Agilliza News.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setParametros(true)}>
                <Calculator className="size-4" /> Parâmetros de cálculo
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() =>
                  resultados.length
                    ? void gerarCompendioPDF(resultados, {
                        titulo:
                          categoria !== "todas"
                            ? `Base — ${nomeCategoria(categoria)}`
                            : "Base de conhecimento",
                        filtro: q.trim() || tagsSel.join(", ") || undefined,
                      })
                    : toast.error("Nenhum artigo no resultado atual.")
                }
              >
                <FileDown className="size-4" /> Coletânea PDF
              </Button>
              {podeEditar && (
                <Button
                  className="gap-2"
                  onClick={() =>
                    setEditando({ ...VAZIO, categoria: listaCategorias[0] ?? VAZIO.categoria })
                  }
                >
                  <Plus className="size-4" /> Novo artigo
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Pesquisar: FGTS, portabilidade, avaliação, ITBI…"
                className="h-12 rounded-xl bg-background/80 pl-10 pr-9 text-base shadow-sm"
              />
              {q && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setQ("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Select value={ordem} onValueChange={(v) => setOrdem(v as Ordem)}>
              <SelectTrigger className="h-12 w-[190px] rounded-xl bg-background/80">
                <ArrowUpDown className="mr-1 size-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevancia">Mais relevantes</SelectItem>
                <SelectItem value="recentes">Mais recentes</SelectItem>
                <SelectItem value="antigos">Mais antigos</SelectItem>
                <SelectItem value="az">Ordem alfabética</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["todos", `Todos ${total}`],
                ["publicado", `Publicados ${publicados}`],
                ["rascunho", `Rascunhos ${rascunhos}`],
                ["news", `Na News ${naNews}`],
              ] as const
            ).map(([v, r]) => (
              <button
                key={v}
                type="button"
                onClick={() => setFiltro(v)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filtro === v
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/40",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Categorias
            categorias={listaCategorias}
            contagem={contagem}
            total={total}
            atual={categoria}
            onEscolher={setCategoria}
            podeCriar={podeEditar}
            onCriada={() => qc.invalidateQueries({ queryKey: ["consultor-ia-categorias"] })}
          />
          {catalogoTags.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Tag className="size-3" /> Etiquetas
                </p>
                {tagsSel.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTagsSel([])}
                    className="text-[11px] text-primary hover:underline"
                  >
                    limpar
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {catalogoTags.map(([t, n]) => {
                  const on = tagsSel.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTagsSel((p) => (on ? p.filter((x) => x !== t) : [...p, t]))}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px]",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/70 bg-background hover:text-primary",
                      )}
                    >
                      {t} <span className="opacity-60">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {resultados.length} artigo{resultados.length === 1 ? "" : "s"}
            {q.trim() ? (
              <>
                {" "}
                para <span className="font-medium text-foreground">“{q.trim()}”</span>
              </>
            ) : null}
          </p>
          {itensQ.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          ) : itensQ.isError ? (
            <Estado3D
              tipo="erro"
              descricao={mensagemDeErro(itensQ.error, "Não foi possível carregar a base.")}
              acao={<Button onClick={() => itensQ.refetch()}>Tentar de novo</Button>}
            />
          ) : !resultados.length ? (
            <Estado3D
              icone={BookOpen}
              titulo={
                base.length ? "Nada encontrado com esses filtros" : "A base ainda não tem artigos"
              }
              descricao={
                base.length
                  ? "Ajuste a busca, a categoria ou as etiquetas."
                  : "Escreva o primeiro artigo: ele passa a orientar o Consultor IA."
              }
              acao={
                podeEditar && !base.length ? (
                  <Button onClick={() => setEditando({ ...VAZIO })}>Novo artigo</Button>
                ) : undefined
              }
            />
          ) : (
            resultados.map((it) => (
              <article
                key={it.id}
                role="button"
                tabIndex={0}
                onClick={() => setLendo(it)}
                onKeyDown={(e) => e.key === "Enter" && setLendo(it)}
                className="group flex cursor-pointer gap-4 rounded-2xl border border-border/60 bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
              >
                {it.capa_url && (
                  <img
                    src={it.capa_url}
                    alt=""
                    loading="lazy"
                    className="hidden h-24 w-36 shrink-0 rounded-xl object-cover sm:block"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <Badge variant="secondary">{nomeCategoria(it.categoria)}</Badge>
                    {it.status === "rascunho" ? (
                      <Badge variant="outline" className="gap-1 border-amber-400/60 text-amber-700">
                        <FilePen className="size-3" /> Rascunho
                      </Badge>
                    ) : null}
                    {it.news_post_id && (
                      <Badge className="gap-1">
                        <Megaphone className="size-3" /> Na News
                        {it.news_fim_em ? ` até ${dataCurta(it.news_fim_em)}` : ""}
                      </Badge>
                    )}
                    {it.correspondente_id === null && (
                      <Badge variant="outline" className="gap-1">
                        <Globe2 className="size-3" /> Global
                      </Badge>
                    )}
                    {!it.ativo && (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inativo
                      </Badge>
                    )}
                    <span className="text-muted-foreground">
                      · v{it.versao} · {dataCurta(it.updated_at)} · {minutosDeLeitura(it.conteudo)}{" "}
                      min
                      {it.anexos.length ? ` · ${it.anexos.length} anexo(s)` : ""}
                    </span>
                  </div>
                  <h2 className="mt-2 text-base font-semibold leading-snug transition-colors group-hover:text-primary">
                    {it.titulo}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {trechoDestaque(it, termos)}
                  </p>
                  {it.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {it.tags.slice(0, 6).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))
          )}
        </section>
      </div>

      <LeitorArtigo
        artigo={lendo}
        onFechar={() => setLendo(null)}
        podeEditar={podeEditar}
        podeNews={podeNews}
        onEditar={(it) => {
          setLendo(null);
          abrirEdicao(it);
        }}
        onVersoes={setVersoesDe}
        onNews={setNewsDe}
        onExcluir={(id) => excluir.mutateAsync(id).then(() => undefined)}
      />

      {editando && (
        <EditorArtigo
          rascunho={editando}
          categorias={listaCategorias}
          correspondenteId={ctx.data?.correspondenteId ?? null}
          podeGlobal={ctx.data?.podeGlobal ?? false}
          onFechar={() => setEditando(null)}
        />
      )}

      <VersoesDialog
        artigo={versoesDe}
        onFechar={() => setVersoesDe(null)}
        podeEditar={podeEditar}
      />
      <PublicarNewsDialog artigo={newsDe} onFechar={() => setNewsDe(null)} />
      <ParametrosConsultorDialog
        aberto={parametros}
        onAbertoChange={setParametros}
        podeEditar={podeEditar}
      />
    </div>
  );
}

function Categorias({
  categorias,
  contagem,
  total,
  atual,
  onEscolher,
  podeCriar,
  onCriada,
}: {
  categorias: string[];
  contagem: Map<string, number>;
  total: number;
  atual: string;
  onEscolher: (c: string) => void;
  podeCriar: boolean;
  onCriada: () => void;
}) {
  const [nova, setNova] = useState("");
  const criar = useMutation({
    mutationFn: () => criarCategoriaBase({ data: { nome: nova.trim() } }),
    onSuccess: () => {
      toast.success("Categoria criada.");
      setNova("");
      onCriada();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível criar a categoria.")),
  });
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Categorias
      </p>
      <div className="space-y-0.5">
        {[
          ["todas", "Todas", total] as const,
          ...categorias.map((c) => [c, nomeCategoria(c), contagem.get(c) ?? 0] as const),
        ].map(([v, r, n]) => (
          <button
            key={v}
            type="button"
            onClick={() => onEscolher(v)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm",
              atual === v ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted",
            )}
          >
            <span className="truncate">{r}</span>
            <span className="text-xs text-muted-foreground">{n}</span>
          </button>
        ))}
      </div>
      {podeCriar && (
        <div className="mt-2 flex gap-1.5">
          <Input
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            placeholder="Nova categoria"
            className="h-8 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={nova.trim().length < 2 || criar.isPending}
            onClick={() => criar.mutate()}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function LeitorArtigo({
  artigo,
  onFechar,
  podeEditar,
  podeNews,
  onEditar,
  onVersoes,
  onNews,
  onExcluir,
}: {
  artigo: ItemBase | null;
  onFechar: () => void;
  podeEditar: boolean;
  podeNews: boolean;
  onEditar: (it: ItemBase) => void;
  onVersoes: (it: ItemBase) => void;
  onNews: (it: ItemBase) => void;
  onExcluir: (id: string) => Promise<void>;
}) {
  const toc = artigo ? sumario(artigo.conteudo) : [];
  const abrirAnexo = async (a: AnexoBase) => {
    try {
      const r = await urlAnexoBase({ data: { caminho: a.caminho } });
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível abrir o anexo."));
    }
  };
  return (
    <Sheet open={!!artigo} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-3xl">
        {artigo && (
          <article>
            {artigo.capa_url && (
              <img src={artigo.capa_url} alt="" className="aspect-[16/6] w-full object-cover" />
            )}
            <div className="space-y-5 p-5 sm:p-8">
              <SheetHeader className="space-y-3 text-left">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <Badge variant="secondary">{nomeCategoria(artigo.categoria)}</Badge>
                  {artigo.status === "rascunho" && <Badge variant="outline">Rascunho</Badge>}
                  {artigo.news_post_id && <Badge>Na Agilliza News</Badge>}
                  <span className="text-muted-foreground">
                    Versão {artigo.versao} · atualizado em {dataCurta(artigo.updated_at)} ·{" "}
                    {minutosDeLeitura(artigo.conteudo)} min de leitura
                  </span>
                </div>
                <SheetTitle className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                  {artigo.titulo}
                </SheetTitle>
                {artigo.resumo && (
                  <p className="text-base leading-relaxed text-muted-foreground">{artigo.resumo}</p>
                )}
              </SheetHeader>
              <div className="flex flex-wrap gap-2">
                {podeEditar && (
                  <Button size="sm" className="gap-1.5" onClick={() => onEditar(artigo)}>
                    <Pencil className="size-3.5" /> Editar
                  </Button>
                )}
                {podeNews && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => onNews(artigo)}
                  >
                    <Megaphone className="size-3.5" />{" "}
                    {artigo.news_post_id ? "Atualizar na News" : "Publicar no Agilliza News"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => onVersoes(artigo)}
                >
                  <History className="size-3.5" /> Versões
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5"
                  onClick={() => void gerarVerbetePDF(artigo)}
                >
                  <Download className="size-3.5" /> PDF
                </Button>
                {podeEditar && (
                  <ConfirmDelete
                    titulo={`Excluir "${artigo.titulo}"?`}
                    descricao="O artigo sai da base e deixa de orientar o Consultor IA. Se estiver na News, tire-o de lá antes."
                    onConfirm={async () => {
                      await onExcluir(artigo.id).catch(() => undefined);
                    }}
                    trigger={
                      <Button size="sm" variant="ghost" className="gap-1.5 text-destructive">
                        <Trash2 className="size-3.5" /> Excluir
                      </Button>
                    }
                  />
                )}
              </div>
              {toc.length > 2 && (
                <nav className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Neste artigo
                  </p>
                  <ul className="space-y-1">
                    {toc.map((t) => (
                      <li key={t.ancora} className={t.nivel === 3 ? "pl-4" : ""}>
                        <a href={`#${t.ancora}`} className="text-primary hover:underline">
                          {t.texto}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
              <Separator />
              <ArtigoMarkdown conteudo={artigo.conteudo} />
              {artigo.anexos.length > 0 && (
                <div className="space-y-2 rounded-xl border border-border p-4">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <Paperclip className="size-4" /> Anexos
                  </p>
                  {artigo.anexos.map((a) => (
                    <button
                      key={a.caminho}
                      type="button"
                      onClick={() => void abrirAnexo(a)}
                      className="flex w-full items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-left text-sm hover:border-primary/40 hover:text-primary"
                    >
                      <span className="truncate">{a.nome}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {Math.max(1, Math.round(a.tamanho / 1024))} KB
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {artigo.tags.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Etiquetas: {artigo.tags.join(" · ")}
                </p>
              )}
            </div>
          </article>
        )}
      </SheetContent>
    </Sheet>
  );
}

function EditorArtigo({
  rascunho,
  categorias,
  correspondenteId,
  podeGlobal,
  onFechar,
}: {
  rascunho: Rascunho;
  categorias: string[];
  correspondenteId: string | null;
  podeGlobal: boolean;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const [r, setR] = useState<Rascunho>(rascunho);
  const [tag, setTag] = useState("");
  const [enviandoCapa, setEnviandoCapa] = useState(false);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const capaRef = useRef<HTMLInputElement>(null);
  const anexoRef = useRef<HTMLInputElement>(null);
  const chaveRascunho = `a7-base-rascunho-${rascunho.id ?? "novo"}`;

  // Rascunho local (perder o texto por fechar a aba não acontece mais).
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(chaveRascunho);
      if (salvo && !rascunho.id) setR({ ...rascunho, ...JSON.parse(salvo) });
    } catch {
      /* sem armazenamento */
    }
  }, [chaveRascunho, rascunho]);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(chaveRascunho, JSON.stringify(r));
      } catch {
        /* sem armazenamento */
      }
    }, 800);
    return () => clearTimeout(t);
  }, [r, chaveRascunho]);

  const salvar = useMutation({
    mutationFn: (status: "rascunho" | "publicado") =>
      salvarItemBase({
        data: {
          id: r.id,
          categoria: r.categoria,
          titulo: r.titulo.trim(),
          conteudo: r.conteudo.trim(),
          tags: r.tags,
          ativo: r.ativo,
          global: r.global,
          status,
          resumo: r.resumo.trim() || null,
          capa_url: r.capa_url,
          anexos: r.anexos,
        },
      }),
    onSuccess: async (_x, status) => {
      try {
        localStorage.removeItem(chaveRascunho);
      } catch {
        /* sem armazenamento */
      }
      await qc.invalidateQueries({ queryKey: ["consultor-ia-base"] });
      toast.success(status === "publicado" ? "Artigo publicado na base." : "Rascunho salvo.");
      onFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Falha ao salvar.")),
  });

  const enviarCapa = async (f?: File) => {
    if (!f || !correspondenteId) return;
    setEnviandoCapa(true);
    try {
      setR({ ...r, capa_url: await enviarImagemArtigo(correspondenteId, f) });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível enviar a capa."));
    } finally {
      setEnviandoCapa(false);
      if (capaRef.current) capaRef.current.value = "";
    }
  };
  const enviarAnexo = async (f?: File) => {
    if (!f || !correspondenteId) return;
    setEnviandoAnexo(true);
    try {
      const a = await enviarAnexoArtigo(correspondenteId, f);
      setR((x) => ({ ...x, anexos: [...x.anexos, a] }));
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível enviar o anexo."));
    } finally {
      setEnviandoAnexo(false);
      if (anexoRef.current) anexoRef.current.value = "";
    }
  };
  const addTag = () => {
    const t = tag.trim().toLowerCase();
    if (t && !r.tags.includes(t) && r.tags.length < 30) setR({ ...r, tags: [...r.tags, t] });
    setTag("");
  };
  const valido = r.titulo.trim().length >= 3 && r.conteudo.trim().length >= 10;

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{r.id ? "Editar artigo" : "Novo artigo"}</DialogTitle>
          <DialogDescription>
            Rascunho fica só aqui; publicado passa a orientar o Consultor IA. Cada salvamento guarda
            a versão anterior.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            <Input
              value={r.titulo}
              onChange={(e) => setR({ ...r, titulo: e.target.value })}
              placeholder="Título do artigo"
              className="h-12 text-lg font-semibold"
              aria-label="Título"
            />
            <Textarea
              value={r.resumo}
              onChange={(e) => setR({ ...r, resumo: e.target.value })}
              maxLength={400}
              rows={2}
              placeholder="Resumo em uma ou duas frases (aparece na lista, na busca e na News)."
              aria-label="Resumo"
            />
            <EditorMarkdown
              valor={r.conteudo}
              onChange={(v) => setR({ ...r, conteudo: v })}
              onEnviarImagem={
                correspondenteId ? (f) => enviarImagemArtigo(correspondenteId, f) : undefined
              }
            />
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={r.categoria} onValueChange={(v) => setR({ ...r, categoria: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c} value={c}>
                      {nomeCategoria(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Etiquetas</Label>
              <div className="flex gap-1.5">
                <Input
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="fgts, sfh…"
                  className="h-9"
                />
                <Button size="sm" variant="outline" className="h-9" onClick={addTag}>
                  <Plus className="size-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {r.tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setR({ ...r, tags: r.tags.filter((x) => x !== t) })}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-destructive/10"
                    title="Remover"
                  >
                    {t} <X className="size-3" />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Capa</Label>
              {r.capa_url ? (
                <div className="relative overflow-hidden rounded-xl border border-border">
                  <img src={r.capa_url} alt="Capa" className="aspect-[16/9] w-full object-cover" />
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute right-2 top-2 size-7"
                    onClick={() => setR({ ...r, capa_url: null })}
                    aria-label="Tirar capa"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  disabled={enviandoCapa || !correspondenteId}
                  onClick={() => capaRef.current?.click()}
                >
                  {enviandoCapa ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ImagePlus className="size-4" />
                  )}{" "}
                  Enviar capa
                </Button>
              )}
              <input
                ref={capaRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => void enviarCapa(e.target.files?.[0])}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Anexos</Label>
              {r.anexos.map((a) => (
                <div
                  key={a.caminho}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-2 py-1.5 text-xs"
                >
                  <span className="truncate">{a.nome}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setR({ ...r, anexos: r.anexos.filter((x) => x.caminho !== a.caminho) })
                    }
                    aria-label={`Remover ${a.nome}`}
                  >
                    <X className="size-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                disabled={enviandoAnexo || !correspondenteId}
                onClick={() => anexoRef.current?.click()}
              >
                {enviandoAnexo ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Paperclip className="size-3.5" />
                )}{" "}
                Anexar arquivo
              </Button>
              <input
                ref={anexoRef}
                type="file"
                accept=".pdf,.docx,.xlsx,.pptx,.csv,.txt,.png,.jpg,.jpeg"
                className="sr-only"
                onChange={(e) => void enviarAnexo(e.target.files?.[0])}
              />
              <p className="text-[11px] text-muted-foreground">
                Anexos ficam na base (privados), não vão para a News.
              </p>
            </div>
            <Separator />
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={r.ativo}
                onCheckedChange={(v) => setR({ ...r, ativo: v })}
                aria-label="Ativo"
              />{" "}
              Ativo
            </label>
            {podeGlobal && (
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={r.global}
                  onCheckedChange={(v) => setR({ ...r, global: v })}
                  aria-label="Global"
                />{" "}
                Global (vale para todas as contas)
              </label>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            variant="secondary"
            disabled={salvar.isPending || !valido}
            onClick={() => salvar.mutate("rascunho")}
          >
            <FilePen className="mr-1 size-4" /> Salvar rascunho
          </Button>
          <Button disabled={salvar.isPending || !valido} onClick={() => salvar.mutate("publicado")}>
            <BookMarked className="mr-1 size-4" /> Publicar na base
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VersoesDialog({
  artigo,
  onFechar,
  podeEditar,
}: {
  artigo: ItemBase | null;
  onFechar: () => void;
  podeEditar: boolean;
}) {
  const qc = useQueryClient();
  const [aberta, setAberta] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ["consultor-ia-versoes", artigo?.id],
    queryFn: () => listarVersoesArtigo({ data: { id: artigo!.id } }),
    enabled: !!artigo,
  });
  const restaurar = useMutation({
    mutationFn: (versao: number) => restaurarVersaoArtigo({ data: { id: artigo!.id, versao } }),
    onSuccess: async (r) => {
      toast.success(r.mensagem);
      await qc.invalidateQueries({ queryKey: ["consultor-ia-base"] });
      await qc.invalidateQueries({ queryKey: ["consultor-ia-versoes", artigo?.id] });
      onFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível restaurar.")),
  });
  return (
    <Dialog open={!!artigo} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-5 text-primary" /> Versões
          </DialogTitle>
          <DialogDescription className="break-words">
            “{artigo?.titulo}” está na versão {artigo?.versao}. Restaurar uma versão guarda a atual
            no histórico.
          </DialogDescription>
        </DialogHeader>
        {q.isLoading ? (
          <Skeleton className="h-40" />
        ) : !(q.data ?? []).length ? (
          <Estado3D
            compacto
            icone={History}
            titulo="Sem versões anteriores"
            descricao="A primeira edição do artigo cria o histórico."
          />
        ) : (
          <ul className="space-y-2">
            {q.data!.map((v) => (
              <li key={v.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      v{v.versao} · {v.titulo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(v.created_at).toLocaleString("pt-BR")} ·{" "}
                      {v.status === "rascunho" ? "rascunho" : "publicado"} ·{" "}
                      {minutosDeLeitura(v.conteudo)} min
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAberta(aberta === v.versao ? null : v.versao)}
                    >
                      {aberta === v.versao ? "Fechar" : "Ver"}
                    </Button>
                    {podeEditar && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={restaurar.isPending}
                        onClick={() => restaurar.mutate(v.versao)}
                      >
                        Restaurar
                      </Button>
                    )}
                  </div>
                </div>
                {aberta === v.versao && (
                  <div className="mt-3 max-h-80 overflow-y-auto rounded-lg bg-muted/30 p-3">
                    <ArtigoMarkdown conteudo={v.conteudo} variante="compacto" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
