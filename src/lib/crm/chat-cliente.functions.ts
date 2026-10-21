import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { carregarReacoes, type ReacaoAgrupada } from "@/lib/chat-core/reacoes.functions";
import { exigirMesmoCorrespondente } from "@/lib/operacional/permissao-acao";
import { mascararDocumento } from "@/lib/crm/documento";

/**
 * Permissões do chat com o cliente. A conversa também aparece na Central de Conversas
 * (`operacional.chats`), que usa o mesmo componente — por isso as duas alternativas.
 * Etiquetas, SLA/lembrete, arquivamento e participantes de terceiros pedem `crm.chat` › gerir.
 */
const lerChat = () => exigirPermissao(["crm.chat", "view"], ["operacional.chats", "view"]);
const escreverChat = () => exigirPermissao(["crm.chat", "create"], ["operacional.chats", "create"]);

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

const IMG_EXT = /\.(png|jpe?g|gif|webp|bmp|heic|heif|svg)$/i;

/**
 * Anexo do chat só pode estar em `<cliente_id>/chat/<arquivo>` do próprio cliente da
 * conversa (é onde o time e o App do cliente gravam). Qualquer outro caminho do bucket
 * — documento de outro cliente, `..`, barra invertida — é recusado: a assinatura de
 * reserva roda com a chave de serviço e não pode virar porta para o bucket inteiro.
 */
export function anexoDoChatValido(clienteId: string, caminho: string | null | undefined): boolean {
  if (!caminho) return false;
  const c = caminho.trim();
  if (!c || c.includes("\\") || c.includes("\0")) return false;
  const partes = c.split("/");
  if (partes.some((p) => p === "" || p === "." || p === "..")) return false;
  return partes.length === 3 && partes[0] === clienteId && partes[1] === "chat";
}

/** Converte caminhos de storage em URLs assinadas temporárias (imagens/docs do chat).
 *
 * Usa `createSignedUrls` (plural) do Supabase Storage para gerar todas as URLs
 * em UMA chamada — evita N chamadas HTTP quando a lista tem muitas mensagens
 * com anexo, reduzindo latência do endpoint `listarChatCliente`.
 * Só assina anexos do próprio cliente da conversa (`anexoDoChatValido`).
 */
async function resolverAnexosChat<T extends { anexo_url: string | null }>(
  supabase: any,
  lista: T[],
  clienteId: string,
): Promise<(T & { anexo_nome: string | null; anexo_is_imagem: boolean })[]> {
  // Coleta caminhos internos de storage (ignora URLs http já assinadas).
  const caminhos = new Set<string>();
  for (const m of lista) {
    const u = m.anexo_url ?? null;
    if (u && !/^https?:\/\//i.test(u) && anexoDoChatValido(clienteId, u)) caminhos.add(u);
  }

  // Gera todas as signed URLs em batch (1 request). Falhas individuais viram null.
  const mapa = new Map<string, string>();
  if (caminhos.size > 0) {
    const pendentes = Array.from(caminhos);
    const { data: assinadas } = await supabase.storage
      .from("cliente-documentos")
      .createSignedUrls(pendentes, 3600);
    for (const s of (assinadas ?? []) as Array<{ path: string | null; signedUrl: string | null }>) {
      if (s.path && s.signedUrl) mapa.set(s.path, s.signedUrl);
    }
    // Fallback: se o storage negar a assinatura para o usuário (RLS de
    // storage.objects), assina no servidor para que NENHUM anexo do chat
    // deixe de ser entregue a quem já tem acesso à conversa.
    const faltando = pendentes.filter((p) => !mapa.has(p));
    if (faltando.length > 0) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: adminAssinadas } = await supabaseAdmin.storage
          .from("cliente-documentos")
          .createSignedUrls(faltando, 3600);
        for (const s of (adminAssinadas ?? []) as Array<{
          path: string | null;
          signedUrl: string | null;
        }>) {
          if (s.path && s.signedUrl) mapa.set(s.path, s.signedUrl);
        }
      } catch {
        // mantém null — o anexo aparece como indisponível
      }
    }
  }

  return lista.map((m) => {
    let anexoUrl: string | null = m.anexo_url ?? null;
    let anexoNome: string | null = null;
    if (anexoUrl && !/^https?:\/\//i.test(anexoUrl)) {
      const partes = anexoUrl.split("/");
      anexoNome = partes[partes.length - 1]?.replace(/^\d+-[0-9a-f-]+\./i, "arquivo.") ?? null;
      anexoUrl = mapa.get(anexoUrl) ?? null;
    }
    return {
      ...m,
      anexo_url: anexoUrl,
      anexo_nome: anexoNome,
      anexo_is_imagem: anexoUrl ? IMG_EXT.test(anexoUrl.split("?")[0]) : false,
    };
  });
}

export interface ConversaCliente {
  cliente_id: string;
  atendente_id: string | null;
  atendente_nome: string | null;
  /** true quando a conversa é do próprio usuário logado. */
  minha: boolean;
  /** true quando o usuário foi convidado para a thread (pode responder). */
  participo: boolean;
  nome: string;
  documento: string | null;
  etapa_codigo: string | null;
  etapa_nome: string | null;
  ultima_mensagem: string;
  ultima_em: string;
  ultimo_remetente: string;
  /** Nome de quem da equipe mandou a última mensagem (null quando foi o cliente). */
  ultimo_remetente_nome: string | null;
  /** true quando a última mensagem foi enviada pelo próprio usuário. */
  ultima_minha: boolean;
  nao_lidas: number;
}

