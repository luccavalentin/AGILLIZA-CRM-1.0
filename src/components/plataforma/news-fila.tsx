import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ExternalLink,
  EyeOff,
  PenLine,
  Pin,
  PinOff,
  RefreshCw,
  ThumbsUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatData } from "@/lib/financeiro/format";
import {
  coletarAgoraNews,
  curarNoticia,
  type CategoriaNews,
  type NoticiaCuradoria,
  type StatusNoticia,
} from "@/lib/plataforma/news.functions";
import {
  ha,
  SeletorCategoria,
  STATUS_NOTICIA,
  STATUS_NOTICIA_ROTULO,
  STATUS_NOTICIA_TOM,
  useAcaoNews,
} from "./news-comum";

type Grupo = "fila" | "publicadas" | "descartadas" | "todas";
const grupoDe = (status: string): Exclude<Grupo, "todas"> =>
  status === "publicada" ? "publicadas" : status === "descartada" ? "descartadas" : "fila";
const ROTULO_GRUPO: Record<Grupo, string> = {
  fila: "Na fila",
  publicadas: "Publicadas",
  descartadas: "Descartadas",
  todas: "Todas",
};

type Curar = {
  id: string;
  titulo: string;
  resumo: string;
  categoria: string;
  tempoLeitura: string | number | null;
  fixada: boolean;
  status: StatusNoticia;
};

/** Os dados atuais da notícia no formato de `curarNoticia` (para as ações rápidas). */
function atual(n: NoticiaCuradoria): Curar {
  return {
    id: n.id,
    titulo: n.titulo ?? "",
    resumo: n.resumo ?? "",
    categoria: n.categoria ?? "",
    tempoLeitura: n.tempo_leitura_min,
    fixada: n.fixada,
    status: (STATUS_NOTICIA as readonly string[]).includes(n.status)
      ? (n.status as StatusNoticia)
      : "coletada",
  };
}

