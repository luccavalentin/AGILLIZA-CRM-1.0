import {
  Download,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  History,
  Info,
  Lock,
  MoreVertical,
  Move,
  Pencil,
  Share2,
  Star,
  Tag,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { urlArquivo, type ArquivoNo } from "@/lib/documentos/arquivos.functions";
import { formatarBytes, tipoDePrevia } from "@/lib/documentos/arquivos-regras";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { estiloArquivo } from "./arquivo-utils";

/** Tipo arrastado entre cartões (mover para pasta). */
export const MIME_NO = "application/x-agilliza-arquivo";

export interface AcoesNo {
  onAbrir: (no: ArquivoNo) => void;
  onBaixar: (no: ArquivoNo) => void;
  onDetalhes: (no: ArquivoNo) => void;
  onRenomear: (no: ArquivoNo) => void;
  onMover: (no: ArquivoNo) => void;
  onLixeira: (no: ArquivoNo) => void;
  onFavoritar: (no: ArquivoNo) => void;
  onCompartilhar: (no: ArquivoNo) => void;
  onAlternarMenu: (no: ArquivoNo) => void;
  /** Soltar um item (id) sobre esta pasta. */
  onSoltarEm: (idArrastado: string, pasta: ArquivoNo) => void;
}

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/** Miniatura da imagem (link assinado curto, só quando o cartão aparece). */
function useMiniatura(no: ArquivoNo, ativo: boolean) {
  const fnUrl = useServerFn(urlArquivo);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!ativo || no.tipo !== "arquivo" || tipoDePrevia(no.nome, no.content_type) !== "imagem") return;
    let vivo = true;
    fnUrl({ data: { id: no.id } })
      .then((r) => vivo && setUrl(r.url))
      .catch(() => {});
    return () => {
      vivo = false;
    };
    // versao_atual: a miniatura acompanha a versão nova
  }, [ativo, no.id, no.nome, no.content_type, no.tipo, no.versao_atual, fnUrl]);
  return url;
}

