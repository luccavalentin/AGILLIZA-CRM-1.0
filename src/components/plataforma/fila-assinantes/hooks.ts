import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { usePermissao } from "@/hooks/use-permissao";
import { useEnviarAprovacao } from "@/hooks/use-enviar-aprovacao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  completarImovelDaProposta,
  listarFilaAssinantes,
  prepararEnvioNoAgilliza,
} from "@/lib/plataforma/fila.functions";

/** O mínimo de uma proposta da fila que as ações precisam (linha da fila ou detalhe). */
export interface PropostaParaAcao {
  id: string;
  codigo: string;
  conta: string;
  status: string;
  pendente: boolean;
  minha: boolean;
  analista: string | null;
  banco?: string | null;
  /** Proposta já criada no Agilliza a partir desta (enviada pelo fluxo de sempre). */
  proposta_agilliza_id?: string | null;
}

/** Situações em que a proposta ainda espera o envio ao banco. */
export const AGUARDANDO_ENVIO = ["aguardando_correspondente", "erro_envio"];

/** Recarrega toda lista que mostra propostas de assinantes. */
export function invalidarFila(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["plataforma-fila"] });
  qc.invalidateQueries({ queryKey: ["conta-operacoes"] });
  qc.invalidateQueries({ queryKey: ["proposta-assinante"] });
}

type Acao = "enviar" | "nova" | "editar";

/**
 * Ações da proposta do assinante no fluxo do Agilliza. O cliente e a simulação do Agilliza
 * (com as MESMAS cotações do assinante) são garantidos por baixo, sem botão próprio, no
 * momento da ação (`prepararEnvioNoAgilliza`, idempotente). Assume a proposta se pendente.
 */
export function useAcoesAssinante(p: PropostaParaAcao) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const prepararFn = useServerFn(prepararEnvioNoAgilliza);
  const imovelFn = useServerFn(completarImovelDaProposta);
  const enviarAprovacao = useEnviarAprovacao();
  const [executando, setExecutando] = useState<Acao | null>(null);

  async function executar(acao: Acao) {
    setExecutando(acao);
    try {
      const prep = await prepararFn({ data: { id: p.id, assumir: p.pendente } });
      invalidarFila(qc);
      if (acao === "nova") {
        // Simulação completa preenchida com os dados do assinante: ajustar valores ou
        // bancos e cotar de novo. A proposta que sair dela volta ao assinante (0179).
        navigate({
          to: "/operacional/simulacoes/completa",
          search: { duplicar: prep.simulacao_id },
        });
        return;
      }
      if (acao === "editar") {
        navigate({ to: "/crm/clientes/$id", params: { id: prep.cliente_id } });
        return;
      }
      if (!prep.simulacao_banco_id || !prep.banco_cotado) {
        toast.warning(
          `A cotação do ${prep.nome_banco ?? p.banco ?? "banco escolhido"} não está pronta para envio. Use "Gerar nova simulação" para cotar de novo.`,
          { duration: 10_000 },
        );
        return;
      }
      // Como no Agilliza: sem o endereço do imóvel o banco recusa. Pede antes de enviar.
      const falta = prep.pendencias_imovel ?? [];
      if (falta.length > 0) {
        toast.warning(
          `Antes de enviar, complete o endereço do imóvel no cadastro do cliente: ${falta.join(", ")}.`,
          { duration: 12_000 },
        );
        navigate({ to: "/crm/clientes/$id", params: { id: prep.cliente_id } });
        return;
      }
      await enviarAprovacao({
        simulacaoId: prep.simulacao_id,
        simulacaoBancoId: prep.simulacao_banco_id,
        bancoId: prep.banco_id ?? undefined,
        nomeBanco: prep.nome_banco,
        // Mesma estrutura do fluxo nativo: imóvel e vistoria na proposta e na oportunidade.
        aposCriar: async (propostaId) => {
          const r = await imovelFn({ data: { propostaId } });
          if (r.erro)
            throw new Error(`Dados do imóvel não foram aceitos pela integração: ${r.erro}`);
        },
      });
      invalidarFila(qc);
    } catch (e) {
      // Pode ter assumido e falhado depois: a lista mostra o estado real.
      invalidarFila(qc);
      toast.error(
        mensagemDeErro(
          e,
          acao === "enviar"
            ? "Não foi possível enviar para aprovação."
            : "Não foi possível abrir esta proposta no Agilliza.",
        ),
        { duration: 10_000 },
      );
    } finally {
      setExecutando(null);
    }
  }

  return {
    enviarParaAprovacao: () => executar("enviar"),
    gerarNovaSimulacao: () => executar("nova"),
    editarDados: () => executar("editar"),
    acompanhar: () =>
      p.proposta_agilliza_id &&
      navigate({
        to: "/operacional/propostas/$id",
        params: { id: p.proposta_agilliza_id },
        search: {},
      }),
    executando,
  };
}

/** Quantas propostas esperam um analista (contador da aba "Dos assinantes"). */
export function usePendentesDaFila() {
  const pode = usePermissao("saas.fila", "view");
  const listarFn = useServerFn(listarFilaAssinantes);
  const q = useQuery({
    // Mesma chave da primeira página da aba "Pendentes": abrir a aba reaproveita a consulta.
    queryKey: ["plataforma-fila", "pendentes", "todas", "todos", "", 1],
    queryFn: () => listarFn({ data: { aceite: "pendentes", pagina: 1 } }),
    enabled: pode,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  return pode ? (q.data?.fila.pendentes ?? null) : null;
}
