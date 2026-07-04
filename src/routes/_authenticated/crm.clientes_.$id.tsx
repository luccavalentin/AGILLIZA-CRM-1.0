import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineTimeline } from "@/components/crm/pipeline-timeline";
import { ClienteForm } from "@/components/crm/cliente-form";
import { DocumentosTab } from "@/components/crm/documentos-tab";
import { InteracoesTab } from "@/components/crm/interacoes-tab";
import { VinculoTab } from "@/components/crm/vinculo-tab";
import { StatusBadge } from "@/components/crm/tone-badge";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  getCliente,
  getPipelineStages,
  getClientePipeline,
  getEndereco,
  listarHistorico,
} from "@/lib/crm/clientes.functions";
import { formatarDocumento, mascararDocumento, formatarCelular } from "@/lib/crm/documento";

export const Route = createFileRoute("/_authenticated/crm/clientes_/$id")({
  head: () => ({ meta: [{ title: "Cliente — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
  errorComponent: () => <div className="p-6 text-sm text-destructive">Erro ao carregar o cliente.</div>,
  notFoundComponent: () => <div className="p-6 text-sm text-muted-foreground">Cliente não encontrado.</div>,
});

function Pagina() {
  const { id } = Route.useParams();
  const getCli = useServerFn(getCliente);
  const getStages = useServerFn(getPipelineStages);
  const getPipe = useServerFn(getClientePipeline);
  const getEnd = useServerFn(getEndereco);
  const getHist = useServerFn(listarHistorico);

  const { data: det, isLoading } = useQuery({
    queryKey: ["cliente", id],
    queryFn: () => getCli({ data: { id } }),
  });
  const { data: stages } = useQuery({ queryKey: ["pipeline-stages"], queryFn: () => getStages() });
  const { data: pipe } = useQuery({ queryKey: ["cliente-pipeline", id], queryFn: () => getPipe({ data: { cliente_id: id } }) });
  const { data: endereco } = useQuery({ queryKey: ["cliente-end", id], queryFn: () => getEnd({ data: { cliente_id: id } }) });
  const { data: historico } = useQuery({ queryKey: ["cliente-hist", id], queryFn: () => getHist({ data: { cliente_id: id } }) });

  if (isLoading || !det) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const c = det.cliente;
  const docExib = det.podePii ? formatarDocumento(c.documento) : mascararDocumento(c.documento);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/crm/clientes"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{c.nome}</h1>
            <p className="font-mono text-xs text-muted-foreground">{c.numero_cliente} · {docExib}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={c.portal_acesso_ativo ? "ativo" : "inativo"} />
          <Button asChild variant="default">
            <Link to="/operacional/simulacoes/nova">
              <Calculator className="size-4" /> Nova simulação personalizada
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Esteira</CardTitle></CardHeader>
        <CardContent>
          {stages && pipe ? (
            <PipelineTimeline stages={stages} atualOrdem={pipe.ordem} />
          ) : (
            <Skeleton className="h-8 w-full" />
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="resumo">
        <TabsList className="flex-wrap">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="vinculo">Vínculo de atendimento</TabsTrigger>
          <TabsTrigger value="interacoes">Interações</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Dados pessoais</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Linha rotulo="Documento" valor={docExib} />
              <Linha rotulo="E-mail" valor={c.email ?? "—"} />
              <Linha rotulo="Celular" valor={c.telefone_celular ? formatarCelular(c.telefone_celular) : "—"} />
              <Linha rotulo="Nascimento" valor={c.data_nascimento ? new Date(c.data_nascimento).toLocaleDateString("pt-BR") : "—"} />
              <Linha rotulo="Renda declarada" valor={c.renda_total_declarada != null ? `R$ ${Number(c.renda_total_declarada).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"} />
              <Linha rotulo="UF de interesse" valor={c.uf_interesse ?? "—"} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Atendimento</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Linha rotulo="Responsável" valor={det.responsavel_nome ?? "—"} />
              <Linha rotulo="Etapa atual" valor={pipe ? stages?.find((s: any) => s.ordem === pipe.ordem)?.nome ?? "—" : "—"} />
              <Linha rotulo="Origem" valor={c.origem} />
              <Linha rotulo="Cadastrado em" valor={new Date(c.created_at).toLocaleDateString("pt-BR")} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dados" className="mt-4">
          <ClienteForm
            portalAtivo={c.portal_acesso_ativo}
            enderecoInicial={endereco as any}
            inicial={{
              id: c.id,
              tipo_pessoa: c.tipo_pessoa,
              nome: c.nome,
              documento: c.documento,
              documento_secundario: c.documento_secundario ?? "",
              data_nascimento: c.data_nascimento ?? "",
              estado_civil: c.estado_civil ?? "solteiro",
              regime_casamento: c.regime_casamento ?? "",
              mae: c.mae ?? "",
              email: c.email ?? "",
              telefone_celular: c.telefone_celular ?? "",
              renda_total_declarada: c.renda_total_declarada != null ? String(c.renda_total_declarada) : "",
              uf_interesse: c.uf_interesse ?? "",
              origem: c.origem,
            }}
          />
        </TabsContent>

        <TabsContent value="documentos" className="mt-4">
          <DocumentosTab clienteId={id} />
        </TabsContent>

        <TabsContent value="interacoes" className="mt-4">
          <InteracoesTab clienteId={id} />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          {(historico?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem eventos.</p>
          ) : (
            <div className="space-y-2">
              {historico!.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm">
                  <span className="text-foreground">{h.descricao}</span>
                  <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1 last:border-0">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="text-right font-medium text-foreground">{valor}</span>
    </div>
  );
}
