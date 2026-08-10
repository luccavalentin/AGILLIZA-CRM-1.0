import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { LinkIcon, Plus, Pencil, Trash2, ExternalLink, Search, Loader2, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  type LinkUtil,
  listarLinks,
  criarLink,
  atualizarLink,
  excluirLink,
  listarCategoriasLinks,
  type LinkCategoria,
} from "@/lib/links/links.functions";
import { OpHero, OpStat } from "@/components/operacional/ui";
import { CategoriasLinksDialog } from "@/components/links/categorias-dialog";
import { iconeCategoria, classeCategoria } from "@/lib/links/categorias-icones";
import { logoUrlDoBanco } from "@/components/bancos/banco-logo";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function LinksView() {
  const listar = useServerFn(listarLinks);
  const listarCats = useServerFn(listarCategoriasLinks);
  const excluirFn = useServerFn(excluirLink);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["links"], queryFn: () => listar() });
  const { data: categorias } = useQuery({
    queryKey: ["links-categorias"],
    queryFn: () => listarCats(),
  });

  const catPorNome = useMemo(() => {
    const m = new Map<string, { icone: string; cor: string }>();
    ((categorias ?? []) as LinkCategoria[]).forEach((c) =>
      m.set(c.nome.toLowerCase(), { icone: c.icone, cor: c.cor }),
    );
    return m;
  }, [categorias]);

  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const [gerenciandoCats, setGerenciandoCats] = useState(false);
  const [editando, setEditando] = useState<LinkUtil | null>(null);
  const [excluindo, setExcluindo] = useState<LinkUtil | null>(null);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const itens = data ?? [];
    if (!termo) return itens;
    return itens.filter((l) =>
      [l.titulo, l.descricao, l.categoria, l.url]
        .filter(Boolean)
        .some((c) => c!.toLowerCase().includes(termo)),
    );
  }, [data, busca]);

  const excluir = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Link excluído.");
      setExcluindo(null);
      qc.invalidateQueries({ queryKey: ["links"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao excluir."),
  });

  const totalLinks = (data ?? []).length;
  const totalCategorias = ((categorias ?? []) as LinkCategoria[]).length;

  return (
    <div className="mx-auto w-full max-w-none space-y-5 p-4 md:p-6">
      <OpHero
        icon={<LinkIcon className="h-5 w-5" />}
        eyebrow="Documentos"
        titulo="Links úteis"
        descricao="Repositório central de links. Busque e clique para abrir em nova aba."
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setGerenciandoCats(true)}>
              <Tags className="mr-2 h-4 w-4" />
              Categorias
            </Button>
            <Button onClick={() => setCriando(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo link
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <OpStat
          label="Links cadastrados"
          value={totalLinks}
          icon={<LinkIcon className="h-5 w-5 text-primary" />}
          tint="bg-primary/10 text-primary"
        />
        <button type="button" onClick={() => setGerenciandoCats(true)} className="text-left">
          <OpStat
            label="Categorias"
            value={totalCategorias}
            icon={<Tags className="h-5 w-5 text-primary" />}
            tint="bg-primary/10 text-primary"
          />
        </button>
      </div>

      {((categorias ?? []) as LinkCategoria[]).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {((categorias ?? []) as LinkCategoria[]).map((c) => {
            const Icon = iconeCategoria(c.icone);
            const ativo = busca.trim().toLowerCase() === c.nome.toLowerCase();
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setBusca(ativo ? "" : c.nome)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-all hover:scale-[1.03]",
                  classeCategoria(c.cor),
                  ativo && "ring-2",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {c.nome}
              </button>
            );
          })}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por título, descrição, categoria ou endereço…"
          className="pl-9"
        />
      </div>

      <div className="space-y-2.5">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : filtrados.length === 0 ? (
          <Card>
            <CardContent className="py-14 text-center">
              <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <LinkIcon className="h-6 w-6" />
              </span>
              <p className="text-sm text-muted-foreground">
                {busca ? "Nenhum link encontrado para a busca." : "Nenhum link cadastrado ainda."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filtrados.map((l) => {
            const meta = l.categoria ? catPorNome.get(l.categoria.toLowerCase()) : undefined;
            const CatIcon = meta ? iconeCategoria(meta.icone) : ExternalLink;
            const bancoLogo = logoUrlDoBanco(`${l.titulo} ${l.url}`);
            return (
              <div
                key={l.id}
                className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_10px_30px_-15px_hsl(var(--primary)/0.5)]"
              >
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl ring-1 transition-transform group-hover:scale-105",
                      bancoLogo ? "bg-white ring-border" : classeCategoria(meta?.cor),
                    )}
                  >
                    {bancoLogo ? (
                      <img
                        src={bancoLogo}
                        alt=""
                        className="h-6 w-6 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <CatIcon className="h-4 w-4" />
                    )}
                  </span>

                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-semibold text-foreground group-hover:text-primary">
                      {l.titulo}
                      {l.categoria && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "shrink-0 gap-1 font-normal",
                            meta && classeCategoria(meta.cor),
                          )}
                        >
                          <CatIcon className="h-3 w-3" />
                          {l.categoria}
                        </Badge>
                      )}
                    </p>

                    <p className="truncate text-xs text-muted-foreground">
                      {l.descricao ? `${l.descricao} · ` : ""}
                      {hostname(l.url)}
                    </p>
                  </div>
                </a>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditando(l)}>
                    <Pencil className="mr-1 h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setExcluindo(l)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {gerenciandoCats && <CategoriasLinksDialog onClose={() => setGerenciandoCats(false)} />}

      {criando && (
        <LinkDialog
          categorias={(categorias ?? []) as LinkCategoria[]}
          onClose={() => setCriando(false)}
          onDone={() => {
            setCriando(false);
            qc.invalidateQueries({ queryKey: ["links"] });
          }}
        />
      )}

      {editando && (
        <LinkDialog
          link={editando}
          categorias={(categorias ?? []) as LinkCategoria[]}
          onClose={() => setEditando(null)}
          onDone={() => {
            setEditando(null);
            qc.invalidateQueries({ queryKey: ["links"] });
          }}
        />
      )}

      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir link</AlertDialogTitle>
            <AlertDialogDescription>
              O link "{excluindo?.titulo}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => excluindo && excluir.mutate(excluindo.id)}
              disabled={excluir.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LinkDialog({
  link,
  categorias,
  onClose,
  onDone,
}: {
  link?: LinkUtil;
  categorias: LinkCategoria[];
  onClose: () => void;
  onDone: () => void;
}) {
  const criar = useServerFn(criarLink);
  const atualizar = useServerFn(atualizarLink);
  const [titulo, setTitulo] = useState(link?.titulo ?? "");
  const [url, setUrl] = useState(link?.url ?? "");
  const [descricao, setDescricao] = useState(link?.descricao ?? "");
  const [categoria, setCategoria] = useState(link?.categoria ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!titulo.trim()) {
      toast.error("Informe um título.");
      return;
    }
    if (!url.trim()) {
      toast.error("Informe a URL.");
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        titulo: titulo.trim(),
        url: url.trim(),
        descricao: descricao.trim() || null,
        categoria: categoria.trim() || null,
      };
      if (link) {
        await atualizar({ data: { id: link.id, ...payload } });
        toast.success("Link atualizado.");
      } else {
        await criar({ data: payload });
        toast.success("Link criado.");
      }
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle>{link ? "Editar link" : "Novo link"}</DialogTitle>
          <DialogDescription>
            {link ? "Atualize as informações do link." : "Adicione um link ao repositório."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Portal do Itaú"
            />
          </div>
          <div className="space-y-1.5">
            <Label>URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria (opcional)</Label>
            <Select
              value={categoria || "__nenhuma__"}
              onValueChange={(v) => setCategoria(v === "__nenhuma__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__nenhuma__">Sem categoria</SelectItem>
                {categorias.map((c) => {
                  const Icon = iconeCategoria(c.icone);
                  return (
                    <SelectItem key={c.id} value={c.nome}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {c.nome}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Gerencie as categorias e seus ícones no botão "Categorias".
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>

            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes sobre o link…"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
