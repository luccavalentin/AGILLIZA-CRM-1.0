/**
 * Gerenciador de Arquivos (Documentos diversos › Arquivos) — pedido do dono de 26/10/2026.
 *
 * Navegação à esquerda (Meus arquivos, Favoritos, Compartilhados comigo, Recentes, Lixeira
 * e o espaço usado), trilha + busca + ações em cima, conteúdo em grade ou lista. Arrastar
 * arquivos do computador envia para a pasta aberta; arrastar um item sobre uma pasta (ou
 * sobre a trilha) move. Cada ação aparece conforme o nível da pessoa no item (o banco
 * confere de novo: ver / editar / gerir).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  Clock,
  FolderOpen,
  FolderPlus,
  HardDrive,
  LayoutGrid,
  List,
  Loader2,
  Search,
  Share2,
  Star,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  alternarFavorito,
  caminhoNo,
  criarPasta,
  definirCota,
  definirMostrarNoMenu,
  lerArmazenamento,
  listarArquivos,
  listarPastas,
  moverNo,
  moverParaLixeira,
  registrarArquivo,
  renomearNo,
  urlArquivo,
  type ArquivoNo,
  type VisaoArquivos,
} from "@/lib/documentos/arquivos.functions";
import {
  caminhoNoBucket,
  formatarBytes,
  planejarEnvio,
  situacaoCota,
  type ResolucaoConflito,
} from "@/lib/documentos/arquivos-regras";
import { VisualizadorArquivo } from "@/components/comum/visualizador-arquivo";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { usePermissao } from "@/hooks/use-permissao";
import { NoCard, type AcoesNo, MIME_NO } from "./gerenciador/no-card";
import { TrilhaNavegacao } from "./gerenciador/trilha-navegacao";
import { MoverDialog } from "./gerenciador/mover-dialog";
import {
  ConflitoDialog,
  CotaDialog,
  LixeiraDialog,
  NovaPastaDialog,
  RenomearDialog,
} from "./gerenciador/dialogos-arquivo";
import { DetalhesSheet } from "./gerenciador/detalhes-sheet";
import { CompartilharDialog } from "./gerenciador/compartilhar-dialog";
import { LixeiraView } from "./gerenciador/lixeira-view";

export interface GerenciadorArquivosProps {
  /** Pasta inicial (id) ao montar. */
  pastaInicial?: string | null;
  /** Modo controlado: quando definido, sobrepõe o estado interno. */
  pasta?: string | null;
  onPastaChange?: (id: string | null) => void;
  /** Exibe o cabeçalho com título. Default: true. */
  mostrarCabecalho?: boolean;
  titulo?: string;
  descricao?: string;
  className?: string;
}

type Visao = VisaoArquivos | "lixeira";

const VISOES: { id: Exclude<Visao, "busca">; rotulo: string; Icone: typeof Star }[] = [
  { id: "pasta", rotulo: "Meus arquivos", Icone: FolderOpen },
  { id: "favoritos", rotulo: "Favoritos", Icone: Star },
  { id: "compartilhados", rotulo: "Compartilhados comigo", Icone: Share2 },
  { id: "recentes", rotulo: "Recentes", Icone: Clock },
  { id: "lixeira", rotulo: "Lixeira", Icone: Trash2 },
];

const CHAVE_VISTA = "agilliza.arquivos.vista";

function lerVista(): "grade" | "lista" {
  try {
    return localStorage.getItem(CHAVE_VISTA) === "lista" ? "lista" : "grade";
  } catch {
    return "grade";
  }
}

interface EnvioPendente {
  arquivos: File[];
  destino: string | null;
}

