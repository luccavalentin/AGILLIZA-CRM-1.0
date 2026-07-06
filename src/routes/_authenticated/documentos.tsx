import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FolderOpen, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/crm/tone-badge";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarDocumentosCentral } from "@/lib/documentos.functions";

export const Route = createFileRoute("/_authenticated/documentos")({
  head: () => ({ meta: [{ title: "Documentos — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("documentos.arquivos"),
  component: Pagina,
});

function Pagina() {
  const listar = useServerFn(listarDocumentosCentral);
  const { data, isLoading } = useQuery({
    queryKey: ["documentos-central"],
    queryFn: () => listar(),
  });
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter(
      (d) =>
        (d.cliente_nome ?? "").toLowerCase().includes(q) ||
        (d.nome_arquivo ?? "").toLowerCase().includes(q) ||
        (d.tipo_documento ?? "").toLowerCase().includes(q),
    );
  }, [data, busca]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Documentos</h1>
          <p className="text-sm text-muted-foreground">Arquivos e documentação dos processos.</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente, arquivo ou tipo…"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum documento encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtrados.map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-4 text-sm"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">
                  {d.nome_arquivo ?? d.tipo_documento ?? "Documento"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {d.tipo_documento ?? "—"}
                  {d.cliente_nome ? ` · ${d.cliente_nome}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {d.status && <StatusBadge status={d.status} />}
                {d.cliente_id && (
                  <Link
                    to="/crm/clientes/$id"
                    params={{ id: d.cliente_id }}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Ver cliente
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