export interface ListaConversasCliente {
  conversas: ConversaCliente[];
  /** Há conversas mais antigas além do limite pedido. */
  tem_mais: boolean;
}

/** Papel amplo (admin/correspondente) — habilita a visão supervisora de todos os atendimentos. */
async function ehGestor(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_any_role", {
    _user_id: userId,
    _roles: ["admin", "correspondente"],
  });
  return Boolean(data);
}

/** `crm.chat` › gerir (admin/correspondente passam pela própria regra do banco). */
async function podeGerirChat(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("usuario_tem_permissao", {
    _user_id: userId,
    _modulo: "crm.chat",
    _acao: "gerir",
  });
  return Boolean(data);
}

/**
 * Documento inteiro só para quem vê dados sensíveis: papel amplo ou `crm.clientes` ›
 * `pii:view` — a mesma regra de `temPii` em clientes.functions (lá ela não é exportada).
 */
async function podeVerPii(supabase: any, userId: string): Promise<boolean> {
  if (await ehGestor(supabase, userId)) return true;
  const { data } = await supabase.rpc("usuario_tem_permissao", {
    _user_id: userId,
    _modulo: "crm.clientes",
    _acao: "pii:view",
  });
  return Boolean(data);
}

function documentoVisivel(doc: string | null | undefined, pii: boolean): string | null {
  if (!doc) return null;
  return pii ? doc : mascararDocumento(doc);
}

/** O usuário é dono ou convidado da thread (cliente + atendente)? */
async function participaDaConversa(
  supabase: any,
  userId: string,
  clienteId: string,
  atendenteId: string,
): Promise<boolean> {
  if (atendenteId === userId) return true;
  const { data } = await supabase.rpc("usuario_participa_chat", {
    _uid: userId,
    _cliente_id: clienteId,
    _atendente_id: atendenteId,
  });
  return Boolean(data);
}

/** Divide uma lista de ids em lotes (o filtro `in` vai na URL do PostgREST). */
function emLotes<T>(lista: T[], tamanho = 150): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) lotes.push(lista.slice(i, i + tamanho));
  return lotes;
}

/** Função SQL ainda não criada no banco (migração pendente). */
function funcaoAusente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /could not find the function|function .* does not exist/i.test(error.message ?? "")
  );
}

interface ThreadResumo {
  cliente_id: string;
  atendente_id: string | null;
  ultima_mensagem: string;
  ultima_em: string;
  ultimo_remetente: string;
  ultimo_remetente_id: string | null;
  ultima_excluida: boolean;
  nao_lidas: number;
}

/**
 * Uma linha por conversa (cliente + atendente), da mais recente para a mais antiga.
 * Usa a função paginada do banco (`crm_chat_listar_threads`); enquanto a migração não
 * estiver aplicada, monta a partir das últimas 1.000 mensagens, como antes.
 */
