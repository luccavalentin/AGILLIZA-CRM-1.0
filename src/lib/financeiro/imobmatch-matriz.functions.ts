/**
 * Receita do ImobMatch no financeiro da matriz (decisão do dono, 28/10/2026: só leitura, no
 * padrão das licenças dos assinantes — 0328). Lida pela ponte de
 * `plataforma.financeiro_matriz_imobmatch` (0461 do Corretor): nada é copiado para o Agilliza,
 * não nasce conta a receber nem baixa, e o estorno aparece sozinho na leitura.
 * Mesma porta da tela de licenças: `financeiro.repasses` ver (o banco confere de novo).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

export type ProdutoImobMatchMatriz = "pro" | "anunciante" | "patrocinio";

export interface ReceitaImobMatchMatriz {
  periodo: { de: string; ate: string };
  totais: {
    recebido: number;
    faturas_pagas: number;
    a_receber: number;
    inadimplencia: number;
    contas_inadimplentes: number;
    estornado: number;
    faturas_estornadas: number;
  };
  por_produto: {
    produto: ProdutoImobMatchMatriz;
    recebido: number;
    faturas: number;
    inadimplencia: number;
  }[];
  por_mes: {
    mes: string;
    pro: number;
    anunciante: number;
    patrocinio: number;
    estornado: number;
  }[];
}

export const receitaImobMatchMatriz = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["financeiro.repasses", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({ de: data, ate: data })
      .refine((p) => p.de <= p.ate, { message: "O início do período vem antes do fim." })
      .parse(d),
  )
  .handler(async ({ data: d, context }) => {
    const { comPlataforma } = await import("@/lib/plataforma/ponte.server");
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ j: ReceitaImobMatchMatriz }>(
        "select plataforma.financeiro_matriz_imobmatch($1::date, $2::date) as j",
        [d.de, d.ate],
      );
      return r?.j ?? null;
    });
  });
