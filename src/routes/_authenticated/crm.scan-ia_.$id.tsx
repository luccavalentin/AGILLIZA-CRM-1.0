import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Save, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { assertModuloPermitido } from "@/lib/route-guards";
import { obterLeitura, salvarCampos } from "@/lib/crm/scan-ia.functions";

export const Route = createFileRoute("/_authenticated/crm/scan-ia_/$id")({
  head: () => ({ meta: [{ title: "Revisar leitura — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.scan_ia"),
  component: Pagina,
});

function confiancaClasse(c: number | null): { box: string; label: string } {
  const v = c ?? 0;
  if (v >= 0.9) return { box: "bg-success/10 border-success/30", label: "Alta" };
  if (v >= 0.6) return { box: "bg-warning/10 border-warning/30", label: "Média" };
  return { box: "bg-destructive/10 border-destructive/30", label: "Revisar" };
}

function Pagina() {
  const { id } = useParams({ from: "/_authenticated/crm/scan-ia_/$id" });
  const qc = useQueryClient();
  const [valores, setValores] = useState<Record<string, string>>({});

  const leitura = useQuery({
    queryKey: ["scan-ia-leitura", id],
    queryFn: () => obterLeitura({ data: { id } }),
  });

  useEffect(() => {
    if (leitura.data) {
      const inicial: Record<string, string> = {};
      for (const c of leitura.data.campos) inicial[c.id] = c.valor ?? "";
      setValores(inicial);
    }
  }, [leitura.data]);

  const salvar = useMutation({
    mutationFn: () =>
      salvarCampos({
        data: {
          leitura_id: id,
          campos: Object.entries(valores).map(([cid, valor]) => ({ id: cid, valor })),
        },
      }),
    onSuccess: () => {
      toast.success("Campos salvos.");
      qc.invalidateQueries({ queryKey: ["scan-ia-leitura", id] });
      qc.invalidateQueries({ queryKey: ["scan-ia-leituras"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/crm/scan-ia">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>

      {leitura.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : leitura.isError || !leitura.data ? (
        <p className="text-sm text-destructive">Não foi possível carregar a leitura.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">
                  {leitura.data.tipo_documento ?? "Documento"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Enviado por {leitura.data.criador_nome ?? "—"} ·{" "}
                  {new Date(leitura.data.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <Badge variant="outline">{leitura.data.status}</Badge>
            </div>
            <div className="overflow-hidden rounded-lg border border-border bg-muted">
              {leitura.data.arquivo_assinado ? (
                <iframe
                  title="Documento"
                  src={leitura.data.arquivo_assinado}
                  className="h-[600px] w-full"
                />
              ) : (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  <FileText className="h-8 w-8" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Campos extraídos</h2>
              <Button
                size="sm"
                disabled={salvar.isPending || leitura.data.campos.length === 0}
                onClick={() => salvar.mutate()}
              >
                <Save className="mr-2 h-4 w-4" /> Salvar
              </Button>
            </div>

            {leitura.data.campos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {leitura.data.status === "erro"
                  ? (leitura.data.erro ?? "Erro no processamento.")
                  : "Nenhum campo extraído. Reprocesse o documento na listagem."}
              </p>
            ) : (
              <div className="space-y-3">
                {leitura.data.campos.map((campo) => {
                  const tone = confiancaClasse(campo.confianca);
                  return (
                    <div key={campo.id} className={`rounded-lg border p-3 ${tone.box}`}>
                      <div className="mb-1 flex items-center justify-between">
                        <Label htmlFor={campo.id} className="text-xs uppercase tracking-wide">
                          {campo.campo.replace(/_/g, " ")}
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          {tone.label} · {Math.round((campo.confianca ?? 0) * 100)}%
                        </span>
                      </div>
                      <Input
                        id={campo.id}
                        value={valores[campo.id] ?? ""}
                        onChange={(e) => setValores((v) => ({ ...v, [campo.id]: e.target.value }))}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
