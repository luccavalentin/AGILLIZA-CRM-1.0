import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Loader2, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { listarInteracoes } from "@/lib/crm/clientes.functions";
import { formatarData } from "./painel-utils";

export function AbaInteracoes({ clienteId }: { clienteId: string }) {
  const fn = useServerFn(listarInteracoes);
  const { data, isLoading } = useQuery({
    queryKey: ["chat-painel-interacoes", clienteId],
    queryFn: () => fn({ data: { cliente_id: clienteId } }),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const lista = (data ?? []) as Array<{
    id: string;
    canal: string | null;
    resultado: string | null;
    observacao: string | null;
    ocorrido_em: string | null;
    responsavel?: { nome: string | null } | null;
  }>;
  if (lista.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <MessageCircle className="size-6 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">Nenhuma interação registrada ainda.</p>
        <Link
          to="/crm/clientes/$id"
          params={{ id: clienteId }}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ExternalLink className="size-3.5" /> Registrar na ficha
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {lista.map((i) => (
        <div key={i.id} className="rounded-xl border border-border/60 bg-background p-3 shadow-sm">
          <div className="mb-1 flex items-center justify-between gap-2">
            <Badge
              variant="secondary"
              className="rounded-full border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
            >
              {i.canal ?? "interação"}
            </Badge>
            <span className="text-[10px] text-muted-foreground">{formatarData(i.ocorrido_em)}</span>
          </div>
          {i.resultado && <p className="text-sm font-medium text-foreground">{i.resultado}</p>}
          {i.observacao && (
            <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">{i.observacao}</p>
          )}
          {i.responsavel?.nome && (
            <p className="mt-1 text-[10px] text-muted-foreground">por {i.responsavel.nome}</p>
          )}
        </div>
      ))}
    </div>
  );
}
