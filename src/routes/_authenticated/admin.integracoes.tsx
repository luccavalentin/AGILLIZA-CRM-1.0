import { AdminHero } from "@/components/admin/admin-hero";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plug, Landmark, Activity, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarBancosCredenciais,
  listarApiIntegracoes,
  listarHealthChecks,
  testarConectividade,
  sincronizarDominios,
} from "@/lib/admin/integracoes.functions";

export const Route = createFileRoute("/_authenticated/admin/integracoes")({
  head: () => ({ meta: [{ title: "Integrações — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.integracoes"),
  component: Pagina,
});

function StatusBadge({ ativo }: { ativo: boolean }) {
  return <Badge variant={ativo ? "default" : "secondary"}>{ativo ? "Ativo" : "Inativo"}</Badge>;
}

function Pagina() {
  const qc = useQueryClient();
  const bancos = useQuery({
    queryKey: ["admin-banco-cred"],
    queryFn: () => listarBancosCredenciais(),
  });
  const apis = useQuery({
    queryKey: ["admin-api-integr"],
    queryFn: () => listarApiIntegracoes(),
  });
  const health = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => listarHealthChecks(),
  });

  const testar = useMutation({
    mutationFn: (v: { integracao: string; base_url: string }) => testarConectividade({ data: v }),
    onSuccess: (r) => {
      toast[r.sucesso ? "success" : "error"](
        `${r.integracao}: ${r.detalhe ?? ""} (${r.latencia_ms ?? "?"}ms)`,
      );
      qc.invalidateQueries({ queryKey: ["admin-health"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha no teste."),
  });

  const sincronizar = useMutation({
    mutationFn: () => sincronizarDominios(),
    onSuccess: (r) => {
      toast.success(`Domínios sincronizados: ${r.bancos} banco(s) e ${r.operacoes} operação(ões).`);
      qc.invalidateQueries({ queryKey: ["admin-banco-cred"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao sincronizar domínios."),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        icon={<Plug className="h-5 w-5" />}
        titulo="Integrações"
        descricao="Credenciais bancárias, APIs e monitor de conectividade."
        acoes={
          <Button
            variant="outline"
            size="sm"
            disabled={sincronizar.isPending}
            onClick={() => sincronizar.mutate()}
          >
            <RefreshCw className={`mr-2 size-4 ${sincronizar.isPending ? "animate-spin" : ""}`} />
            Sincronizar domínios
          </Button>
        }
      />


      <Tabs defaultValue="bancos">
        <TabsList>
          <TabsTrigger value="bancos">
            <Landmark className="mr-2 size-4" /> Bancos
          </TabsTrigger>
          <TabsTrigger value="apis">
            <Plug className="mr-2 size-4" /> APIs
          </TabsTrigger>
          <TabsTrigger value="health">
            <Activity className="mr-2 size-4" /> Conectividade
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bancos" className="mt-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Banco</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Base URL</TableHead>
                  <TableHead>Secrets</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {bancos.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ) : (bancos.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      Nenhuma credencial bancária cadastrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  (bancos.data ?? []).map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium text-foreground">
                        {b.banco_nome ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{b.ambiente}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">
                        {b.base_url ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <code className="text-xs">
                          {[b.client_id_secret_name, b.client_secret_name]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </code>
                      </TableCell>
                      <TableCell>
                        <StatusBadge ativo={b.ativo} />
                      </TableCell>
                      <TableCell className="text-right">
                        {b.base_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={testar.isPending}
                            onClick={() =>
                              testar.mutate({
                                integracao: b.banco_nome ?? "Banco",
                                base_url: b.base_url!,
                              })
                            }
                          >
                            <RefreshCw className="mr-1 size-4" /> Testar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="apis" className="mt-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Base URL</TableHead>
                  <TableHead>Secrets</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {apis.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ) : (apis.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      Nenhuma integração de API cadastrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  (apis.data ?? []).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-foreground">{a.nome}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <code className="text-xs">{a.chave}</code>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">
                        {a.base_url ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <code className="text-xs">{a.secret_names.join(", ") || "—"}</code>
                      </TableCell>
                      <TableCell>
                        <StatusBadge ativo={a.ativo} />
                      </TableCell>
                      <TableCell className="text-right">
                        {a.base_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={testar.isPending}
                            onClick={() =>
                              testar.mutate({ integracao: a.nome, base_url: a.base_url! })
                            }
                          >
                            <RefreshCw className="mr-1 size-4" /> Testar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="health" className="mt-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Integração</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Latência</TableHead>
                  <TableHead>Detalhe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {health.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ) : (health.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      Nenhuma verificação registrada ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  (health.data ?? []).map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                        {new Date(h.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{h.integracao}</TableCell>
                      <TableCell>
                        <Badge variant={h.sucesso ? "default" : "destructive"}>
                          {h.sucesso ? "OK" : "Falha"}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {h.latencia_ms != null ? `${h.latencia_ms} ms` : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{h.detalhe ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
