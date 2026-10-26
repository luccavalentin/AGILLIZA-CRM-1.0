"use client";

/**
 * O chat universal do ecossistema (pedido de 26/10/2026: T01, T60, C01, C02, C14).
 *
 * Uma tela só para os assinantes do Agilliza Tech e para o Agilliza correspondente: lista à
 * esquerda (Todas, Não lidas, Pedidos de mensagem, busca nas conversas e em todas as
 * mensagens), conversa à direita (no celular, uma de cada vez, em tela cheia). Tudo o que um
 * mensageiro tem — texto, emoji, foto, vídeo, áudio, documento, câmera, colar, arrastar e
 * soltar, responder, reagir, encaminhar, fixar, editar, apagar, não lida, silenciar,
 * arquivar, busca, ✓/✓✓/azul, digitando, online, grupos com foto e administradores — e o
 * que o ecossistema pede: contatos da base, @ exato para quem é de fora, pedido de mensagem,
 * bloquear e denunciar.
 *
 * Tempo real: quem hospeda passa `assinar` (no Tech, o cano /api/eventos); sem ele, a tela
 * consulta a diferença a cada `intervaloMs` enquanto está aberta (Agilliza, pela ponte).
 */
import clsx from "clsx";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowLeft,
  Ban,
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  EllipsisVertical,
  Flag,
  Inbox,
  Lock,
  MailOpen,
  MessageCircle,
  Pin,
  PinOff,
  Search,
  Settings,
  ShieldOff,
  SquarePen,
  Upload,
  Users,
  X,
} from "lucide-react";
import type {
  DesenharIcone3D,
  Achado,
  AcaoPreferencia,
  ApiChat,
  EventoChat,
  ExtraConversa,
  ItemListaConversa,
  MensagemChat,
  PaginaConversa,
  Pedido,
  ResumoConversas,
} from "./tipos";
import { Bolha, type AcoesBolha } from "./bolha";
import { Compositor, type CompositorRef, type EnvioCompositor } from "./compositor";
import {
  ModalConfiguracoes,
  ModalDenunciar,
  ModalEncaminhar,
  ModalGrupo,
  ModalLeituras,
  ModalNovaConversa,
} from "./janelas";
import { Aviso, Avatar, Botao, Modal, Vazio } from "./ui";
import { novaChave, presenca, quandoLista, resumoMensagem, rotuloDia, semAcento } from "./util";
import "./chat-universal.css";

type Aba = "todas" | "nao_lidas" | "pedidos";

