import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import { supabase } from "@/integrations/supabase/client";
import {
  obterSimulacao,
  enviarSimulacaoBanco,
  excluirSimulacao,
  inverterTitularSimulacao,
} from "@/lib/simulacao/simulacoes.functions";
import { criarProposta, enviarPropostaHomeFin } from "@/lib/propostas/propostas.functions";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HistoricoTimeline } from "@/components/simulacao/detalhe-page/historico-timeline";
import { HeaderAcoes } from "@/components/simulacao/detalhe-page/header-acoes";
import { ComparativoBancos } from "@/components/simulacao/detalhe-page/comparativo-bancos";
import { DadosEnviados } from "@/components/simulacao/detalhe-page/dados-enviados";

export const Route = createFileRoute("/_authenticated/operacional/simulacoes_/$id")({
  head: () => ({ meta: [{ title: "Simulação — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.simulacoes"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Simulação não encontrada.</div>
  ),
});

function Pagina() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [pdfDialogAberto, setPdfDialogAberto] = useState(false);
  const [detalhePdfAberto, setDetalhePdfAberto] = useState(false);
  const [reenviandoBanco, setReenviandoBanco] = useState<string | null>(null);
  const [invertendo, setInvertendo] = useState(false);
  const [criandoBanco, setCriandoBanco] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["simulacao", id],
    queryFn: () => obterSimulacao({ data: { id } }),
    // Enquanto a simulação/algum banco ainda está processando, faz polling
    // para garantir que os retornos apareçam mesmo se o realtime falhar.
    refetchInterval: (query) => {
      const d = query.state.data as any;
      if (!d) return 3000;
      const simProcessando = ["enviando", "rascunho"].includes(d.simulacao?.status);
      const bancoProcessando = (d.bancos ?? []).some(
        (b: any) => b.status_banco === "aguardando" || b.status_banco === "enviando",
      );
      return simProcessando || bancoProcessando ? 6000 : false;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`sim-bancos:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "simulacao_bancos",
          filter: `simulacao_id=eq.${id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["simulacao", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  async function reenviar() {
    try {
      const bancosSelecionados = (data?.bancos ?? [])
        .filter((b: any) => b.selecionado !== false)
        .map((b: any) => b.banco_id)
        .filter(Boolean);
      await enviarSimulacaoBanco({
        data: bancosSelecionados.length === 1
          ? { simulacao_id: id, banco_ids: [bancosSelecionados[0]] }
          : { simulacao_id: id },
      });
      toast.success("Reenviado ao banco.");
      qc.invalidateQueries({ queryKey: ["simulacao", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reenviar.");
    }
  }

  async function reenviarBanco(bancoId: string) {
    setReenviandoBanco(bancoId);
    try {
      await enviarSimulacaoBanco({ data: { simulacao_id: id, banco_ids: [bancoId] } });
      toast.success("Banco reenviado.");
      qc.invalidateQueries({ queryKey: ["simulacao", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reenviar.");
    } finally {
      setReenviandoBanco(null);
    }
  }

  async function inverterTitular(reenviarBancos: boolean) {
    setInvertendo(true);
    try {
      await inverterTitularSimulacao({ data: { id } });
      if (reenviarBancos) {
        const bancosSelecionados = (data?.bancos ?? [])
          .filter((b: any) => b.selecionado !== false)
          .map((b: any) => b.banco_id)
          .filter(Boolean);
        await enviarSimulacaoBanco({
          data: bancosSelecionados.length === 1
            ? { simulacao_id: id, banco_ids: [bancosSelecionados[0]] }
            : { simulacao_id: id },
        });
        toast.success("Titular invertido e simulação reenviada aos bancos.");
      } else {
        toast.success("Titular e cônjuge invertidos.");
      }
      qc.invalidateQueries({ queryKey: ["simulacao", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao inverter titular.");
    } finally {
      setInvertendo(false);
    }
  }

  function duplicar() {
    router.navigate({
      to: "/operacional/simulacoes/completa",
      search: { duplicar: id },
    });
  }

  function editar() {
    // "Editar" gera uma NOVA simulação a partir dos dados desta, sem herdar
    // IDs, número, operação HomeFin, e-mail verificado, PDFs ou bancos já
    // simulados. Usa o mesmo fluxo de "Duplicar" (mapeamento explícito de
    // campos no wizard) para garantir isolamento total da simulação anterior.
    router.navigate({
      to: "/operacional/simulacoes/completa",
      search: { duplicar: id },
    });
  }

  async function excluir() {
    try {
      await excluirSimulacao({ data: { id } });
      toast.success("Simulação excluída.");
      qc.invalidateQueries({ queryKey: ["simulacoes"] });
      qc.invalidateQueries({ queryKey: ["crm-painel"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      router.navigate({ to: "/operacional/simulacoes" });
    } catch {
      toast.error("Não foi possível excluir a simulação.");
    }
  }

  async function criar(bancoId: string) {
    setCriandoBanco(bancoId);
    try {
      const { proposta_id } = await criarProposta({
        data: { simulacao_id: id, banco_id: bancoId },
      });
      // Envia a proposta direto ao banco no mesmo clique.
      try {
        await enviarPropostaHomeFin({
          data: { proposta_id, banco_id: bancoId },
        });
        toast.success("Proposta enviada ao banco.");
      } catch (envioErr) {
        // Proposta criada, mas faltam dados para o envio — leva o usuário
        // à ficha para completar e reenviar.
        toast.warning(
          envioErr instanceof Error
            ? `Proposta criada. Complete os dados para enviar: ${envioErr.message}`
            : "Proposta criada. Complete os dados para enviar ao banco.",
        );
      }
      router.navigate({
        to: "/operacional/propostas/$id",
        params: { id: proposta_id },
        search: { complementar: 1 },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar proposta.");
    } finally {
      setCriandoBanco(null);
    }
  }

  if (isLoading || !data)
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  const s = data.simulacao;
  const bancos = data.bancos;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 md:p-6">
      <HeaderAcoes
        s={s}
        bancos={bancos}
        pdfDialogAberto={pdfDialogAberto}
        setPdfDialogAberto={setPdfDialogAberto}
        detalhePdfAberto={detalhePdfAberto}
        setDetalhePdfAberto={setDetalhePdfAberto}
        invertendo={invertendo}
        onVoltar={() => router.navigate({ to: "/operacional/simulacoes" })}
        onReenviar={reenviar}
        onDuplicar={duplicar}
        onEditar={editar}
        onInverterTitular={inverterTitular}
        onExcluir={excluir}
      />

      {s.ultimo_erro && (
        <Card className="border-destructive/30 bg-card p-4">
          <p className="text-sm text-destructive">{s.ultimo_erro}</p>
        </Card>
      )}

      <Tabs defaultValue="bancos">
        <div className="overflow-x-auto">
          <TabsList className="w-max">
            <TabsTrigger value="bancos" className="shrink-0">
              Comparativo
            </TabsTrigger>
            <TabsTrigger value="dados" className="shrink-0">
              Dados enviados
            </TabsTrigger>
            <TabsTrigger value="historico" className="shrink-0">
              Histórico
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="bancos" className="mt-4">
          <ComparativoBancos
            s={s}
            bancos={bancos}
            reenviandoBanco={reenviandoBanco}
            criandoBanco={criandoBanco}
            onEditar={editar}
            onReenviarBanco={reenviarBanco}
            onCriar={criar}
          />
        </TabsContent>

        <TabsContent value="dados" className="mt-4">
          <DadosEnviados s={s} />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <HistoricoTimeline historico={data.historico} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
