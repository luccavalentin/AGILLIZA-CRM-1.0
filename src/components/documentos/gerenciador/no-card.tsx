import {
  Download,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  MoreVertical,
  Move,
  Pencil,
  Trash2,
  User,
  ExternalLink,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { urlArquivo } from "@/lib/documentos/arquivos.functions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ArquivoNo } from "@/lib/documentos/arquivos.functions";
import { estiloArquivo, formatBytes } from "./arquivo-utils";

export interface NoCardProps {
  no: ArquivoNo;
  variante?: "grade" | "lista";
  onAbrir: (no: ArquivoNo) => void;
  onRenomear: (no: ArquivoNo) => void;
  onMover: (no: ArquivoNo) => void;
  onExcluir: (no: ArquivoNo) => void;
  onAlternarMenu?: (no: ArquivoNo) => void;
}

/** Card de um único nó (pasta ou arquivo) com o menu de ações. */
export function NoCard({
  no,
  variante = "grade",
  onAbrir,
  onRenomear,
  onMover,
  onExcluir,
  onAlternarMenu,
}: NoCardProps) {
  const fnUrl = useServerFn(urlArquivo);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);

  const arq = no.tipo === "arquivo" ? estiloArquivo(no.content_type, no.nome) : null;
  const isImage = no.tipo === "arquivo" && (no.content_type?.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(no.nome.split(".").pop()?.toLowerCase() ?? ""));

  useEffect(() => {
    if (isImage && !previewUrl && !carregandoPreview) {
      setCarregandoPreview(true);
      fnUrl({ data: { id: no.id } })
        .then((res) => setPreviewUrl(res.url))
        .catch(() => {})
        .finally(() => setCarregandoPreview(false));
    }
  }, [isImage, no.id, previewUrl, carregandoPreview, fnUrl]);
  const Icon = arq?.Icon;
  const podeAlternarMenu = no.tipo === "pasta" && no.parent_id === null && !!onAlternarMenu;

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {no.tipo === "pasta" ? (
          <DropdownMenuItem onClick={() => onAbrir(no)}>
            <FolderOpen className="mr-2 h-4 w-4" /> Abrir
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onAbrir(no)}>
            <Download className="mr-2 h-4 w-4" /> Abrir / baixar
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onRenomear(no)}>
          <Pencil className="mr-2 h-4 w-4" /> Renomear
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onMover(no)}>
          <Move className="mr-2 h-4 w-4" /> Mover
        </DropdownMenuItem>
        {podeAlternarMenu ? (
          <DropdownMenuItem onClick={() => onAlternarMenu!(no)}>
            {no.mostrar_no_menu ? (
              <>
                <EyeOff className="mr-2 h-4 w-4" /> Ocultar do menu lateral
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" /> Mostrar no menu lateral
              </>
            )}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onExcluir(no)}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const icone = (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br shadow-inner ring-1 ring-inset ring-border/40 transition-transform group-hover:scale-[1.02]",
        variante === "lista" ? "size-10" : "size-16 sm:size-20",
        no.tipo === "pasta" ? "from-primary/20 to-primary/5 text-primary" : arq!.classe,
      )}
    >
      {no.tipo === "pasta" ? (
        <Folder className={variante === "lista" ? "h-5 w-5" : "h-7 w-7 sm:h-8 sm:w-8"} />
      ) : isImage && previewUrl ? (
        <img src={previewUrl} alt={no.nome} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        Icon && <Icon className={variante === "lista" ? "h-5 w-5" : "h-7 w-7 sm:h-8 sm:w-8"} />
      )}
      
      {no.tipo === "arquivo" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
           <ExternalLink className="h-5 w-5 text-white" />
        </div>
      )}
    </div>
  );

  const meta =
    no.tipo === "pasta"
      ? "Pasta"
      : `${formatBytes(no.tamanho)} · ${new Date(no.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;

  const autor = no.criado_por_nome ? (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <User className="h-3 w-3 shrink-0" />
      <span className="truncate">{no.criado_por_nome}</span>
    </span>
  ) : null;

  if (variante === "lista") {
    return (
      <div className="group relative flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-2.5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
        <button
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onDoubleClick={() => onAbrir(no)}
          onClick={() => no.tipo === "pasta" && onAbrir(no)}
        >
          {icone}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">{no.nome}</span>
            <span className="block truncate text-xs text-muted-foreground">{meta}</span>
          </span>
          <span className="hidden shrink-0 sm:block">{autor}</span>
        </button>
        {menu}
      </div>
    );
  }

  return (
    <div className={cn(
      "group relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl",
      no.tipo === "pasta" ? "bg-gradient-to-b from-card to-primary/5" : ""
    )}>
      <div className="flex items-start justify-between">
        <button
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onDoubleClick={() => onAbrir(no)}
          onClick={() => onAbrir(no)}
        >
          {icone}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-tight text-foreground">{no.nome}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80">{meta}</p>
          </div>
        </button>
        <div className="ml-1">{menu}</div>
      </div>
      
      <div className="flex items-center justify-between border-t border-border/40 pt-2">
        {autor}
        {no.tipo === "arquivo" && (
           <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 px-2 text-[10px] font-bold text-primary hover:bg-primary/10"
            onClick={() => onAbrir(no)}
           >
             VISUALIZAR
           </Button>
        )}
      </div>
    </div>
  );
}
