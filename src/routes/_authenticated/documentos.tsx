import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ChevronRight,
  Download,
  FileText,
  FolderOpen,
  FolderPlus,
  Folder,
  Home,
  MoreVertical,
  Move,
  Pencil,
  Search,
  Trash2,
  Upload,
  UploadCloud,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarNos,
  caminhoNo,
  criarPasta,
  registrarArquivo,
  renomearNo,
  excluirNo,
  moverNo,
  urlArquivo,
  listarPastas,
  type ArquivoNo,
} from "@/lib/documentos/arquivos.functions";
import { VisualizadorArquivo } from "@/components/comum/visualizador-arquivo";

export const Route = createFileRoute("/_authenticated/documentos")({
  head: () => ({ meta: [{ title: "Arquivos — Agilliza" }] }),
  validateSearch: (search: Record<string, unknown>): { pasta?: string } => ({
    pasta: typeof search.pasta === "string" ? search.pasta : undefined,
  }),
  beforeLoad: () => assertModuloPermitido("documentos.arquivos"),
  component: Pagina,
});

function formatBytes(n: number | null): string {
  if (!n) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

function sanitizePath(nome: string): string {
  return nome.replace(/[^\w.\-]+/g, "_").slice(0, 100);
}

function Pagina() {
  const qc = useQueryClient();
  const { pasta: pastaParam } = Route.useSearch();
  const [pasta, setPasta] = useState<string | null>(pastaParam ?? null);
  useEffect(() => {
    setPasta(pastaParam ?? null);
  }, [pastaParam]);
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState<{ atual: number; total: number } | null>(null);
  const [novaPastaAberta, setNovaPastaAberta] = useState(false);
  const [nomeNovaPasta, setNomeNovaPasta] = useState("");
  const [renomeando, setRenomeando] = useState<ArquivoNo | null>(null);
  const [nomeRenomear, setNomeRenomear] = useState("");
  const [excluindo, setExcluindo] = useState<ArquivoNo | null>(null);
  const [movendo, setMovendo] = useState<ArquivoNo | null>(null);
  const [dragging, setDragging] = useState(false);
  const [visualizando, setVisualizando] = useState<{ url: string; nome: string } | null>(null);

  const inputArquivos = useRef<HTMLInputElement>(null);
  const inputPasta = useRef<HTMLInputElement>(null);

  const fnListar = useServerFn(listarNos);
  const fnCaminho = useServerFn(caminhoNo);
  const fnCriarPasta = useServerFn(criarPasta);
  const fnRegistrar = useServerFn(registrarArquivo);
  const fnRenomear = useServerFn(renomearNo);
  const fnExcluir = useServerFn(excluirNo);
  const fnMover = useServerFn(moverNo);
  const fnUrl = useServerFn(urlArquivo);
  const fnListarPastas = useServerFn(listarPastas);

  const nos = useQuery({
    queryKey: ["arquivos", pasta],
    queryFn: () => fnListar({ data: { parent_id: pasta } }),
  });
  const trilha = useQuery({
    queryKey: ["arquivos-trilha", pasta],
    queryFn: () => fnCaminho({ data: { id: pasta } }),
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = nos.data ?? [];
    if (!q) return lista;
    return lista.filter((n) => n.nome.toLowerCase().includes(q));
  }, [nos.data, busca]);

  const invalidar = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["arquivos"] });
    qc.invalidateQueries({ queryKey: ["nav-pastas-documentos"] });
  }, [qc]);

  /** Garante a existência da árvore de pastas (relativa à pasta atual) e retorna o id da folha. */
  async function garantirPastas(partes: string[], cache: Map<string, string>): Promise<string | null> {
    let paiId = pasta;
    let chaveAcc = "";
    for (const parte of partes) {
      chaveAcc = `${chaveAcc}/${parte}`;
      const cacheado = cache.get(chaveAcc);
      if (cacheado) {
        paiId = cacheado;
        continue;
      }
      const { id } = await fnCriarPasta({ data: { parent_id: paiId, nome: parte } });
      cache.set(chaveAcc, id);
      paiId = id;
    }
    return paiId;
  }

  async function enviarArquivos(files: File[], comCaminho: boolean) {
    if (files.length === 0) return;
    setEnviando({ atual: 0, total: files.length });
    const cachePastas = new Map<string, string>();
    let ok = 0;
    let falhas = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        let destino = pasta;
        if (comCaminho) {
          const rel = (file as any).webkitRelativePath as string | undefined;
          if (rel && rel.includes("/")) {
            const partes = rel.split("/");
            partes.pop(); // remove nome do arquivo
            destino = await garantirPastas(partes, cachePastas);
          }
        }
        const storagePath = `${crypto.randomUUID()}-${sanitizePath(file.name)}`;
        const { error } = await supabase.storage.from("arquivos").upload(storagePath, file, {
          contentType: file.type || undefined,
        });
        if (error) throw error;
        await fnRegistrar({
          data: {
            parent_id: destino,
            nome: file.name,
            storage_path: storagePath,
            content_type: file.type || null,
            tamanho: file.size,
          },
        });
        ok++;
      } catch {
        falhas++;
      }
      setEnviando({ atual: i + 1, total: files.length });
    }
    setEnviando(null);
    invalidar();
    if (falhas > 0) toast.warning(`${ok} enviado(s), ${falhas} com falha.`);
    else toast.success(`${ok} arquivo(s) enviado(s).`);
  }

  async function abrirArquivo(id: string) {
    try {
      const { url, nome } = await fnUrl({ data: { id } });
      setVisualizando({ url, nome });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível abrir o arquivo.");
    }
  }

  async function criarNovaPasta() {
    const nome = nomeNovaPasta.trim();
    if (!nome) return;
    try {
      await fnCriarPasta({ data: { parent_id: pasta, nome } });
      setNovaPastaAberta(false);
      setNomeNovaPasta("");
      invalidar();
      toast.success("Pasta criada.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar pasta.");
    }
  }

  async function confirmarRenomear() {
    if (!renomeando) return;
    const nome = nomeRenomear.trim();
    if (!nome) return;
    try {
      await fnRenomear({ data: { id: renomeando.id, nome } });
      setRenomeando(null);
      invalidar();
      toast.success("Renomeado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao renomear.");
    }
  }

  async function confirmarExcluir() {
    if (!excluindo) return;
    try {
      await fnExcluir({ data: { id: excluindo.id } });
      setExcluindo(null);
      invalidar();
      toast.success("Excluído.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir.");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) enviarArquivos(files, false);
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FolderOpen className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Arquivos</h1>
            <p className="text-sm text-muted-foreground">Pastas e documentos do seu escritório.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setNovaPastaAberta(true)}>
            <FolderPlus className="mr-2 h-4 w-4" /> Nova pasta
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!!enviando}
            onClick={() => inputArquivos.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" /> Enviar arquivos
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!!enviando}
            onClick={() => inputPasta.current?.click()}
          >
            <UploadCloud className="mr-2 h-4 w-4" /> Enviar pasta
          </Button>
        </div>
      </div>

      <input
        ref={inputArquivos}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          enviarArquivos(files, false);
        }}
      />
      <input
        ref={inputPasta}
        type="file"
        hidden
        // @ts-expect-error atributos não-padrão para upload de pasta
        webkitdirectory=""
        directory=""
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          enviarArquivos(files, true);
        }}
      />

      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <button
          className="flex items-center gap-1 rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => setPasta(null)}
        >
          <Home className="h-4 w-4" /> Início
        </button>
        {(trilha.data ?? []).map((m) => (
          <span key={m.id} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <button
              className="rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setPasta(m.id)}
            >
              {m.nome}
            </button>
          </span>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar nesta pasta…"
          className="pl-9"
        />
      </div>

      {enviando ? (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
          Enviando… {enviando.atual}/{enviando.total}
        </div>
      ) : null}

      {/* Área de conteúdo com drag & drop */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`min-h-[200px] rounded-lg border-2 border-dashed p-2 transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-transparent"
        }`}
      >
        {nos.isLoading ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center text-muted-foreground">
              <FolderOpen className="h-10 w-10" />
              <p className="text-sm">Esta pasta está vazia.</p>
              <p className="text-xs">Arraste arquivos aqui ou use os botões acima.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((n) => (
              <div
                key={n.id}
                className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary/40"
              >
                <button
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onDoubleClick={() => (n.tipo === "pasta" ? setPasta(n.id) : abrirArquivo(n.id))}
                  onClick={() => n.tipo === "pasta" && setPasta(n.id)}
                >
                  {n.tipo === "pasta" ? (
                    <Folder className="h-8 w-8 shrink-0 text-primary" />
                  ) : (
                    <FileText className="h-8 w-8 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{n.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {n.tipo === "pasta"
                        ? "Pasta"
                        : `${formatBytes(n.tamanho)} · ${new Date(n.created_at).toLocaleDateString("pt-BR")}`}
                    </p>
                    {n.criado_por_nome ? (
                      <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate">{n.criado_por_nome}</span>
                      </span>
                    ) : null}
                  </div>

                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {n.tipo === "pasta" ? (
                      <DropdownMenuItem onClick={() => setPasta(n.id)}>
                        <FolderOpen className="mr-2 h-4 w-4" /> Abrir
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => abrirArquivo(n.id)}>
                        <Download className="mr-2 h-4 w-4" /> Abrir / baixar
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => {
                        setRenomeando(n);
                        setNomeRenomear(n.nome);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" /> Renomear
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setMovendo(n)}>
                      <Move className="mr-2 h-4 w-4" /> Mover
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setExcluindo(n)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog nova pasta */}
      <Dialog open={novaPastaAberta} onOpenChange={setNovaPastaAberta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova pasta</DialogTitle>
            <DialogDescription>Crie uma pasta na localização atual.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={nomeNovaPasta}
            onChange={(e) => setNomeNovaPasta(e.target.value)}
            placeholder="Nome da pasta"
            onKeyDown={(e) => e.key === "Enter" && criarNovaPasta()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaPastaAberta(false)}>
              Cancelar
            </Button>
            <Button onClick={criarNovaPasta}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog renomear */}
      <Dialog open={!!renomeando} onOpenChange={(o) => !o && setRenomeando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={nomeRenomear}
            onChange={(e) => setNomeRenomear(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmarRenomear()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenomeando(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarRenomear}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog mover */}
      <MoverDialog
        no={movendo}
        onClose={() => setMovendo(null)}
        carregarPastas={() => fnListarPastas()}
        onMover={async (destino) => {
          if (!movendo) return;
          try {
            await fnMover({ data: { id: movendo.id, novo_parent_id: destino } });
            setMovendo(null);
            invalidar();
            toast.success("Movido.");
          } catch (e: any) {
            toast.error(e?.message ?? "Falha ao mover.");
          }
        }}
      />

      {/* Excluir */}
      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {excluindo?.tipo === "pasta" ? "pasta" : "arquivo"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {excluindo?.tipo === "pasta"
                ? "A pasta e todo o seu conteúdo serão removidos permanentemente."
                : "O arquivo será removido permanentemente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExcluir}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VisualizadorArquivo
        arquivo={visualizando}
        open={!!visualizando}
        onOpenChange={(o) => !o && setVisualizando(null)}
      />
    </div>
  );
}

function MoverDialog({
  no,
  onClose,
  carregarPastas,
  onMover,
}: {
  no: ArquivoNo | null;
  onClose: () => void;
  carregarPastas: () => Promise<{ id: string; nome: string; caminho: string }[]>;
  onMover: (destino: string | null) => void;
}) {
  const pastas = useQuery({
    queryKey: ["arquivos-pastas-mover"],
    queryFn: carregarPastas,
    enabled: !!no,
  });

  return (
    <Dialog open={!!no} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover "{no?.nome}"</DialogTitle>
          <DialogDescription>Escolha a pasta de destino.</DialogDescription>
        </DialogHeader>
        <div className="max-h-72 space-y-1 overflow-auto">
          <button
            className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => onMover(null)}
          >
            <Home className="h-4 w-4 text-muted-foreground" /> Início (raiz)
          </button>
          {(pastas.data ?? [])
            .filter((p) => p.id !== no?.id)
            .map((p) => (
              <button
                key={p.id}
                className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => onMover(p.id)}
              >
                <Folder className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{p.caminho}</span>
              </button>
            ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
