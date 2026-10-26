/**
 * Arquivos (Documentos diversos › Arquivos) — server functions.
 *
 * Toda regra mora no banco (migração 20261027040040): nível por item (ver/editar/gerir),
 * pastas restritas e compartilhadas, nome único por pasta, ciclo ao mover, lixeira, versões
 * e cota. Aqui só chamamos as funções `arquivos_*` com o token da pessoa (a RLS e as
 * funções sabem quem ela é) e apagamos do bucket o que o banco devolveu como sem uso.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

export type VisaoArquivos = "pasta" | "favoritos" | "compartilhados" | "recentes" | "busca";

export interface ArquivoNo {
  id: string;
  parent_id: string | null;
  tipo: "pasta" | "arquivo";
  nome: string;
  content_type: string | null;
  tamanho: number | null;
  created_at: string;
  updated_at: string;
  criado_por_nome: string | null;
  mostrar_no_menu: boolean;
  etiquetas: string[];
  restrita: boolean;
  versao_atual: number;
  favorito: boolean;
  /** 1 ver, 2 editar, 3 gerir. */
  nivel: 1 | 2 | 3;
  /** Quantidade de itens dentro (pastas). */
  itens: number | null;
  /** Caminho até o item (visões especiais). */
  caminho: string | null;
}

export interface Migalha {
  id: string;
  nome: string;
  /** Nível da pessoa nesta pasta (1 ver, 2 editar, 3 gerir). */
  nivel: number;
}

export interface PastaFlat {
  id: string;
  nome: string;
  caminho: string;
}

export interface ItemLixeira {
  id: string;
  tipo: "pasta" | "arquivo";
  nome: string;
  tamanho: number | null;
  content_type: string | null;
  excluido_em: string;
  excluido_por_nome: string | null;
  origem: string;
}

export interface VersaoArquivo {
  versao: number;
  tamanho: number | null;
  content_type: string | null;
  criado_por_nome: string | null;
  created_at: string;
  atual: boolean;
}

export interface Armazenamento {
  usado: number;
  na_lixeira: number;
  limite: number;
  pode_alterar: boolean;
  /** Pasta do bucket onde a pessoa pode enviar (`<correspondente>`). */
  prefixo: string | null;
}

export interface AcessoItem {
  user_id: string | null;
  nivel_acesso_id: string | null;
  nivel: "ver" | "editar" | "gerir";
  nome: string | null;
}

const UUID = z.string().uuid();
const VER = exigirPermissao(["documentos.arquivos", "view"]);

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
function rpcDe(supabase: unknown): Rpc {
  return (fn, args) => (supabase as { rpc: Rpc }).rpc(fn, args);
}
/** Erro do banco já vem em português (raise das funções). */
function falhar(error: { message?: string } | null, padrao: string): never {
  throw new Error(error?.message?.trim() || padrao);
}

/** Lista uma pasta (ou a raiz) ou uma visão: favoritos, compartilhados, recentes, busca. */
export const listarArquivos = createServerFn({ method: "GET" })
  .middleware([VER])
  .inputValidator((d) =>
    z
      .object({
        parent_id: UUID.nullable().optional(),
        visao: z.enum(["pasta", "favoritos", "compartilhados", "recentes", "busca"]).default("pasta"),
        termo: z.string().trim().max(200).optional().nullable(),
        etiqueta: z.string().trim().max(30).optional().nullable(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }): Promise<ArquivoNo[]> => {
    const { data: linhas, error } = await rpcDe(context.supabase)("arquivos_listar", {
      p_parent: data.visao === "pasta" ? (data.parent_id ?? null) : null,
      p_visao: data.visao,
      p_termo: data.termo || null,
      p_etiqueta: data.etiqueta || null,
    });
    if (error) falhar(error, "Não foi possível listar os arquivos.");
    return ((linhas ?? []) as ArquivoNo[]).map((l) => ({
      ...l,
      tamanho: l.tamanho == null ? null : Number(l.tamanho),
      itens: l.itens == null ? null : Number(l.itens),
      etiquetas: l.etiquetas ?? [],
    }));
  });

/** Trilha da pasta até a raiz. */
export const caminhoNo = createServerFn({ method: "GET" })
  .middleware([VER])
  .inputValidator((d) => z.object({ id: UUID.nullable().optional() }).parse(d ?? {}))
  .handler(async ({ context, data }): Promise<Migalha[]> => {
    if (!data.id) return [];
    const { data: linhas, error } = await rpcDe(context.supabase)("arquivos_trilha", { p_no: data.id });
    if (error) falhar(error, "Pasta não encontrada.");
    return (linhas ?? []) as Migalha[];
  });

/** Pastas da raiz marcadas para aparecer no menu lateral (só o que a pessoa vê). */
export const listarPastasRaiz = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ id: string; nome: string }[]> => {
    const { supabase, userId } = context;
    const { data: podeVer } = await supabase.rpc("usuario_tem_permissao", {
      _user_id: userId,
      _modulo: "documentos.arquivos",
      _acao: "view",
    });
    if (!podeVer) return [];
    // A RLS (arquivos_nivel) já esconde pasta restrita de quem não tem acesso.
    const { data: rows, error } = await (supabase as any)
      .from("arquivos_nos")
      .select("id, nome")
      .eq("tipo", "pasta")
      .eq("mostrar_no_menu", true)
      .is("parent_id", null)
      .is("excluido_em", null)
      .order("nome", { ascending: true });
    if (error) return [];
    return (rows ?? []) as { id: string; nome: string }[];
  });

