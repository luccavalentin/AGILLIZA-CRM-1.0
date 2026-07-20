import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  obterFuncionario,
  listarHistoricoFuncionario,
  listarDependentes,
} from "@/lib/rh/funcionarios.functions";
import { FuncionarioForm } from "@/components/rh/funcionario-form";
import {
  FichaDocumentos,
  FichaBeneficios,
  FichaFerias,
  FichaOcorrencias,
  FichaHolerites,
} from "@/components/rh/ficha-tabs";
import { FichaDependentes } from "@/components/rh/ficha-dependentes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { gerarFichaFuncionarioPdf } from "@/lib/rh/ficha-pdf";

export const Route = createFileRoute("/_authenticated/rh/funcionarios_/$id")({
  head: () => ({ meta: [{ title: "Funcionário — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.funcionarios"),
  component: Pagina,
});

function Pagina() {
  const { id } = useParams({ strict: false }) as { id: string };
  const fnObter = useServerFn(obterFuncionario);
  const fnHist = useServerFn(listarHistoricoFuncionario);

  const q = useQuery({
    queryKey: ["rh-funcionario", id],
    queryFn: () => fnObter({ data: { id } }),
  });

  const hist = useQuery({
    queryKey: ["rh-funcionario-historico", id],
    queryFn: () => fnHist({ data: { funcionario_id: id } }),
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }
  if (!q.data) {
    return <div className="p-6 text-sm text-muted-foreground">Funcionário não encontrado.</div>;
  }

  return (
    <div className="space-y-4">
      <FuncionarioForm inicial={q.data} />

      <div className="mx-auto w-full max-w-[1400px] px-3 pb-8 sm:px-4 md:px-6">
        <Tabs defaultValue="historico">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="dependentes">Dependentes</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="beneficios">Benefícios</TabsTrigger>
            <TabsTrigger value="ferias">Férias</TabsTrigger>
            <TabsTrigger value="ocorrencias">Ocorrências</TabsTrigger>
            <TabsTrigger value="holerites">Holerites</TabsTrigger>
          </TabsList>

          <TabsContent value="historico" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de alterações</CardTitle>
              </CardHeader>
              <CardContent>
                {hist.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : (hist.data?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {hist.data!.map((h) => (
                      <li key={h.id} className="border-l-2 border-border pl-3">
                        <p className="text-xs text-muted-foreground">
                          {new Date(h.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                          {h.ator_nome ? ` · ${h.ator_nome}` : ""}
                        </p>
                        <p className="font-medium text-foreground">
                          {h.campo === "__criacao__" ? "Admissão registrada" : h.campo}
                        </p>
                        {h.campo !== "__criacao__" && (
                          <p className="text-xs text-muted-foreground">
                            <span className="line-through">{h.valor_anterior ?? "—"}</span>
                            {" → "}
                            <span className="text-foreground">{h.valor_novo ?? "—"}</span>
                          </p>
                        )}
                        {h.motivo && <p className="text-xs italic text-muted-foreground">{h.motivo}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dependentes" className="mt-4">
            <FichaDependentes funcionarioId={id} />
          </TabsContent>
          <TabsContent value="documentos" className="mt-4">
            <FichaDocumentos funcionarioId={id} />
          </TabsContent>
          <TabsContent value="beneficios" className="mt-4">
            <FichaBeneficios funcionarioId={id} />
          </TabsContent>
          <TabsContent value="ferias" className="mt-4">
            <FichaFerias funcionarioId={id} />
          </TabsContent>
          <TabsContent value="ocorrencias" className="mt-4">
            <FichaOcorrencias funcionarioId={id} />
          </TabsContent>
          <TabsContent value="holerites" className="mt-4">
            <FichaHolerites funcionarioId={id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
