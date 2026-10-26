/**
 * Envio de arquivo pela gestão da plataforma no Agilliza: capa da News e anexo do suporte.
 *
 * Mesmas regras de `/api/midias` do Corretor: tipo conferido contra lista curta, teto de
 * tamanho, imagem de vitrine conferida pelos primeiros bytes, chave gerada no servidor.
 * O registro (`integracao.registrar_midia`) roda com o contexto de plataforma da pessoa —
 * a RLS e a cota decidem; se o banco recusar, o arquivo já guardado é apagado.
 */
import { createServerFn } from "@tanstack/react-start";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

const TETO_BYTES = 25 * 1024 * 1024;
const TETO_CAPA = 5 * 1024 * 1024;
const MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/avif",
  "application/pdf",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
]);
const MIMES_CAPA = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface MidiaEnviada {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  url: string | null;
}

type Pedido = { arquivo: File; destino: "capa_news" | "anexo_suporte" | "social_post" };

function lerFormulario(d: unknown): Pedido {
  if (!(d instanceof FormData)) throw new Error("Envie o arquivo.");
  const arquivo = d.get("arquivo");
  const destino = String(d.get("destino") ?? "");
  if (!(arquivo instanceof File) || arquivo.size === 0) throw new Error("Escolha um arquivo.");
  if (destino !== "capa_news" && destino !== "anexo_suporte" && destino !== "social_post")
    throw new Error("Destino inválido.");
  return { arquivo, destino };
}

async function enviar(userId: string, p: Pedido): Promise<MidiaEnviada> {
  const { arquivo, destino } = p;
  const mime = (arquivo.type || "").split(";")[0].trim().toLowerCase();
  // Foto de post das Automações: mesma régua da capa (imagem conferida pelos primeiros bytes).
  const capa = destino === "capa_news" || destino === "social_post";
  if (capa) {
    if (!MIMES_CAPA.has(mime)) throw new Error("Envie a capa em JPG, PNG ou WebP.");
    if (arquivo.size > TETO_CAPA) throw new Error("Imagem acima de 5 MB.");
  } else {
    if (!MIMES.has(mime)) throw new Error("Tipo não aceito. Envie imagem, PDF ou áudio.");
    if (arquivo.size > TETO_BYTES) throw new Error(`${arquivo.name} passa de 25 MB.`);
  }

  const m = await import("./midias.server");
  const conteudo = Buffer.from(await arquivo.arrayBuffer());
  if (capa && !m.assinaturaDeImagem(conteudo, mime)) {
    throw new Error("O arquivo não é a imagem que diz ser. Exporte de novo em JPG ou PNG.");
  }
  // Mesma entidade que o Corretor usa: capa da News = `radar_post`; anexo de conversa =
  // `proposta` sem id (é assim que o fio do suporte guarda, e a RLS do chamado o enxerga).
  const entidade = destino === "social_post" ? "social" : capa ? "radar_post" : "proposta";
  const tipo = capa
    ? "foto"
    : mime.startsWith("image/")
      ? "foto"
      : mime.startsWith("audio/")
        ? "audio"
        : "documento";
  const nome = arquivo.name.slice(0, 200) || "arquivo";

  const { comPlataforma } = await import("./ponte.server");
  let guardado: { chave: string; bytes: number; sha256: string } | null = null;
  try {
    return await comPlataforma(userId, async (tx) => {
      const t = await tx.uma<{ t: string | null }>("select seguranca.auth_tenant_ativo() as t");
      if (!t?.t) throw new Error("Contexto da plataforma indisponível.");
      guardado = await m.guardarNoCorretor({ conteudo, mime, nome, pasta: `${t.t}/${entidade}` });
      const r = await tx.uma<{ id: string }>(
        "select integracao.registrar_midia($1, null, $2, $3, $4, $5, $6, $7) as id",
        [entidade, tipo, guardado.chave, nome, mime, guardado.bytes, guardado.sha256],
      );
      if (!r?.id) throw new Error("Não foi possível registrar o arquivo.");
      const lib = await m.liberarMidias(tx, [r.id]);
      return {
        id: r.id,
        nome: nome.slice(0, 120),
        tipo: mime,
        tamanho: guardado.bytes,
        url: lib[r.id]?.url ?? null,
      };
    });
  } catch (e) {
    // Banco recusou (RLS, cota): o arquivo já guardado vira lixo — apaga.
    const g = guardado as { chave: string } | null;
    if (g) await m.apagarNoCorretor(g.chave);
    if (e instanceof Error && /row-level security/i.test(e.message)) {
      throw new Error("Você não tem permissão para anexar este arquivo aqui.");
    }
    throw e;
  }
}

