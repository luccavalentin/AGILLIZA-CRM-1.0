/**
 * Chat universal no Agilliza (pedido de 26/10/2026: C14, T01, T02, T60, C01, C02).
 *
 * O chat antigo do correspondente foi apagado: o Agilliza usa o MESMO chat dos assinantes
 * do Agilliza Tech, pela ponte (`comChatAgilliza`). Cada pessoa do Agilliza tem um espelho
 * lá (com o @ único); as regras — quem é da base, pedido de mensagem, bloqueio, quem lê o
 * anexo — são as funções `chat.*`/`acesso.*` do banco. Aqui só:
 *   · descobrir quem fala (`pessoaDoChat`: login da equipe/parceiro ou sessão do portal do cliente);
 *   · validar a forma dos dados (zod) e chamar a função do banco certa;
 *   · selar os endereços dos anexos (`liberarMidias`, que relê a mídia sob a RLS da pessoa).
 *
 * Uma server function despachante (`chatAcao`) em vez de quarenta: cada ação tem o seu
 * esquema e a sua consulta, e nenhuma aceita SQL ou nome de função vindo da tela.
 * Tempo real: o Agilliza não mantém conexão de escuta por pessoa; a tela consulta a
 * diferença (`chat.mensagens_desde`, `chat.avisos`) a cada poucos segundos enquanto está
 * aberta — leve (só o que mudou) e sem conexão presa no servidor.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CanalChat } from "./pessoa.server";

type Tx = {
  consultar<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  uma<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
};

const ID = z.string().uuid();
const CANAL = z.enum(["equipe", "cliente"]);
const ARROBA = z
  .string()
  .trim()
  .max(40)
  .transform((s) => s.replace(/^@+/, "").toLowerCase());

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
/** O que volta para a tela é JSON puro (sem Date/undefined): a resposta do banco já é jsonb. */
const comoJson = (x: unknown): Json => (x === undefined ? null : (JSON.parse(JSON.stringify(x)) as Json));

type Anexo = { id: string; url?: string | null };
type ComAnexos = { anexos?: Anexo[]; foto_midia_id?: string | null };

/** Sela os anexos (e a foto do grupo) — a mídia é relida sob a RLS de quem pede. */
async function selar<T extends ComAnexos>(tx: Tx, itens: T[]): Promise<(T & { foto_url?: string | null })[]> {
  const ids = itens.flatMap((m) => [...(m.anexos ?? []).map((a) => a.id), m.foto_midia_id ?? null]).filter(Boolean) as string[];
  if (ids.length === 0) return itens.map((m) => ({ ...m, foto_url: null }));
  const { liberarMidias } = await import("@/lib/plataforma/midias.server");
  const mapa = await liberarMidias(tx, ids);
  return itens.map((m) => ({
    ...m,
    anexos: (m.anexos ?? []).map((a) => ({ ...a, url: mapa[a.id]?.url ?? null })),
    foto_url: m.foto_midia_id ? (mapa[m.foto_midia_id]?.url ?? null) : null,
  }));
}

const um = async <T>(tx: Tx, sql: string, params: unknown[] = []) => (await tx.uma<{ j: T }>(sql, params))?.j ?? null;

