import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { listarDocumentos, urlDocumento } from "@/lib/crm/clientes.functions";
import { formatarData, formatarTamanho } from "./painel-utils";

export function AbaArquivos({ clienteId }: { clienteId: string }) {
  const fn = useServerFn(listarDocumentos);
  const urlFn = useServerFn(urlDocumento);
  const { data, isLoading } = useQuery({
    queryKey: ["chat-painel-arquivos", clienteId],
    queryFn: () => fn({ data: { cliente_id: clienteId } }),
    staleTime: 30_000,
  });

  async function abrir(storagePath: string) {
    try {
      const r = await urlFn({ data: { storage_path: storagePath } });
      if (r?.url) window.open(r.url, "_blank", "noopener");
    } catch {
      /* ignore */
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const lista = (data ?? []) as Array<{
    id: string;
    nome_arquivo: string;
    tipo_documento: string | null;
    categoria: string | null;
    status: string | null;
    tamanho_bytes: number | null;
    storage_path: string;
    created_at: string | null;
    enviado_por_nome?: string | null;
  }>;
  if (lista.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <FileText className="size-6 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">Nenhum arquivo enviado ainda.</p>
        <Link
          to="/crm/clientes/$id"
          params={{ id: clienteId }}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ExternalLink className="size-3.5" /> Enviar na ficha
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {lista.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => abrir(a.storage_path)}
          className="flex w-full items-start gap-3 rounded-xl border border-border/60 bg-background p-3 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{a.nome_arquivo}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
              {a.tipo_documento && <span>{a.tipo_documento}</span>}
              {a.categoria && <span>· {a.categoria}</span>}
              <span>· {formatarTamanho(a.tamanho_bytes)}</span>
              <span>· {formatarData(a.created_at)}</span>
            </div>
            {a.enviado_por_nome && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">por {a.enviado_por_nome}</p>
            )}
          </div>
          {a.status && (
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                a.status === "aprovado"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : a.status === "reprovado"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-border bg-muted text-muted-foreground",
              )}
            >
              {a.status}
            </Badge>
          )}
        </button>
      ))}
    </div>
  );
}