async function carregarThreads(
  supabase: any,
  limite: number,
): Promise<{ threads: ThreadResumo[]; temMais: boolean }> {
  const rpc = await supabase.rpc("crm_chat_listar_threads", { _limite: limite, _antes: null });
  if (!rpc.error) {
    const linhas = (rpc.data ?? []) as any[];
    return {
      threads: linhas.map((t) => ({
        cliente_id: t.cliente_id,
        atendente_id: t.atendente_id ?? null,
        ultima_mensagem: t.ultima_mensagem ?? "",
        ultima_em: t.ultima_em,
        ultimo_remetente: t.ultimo_remetente,
        ultimo_remetente_id: t.ultimo_remetente_id ?? null,
        ultima_excluida: Boolean(t.ultima_excluida),
        nao_lidas: Number(t.nao_lidas ?? 0),
      })),
      temMais: linhas.length >= limite,
    };
  }
  if (!funcaoAusente(rpc.error)) throw new Error(rpc.error.message);

  // O PostgREST devolve no máximo 1.000 linhas por resposta (QA 19/09/2026).
  const { data: r, error } = await supabase
    .from("cliente_app_mensagens")
    .select(
      "cliente_id, atendente_id, mensagem, remetente_tipo, remetente_id, lida_em, criada_em, excluida_em",
    )
    .order("criada_em", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  const agrupado = new Map<string, ThreadResumo>();
  for (const m of (r ?? []) as any[]) {
    const chave = `${m.cliente_id}::${m.atendente_id ?? ""}`;
    let reg = agrupado.get(chave);
    if (!reg) {
      reg = {
        cliente_id: m.cliente_id,
        atendente_id: m.atendente_id ?? null,
        ultima_mensagem: m.mensagem ?? "",
        ultima_em: m.criada_em,
        ultimo_remetente: m.remetente_tipo,
        ultimo_remetente_id: m.remetente_id ?? null,
        ultima_excluida: !!m.excluida_em,
        nao_lidas: 0,
      };
      agrupado.set(chave, reg);
    }
    if (m.remetente_tipo === "cliente" && !m.lida_em) reg.nao_lidas += 1;
  }
  const threads = Array.from(agrupado.values()).slice(0, limite);
  return { threads, temMais: (r ?? []).length >= 1000 };
}

/**
 * Lista as conversas do App do Cliente. Cada conversa é individual por atendente
 * (par cliente + atendente). Por padrão retorna só as conversas do usuário
 * logado; quem gere o chat pode pedir a visão geral (ver_todos) de todos os atendentes.
 */
export const listarConversasCliente = createServerFn({ method: "GET" })
  .middleware([lerChat()])
  .inputValidator((d?: { ver_todos?: boolean; limite?: number }) =>
    z
      .object({
        ver_todos: z.boolean().optional(),
        limite: z.number().int().min(50).max(2000).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<ListaConversasCliente> => {
    const { supabase, userId } = context;
    const limite = data.limite ?? 300;

    const { threads, temMais } = await carregarThreads(supabase, limite);
    if (threads.length === 0) return { conversas: [], tem_mais: false };

    const pii = await podeVerPii(supabase, userId);

    // Filtro final por escopo de dados do cliente (RLS de clientes): nenhuma mensagem
    // do cliente fica invisível só porque foi direcionada a outro atendente.
    const idsClientes = Array.from(new Set(threads.map((t) => t.cliente_id)));
    const info = new Map<string, any>();
    for (const lote of emLotes(idsClientes)) {
      const { data: clientes, error } = await supabase
        .from("clientes")
        .select("id, nome, documento, cliente_pipeline(pipeline_stages(codigo, nome))")
        .in("id", lote);
      if (error) throw new Error(error.message);
      for (const c of clientes ?? []) info.set(c.id, c);
    }

    // Nomes dos atendentes (visão supervisora) e de quem mandou a última mensagem.
    const idsPessoas = Array.from(
      new Set(
        threads
          .flatMap((t) => [
            t.atendente_id,
            t.ultimo_remetente === "time" ? t.ultimo_remetente_id : null,
          ])
          .filter(Boolean) as string[],
      ),
    );
    const nomes = new Map<string, string>();
    for (const lote of emLotes(idsPessoas)) {
      const { data: perfis } = await supabase.from("profiles").select("id, nome").in("id", lote);
      for (const p of perfis ?? []) nomes.set(p.id, p.nome ?? "");
    }

    // Threads em que o usuário foi convidado (participante) — ele pode ler
    // E responder na mesma conversa, sem abrir uma nova.
    const participacoes = new Set<string>();
    {
      const { data: parts, error } = await supabase
        .from("crm_chat_participantes")
        .select("cliente_id, atendente_id")
        .eq("usuario_id", userId);
      if (error) throw new Error(error.message);
      for (const p of parts ?? [])
        participacoes.add(`${(p as any).cliente_id}::${(p as any).atendente_id ?? ""}`);
    }

    const lista: ConversaCliente[] = threads
      .filter((t) => info.has(t.cliente_id))
      .map((t) => {
        const c = info.get(t.cliente_id);
        const remetenteTime = t.ultimo_remetente === "time";
        return {
          cliente_id: t.cliente_id,
          atendente_id: t.atendente_id,
          atendente_nome: t.atendente_id ? (nomes.get(t.atendente_id) ?? null) : null,
          minha: t.atendente_id === userId,
          participo: participacoes.has(`${t.cliente_id}::${t.atendente_id ?? ""}`),
          nome: c?.nome ?? "Cliente",
          documento: documentoVisivel(c?.documento, pii),
          etapa_codigo: c?.cliente_pipeline?.pipeline_stages?.codigo ?? null,
          etapa_nome: c?.cliente_pipeline?.pipeline_stages?.nome ?? null,
          // Mensagem excluída não pode aparecer na prévia da lista.
          ultima_mensagem: t.ultima_excluida ? "Mensagem excluída" : t.ultima_mensagem,
          ultima_em: t.ultima_em,
          ultimo_remetente: t.ultimo_remetente,
          ultimo_remetente_nome:
            remetenteTime && t.ultimo_remetente_id
              ? nomes.get(t.ultimo_remetente_id) || null
              : null,
          ultima_minha: remetenteTime && t.ultimo_remetente_id === userId,
          nao_lidas: t.nao_lidas,
        };
      })
      .sort((a, b) => (a.ultima_em < b.ultima_em ? 1 : -1));

    // Visão supervisora: mostra cada thread (por atendente) separadamente.
    if (
      data.ver_todos &&
      ((await ehGestor(supabase, userId)) || (await podeGerirChat(supabase, userId)))
    ) {
      return { conversas: lista, tem_mais: temMais };
    }

    // Visão normal: uma única conversa contínua por cliente. Prioriza a
    // thread do próprio usuário; depois aquelas em que ele foi incluído;
    // por fim a mais recente com acesso pelo escopo de dados.
    const peso = (c: ConversaCliente) => (c.minha ? 3 : c.participo ? 2 : 1);
    const porCliente = new Map<string, ConversaCliente>();
    for (const c of lista) {
      const atual = porCliente.get(c.cliente_id);
      if (!atual || peso(c) > peso(atual)) porCliente.set(c.cliente_id, c);
    }
    // Não lidas: soma das threads que o usuário atende (dono ou convidado) — são as que
    // ele zera ao abrir. Sem nenhuma delas, vale a da thread exibida.
    const naoLidasAtendidas = new Map<string, number>();
    for (const c of lista) {
      if (!c.minha && !c.participo) continue;
      naoLidasAtendidas.set(c.cliente_id, (naoLidasAtendidas.get(c.cliente_id) ?? 0) + c.nao_lidas);
    }
    const conversas = Array.from(porCliente.values())
      .map((c) => ({ ...c, nao_lidas: naoLidasAtendidas.get(c.cliente_id) ?? c.nao_lidas }))
      .sort((a, b) => (a.ultima_em < b.ultima_em ? 1 : -1));
    return { conversas, tem_mais: temMais };
  });

export interface ClienteApp {
  cliente_id: string;
  nome: string;
  documento: string | null;
  etapa_nome: string | null;
  logou: boolean;
}

/**
 * Busca clientes com o App habilitado (portal_acesso_ativo) para iniciar uma
 * conversa, mesmo que ainda não tenham logado ou trocado mensagens.
 */
export const buscarClientesApp = createServerFn({ method: "GET" })
  .middleware([lerChat()])
  .inputValidator((d: { q?: string }) =>
    z.object({ q: z.string().trim().max(120).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<ClienteApp[]> => {
    const { supabase, userId } = context;
    let query = supabase
      .from("clientes")
      .select("id, nome, documento, cliente_pipeline(pipeline_stages(nome))")
      .is("deleted_at", null)
      .eq("portal_acesso_ativo", true)
      .order("nome", { ascending: true })
      .limit(50);

    // Mesmo tratamento da busca global (busca.functions): o termo vai entre aspas no
    // filtro `or` do PostgREST — vírgula ou parêntese quebravam a consulta e aspas,
    // barra e `%` saem do termo.
    const limpo = (data.q ?? "").trim().replace(/["\\%]/g, "");
    if (limpo) {
      const like = `%${limpo}%`;
      query = query.or(`nome.ilike."${like}",documento.ilike."${like}"`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const clientes = rows ?? [];
    const ids = clientes.map((c: any) => c.id);
    const logados = new Set<string>();
    if (ids.length > 0) {
      const { data: acessos } = await supabase
        .from("cliente_app_acessos")
        .select("cliente_id")
        .in("cliente_id", ids);
      for (const a of acessos ?? []) logados.add((a as any).cliente_id);
    }
    const pii = clientes.length > 0 ? await podeVerPii(supabase, userId) : false;

    return clientes.map((c: any) => ({
      cliente_id: c.id,
      nome: c.nome ?? "Cliente",
      documento: documentoVisivel(c.documento, pii),
      etapa_nome: c.cliente_pipeline?.pipeline_stages?.nome ?? null,
      logou: logados.has(c.id),
    }));
  });

/** Quantas mensagens a conversa abre (as mais recentes). */
const LIMITE_MENSAGENS = 500;

export const listarChatCliente = createServerFn({ method: "GET" })
  .middleware([lerChat()])
  .inputValidator((d: { cliente_id: string; atendente_id?: string }) =>
    z
      .object({ cliente_id: z.string().uuid(), atendente_id: z.string().uuid().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ChatMensagem[]> => {
    const { supabase, userId } = context;
    // Pode abrir a thread de outro atendente quem participa do chat, quem é
    // gestor ou quem tem acesso ao cliente pelo escopo de dados. Assim uma
    // mensagem enviada pelo cliente nunca fica "presa" na caixa de outro.
    let atendente = userId;
    if (data.atendente_id && data.atendente_id !== userId) {
      let permitido = await participaDaConversa(
        supabase,
        userId,
        data.cliente_id,
        data.atendente_id,
      );
      if (!permitido) {
        const { data: acesso } = await supabase.rpc("usuario_tem_acesso_cliente", {
          _user_id: userId,
          _cliente_id: data.cliente_id,
        });
        permitido = Boolean(acesso);
      }
      if (!permitido) permitido = await ehGestor(supabase, userId);
      atendente = permitido ? data.atendente_id : userId;
    }

    // As mais recentes primeiro e depois na ordem da conversa: em ordem crescente com
    // limite, conversa com mais de 500 mensagens abria só nas antigas.
    const colunas =
      "id, remetente_tipo, remetente_id, mensagem, anexo_url, lida_em, criada_em, editada_em, excluida_em, responde_a, interna";
    const { data: rows, error } = await supabase
      .from("cliente_app_mensagens")
      .select(colunas)
      .eq("cliente_id", data.cliente_id)
      .eq("atendente_id", atendente)
      .order("criada_em", { ascending: false })
      .limit(LIMITE_MENSAGENS);
    if (error) throw new Error(error.message);
    type Linha = Omit<
      ChatMensagem,
      "remetente_nome" | "anexo_nome" | "anexo_is_imagem" | "citacao"
    >;
    // Excluída não leva o texto nem o anexo para a tela.
    const limpar = (m: Linha): Linha =>
      m.excluida_em ? { ...m, mensagem: "", anexo_url: null } : m;
    const lista = ((rows ?? []) as Linha[]).reverse().map(limpar);

    // Mapa id -> mensagem (para prévia de citações/respostas). Citação de mensagem que
    // ficou fora da janela carregada é buscada à parte.
    const porId = new Map<string, Linha>();
    for (const m of lista) porId.set(m.id, m);
    const citadasFora = Array.from(
      new Set(lista.map((m) => m.responde_a).filter((id): id is string => !!id && !porId.has(id))),
    );
    if (citadasFora.length > 0) {
      const { data: antigas } = await supabase
        .from("cliente_app_mensagens")
        .select(colunas)
        .eq("cliente_id", data.cliente_id)
        .in("id", citadasFora.slice(0, 150));
      for (const m of (antigas ?? []) as Linha[]) porId.set(m.id, limpar(m));
    }

    // Nome completo dos membros da equipe que enviaram mensagens
    const idsTime = Array.from(
      new Set(
        Array.from(porId.values())
          .filter((m) => m.remetente_tipo === "time" && m.remetente_id)
          .map((m) => m.remetente_id as string),
      ),
    );
    const nomes = new Map<string, string>();
    if (idsTime.length > 0) {
      const { data: perfis } = await supabase.from("profiles").select("id, nome").in("id", idsTime);
      for (const p of perfis ?? []) nomes.set(p.id, p.nome ?? "");
    }

    // Nome do cliente para exibir como remetente das mensagens do cliente.
    let nomeCliente = "Cliente";
    {
      const { data: cli } = await supabase
        .from("clientes")
        .select("nome")
        .eq("id", data.cliente_id)
        .maybeSingle();
      if (cli?.nome && cli.nome.trim()) nomeCliente = cli.nome.trim();
    }

    function autorDe(m: Linha): string {
      if (m.remetente_tipo === "time") return nomes.get(m.remetente_id ?? "") || "Atendente";
      return nomeCliente;
    }

    const comAnexo = await resolverAnexosChat(supabase, lista, data.cliente_id);
    const reacoes = await carregarReacoes(
      supabase,
      userId,
      "cliente",
      lista.map((m) => m.id),
    );
    return comAnexo.map((m) => {
      const alvo = m.responde_a ? porId.get(m.responde_a) : null;
      return {
        ...m,
        remetente_nome:
          m.remetente_tipo === "time" ? (nomes.get(m.remetente_id ?? "") ?? null) : nomeCliente,
        citacao: alvo
          ? {
              autor: autorDe(alvo),
              texto: alvo.excluida_em ? "Mensagem excluída" : alvo.mensagem?.trim() || "Anexo",
            }
          : null,
        reacoes: reacoes.get(m.id) ?? [],
      };
    });
  });

/** Envia uma mensagem ao cliente como time e notifica o cliente no App. */
export const responderChatCliente = createServerFn({ method: "POST" })
  .middleware([escreverChat()])
  .inputValidator(
    (d: {
      cliente_id: string;
      mensagem?: string;
      anexo_path?: string;
      responde_a?: string;
      atendente_id?: string;
      interna?: boolean;
    }) =>
      z
        .object({
          cliente_id: z.string().uuid(),
          mensagem: z.string().trim().max(4000).optional(),
          anexo_path: z.string().trim().max(1000).optional(),
          responde_a: z.string().uuid().optional(),
          atendente_id: z.string().uuid().optional(),
          interna: z.boolean().optional(),
        })
        .refine((v) => (v.mensagem?.trim()?.length ?? 0) > 0 || !!v.anexo_path, {
          message: "Escreva uma mensagem ou anexe um arquivo.",
        })
        .refine((v) => !v.anexo_path || anexoDoChatValido(v.cliente_id, v.anexo_path), {
          message: "Anexo inválido para esta conversa.",
        })
        .parse(d),
  )
  .handler(async ({ data, context }): Promise<ChatMensagem> => {
    const { supabase, userId } = context;
    const nomeAnexo = data.anexo_path?.split("/").pop() ?? null;
    const msg = data.mensagem?.trim() || nomeAnexo || "Arquivo";
    const anexo = (data.anexo_path ?? null) as unknown as string;

    // Conversa de outro atendente: só quem participa (ou gestor) escreve nela — também
    // na nota interna, que antes aceitava qualquer atendente informado.
    if (data.atendente_id && data.atendente_id !== userId) {
      const pode =
        (await participaDaConversa(supabase, userId, data.cliente_id, data.atendente_id)) ||
        (await ehGestor(supabase, userId));
      if (!pode) throw new Error("Você não participa desta conversa.");
    }

    // Nota interna: fica só para o time; usa RPC dedicada (não notifica cliente).
    if (data.interna) {
      const atendente = data.atendente_id ?? userId;
      const { data: nova, error } = await supabase.rpc("portal_time_nota_interna", {
        _cid: data.cliente_id,
        _atendente: atendente,
        _msg: msg,
        _anexo: anexo,
      });
      if (error) throw new Error(error.message);
      const criada = nova as unknown as { id: string; anexo_url: string | null };
      if (data.responde_a && criada?.id) {
        await supabase
          .from("cliente_app_mensagens")
          .update({ responde_a: data.responde_a })
          .eq("id", criada.id);
      }
      const [resolvida] = await resolverAnexosChat(supabase, [criada], data.cliente_id);
      return { ...(resolvida as unknown as ChatMensagem), interna: true };
    }

    // Se a conversa é compartilhada (thread de outro atendente), publica na
    // mesma thread para que dono e participantes vejam o mesmo histórico.
    const usarThread = data.atendente_id && data.atendente_id !== userId;
    const { data: nova, error } = usarThread
      ? await supabase.rpc("portal_time_responder_thread", {
          _cid: data.cliente_id,
          _atendente: data.atendente_id!,
          _msg: msg,
          _anexo: anexo,
        })
      : await supabase.rpc("portal_time_responder", {
          _cid: data.cliente_id,
          _msg: msg,
          _anexo: anexo,
        });
    if (error) throw new Error(error.message);

    const criada = nova as unknown as { id: string; anexo_url: string | null };
    // Vincula a resposta/citação após a criação (a RPC não recebe esse campo).
    if (data.responde_a && criada?.id) {
      await supabase
        .from("cliente_app_mensagens")
        .update({ responde_a: data.responde_a })
        .eq("id", criada.id);
    }
    const [resolvida] = await resolverAnexosChat(supabase, [criada], data.cliente_id);
    return { ...(resolvida as unknown as ChatMensagem), interna: false };
  });

/** Edita o texto de uma mensagem enviada pela equipe. */
export const editarChatCliente = createServerFn({ method: "POST" })
  .middleware([escreverChat()])
  .inputValidator((d: { id: string; mensagem: string }) =>
    z.object({ id: z.string().uuid(), mensagem: z.string().trim().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Captura o estado anterior para a trilha de auditoria (LGPD/compliance).
    const { data: antes } = await supabase
      .from("cliente_app_mensagens")
      .select("id, cliente_id, mensagem")
      .eq("id", data.id)
      .eq("remetente_tipo", "time")
      .eq("remetente_id", userId)
      .is("excluida_em", null)
      .maybeSingle();
    // Cada usuário só edita as próprias mensagens. Sem linha alterada, não houve edição
    // (mensagem de colega ou já excluída) — antes a tela dizia que tinha dado certo.
    const { data: alteradas, error } = await supabase
      .from("cliente_app_mensagens")
      .update({ mensagem: data.mensagem.trim(), editada_em: new Date().toISOString() })
      .eq("id", data.id)
      .eq("remetente_tipo", "time")
      .eq("remetente_id", userId)
      .is("excluida_em", null)
      .select("id");
    if (error) throw new Error(error.message);
    if (!alteradas || alteradas.length === 0) {
      throw new Error("Só é possível editar as suas próprias mensagens.");
    }
    if (antes) {
      const { registrarAuditoria } = await import("@/lib/admin/audit.server");
      await registrarAuditoria({
        supabase,
        userId,
        correspondenteId: null,
        acao: "chat.mensagem.editar",
        entidade: "cliente_app_mensagens",
        entidadeId: data.id,
        payloadAnterior: { mensagem: (antes as any).mensagem },
        payloadNovo: { mensagem: data.mensagem.trim(), cliente_id: (antes as any).cliente_id },
      });
    }
    return { ok: true };
  });

/** Exclui (soft delete) uma mensagem enviada pela equipe. */
export const excluirChatCliente = createServerFn({ method: "POST" })
  .middleware([escreverChat()])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: antes } = await supabase
      .from("cliente_app_mensagens")
      .select("id, cliente_id, mensagem")
      .eq("id", data.id)
      .eq("remetente_tipo", "time")
      .eq("remetente_id", userId)
      .maybeSingle();
    // Cada usuário só exclui as próprias mensagens.
    const { data: alteradas, error } = await supabase
      .from("cliente_app_mensagens")
      .update({ excluida_em: new Date().toISOString() })
      .eq("id", data.id)
      .eq("remetente_tipo", "time")
      .eq("remetente_id", userId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!alteradas || alteradas.length === 0) {
      throw new Error("Só é possível excluir as suas próprias mensagens.");
    }
    if (antes) {
      const { registrarAuditoria } = await import("@/lib/admin/audit.server");
      await registrarAuditoria({
        supabase,
        userId,
        correspondenteId: null,
        acao: "chat.mensagem.excluir",
        entidade: "cliente_app_mensagens",
        entidadeId: data.id,
        payloadAnterior: {
          mensagem: (antes as any).mensagem,
          cliente_id: (antes as any).cliente_id,
        },
      });
    }
    return { ok: true };
  });

/**
 * Marca como lidas as mensagens do cliente na thread aberta. Sem `atendente_id`, é a
 * thread do próprio usuário; com ele, vale para quem participa da conversa (o convidado
 * também zera o contador) ou é gestor.
 */
export const marcarChatClienteLido = createServerFn({ method: "POST" })
  .middleware([lerChat()])
  .inputValidator((d: { cliente_id: string; atendente_id?: string }) =>
    z
      .object({ cliente_id: z.string().uuid(), atendente_id: z.string().uuid().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let atendente = userId;
    if (data.atendente_id && data.atendente_id !== userId) {
      const pode =
        (await participaDaConversa(supabase, userId, data.cliente_id, data.atendente_id)) ||
        (await ehGestor(supabase, userId));
      if (!pode) return { ok: true };
      atendente = data.atendente_id;
    }
    const { error } = await supabase
      .from("cliente_app_mensagens")
      .update({ lida_em: new Date().toISOString() })
      .eq("cliente_id", data.cliente_id)
      .eq("atendente_id", atendente)
      .eq("remetente_tipo", "cliente")
      .is("lida_em", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface ContextoChatCliente {
  cliente_id: string;
  primeiro_nome: string | null;
  numero_proposta: string | null;
  status_proposta: string | null;
  nome_banco: string | null;
  etapa_nome: string | null;
  /** Nome da empresa (correspondente) do usuário, para as respostas rápidas. */
  empresa: string | null;
}

/**
 * Contexto do cliente para respostas rápidas do chat: primeiro nome, número e
 * status da proposta mais recente, banco e etapa da esteira. Usado para
 * preencher placeholders como {primeiro_nome} e {numero_proposta}.
 */
export const obterContextoChatCliente = createServerFn({ method: "GET" })
  .middleware([lerChat()])
  .inputValidator((d: { cliente_id: string }) =>
    z.object({ cliente_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ContextoChatCliente> => {
    const { supabase } = context;
    const { data: cliente } = await supabase
      .from("clientes")
      .select(
        "id, nome, numero_cliente, correspondente_id, cliente_pipeline(pipeline_stages(nome))",
      )
      .eq("id", data.cliente_id)
      .maybeSingle();

    const { data: proposta } = await supabase
      .from("propostas")
      .select("numero_proposta, status, nome_banco")
      .eq("cliente_id", data.cliente_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fallback para clientes ainda em Simulação (sem proposta): puxa número e
    // banco da simulação mais recente para preencher as respostas rápidas.
    let simNumero: string | null = null;
    let simBanco: string | null = null;
    if (!proposta) {
      const { data: sim } = await supabase
        .from("simulacoes")
        .select("id, numero_simulacao, simulacao_bancos(nome_banco, status_banco)")
        .eq("cliente_id", data.cliente_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      simNumero = (sim as any)?.numero_simulacao ?? null;
      const bancos = ((sim as any)?.simulacao_bancos ?? []) as Array<{
        nome_banco: string | null;
      }>;
      simBanco = bancos.find((b) => b?.nome_banco)?.nome_banco ?? null;
    }

    // Nome da empresa do usuário (parâmetros da empresa), em vez de marca fixa.
    let empresa: string | null = null;
    const corr = (cliente as any)?.correspondente_id ?? null;
    if (corr) {
      const { data: param } = await supabase
        .from("parametros_globais")
        .select("nome_fantasia, nome_empresa")
        .eq("correspondente_id", corr)
        .maybeSingle();
      empresa =
        (param as any)?.nome_fantasia?.trim() || (param as any)?.nome_empresa?.trim() || null;
    }

    const nomeCompleto = (cliente as any)?.nome?.trim() ?? null;
    const primeiroNome = nomeCompleto ? nomeCompleto.split(/\s+/)[0] : null;
    // Número puxado automaticamente: proposta mais recente e, na ausência dela,
    // a simulação mais recente e, por fim, o número do cliente — assim a
    // mensagem sempre traz uma referência.
    const numeroProposta =
      (proposta as any)?.numero_proposta ?? simNumero ?? (cliente as any)?.numero_cliente ?? null;

    return {
      cliente_id: data.cliente_id,
      primeiro_nome: primeiroNome,
      numero_proposta: numeroProposta,
      status_proposta: (proposta as any)?.status ?? null,
      nome_banco: (proposta as any)?.nome_banco ?? simBanco ?? null,
      etapa_nome: (cliente as any)?.cliente_pipeline?.pipeline_stages?.nome ?? null,
      empresa,
    };
  });

export interface PainelChatCliente {
  cliente_id: string;
  nome: string | null;
  documento: string | null;
  celular: string | null;
  email: string | null;
  etapa_nome: string | null;
  etapa_codigo: string | null;
  ativo: boolean;
  responsavel_nome: string | null;
  proposta: {
    id: string;
    numero: string | null;
    status: string | null;
    banco: string | null;
    produto: string | null;
    valor: number | null;
  } | null;
}

/**
 * Dados completos do cliente para o painel lateral do chat: contato, etapa,
 * responsável e a proposta mais recente (número, banco, produto, valor, status).
 */
export const obterPainelChatCliente = createServerFn({ method: "GET" })
  .middleware([lerChat()])
  .inputValidator((d: { cliente_id: string }) =>
    z.object({ cliente_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PainelChatCliente | null> => {
    const { supabase, userId } = context;
    const { data: cliente, error } = await supabase
      .from("clientes")
      .select(
        "id, nome, documento, telefone_celular, email, ativo, portal_acesso_ativo, responsavel:profiles!clientes_responsavel_id_fkey(nome), cliente_pipeline(pipeline_stages(codigo, nome))",
      )
      .eq("id", data.cliente_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cliente) return null;

    const { data: proposta, error: erroProposta } = await supabase
      .from("propostas")
      .select("id, numero_proposta, status, nome_banco, produto, valor_financiamento")
      .eq("cliente_id", data.cliente_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (erroProposta) throw new Error(erroProposta.message);

    const pii = await podeVerPii(supabase, userId);

    return {
      cliente_id: data.cliente_id,
      nome: (cliente as any)?.nome ?? null,
      documento: documentoVisivel((cliente as any)?.documento, pii),
      celular: (cliente as any)?.telefone_celular ?? null,
      email: (cliente as any)?.email ?? null,
      etapa_nome: (cliente as any)?.cliente_pipeline?.pipeline_stages?.nome ?? null,
      etapa_codigo: (cliente as any)?.cliente_pipeline?.pipeline_stages?.codigo ?? null,
      ativo:
        Boolean((cliente as any)?.ativo ?? true) &&
        Boolean((cliente as any)?.portal_acesso_ativo ?? false),
      responsavel_nome: (cliente as any)?.responsavel?.nome ?? null,
      proposta: proposta
        ? {
            id: (proposta as any).id,
            numero: (proposta as any).numero_proposta ?? null,
            status: (proposta as any).status ?? null,
            banco: (proposta as any).nome_banco ?? null,
            produto: (proposta as any).produto ?? null,
            valor: (proposta as any).valor_financiamento ?? null,
          }
        : null,
    };
  });

export interface ParticipanteChat {
  usuario_id: string;
  nome: string;
}

/** Lista os usuários convidados para uma conversa (thread cliente + atendente). */
export const listarParticipantesChat = createServerFn({ method: "GET" })
  .middleware([lerChat()])
  .inputValidator((d: { cliente_id: string; atendente_id: string }) =>
    z.object({ cliente_id: z.string().uuid(), atendente_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ParticipanteChat[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("crm_chat_participantes")
      .select("usuario_id")
      .eq("cliente_id", data.cliente_id)
      .eq("atendente_id", data.atendente_id);
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r: any) => r.usuario_id);
    if (ids.length === 0) return [];
    const { data: perfis } = await supabase.from("profiles").select("id, nome").in("id", ids);
    const nomes = new Map<string, string>();
    for (const p of perfis ?? []) nomes.set(p.id, p.nome ?? "");
    return ids.map((id: string) => ({
      usuario_id: id,
      nome: nomes.get(id) ?? "Usuário",
    }));
  });

/**
 * Quem mexe nos participantes: dono ou convidado da conversa, gestor ou quem tem
 * `crm.chat` › gerir. A pessoa incluída e o dono da thread têm de ser da mesma empresa.
 */
async function exigirGestaoParticipantes(
  supabase: any,
  userId: string,
  alvo: { cliente_id: string; atendente_id: string; usuario_id: string },
): Promise<void> {
  const pode =
    (await participaDaConversa(supabase, userId, alvo.cliente_id, alvo.atendente_id)) ||
    (await ehGestor(supabase, userId)) ||
    (await podeGerirChat(supabase, userId));
  if (!pode) throw new Error("Você não participa desta conversa.");
  const { data: perfil, error } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const corr = (perfil as any)?.correspondente_id as string | undefined;
  if (!corr) throw new Error("Correspondente não encontrado para o usuário.");
  await exigirMesmoCorrespondente(
    supabase,
    corr,
    [alvo.usuario_id, alvo.atendente_id],
    "Só é possível incluir pessoas da sua empresa.",
  );
}

/** Adiciona um usuário da equipe à conversa, dando acesso ao histórico. */
export const adicionarParticipanteChat = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["crm.chat", "create"], ["crm.chat", "gerir"])])
  .inputValidator((d: { cliente_id: string; atendente_id: string; usuario_id: string }) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        atendente_id: z.string().uuid(),
        usuario_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await exigirGestaoParticipantes(supabase, userId, data);
    const { error } = await supabase.from("crm_chat_participantes").upsert(
      {
        cliente_id: data.cliente_id,
        atendente_id: data.atendente_id,
        usuario_id: data.usuario_id,
        criado_por: userId,
      },
      { onConflict: "cliente_id,atendente_id,usuario_id" },
    );
    if (error) throw new Error(error.message);
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: null,
      acao: "chat.participante.adicionar",
      entidade: "crm_chat_participantes",
      entidadeId: data.cliente_id,
      payloadNovo: {
        cliente_id: data.cliente_id,
        atendente_id: data.atendente_id,
        usuario_id: data.usuario_id,
      },
    });
    return { ok: true };
  });

/** Remove um usuário convidado da conversa. */
export const removerParticipanteChat = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["crm.chat", "create"], ["crm.chat", "gerir"])])
  .inputValidator((d: { cliente_id: string; atendente_id: string; usuario_id: string }) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        atendente_id: z.string().uuid(),
        usuario_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await exigirGestaoParticipantes(supabase, userId, data);
    const { data: removidos, error } = await supabase
      .from("crm_chat_participantes")
      .delete()
      .eq("cliente_id", data.cliente_id)
      .eq("atendente_id", data.atendente_id)
      .eq("usuario_id", data.usuario_id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!removidos || removidos.length === 0) {
      throw new Error("Esta pessoa já não participa da conversa.");
    }
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: null,
      acao: "chat.participante.remover",
      entidade: "crm_chat_participantes",
      entidadeId: data.cliente_id,
      payloadAnterior: {
        cliente_id: data.cliente_id,
        atendente_id: data.atendente_id,
        usuario_id: data.usuario_id,
      },
    });
    return { ok: true };
  });