/** Cada ação: esquema dos argumentos e o que roda dentro da transação da pessoa. */
const ACOES = {
  listar: {
    args: z.object({ arquivadas: z.boolean().default(false), busca: z.string().max(80).default("") }),
    rodar: async (tx: Tx, a: { arquivadas: boolean; busca: string }) => {
      const conversas = (await um<ComAnexos[]>(tx, "select chat.minhas_conversas($1, $2) as j", [a.arquivadas, a.busca])) ?? [];
      const resumo = await um(tx, "select chat.resumo() as j");
      return { conversas: await selar(tx, conversas), resumo };
    },
  },
  carregar: {
    args: z.object({ conversaId: ID, antes: ID.nullable().optional() }),
    rodar: async (tx: Tx, a: { conversaId: string; antes?: string | null }) => {
      const p = await um<{ conversa: ComAnexos; mensagens: ComAnexos[]; tem_mais: boolean }>(
        tx,
        "select chat.mensagens_da_conversa($1, $2, 40) as j",
        [a.conversaId, a.antes ?? null],
      );
      if (!p) throw new Error("Conversa não encontrada.");
      const [conversa] = await selar(tx, [p.conversa]);
      return { ...p, conversa, mensagens: await selar(tx, p.mensagens) };
    },
  },
  desde: {
    args: z.object({ conversaId: ID, desde: z.string().datetime({ offset: true }) }),
    rodar: async (tx: Tx, a: { conversaId: string; desde: string }) =>
      selar(tx, (await um<ComAnexos[]>(tx, "select chat.mensagens_desde($1, $2) as j", [a.conversaId, a.desde])) ?? []),
  },
  unica: {
    args: z.object({ mensagemId: ID }),
    rodar: async (tx: Tx, a: { mensagemId: string }) => {
      const m = await um<ComAnexos>(tx, "select chat.mensagem_unica($1) as j", [a.mensagemId]);
      return m ? (await selar(tx, [m]))[0] : null;
    },
  },
  extra: {
    args: z.object({ conversaId: ID }),
    rodar: async (tx: Tx, a: { conversaId: string }) => {
      const e = await um<ComAnexos>(tx, "select chat.conversa_extra($1) as j", [a.conversaId]);
      return e ? (await selar(tx, [e]))[0] : null;
    },
  },
  enviar: {
    args: z.object({
      conversaId: ID,
      corpo: z.string().max(4000),
      anexos: z.array(z.object({ id: ID, largura: z.number().int().min(1).max(20000).optional(), altura: z.number().int().min(1).max(20000).optional() })).max(10).default([]),
      duracaoMs: z.number().int().min(1).max(900000).nullable().optional(),
      respondeA: ID.nullable().optional(),
      chave: ID.optional(),
    }),
    rodar: async (tx: Tx, a: { conversaId: string; corpo: string; anexos: unknown[]; duracaoMs?: number | null; respondeA?: string | null; chave?: string }) =>
      (
        await tx.uma<{ id: string }>("select chat.enviar_mensagem($1, $2, $3::jsonb, $4, $5, $6) as id", [
          a.conversaId,
          a.corpo.trim(),
          JSON.stringify(a.anexos),
          a.duracaoMs ?? null,
          a.respondeA ?? null,
          a.chave ?? null,
        ])
      )?.id,
  },
  editar: {
    args: z.object({ mensagemId: ID, corpo: z.string().max(4000) }),
    rodar: async (tx: Tx, a: { mensagemId: string; corpo: string }) => void (await tx.consultar("select chat.editar_mensagem($1, $2)", [a.mensagemId, a.corpo])),
  },
  apagar: {
    args: z.object({ mensagemId: ID, paraTodos: z.boolean() }),
    rodar: async (tx: Tx, a: { mensagemId: string; paraTodos: boolean }) =>
      void (await tx.consultar("select chat.apagar_mensagem($1, $2)", [a.mensagemId, a.paraTodos])),
  },
  reagir: {
    args: z.object({ mensagemId: ID, emoji: z.string().min(1).max(16) }),
    rodar: async (tx: Tx, a: { mensagemId: string; emoji: string }) => void (await tx.consultar("select chat.reagir_mensagem($1, $2)", [a.mensagemId, a.emoji])),
  },
  encaminhar: {
    args: z.object({ mensagemId: ID, destinos: z.array(ID).min(1).max(5) }),
    rodar: async (tx: Tx, a: { mensagemId: string; destinos: string[] }) =>
      (await tx.uma<{ n: number }>("select chat.encaminhar_mensagem($1, $2::uuid[]) as n", [a.mensagemId, a.destinos]))?.n ?? 0,
  },
  fixar: {
    args: z.object({ mensagemId: ID, fixar: z.boolean() }),
    rodar: async (tx: Tx, a: { mensagemId: string; fixar: boolean }) => void (await tx.consultar("select chat.fixar_mensagem($1, $2)", [a.mensagemId, a.fixar])),
  },
  marcarLida: {
    args: z.object({ conversaId: ID }),
    rodar: async (tx: Tx, a: { conversaId: string }) => void (await tx.consultar("select chat.marcar_lida($1)", [a.conversaId])),
  },
  marcarNaoLida: {
    args: z.object({ conversaId: ID }),
    rodar: async (tx: Tx, a: { conversaId: string }) => void (await tx.consultar("select chat.marcar_nao_lida($1)", [a.conversaId])),
  },
  marcarEntregues: {
    args: z.object({}),
    rodar: async (tx: Tx) => void (await tx.consultar("select chat.marcar_entregues()")),
  },
  presenca: {
    args: z.object({}),
    rodar: async (tx: Tx) => void (await tx.consultar("select ecossistema.presenca_chat()")),
  },
  digitando: {
    args: z.object({ conversaId: ID }),
    rodar: async (tx: Tx, a: { conversaId: string }) => void (await tx.consultar("select chat.avisar_digitando($1)", [a.conversaId])),
  },
  preferencia: {
    args: z.object({
      conversaId: ID,
      acao: z.enum(["fixar", "desafixar", "arquivar", "desarquivar", "silenciar", "reativar_som", "limpar"]),
      horas: z.number().min(1).max(24 * 365).nullable().optional(),
    }),
    rodar: async (tx: Tx, a: { conversaId: string; acao: string; horas?: number | null }) => {
      const ate =
        a.acao === "silenciar" ? (a.horas == null ? "infinity" : new Date(Date.now() + a.horas * 3_600_000).toISOString()) : null;
      await tx.consultar("select chat.preferencia($1, $2, $3::timestamptz)", [a.conversaId, a.acao, ate]);
    },
  },
  buscarNaConversa: {
    args: z.object({ conversaId: ID, termo: z.string().max(80) }),
    rodar: async (tx: Tx, a: { conversaId: string; termo: string }) => (await um(tx, "select chat.buscar_na_conversa($1, $2) as j", [a.conversaId, a.termo])) ?? [],
  },
  buscarGlobal: {
    args: z.object({ termo: z.string().max(80) }),
    rodar: async (tx: Tx, a: { termo: string }) => (await um(tx, "select chat.buscar_global($1) as j", [a.termo])) ?? [],
  },
  contatos: {
    args: z.object({ busca: z.string().max(80).default("") }),
    rodar: async (tx: Tx, a: { busca: string }) => (await um(tx, "select chat.contatos_universais($1) as j", [a.busca.trim() || null])) ?? [],
  },
  localizarArroba: {
    args: z.object({ arroba: ARROBA }),
    rodar: async (tx: Tx, a: { arroba: string }) => um(tx, "select chat.localizar_por_arroba($1) as j", [a.arroba]),
  },
  abrirCom: {
    args: z.object({ usuarioId: ID.nullable().optional(), clienteAgillizaId: ID.nullable().optional() }),
    rodar: async (tx: Tx, a: { usuarioId?: string | null; clienteAgillizaId?: string | null }) => {
      if (a.usuarioId) return (await tx.uma<{ id: string }>("select chat.abrir_conversa_com($1) as id", [a.usuarioId]))?.id;
      if (a.clienteAgillizaId)
        return (await tx.uma<{ id: string }>("select chat.abrir_com_cliente_agilliza($1) as id", [a.clienteAgillizaId]))?.id;
      throw new Error("Escolha com quem conversar.");
    },
  },
  abrirPorArroba: {
    args: z.object({ arroba: ARROBA }),
    // 0422 (Agilliza Tech): @ inexistente/bloqueado volta nulo, SEM erro — um erro aqui desfaria a
    // transação e, com ela, o registro da busca no limite (enumeração de @). A mensagem sai depois.
    rodar: async (tx: Tx, a: { arroba: string }) =>
      (await tx.uma<{ id: string | null }>("select chat.abrir_por_arroba($1) as id", [a.arroba]))?.id ?? null,
  },
  pedidos: {
    args: z.object({}),
    rodar: async (tx: Tx) => (await um(tx, "select chat.pedidos_de_mensagem() as j")) ?? [],
  },
  responderPedido: {
    args: z.object({ conversaId: ID, acao: z.enum(["aceitar", "recusar", "bloquear"]) }),
    rodar: async (tx: Tx, a: { conversaId: string; acao: string }) =>
      void (await tx.consultar("select chat.responder_pedido($1, $2)", [a.conversaId, a.acao])),
  },
  criarGrupo: {
    args: z.object({ titulo: z.string().trim().min(1).max(80), usuarios: z.array(ID).min(1).max(49) }),
    rodar: async (tx: Tx, a: { titulo: string; usuarios: string[] }) =>
      (await tx.uma<{ id: string }>("select chat.criar_grupo_universal($1, $2::uuid[]) as id", [a.titulo, a.usuarios]))?.id,
  },
  participantes: {
    args: z.object({ conversaId: ID }),
    rodar: async (tx: Tx, a: { conversaId: string }) => (await um(tx, "select chat.participantes_da_conversa($1) as j", [a.conversaId])) ?? [],
  },
  adicionar: {
    args: z.object({ conversaId: ID, usuarios: z.array(ID).min(1).max(49) }),
    rodar: async (tx: Tx, a: { conversaId: string; usuarios: string[] }) =>
      (await tx.uma<{ n: number }>("select chat.adicionar_ao_grupo($1, $2::uuid[]) as n", [a.conversaId, a.usuarios]))?.n ?? 0,
  },
  remover: {
    args: z.object({ conversaId: ID, usuarioId: ID.nullable() }),
    rodar: async (tx: Tx, a: { conversaId: string; usuarioId: string | null }) =>
      void (await tx.consultar("select chat.sair_do_grupo($1, $2)", [a.conversaId, a.usuarioId])),
  },
  renomear: {
    args: z.object({ conversaId: ID, titulo: z.string().trim().min(1).max(80) }),
    rodar: async (tx: Tx, a: { conversaId: string; titulo: string }) => void (await tx.consultar("select chat.renomear_grupo($1, $2)", [a.conversaId, a.titulo])),
  },
  definirAdmin: {
    args: z.object({ conversaId: ID, usuarioId: ID, admin: z.boolean() }),
    rodar: async (tx: Tx, a: { conversaId: string; usuarioId: string; admin: boolean }) =>
      void (await tx.consultar("select chat.definir_admin($1, $2, $3)", [a.conversaId, a.usuarioId, a.admin])),
  },
  fotoGrupo: {
    args: z.object({ conversaId: ID, midiaId: ID.nullable() }),
    rodar: async (tx: Tx, a: { conversaId: string; midiaId: string | null }) =>
      void (await tx.consultar("select chat.foto_do_grupo($1, $2)", [a.conversaId, a.midiaId])),
  },
  leituras: {
    args: z.object({ mensagemId: ID }),
    rodar: async (tx: Tx, a: { mensagemId: string }) => (await um(tx, "select chat.leituras_da_mensagem($1) as j", [a.mensagemId])) ?? [],
  },
  bloquear: {
    args: z.object({ usuarioId: ID }),
    rodar: async (tx: Tx, a: { usuarioId: string }) => void (await tx.consultar("select chat.bloquear($1)", [a.usuarioId])),
  },
  desbloquear: {
    args: z.object({ usuarioId: ID }),
    rodar: async (tx: Tx, a: { usuarioId: string }) => void (await tx.consultar("select chat.desbloquear($1)", [a.usuarioId])),
  },
  bloqueados: {
    args: z.object({}),
    rodar: async (tx: Tx) => (await um(tx, "select chat.meus_bloqueados() as j")) ?? [],
  },
  denunciar: {
    args: z.object({
      conversaId: ID.nullable(),
      mensagemId: ID.nullable(),
      motivo: z.enum(["spam", "assedio", "golpe", "ofensa", "perfil_falso", "conteudo_improprio", "outro"]),
      detalhe: z.string().max(1000).optional(),
      bloquear: z.boolean().optional(),
    }),
    rodar: async (tx: Tx, a: { conversaId: string | null; mensagemId: string | null; motivo: string; detalhe?: string; bloquear?: boolean }) =>
      void (await tx.consultar("select chat.denunciar($1, $2, $3, $4, $5)", [
        a.conversaId,
        a.mensagemId,
        a.motivo,
        a.detalhe?.trim() || null,
        Boolean(a.bloquear),
      ])),
  },
  preferencias: {
    args: z.object({}),
    rodar: async (tx: Tx) => um(tx, "select chat.minhas_preferencias() as j"),
  },
  salvarPreferencias: {
    args: z.object({ ocultar_presenca: z.boolean().optional(), som: z.boolean().optional(), aviso_flutuante: z.boolean().optional() }),
    rodar: async (tx: Tx, a: Record<string, boolean | undefined>) =>
      um(tx, "select chat.salvar_preferencias($1::jsonb) as j", [JSON.stringify(Object.fromEntries(Object.entries(a).filter(([, v]) => typeof v === "boolean")))]),
  },
  meuArroba: {
    args: z.object({}),
    rodar: async (tx: Tx) => um(tx, "select acesso.meu_arroba() as j"),
  },
  arrobaDisponivel: {
    args: z.object({ arroba: ARROBA }),
    rodar: async (tx: Tx, a: { arroba: string }) => um(tx, "select acesso.arroba_disponivel($1) as j", [a.arroba]),
  },
  trocarArroba: {
    args: z.object({ arroba: ARROBA }),
    rodar: async (tx: Tx, a: { arroba: string }) => um(tx, "select acesso.trocar_arroba($1) as j", [a.arroba]),
  },
  avisos: {
    args: z.object({ desde: z.string().datetime({ offset: true }).nullable() }),
    rodar: async (tx: Tx, a: { desde: string | null }) => um(tx, "select chat.avisos($1::timestamptz) as j", [a.desde]),
  },
  ocultarAviso: {
    args: z.object({ conversas: z.array(ID).max(50) }),
    rodar: async (tx: Tx, a: { conversas: string[] }) =>
      void (a.conversas.length && (await tx.consultar("select chat.ocultar_aviso($1::uuid[])", [a.conversas]))),
  },
  /** Anexo do chat antigo do Agilliza: a mensagem é relida pela participação; só os dois baldes do chat antigo. */
  anexoAntigo: {
    args: z.object({ mensagemId: ID }),
    rodar: async (tx: Tx, a: { mensagemId: string }) => {
      const m = await um<{ legado?: { anexo?: { bucket?: string; caminho?: string } } }>(tx, "select chat.mensagem_unica($1) as j", [a.mensagemId]);
      const anexo = m?.legado?.anexo;
      const caminho = anexo?.caminho ?? "";
      if (!anexo || !["cliente-documentos", "chat-anexos"].includes(anexo.bucket ?? "") || !caminho || caminho.includes("..") || /^https?:/i.test(caminho)) {
        throw new Error("Este anexo não está mais disponível.");
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin.storage.from(anexo.bucket!).createSignedUrl(caminho, 600);
      if (error || !data?.signedUrl) throw new Error("Este anexo não está mais disponível.");
      return data.signedUrl;
    },
  },
  previaLink: {
    args: z.object({ url: z.string().max(2000) }),
    rodar: async (_tx: Tx, a: { url: string }) => {
      const { buscarPreviaLink } = await import("./previa-link.server");
      return buscarPreviaLink(a.url);
    },
  },
} as const;

export type AcaoChat = keyof typeof ACOES;

/** Ações que não precisam da transação do banco (só a identidade). */
const SEM_BANCO = new Set<AcaoChat>(["previaLink"]);
/** O @ é de toda pessoa do Agilliza (C01), mesmo de quem não usa o chat. */
const SO_ARROBA = new Set<AcaoChat>(["meuArroba", "arrobaDisponivel", "trocarArroba"]);
/**
 * eco-aud: ações que só leem ou cuidam da própria pessoa (ler, marcar lida, bloquear, denunciar,
 * preferências) bastam "Ver conversas"; as que falam com alguém exigem "Enviar mensagens"
 * (crm.chat › create). Ação nova entra numa das listas (o teste confere).
 */
export const ACOES_DE_LEITURA = new Set<AcaoChat>([
  "listar", "carregar", "desde", "unica", "extra", "marcarLida", "marcarNaoLida", "marcarEntregues", "presenca",
  "preferencia", "buscarNaConversa", "buscarGlobal", "contatos", "localizarArroba", "pedidos", "participantes",
  "leituras", "bloquear", "desbloquear", "bloqueados", "denunciar", "preferencias", "salvarPreferencias",
  "avisos", "ocultarAviso", "anexoAntigo", "previaLink",
]);
export const ACOES_DE_ESCRITA = new Set<AcaoChat>([
  "enviar", "editar", "apagar", "reagir", "encaminhar", "fixar", "digitando", "abrirCom", "abrirPorArroba",
  "responderPedido", "criarGrupo", "adicionar", "remover", "renomear", "definirAdmin", "fotoGrupo",
]);
/** Permissão do chat que a ação exige (false = só o @, que é de toda pessoa). */
export function permissaoDaAcao(acao: AcaoChat): false | "view" | "create" {
  if (SO_ARROBA.has(acao)) return false;
  return ACOES_DE_ESCRITA.has(acao) ? "create" : "view";
}

export const chatAcao = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({ canal: CANAL, acao: z.string().refine((a): a is AcaoChat => a in ACOES, "Ação inválida."), args: z.unknown() })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true; dados: Json } | { ok: false; mensagem: string }> => {
    try {
      const acao = ACOES[data.acao as AcaoChat];
      const args = acao.args.parse(data.args ?? {});
      const { pessoaDoChat } = await import("./pessoa.server");
      const pessoa = await pessoaDoChat(data.canal as CanalChat, permissaoDaAcao(data.acao as AcaoChat));
      if (data.acao === "previaLink") {
        // Auditoria rodada 2: a busca que não está no cache passa pelo limite da pessoa (no banco).
        const { buscarPreviaLink } = await import("./previa-link.server");
        const { comChatAgilliza } = await import("@/lib/plataforma/ponte.server");
        const dados = await buscarPreviaLink((args as { url: string }).url, () =>
          comChatAgilliza(pessoa, (tx) => tx.consultar("select chat.limite_previa_link()")),
        );
        return { ok: true, dados: comoJson(dados) };
      }
      if (SEM_BANCO.has(data.acao as AcaoChat)) {
        return { ok: true, dados: comoJson(await (acao.rodar as (tx: Tx, a: unknown) => Promise<unknown>)(null as never, args)) };
      }
      const { comChatAgilliza } = await import("@/lib/plataforma/ponte.server");
      const dados = await comChatAgilliza(pessoa, async (tx) => {
        // Primeira abertura depois da implantação: traz o histórico do chat antigo (idempotente,
        // no máximo uma conferência a cada 10 minutos — a função do banco controla).
        // Num ponto de salvamento: se a importação falhar, a lista sai do mesmo jeito.
        if (data.acao === "listar") {
          await tx.consultar("savepoint chat_historico");
          try {
            await tx.consultar("select chat.importar_historico_agilliza_se_preciso()");
            await tx.consultar("release savepoint chat_historico");
          } catch (e) {
            console.error("[chat] importar histórico", (e as Error)?.message);
            await tx.consultar("rollback to savepoint chat_historico");
          }
        }
        return (acao.rodar as (tx: Tx, a: unknown) => Promise<unknown>)(tx, args);
      });
      if (data.acao === "abrirPorArroba" && !dados) return { ok: false, mensagem: "Ninguém com este @." };
      return { ok: true, dados: comoJson(dados) };
    } catch (e) {
      if (e instanceof z.ZodError) return { ok: false, mensagem: "Algum dado chegou em formato inválido." };
      return { ok: false, mensagem: e instanceof Error && e.message ? e.message : "Não foi possível concluir." };
    }
  });

