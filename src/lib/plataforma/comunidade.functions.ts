/**
 * Moderação do ImobMatch Comunidade pela Gestão de sistemas (aba "Comunidade" da Gestão de
 * Parceiros e Anúncios, migrações 0311 e 0312 do Agilliza Tech).
 *
 * Fila: `rede.imobnet_moderacao` (as denúncias de posts, comentários, stories, mensagens,
 * membros e anúncios da comunidade). Decisão: `plataforma.comunidade_decidir` — Aprovar
 * (o conteúdo fica) ou Remover (sai, ou o membro é suspenso), sempre com motivo. Ler pede
 * `saas.imobmatch` ver; decidir, `saas.imobmatch` editar (e o banco confere de novo).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

export type AlvoDenuncia = "anuncio" | "membro" | "post" | "comentario" | "story" | "mensagem";
export type SituacaoDenunciaComunidade = "aberta" | "procedente" | "improcedente";

export interface MembroComunidade {
  usuario_id?: string;
  nome?: string | null;
  apelido?: string | null;
  conta?: string | null;
  suspenso?: boolean | null;
  tipo_rotulo?: string | null;
  cidade?: string | null;
  uf?: string | null;
  selo?: string | null;
}

export interface DenunciaComunidade {
  id: string;
  alvo: AlvoDenuncia;
  motivo: string;
  detalhe: string | null;
  status: SituacaoDenunciaComunidade;
  criado_em: string;
  resolvida_em: string | null;
  decisao_obs: string | null;
  acao: string | null;
  denunciante: { nome: string | null; conta: string | null } | null;
  anuncio: {
    id: string;
    titulo: string;
    status: string;
    descricao: string | null;
    codigo: string | null;
    cidade: string | null;
    uf: string | null;
    conta: string | null;
    anunciante: string | null;
  } | null;
  membro: MembroComunidade | null;
  conteudo: {
    id: string;
    tipo?: string | null;
    legenda?: string | null;
    corpo?: string | null;
    texto?: string | null;
    status?: string | null;
    criado_em?: string | null;
    apagado?: boolean | null;
    apagada?: boolean | null;
  } | null;
  denuncias_no_alvo: number;
  /** Imagens e vídeos do conteúdo denunciado, com endereço selado de 1 hora. */
  midias: { id: string; url: string | null; mime: string; nome: string }[];
}

export const SITUACOES_COMUNIDADE = ["aberta", "procedente", "improcedente"] as const;

async function ponte() {
  return import("./ponte.server");
}

/** Denúncias da comunidade numa situação (abertas primeiro: as mais antigas no topo). */
export const lerDenunciasComunidade = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.imobmatch", "view"])])
  .inputValidator((d: unknown) =>
    z.object({ situacao: z.enum(SITUACOES_COMUNIDADE).default("aberta") }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ j: Omit<DenunciaComunidade, "midias">[] }>(
        "select rede.imobnet_moderacao($1, 100) as j",
        [data.situacao],
      );
      const lista = r?.j ?? [];
      const midias = lista.length
        ? await tx.consultar<{ denuncia_id: string; midia_id: string; r2_key: string; mime: string; nome: string }>(
            "select denuncia_id, midia_id, r2_key, mime, nome from plataforma.comunidade_midias($1::uuid[])",
            [lista.map((d) => d.id)],
          )
        : [];
      const { selarArquivo } = await import("./midias.server");
      const porDenuncia = new Map<string, DenunciaComunidade["midias"]>();
      for (const m of midias) {
        const arr = porDenuncia.get(m.denuncia_id) ?? [];
        arr.push({ id: m.midia_id, url: selarArquivo(m.r2_key, m.mime, m.nome), mime: m.mime, nome: m.nome });
        porDenuncia.set(m.denuncia_id, arr);
      }
      return lista.map((d) => ({ ...d, midias: porDenuncia.get(d.id) ?? [] })) as DenunciaComunidade[];
    });
  });

/** Aprovar (o conteúdo fica) ou Remover (sai; denúncia de membro suspende o membro). */
export const decidirDenunciaComunidade = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.imobmatch", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid("Denúncia inválida."),
        decisao: z.enum(["aprovar", "remover"], { message: "Decisão inválida." }),
        motivo: z
          .string()
          .trim()
          .min(5, "Escreva o motivo da decisão (pelo menos 5 letras).")
          .max(500, "O motivo vai até 500 letras."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await ponte();
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ n: number }>("select plataforma.comunidade_decidir($1, $2, $3) as n", [
        data.id,
        data.decisao,
        data.motivo,
      ]),
    );
    return { resolvidas: Number(r?.n ?? 0) };
  });