export function NoCard({
  no,
  variante,
  acoes,
  mostrarCaminho,
}: {
  no: ArquivoNo;
  variante: "grade" | "lista";
  acoes: AcoesNo;
  mostrarCaminho?: boolean;
}) {
  const [alvo, setAlvo] = useState(false);
  const miniatura = useMiniatura(no, variante === "grade");
  const estilo = no.tipo === "arquivo" ? estiloArquivo(no.content_type, no.nome) : null;
  const Icone = estilo?.Icon ?? Folder;
  const podeEditar = no.nivel >= 2;
  const podeGerir = no.nivel >= 3;

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Ações de ${no.nome}`}
          className="h-8 w-8 shrink-0 text-muted-foreground sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-visible:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => acoes.onAbrir(no)}>
          {no.tipo === "pasta" ? (
            <FolderOpen className="mr-2 h-4 w-4" />
          ) : (
            <Eye className="mr-2 h-4 w-4" />
          )}
          {no.tipo === "pasta" ? "Abrir" : "Pré-visualizar"}
        </DropdownMenuItem>
        {no.tipo === "arquivo" && (
          <DropdownMenuItem onClick={() => acoes.onBaixar(no)}>
            <Download className="mr-2 h-4 w-4" /> Baixar
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => acoes.onFavoritar(no)}>
          <Star className={cn("mr-2 h-4 w-4", no.favorito && "fill-amber-400 text-amber-500")} />
          {no.favorito ? "Tirar dos favoritos" : "Favoritar"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => acoes.onDetalhes(no)}>
          {no.tipo === "arquivo" ? (
            <History className="mr-2 h-4 w-4" />
          ) : (
            <Info className="mr-2 h-4 w-4" />
          )}
          {no.tipo === "arquivo" ? "Detalhes, etiquetas e versões" : "Detalhes e etiquetas"}
        </DropdownMenuItem>
        {podeEditar && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => acoes.onRenomear(no)}>
              <Pencil className="mr-2 h-4 w-4" /> Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => acoes.onMover(no)}>
              <Move className="mr-2 h-4 w-4" /> Mover para…
            </DropdownMenuItem>
            {no.tipo === "pasta" && !no.parent_id && (
              <DropdownMenuItem onClick={() => acoes.onAlternarMenu(no)}>
                {no.mostrar_no_menu ? (
                  <EyeOff className="mr-2 h-4 w-4" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                {no.mostrar_no_menu ? "Tirar do menu lateral" : "Fixar no menu lateral"}
              </DropdownMenuItem>
            )}
          </>
        )}
        {podeGerir && (
          <>
            <DropdownMenuItem onClick={() => acoes.onCompartilhar(no)}>
              <Share2 className="mr-2 h-4 w-4" /> Compartilhar e permissões
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => acoes.onLixeira(no)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Mover para a lixeira
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Arrastar e soltar entre cartões: item editável arrasta; pasta editável recebe.
  const arrastavel = podeEditar;
  const recebe = no.tipo === "pasta" && podeEditar;
  const dnd = {
    draggable: arrastavel,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(MIME_NO, no.id);
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: React.DragEvent) => {
      if (!recebe || !e.dataTransfer.types.includes(MIME_NO)) return;
      e.preventDefault();
      e.stopPropagation();
      setAlvo(true);
    },
    onDragLeave: () => setAlvo(false),
    onDrop: (e: React.DragEvent) => {
      if (!recebe) return;
      const id = e.dataTransfer.getData(MIME_NO);
      setAlvo(false);
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      if (id !== no.id) acoes.onSoltarEm(id, no);
    },
  };

  const selos = (
    <span className="flex shrink-0 items-center gap-1">
      {no.restrita && (
        <span title="Acesso restrito" className="text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
        </span>
      )}
      {no.favorito && (
        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-label="Favorito" />
      )}
      {no.tipo === "arquivo" && no.versao_atual > 1 && (
        <span className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary">
          v{no.versao_atual}
        </span>
      )}
    </span>
  );

  const meta =
    no.tipo === "pasta"
      ? `${no.itens ?? 0} ${no.itens === 1 ? "item" : "itens"}`
      : `${formatarBytes(no.tamanho)} · ${dataCurta(no.updated_at ?? no.created_at)}`;

  const etiquetas = no.etiquetas.length > 0 && (
    <span className="flex min-w-0 flex-wrap gap-1">
      {no.etiquetas.slice(0, 3).map((e) => (
        <span
          key={e}
          className="inline-flex max-w-[8rem] items-center gap-0.5 truncate rounded-md bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground"
        >
          <Tag className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{e}</span>
        </span>
      ))}
      {no.etiquetas.length > 3 && (
        <span className="text-[10px] text-muted-foreground">+{no.etiquetas.length - 3}</span>
      )}
    </span>
  );

  if (variante === "lista") {
    return (
      <div
        {...dnd}
        className={cn(
          "group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border/60 px-2 py-1.5 transition-colors last:border-b-0 hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_7rem_9rem_auto]",
          alvo && "bg-primary/10 ring-1 ring-inset ring-primary",
        )}
      >
        <button
          type="button"
          className="flex min-w-0 items-center gap-3 rounded-md py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => acoes.onAbrir(no)}
        >
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              no.tipo === "pasta" ? "bg-primary/10 text-primary" : cn("bg-gradient-to-br", estilo!.classe),
            )}
          >
            <Icone className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-medium text-foreground">{no.nome}</span>
              {selos}
            </span>
            <span className="block truncate text-xs text-muted-foreground sm:hidden">{meta}</span>
            {mostrarCaminho && no.caminho && (
              <span className="block truncate text-[11px] text-muted-foreground">em {no.caminho}</span>
            )}
          </span>
        </button>
        <span className="hidden truncate text-xs text-muted-foreground sm:block">
          {no.tipo === "pasta" ? meta : formatarBytes(no.tamanho)}
        </span>
        <span className="hidden truncate text-xs text-muted-foreground sm:block">
          {no.criado_por_nome ?? "—"}
        </span>
        {menu}
      </div>
    );
  }

  return (
    <div
      {...dnd}
      className={cn(
        "group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card transition-all hover:border-primary/40 hover:shadow-md",
        alvo && "border-primary bg-primary/5 ring-2 ring-primary/30",
      )}
    >
      <button
        type="button"
        onClick={() => acoes.onAbrir(no)}
        className="relative flex h-24 items-center justify-center bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:h-28"
        aria-label={`Abrir ${no.nome}`}
      >
        {miniatura ? (
          <img
            src={miniatura}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span
            className={cn(
              "flex size-12 items-center justify-center rounded-2xl",
              no.tipo === "pasta" ? "bg-primary/10 text-primary" : cn("bg-gradient-to-br", estilo!.classe),
            )}
          >
            <Icone className="h-6 w-6" />
          </span>
        )}
        <span className="absolute right-2 top-2">{selos}</span>
      </button>
      <div className="flex min-w-0 items-start gap-1 p-2.5 pr-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-foreground" title={no.nome}>
            {no.nome}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{meta}</p>
          {mostrarCaminho && no.caminho && (
            <p className="truncate text-[11px] text-muted-foreground">em {no.caminho}</p>
          )}
          {etiquetas && <div className="mt-1.5">{etiquetas}</div>}
        </div>
        {menu}
      </div>
    </div>
  );
}
