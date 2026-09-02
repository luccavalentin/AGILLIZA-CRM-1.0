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
import { criarProposta } from "@/lib/propostas/propostas.functions";
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
      const simFinal = ["simulada", "parcialmente_simulada", "erro_banco", "expirada", "cancelada"].includes(d.simulacao?.status);
      const bancosPendentes = (d.bancos ?? []).some(
        (b: any) => !["simulada", "erro", "expirada"].includes(b.status_banco),
      );
      // Se algum banco ainda não terminou, mantemos o polling ativo
      return !simFinal || bancosPendentes ? 3000 : false;
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
      if (bancosSelecionados.length > 0) {
        // Paralelo — mesmo padrão do envio inicial (envio.ts). Uma falha
        // isolada não bloqueia os demais bancos.
        const resultados = await Promise.allSettled(
          bancosSelecionados.map((bancoId: string) =>
            enviarSimulacaoBanco({ data: { simulacao_id: id, banco_ids: [bancoId] } }),
          ),
        );
        const falhas = resultados.filter((r) => r.status === "rejected");
        if (falhas.length === 0) toast.success("Reenviado ao banco.");
        else if (falhas.length < resultados.length)
          toast.warning(
            `Reenviado parcialmente (${falhas.length} de ${resultados.length} falharam).`,
          );
        else toast.error("Falha ao reenviar aos bancos.");
      } else {
        await enviarSimulacaoBanco({ data: { simulacao_id: id } });
        toast.success("Reenviado ao banco.");
      }
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
        if (bancosSelecionados.length > 0) {
          const resultados = await Promise.allSettled(
            bancosSelecionados.map((bancoId: string) =>
              enviarSimulacaoBanco({ data: { simulacao_id: id, banco_ids: [bancoId] } }),
            ),
          );
          const falhas = resultados.filter((r) => r.status === "rejected").length;
          if (falhas === 0) toast.success("Titular invertido e simulação reenviada aos bancos.");
          else if (falhas < resultados.length)
            toast.warning(
              `Titular invertido. Reenvio parcial (${falhas} de ${resultados.length} falharam).`,
            );
          else toast.error("Titular invertido, mas o reenvio aos bancos falhou.");
        } else {
          await enviarSimulacaoBanco({ data: { simulacao_id: id } });
          toast.success("Titular invertido e simulação reenviada ao banco.");
        }
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
    // IDs, número, operação bancária, e-mail verificado, PDFs ou bancos já
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

  async function criar(simulacaoBancoId: string, bancoId?: string) {
    setCriandoBanco(simulacaoBancoId);
    try {
      const { proposta_id } = await criarProposta({
        data: { simulacao_id: id, simulacao_banco_id: simulacaoBancoId },
      });
      // O envio ao banco passa obrigatoriamente pelo gate único
      // (useEnviarProposta). Ele é disparado UMA vez, pela própria ficha da
      // proposta, ao receber `complementar: 1` — chamar o gate aqui também
      // fazia a mesma proposta ser enviada duas vezes ao banco.
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
