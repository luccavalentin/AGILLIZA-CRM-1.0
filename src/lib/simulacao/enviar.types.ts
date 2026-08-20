/**
 * Tipos e interfaces para o motor de envio de simulações.
 */
import { SupabaseClient } from "@supabase/supabase-js";

export interface EnviarArgs {
  simulacaoId: string;
  userId: string;
  supabase: SupabaseClient;
  bancoIds?: string[];
  ip?: string | null;
}

export interface EnviarResultado {
  oportunidade_id?: string | null;
  status: "rascunho" | "enviando" | "simulada" | "erro_banco" | "parcialmente_simulada";
  bancos: Array<{
    banco_id: string;
    status: "simulada" | "erro" | "aguardando" | "enviando";
    nome_banco?: string;
    mensagem?: string;
  }>;
}

export class IntegracaoBancariaError extends Error {
  constructor(message: string, public statusHttp?: number) {
    super(message);
    this.name = "IntegracaoBancariaError";
  }
}
