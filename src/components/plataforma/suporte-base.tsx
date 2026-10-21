/**
 * Base de conhecimento do suporte da plataforma — o que evita o próximo chamado igual.
 * Artigo publicado aparece para as contas na ajuda dentro do Corretor.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BookOpen, Pencil, Plus } from "lucide-react";
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
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatData } from "@/lib/financeiro/format";
import {
  CATEGORIAS_ARTIGO,
  listarArtigosSuporte,
  salvarArtigoSuporte,
  type ArtigoSuporte,
} from "@/lib/plataforma/suporte.functions";
import { CATEGORIA_ROTULO } from "@/components/plataforma/suporte-chamado";

type Categoria = (typeof CATEGORIAS_ARTIGO)[number];

export function BaseConhecimento({ podeEditar }: { podeEditar: boolean }) {
  const listarFn = useServerFn(listarArtigosSuporte);
  const [editando, setEditando] = useState<ArtigoSuporte | "novo" | null>(null);
  const q = useQuery({
    queryKey: ["plataforma-suporte", "artigos"],
    queryFn: () => listarFn(),
    staleTime: 60_000,
  });
  const artigos = q.data?.artigos ?? [];

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Base de conhecimento</h2>
          <p className="text-xs text-muted-foreground">
            Artigo publicado aparece para o cliente dentro do produto e reduz chamado repetido.
          </p>
        </div>
        {podeEditar && (
          <Button size="sm" variant="outline" onClick={() => setEditando("novo")}>
            <Plus className="mr-1.5 size-4" /> Novo artigo
          </Button>
        )}
      </div>
      {q.isLoading ? (
        <div className="p-4">
          <Skeleton className="h-16" />
        </div>
      ) : q.isError ? (
        <p className="p-4 text-sm text-destructive">
          {mensagemDeErro(q.error, "Não foi possível carregar os artigos.")}
        </p>
      ) : artigos.length === 0 ? (
        <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <BookOpen className="size-4" /> A base está vazia. O primeiro artigo costuma ser o chamado
          que mais se repete.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {artigos.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <span className="break-words">{a.titulo}</span>
                  <Badge variant={a.publicado ? "default" : "outline"}>
                    {a.publicado ? "Publicado" : "Rascunho"}
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {CATEGORIA_ROTULO[a.categoria] ?? a.categoria} · {a.visualizacoes} leitura(s) ·
                  atualizado em {formatData(a.atualizado_em)}
                </p>
              </div>
              {podeEditar && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditando(a)}
                  aria-label={`Editar artigo ${a.titulo}`}
                >
                  <Pencil className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Sheet open={!!editando} onOpenChange={(v) => !v && setEditando(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {editando && (
            <EditorArtigo
              key={editando === "novo" ? "novo" : editando.id}
              artigo={editando === "novo" ? null : editando}
              onSalvo={() => setEditando(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function EditorArtigo({ artigo, onSalvo }: { artigo: ArtigoSuporte | null; onSalvo: () => void }) {
  const qc = useQueryClient();
  const salvarFn = useServerFn(salvarArtigoSuporte);
  const [titulo, setTitulo] = useState(artigo?.titulo ?? "");
  const [categoria, setCategoria] = useState<Categoria>(
    (CATEGORIAS_ARTIGO as readonly string[]).includes(artigo?.categoria ?? "")
      ? (artigo!.categoria as Categoria)
      : "duvida",
  );
  const [corpo, setCorpo] = useState(artigo?.corpo ?? "");
  const [publicado, setPublicado] = useState(artigo?.publicado ?? false);

  const salvar = useMutation({
    mutationFn: () =>
      salvarFn({ data: { id: artigo?.id ?? null, titulo, categoria, corpo, publicado } }),
    onSuccess: () => {
      toast.success("Artigo salvo.");
      qc.invalidateQueries({ queryKey: ["plataforma-suporte", "artigos"] });
      onSalvo();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar o artigo.")),
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle>{artigo ? "Editar artigo" : "Novo artigo"}</SheetTitle>
        <SheetDescription>
          Publicado, aparece na ajuda que as contas veem no sistema.
        </SheetDescription>
      </SheetHeader>
      <div className="mt-4 space-y-3">
        <div className="space-y-1">
          <Label htmlFor="art-titulo">Título</Label>
          <Input id="art-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="art-categoria">Categoria</Label>
          <Select value={categoria} onValueChange={(v) => setCategoria(v as Categoria)}>
            <SelectTrigger id="art-categoria" aria-label="Categoria do artigo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS_ARTIGO.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORIA_ROTULO[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="art-corpo">Conteúdo</Label>
          <Textarea
            id="art-corpo"
            rows={12}
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="art-publicado" checked={publicado} onCheckedChange={setPublicado} />
          <Label htmlFor="art-publicado" className="font-normal">
            Publicado
          </Label>
        </div>
        <Button
          disabled={salvar.isPending || titulo.trim().length < 4 || corpo.trim().length < 20}
          onClick={() => salvar.mutate()}
        >
          Salvar artigo
        </Button>
      </div>
    </>
  );
}