export function ChatUniversal({
  api,
  usuarioId,
  inicial,
  abaInicial,
  somenteLeitura,
  podeGrupo,
  intervaloMs = 20_000,
  assinar,
  aoAbrirConversa,
  aoConversaVisivel,
  enfileirar,
  classe,
  titulo = "Chat",
  icone3D,
  textoBoasVindas = "Equipe, clientes, parceiros e o correspondente num lugar só: texto, fotos, vídeos, documentos, áudio, reações e grupos, com histórico guardado.",
}: {
  api: ApiChat;
  usuarioId: string;
  inicial?: string | null;
  abaInicial?: "todas" | "nao_lidas" | "pedidos";
  somenteLeitura?: boolean;
  podeGrupo: boolean;
  intervaloMs?: number;
  assinar?: (fn: (e: EventoChat) => void) => () => void;
  aoAbrirConversa?: (id: string | null) => void;
  aoConversaVisivel?: (id: string | null) => void;
  enfileirar?: (c: {
    conversa: string;
    corpo: string;
    respondeA: string | null;
    chave: string;
  }) => Promise<void>;
  classe?: string;
  titulo?: string;
  textoBoasVindas?: string;
  /** Peça 3D do sistema anfitrião (estados vazios e boas-vindas). */
  icone3D?: DesenharIcone3D;
}) {
  const [lista, setLista] = useState<ItemListaConversa[] | null>(null);
  const [resumo, setResumo] = useState<ResumoConversas>({
    arquivadas: 0,
    nao_lidas: 0,
    pedidos: 0,
  });
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [arquivadas, setArquivadas] = useState(false);
  const [aba, setAba] = useState<Aba>(abaInicial ?? "todas");
  const [busca, setBusca] = useState("");
  const [achadosGlobais, setAchadosGlobais] = useState<Achado[] | null>(null);
  const [aberta, setAberta] = useState<string | null>(inicial ?? null);
  const [pagina, setPagina] = useState<PaginaConversa | null>(null);
  const [extra, setExtra] = useState<ExtraConversa | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [digitando, setDigitando] = useState<Record<string, { quem: string; ate: number }>>({});
  const [respondendo, setRespondendo] = useState<MensagemChat | null>(null);
  const [editando, setEditando] = useState<MensagemChat | null>(null);
  const [apagar, setApagar] = useState<MensagemChat | null>(null);
  const [encaminhar, setEncaminhar] = useState<MensagemChat | null>(null);
  const [denunciar, setDenunciar] = useState<{ mensagem: MensagemChat | null } | null>(null);
  const [visor, setVisor] = useState<{ mensagemId: string; anexoId: string } | null>(null);
  const [menuTopo, setMenuTopo] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<Achado[] | null>(null);
  const [destaque, setDestaque] = useState<string | null>(null);
  const [noFim, setNoFim] = useState(true);
  const [novasAbaixo, setNovasAbaixo] = useState(0);
  const [novaConversa, setNovaConversa] = useState(false);
  const [grupoInfo, setGrupoInfo] = useState(false);
  const [leituras, setLeituras] = useState<string | null>(null);
  const [config, setConfig] = useState(false);
  const [soltando, setSoltando] = useState(false);
  const [fixadaIdx, setFixadaIdx] = useState(0);
  const fio = useRef<HTMLDivElement>(null);
  const compositor = useRef<CompositorRef>(null);
  const abertaRef = useRef(aberta);
  abertaRef.current = aberta;
  const paginaRef = useRef(pagina);
  paginaRef.current = pagina;
  const enviandoAteRef = useRef(0);
  const irDepoisRef = useRef<string | null>(null);

  /* ------------------------------------------------------------ dados --- */

  const recarregarLista = useCallback(async () => {
    const r = await api.listar(arquivadas, busca);
    if (r.ok && r.dados) {
      setLista(r.dados.conversas);
      setResumo(r.dados.resumo);
    }
  }, [api, arquivadas, busca]);

  const recarregarPedidos = useCallback(async () => {
    const r = await api.pedidos();
    if (r.ok) setPedidos(r.dados ?? []);
  }, [api]);

  const recarregarExtra = useCallback(async () => {
    const id = abertaRef.current;
    if (!id) return;
    const r = await api.extra(id);
    if (abertaRef.current === id && r.ok) setExtra(r.dados ?? null);
  }, [api]);

  const recarregarAberta = useCallback(
    async (rolarFim = false) => {
      const id = abertaRef.current;
      if (!id) return;
      const r = await api.carregar(id);
      if (abertaRef.current !== id) return;
      if (!r.ok || !r.dados) {
        setErro(r.ok ? "Conversa não encontrada." : r.mensagem);
        return;
      }
      const nova = r.dados;
      setPagina((antiga) => {
        if (!antiga || antiga.conversa.id !== id) return nova;
        const ids = new Set(nova.mensagens.map((m) => m.id));
        const primeiro = nova.mensagens[0]?.criado_em;
        const antigas = antiga.mensagens.filter(
          (m) => !m.local && !ids.has(m.id) && primeiro && m.criado_em < primeiro,
        );
        const locais = antiga.mensagens.filter(
          (m) =>
            m.local &&
            !nova.mensagens.some((x) => x.meu && x.corpo === m.corpo && x.criado_em >= m.criado_em),
        );
        return {
          ...nova,
          mensagens: [...antigas, ...nova.mensagens, ...locais],
          tem_mais: antiga.tem_mais && antigas.length > 0 ? antiga.tem_mais : nova.tem_mais,
        };
      });
      if (rolarFim) requestAnimationFrame(() => rolarAoFim());
    },
    [api],
  );

  /** Só a diferença desde a última mensagem carregada (tempo real enxuto). */
  const puxarNovas = useCallback(
    async (rolarFim = false) => {
      const id = abertaRef.current;
      const p = paginaRef.current;
      if (!id) return;
      const ultima =
        p && p.conversa.id === id ? p.mensagens.filter((m) => !m.local).at(-1) : undefined;
      if (!ultima) return recarregarAberta(rolarFim);
      const r = await api.desde(id, ultima.criado_em);
      if (abertaRef.current !== id || !r.ok || !r.dados || r.dados.length === 0) return;
      const novas = r.dados;
      setPagina((antiga) => {
        if (!antiga || antiga.conversa.id !== id) return antiga;
        const ids = new Set(antiga.mensagens.map((m) => m.id));
        const chegaram = novas.filter((m) => !ids.has(m.id));
        const locais = antiga.mensagens.filter(
          (m) => m.local && !chegaram.some((x) => x.meu && x.corpo === m.corpo),
        );
        const outras = chegaram.filter((m) => !m.meu).length;
        if (outras && !rolarFim) setNovasAbaixo((n) => n + outras);
        return {
          ...antiga,
          mensagens: [...antiga.mensagens.filter((m) => !m.local), ...chegaram, ...locais],
        };
      });
      if (rolarFim) requestAnimationFrame(() => rolarAoFim());
    },
    [api, recarregarAberta],
  );

  const trocarMensagem = useCallback(
    async (mensagemId: string) => {
      const r = await api.unica(mensagemId);
      if (!r.ok || !r.dados) return;
      const nova = r.dados;
      setPagina((p) =>
        p ? { ...p, mensagens: p.mensagens.map((m) => (m.id === nova.id ? nova : m)) } : p,
      );
    },
    [api],
  );

  const pintarVistos = useCallback((acao: "entregue" | "lida") => {
    setPagina((p) =>
      p
        ? {
            ...p,
            mensagens: p.mensagens.map((m) =>
              m.meu && !m.local && m.status && m.status !== "lida"
                ? {
                    ...m,
                    status:
                      acao === "lida" ? "lida" : m.status === "enviada" ? "entregue" : m.status,
                  }
                : m,
            ),
          }
        : p,
    );
  }, []);

  useEffect(() => {
    void recarregarLista();
  }, [recarregarLista]);
  useEffect(() => {
    void recarregarPedidos();
  }, [recarregarPedidos]);

  // Busca em todas as mensagens (2+ letras), além do filtro da lista.
  useEffect(() => {
    if (busca.trim().length < 2) {
      setAchadosGlobais(null);
      return;
    }
    let vale = true;
    const t = setTimeout(() => {
      void api
        .buscarGlobal(busca.trim())
        .then((r) => vale && setAchadosGlobais(r.ok ? (r.dados ?? []) : []));
    }, 350);
    return () => {
      vale = false;
      clearTimeout(t);
    };
  }, [api, busca]);

  // Abrir uma conversa: carrega, rola ao fim, marca lida, avisa o anfitrião (URL).
  useEffect(() => {
    setRespondendo(null);
    setEditando(null);
    setBuscando(false);
    setAchados(null);
    setTermo("");
    setNovasAbaixo(0);
    setErro(null);
    setExtra(null);
    setFixadaIdx(0);
    aoAbrirConversa?.(aberta);
    aoConversaVisivel?.(aberta);
    setPagina(null);
    if (!aberta) return;
    void recarregarAberta(true)
      .then(() => {
        const alvo = irDepoisRef.current;
        irDepoisRef.current = null;
        if (alvo) void irPara(alvo);
      })
      .catch(() => setErro("Não foi possível carregar a conversa. Tentando de novo…"));
    void recarregarExtra();
    void api
      .marcarLida(aberta)
      .catch(() => null)
      .finally(() => void recarregarLista().catch(() => null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);

  useEffect(() => () => aoConversaVisivel?.(null), [aoConversaVisivel]);

  // Tempo real (quando o anfitrião tem o cano de eventos).
  useEffect(() => {
    if (!assinar) return;
    let agendado: ReturnType<typeof setTimeout> | null = null;
    const desligar = assinar((e) => {
      if (e.tipo === "digitando") {
        setDigitando((x) => ({
          ...x,
          [e.conversa_id]: { quem: e.quem ?? "", ate: Date.now() + 4000 },
        }));
        return;
      }
      const d = e;
      const abertaVisivel =
        d.conversa_id === abertaRef.current && document.visibilityState === "visible";
      if (d.acao === "nova" && d.autor !== usuarioId && !abertaVisivel) void api.marcarEntregues();
      if (d.conversa_id && d.conversa_id === abertaRef.current) {
        const grupo = Boolean(paginaRef.current?.conversa.grupo);
        if (d.acao === "nova" && d.autor !== usuarioId && document.visibilityState === "visible") {
          setDigitando((x) => {
            const y = { ...x };
            delete y[d.conversa_id!];
            return y;
          });
          void puxarNovas(estaNoFim()).then(() => api.marcarLida(d.conversa_id!));
        } else if (d.acao === "nova") {
          if (!(d.autor === usuarioId && Date.now() < enviandoAteRef.current))
            void puxarNovas(false);
        } else if (
          !grupo &&
          (d.acao === "entregue" || d.acao === "lida") &&
          d.quem &&
          d.quem !== usuarioId
        ) {
          pintarVistos(d.acao);
        } else if (
          d.mensagem_id &&
          (d.acao === "reacao" ||
            d.acao === "editada" ||
            d.acao === "apagada" ||
            d.acao === "fixada")
        ) {
          void trocarMensagem(d.mensagem_id);
          if (d.acao === "fixada") void recarregarExtra();
        } else if (d.quem !== usuarioId) {
          void recarregarAberta(false);
        }
      }
      if (d.acao !== "nova" && d.conversa_id === abertaRef.current) return;
      if (agendado) clearTimeout(agendado);
      agendado = setTimeout(() => {
        void recarregarLista();
        void recarregarPedidos();
      }, 700);
    });
    return () => {
      desligar();
      if (agendado) clearTimeout(agendado);
    };
  }, [
    assinar,
    api,
    usuarioId,
    puxarNovas,
    trocarMensagem,
    pintarVistos,
    recarregarAberta,
    recarregarLista,
    recarregarPedidos,
    recarregarExtra,
  ]);

  // "digitando…" morre sozinho em 4 s.
  useEffect(() => {
    const t = setInterval(() => {
      setDigitando((x) => {
        const agora = Date.now();
        const vivos = Object.entries(x).filter(([, v]) => v.ate > agora);
        return vivos.length === Object.keys(x).length ? x : Object.fromEntries(vivos);
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Presença e consulta periódica (rede de segurança do cano; sem cano, é o tempo real).
  useEffect(() => {
    const pulso = () => document.visibilityState === "visible" && void api.presenca();
    let volta = 0;
    const checar = () => {
      if (document.visibilityState !== "visible") return;
      volta = (volta + 1) % 3;
      if (assinar || volta === 0) {
        void recarregarLista().catch(() => null);
        void recarregarPedidos().catch(() => null);
      }
      if (abertaRef.current) {
        void (volta !== 0 ? puxarNovas(estaNoFim()) : recarregarAberta(estaNoFim())).catch(
          () => null,
        );
        if (volta === 0) void recarregarExtra();
        const p = paginaRef.current;
        if (p?.mensagens.some((m) => !m.meu && !m.local))
          void api.marcarLida(abertaRef.current).catch(() => null);
      }
    };
    pulso();
    void api.marcarEntregues();
    const a = setInterval(pulso, 30_000);
    const b = setInterval(checar, intervaloMs);
    const voltar = () => {
      if (document.visibilityState === "visible") {
        pulso();
        checar();
      }
    };
    document.addEventListener("visibilitychange", voltar);
    return () => {
      clearInterval(a);
      clearInterval(b);
      document.removeEventListener("visibilitychange", voltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    api,
    intervaloMs,
    assinar,
    recarregarLista,
    recarregarPedidos,
    puxarNovas,
    recarregarAberta,
    recarregarExtra,
  ]);

  /* ---------------------------------------------------------- rolagem --- */

  function estaNoFim() {
    const f = fio.current;
    return !f || f.scrollHeight - f.scrollTop - f.clientHeight < 120;
  }
  function rolarAoFim(suave = false) {
    const f = fio.current;
    if (f) f.scrollTo({ top: f.scrollHeight, behavior: suave ? "smooth" : "auto" });
    setNovasAbaixo(0);
  }
  const noFimRef = useRef(true);
  noFimRef.current = noFim;
  useEffect(() => {
    const f = fio.current;
    const l = f?.querySelector(".ec-mensagens");
    if (!f || !l || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (noFimRef.current) f.scrollTop = f.scrollHeight;
    });
    ro.observe(l);
    return () => ro.disconnect();
  }, [pagina?.conversa.id, pagina === null]);

  const carregarAnteriores = async () => {
    const p = paginaRef.current;
    if (!p || !p.tem_mais || carregandoMais) return null;
    const primeira = p.mensagens.find((m) => !m.local);
    if (!primeira) return null;
    setCarregandoMais(true);
    const f = fio.current;
    const antes = f ? f.scrollHeight - f.scrollTop : 0;
    const r = await api.carregar(p.conversa.id, primeira.id);
    setCarregandoMais(false);
    if (!r.ok || !r.dados) return null;
    const mais = r.dados.mensagens;
    setPagina((x) =>
      x && x.conversa.id === p.conversa.id
        ? {
            ...x,
            mensagens: [
              ...mais.filter((m) => !x.mensagens.some((y) => y.id === m.id)),
              ...x.mensagens,
            ],
            tem_mais: r.dados!.tem_mais,
          }
        : x,
    );
    requestAnimationFrame(() => {
      if (f) f.scrollTop = f.scrollHeight - antes;
    });
    return mais;
  };

  const irPara = async (id: string) => {
    for (let i = 0; i < 30; i++) {
      const no = fio.current?.querySelector(`[data-msg="${id}"]`);
      if (no) {
        no.scrollIntoView({ block: "center", behavior: "smooth" });
        setDestaque(id);
        setTimeout(() => setDestaque((d) => (d === id ? null : d)), 1800);
        return;
      }
      const mais = await carregarAnteriores();
      if (!mais || mais.length === 0) break;
    }
    setErro("Mensagem não encontrada no histórico.");
  };

  /* ------------------------------------------------------------ ações --- */

  const conversaAtual = pagina?.conversa ?? null;

  const enviar = async (e: EnvioCompositor): Promise<boolean> => {
    const id = aberta;
    if (!id) return false;
    const chave = novaChave();
    const temp: MensagemChat = {
      id: `local-${chave}`,
      tipo: e.anexos?.length
        ? e.duracaoMs
          ? "audio"
          : e.anexos.every((a) => a.mime.startsWith("image/"))
            ? "imagem"
            : "arquivo"
        : "texto",
      lado: "cliente",
      corpo: e.corpo,
      anexos: e.anexos ?? [],
      duracao_ms: e.duracaoMs ?? null,
      meu: true,
      autor: null,
      encaminhada: false,
      editada: false,
      apagada: false,
      criado_em: new Date().toISOString(),
      pode_editar: false,
      pode_apagar_todos: false,
      responde: respondendo
        ? {
            id: respondendo.id,
            tipo: respondendo.tipo,
            autor: respondendo.autor,
            meu: respondendo.meu,
            corpo: respondendo.corpo,
            apagada: false,
          }
        : null,
      reacoes: [],
      status: null,
      local: "enviando",
    };
    const respondeA = respondendo?.id ?? null;
    setRespondendo(null);
    setPagina((p) => (p && p.conversa.id === id ? { ...p, mensagens: [...p.mensagens, temp] } : p));
    requestAnimationFrame(() => rolarAoFim(true));

    if (typeof navigator !== "undefined" && !navigator.onLine && !e.anexos?.length && enfileirar) {
      await enfileirar({ conversa: id, corpo: e.corpo, respondeA, chave });
      setErro("Sem conexão: a mensagem sai sozinha quando a rede voltar.");
      return true;
    }
    enviandoAteRef.current = Date.now() + 5000;
    const r = await api.enviar(id, e.corpo, {
      anexos: e.anexos?.map((a) => ({ id: a.id, largura: a.largura, altura: a.altura })),
      duracaoMs: e.duracaoMs ?? null,
      respondeA,
      chave,
    });
    if (!r.ok) {
      setPagina((p) =>
        p
          ? {
              ...p,
              mensagens: p.mensagens.map((m) => (m.id === temp.id ? { ...m, local: "falhou" } : m)),
            }
          : p,
      );
      enviandoAteRef.current = 0;
      setErro(r.mensagem);
      return false;
    }
    await puxarNovas(true);
    enviandoAteRef.current = 0;
    setPagina((p) => (p ? { ...p, mensagens: p.mensagens.filter((m) => m.id !== temp.id) } : p));
    void recarregarLista();
    if (extra?.pedido === "recebido") void recarregarExtra();
    return true;
  };

  const imagensDoFio = useMemo(
    () =>
      (pagina?.mensagens ?? []).flatMap((m) =>
        m.apagada
          ? []
          : m.anexos
              .filter((a) => a.mime.startsWith("image/") && a.url)
              .map((a) => ({ mensagemId: m.id, anexo: a })),
      ),
    [pagina],
  );

  const acoes: AcoesBolha = useMemo(
    () => ({
      responder: (m) => {
        setEditando(null);
        setRespondendo(m);
      },
      reagir: async (m, emoji) => {
        const r = await api.reagir(m.id, emoji);
        if (!r.ok) setErro(r.mensagem);
        await trocarMensagem(m.id);
      },
      editar: (m) => {
        setRespondendo(null);
        setEditando(m);
      },
      apagar: (m) => setApagar(m),
      encaminhar: (m) => setEncaminhar(m),
      fixar: async (m, fixar) => {
        const r = await api.fixar(m.id, fixar);
        if (!r.ok) setErro(r.mensagem);
        await Promise.all([trocarMensagem(m.id), recarregarExtra(), puxarNovas(estaNoFim())]);
      },
      denunciar: (m) => setDenunciar({ mensagem: m }),
      leituras: (m) => setLeituras(m.id),
      irPara: (id) => void irPara(id),
      abrirImagem: (mensagemId, anexoId) => setVisor({ mensagemId, anexoId }),
      reenviar: async (m) => {
        setPagina((p) => (p ? { ...p, mensagens: p.mensagens.filter((x) => x.id !== m.id) } : p));
        await enviar({
          corpo: m.corpo ?? "",
          anexos: m.anexos,
          duracaoMs: m.duracao_ms ?? undefined,
        });
      },
      abrirAnexoAntigo: api.abrirAnexoAntigo
        ? async (m) => {
            const r = await api.abrirAnexoAntigo!(m.id);
            if (r.ok && r.dados) window.open(r.dados, "_blank", "noopener,noreferrer");
            else if (!r.ok) setErro(r.mensagem);
          }
        : undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aberta, respondendo, conversaAtual, extra, api],
  );

  const preferencia = async (acao: AcaoPreferencia, horas?: number | null) => {
    if (!aberta) return;
    setMenuTopo(false);
    const r = await api.preferencia(aberta, acao, horas);
    if (!r.ok) setErro(r.mensagem);
    if (acao === "arquivar") setAberta(null);
    else await recarregarAberta(acao === "limpar");
    await recarregarLista();
  };

  const responderPedido = async (id: string, acao: "aceitar" | "recusar" | "bloquear") => {
    const r = await api.responderPedido(id, acao);
    if (!r.ok) {
      setErro(r.mensagem);
      return;
    }
    await Promise.all([recarregarPedidos(), recarregarLista()]);
    if (acao === "aceitar") {
      setAba("todas");
      if (aberta === id) void recarregarExtra();
      else setAberta(id);
    } else if (aberta === id) setAberta(null);
  };

  /* ----------------------------------------------------------- render --- */

  const listaFiltrada = (lista ?? []).filter(
    (c) => aba !== "nao_lidas" || c.nao_lidas > 0 || c.nao_lida_manual,
  );
  const nomeOutro = conversaAtual?.contraparte ?? "contato";
  const quemDigita = aberta ? digitando[aberta] : undefined;
  const subtitulo = quemDigita
    ? "digitando…"
    : conversaAtual
      ? (presenca(conversaAtual.online, conversaAtual.visto_em) ??
        [conversaAtual.arroba ? `@${conversaAtual.arroba}` : null, conversaAtual.detalhe]
          .filter(Boolean)
          .join(" · "))
      : "";
  const fixadas = extra?.fixadas ?? [];
  const fixadaAtual = fixadas.length ? fixadas[Math.min(fixadaIdx, fixadas.length - 1)] : null;
  const direta = Boolean(conversaAtual && !conversaAtual.grupo);
  const podeEscrever = !somenteLeitura && (extra ? extra.pode_escrever : true);
  const totalPedidos = resumo.pedidos ?? pedidos?.length ?? 0;

  return (
    <div
      className={clsx("ec-tela cu-raiz", aberta && "ec-tela-aberta", classe)}
      data-aberta={aberta ? "1" : "0"}
    >
      {/* ------------------------------------------------------ lista --- */}
      <aside className="ec-lista" aria-label="Conversas">
        <div className="ec-lista-topo">
          <div className="ec-topo-equipe">
            <b>{titulo}</b>
            <span className="cu-topo-acoes">
              <button
                type="button"
                className="ec-icone sem-toque"
                onClick={() => setConfig(true)}
                aria-label="Configurações do chat"
                title="Configurações do chat"
              >
                <Settings size={18} aria-hidden />
              </button>
              <button
                type="button"
                className="ec-nova"
                onClick={() => setNovaConversa(true)}
                disabled={somenteLeitura}
              >
                <SquarePen size={16} aria-hidden /> Nova conversa
              </button>
            </span>
          </div>
          <div className="ec-busca">
            <Search size={16} className="cu-sem-encolher" aria-hidden />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar conversa ou mensagem"
              aria-label="Pesquisar conversa ou mensagem"
            />
            {busca && (
              <button
                type="button"
                className="sem-toque"
                onClick={() => setBusca("")}
                aria-label="Limpar a pesquisa"
              >
                <X size={16} aria-hidden />
              </button>
            )}
          </div>
          <div className="ec-filtros" role="tablist">
            {arquivadas ? (
              <button
                type="button"
                className="ec-filtro ec-filtro-ativo"
                onClick={() => setArquivadas(false)}
              >
                <ArrowLeft size={14} aria-hidden /> Arquivadas
              </button>
            ) : (
              <>
                {(["todas", "nao_lidas", "pedidos"] as Aba[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    role="tab"
                    aria-selected={aba === a}
                    className={clsx("ec-filtro", aba === a && "ec-filtro-ativo")}
                    onClick={() => setAba(a)}
                  >
                    {a === "todas" ? "Todas" : a === "nao_lidas" ? "Não lidas" : "Pedidos"}
                    {a === "nao_lidas" && resumo.nao_lidas ? ` (${resumo.nao_lidas})` : ""}
                    {a === "pedidos" && totalPedidos ? (
                      <span className="cu-bolinha num">{totalPedidos}</span>
                    ) : null}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {!arquivadas && aba !== "pedidos" && resumo.arquivadas > 0 && (
          <button type="button" className="ec-arquivadas" onClick={() => setArquivadas(true)}>
            <Archive size={16} aria-hidden /> Arquivadas
            <span className="num">{resumo.arquivadas}</span>
          </button>
        )}

        {aba === "pedidos" && !arquivadas ? (
          <ul className="ec-itens">
            <li className="cu-explica">
              <Inbox size={16} aria-hidden /> Quem não é da sua base e achou você pelo @. Aceite
              para conversar; recusar não avisa a pessoa.
            </li>
            {pedidos === null ? (
              [1, 2, 3].map((i) => <li key={i} className="ec-item-esqueleto" aria-hidden />)
            ) : pedidos.length === 0 ? (
              <li className="ec-vazio-lista">
                <Vazio
                  icone={icone3D?.(Inbox, "lg")}
                  titulo="Nenhum pedido de mensagem"
                  texto="Quando alguém de fora da sua base mandar mensagem pelo seu @, ela chega aqui."
                />
              </li>
            ) : (
              pedidos.map((p) => (
                <li key={p.id} className="cu-pedido">
                  <button
                    type="button"
                    className={clsx("ec-item", p.id === aberta && "ec-item-ativo")}
                    onClick={() => setAberta(p.id)}
                  >
                    <Avatar nome={p.de.nome} />
                    <span className="ec-item-meio">
                      <span className="ec-item-linha">
                        <b>{p.de.nome}</b>
                        <small className="num">{quandoLista(p.ultima_em)}</small>
                      </span>
                      <span className="ec-item-linha">
                        <span className="ec-item-previa">
                          {p.de.arroba ? `@${p.de.arroba} · ` : ""}
                          {p.ultima ? resumoMensagem(p.ultima) : p.de.detalhe}
                        </span>
                      </span>
                    </span>
                  </button>
                  <span className="cu-pedido-acoes">
                    <Botao onClick={() => void responderPedido(p.id, "aceitar")}>Aceitar</Botao>
                    <Botao
                      variante="secundario"
                      onClick={() => void responderPedido(p.id, "recusar")}
                    >
                      Recusar
                    </Botao>
                  </span>
                </li>
              ))
            )}
          </ul>
        ) : (
          <ul className="ec-itens">
            {lista === null ? (
              Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="ec-item-esqueleto" aria-hidden />
              ))
            ) : listaFiltrada.length === 0 && !achadosGlobais?.length ? (
              <li className="ec-vazio-lista">
                <Vazio
                  icone={icone3D?.(busca ? Search : MessageCircle, "lg")}
                  titulo={
                    busca
                      ? "Nada encontrado"
                      : arquivadas
                        ? "Nenhuma conversa arquivada"
                        : "Nenhuma conversa ainda"
                  }
                  texto={
                    busca
                      ? "Tente outro nome, @ ou palavra."
                      : "Toque em Nova conversa para chamar alguém da sua base, ou procure qualquer pessoa pelo @."
                  }
                />
              </li>
            ) : (
              listaFiltrada.map((c) => (
                <ItemConversa
                  key={c.id}
                  c={c}
                  ativa={c.id === aberta}
                  digitando={Boolean(digitando[c.id])}
                  aoAbrir={() => setAberta(c.id)}
                />
              ))
            )}
            {achadosGlobais && achadosGlobais.length > 0 && (
              <>
                <li className="cu-secao-lista">Mensagens</li>
                {achadosGlobais.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className="ec-item cu-achado"
                      onClick={() => {
                        if (!a.conversa_id) return;
                        if (a.conversa_id === aberta) void irPara(a.id);
                        else {
                          irDepoisRef.current = a.id;
                          setAberta(a.conversa_id);
                        }
                      }}
                    >
                      <span className="ec-item-meio">
                        <span className="ec-item-linha">
                          <b>{a.contraparte ?? "Conversa"}</b>
                          <small className="num">{quandoLista(a.criado_em)}</small>
                        </span>
                        <span className="ec-item-previa">
                          {a.meu ? "Você: " : a.grupo && a.autor ? `${a.autor}: ` : ""}
                          {realce(a.corpo, busca)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </>
            )}
          </ul>
        )}
        <p className="ec-lista-rodape">
          <Lock size={14} className="cu-sem-encolher" aria-hidden />
          Só quem participa vê a conversa e os arquivos.
        </p>
      </aside>

      {/* --------------------------------------------------- conversa --- */}
      <section
        className="ec-conversa"
        aria-label="Conversa"
        onDragOver={(e) => {
          if (!aberta || !podeEscrever || !e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setSoltando(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setSoltando(false);
        }}
        onDrop={(e) => {
          if (!aberta || !podeEscrever) return;
          e.preventDefault();
          setSoltando(false);
          if (e.dataTransfer.files.length) compositor.current?.adicionar(e.dataTransfer.files);
        }}
      >
        {soltando && (
          <div className="cu-soltar" aria-hidden>
            <Upload size={28} />
            <b>Solte para enviar</b>
          </div>
        )}
        {!aberta ? (
          <div className="ec-boas-vindas">
            {icone3D ? (
              <span className="cu-boas-vindas-3d">{icone3D(MessageCircle, "xl")}</span>
            ) : (
              <span className="ec-boas-vindas-icone">
                <MessageCircle size={28} aria-hidden />
              </span>
            )}
            <b>Suas conversas, num lugar só</b>
            <p>{textoBoasVindas}</p>
            <button
              type="button"
              className="ec-nova ec-nova-grande"
              onClick={() => setNovaConversa(true)}
              disabled={somenteLeitura}
            >
              <SquarePen size={16} aria-hidden /> Nova conversa
            </button>
          </div>
        ) : (
          <>
            <header className="ec-cab">
              <button
                type="button"
                className="ec-icone ec-voltar sem-toque"
                onClick={() => setAberta(null)}
                aria-label="Voltar às conversas"
              >
                <ArrowLeft size={20} aria-hidden />
              </button>
              {conversaAtual ? (
                <button
                  type="button"
                  className="cu-cab-pessoa sem-toque"
                  onClick={() => conversaAtual.grupo && setGrupoInfo(true)}
                  disabled={!conversaAtual.grupo}
                >
                  <Avatar
                    nome={conversaAtual.contraparte ?? "?"}
                    url={conversaAtual.foto_url}
                    online={conversaAtual.online}
                    grupo={conversaAtual.grupo}
                  />
                  <span className="ec-cab-nome">
                    <b>{conversaAtual.contraparte}</b>
                    <small className={clsx(quemDigita && "ec-digitando")}>{subtitulo}</small>
                  </span>
                </button>
              ) : (
                <span className="ec-cab-nome">
                  <b className="ec-esqueleto-linha" />
                </span>
              )}
              <div className="ec-cab-acoes">
                <button
                  type="button"
                  className="ec-icone sem-toque"
                  aria-label="Pesquisar nesta conversa"
                  onClick={() => {
                    setBuscando((x) => !x);
                    setAchados(null);
                    setTermo("");
                  }}
                >
                  <Search size={20} aria-hidden />
                </button>
                <div className="cu-relativo">
                  <button
                    type="button"
                    className="ec-icone sem-toque"
                    aria-label="Mais opções"
                    aria-expanded={menuTopo}
                    onClick={() => setMenuTopo((x) => !x)}
                  >
                    <EllipsisVertical size={20} aria-hidden />
                  </button>
                  {menuTopo && conversaAtual && (
                    <div
                      className="ec-menu ec-menu-topo"
                      role="menu"
                      onMouseLeave={() => setMenuTopo(false)}
                    >
                      {conversaAtual.grupo && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => (setMenuTopo(false), setGrupoInfo(true))}
                        >
                          <Users size={16} aria-hidden /> Dados do grupo
                        </button>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={async () => {
                          setMenuTopo(false);
                          const r = await api.marcarNaoLida(aberta);
                          if (!r.ok) setErro(r.mensagem);
                          await recarregarLista();
                          setAberta(null);
                        }}
                      >
                        <MailOpen size={16} aria-hidden /> Marcar como não lida
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          void preferencia(conversaAtual.fixada ? "desafixar" : "fixar")
                        }
                      >
                        {conversaAtual.fixada ? (
                          <PinOff size={16} aria-hidden />
                        ) : (
                          <Pin size={16} aria-hidden />
                        )}
                        {conversaAtual.fixada ? "Desafixar conversa" : "Fixar conversa no topo"}
                      </button>
                      {conversaAtual.silenciada_ate ? (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void preferencia("reativar_som")}
                        >
                          <BellRing size={16} aria-hidden /> Reativar avisos
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => void preferencia("silenciar", 8)}
                          >
                            <BellOff size={16} aria-hidden /> Silenciar por 8 horas
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => void preferencia("silenciar", 24 * 7)}
                          >
                            <BellOff size={16} aria-hidden /> Silenciar por 1 semana
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => void preferencia("silenciar", null)}
                          >
                            <BellOff size={16} aria-hidden /> Silenciar sempre
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          void preferencia(conversaAtual.arquivada ? "desarquivar" : "arquivar")
                        }
                      >
                        {conversaAtual.arquivada ? (
                          <ArchiveRestore size={16} aria-hidden />
                        ) : (
                          <Archive size={16} aria-hidden />
                        )}
                        {conversaAtual.arquivada ? "Desarquivar" : "Arquivar"}
                      </button>
                      {direta && extra?.outro_id && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={async () => {
                            setMenuTopo(false);
                            const r = extra.eu_bloqueei
                              ? await api.desbloquear(extra.outro_id!)
                              : await api.bloquear(extra.outro_id!);
                            if (!r.ok) setErro(r.mensagem);
                            await recarregarExtra();
                          }}
                        >
                          {extra.eu_bloqueei ? (
                            <ShieldOff size={16} aria-hidden />
                          ) : (
                            <Ban size={16} aria-hidden />
                          )}
                          {extra.eu_bloqueei ? "Desbloquear" : "Bloquear"}
                        </button>
                      )}
                      {direta && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => (setMenuTopo(false), setDenunciar({ mensagem: null }))}
                        >
                          <Flag size={16} aria-hidden /> Denunciar
                        </button>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        className="ec-menu-perigo"
                        onClick={() => void preferencia("limpar")}
                      >
                        <X size={16} aria-hidden /> Limpar conversa (só para mim)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {fixadaAtual && (
              <button
                type="button"
                className="cu-fixadas sem-toque"
                onClick={() => {
                  void irPara(fixadaAtual.id);
                  setFixadaIdx((i) => (i + 1) % fixadas.length);
                }}
                aria-label="Ir para a mensagem fixada"
              >
                <Pin size={14} aria-hidden />
                <span className="cu-min0">
                  <b>
                    Mensagem fixada
                    {fixadas.length > 1
                      ? ` ${Math.min(fixadaIdx, fixadas.length - 1) + 1}/${fixadas.length}`
                      : ""}
                  </b>
                  <span>
                    {fixadaAtual.corpo ||
                      resumoMensagem({ tipo: fixadaAtual.tipo, corpo: fixadaAtual.corpo })}
                  </span>
                </span>
              </button>
            )}

            {extra?.pedido === "recebido" && (
              <div className="cu-faixa cu-faixa-pedido">
                <p>
                  <b>{nomeOutro}</b>
                  {extra.arroba ? ` (@${extra.arroba})` : ""} não é da sua base e quer conversar com
                  você.
                </p>
                <span className="cu-linha-botoes">
                  <Botao onClick={() => void responderPedido(aberta, "aceitar")}>Aceitar</Botao>
                  <Botao
                    variante="secundario"
                    onClick={() => void responderPedido(aberta, "recusar")}
                  >
                    Recusar
                  </Botao>
                  <Botao variante="fantasma" onClick={() => setDenunciar({ mensagem: null })}>
                    Denunciar
                  </Botao>
                </span>
              </div>
            )}
            {extra?.pedido === "enviado" && (
              <div className="cu-faixa">
                <p>
                  Pedido de mensagem enviado. Até a pessoa aceitar, dá para mandar poucas mensagens
                  e você não vê se ela leu.
                </p>
              </div>
            )}

            {buscando && (
              <div className="ec-busca-conversa">
                <form
                  className="ec-busca"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!aberta || termo.trim().length < 2) return;
                    const r = await api.buscarNaConversa(aberta, termo);
                    setAchados(r.ok ? (r.dados ?? []) : []);
                  }}
                >
                  <Search size={16} className="cu-sem-encolher" aria-hidden />
                  <input
                    autoFocus
                    value={termo}
                    onChange={(e) => setTermo(e.target.value)}
                    placeholder="Pesquisar nesta conversa"
                    aria-label="Pesquisar nesta conversa"
                  />
                  <button type="submit" className="ec-filtro">
                    Buscar
                  </button>
                </form>
                {achados && (
                  <ul className="ec-achados">
                    {achados.length === 0 ? (
                      <li className="ec-achados-vazio">Nada com “{termo}”.</li>
                    ) : (
                      achados.map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => (setBuscando(false), void irPara(a.id))}
                          >
                            <small className="num">
                              {new Date(a.criado_em).toLocaleDateString("pt-BR")} ·{" "}
                              {a.meu ? "Você" : a.autor}
                            </small>
                            <span>{realce(a.corpo, termo)}</span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            )}

            {erro && (
              <div className="ec-erro">
                <Aviso tom="perigo">
                  <span className="cu-erro-linha">
                    {erro}
                    <button
                      type="button"
                      className="sem-toque"
                      onClick={() => setErro(null)}
                      aria-label="Fechar o aviso"
                    >
                      <X size={16} aria-hidden />
                    </button>
                  </span>
                </Aviso>
              </div>
            )}

            <div className="ec-fio-caixa">
              <div
                ref={fio}
                className="ec-fio"
                onScroll={(e) => {
                  const f = e.currentTarget;
                  const fim = f.scrollHeight - f.scrollTop - f.clientHeight < 120;
                  setNoFim(fim);
                  if (fim) setNovasAbaixo(0);
                  if (f.scrollTop < 80) void carregarAnteriores();
                }}
              >
                {!pagina ? (
                  <ul className="ec-mensagens" aria-busy="true">
                    {["cu-esq-62", "cu-esq-44 cu-esq-dir", "cu-esq-70", "cu-esq-38 cu-esq-dir"].map(
                      (c) => (
                        <li key={c} className={clsx("ec-esqueleto-bolha", c)} />
                      ),
                    )}
                  </ul>
                ) : (
                  <ul className="ec-mensagens" aria-live="polite">
                    {pagina.tem_mais && (
                      <li className="ec-mais">
                        <button
                          type="button"
                          className="ec-filtro"
                          onClick={() => void carregarAnteriores()}
                          disabled={carregandoMais}
                        >
                          {carregandoMais ? "Carregando…" : "Mensagens anteriores"}
                        </button>
                      </li>
                    )}
                    {pagina.mensagens.length === 0 && (
                      <li className="ec-sistema">
                        <span>
                          <Lock size={12} className="cu-inline" aria-hidden /> As mensagens ficam
                          guardadas aqui, só entre quem participa.
                        </span>
                      </li>
                    )}
                    {pagina.mensagens.map((m, i) => {
                      const ant = pagina.mensagens[i - 1];
                      const seg = pagina.mensagens[i + 1];
                      const diaNovo = !ant || rotuloDia(ant.criado_em) !== rotuloDia(m.criado_em);
                      const mesmo = (a?: MensagemChat, b?: MensagemChat) =>
                        !!a &&
                        !!b &&
                        a.meu === b.meu &&
                        a.autor === b.autor &&
                        a.tipo !== "sistema" &&
                        b.tipo !== "sistema" &&
                        rotuloDia(a.criado_em) === rotuloDia(b.criado_em);
                      return (
                        <Fragment key={m.id}>
                          {diaNovo && (
                            <li className="ec-dia">
                              <span>{rotuloDia(m.criado_em)}</span>
                            </li>
                          )}
                          <Bolha
                            m={m}
                            comeca={diaNovo || !mesmo(ant, m)}
                            termina={!mesmo(m, seg)}
                            destaque={destaque === m.id}
                            acoes={acoes}
                            grupo={Boolean(conversaAtual?.grupo)}
                            api={api}
                          />
                        </Fragment>
                      );
                    })}
                    {quemDigita && (
                      <li className="ec-linha ec-dele">
                        <div
                          className="ec-balao ec-digitando-bolha"
                          aria-label={`${quemDigita.quem || nomeOutro} está digitando`}
                        >
                          <span />
                          <span />
                          <span />
                        </div>
                      </li>
                    )}
                  </ul>
                )}
              </div>
              {(!noFim || novasAbaixo > 0) && (
                <button
                  type="button"
                  className="ec-ir-fim sem-toque"
                  onClick={() => rolarAoFim(true)}
                  aria-label="Ir para a última mensagem"
                >
                  {novasAbaixo > 0 && <span className="ec-contador num">{novasAbaixo}</span>}
                  <ArrowDown size={20} aria-hidden />
                </button>
              )}
            </div>

            {somenteLeitura ? (
              <div className="ec-rodape ec-rodape-aviso">
                Conta em modo somente leitura: dá para ler, não para enviar.
              </div>
            ) : extra?.bloqueado ? (
              <div className="ec-rodape ec-rodape-aviso cu-bloqueado">
                {extra.eu_bloqueei ? (
                  <>
                    Você bloqueou este contato.{" "}
                    <button
                      type="button"
                      className="cu-link-botao"
                      onClick={async () => {
                        const r = await api.desbloquear(extra.outro_id!);
                        if (!r.ok) setErro(r.mensagem);
                        await recarregarExtra();
                      }}
                    >
                      Desbloquear
                    </button>
                  </>
                ) : (
                  "Não é possível enviar mensagens nesta conversa."
                )}
              </div>
            ) : (
              <Compositor
                ref={compositor}
                api={api}
                conversaId={aberta}
                nomeContraparte={nomeOutro}
                respondendo={respondendo}
                editando={editando}
                aoCancelarContexto={() => {
                  setRespondendo(null);
                  setEditando(null);
                }}
                aoEnviar={enviar}
                aoEditar={async (corpo) => {
                  if (!editando) return false;
                  const r = await api.editar(editando.id, corpo);
                  if (!r.ok) {
                    setErro(r.mensagem);
                    return false;
                  }
                  const id = editando.id;
                  setEditando(null);
                  await trocarMensagem(id);
                  return true;
                }}
                aoDigitar={() => aberta && void api.digitando(aberta)}
                aoErro={setErro}
              />
            )}
          </>
        )}
      </section>

      {/* ------------------------------------------------------ janelas --- */}
      {apagar && (
        <Modal onFechar={() => setApagar(null)} titulo="Apagar mensagem?" largura="sm">
          <div className="cu-pilha">
            {apagar.pode_apagar_todos && (
              <Botao
                variante="perigo"
                onClick={async () => {
                  const m = apagar;
                  setApagar(null);
                  const r = await api.apagar(m.id, true);
                  if (!r.ok) setErro(r.mensagem);
                  await trocarMensagem(m.id);
                  void recarregarLista();
                }}
              >
                Apagar para todos
              </Botao>
            )}
            <Botao
              variante="secundario"
              onClick={async () => {
                const m = apagar;
                setApagar(null);
                const r = await api.apagar(m.id, false);
                if (!r.ok) setErro(r.mensagem);
                setPagina((p) =>
                  p ? { ...p, mensagens: p.mensagens.filter((x) => x.id !== m.id) } : p,
                );
                void recarregarLista();
              }}
            >
              Apagar para mim
            </Botao>
            <Botao variante="fantasma" onClick={() => setApagar(null)}>
              Cancelar
            </Botao>
            {apagar.meu && !apagar.pode_apagar_todos && (
              <p className="cu-nota">Passou de 1 hora: dá para apagar só para você.</p>
            )}
          </div>
        </Modal>
      )}

      {encaminhar && (
        <ModalEncaminhar
          m={encaminhar}
          conversas={(lista ?? []).filter((c) => c.id !== aberta)}
          aoFechar={() => setEncaminhar(null)}
          aoConcluir={async (destinos) => {
            const r = await api.encaminhar(encaminhar.id, destinos);
            setEncaminhar(null);
            if (!r.ok) setErro(r.mensagem);
            void recarregarLista();
          }}
        />
      )}

      {denunciar && (
        <ModalDenunciar
          alvo={
            denunciar.mensagem
              ? "Mensagem de " + (denunciar.mensagem.autor ?? nomeOutro)
              : nomeOutro
          }
          aoFechar={() => setDenunciar(null)}
          aoConcluir={async (motivo, detalhe, bloquear) => {
            const r = await api.denunciar({
              conversaId: aberta,
              mensagemId: denunciar.mensagem?.id ?? null,
              motivo,
              detalhe,
              bloquear,
            });
            if (!r.ok) return r.mensagem;
            setDenunciar(null);
            if (extra?.pedido === "recebido" && bloquear && aberta)
              await responderPedido(aberta, "bloquear");
            await recarregarExtra();
            return null;
          }}
        />
      )}

      {novaConversa && (
        <ModalNovaConversa
          api={api}
          podeGrupo={podeGrupo}
          aoFechar={() => setNovaConversa(false)}
          aoAbrir={(id) => {
            setNovaConversa(false);
            setArquivadas(false);
            setAba("todas");
            setAberta(id);
            void recarregarLista();
          }}
        />
      )}

      {grupoInfo && aberta && conversaAtual?.grupo && (
        <ModalGrupo
          api={api}
          conversaId={aberta}
          titulo={conversaAtual.contraparte ?? ""}
          fotoUrl={conversaAtual.foto_url}
          admin={Boolean(conversaAtual.admin)}
          aoFechar={() => setGrupoInfo(false)}
          aoMudar={() => {
            void recarregarAberta(false);
            void recarregarLista();
          }}
          aoSair={() => {
            setGrupoInfo(false);
            setAberta(null);
            void recarregarLista();
          }}
        />
      )}

      {leituras && (
        <ModalLeituras api={api} mensagemId={leituras} aoFechar={() => setLeituras(null)} />
      )}
      {config && <ModalConfiguracoes api={api} aoFechar={() => setConfig(false)} />}

      {visor && (
        <Galeria
          itens={imagensDoFio}
          atual={visor}
          aoTrocar={setVisor}
          aoFechar={() => setVisor(null)}
        />
      )}
    </div>
  );
}

function ItemConversa({
  c,
  ativa,
  digitando,
  aoAbrir,
}: {
  c: ItemListaConversa;
  ativa: boolean;
  digitando: boolean;
  aoAbrir: () => void;
}) {
  const naoLidas = c.nao_lidas > 0 || c.nao_lida_manual;
  return (
    <li>
      <button
        type="button"
        className={clsx("ec-item", ativa && "ec-item-ativo")}
        onClick={aoAbrir}
        data-conversa={c.id}
      >
        <Avatar nome={c.contraparte ?? "?"} url={c.foto_url} online={c.online} grupo={c.grupo} />
        <span className="ec-item-meio">
          <span className="ec-item-linha">
            <b>{c.contraparte ?? "Contato"}</b>
            <small className={clsx("num", naoLidas && !c.silenciada && "ec-item-hora-nova")}>
              {quandoLista(c.ultima?.criado_em ?? c.ultima_em)}
            </small>
          </span>
          <span className="ec-item-linha">
            <span className={clsx("ec-item-previa", digitando && "ec-item-digitando")}>
              {digitando ? (
                "digitando…"
              ) : c.pedido === "enviado" ? (
                <i>Pedido de mensagem enviado</i>
              ) : c.ultima ? (
                <>
                  {c.ultima.meu &&
                    !c.ultima.apagada &&
                    c.ultima.tipo !== "sistema" &&
                    (c.ultima.status === "lida" ? (
                      <CheckCheck
                        className="ec-visto-lista ec-visto-lida"
                        size={16}
                        aria-label="lida"
                      />
                    ) : c.ultima.status === "entregue" ? (
                      <CheckCheck className="ec-visto-lista" size={16} aria-label="entregue" />
                    ) : (
                      <Check className="ec-visto-lista" size={16} aria-label="enviada" />
                    ))}
                  {c.grupo && !c.ultima.meu && c.ultima.autor && c.ultima.tipo !== "sistema"
                    ? `${c.ultima.autor.split(" ")[0]}: `
                    : ""}
                  {resumoMensagem(c.ultima)}
                </>
              ) : (
                <i>{c.arroba ? `@${c.arroba}` : (c.detalhe ?? "Nova conversa")}</i>
              )}
            </span>
            <span className="ec-item-marcas">
              {c.silenciada && <BellOff size={14} aria-label="silenciada" />}
              {c.fixada && <Pin size={14} aria-label="fixada" />}
              {c.nao_lidas > 0 ? (
                <span
                  className={clsx("ec-contador num", c.silenciada && "ec-contador-mudo")}
                  aria-label={`${c.nao_lidas} não lidas`}
                >
                  {c.nao_lidas > 99 ? "99+" : c.nao_lidas}
                </span>
              ) : c.nao_lida_manual ? (
                <span
                  className="ec-contador cu-contador-ponto"
                  aria-label="marcada como não lida"
                />
              ) : null}
            </span>
          </span>
        </span>
      </button>
    </li>
  );
}

/** Galeria das fotos da conversa: setas, teclado (← →, Esc) e baixar. */
function Galeria({
  itens,
  atual,
  aoTrocar,
  aoFechar,
}: {
  itens: { mensagemId: string; anexo: { id: string; nome: string; url?: string } }[];
  atual: { mensagemId: string; anexoId: string };
  aoTrocar: (v: { mensagemId: string; anexoId: string }) => void;
  aoFechar: () => void;
}) {
  const i = Math.max(
    0,
    itens.findIndex((x) => x.mensagemId === atual.mensagemId && x.anexo.id === atual.anexoId),
  );
  const item = itens[i];
  const ir = (d: number) => {
    const n = itens[(i + d + itens.length) % itens.length];
    if (n) aoTrocar({ mensagemId: n.mensagemId, anexoId: n.anexo.id });
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
      if (e.key === "ArrowRight") ir(1);
      if (e.key === "ArrowLeft") ir(-1);
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  });
  if (!item?.anexo.url) return null;
  const url = item.anexo.url;
  return (
    <div className="ec-visor" role="dialog" aria-label={item.anexo.nome} onClick={aoFechar}>
      <div className="ec-visor-topo" onClick={(e) => e.stopPropagation()}>
        <span className="cu-truncar">
          {item.anexo.nome}
          {itens.length > 1 ? ` · ${i + 1} de ${itens.length}` : ""}
        </span>
        <a
          href={`${url}${url.includes("?") ? "&" : "?"}baixar=1`}
          className="ec-icone"
          aria-label="Baixar"
        >
          <Download size={20} aria-hidden />
        </a>
        <button type="button" className="ec-icone sem-toque" onClick={aoFechar} aria-label="Fechar">
          <X size={20} aria-hidden />
        </button>
      </div>
      {itens.length > 1 && (
        <>
          <button
            type="button"
            className="cu-visor-seta cu-visor-esq sem-toque"
            onClick={(e) => (e.stopPropagation(), ir(-1))}
            aria-label="Foto anterior"
          >
            <ChevronLeft size={28} aria-hidden />
          </button>
          <button
            type="button"
            className="cu-visor-seta cu-visor-dir sem-toque"
            onClick={(e) => (e.stopPropagation(), ir(1))}
            aria-label="Próxima foto"
          >
            <ChevronRight size={28} aria-hidden />
          </button>
        </>
      )}
      <img src={url} alt={item.anexo.nome} onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

function realce(texto: string, termo: string): ReactNode {
  const t = semAcento(termo.trim());
  const i = semAcento(texto).indexOf(t);
  if (!t || i < 0) return texto;
  return (
    <>
      {texto.slice(0, i)}
      <mark>{texto.slice(i, i + t.length)}</mark>
      {texto.slice(i + t.length)}
    </>
  );
}
