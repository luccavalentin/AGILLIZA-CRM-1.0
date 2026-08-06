import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  obterFuncionario,
  listarHistoricoFuncionario,
  listarDependentes,
  excluirFuncionario,
} from "@/lib/rh/funcionarios.functions";

import { FuncionarioForm, ABA_CLASS } from "@/components/rh/funcionario-form";
import {
  FichaDocumentos,
  FichaBeneficios,
  FichaFerias,
  FichaOcorrencias,
  FichaHolerites,
} from "@/components/rh/ficha-tabs";
import { FichaDependentes } from "@/components/rh/ficha-dependentes";
import { FichaPreviaFolha } from "@/components/rh/ficha-previa-folha";

import {
  FichaAdiantamentos,
  FichaDescontos,
  FichaAlteracoesSalariais,
} from "@/components/rh/ficha-financeiro";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { gerarFichaFuncionarioPdf } from "@/lib/rh/pdf-lazy";

export const Route = createFileRoute("/_authenticated/rh/funcionarios_/$id")({
  head: () => ({ meta: [{ title: "Funcionário — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.funcionarios"),
  component: Pagina,
});

function Pagina() {
  const { id } = useParams({ strict: false }) as { id: string };
  const fnObter = useServerFn(obterFuncionario);
  const fnHist = useServerFn(listarHistoricoFuncionario);
  const fnDeps = useServerFn(listarDependentes);

  const q = useQuery({
    queryKey: ["rh-funcionario", id],
    queryFn: () => fnObter({ data: { id } }),
  });

  const hist = useQuery({
    queryKey: ["rh-funcionario-historico", id],
    queryFn: () => fnHist({ data: { funcionario_id: id } }),
  });

  const navigate = useNavigate();
  const qc = useQueryClient();
  const fnExcluir = useServerFn(excluirFuncionario);
  const [confirmar, setConfirmar] = useState(false);

  const excluir = useMutation({
    mutationFn: () => fnExcluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Funcionário excluído.");
      setConfirmar(false);
      qc.invalidateQueries({ queryKey: ["rh-funcionarios"] });
      qc.invalidateQueries({ queryKey: ["rh-kpis"] });
      navigate({ to: "/rh/funcionarios" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao excluir funcionário."),
  });



  async function imprimirFicha() {
    if (!q.data) return;
    try {
      const deps = await fnDeps({ data: { funcionario_id: id } });
      const { blob, filename } = await gerarFichaFuncionarioPdf({
        funcionario: q.data,
        dependentes: deps.map((d) => ({
          nome: d.nome,
          parentesco: d.parentesco,
          cpf: d.cpf,
          data_nascimento: d.data_nascimento,
        })),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar a ficha.");
    }
  }

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

  const abasExtras = (
    <>
      <TabsTrigger value="historico" className={ABA_CLASS}>Histórico</TabsTrigger>
      <TabsTrigger value="dependentes" className={ABA_CLASS}>Dependentes</TabsTrigger>
      <TabsTrigger value="documentos" className={ABA_CLASS}>Documentos</TabsTrigger>
      <TabsTrigger value="beneficios" className={ABA_CLASS}>Benefícios</TabsTrigger>
      <TabsTrigger value="ferias" className={ABA_CLASS}>Férias</TabsTrigger>
      <TabsTrigger value="ocorrencias" className={ABA_CLASS}>Ocorrências</TabsTrigger>
      <TabsTrigger value="adiantamentos" className={ABA_CLASS}>Adiantamentos</TabsTrigger>
      <TabsTrigger value="descontos" className={ABA_CLASS}>Descontos</TabsTrigger>
      <TabsTrigger value="salarios" className={ABA_CLASS}>Alterações salariais</TabsTrigger>
      <TabsTrigger value="previa" className={ABA_CLASS}>Prévia da folha</TabsTrigger>
      <TabsTrigger value="holerites" className={ABA_CLASS}>Holerites</TabsTrigger>
    </>
  );

  const conteudoExtra = (
    <>
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
              <ul className="space-y-3 text-sm">
                {hist.data!.map((h) => (
                  <li key={h.id} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      {h.ator_nome ? ` · ${h.ator_nome}` : ""}
                    </p>
                    <p className="font-medium text-foreground">
                      {h.campo === "__criacao__" ? "Admissão registrada" : h.campo}
                    </p>
                    {h.campo !== "__criacao__" && (
                      <p className="break-words text-xs text-muted-foreground">
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
      <TabsContent value="adiantamentos" className="mt-4">
        <FichaAdiantamentos funcionarioId={id} />
      </TabsContent>
      <TabsContent value="descontos" className="mt-4">
        <FichaDescontos funcionarioId={id} />
      </TabsContent>
      <TabsContent value="salarios" className="mt-4">
        <FichaAlteracoesSalariais funcionarioId={id} />
      </TabsContent>
      <TabsContent value="previa" className="mt-4">
        <FichaPreviaFolha funcionarioId={id} />
      </TabsContent>
      <TabsContent value="holerites" className="mt-4">
        <FichaHolerites funcionarioId={id} />
      </TabsContent>
    </>
  );

  return (
    <div className="pb-10">
      <FuncionarioForm
        inicial={q.data}
        abasExtras={abasExtras}
        conteudoExtra={conteudoExtra}
        acoes={
          <>
            <Button variant="outline" onClick={imprimirFicha} className="shrink-0">
              <Printer className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Imprimir ficha (PDF)</span>
              <span className="sm:hidden">Ficha</span>
            </Button>
            <Button
              variant="outline"
              className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmar(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Excluir funcionário</span>
              <span className="sm:hidden">Excluir</span>
            </Button>
          </>
        }
      />

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funcionário</AlertDialogTitle>
            <AlertDialogDescription>
              {q.data.nome} será excluído definitivamente, junto com documentos, dependentes,
              férias, benefícios, holerites e lançamentos vinculados apenas a ele.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluir.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={excluir.isPending}
              onClick={(e) => {
                e.preventDefault();
                excluir.mutate();
              }}
            >
              {excluir.isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

