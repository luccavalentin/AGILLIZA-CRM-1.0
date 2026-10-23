import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMinhasPermissoes } from "@/lib/permissions.functions";

/**
 * Valor que só muda depois de a pessoa parar de digitar. Cada busca abre uma transação na
 * plataforma: sem isso, "imobiliaria" disparava onze consultas seguidas.
 */
export function useValorAssentado<T>(valor: T, ms = 350): T {
  const [assentado, setAssentado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAssentado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return assentado;
}

/**
 * Administrador, correspondente ou gestor do Agilliza: os únicos que o banco trata como
 * administrador da plataforma (chaves dos provedores, exclusão definitiva da LGPD).
 * Mesma matriz já em cache pelo menu (`["minhas-permissoes"]`).
 */
export function useAdministradorDaPlataforma(): boolean {
  const { data } = useQuery({
    queryKey: ["minhas-permissoes"],
    queryFn: () => getMinhasPermissoes(),
    staleTime: 5 * 60_000,
  });
  return !!data?.todas;
}

/**
 * Rodapé de paginação das listas da plataforma (a página vem pronta do servidor).
 * Com `total`, mostra "x–y de N"; sem ele (listas grandes demais para contar), usa `temMais`.
 */
export function RodapePaginas({
  pagina,
  porPagina,
  quantidade,
  total,
  temMais,
  carregando,
  onPagina,
}: {
  pagina: number;
  porPagina: number;
  /** Itens desta página. */
  quantidade: number;
  total?: number;
  temMais?: boolean;
  carregando?: boolean;
  onPagina: (p: number) => void;
}) {
  const paginas = total != null ? Math.max(1, Math.ceil(total / porPagina)) : null;
  const haProxima = paginas != null ? pagina < paginas : !!temMais;
  if (pagina <= 1 && !haProxima) {
    return total != null && total > 0 ? (
      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        {total} {total === 1 ? "item" : "itens"}
      </p>
    ) : null;
  }
  const inicio = (pagina - 1) * porPagina + 1;
  const fim = (pagina - 1) * porPagina + quantidade;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
      <p className="text-xs tabular-nums text-muted-foreground">
        {quantidade > 0 ? `${inicio}–${fim}` : "0"}
        {total != null ? ` de ${total}` : ""}
        {paginas != null ? ` · página ${pagina} de ${paginas}` : ` · página ${pagina}`}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="min-h-11 sm:min-h-8"
          disabled={pagina <= 1 || carregando}
          onClick={() => onPagina(pagina - 1)}
        >
          <ChevronLeft className="mr-1 size-4" /> Anterior
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="min-h-11 sm:min-h-8"
          disabled={!haProxima || carregando}
          onClick={() => onPagina(pagina + 1)}
        >
          Próxima <ChevronRight className="ml-1 size-4" />
        </Button>
      </div>
    </div>
  );
}
