/**
 * Adaptador do chat universal no Agilliza: liga a tela portável (`components/chat-universal`,
 * a mesma do Agilliza Tech) às server functions do chat pela ponte, no canal da pessoa
 * (equipe, parceiro ou cliente do portal).
 */
import type { AnexoChat, ApiChat, Resposta } from "@/components/chat-universal/tipos";
import { chatAcao, chatEnviarArquivo, type AcaoChat } from "./chat.functions";
import type { CanalChat } from "./pessoa.server";

const cache = new Map<CanalChat, ApiChat>();

export function apiChatAgilliza(canal: CanalChat): ApiChat {
  const existente = cache.get(canal);
  if (existente) return existente;

  async function chamar<T>(acao: AcaoChat, args: Record<string, unknown> = {}): Promise<Resposta<T>> {
    try {
      const r = (await chatAcao({ data: { canal, acao, args } })) as { ok: true; dados: unknown } | { ok: false; mensagem: string };
      return r.ok ? { ok: true, dados: r.dados as T } : { ok: false, mensagem: r.mensagem };
    } catch (e) {
      return { ok: false, mensagem: e instanceof Error && e.message ? e.message : "Sem conexão. Tente de novo." };
    }
  }
  const sem = async (acao: AcaoChat, args: Record<string, unknown> = {}) => {
    await chamar(acao, args);
  };

  const api: ApiChat = {
    listar: (arquivadas, busca) => chamar("listar", { arquivadas, busca }),
    carregar: (conversaId, antes) => chamar("carregar", { conversaId, antes: antes ?? null }),
    desde: (conversaId, desde) => chamar("desde", { conversaId, desde }),
    unica: (mensagemId) => chamar("unica", { mensagemId }),
    extra: (conversaId) => chamar("extra", { conversaId }),
    enviar: (conversaId, corpo, o) =>
      chamar("enviar", {
        conversaId,
        corpo,
        anexos: o.anexos ?? [],
        duracaoMs: o.duracaoMs ? Math.round(o.duracaoMs) : null,
        respondeA: o.respondeA ?? null,
        chave: o.chave,
      }),
    editar: (mensagemId, corpo) => chamar("editar", { mensagemId, corpo }),
    apagar: (mensagemId, paraTodos) => chamar("apagar", { mensagemId, paraTodos }),
    reagir: (mensagemId, emoji) => chamar("reagir", { mensagemId, emoji }),
    encaminhar: (mensagemId, destinos) => chamar("encaminhar", { mensagemId, destinos }),
    fixar: (mensagemId, fixar) => chamar("fixar", { mensagemId, fixar }),
    marcarLida: (conversaId) => chamar("marcarLida", { conversaId }),
    marcarNaoLida: (conversaId) => chamar("marcarNaoLida", { conversaId }),
    marcarEntregues: () => sem("marcarEntregues"),
    presenca: () => sem("presenca"),
    digitando: (conversaId) => sem("digitando", { conversaId }),
    preferencia: (conversaId, acao, horas) => chamar("preferencia", { conversaId, acao, horas: horas ?? null }),
    buscarNaConversa: (conversaId, termo) => chamar("buscarNaConversa", { conversaId, termo }),
    buscarGlobal: (termo) => chamar("buscarGlobal", { termo }),
    contatos: (busca) => chamar("contatos", { busca }),
    localizarArroba: (arroba) => chamar("localizarArroba", { arroba }),
    abrirCom: (alvo) => chamar("abrirCom", { usuarioId: alvo.usuarioId ?? null, clienteAgillizaId: alvo.clienteAgillizaId ?? null }),
    abrirPorArroba: (arroba) => chamar("abrirPorArroba", { arroba }),
    pedidos: () => chamar("pedidos"),
    responderPedido: (conversaId, acao) => chamar("responderPedido", { conversaId, acao }),
    criarGrupo: (titulo, usuarios) => chamar("criarGrupo", { titulo, usuarios }),
    participantes: (conversaId) => chamar("participantes", { conversaId }),
    adicionar: (conversaId, usuarios) => chamar("adicionar", { conversaId, usuarios }),
    remover: (conversaId, usuarioId) => chamar("remover", { conversaId, usuarioId }),
    renomear: (conversaId, titulo) => chamar("renomear", { conversaId, titulo }),
    definirAdmin: (conversaId, usuarioId, admin) => chamar("definirAdmin", { conversaId, usuarioId, admin }),
    fotoGrupo: (conversaId, midiaId) => chamar("fotoGrupo", { conversaId, midiaId }),
    leituras: (mensagemId) => chamar("leituras", { mensagemId }),
    bloquear: (usuarioId) => chamar("bloquear", { usuarioId }),
    desbloquear: (usuarioId) => chamar("desbloquear", { usuarioId }),
    bloqueados: () => chamar("bloqueados"),
    denunciar: (d) => chamar("denunciar", { ...d }),
    preferencias: () => chamar("preferencias"),
    salvarPreferencias: (p) => chamar("salvarPreferencias", { ...p }),
    meuArroba: () => chamar("meuArroba"),
    arrobaDisponivel: (arroba) => chamar("arrobaDisponivel", { arroba }),
    trocarArroba: (arroba) => chamar("trocarArroba", { arroba }),
    enviarArquivo: async (conversaId, arquivo, aoProgresso): Promise<AnexoChat> => {
      const f = new FormData();
      f.append("canal", canal);
      f.append("conversa", conversaId);
      f.append("arquivo", arquivo);
      aoProgresso(0.15);
      const r = await chatEnviarArquivo({ data: f });
      aoProgresso(1);
      return { id: r.id, nome: r.nome, mime: r.mime, tamanho: r.tamanho, url: r.url ?? undefined };
    },
    previaLink: (url) => chamar("previaLink", { url }),
    abrirAnexoAntigo: (mensagemId) => chamar("anexoAntigo", { mensagemId }),
    avisos: (desde) => chamar("avisos", { desde }),
    ocultarAviso: (conversas) => chamar("ocultarAviso", { conversas }),
  };
  cache.set(canal, api);
  return api;
}
