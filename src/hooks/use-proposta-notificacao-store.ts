import { create } from "zustand";

interface PropostaNotificacao {
  id: string;
  tipo: "proposta" | "simulacao";
  numero: string;
  status: string;
  mensagem_banco?: string | null;
  nome_cliente: string;
  banco: string;
  dados_adicionais?: any;
}

interface PropostaNotificacaoStore {
  abertas: PropostaNotificacao[];
  adicionar: (notif: PropostaNotificacao) => void;
  remover: (id: string) => void;
}

/**
 * Store global para gerenciar popups de retorno de propostas.
 * Usado para exibir o aviso personalizado no meio da tela quando uma
 * proposta ou simulação recebe atualização do banco.
 */
export const usePropostaNotificacaoStore = create<PropostaNotificacaoStore>((set) => ({
  abertas: [],
  adicionar: (notif: PropostaNotificacao) =>
    set((state: PropostaNotificacaoStore) => ({
      // Evita duplicados para a mesma proposta no mesmo ciclo
      abertas: state.abertas.find((n: PropostaNotificacao) => n.id === notif.id)
        ? state.abertas
        : [...state.abertas, notif],
    })),
  remover: (id: string) =>
    set((state: PropostaNotificacaoStore) => ({
      abertas: state.abertas.filter((n: PropostaNotificacao) => n.id !== id),
    })),
}));
