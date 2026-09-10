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
  /**
   * Descarta a simulação que já existe no provedor e cria outra do zero.
   *
   * Usado pela reconciliação quando o provedor aceitou a integração (200) mas
   * nunca despachou ao banco — `dataHoraEnvioIntegracao` fica nulo para
   * sempre. Nesse estado, insistir no MESMO `idSimulacao` não leva a lugar
   * nenhum; o contrato prevê criar outra simulação e integrar essa.
   */
  forcarRecriacao?: boolean;
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
  constructor(
    message: string,
    public statusHttp?: number,
  ) {
    super(message);
    this.name = "IntegracaoBancariaError";
  }
}
