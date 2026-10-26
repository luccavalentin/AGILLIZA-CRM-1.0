/**
 * Moderação do chat universal pela Gestão de sistemas (aba "Chat" da Gestão de Parceiros e
 * Anúncios, migração 0352 do Agilliza Tech).
 *
 * Fila: `plataforma.chat_denuncias` (trecho denunciado, contexto curto da conversa, quem
 * denunciou e o denunciado com o @). Decisão: `plataforma.chat_decidir` — Manter, Remover a
 * mensagem ou Bloquear o usuário no chat, sempre com motivo. Suspensos: `chat_suspensos` e
 * `chat_reativar` (também com motivo). Ler pede `saas.imobmatch` ver; decidir, editar — e o
 * banco confere de novo pelas permissões da plataforma do operador.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

export const SITUACOES_CHAT = ["aberta", "procedente", "improcedente"] as const;
export type SituacaoDenunciaChat = (typeof SITUACOES_CHAT)[number];
export const DECISOES_CHAT = ["manter", "remover_mensagem", "bloquear_usuario"] as const;
export type DecisaoChat = (typeof DECISOES_CHAT)[number];

export interface PessoaChatModeracao {
  usuario_id: string;
  nome: string;
  arroba: string | null;
  detalhe: string | null;
  suspenso: boolean;
}

export interface DenunciaChat {
  id: string;
  motivo: string;
  detalhe: string | null;
  trecho: string | null;
  status: SituacaoDenunciaChat;
  acao: DecisaoChat | null;
  nota: string | null;
  criado_em: string;
  resolvido_em: string | null;
  denunciante: PessoaChatModeracao | null;
  denunciado: PessoaChatModeracao | null;
  mensagem: { id: string; tipo: string; criado_em: string; apagada: boolean; anexos: number } | null;
  grupo: boolean | null;
  contexto: { autor: string | null; corpo: string | null; criado_em: string; do_denunciado: boolean; denunciada: boolean; apagada: boolean }[];
  denuncias_contra: number;
}

export interface SuspensoChat extends PessoaChatModeracao {
  motivo: string;
  desde: string;
  por: string | null;
}

const MOTIVO = z
  .string()
  .trim()
  .min(5, "Escreva o motivo da decisão (pelo menos 5 letras).")
  .max(500, "O motivo vai até 500 letras.");

async function ponte() {
  return import("./ponte.server");
}

export const lerDenunciasChat = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.imobmatch", "view"], ["imobmatch.moderacao", "view"])])
  .inputValidator((d: unknown) => z.object({ situacao: z.enum(SITUACOES_CHAT).default("aberta") }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ j: DenunciaChat[] }>("select plataforma.chat_denuncias($1, 100) as j", [data.situacao]);
      return r?.j ?? [];
    });
  });

export const decidirDenunciaChat = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.imobmatch", "edit"], ["imobmatch.moderacao", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid("Denúncia inválida."),
        decisao: z.enum(DECISOES_CHAT, { message: "Decisão inválida." }),
        motivo: MOTIVO,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ n: number }>("select plataforma.chat_decidir($1, $2, $3) as n", [data.id, data.decisao, data.motivo]),
    );
    return { resolvidas: Number(r?.n ?? 0) };
  });

export const lerSuspensosChat = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.imobmatch", "view"], ["imobmatch.moderacao", "view"])])
  .handler(async ({ context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ j: SuspensoChat[] }>("select plataforma.chat_suspensos() as j");
      return r?.j ?? [];
    });
  });

export const reativarNoChat = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.imobmatch", "edit"], ["imobmatch.moderacao", "edit"])])
  .inputValidator((d: unknown) => z.object({ usuarioId: z.string().uuid("Pessoa inválida."), motivo: MOTIVO }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    await comPlataforma(context.userId, (tx) => tx.consultar("select plataforma.chat_reativar($1, $2)", [data.usuarioId, data.motivo]));
    return { ok: true };
  });