export const definirMostrarNoMenu = createServerFn({ method: "POST" })
  .middleware([VER])
  .inputValidator((d) => z.object({ id: UUID, mostrar: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await rpcDe(context.supabase)("arquivos_mostrar_no_menu", {
      p_no: data.id,
      p_mostrar: data.mostrar,
    });
    if (error) falhar(error, "Não foi possível alterar o menu.");
    return { ok: true as const };
  });

/** Cria a pasta (mesmo nome no mesmo lugar devolve a existente). */
export const criarPasta = createServerFn({ method: "POST" })
  .middleware([VER])
  .inputValidator((d) =>
    z.object({ parent_id: UUID.nullable().optional(), nome: z.string().trim().min(1).max(300) }).parse(d),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { data: id, error } = await rpcDe(context.supabase)("arquivos_criar_pasta", {
      p_parent: data.parent_id ?? null,
      p_nome: data.nome,
    });
    if (error) falhar(error, "Não foi possível criar a pasta.");
    return { id: id as string };
  });

/** Registra o arquivo já enviado ao bucket (nova versão quando pedido). */
export const registrarArquivo = createServerFn({ method: "POST" })
  .middleware([VER])
  .inputValidator((d) =>
    z
      .object({
        parent_id: UUID.nullable().optional(),
        nome: z.string().trim().min(1).max(300),
        storage_path: z.string().min(3).max(400),
        content_type: z.string().max(200).nullable().optional(),
        tamanho: z.number().int().nonnegative(),
        nova_versao: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<{ id: string; versao: number }> => {
    const { data: r, error } = await rpcDe(context.supabase)("arquivos_registrar", {
      p_parent: data.parent_id ?? null,
      p_nome: data.nome,
      p_storage_path: data.storage_path,
      p_content_type: data.content_type ?? null,
      p_tamanho: data.tamanho,
      p_nova_versao: data.nova_versao,
    });
    if (error) {
      // O objeto subiu, mas o registro foi recusado (cota, nome, permissão): apaga o órfão.
      // Só dentro da pasta do correspondente da pessoa — o banco recusou caminho de outra.
      const { data: corr } = await context.supabase
        .from("profiles")
        .select("correspondente_id")
        .eq("id", context.userId)
        .maybeSingle();
      if (corr?.correspondente_id && data.storage_path.startsWith(`${corr.correspondente_id}/`)) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: emUso } = await supabaseAdmin
          .from("arquivos_versoes" as never)
          .select("id")
          .eq("storage_path", data.storage_path)
          .limit(1);
        const { data: noUso } = await supabaseAdmin
          .from("arquivos_nos")
          .select("id")
          .eq("storage_path", data.storage_path)
          .limit(1);
        if ((emUso ?? []).length === 0 && (noUso ?? []).length === 0) {
          await supabaseAdmin.storage.from("arquivos").remove([data.storage_path]);
        }
      }
      falhar(error, "Não foi possível registrar o arquivo.");
    }
    return { id: r.id as string, versao: Number(r.versao) };
  });

