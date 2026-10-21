import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { mensagemDeErro } from "@/lib/erros/mensagem";

interface ConsultaLista {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

/**
 * Conteúdo de lista vazia: carregando, erro (com "Tentar de novo") ou vazio.
 * Falha de consulta não pode aparecer como "Nenhum …".
 */
export function EstadoLista({
  q,
  vazio,
  erro = "Não foi possível carregar a lista.",
  className = "py-10",
}: {
  q: ConsultaLista;
  vazio: string;
  erro?: string;
  className?: string;
}) {
  if (q.isLoading) {
    return (
      <div className={`${className} text-center text-sm text-muted-foreground`}>Carregando…</div>
    );
  }
  if (q.isError) {
    return (
      <div
        className={`${className} flex flex-col items-center gap-2 text-center text-sm text-destructive`}
      >
        {mensagemDeErro(q.error, erro)}
        <Button type="button" size="sm" variant="outline" onClick={() => q.refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }
  return <div className={`${className} text-center text-sm text-muted-foreground`}>{vazio}</div>;
}

/** Mesma coisa, como linha de tabela. */
export function LinhaEstadoLista({
  colSpan,
  ...props
}: { colSpan: number } & Parameters<typeof EstadoLista>[0]) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="p-0">
        <EstadoLista {...props} />
      </TableCell>
    </TableRow>
  );
}