export function GerenciadorArquivos({
  pastaInicial = null,
  pasta: pastaControlada,
  onPastaChange,
  mostrarCabecalho = true,
  titulo = "Arquivos",
  descricao = "Os documentos do escritório, organizados em pastas, com versões e lixeira.",
  className,
}: GerenciadorArquivosProps) {
  // Dentro de outra tela (ex.: CRM › Documentos, num painel lateral): navegação em faixa e menos colunas.
  const embutido = !mostrarCabecalho;
  const colunas = cn("grid grid-cols-2 gap-3 sm:grid-cols-3", !embutido && "xl:grid-cols-5");
  const qc = useQueryClient();
  const enviarNaRaiz = usePermissao("documentos.arquivos", "create");
  const [pastaInterna, setPastaInterna] = useState<string | null>(pastaInicial ?? null);
  const pasta = pastaControlada !== undefined ? pastaControlada : pastaInterna;

  const [visao, setVisao] = useState<Visao>("pasta");
  const [termo, setTermo] = useState("");
  const [termoBusca, setTermoBusca] = useState("");
  const [etiqueta, setEtiqueta] = useState<string | null>(null);
  const [vista, setVistaEstado] = useState<"grade" | "lista">("grade");
  const [arrastandoArquivo, setArrastandoArquivo] = useState(false);
  const [envio, setEnvio] = useState<{ atual: number; total: number; nome: string } | null>(null);
  const [conflito, setConflito] = useState<(EnvioPendente & { nomes: string[] }) | null>(null);
  const [novaPasta, setNovaPasta] = useState(false);
  const [renomeando, setRenomeando] = useState<ArquivoNo | null>(null);
  const [movendo, setMovendo] = useState<ArquivoNo | null>(null);
  const [lixeiraDe, setLixeiraDe] = useState<ArquivoNo | null>(null);
  const [detalhes, setDetalhes] = useState<ArquivoNo | null>(null);
  const [compartilhando, setCompartilhando] = useState<ArquivoNo | null>(null);
  const [cotaAberta, setCotaAberta] = useState(false);
  const [previa, setPrevia] = useState<{ url: string; nome: string } | null>(null);
  const inputArquivos = useRef<HTMLInputElement>(null);
  const inputPasta = useRef<HTMLInputElement>(null);

  useEffect(() => setVistaEstado(lerVista()), []);
  const setVista = (v: "grade" | "lista") => {
    setVistaEstado(v);
    try {
      localStorage.setItem(CHAVE_VISTA, v);
    } catch {
      /* navegação privada: só não lembra */
    }
  };

  // Busca: espera a pessoa parar de digitar.
  useEffect(() => {
    const t = setTimeout(() => setTermoBusca(termo.trim()), 300);
    return () => clearTimeout(t);
  }, [termo]);
  const buscando = termoBusca.length >= 2 || !!etiqueta;
  const visaoEfetiva: Visao = buscando && visao !== "lixeira" ? "busca" : visao;

  const setPasta = useCallback(
    (id: string | null) => {
      setVisao("pasta");
      setTermo("");
      setEtiqueta(null);
      if (onPastaChange) onPastaChange(id);
      if (pastaControlada === undefined) setPastaInterna(id);
    },
    [onPastaChange, pastaControlada],
  );

  const fnListar = useServerFn(listarArquivos);
  const fnCaminho = useServerFn(caminhoNo);
  const fnCriarPasta = useServerFn(criarPasta);
  const fnRegistrar = useServerFn(registrarArquivo);
  const fnRenomear = useServerFn(renomearNo);
  const fnMover = useServerFn(moverNo);
  const fnLixeira = useServerFn(moverParaLixeira);
  const fnFavorito = useServerFn(alternarFavorito);
  const fnMenu = useServerFn(definirMostrarNoMenu);
  const fnUrl = useServerFn(urlArquivo);
  const fnPastas = useServerFn(listarPastas);
  const fnArmazenamento = useServerFn(lerArmazenamento);
  const fnCota = useServerFn(definirCota);

  const nos = useQuery({
    queryKey: ["arquivos", visaoEfetiva, visaoEfetiva === "pasta" ? pasta : null, termoBusca, etiqueta],
    queryFn: () =>
      fnListar({
        data: {
          visao: visaoEfetiva as VisaoArquivos,
          parent_id: pasta,
          termo: buscando ? termoBusca || null : null,
          etiqueta,
        },
      }),
    enabled: visaoEfetiva !== "lixeira",
  });
  const trilha = useQuery({
    queryKey: ["arquivos-trilha", pasta],
    queryFn: () => fnCaminho({ data: { id: pasta } }),
    enabled: !!pasta,
  });
  const armazenamento = useQuery({
    queryKey: ["arquivos-armazenamento"],
    queryFn: () => fnArmazenamento(),
    staleTime: 60_000,
  });

  // Nível da pessoa na pasta aberta (raiz: pela matriz de permissões).
  const nivelPasta = pasta ? (trilha.data?.[trilha.data.length - 1]?.nivel ?? 0) : enviarNaRaiz ? 2 : 1;
  const podeCriarAqui = visaoEfetiva === "pasta" && nivelPasta >= 2;

  const invalidar = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["arquivos"] });
    qc.invalidateQueries({ queryKey: ["arquivos-trilha"] });
    qc.invalidateQueries({ queryKey: ["arquivos-armazenamento"] });
    qc.invalidateQueries({ queryKey: ["nav-pastas-documentos"] });
  }, [qc]);

  const lista = useMemo(() => nos.data ?? [], [nos.data]);
  const pastas = lista.filter((n) => n.tipo === "pasta");
  const arquivos = lista.filter((n) => n.tipo === "arquivo");

  // ---------------------------------------------------------------------------
  // Envio
  // ---------------------------------------------------------------------------
  const executarEnvio = useCallback(
    async (files: File[], destino: string | null, resolucao: ResolucaoConflito, existentes: string[]) => {
      const prefixo = armazenamento.data?.prefixo ?? (await fnArmazenamento()).prefixo;
      if (!prefixo) {
        toast.error("Sua sessão não tem escritório. Entre de novo.");
        return;
      }
      const plano = planejarEnvio(
        files.map((f) => f.name),
        existentes,
        resolucao,
      );
      let ok = 0;
      const falhas: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const p = plano[i];
        setEnvio({ atual: i + 1, total: files.length, nome: f.name });
        if (p.pular) continue;
        try {
          const caminho = caminhoNoBucket(prefixo, p.nome, crypto.randomUUID());
          const { error } = await supabase.storage
            .from("arquivos")
            .upload(caminho, f, { contentType: f.type || undefined, upsert: false });
          if (error) throw new Error(error.message);
          await fnRegistrar({
            data: {
              parent_id: destino,
              nome: p.nome,
              storage_path: caminho,
              content_type: f.type || null,
              tamanho: f.size,
              nova_versao: p.novaVersao,
            },
          });
          ok++;
        } catch (e) {
          falhas.push(`${f.name}: ${mensagemDeErro(e, "falhou")}`);
          // Cota cheia: os próximos também vão falhar.
          if (/Armazenamento cheio/i.test(String((e as Error)?.message))) break;
        }
      }
      setEnvio(null);
      invalidar();
      if (falhas.length) {
        toast.error(`${ok} enviado(s), ${falhas.length} com falha`, { description: falhas.slice(0, 3).join("\n") });
      } else if (ok) {
        toast.success(ok === 1 ? "Arquivo enviado." : `${ok} arquivos enviados.`);
      }
    },
    [armazenamento.data?.prefixo, fnArmazenamento, fnRegistrar, invalidar],
  );

  const enviar = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      if (!podeCriarAqui) {
        toast.error("Você não pode enviar arquivos para esta pasta.");
        return;
      }
      const existentes = arquivos.map((a) => a.nome.toLowerCase());
      const repetidos = files.filter((f) => existentes.includes(f.name.trim().toLowerCase())).map((f) => f.name);
      if (repetidos.length) {
        setConflito({ arquivos: files, destino: pasta, nomes: repetidos });
        return;
      }
      void executarEnvio(files, pasta, "manter", arquivos.map((a) => a.nome));
    },
    [arquivos, executarEnvio, pasta, podeCriarAqui],
  );

  /** Envio de pasta inteira: recria a estrutura; arquivo que já existe vira versão nova. */
  const enviarPasta = useCallback(
    async (files: File[]) => {
      if (!files.length || !podeCriarAqui) return;
      const cache = new Map<string, string | null>([["", pasta]]);
      const grupos = new Map<string, File[]>();
      for (const f of files) {
        const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
        const partes = rel.split("/");
        partes.pop();
        const chave = partes.join("/");
        grupos.set(chave, [...(grupos.get(chave) ?? []), f]);
      }
      try {
        for (const [chave, grupo] of grupos) {
          let pai: string | null = pasta;
          let acc = "";
          for (const parte of chave ? chave.split("/") : []) {
            acc = acc ? `${acc}/${parte}` : parte;
            if (!cache.has(acc)) {
              const { id } = await fnCriarPasta({ data: { parent_id: pai, nome: parte } });
              cache.set(acc, id);
            }
            pai = cache.get(acc) ?? null;
          }
          const atuais = await fnListar({ data: { visao: "pasta", parent_id: pai } });
          await executarEnvio(
            grupo,
            pai,
            "versao",
            atuais.filter((a) => a.tipo === "arquivo").map((a) => a.nome),
          );
        }
      } catch (e) {
        setEnvio(null);
        toast.error(mensagemDeErro(e, "Não foi possível enviar a pasta."));
      }
    },
    [executarEnvio, fnCriarPasta, fnListar, pasta, podeCriarAqui],
  );

  // ---------------------------------------------------------------------------
  // Ações dos cartões
  // ---------------------------------------------------------------------------
  const tentar = useCallback(
    async (acao: () => Promise<unknown>, sucesso: string | null, padrao: string) => {
      try {
        await acao();
        if (sucesso) toast.success(sucesso);
        invalidar();
        return true;
      } catch (e) {
        toast.error(mensagemDeErro(e, padrao));
        return false;
      }
    },
    [invalidar],
  );

  const mover = useCallback(
    (id: string, destino: string | null) =>
      tentar(() => fnMover({ data: { id, novo_parent_id: destino } }), "Movido.", "Não foi possível mover."),
    [fnMover, tentar],
  );

  const acoes: AcoesNo = {
    onAbrir: async (no) => {
      if (no.tipo === "pasta") return setPasta(no.id);
      try {
        const r = await fnUrl({ data: { id: no.id } });
        setPrevia(r);
      } catch (e) {
        toast.error(mensagemDeErro(e, "Não foi possível abrir o arquivo."));
      }
    },
    onBaixar: async (no) => {
      try {
        const r = await fnUrl({ data: { id: no.id, download: true } });
        window.open(r.url, "_blank", "noopener");
      } catch (e) {
        toast.error(mensagemDeErro(e, "Não foi possível baixar."));
      }
    },
    onDetalhes: setDetalhes,
    onRenomear: setRenomeando,
    onMover: setMovendo,
    onLixeira: setLixeiraDe,
    onCompartilhar: setCompartilhando,
    onFavoritar: (no) =>
      void tentar(
        () => fnFavorito({ data: { id: no.id } }),
        no.favorito ? "Tirado dos favoritos." : "Adicionado aos favoritos.",
        "Não foi possível favoritar.",
      ),
    onAlternarMenu: (no) =>
      void tentar(
        () => fnMenu({ data: { id: no.id, mostrar: !no.mostrar_no_menu } }),
        no.mostrar_no_menu ? "Pasta tirada do menu lateral." : "Pasta fixada no menu lateral.",
        "Não foi possível alterar o menu.",
      ),
    onSoltarEm: (id, destino) => void mover(id, destino.id),
  };

  // ---------------------------------------------------------------------------
  // Arrastar arquivos do computador
  // ---------------------------------------------------------------------------
  const temArquivosDoSistema = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");
  function onDragOver(e: React.DragEvent) {
    if (!temArquivosDoSistema(e) || e.dataTransfer.types.includes(MIME_NO)) return;
    e.preventDefault();
    if (podeCriarAqui) setArrastandoArquivo(true);
  }
  function onDrop(e: React.DragEvent) {
    if (!temArquivosDoSistema(e)) return;
    e.preventDefault();
    setArrastandoArquivo(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) enviar(files);
  }

  const cota = armazenamento.data ? situacaoCota(armazenamento.data.usado, armazenamento.data.limite) : null;
  const tituloConteudo =
    visaoEfetiva === "busca"
      ? etiqueta
        ? `Etiqueta “${etiqueta}”`
        : `Resultados para “${termoBusca}”`
      : (VISOES.find((v) => v.id === visao)?.rotulo ?? "Arquivos");

  const painelCota = (
    <div className="rounded-xl border border-border/70 bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
        <HardDrive className="h-3.5 w-3.5 text-primary" /> Armazenamento
      </div>
      {armazenamento.isLoading ? (
        <Skeleton className="h-8 w-full" />
      ) : armazenamento.isError || !armazenamento.data || !cota ? (
        <p className="text-xs text-muted-foreground">Indisponível agora.</p>
      ) : (
        <>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={Math.round(cota.percentual)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Espaço usado"
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                cota.faixa === "cheio" ? "bg-destructive" : cota.faixa === "atencao" ? "bg-amber-500" : "bg-primary",
              )}
              style={{ width: `${Math.max(cota.percentual, 1)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {formatarBytes(armazenamento.data.usado)} de {formatarBytes(armazenamento.data.limite)}
            {armazenamento.data.na_lixeira > 0 && ` · ${formatarBytes(armazenamento.data.na_lixeira)} na lixeira`}
          </p>
          {armazenamento.data.pode_alterar && (
            <button
              type="button"
              className="mt-1 text-[11px] font-medium text-primary hover:underline"
              onClick={() => setCotaAberta(true)}
            >
              Alterar limite
            </button>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className={cn("space-y-4", className)}>
      {mostrarCabecalho && (
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{titulo}</h1>
          <p className="text-sm text-muted-foreground">{descricao}</p>
        </header>
      )}

      <input
        ref={inputArquivos}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          enviar(files);
        }}
      />
      <input
        ref={inputPasta}
        type="file"
        hidden
        // @ts-expect-error atributos não-padrão para envio de pasta
        webkitdirectory=""
        directory=""
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void enviarPasta(files);
        }}
      />

      <div className={cn("grid gap-4", !embutido && "lg:grid-cols-[13.5rem_minmax(0,1fr)]")}>
        {/* Navegação: coluna no computador, faixa rolável no celular */}
        <aside className="min-w-0 space-y-3">
          <nav data-tour="arquivos-visoes"
            aria-label="Visões dos arquivos"
            className={cn(
              "-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              !embutido && "lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0",
            )}
          >
            {VISOES.map(({ id, rotulo, Icone }) => {
              const ativo = visaoEfetiva === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setTermo("");
                    setEtiqueta(null);
                    if (id === "pasta") setPasta(null);
                    else setVisao(id);
                  }}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    ativo
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  aria-current={ativo ? "page" : undefined}
                >
                  <Icone className="h-4 w-4" />
                  <span className="whitespace-nowrap">{rotulo}</span>
                </button>
              );
            })}
          </nav>
          {!embutido && <div className="hidden lg:block">{painelCota}</div>}
        </aside>

        <section className="min-w-0 space-y-3">
          {/* Barra: trilha/título, busca, vista e ações */}
          <div data-tour="arquivos-barra" className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-2 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 px-1">
              {visaoEfetiva === "pasta" ? (
                <TrilhaNavegacao
                  trilha={trilha.data ?? []}
                  pasta={pasta}
                  onNavegar={setPasta}
                  onSoltarEm={(id, destino) => void mover(id, destino)}
                  podeSoltarNaRaiz={enviarNaRaiz}
                />
              ) : (
                <p className="truncate py-1 text-sm font-semibold">{tituloConteudo}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:w-60 sm:flex-none">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  placeholder="Buscar por nome ou etiqueta"
                  className="h-9 pl-8 pr-8"
                  aria-label="Buscar arquivos"
                />
                {(termo || etiqueta) && (
                  <button
                    type="button"
                    aria-label="Limpar busca"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
                    onClick={() => {
                      setTermo("");
                      setEtiqueta(null);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="inline-flex shrink-0 rounded-lg border border-border/70 p-0.5">
                {(["grade", "lista"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-label={v === "grade" ? "Ver em grade" : "Ver em lista"}
                    aria-pressed={vista === v}
                    onClick={() => setVista(v)}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                      vista === v ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {v === "grade" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                  </button>
                ))}
              </div>
              {podeCriarAqui && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="h-9 shrink-0" disabled={!!envio}>
                      {envio ? (
                        <Loader2 className="h-4 w-4 animate-spin sm:mr-1.5" />
                      ) : (
                        <Upload className="h-4 w-4 sm:mr-1.5" />
                      )}
                      <span className="hidden sm:inline">Novo</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setNovaPasta(true)}>
                      <FolderPlus className="mr-2 h-4 w-4" /> Nova pasta
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => inputArquivos.current?.click()}>
                      <Upload className="mr-2 h-4 w-4" /> Enviar arquivos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => inputPasta.current?.click()}>
                      <UploadCloud className="mr-2 h-4 w-4" /> Enviar pasta
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {envio && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
              <span className="min-w-0 flex-1 truncate">
                Enviando {envio.atual} de {envio.total} · {envio.nome}
              </span>
            </div>
          )}

          {visaoEfetiva === "lixeira" ? (
            <LixeiraView onRestaurado={(p) => setPasta(p)} />
          ) : (
            <div data-tour="arquivos-conteudo"
              onDragOver={onDragOver}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setArrastandoArquivo(false);
              }}
              onDrop={onDrop}
              className={cn(
                "relative min-h-[280px] rounded-xl transition-colors",
                arrastandoArquivo && "bg-primary/5 ring-2 ring-primary",
              )}
            >
              {arrastandoArquivo && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/70">
                  <div className="flex flex-col items-center gap-2 text-primary">
                    <UploadCloud className="h-8 w-8" />
                    <p className="text-sm font-semibold">Solte para enviar aqui</p>
                  </div>
                </div>
              )}

              {nos.isLoading ? (
                <div className={colunas}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-40 w-full rounded-xl" />
                  ))}
                </div>
              ) : nos.isError ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
                  <AlertTriangle className="mb-2 h-7 w-7 text-destructive" />
                  <p className="text-sm font-semibold text-destructive">
                    {mensagemDeErro(nos.error, "Não foi possível abrir esta pasta.")}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => nos.refetch()}>
                      Tentar de novo
                    </Button>
                    {pasta && (
                      <Button size="sm" variant="ghost" onClick={() => setPasta(null)}>
                        Voltar ao início
                      </Button>
                    )}
                  </div>
                </div>
              ) : lista.length === 0 ? (
                <Vazio
                  visao={visaoEfetiva}
                  podeCriar={podeCriarAqui}
                  onEnviar={() => inputArquivos.current?.click()}
                  onNovaPasta={() => setNovaPasta(true)}
                />
              ) : vista === "grade" ? (
                <div className="space-y-5">
                  {pastas.length > 0 && (
                    <Bloco titulo="Pastas" total={pastas.length}>
                      <div className={colunas}>
                        {pastas.map((n) => (
                          <NoCard key={n.id} no={n} variante="grade" acoes={acoes} mostrarCaminho={visaoEfetiva !== "pasta"} />
                        ))}
                      </div>
                    </Bloco>
                  )}
                  {arquivos.length > 0 && (
                    <Bloco titulo="Arquivos" total={arquivos.length}>
                      <div className={colunas}>
                        {arquivos.map((n) => (
                          <NoCard key={n.id} no={n} variante="grade" acoes={acoes} mostrarCaminho={visaoEfetiva !== "pasta"} />
                        ))}
                      </div>
                    </Bloco>
                  )}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
                  <div className="hidden grid-cols-[minmax(0,1fr)_7rem_9rem_2rem] gap-2 border-b border-border/70 bg-muted/40 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
                    <span className="pl-12">Nome</span>
                    <span>Tamanho</span>
                    <span>Criado por</span>
                    <span />
                  </div>
                  {[...pastas, ...arquivos].map((n) => (
                    <NoCard key={n.id} no={n} variante="lista" acoes={acoes} mostrarCaminho={visaoEfetiva !== "pasta"} />
                  ))}
                </div>
              )}

              {/* Etiquetas da tela atual: atalho para filtrar */}
              {!nos.isLoading && !etiqueta && lista.some((n) => n.etiquetas.length) && (
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Etiquetas:</span>
                  {Array.from(new Set(lista.flatMap((n) => n.etiquetas)))
                    .slice(0, 12)
                    .map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setEtiqueta(e)}
                        className="rounded-md border border-border/70 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                      >
                        {e}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          <div className={embutido ? "" : "lg:hidden"}>{painelCota}</div>
        </section>
      </div>

      <NovaPastaDialog
        open={novaPasta}
        onOpenChange={setNovaPasta}
        onCriar={async (nome) => {
          if (await tentar(() => fnCriarPasta({ data: { parent_id: pasta, nome } }), "Pasta criada.", "Não foi possível criar a pasta."))
            setNovaPasta(false);
        }}
      />
      <RenomearDialog
        no={renomeando}
        onClose={() => setRenomeando(null)}
        onConfirmar={async (nome) => {
          if (!renomeando) return;
          if (await tentar(() => fnRenomear({ data: { id: renomeando.id, nome } }), "Renomeado.", "Não foi possível renomear."))
            setRenomeando(null);
        }}
      />
      <MoverDialog
        no={movendo}
        onClose={() => setMovendo(null)}
        carregarPastas={() => fnPastas()}
        onMover={async (destino) => {
          if (!movendo) return;
          if (await mover(movendo.id, destino)) setMovendo(null);
        }}
      />
      <LixeiraDialog
        no={lixeiraDe}
        onClose={() => setLixeiraDe(null)}
        onConfirmar={async () => {
          const alvo = lixeiraDe;
          setLixeiraDe(null);
          if (!alvo) return;
          await tentar(() => fnLixeira({ data: { id: alvo.id } }), `“${alvo.nome}” foi para a lixeira.`, "Não foi possível mandar para a lixeira.");
        }}
      />
      <ConflitoDialog
        nomes={conflito?.nomes ?? null}
        onClose={() => setConflito(null)}
        onEscolher={(r) => {
          const c = conflito;
          setConflito(null);
          if (c) void executarEnvio(c.arquivos, c.destino, r, arquivos.map((a) => a.nome));
        }}
      />
      <CotaDialog
        aberto={cotaAberta}
        limiteAtual={armazenamento.data?.limite ?? 0}
        onClose={() => setCotaAberta(false)}
        onSalvar={async (gb) => {
          if (await tentar(() => fnCota({ data: { gb } }), "Limite atualizado.", "Não foi possível alterar o limite."))
            setCotaAberta(false);
        }}
      />
      <DetalhesSheet no={detalhes} onClose={() => setDetalhes(null)} />
      <CompartilharDialog no={compartilhando} onClose={() => setCompartilhando(null)} />
      <VisualizadorArquivo arquivo={previa} open={!!previa} onOpenChange={(o) => !o && setPrevia(null)} />
    </div>
  );
}

function Bloco({ titulo, total, children }: { titulo: string; total: number; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo} <span className="font-normal">· {total}</span>
      </h2>
      {children}
    </div>
  );
}

function Vazio({
  visao,
  podeCriar,
  onEnviar,
  onNovaPasta,
}: {
  visao: Visao;
  podeCriar: boolean;
  onEnviar: () => void;
  onNovaPasta: () => void;
}) {
  const textos: Record<string, [string, string]> = {
    pasta: ["Esta pasta está vazia", podeCriar ? "Arraste arquivos para cá ou use os botões abaixo." : "Ainda não há nada aqui."],
    favoritos: ["Nenhum favorito", "Marque com a estrela as pastas e arquivos que você usa sempre."],
    compartilhados: ["Nada compartilhado com você", "Pastas e arquivos restritos que alguém liberar para você aparecem aqui."],
    recentes: ["Nenhum arquivo ainda", "Os arquivos enviados ou alterados por último aparecem aqui."],
    busca: ["Nada encontrado", "Tente outro nome ou etiqueta."],
  };
  const [t, d] = textos[visao] ?? textos.pasta;
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 p-8 text-center">
      <span className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <FolderOpen className="h-6 w-6" />
      </span>
      <p className="font-semibold text-foreground">{t}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{d}</p>
      {visao === "pasta" && podeCriar && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={onEnviar}>
            <Upload className="mr-1.5 h-4 w-4" /> Enviar arquivos
          </Button>
          <Button size="sm" variant="outline" onClick={onNovaPasta}>
            <FolderPlus className="mr-1.5 h-4 w-4" /> Nova pasta
          </Button>
        </div>
      )}
    </div>
  );
}
