import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  LayoutGrid,
  List,
  Search,
  Upload,
  UploadCloud,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
  definirMostrarNoMenu,
  pesquisarArquivos,
  type ArquivoNo,
  type ResultadoPesquisa,
} from "@/lib/documentos/arquivos.functions";
import { VisualizadorArquivo } from "@/components/comum/visualizador-arquivo";
import { sanitizePath, formatBytes } from "./gerenciador/arquivo-utils";
import { NoCard } from "./gerenciador/no-card";
import { TrilhaNavegacao } from "./gerenciador/trilha-navegacao";
import { MoverDialog } from "./gerenciador/mover-dialog";
import {
  ExcluirDialog,
  NovaPastaDialog,
  RenomearDialog,
} from "./gerenciador/dialogos-arquivo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface GerenciadorArquivosProps {
  /** Pasta inicial (id) ao montar. */
  pastaInicial?: string | null;
  /** Modo controlado: quando definido, sobrepõe o estado interno. */
  pasta?: string | null;
  onPastaChange?: (id: string | null) => void;
  /** Exibe o cabeçalho com título e ações. Default: true. */
  mostrarCabecalho?: boolean;
  titulo?: string;
  descricao?: string;
  className?: string;
}

export function GerenciadorArquivos({
  pastaInicial = null,
  pasta: pastaControlada,
  onPastaChange,
  mostrarCabecalho = true,
  titulo = "Arquivos",
  descricao = "Pastas e documentos do seu escritório.",
  className,
}: GerenciadorArquivosProps) {
  const qc = useQueryClient();
  const [pastaInterna, setPastaInterna] = useState<string | null>(pastaInicial ?? null);
  const pasta = pastaControlada !== undefined ? pastaControlada : pastaInterna;
  const setPasta = useCallback(
    (id: string | null) => {
      if (onPastaChange) onPastaChange(id);
      if (pastaControlada === undefined) setPastaInterna(id);
    },
    [onPastaChange, pastaControlada],
  );

  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState<{ atual: number; total: number } | null>(null);
  const [novaPastaAberta, setNovaPastaAberta] = useState(false);
  const [renomeando, setRenomeando] = useState<ArquivoNo | null>(null);
  const [excluindo, setExcluindo] = useState<ArquivoNo | null>(null);
  const [movendo, setMovendo] = useState<ArquivoNo | null>(null);
  const [dragging, setDragging] = useState(false);
  const [visualizando, setVisualizando] = useState<{ url: string; nome: string } | null>(null);
  const [vista, setVista] = useState<"grade" | "lista">("grade");

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

  const totais = useMemo(() => {
    const lista = nos.data ?? [];
    return {
      pastas: lista.filter((n) => n.tipo === "pasta").length,
      arquivos: lista.filter((n) => n.tipo === "arquivo").length,
      tamanho: lista.reduce((s, n) => s + (n.tipo === "arquivo" ? n.tamanho ?? 0 : 0), 0),
    };
  }, [nos.data]);

  const invalidar = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["arquivos"] });
    qc.invalidateQueries({ queryKey: ["nav-pastas-documentos"] });
  }, [qc]);

  const garantirPastas = useCallback(
    async (partes: string[], cache: Map<string, string>): Promise<string | null> => {
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
    },
    [pasta, fnCriarPasta],
  );

  const enviarArquivos = useCallback(
    async (files: File[], comCaminho: boolean) => {
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
              partes.pop();
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
    },
    [pasta, garantirPastas, fnRegistrar, invalidar],
  );

  const abrirNo = useCallback(
    async (no: ArquivoNo) => {
      if (no.tipo === "pasta") {
        setPasta(no.id);
        return;
      }
      try {
        const { url, nome } = await fnUrl({ data: { id: no.id } });
        setVisualizando({ url, nome });
      } catch (e: any) {
        toast.error(e?.message ?? "Não foi possível abrir o arquivo.");
      }
    },
    [setPasta, fnUrl],
  );

  const criarNovaPasta = useCallback(
    async (nome: string) => {
      try {
        await fnCriarPasta({ data: { parent_id: pasta, nome } });
        setNovaPastaAberta(false);
        invalidar();
        toast.success("Pasta criada.");
      } catch (e: any) {
        toast.error(e?.message ?? "Falha ao criar pasta.");
      }
    },
    [pasta, fnCriarPasta, invalidar],
  );

  const confirmarRenomear = useCallback(
    async (nome: string) => {
      if (!renomeando) return;
      try {
        await fnRenomear({ data: { id: renomeando.id, nome } });
        setRenomeando(null);
        invalidar();
        toast.success("Renomeado.");
      } catch (e: any) {
        toast.error(e?.message ?? "Falha ao renomear.");
      }
    },
    [renomeando, fnRenomear, invalidar],
  );

  const confirmarExcluir = useCallback(async () => {
    if (!excluindo) return;
    try {
      await fnExcluir({ data: { id: excluindo.id } });
      setExcluindo(null);
      invalidar();
      toast.success("Excluído.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir.");
    }
  }, [excluindo, fnExcluir, invalidar]);

  const confirmarMover = useCallback(
    async (destino: string | null) => {
      if (!movendo) return;
      try {
        await fnMover({ data: { id: movendo.id, novo_parent_id: destino } });
        setMovendo(null);
        invalidar();
        toast.success("Movido.");
      } catch (e: any) {
        toast.error(e?.message ?? "Falha ao mover.");
      }
    },
    [movendo, fnMover, invalidar],
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) enviarArquivos(files, false);
  }

  const acoes = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        className="flex-1 bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-sm sm:flex-none"
        onClick={() => setNovaPastaAberta(true)}
      >
        <FolderPlus className="mr-2 h-4 w-4" /> Nova pasta
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="flex-1 sm:flex-none"
        disabled={!!enviando}
        onClick={() => inputArquivos.current?.click()}
      >
        <Upload className="mr-2 h-4 w-4" /> Enviar arquivos
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="flex-1 sm:flex-none"
        disabled={!!enviando}
        onClick={() => inputPasta.current?.click()}
      >
        <UploadCloud className="mr-2 h-4 w-4" /> Enviar pasta
      </Button>
    </div>
  );

  return (
    <div className={cn("space-y-4", className)}>
      {mostrarCabecalho ? (
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm sm:p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-inner ring-1 ring-inset ring-primary/20">
              <FolderOpen className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                {titulo}
              </h1>
              <p className="text-sm text-muted-foreground">{descricao}</p>
            </div>
            <div className="col-span-2 lg:col-span-1 lg:justify-self-end">{acoes}</div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Organize pastas e arquivos livremente — crie, envie, renomeie e mova.
          </p>
          {acoes}
        </div>
      )}

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

      <TrilhaNavegacao
        trilha={trilha.data ?? []}
        pasta={pasta}
        onNavegar={setPasta}
        busca={busca}
        onBuscaChange={setBusca}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1">
            <Folder className="h-3.5 w-3.5 text-primary" /> {totais.pastas} pasta(s)
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1">
            <FileText className="h-3.5 w-3.5" /> {totais.arquivos} arquivo(s)
          </span>
          {totais.tamanho > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1">
              <HardDrive className="h-3.5 w-3.5" /> {formatBytes(totais.tamanho)}
            </span>
          )}
        </div>
        <div className="inline-flex rounded-lg border border-border/60 bg-card p-0.5 shadow-sm">
          <button
            type="button"
            aria-label="Ver em grade"
            aria-pressed={vista === "grade"}
            onClick={() => setVista("grade")}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              vista === "grade"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Ver em lista"
            aria-pressed={vista === "lista"}
            onClick={() => setVista("lista")}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              vista === "lista"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {enviando ? (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm text-foreground">
          <UploadCloud className="h-4 w-4 animate-pulse text-primary" />
          Enviando… {enviando.atual}/{enviando.total}
        </div>
      ) : null}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "min-h-[220px] rounded-xl border-2 border-dashed p-2 transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-transparent",
        )}
      >
        {nos.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground/70">
                <FolderOpen className="h-7 w-7" />
              </span>
              <p className="text-sm font-medium text-foreground">Esta pasta está vazia.</p>
              <p className="text-xs">
                Arraste arquivos aqui ou use <span className="font-medium">Nova pasta</span> /{" "}
                <span className="font-medium">Enviar arquivos</span>.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div
            className={cn(
              vista === "grade"
                ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "flex flex-col gap-2",
            )}
          >
            {filtrados.map((n) => (
              <NoCard
                key={n.id}
                no={n}
                variante={vista}
                onAbrir={abrirNo}
                onRenomear={setRenomeando}
                onMover={setMovendo}
                onExcluir={setExcluindo}
              />
            ))}
          </div>
        )}
      </div>

      <NovaPastaDialog
        open={novaPastaAberta}
        onOpenChange={setNovaPastaAberta}
        onCriar={criarNovaPasta}
      />
      <RenomearDialog
        no={renomeando}
        onClose={() => setRenomeando(null)}
        onConfirmar={confirmarRenomear}
      />
      <MoverDialog
        no={movendo}
        onClose={() => setMovendo(null)}
        carregarPastas={() => fnListarPastas()}
        onMover={confirmarMover}
      />
      <ExcluirDialog
        no={excluindo}
        onClose={() => setExcluindo(null)}
        onConfirmar={confirmarExcluir}
      />

      <VisualizadorArquivo
        arquivo={visualizando}
        open={!!visualizando}
        onOpenChange={(o) => !o && setVisualizando(null)}
      />
    </div>
  );
}
