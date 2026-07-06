import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ResultadoBusca {
  id: string;
  tipo: "cliente" | "simulacao" | "proposta" | "tarefa";
  titulo: string;
  subtitulo?: string;
  link: string;
}

export interface RespostaBusca {
  termo: string;
  resultados: ResultadoBusca[];
}

/**
 * Busca global (⌘K) em clientes, simulações, propostas e tarefas.
 * Os módulos pesquisáveis são registrados nas Etapas 04–07; enquanto
 * não existirem, a busca retorna vazio (nunca dados fictícios).
 */
export const buscaGlobal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ termo: z.string().trim().min(1).max(120) }).parse(data))
  .handler(async ({ data }): Promise<RespostaBusca> => {
    // Placeholder de integração: cada etapa futura adiciona sua consulta
    // real com escopo por correspondente_id e RLS. Sem mocks.
    return { termo: data.termo, resultados: [] };
  });