export function FilaCuradoriaNews({
  noticias,
  categorias,
  carregando,
  semColeta,
  pode,
}: {
  noticias: NoticiaCuradoria[];
  categorias: CategoriaNews[];
  carregando: boolean;
  semColeta: boolean;
  pode: boolean;
}) {
  const curarFn = useServerFn(curarNoticia);
  const curar = useAcaoNews(
    (d: Curar) => curarFn({ data: d }),
    "Não foi possível salvar a notícia.",
  );
  const coletarFn = useServerFn(coletarAgoraNews);
  const coletar = useAcaoNews(
    () => coletarFn({ data: { id: null } }),
    "Não foi possível pedir a coleta.",
  );
  const [grupo, setGrupo] = useState<Grupo>("fila");
  const [aberta, setAberta] = useState<NoticiaCuradoria | null>(null);
  const visiveis = noticias.filter((n) => grupo === "todas" || grupoDe(n.status) === grupo);
  const contar = (g: Grupo) =>
    g === "todas" ? noticias.length : noticias.filter((n) => grupoDe(n.status) === g).length;

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">Fila de notícias</h2>
          <p className="text-sm text-muted-foreground">
            O que chega das fontes nasce “coletada” e só vai ao ar com título e resumo próprios. O
            link para a matéria original continua visível ao leitor.
          </p>
        </div>
        <div className="w-full sm:w-48">
          <Label htmlFor="news-grupo" className="sr-only">
            Situação
          </Label>
          <Select value={grupo} onValueChange={(v) => setGrupo(v as Grupo)}>
            <SelectTrigger id="news-grupo" aria-label="Filtrar por situação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROTULO_GRUPO) as Grupo[]).map((g) => (
                <SelectItem key={g} value={g}>
                  {ROTULO_GRUPO[g]} ({contar(g)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {semColeta && pode && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-3 text-sm">
          <span>
            Nenhuma coleta ainda. O coletor lê as fontes sozinho no intervalo de cada uma; para
            começar agora, peça a coleta.
          </span>
          <Button size="sm" disabled={coletar.isPending} onClick={() => coletar.mutate(undefined)}>
            <RefreshCw className="mr-1 size-4" /> Coletar agora
          </Button>
        </div>
      )}

      {carregando ? (
        <Skeleton className="h-40" />
      ) : !visiveis.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {noticias.length
            ? "Nada nesta situação. As outras notícias continuam nos outros filtros."
            : "Nenhuma notícia coletada. Quando o coletor rodar, as matérias aparecem aqui."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {visiveis.map((n) => {
            const d = atual(n);
            const podePublicar = d.titulo.trim().length >= 8 && d.resumo.trim().length >= 20;
            return (
              <li key={n.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 break-words font-medium">
                    {n.titulo ?? n.titulo_original}
                  </span>
                  <Badge variant={STATUS_NOTICIA_TOM[n.status] ?? "outline"}>
                    {STATUS_NOTICIA_ROTULO[n.status] ?? n.status}
                  </Badge>
                  {n.fixada && (
                    <Badge variant="outline" className="gap-1">
                      <Pin className="size-3" /> Destaque
                    </Badge>
                  )}
                </div>
                <p className="break-words text-xs text-muted-foreground">
                  {n.fonte ?? "sem fonte"}
                  {n.publicada_na_fonte_em ? ` · ${formatData(n.publicada_na_fonte_em)}` : ""}
                  {n.revisor ? ` · revisada por ${n.revisor}` : ""}
                  {` · coletada ${ha(n.criado_em)}`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAberta(n)}
                    aria-label={`${pode ? "Curar" : "Ver"} ${n.titulo ?? n.titulo_original}`}
                  >
                    <PenLine className="mr-1 size-4" /> {pode ? "Curar" : "Ver"}
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <a href={n.url_original} target="_blank" rel="noreferrer noopener">
                      <ExternalLink className="mr-1 size-4" /> Original
                    </a>
                  </Button>
                  {pode && grupoDe(n.status) === "fila" && n.status !== "aprovada" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={curar.isPending}
                      onClick={() => curar.mutate({ ...d, status: "aprovada" })}
                    >
                      <ThumbsUp className="mr-1 size-4" /> Aprovar
                    </Button>
                  )}
                  {pode && n.status !== "publicada" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={curar.isPending || !podePublicar}
                      title={
                        podePublicar
                          ? undefined
                          : "Escreva título e resumo próprios antes de publicar."
                      }
                      onClick={() => curar.mutate({ ...d, status: "publicada" })}
                    >
                      <Check className="mr-1 size-4" /> Publicar
                    </Button>
                  )}
                  {pode && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={curar.isPending}
                      onClick={() => curar.mutate({ ...d, fixada: !d.fixada })}
                    >
                      {d.fixada ? (
                        <>
                          <PinOff className="mr-1 size-4" /> Tirar destaque
                        </>
                      ) : (
                        <>
                          <Pin className="mr-1 size-4" /> Destacar
                        </>
                      )}
                    </Button>
                  )}
                  {pode && n.status !== "descartada" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={curar.isPending}
                      onClick={() => curar.mutate({ ...d, status: "descartada", fixada: false })}
                    >
                      <EyeOff className="mr-1 size-4" /> Ocultar
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={Boolean(aberta)} onOpenChange={(v) => !v && setAberta(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{pode ? "Curar notícia" : "Notícia"}</SheetTitle>
            <SheetDescription>{aberta?.fonte ?? "Sem fonte"}</SheetDescription>
          </SheetHeader>
          {aberta && (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <Editor
                key={aberta.id}
                n={aberta}
                categorias={categorias}
                pode={pode}
                salvando={curar.isPending}
                onSalvar={(d) => curar.mutate(d, { onSuccess: () => setAberta(null) })}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function Editor({
  n,
  categorias,
  pode,
  salvando,
  onSalvar,
}: {
  n: NoticiaCuradoria;
  categorias: CategoriaNews[];
  pode: boolean;
  salvando: boolean;
  onSalvar: (d: Curar) => void;
}) {
  const [titulo, setTitulo] = useState(n.titulo ?? "");
  const [resumo, setResumo] = useState(n.resumo ?? "");
  const [categoria, setCategoria] = useState(n.categoria ?? categorias[0]?.id ?? "geral");
  const [tempo, setTempo] = useState(
    n.tempo_leitura_min == null ? "" : String(n.tempo_leitura_min),
  );
  const [fixada, setFixada] = useState(n.fixada);
  const [status, setStatus] = useState<StatusNoticia>(atual(n).status);
  // Categoria antiga que não existe mais no filtro continua visível para ser trocada.
  const opcoes =
    n.categoria && !categorias.some((c) => c.id === n.categoria)
      ? [...categorias, { id: n.categoria, nome: n.categoria }]
      : categorias;
  const nomeCategoria = opcoes.find((c) => c.id === categoria)?.nome ?? categoria;

  return (
    <div className="space-y-4 pb-4">
      <div className="space-y-1 rounded-md border border-border p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Matéria original
        </p>
        <p className="break-words text-sm">{n.titulo_original}</p>
        <a
          href={n.url_original}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          abrir na fonte <ExternalLink className="size-3" />
        </a>
      </div>

      <div className="space-y-1">
        <Label htmlFor="news-cur-titulo">Título</Label>
        <Input
          id="news-cur-titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Escreva com as suas palavras."
          disabled={!pode}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="news-cur-resumo">Resumo</Label>
        <Textarea
          id="news-cur-resumo"
          rows={4}
          value={resumo}
          onChange={(e) => setResumo(e.target.value)}
          placeholder="Em duas frases: o que aconteceu e o que isso muda para quem está comprando ou alugando."
          disabled={!pode}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SeletorCategoria
          id="news-cur-categoria"
          valor={categoria}
          onChange={setCategoria}
          opcoes={opcoes}
          disabled={!pode}
        />
        <div className="space-y-1">
          <Label htmlFor="news-cur-tempo">Tempo de leitura (min)</Label>
          <Input
            id="news-cur-tempo"
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            value={tempo}
            onChange={(e) => setTempo(e.target.value)}
            disabled={!pode}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="news-cur-fixada"
          checked={fixada}
          onCheckedChange={setFixada}
          disabled={!pode}
        />
        <Label htmlFor="news-cur-fixada">Destacar no topo da News</Label>
      </div>
      <div className="space-y-1">
        <Label htmlFor="news-cur-status">Situação</Label>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as StatusNoticia)}
          disabled={!pode}
        >
          <SelectTrigger id="news-cur-status" aria-label="Situação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_NOTICIA.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_NOTICIA_ROTULO[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className="space-y-1 rounded-md border border-dashed border-border bg-muted/30 p-3"
        aria-label="Como o corretor vê"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Como o corretor vê
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{nomeCategoria}</Badge>
          <span>
            {n.fonte ?? "veículo"}
            {tempo ? ` · ${tempo} min` : ""}
          </span>
        </div>
        <p className="break-words font-semibold">
          {titulo.trim() || <span className="text-muted-foreground">Sem título próprio ainda</span>}
        </p>
        <p className="break-words text-sm text-muted-foreground">
          {resumo.trim() || "Sem resumo — a notícia não vai ao ar assim."}
        </p>
      </div>

      {pode && (
        <Button
          className="w-full sm:w-auto"
          disabled={salvando}
          onClick={() =>
            onSalvar({
              id: n.id,
              titulo,
              resumo,
              categoria,
              tempoLeitura: tempo,
              fixada,
              status,
            })
          }
        >
          Salvar
        </Button>
      )}
    </div>
  );
}
