import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { criarProposta } from "@/lib/propostas/propostas.functions";
import { perguntarAgenciaSeBradesco } from "@/components/proposta/dialogs/agencia-bradesco-dialog";
import {
  recusaRecenteAntesDoEnvio,
  textoRecusaRecente,
} from "@/lib/propostas/aviso-envio.functions";

/** Pergunta no próprio aviso (sem diálogo novo na raiz): enviar mesmo assim ou não. */
function confirmarNoAviso(texto: string): Promise<boolean> {
  return new Promise((resolver) => {
    let respondeu = false;
    const responder = (v: boolean) => {
      if (respondeu) return;
      respondeu = true;
      resolver(v);
    };
    toast.warning(texto, {
      duration: Infinity,
      action: { label: "Enviar mesmo assim", onClick: () => responder(true) },
      cancel: { label: "Não enviar", onClick: () => responder(false) },
      onDismiss: () => responder(false),
      onAutoClose: () => responder(false),
    });
  });
}

export interface PedidoEnvioAprovacao {
  simulacaoId: string;
  /** Linha do banco na simulação (cotação escolhida). */
  simulacaoBancoId: string;
  bancoId?: string;
  nomeBanco?: string | null;
  /** Chamado depois da pergunta da agência (Bradesco), quando o envio começa de fato. */
  aoIniciar?: () => void;
  /** Logo depois de criada a proposta, antes do cadastro/envio (ex.: completar o imóvel). */
  aposCriar?: (propostaId: string) => Promise<void>;
}

/**
 * "Enviar Aprovação" do Agilliza — o fluxo de sempre, num lugar só: agência do Bradesco,
 * criação da proposta a partir da cotação, cadastro do participante quando falta algo e o
 * envio ao banco. Serve o comparativo da simulação e a fila dos assinantes.
 * Erros na criação sobem para quem chamou; erro no envio vira aviso e a proposta abre.
 */
export function useEnviarAprovacao() {
  const router = useRouter();
  return useCallback(
    async (p: PedidoEnvioAprovacao): Promise<"cancelado" | "cadastro" | "enviada"> => {
      // Mesmo CPF recusado há pouco neste banco: avisa antes (a checagem nunca trava o envio).
      const recusa = await recusaRecenteAntesDoEnvio({
        data: { simulacaoBancoId: p.simulacaoBancoId },
      }).catch(() => null);
      if (recusa && !(await confirmarNoAviso(textoRecusaRecente(recusa)))) return "cancelado";
      // Bradesco: o popup de agência abre já no clique, antes de criar a proposta.
      const resposta = await perguntarAgenciaSeBradesco(p.nomeBanco ?? undefined);
      if (resposta.cancelado) return "cancelado";
      const agencia = resposta.agencia;
      p.aoIniciar?.();
      const { proposta_id, envolvido_pendente_id } = await criarProposta({
        data: { simulacao_id: p.simulacaoId, simulacao_banco_id: p.simulacaoBancoId },
      });
      if (p.aposCriar) await p.aposCriar(proposta_id);

      // A proposta exige campos que a simulação não pede (nome da mãe, sexo,
      // documento de identidade, endereço completo...). Quando falta algum,
      // abrimos o formulário DIRETO — nada de disparar um envio que já
      // sabemos que o banco vai recusar. O próprio diálogo encadeia os demais
      // participantes e envia ao final, pelo botão "Salvar e enviar ao banco".
      if (envolvido_pendente_id) {
        toast.info("Complete o cadastro do participante para enviar ao banco.");
        router.navigate({
          to: "/operacional/propostas/$id",
          params: { id: proposta_id },
          search: {
            abrir_cadastro: envolvido_pendente_id,
            ...(agencia !== undefined ? { agencia: agencia || "nao" } : {}),
          },
        });
        return "cadastro";
      }

      // Cadastro completo: abre a proposta e o envio começa lá (`complementar=1`), com o
      // painel de andamento do Agilliza (etapa, quanto falta, há quanto tempo). Enviar
      // aqui deixava só o botão girando por até dois minutos (pedido do dono, 21/10/2026).
      router.navigate({
        to: "/operacional/propostas/$id",
        params: { id: proposta_id },
        search: {
          complementar: 1,
          ...(agencia !== undefined ? { agencia: agencia || "nao" } : {}),
        },
      });
      return "enviada";
    },
    [router],
  );
}
