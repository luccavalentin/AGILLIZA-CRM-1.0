import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpDown,
  BookMarked,
  BookOpen,
  CalendarClock,
  Download,
  FileDown,
  Globe2,
  Layers,
  Library,
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/utils";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  CATEGORIAS_BASE,
  excluirItemBase,
  listarBaseConhecimento,
  salvarItemBase,
  type ItemBase,
} from "@/lib/consultor-ia/consultor-ia.functions";
import { gerarCompendioPDF, gerarVerbetePDF } from "@/lib/consultor-ia/pdf-lazy";

export const Route = createFileRoute("/_authenticated/admin/consultor-ia-base")({
  head: () => ({
    meta: [
      { title: "Biblioteca de conhecimento — Agilliza" },
      {
        name: "description",
        content:
          "Biblioteca de crédito imobiliário da Agilliza: pesquise por palavra-chave e consulte verbetes curados que fundamentam a inteligência moderna.",
      },
      { property: "og:title", content: "Biblioteca de conhecimento — Agilliza" },
      {
        property: "og:description",
        content: "Pesquise por palavra-chave e consulte verbetes curados de crédito imobiliário.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => assertModuloPermitido("admin.parametros"),
  component: BibliotecaPage,
});

type Rascunho = {
  id?: string;
  categoria: string;
  titulo: string;
  conteudo: string;
  tags: string;
  ativo: boolean;
  global: boolean;
};

const VAZIO: Rascunho = {
  categoria: "Duvidas_Frequentes",
  titulo: "",
  conteudo: "",
  tags: "",
  ativo: true,
  global: true,
};

type Ordem = "relevancia" | "recentes" | "antigos" | "az";

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

function normalizar(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function termosDe(q: string) {
  return normalizar(q)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function textoPlano(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tempoLeitura(md: string) {
  const palavras = textoPlano(md).split(" ").length;
  return Math.max(1, Math.round(palavras / 200));
}

function relevancia(it: ItemBase, termos: string[]) {
  if (!termos.length) return 0;
  const titulo = normalizar(it.titulo);
  const tags = normalizar(it.tags.join(" "));
  const corpo = normalizar(textoPlano(it.conteudo));
  let score = 0;
  for (const t of termos) {
    if (titulo.includes(t)) score += 8;
    if (tags.includes(t)) score += 5;
    const ocorr = corpo.split(t).length - 1;
    score += Math.min(ocorr, 6);
  }
  return score;
}

function trechoDestaque(it: ItemBase, termos: string[]) {
  const plano = textoPlano(it.conteudo);
  if (!termos.length) return plano.slice(0, 230);
  const alvo = normalizar(plano);
  const pos = termos
    .map((t) => alvo.indexOf(t))
    .filter((p) => p >= 0)
    .sort((a, b) => a - b)[0];
  if (pos === undefined) return plano.slice(0, 230);
  const ini = Math.max(0, pos - 90);
  return `${ini > 0 ? "… " : ""}${plano.slice(ini, ini + 240)}…`;
}

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function periodoDe(iso: string) {
  const d = new Date(iso);
  const dias = (Date.now() - d.getTime()) / 86400000;
  if (dias <= 30) return "Últimos 30 dias";
  if (dias <= 90) return "Último trimestre";
  if (d.getFullYear() === new Date().getFullYear()) return `${d.getFullYear()}`;
  return `${d.getFullYear()}`;
}

function BibliotecaPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [tagsSel, setTagsSel] = useState<string[]>([]);
  const [ordem, setOrdem] = useState<Ordem>("relevancia");
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const [preview, setPreview] = useState(false);
  const [lendo, setLendo] = useState<ItemBase | null>(null);

  const { data: itens, isLoading } = useQuery({
    queryKey: ["consultor-ia-base"],
    queryFn: () => listarBaseConhecimento({ data: { incluirInativos: true } }),
  });

  const salvar = useMutation({
    mutationFn: (r: Rascunho) =>
      salvarItemBase({
        data: {
          id: r.id,
          categoria: r.categoria,
          titulo: r.titulo.trim(),
          conteudo: r.conteudo.trim(),
          tags: r.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          ativo: r.ativo,
          global: r.global,
        },
      }),
    onSuccess: async () => {
      setEditando(null);
      await qc.invalidateQueries({ queryKey: ["consultor-ia-base"] });
      toast.success("Verbete publicado na biblioteca.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => excluirItemBase({ data: { id } }),
    onSuccess: async () => {
      setLendo(null);
      await qc.invalidateQueries({ queryKey: ["consultor-ia-base"] });
      toast.success("Verbete removido da biblioteca.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover."),
  });

  const base = itens ?? [];
  const termos = useMemo(() => termosDe(q), [q]);

  const catalogoTags = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const it of base) for (const t of it.tags) mapa.set(t, (mapa.get(t) ?? 0) + 1);
    return [...mapa.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [base]);

  const contagemCategoria = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const it of base) mapa.set(it.categoria, (mapa.get(it.categoria) ?? 0) + 1);
    return mapa;
  }, [base]);

  const resultados = useMemo(() => {
    let lista = base.filter((it) => {
      if (categoria !== "todas" && it.categoria !== categoria) return false;
      if (tagsSel.length && !tagsSel.every((t) => it.tags.includes(t))) return false;
      if (!termos.length) return true;
      return relevancia(it, termos) > 0;
    });
    lista = [...lista].sort((a, b) => {
      if (ordem === "az") return a.titulo.localeCompare(b.titulo);
      if (ordem === "recentes") return +new Date(b.updated_at) - +new Date(a.updated_at);
      if (ordem === "antigos") return +new Date(a.updated_at) - +new Date(b.updated_at);
      const r = relevancia(b, termos) - relevancia(a, termos);
      return r !== 0 ? r : +new Date(b.updated_at) - +new Date(a.updated_at);
    });
    return lista;
  }, [base, categoria, tagsSel, termos, ordem]);

  const grupos = useMemo(() => {
    if (ordem === "az" || (ordem === "relevancia" && termos.length)) {
      return [{ rotulo: null as string | null, itens: resultados }];
    }
    const mapa = new Map<string, ItemBase[]>();
    for (const it of resultados) {
      const k = periodoDe(it.updated_at);
      mapa.set(k, [...(mapa.get(k) ?? []), it]);
    }
    return [...mapa.entries()].map(([rotulo, itens]) => ({ rotulo, itens }));
  }, [resultados, ordem, termos]);

  function abrirEdicao(it: ItemBase) {
    setEditando({
      id: it.id,
      categoria: it.categoria,
      titulo: it.titulo,
      conteudo: it.conteudo,
      tags: it.tags.join(", "),
      ativo: it.ativo,
      global: it.correspondente_id === null,
    });
    setPreview(false);
  }

  function baixarColetanea() {
    if (!resultados.length) {
      toast.error("Nenhum verbete no resultado atual.");
      return;
    }
    void gerarCompendioPDF(resultados, {
      titulo:
        categoria !== "todas"
          ? `Biblioteca — ${categoria.replace(/_/g, " ")}`
          : "Biblioteca de Conhecimento",
      filtro: q.trim() || tagsSel.join(", ") || undefined,
    });
  }

  const filtrosAtivos = categoria !== "todas" || tagsSel.length > 0 || q.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Hero de pesquisa */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(to right, hsl(var(--primary)/0.35) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--primary)/0.35) 1px, transparent 1px)",
            backgroundSize: "34px 34px",
          }}
        />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
                <Library className="size-3.5" />
                Biblioteca Agilliza
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Conhecimento em crédito imobiliário
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Pesquise por palavra-chave e encontre verbetes curados — ordenados por relevância ou
                data. É esse acervo que fundamenta a inteligência moderna.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" onClick={baixarColetanea}>
                <FileDown className="size-4" />
                Baixar coletânea
              </Button>
              <Button
                onClick={() => {
                  setEditando({ ...VAZIO });
                  setPreview(false);
                }}
                className="gap-2"
              >
                <Plus className="size-4" />
                Novo verbete
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[260px] flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Pesquisar por palavra-chave: FGTS, portabilidade, avaliação, ITBI…"
                className="h-12 rounded-xl border-border/70 bg-background/80 pl-10 pr-9 text-base shadow-sm backdrop-blur"
              />
              {q ? (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setQ("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            <Select value={ordem} onValueChange={(v) => setOrdem(v as Ordem)}>
              <SelectTrigger className="h-12 w-[200px] rounded-xl bg-background/80">
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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <BookMarked className="size-3.5" />
              {base.length} verbetes
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Layers className="size-3.5" />
              {contagemCategoria.size} categorias
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Tag className="size-3.5" />
              {catalogoTags.length} palavras-chave
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[248px_minmax(0,1fr)]">
        {/* Estantes / facetas */}
        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border border-border/60 bg-card p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Estantes
            </p>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => setCategoria("todas")}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                  categoria === "todas"
                    ? "bg-primary/10 font-medium text-primary"
                    : "hover:bg-muted",
                )}
              >
                Todas <span className="text-xs text-muted-foreground">{base.length}</span>
              </button>
              {CATEGORIAS_BASE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoria(c)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                    categoria === c ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted",
                  )}
                >
                  <span className="truncate">{c.replace(/_/g, " ")}</span>
                  <span className="text-xs text-muted-foreground">
                    {contagemCategoria.get(c) ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {catalogoTags.length > 0 ? (
            <div className="rounded-xl border border-border/60 bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Palavras-chave
                </p>
                {tagsSel.length ? (
                  <button
                    type="button"
                    onClick={() => setTagsSel([])}
                    className="text-[11px] text-primary hover:underline"
                  >
                    limpar
                  </button>
                ) : null}
              </div>
              <ScrollArea className="max-h-[260px] pr-2">
                <div className="flex flex-wrap gap-1.5">
                  {catalogoTags.map(([t, n]) => {
                    const on = tagsSel.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          setTagsSel((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))
                        }
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border/70 bg-background hover:border-primary/50 hover:text-primary",
                        )}
                      >
                        {t} <span className="opacity-60">{n}</span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          ) : null}
        </aside>

        {/* Prateleira de resultados */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {resultados.length} resultado{resultados.length === 1 ? "" : "s"}
              {q.trim() ? (
                <>
                  {" "}
                  para <span className="font-medium text-foreground">“{q.trim()}”</span>
                </>
              ) : null}
            </span>
            {filtrosAtivos ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => {
                  setQ("");
                  setCategoria("todas");
                  setTagsSel([]);
                }}
              >
                <X className="size-3.5" />
                Limpar filtros
              </Button>
            ) : null}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          ) : resultados.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-card p-10 text-center">
              <BookOpen className="mx-auto size-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium">Nada encontrado nesta estante</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ajuste a palavra-chave ou escreva um novo verbete sobre o tema.
              </p>
            </div>
          ) : (
            grupos.map((g) => (
              <div key={g.rotulo ?? "todos"} className="space-y-3">
                {g.rotulo ? (
                  <div className="flex items-center gap-3 pt-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <CalendarClock className="size-3.5" />
                      {g.rotulo}
                    </span>
                    <Separator className="flex-1" />
                  </div>
                ) : null}

                {g.itens.map((it) => (
                  <article
                    key={it.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setLendo(it)}
                    onKeyDown={(e) => e.key === "Enter" && setLendo(it)}
                    className="group cursor-pointer rounded-xl border border-border/60 bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <Badge variant="secondary">{it.categoria.replace(/_/g, " ")}</Badge>
                          {it.correspondente_id === null ? (
                            <Badge variant="outline" className="gap-1">
                              <Globe2 className="size-3" /> Global
                            </Badge>
                          ) : null}
                          {!it.ativo ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              Inativo
                            </Badge>
                          ) : null}
                          <span className="text-muted-foreground">
                            · {dataCurta(it.updated_at)} · {tempoLeitura(it.conteudo)} min de
                            leitura
                          </span>
                        </div>
                        <h2 className="mt-2 text-base font-semibold leading-snug transition-colors group-hover:text-primary">
                          {it.titulo}
                        </h2>
                        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                          {trechoDestaque(it, termos)}
                        </p>
                        {it.tags.length ? (
                          <div className="mt-2.5 flex flex-wrap gap-1">
                            {it.tags.slice(0, 6).map((t) => (
                              <span
                                key={t}
                                className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div
                        className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label="Baixar em PDF"
                          onClick={() => void gerarVerbetePDF(it)}
                        >
                          <Download className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label="Editar"
                          onClick={() => abrirEdicao(it)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label="Excluir"
                          onClick={() => excluir.mutate(it.id)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ))
          )}
        </section>
      </div>

      {/* Leitor */}
      <Dialog open={!!lendo} onOpenChange={(o) => !o && setLendo(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {lendo ? (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <Badge variant="secondary">{lendo.categoria.replace(/_/g, " ")}</Badge>
                  <span className="text-muted-foreground">
                    Atualizado em {dataCurta(lendo.updated_at)} · {tempoLeitura(lendo.conteudo)} min
                  </span>
                </div>
                <DialogTitle className="text-xl leading-snug">{lendo.titulo}</DialogTitle>
                {lendo.tags.length ? (
                  <DialogDescription>{lendo.tags.join(" · ")}</DialogDescription>
                ) : null}
              </DialogHeader>
              <Separator />
              <div className="prose-sm max-w-none text-sm leading-relaxed">
                <Markdown conteudo={lendo.conteudo} />
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => void gerarVerbetePDF(lendo)}
                >
                  <Download className="size-4" />
                  Baixar PDF
                </Button>
                <Button
                  className="gap-2"
                  onClick={() => {
                    abrirEdicao(lendo);
                    setLendo(null);
                  }}
                >
                  <Pencil className="size-4" />
                  Editar verbete
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Editor */}
      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editando?.id ? "Editar verbete" : "Novo verbete"}</DialogTitle>
            <DialogDescription>
              O texto abaixo entra na biblioteca e é usado como referência pela inteligência.
            </DialogDescription>
          </DialogHeader>

          {editando ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select
                    value={editando.categoria}
                    onValueChange={(v) => setEditando({ ...editando, categoria: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_BASE.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Palavras-chave (separadas por vírgula)</Label>
                  <Input
                    value={editando.tags}
                    onChange={(e) => setEditando({ ...editando, tags: e.target.value })}
                    placeholder="fgts, sfh, carencia"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input
                  value={editando.titulo}
                  onChange={(e) => setEditando({ ...editando, titulo: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Conteúdo (markdown)</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setPreview((p) => !p)}
                  >
                    {preview ? "Editar" : "Preview"}
                  </Button>
                </div>
                {preview ? (
                  <div className="min-h-[200px] rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
                    <Markdown conteudo={editando.conteudo} />
                  </div>
                ) : (
                  <Textarea
                    value={editando.conteudo}
                    onChange={(e) => setEditando({ ...editando, conteudo: e.target.value })}
                    rows={12}
                    className="font-mono text-xs"
                  />
                )}
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={editando.ativo}
                    onCheckedChange={(v) => setEditando({ ...editando, ativo: v })}
                  />
                  Ativo
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={editando.global}
                    onCheckedChange={(v) => setEditando({ ...editando, global: v })}
                  />
                  Conteúdo global (vale para todos)
                </label>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                salvar.isPending ||
                !editando ||
                editando.titulo.trim().length < 3 ||
                editando.conteudo.trim().length < 10
              }
              onClick={() => editando && salvar.mutate(editando)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
