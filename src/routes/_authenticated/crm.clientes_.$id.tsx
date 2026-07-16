import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineTimeline } from "@/components/crm/pipeline-timeline";
import { ClienteForm } from "@/components/crm/cliente-form";
import { DocumentosTab } from "@/components/crm/documentos-tab";
import { InteracoesTab } from "@/components/crm/interacoes-tab";
import { AtividadesClienteTab } from "@/components/crm/atividades-cliente-tab";
import { VinculoTab } from "@/components/crm/vinculo-tab";
import { ChatClienteInstagram } from "@/components/crm/chat-cliente-instagram";
import { SimulacaoPreviewDialog } from "@/components/simulacao/simulacao-preview-dialog";
import { VendedoresTab } from "@/components/crm/vendedores-tab";
import { ImovelTab, IqTab } from "@/components/crm/imovel-iq-tab";

import { assertModuloPermitido } from "@/lib/route-guards";
import {
  getCliente,
  getPipelineStages,
  getClientePipeline,
  getEndereco,
  listarHistorico,
  getClienteNegocios,
  definirEtapa,
} from "@/lib/crm/clientes.functions";
import { formatarDocumento, formatarCelular } from "@/lib/crm/documento";
import { usePipelineRealtime } from "@/hooks/use-pipeline-realtime";

import { ClienteHeader } from "@/components/crm/cliente-detalhe/header";
import { TabsNav } from "@/components/crm/cliente-detalhe/tabs-nav";
import { ResumoTab } from "@/components/crm/cliente-detalhe/resumo-tab";
import { NegociosTab } from "@/components/crm/cliente-detalhe/negocios-tab";
import { HistoricoTab } from "@/components/crm/cliente-detalhe/historico-tab";
import { clienteParaFormInicial } from "@/components/crm/cliente-detalhe/form-mapper";

