/**
 * Mensagem do fio usado pela conversa das demandas (chat-core). O chat com o cliente e as
 * conversas internas antigas saíram (pedido de 26/10/2026, C14): viraram o chat universal.
 */
import type { ReacaoAgrupada } from "@/lib/chat-core/reacoes.functions";

export interface ChatMensagem {
  id: string;
  remetente_tipo: string;
  remetente_id: string | null;
  remetente_nome: string | null;
  mensagem: string;
  anexo_url: string | null;
  anexo_nome: string | null;
  anexo_is_imagem: boolean;
  lida_em: string | null;
  criada_em: string;
  editada_em: string | null;
  excluida_em: string | null;
  responde_a: string | null;
  /** Nota interna do time (o cliente não vê). */
  interna: boolean;
  /** Prévia da mensagem citada (quando responde_a aponta para outra mensagem). */
  citacao: { autor: string; texto: string } | null;
  /** Reações agrupadas por emoji (Fase 6). */
  reacoes: ReacaoAgrupada[];
}