/* ----------------------------------------------------------- arquivos --- */

const TETO_BYTES = 16 * 1024 * 1024;
const MIMES = new Set([
  "image/jpeg", "image/png", "image/webp", "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet", "text/plain", "text/csv", "audio/webm", "audio/ogg", "audio/mp4",
  "audio/mpeg", "video/mp4", "video/webm", "video/quicktime",
]);

/** O arquivo é o que diz ser? (primeiros bytes) — a mesma conferência da rota do Tech. */
export function confereConteudo(b: Buffer, mime: string): boolean {
  const ini = (bytes: number[]) => bytes.every((x, i) => b[i] === x);
  switch (mime) {
    case "image/jpeg":
      return ini([0xff, 0xd8, 0xff]);
    case "image/png":
      return ini([0x89, 0x50, 0x4e, 0x47]);
    case "image/webp":
      return b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP";
    case "application/pdf":
      return b.toString("latin1", 0, 5) === "%PDF-";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.oasis.opendocument.text":
    case "application/vnd.oasis.opendocument.spreadsheet":
      return ini([0x50, 0x4b, 0x03, 0x04]);
    case "application/msword":
    case "application/vnd.ms-excel":
      return ini([0xd0, 0xcf, 0x11, 0xe0]);
    case "audio/webm":
    case "video/webm":
      return ini([0x1a, 0x45, 0xdf, 0xa3]);
    case "audio/ogg":
      return b.toString("latin1", 0, 4) === "OggS";
    case "audio/mp4":
      return b.toString("latin1", 4, 8) === "ftyp";
    case "audio/mpeg":
      return ini([0x49, 0x44, 0x33]) || (b[0] === 0xff && ((b[1] ?? 0) & 0xe0) === 0xe0);
    case "video/mp4":
    case "video/quicktime":
      return ["ftyp", "moov", "wide", "mdat", "free"].includes(b.toString("latin1", 4, 8));
    case "text/plain":
    case "text/csv":
      return !b.subarray(0, 4096).includes(0);
    default:
      return false;
  }
}

