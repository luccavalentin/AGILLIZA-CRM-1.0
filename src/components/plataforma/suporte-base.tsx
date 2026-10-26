/**
 * Base de conhecimento do suporte da plataforma — o que evita o próximo chamado igual.
 * Artigo publicado aparece para as contas na ajuda dentro do Agilliza Tech.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BookOpen, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  BarraFiltros,
  CampoBusca,
  ChipsFiltro,
  EstadoErro,
  EstadoVazio,
  ListaCarregando,
  Secao,
  Selo,
} from "@/components/plataforma/kit";
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
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<"todas" | Categoria>("todas");
  const q = useQuery({
    queryKey: ["plataforma-suporte", "artigos"],
    queryFn: () => listarFn(),
    staleTime: 60_000,
  });
  const artigos = q.data?.artigos ?? [];
  const termo = busca.trim().toLowerCase();
  const visiveis = artigos.filter(
    (a) =>
      (categoria === "todas" || a.categoria === categoria) &&
      (!termo || a.titulo.toLowerCase().includes(termo) || a.corpo.toLowerCase().includes(termo)),
  );
  const leituras = artigos.reduce((s, a) => s + Number(a.visualizacoes ?? 0), 0);

  return (
    <div className="space-y-4">
      <BarraFiltros>
        <CampoBusca valor={busca} onChange={setBusca} rotulo="Buscar artigo" placeholder="Título ou conteúdo" />
        <ChipsFiltro<"todas" | Categoria>
          rotulo="Categoria"
          valor={categoria}
          onChange={setCategoria}
          opcoes={[
            { valor: "todas", rotulo: "Todas", contagem: artigos.length },
            ...CATEGORIAS_ARTIGO.filter((c) => artigos.some((a) => a.categoria === c)).map((c) => ({
              valor: c,
              rotulo: CATEGORIA_ROTULO[c] ?? c,
              contagem: artigos.filter((a) => a.categoria === c).length,
            })),
          ]}
        />
        {podeEditar && (
          <Button size="sm" className="min-h-11 sm:min-h-9 md:ml-auto" onClick={() => setEditando("novo")}>
            <Plus className="mr-1.5 size-4" /> Novo artigo
          </Button>
        )}
      </BarraFiltros>
      <Secao
        semRespiro
        titulo="Base de conhecimento"
        descricao={`Artigo publicado aparece na ajuda das contas e evita o próximo chamado igual · ${leituras} leitura(s)`}
      >
        {q.isLoading && <ListaCarregando linhas={3} />}
        {q.isError && (
          <EstadoErro mensagem={mensagemDeErro(q.error, "Não foi possível carregar os artigos.")} onTentar={() => q.refetch()} />
        )}
        {!q.isLoading && !q.isError && visiveis.length === 0 && (
          <EstadoVazio
            icone={<BookOpen />}
            titulo={artigos.length ? "Nenhum artigo nesta busca" : "A base está vazia"}
            descricao={artigos.length ? undefined : "O primeiro artigo costuma ser o chamado que mais se repete."}
          />
        )}
        <ul className="divide-y divide-border/60">
          {visiveis.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="break-words text-sm font-medium">{a.titulo}</span>
                  <Selo tom={a.publicado ? "sucesso" : "neutro"} ponto={a.publicado}>
                    {a.publicado ? "Publicado" : "Rascunho"}
                  </Selo>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {CATEGORIA_ROTULO[a.categoria] ?? a.categoria} · {a.visualizacoes} leitura(s) · atualizado em{" "}
                  {formatData(a.atualizado_em)}
                </p>
              </div>
              {podeEditar && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-11 shrink-0 sm:size-8"
                  onClick={() => setEditando(a)}
                  aria-label={`Editar artigo ${a.titulo}`}
                >
                  <Pencil className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Secao>

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
    </div>
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