export const renomearNo = createServerFn({ method: "POST" })
  .middleware([VER])
  .inputValidator((d) => z.object({ id: UUID, nome: z.string().trim().min(1).max(300) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await rpcDe(context.supabase)("arquivos_renomear", { p_no: data.id, p_nome: data.nome });
    if (error) falhar(error, "Não foi possível renomear.");
    return { ok: true as const };
  });

export const moverNo = createServerFn({ method: "POST" })
  .middleware([VER])
  .inputValidator((d) => z.object({ id: UUID, novo_parent_id: UUID.nullable().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await rpcDe(context.supabase)("arquivos_mover", {
      p_no: data.id,
      p_destino: data.novo_parent_id ?? null,
    });
    if (error) falhar(error, "Não foi possível mover.");
    return { ok: true as const };
  });

/** Manda para a lixeira (o item e tudo dentro dele). */
export const moverParaLixeira = createServerFn({ method: "POST" })
  .middleware([VER])
  .inputValidator((d) => z.object({ id: UUID }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await rpcDe(context.supabase)("arquivos_para_lixeira", { p_no: data.id });
    if (error) falhar(error, "Não foi possível mandar para a lixeira.");
    return { ok: true as const };
  });

export const restaurarDaLixeira = createServerFn({ method: "POST" })
  .middleware([VER])
  .inputValidator((d) => z.object({ id: UUID }).parse(d))
  .handler(async ({ context, data }): Promise<{ pasta: string | null }> => {
    const { data: pasta, error } = await rpcDe(context.supabase)("arquivos_restaurar", { p_no: data.id });
    if (error) falhar(error, "Não foi possível restaurar.");
    return { pasta: (pasta as string | null) ?? null };
  });

/** Exclui para sempre (só da lixeira) e apaga do bucket os objetos que ficaram sem uso. */
export const excluirDefinitivo = createServerFn({ method: "POST" })
  .middleware([VER])
  .inputValidator((d) => z.object({ id: UUID }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: caminhos, error } = await rpcDe(context.supabase)("arquivos_excluir_definitivo", {
      p_no: data.id,
    });
    if (error) falhar(error, "Não foi possível excluir.");
    const lista = ((caminhos ?? []) as string[]).filter(Boolean);
    if (lista.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      for (let i = 0; i < lista.length; i += 100) {
        const { error: e } = await supabaseAdmin.storage.from("arquivos").remove(lista.slice(i, i + 100));
        if (e) console.error("[arquivos] objetos não apagados do bucket", e.message);
      }
    }
    return { ok: true as const, objetos: lista.length };
  });

export const listarLixeira = createServerFn({ method: "GET" })
  .middleware([VER])
  .handler(async ({ context }): Promise<ItemLixeira[]> => {
    const { data, error } = await rpcDe(context.supabase)("arquivos_lixeira");
    if (error) falhar(error, "Não foi possível abrir a lixeira.");
    return ((data ?? []) as ItemLixeira[]).map((l) => ({
      ...l,
      tamanho: l.tamanho == null ? null : Number(l.tamanho),
    }));
  });

export const alternarFavorito = createServerFn({ method: "POST" })
  .middleware([VER])
  .inputValidator((d) => z.object({ id: UUID }).parse(d))
  .handler(async ({ context, data }): Promise<{ favorito: boolean }> => {
    const { data: fav, error } = await rpcDe(context.supabase)("arquivos_favoritar", { p_no: data.id });
    if (error) falhar(error, "Não foi possível favoritar.");
    return { favorito: !!fav };
  });

export const definirEtiquetas = createServerFn({ method: "POST" })
  .middleware([VER])
  .inputValidator((d) =>
    z.object({ id: UUID, etiquetas: z.array(z.string().max(60)).max(30) }).parse(d),
  )
  .handler(async ({ context, data }): Promise<{ etiquetas: string[] }> => {
    const { data: et, error } = await rpcDe(context.supabase)("arquivos_etiquetar", {
      p_no: data.id,
      p_etiquetas: data.etiquetas,
    });
    if (error) falhar(error, "Não foi possível salvar as etiquetas.");
    return { etiquetas: (et ?? []) as string[] };
  });

export const listarVersoes = createServerFn({ method: "GET" })
  .middleware([VER])
  .inputValidator((d) => z.object({ id: UUID }).parse(d))
  .handler(async ({ context, data }): Promise<VersaoArquivo[]> => {
    const { data: v, error } = await rpcDe(context.supabase)("arquivos_versoes_de", { p_no: data.id });
    if (error) falhar(error, "Não foi possível listar as versões.");
    return ((v ?? []) as VersaoArquivo[]).map((x) => ({
      ...x,
      tamanho: x.tamanho == null ? null : Number(x.tamanho),
    }));
  });

export const restaurarVersao = createServerFn({ method: "POST" })
  .middleware([VER])
  .inputValidator((d) => z.object({ id: UUID, versao: z.number().int().min(1) }).parse(d))
  .handler(async ({ context, data }): Promise<{ versao: number }> => {
    const { data: v, error } = await rpcDe(context.supabase)("arquivos_restaurar_versao", {
      p_no: data.id,
      p_versao: data.versao,
    });
    if (error) falhar(error, "Não foi possível voltar a esta versão.");
    return { versao: Number(v) };
  });

/** Link assinado (5 min) da versão atual ou de uma versão anterior. */
export const urlArquivo = createServerFn({ method: "POST" })
  .middleware([VER])
  .inputValidator((d) =>
    z
      .object({ id: UUID, download: z.boolean().optional(), versao: z.number().int().min(1).optional() })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<{ url: string; nome: string }> => {
    const { supabase } = context;
    // A RLS só devolve o item se a pessoa o vê.
    const { data: no } = await (supabase as any)
      .from("arquivos_nos")
      .select("nome, storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (!no?.storage_path) throw new Error("Arquivo não encontrado.");
    let caminho: string = no.storage_path;
    if (data.versao) {
      const { data: c, error } = await rpcDe(supabase)("arquivos_caminho_versao", {
        p_no: data.id,
        p_versao: data.versao,
      });
      if (error || !c) falhar(error, "Versão não encontrada.");
      caminho = c as string;
    }
    const { data: assinada, error } = await supabase.storage
      .from("arquivos")
      .createSignedUrl(caminho, 300, data.download ? { download: no.nome } : undefined);
    if (error || !assinada?.signedUrl) throw new Error("Não foi possível gerar o link.");
    return { url: assinada.signedUrl, nome: no.nome };
  });

/** Pastas onde a pessoa pode pôr coisas (mover, enviar). */
export const listarPastas = createServerFn({ method: "GET" })
  .middleware([VER])
  .handler(async ({ context }): Promise<PastaFlat[]> => {
    const { data, error } = await rpcDe(context.supabase)("arquivos_pastas_destino");
    if (error) falhar(error, "Não foi possível listar as pastas.");
    return (data ?? []) as PastaFlat[];
  });

/** Uso da cota e a pasta do bucket para envio. */
export const lerArmazenamento = createServerFn({ method: "GET" })
  .middleware([VER])
  .handler(async ({ context }): Promise<Armazenamento> => {
    const [{ data, error }, perfil] = await Promise.all([
      rpcDe(context.supabase)("arquivos_armazenamento"),
      context.supabase.from("profiles").select("correspondente_id").eq("id", context.userId).maybeSingle(),
    ]);
    if (error) falhar(error, "Não foi possível ler o armazenamento.");
    return {
      usado: Number(data?.usado ?? 0),
      na_lixeira: Number(data?.na_lixeira ?? 0),
      limite: Number(data?.limite ?? 0),
      pode_alterar: !!data?.pode_alterar,
      prefixo: perfil.data?.correspondente_id ?? null,
    };
  });

export const definirCota = createServerFn({ method: "POST" })
  .middleware([VER])
  .inputValidator((d) => z.object({ gb: z.number().min(1).max(10000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await rpcDe(context.supabase)("arquivos_definir_cota", { p_gb: data.gb });
    if (error) falhar(error, "Não foi possível alterar a cota.");
    return { ok: true as const };
  });

export const lerAcesso = createServerFn({ method: "GET" })
  .middleware([VER])
  .inputValidator((d) => z.object({ id: UUID }).parse(d))
  .handler(async ({ context, data }): Promise<{ restrita: boolean; acessos: AcessoItem[] }> => {
    const { data: r, error } = await rpcDe(context.supabase)("arquivos_acesso_de", { p_no: data.id });
    if (error) falhar(error, "Não foi possível ler o acesso.");
    return { restrita: !!r?.restrita, acessos: (r?.acessos ?? []) as AcessoItem[] };
  });

export const salvarAcesso = createServerFn({ method: "POST" })
  .middleware([VER])
  .inputValidator((d) =>
    z
      .object({
        id: UUID,
        restrita: z.boolean(),
        acessos: z
          .array(
            z.object({
              user_id: UUID.nullable().optional(),
              nivel_acesso_id: UUID.nullable().optional(),
              nivel: z.enum(["ver", "editar", "gerir"]),
            }),
          )
          .max(200),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await rpcDe(context.supabase)("arquivos_definir_acesso", {
      p_no: data.id,
      p_restrita: data.restrita,
      p_acessos: data.acessos.map((a) => ({
        user_id: a.user_id ?? null,
        nivel_acesso_id: a.nivel_acesso_id ?? null,
        nivel: a.nivel,
      })),
    });
    if (error) falhar(error, "Não foi possível salvar o acesso.");
    return { ok: true as const };
  });

export const listarAlvosCompartilhar = createServerFn({ method: "GET" })
  .middleware([VER])
  .handler(
    async ({ context }): Promise<{ pessoas: { id: string; nome: string }[]; equipes: { id: string; nome: string }[] }> => {
      const { data, error } = await rpcDe(context.supabase)("arquivos_alvos_compartilhar");
      if (error) falhar(error, "Não foi possível listar pessoas e equipes.");
      return { pessoas: data?.pessoas ?? [], equipes: data?.equipes ?? [] };
    },
  );
