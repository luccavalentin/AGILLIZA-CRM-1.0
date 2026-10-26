"use client";

/**
 * Aviso flutuante de mensagem (pedido de 26/10/2026: T02), em TODAS as telas de TODOS os
 * portais, fora da tela do chat.
 *
 * Como no WhatsApp/Messenger: um ícone redondo no canto com a foto (iniciais) de quem
 * mandou e o contador; ao chegar mensagem, abre ao lado o cartão "Fulano mandou mensagem"
 * com a prévia TAPADA (o servidor nem manda o texto: `chat.avisos` devolve só quem, quantas
 * e o tipo) e os botões Ver (abre a conversa) e Ocultar (aquela mensagem não volta). Várias
 * conversas viram "3 novas mensagens de 2 conversas". Pedido de mensagem de quem é de fora
 * aparece à parte. Som opcional; conversa silenciada, "não perturbe" e a preferência de
 * aviso são respeitados pelo banco. O cartão recolhe sozinho para o ícone depois de 12 s.
 * Sem dependência além de react e lucide-react: também roda no portal público do ImobMatch.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, EyeOff, Inbox, MessageCircle, X } from "lucide-react";
import type { ApiChat, AvisoNovo, Avisos, EventoChat } from "./tipos";
import { publicarContadorChat } from "./contador";
import { iniciais, resumoAvisos, rotuloTipo, tocarBipe } from "./util";
import "./chat-universal.css";

const CHAVE_DESDE = "cu-aviso-desde";

export function AvisoChat({
  api,
  usuarioId,
  ativo,
  abrir,
  assinar,
  intervaloMs,
}: {
  api: Pick<ApiChat, "avisos" | "ocultarAviso">;
  usuarioId: string;
  /** Falso na própria tela do chat (lá a mensagem já aparece). */
  ativo: boolean;
  /** Abre a conversa (ou a lista, com `null`; `pedidos` abre a aba de pedidos). */
  abrir: (conversaId: string | null, pedidos?: boolean) => void;
  assinar?: (fn: (e: EventoChat) => void) => () => void;
  intervaloMs?: number;
}) {
  const [novas, setNovas] = useState<AvisoNovo[]>([]);
  const [pedidos, setPedidos] = useState<Avisos["pedidos_novos"]>([]);
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState(false);
  const desde = useRef<string | null>(null);
  const vistas = useRef(new Set<string>());
  const recolher = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ativoRef = useRef(ativo);
  ativoRef.current = ativo;

  const consultar = useCallback(async () => {
    if (desde.current === null) {
      try {
        desde.current = sessionStorage.getItem(CHAVE_DESDE);
      } catch {
        desde.current = null;
      }
      desde.current ??= new Date().toISOString();
    }
    const r = await api.avisos(desde.current);
    if (!r.ok || !r.dados) return;
    const a = r.dados;
    publicarContadorChat(a.nao_lidas + a.pedidos);
    if (!ativoRef.current) {
      setNovas([]);
      setPedidos([]);
      return;
    }
    const chegou =
      a.novas.some((n) => !vistas.current.has(n.mensagem_id)) ||
      a.pedidos_novos.some((p) => !vistas.current.has(`p:${p.conversa_id}:${p.criado_em}`));
    for (const n of a.novas) vistas.current.add(n.mensagem_id);
    for (const p of a.pedidos_novos) vistas.current.add(`p:${p.conversa_id}:${p.criado_em}`);
    setNovas(a.novas);
    setPedidos(a.pedidos_novos);
    if (chegou && (a.novas.length || a.pedidos_novos.length)) {
      setAberto(true);
      if (recolher.current) clearTimeout(recolher.current);
      recolher.current = setTimeout(() => setAberto(false), 12_000);
      if (a.som && document.visibilityState === "visible") tocarBipe();
      try {
        navigator.vibrate?.([40, 60, 40]);
      } catch {
        /* sem vibração */
      }
    }
  }, [api]);

  // Na tela do chat, quem chegou já está visível: o ponto de partida anda junto.
  useEffect(() => {
    if (!ativo) {
      desde.current = new Date().toISOString();
      try {
        sessionStorage.setItem(CHAVE_DESDE, desde.current);
      } catch {
        /* sem armazenamento */
      }
      setNovas([]);
      setPedidos([]);
    }
    void consultar();
  }, [ativo, consultar]);

  useEffect(() => {
    let agendado: ReturnType<typeof setTimeout> | null = null;
    const pedir = () => {
      if (agendado) clearTimeout(agendado);
      agendado = setTimeout(() => void consultar(), 500);
    };
    const desligar = assinar?.((e) => {
      if (e.tipo === "chat" && (e.acao === "nova" || e.acao === "lida") && e.autor !== usuarioId)
        pedir();
    });
    const t = setInterval(
      () => document.visibilityState === "visible" && void consultar(),
      intervaloMs ?? (assinar ? 60_000 : 15_000),
    );
    const voltar = () => document.visibilityState === "visible" && void consultar();
    document.addEventListener("visibilitychange", voltar);
    return () => {
      desligar?.();
      clearInterval(t);
      if (agendado) clearTimeout(agendado);
      document.removeEventListener("visibilitychange", voltar);
    };
  }, [assinar, consultar, intervaloMs, usuarioId]);

  const ocultar = async (ids: string[]) => {
    setNovas((l) => l.filter((n) => !ids.includes(n.conversa_id)));
    setPedidos((l) => l.filter((p) => !ids.includes(p.conversa_id)));
    await api.ocultarAviso(ids);
  };

  const ver = (conversaId: string | null, ehPedido = false) => {
    setNovas((l) => (conversaId ? l.filter((n) => n.conversa_id !== conversaId) : []));
    if (ehPedido) setPedidos([]);
    setAberto(false);
    abrir(conversaId, ehPedido);
  };

  if (!ativo || (novas.length === 0 && pedidos.length === 0)) return null;

  const total = novas.reduce((s, n) => s + Math.max(1, n.total), 0);
  const primeiro = novas[0];
  const nomeIcone = primeiro?.de ?? pedidos[0]?.de ?? "?";
  const contador = total + pedidos.length;

  return (
    <div className="cu-aviso-raiz" aria-live="polite">
      {aberto && (
        <section
          className="cu-aviso-cartao"
          aria-label="Mensagens novas"
          onMouseEnter={() => recolher.current && clearTimeout(recolher.current)}
        >
          <header className="cu-aviso-topo">
            <b>
              {novas.length > 1 || (novas.length && pedidos.length)
                ? resumoAvisos(total, novas.length)
                : "Mensagem nova"}
            </b>
            <button
              type="button"
              className="cu-aviso-x sem-toque"
              onClick={() => setAberto(false)}
              aria-label="Recolher o aviso"
            >
              <X size={16} aria-hidden />
            </button>
          </header>
          {(lista || novas.length <= 2 ? novas : novas.slice(0, 1)).map((n) => (
            <article key={n.conversa_id} className="cu-aviso-item">
              <span className="cu-aviso-avatar" aria-hidden>
                {iniciais(n.de ?? "?")}
              </span>
              <span className="cu-aviso-meio">
                <b>
                  {n.de ?? "Alguém"}
                  {n.grupo ? <small> · {n.grupo}</small> : null}
                </b>
                <span className="cu-aviso-tapada" aria-label="Prévia oculta: toque em Ver para ler">
                  <span className="cu-aviso-borrao" aria-hidden>
                    ████████ ██████ ████
                  </span>
                  <em>
                    {n.total > 1 ? `${n.total} mensagens novas` : `${rotuloTipo(n.tipo)} nova`}
                  </em>
                </span>
              </span>
              <span className="cu-aviso-botoes">
                <button type="button" className="cu-aviso-ver" onClick={() => ver(n.conversa_id)}>
                  Ver
                </button>
                <button
                  type="button"
                  className="cu-aviso-ocultar"
                  onClick={() => void ocultar([n.conversa_id])}
                  aria-label={`Ocultar o aviso de ${n.de ?? "alguém"}`}
                >
                  <EyeOff size={14} aria-hidden /> Ocultar
                </button>
              </span>
            </article>
          ))}
          {novas.length > 2 && (
            <button type="button" className="cu-aviso-mais" onClick={() => setLista((x) => !x)}>
              {lista ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
              {lista ? "Mostrar menos" : `Mais ${novas.length - 1} conversas`}
            </button>
          )}
          {pedidos.map((p) => (
            <article key={p.conversa_id} className="cu-aviso-item cu-aviso-pedido">
              <span className="cu-aviso-avatar cu-aviso-avatar-pedido" aria-hidden>
                <Inbox size={16} />
              </span>
              <span className="cu-aviso-meio">
                <b>Pedido de mensagem</b>
                <em>
                  {p.de}
                  {p.arroba ? ` (@${p.arroba})` : ""} quer conversar
                </em>
              </span>
              <span className="cu-aviso-botoes">
                <button type="button" className="cu-aviso-ver" onClick={() => ver(null, true)}>
                  Ver
                </button>
                <button
                  type="button"
                  className="cu-aviso-ocultar"
                  onClick={() => void ocultar([p.conversa_id])}
                >
                  <EyeOff size={14} aria-hidden /> Ocultar
                </button>
              </span>
            </article>
          ))}
          {novas.length > 1 && (
            <footer className="cu-aviso-rodape">
              <button type="button" className="cu-aviso-ver" onClick={() => ver(null)}>
                Ver todas
              </button>
              <button
                type="button"
                className="cu-aviso-ocultar"
                onClick={() => void ocultar(novas.map((n) => n.conversa_id))}
              >
                Ocultar todas
              </button>
            </footer>
          )}
        </section>
      )}
      <button
        type="button"
        className={aberto ? "cu-aviso-icone cu-aviso-icone-aberto" : "cu-aviso-icone"}
        onClick={() => setAberto((x) => !x)}
        aria-label={`${contador} ${contador === 1 ? "mensagem nova" : "mensagens novas"}. ${aberto ? "Recolher" : "Mostrar"}`}
        aria-expanded={aberto}
      >
        {nomeIcone && nomeIcone !== "?" ? (
          <span aria-hidden>{iniciais(nomeIcone)}</span>
        ) : (
          <MessageCircle size={22} aria-hidden />
        )}
        <span className="cu-aviso-badge num">{contador > 99 ? "99+" : contador}</span>
      </button>
    </div>
  );
}
