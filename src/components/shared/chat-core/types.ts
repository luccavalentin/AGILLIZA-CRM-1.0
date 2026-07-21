import type { ReactNode } from "react";
import type { ChatMensagem } from "@/lib/crm/chat-cliente.functions";
import type { ContextoResposta } from "@/lib/crm/respostas-rapidas";
import type { ChatClienteInfo } from "@/components/crm/chat-cliente/utils";

export type { ChatMensagem, ChatClienteInfo, ContextoResposta };

export type ChatSendPayload = {
  mensagem?: string;
  responde_a?: string;
  interna?: boolean;
  anexo_path?: string;
};

/**
 * Adaptador de conversa para o núcleo unificado de chat.
 *
 * O núcleo (ChatConversaCore) não conhece a origem da conversa. Cada
 * origem (cliente, demanda, DM) fornece um adaptador que sabe como:
 * carregar mensagens, enviar/editar/excluir, marcar como lida, escutar
 * o canal realtime da tabela, subir anexo e (opcionalmente) criar tarefa.
 */
export interface ChatAdapter {
  /** Identificador da conversa (usado em queryKey, som, typing). */
  conversaId: string;
  /** queryKey do React Query para a lista de mensagens desta conversa. */
  queryKey: readonly unknown[];

  /** Nome exibido para o usuário logado (usado na citação otimista). */
  meuNome: string | null;
  /** Info do "outro lado" (cliente/usuário/demanda) para o cabeçalho. */
  info?: ChatClienteInfo;
  /** clienteId para atalhos no cabeçalho (quando aplicável). */
  headerClienteId?: string;
  /** Contexto (nome, proposta, banco, etapa) usado por respostas rápidas. */
  contextoResposta: ContextoResposta;

  /** Ações extras renderizadas no cabeçalho. */
  acoes?: ReactNode;

  /** Modo somente leitura (ex.: thread de outro atendente). */
  somenteLeitura: boolean;
  /** Nome do atendente dono da thread (quando somenteLeitura). */
  atendenteNome?: string;

  /** Valor de `remetente_tipo` que representa o usuário logado. */
  mineTipo: ChatMensagem["remetente_tipo"];
  /** Nome de fallback para citação quando o peer envia a mensagem. */
  peerNomeCitacao: string;

  /** Operações de dados. */
  listar(): Promise<ChatMensagem[]>;
  responder(p: ChatSendPayload): Promise<unknown>;
  editar(p: { id: string; mensagem: string }): Promise<unknown>;
  excluir(p: { id: string }): Promise<unknown>;
  marcarLido(): Promise<unknown>;

  /** Canal Postgres Changes (tabela + filtro). */
  realtime: { channel: string; table: string; filter: string };

  /** Identificador e papel para o hook de "digitando". */
  typing: { id: string; myRole: "time" | "cliente" };

  /** Upload de anexo — retorna o path a ser passado em responder({ anexo_path }). */
  uploadAnexo(file: File): Promise<string>;

  /** Criação de tarefa a partir do chat (opcional). */
  criarTarefa?: (p: {
    titulo: string;
    prazo?: string;
    descricao?: string;
  }) => Promise<unknown>;
}