export const enviarCapaNews = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.news", "edit"])])
  .inputValidator(lerFormulario)
  .handler(async ({ data, context }) => {
    if (data.destino !== "capa_news") throw new Error("Destino inválido.");
    return enviar(context.userId, data);
  });

export const enviarAnexoSuporte = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.suporte", "edit"])])
  .inputValidator(lerFormulario)
  .handler(async ({ data, context }) => {
    if (data.destino !== "anexo_suporte") throw new Error("Destino inválido.");
    return enviar(context.userId, data);
  });

const TETO_VIDEO = 60 * 1024 * 1024;
const MIMES_VIDEO = new Set(["video/mp4", "video/quicktime", "video/webm"]);

/**
 * Vídeo de um post das Automações (Reels, Stories, TikTok, YouTube…): até 60 MB, tipo
 * conferido pelos primeiros bytes e duração LIDA DO ARQUIVO (a da tela pode ser forjada) —
 * a duração vai para `social.anotar_video`, e cada rede confere o limite dela.
 */
export const enviarVideoSocial = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["marketing.automacoes", "edit"])])
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Envie o vídeo.");
    const arquivo = d.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) throw new Error("Escolha um vídeo.");
    return { arquivo };
  })
  .handler(async ({ data, context }): Promise<MidiaEnviada & { duracaoMs: number }> => {
    const { arquivo } = data;
    const mime = (arquivo.type || "").split(";")[0].trim().toLowerCase();
    if (!MIMES_VIDEO.has(mime)) throw new Error("Envie o vídeo em MP4, MOV ou WebM.");
    if (arquivo.size > TETO_VIDEO)
      throw new Error("Vídeo acima de 60 MB. Exporte em resolução menor.");
    const conteudo = Buffer.from(await arquivo.arrayBuffer());
    const { confere, duracaoDoVideo } = await import("@/lib/social/video");
    if (!confere(conteudo, mime)) throw new Error("O arquivo não é o vídeo que diz ser.");
    const duracaoMs = duracaoDoVideo(conteudo, mime);
    if (duracaoMs == null)
      throw new Error("Não conseguimos ler este vídeo. Exporte em MP4 (H.264) e envie outra vez.");
    const m = await import("./midias.server");
    const { comPlataforma } = await import("./ponte.server");
    const nome = arquivo.name.slice(0, 200) || "video";
    let guardado: { chave: string; bytes: number; sha256: string } | null = null;
    try {
      return await comPlataforma(context.userId, async (tx) => {
        const t = await tx.uma<{ t: string | null }>("select seguranca.auth_tenant_ativo() as t");
        if (!t?.t) throw new Error("Contexto da plataforma indisponível.");
        guardado = await m.guardarNoCorretor({ conteudo, mime, nome, pasta: `${t.t}/social` });
        const r = await tx.uma<{ id: string }>(
          "select integracao.registrar_midia('social', null, 'video', $1, $2, $3, $4, $5) as id",
          [guardado.chave, nome, mime, guardado.bytes, guardado.sha256],
        );
        if (!r?.id) throw new Error("Não foi possível registrar o vídeo.");
        await tx.consultar("select social.anotar_video($1, $2)", [r.id, duracaoMs]);
        const lib = await m.liberarMidias(tx, [r.id]);
        return {
          id: r.id,
          nome: nome.slice(0, 120),
          tipo: mime,
          tamanho: guardado.bytes,
          url: lib[r.id]?.url ?? null,
          duracaoMs,
        };
      });
    } catch (e) {
      const g = guardado as { chave: string } | null;
      if (g) await m.apagarNoCorretor(g.chave);
      throw e;
    }
  });

/** Foto de um post das Automações (0227): vai para o armazenamento da plataforma. */
export const enviarFotoSocial = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["marketing.automacoes", "edit"])])
  .inputValidator(lerFormulario)
  .handler(async ({ data, context }) => {
    if (data.destino !== "social_post") throw new Error("Destino inválido.");
    return enviar(context.userId, data);
  });