function lerArquivo(d: unknown): { canal: CanalChat; conversaId: string; arquivo: File } {
  if (!(d instanceof FormData)) throw new Error("Envie o arquivo.");
  const arquivo = d.get("arquivo");
  const canal = CANAL.parse(String(d.get("canal") ?? ""));
  const conversaId = ID.parse(String(d.get("conversa") ?? ""));
  if (!(arquivo instanceof File) || arquivo.size === 0) throw new Error("Escolha um arquivo.");
  return { canal, conversaId, arquivo };
}

/** Sobe um anexo para a conversa: confere participação, tipo, tamanho e conteúdo; registra no banco. */
export const chatEnviarArquivo = createServerFn({ method: "POST" })
  .validator(lerArquivo)
  .handler(async ({ data }) => {
    const { arquivo, conversaId } = data;
    const mime = (arquivo.type || "").split(";")[0]!.trim().toLowerCase();
    if (!MIMES.has(mime)) throw new Error("Tipo não aceito. Envie foto, vídeo, PDF, Word, Excel, texto ou áudio.");
    if (arquivo.size > TETO_BYTES) throw new Error("Arquivo acima de 16 MB.");
    const conteudo = Buffer.from(await arquivo.arrayBuffer());
    if (!confereConteudo(conteudo, mime)) throw new Error("O arquivo não é o que diz ser. Exporte de novo e tente outra vez.");
    const nome = arquivo.name.slice(0, 200) || "arquivo";
    const { pessoaDoChat } = await import("./pessoa.server");
    const pessoa = await pessoaDoChat(data.canal, "create");
    const m = await import("@/lib/plataforma/midias.server");
    const { comChatAgilliza } = await import("@/lib/plataforma/ponte.server");
    let guardado: { chave: string; bytes: number; sha256: string } | null = null;
    try {
      return await comChatAgilliza(pessoa, async (tx) => {
        const p = await tx.uma<{ ok: boolean; t: string | null }>(
          "select chat._participo($1) as ok, coalesce(seguranca.auth_tenant_ativo(), (select tenant_id from chat.conversas where id = $1)) as t",
          [conversaId],
        );
        if (!p?.ok) throw new Error("Sem acesso a esta conversa.");
        guardado = await m.guardarNoCorretor({ conteudo, mime, nome, pasta: `${p.t ?? "sem-conta"}/conversa` });
        const r = await tx.uma<{ id: string }>("select chat.registrar_anexo($1, $2, $3, $4, $5, $6) as id", [
          conversaId,
          guardado.chave,
          nome,
          mime,
          guardado.bytes,
          guardado.sha256,
        ]);
        if (!r?.id) throw new Error("Não foi possível registrar o arquivo.");
        const lib = await m.liberarMidias(tx, [r.id]);
        return { id: r.id, nome, mime, tamanho: guardado.bytes, url: lib[r.id]?.url ?? null };
      });
    } catch (e) {
      const g = guardado as { chave: string } | null;
      if (g) await m.apagarNoCorretor(g.chave);
      throw e;
    }
  });