export const Route = createFileRoute("/_authenticated/crm/clientes_/$id")({
  head: () => ({ meta: [{ title: "Cliente — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-destructive">Erro ao carregar o cliente.</div>
  ),
  notFoundComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Cliente não encontrado.</div>
  ),
});

function Pagina() {
  usePipelineRealtime();
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getCli = useServerFn(getCliente);
  const getStages = useServerFn(getPipelineStages);
  const getPipe = useServerFn(getClientePipeline);
  const getEnd = useServerFn(getEndereco);
  const getHist = useServerFn(listarHistorico);
  const getNeg = useServerFn(getClienteNegocios);
  const setEtapa = useServerFn(definirEtapa);
  const [movendoEtapa, setMovendoEtapa] = useState(false);
  const [aba, setAba] = useState("resumo");
  const [previewSimId, setPreviewSimId] = useState<string | null>(null);

  async function moverParaEtapa(codigo: string) {
    setMovendoEtapa(true);
    try {
      await setEtapa({ data: { cliente_id: id, codigo_destino: codigo } });
      await qc.invalidateQueries({ queryKey: ["cliente-pipeline", id] });
      await qc.invalidateQueries({ queryKey: ["cliente-hist", id] });
      toast.success("Etapa atualizada.");
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível mover a etapa.");
    } finally {
      setMovendoEtapa(false);
    }
  }

  const { data: det, isLoading } = useQuery({
    queryKey: ["cliente", id],
    queryFn: () => getCli({ data: { id } }),
  });
  const { data: stages } = useQuery({ queryKey: ["pipeline-stages"], queryFn: () => getStages() });
  const { data: pipe } = useQuery({
    queryKey: ["cliente-pipeline", id],
    queryFn: () => getPipe({ data: { cliente_id: id } }),
  });
  const { data: endereco } = useQuery({
    queryKey: ["cliente-end", id],
    queryFn: () => getEnd({ data: { cliente_id: id } }),
  });
  const { data: historico } = useQuery({
    queryKey: ["cliente-hist", id],
    queryFn: () => getHist({ data: { cliente_id: id } }),
  });
  const { data: negocios } = useQuery({
    queryKey: ["cliente-negocios", id],
    queryFn: () => getNeg({ data: { cliente_id: id } }),
  });

  if (isLoading || !det) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const c = det.cliente;
  const docExib = det.podePii ? formatarDocumento(c.documento) : c.documento;
  const celularExib = det.podePii ? formatarCelular((c as any).telefone_celular) : null;
  const etapaNome = pipe ? (stages?.find((s: any) => s.codigo === pipe.codigo)?.nome ?? "—") : "—";

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0">
          <Link to="/crm/clientes">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">Voltar aos clientes</span>
      </div>

      <ClienteHeader cliente={c} docExib={docExib} celularExib={celularExib} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Esteira</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stages && pipe ? (
            <>
              <PipelineTimeline
                stages={stages}
                atualOrdem={pipe.ordem}
                onSelecionar={moverParaEtapa}
                disabled={movendoEtapa}
              />
              <p className="text-xs text-muted-foreground">
                Clique em qualquer etapa para mover o cliente na esteira.
              </p>
            </>
          ) : (
            <Skeleton className="h-8 w-full" />
          )}
        </CardContent>
      </Card>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsNav aba={aba} setAba={setAba} />

        <TabsContent value="resumo" className="mt-4">
          <ResumoTab
            cliente={c}
            docExib={docExib}
            responsavelNome={det.responsavel_nome}
            etapaNome={etapaNome}
          />
        </TabsContent>

        <TabsContent value="vinculo" className="mt-4">
          <VinculoTab clienteId={id} responsavelNome={det.responsavel_nome} />
        </TabsContent>

        <TabsContent value="dados" className="mt-4">
          <ClienteForm
            portalAtivo={c.portal_acesso_ativo}
            enderecoInicial={endereco as any}
            inicial={clienteParaFormInicial(c)}
          />
        </TabsContent>

        <TabsContent value="vendedores" className="mt-4">
          <VendedoresTab clienteId={id} />
        </TabsContent>

        <TabsContent value="imovel" className="mt-4">
          <ImovelTab clienteId={id} cliente={c} />
        </TabsContent>

        <TabsContent value="iq" className="mt-4">
          <IqTab clienteId={id} cliente={c} />
        </TabsContent>

        <TabsContent value="documentos" className="mt-4">
          <DocumentosTab clienteId={id} />
        </TabsContent>

        <TabsContent value="negocios" className="mt-4">
          <NegociosTab negocios={negocios} onAbrirSimulacao={setPreviewSimId} />
        </TabsContent>

        <TabsContent value="mensagens" className="mt-4">
          <div className="h-[68dvh] max-h-[680px] min-h-[420px]">
            <ChatClienteInstagram
              clienteId={id}
              info={{
                nome: c.nome,
                documento: docExib,
                email: c.email,
                celular: c.telefone_celular ? formatarCelular(c.telefone_celular) : null,
                contexto: (() => {
                  const nSim = negocios?.simulacoes.length ?? 0;
                  const nProp = negocios?.propostas.length ?? 0;
                  const partes: string[] = [];
                  if (nProp > 0) partes.push(`${nProp} proposta${nProp > 1 ? "s" : ""}`);
                  if (nSim > 0) partes.push(`${nSim} simulação${nSim > 1 ? "ões" : ""}`);
                  return partes.join(" · ") || null;
                })(),
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="atividades" className="mt-4">
          <AtividadesClienteTab clienteId={id} />
        </TabsContent>

        <TabsContent value="interacoes" className="mt-4">
          <InteracoesTab clienteId={id} />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <HistoricoTab historico={historico} />
        </TabsContent>
      </Tabs>

      <SimulacaoPreviewDialog
        simulacaoId={previewSimId}
        open={!!previewSimId}
        onOpenChange={(o) => !o && setPreviewSimId(null)}
      />
    </div>
  );
}
