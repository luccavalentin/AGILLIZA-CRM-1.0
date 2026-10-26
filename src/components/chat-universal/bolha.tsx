"use client";

/**
 * Uma mensagem, como num mensageiro: balão (o meu à direita, na cor da marca), citação,
 * encaminhada, fixada, anexos (foto em grade com galeria, vídeo, áudio com forma de onda e
 * velocidade 1×/1,5×/2×, documento com ícone e tamanho, anexo do chat antigo), texto com
 * links e prévia do link, hora e vistos (✓ enviada, ✓✓ entregue, ✓✓ azul lida), reações e
 * o menu (reagir, responder, copiar, encaminhar, fixar, editar, dados, denunciar, apagar).
 * Celular: toque longo abre o menu como folha de baixo; monitor: seta ao passar o mouse.
 */
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import {
  Ban,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  Copy,
  CornerUpLeft,
  Download,
  ExternalLink,
  FileText,
  Flag,
  Forward,
  History,
  Info,
  Pause,
  Pencil,
  Pin,
  PinOff,
  Play,
  Plus,
  RotateCw,
  Trash2,
  X,
} from "lucide-react";
import type { ApiChat, MensagemChat, PreviaLink } from "./tipos";
import {
  EMOJIS,
  REACOES_RAPIDAS,
  barrasDaOnda,
  duracao,
  hora,
  partesComLinks,
  primeiroLink,
  resumoMensagem,
  tamanho,
} from "./util";

export type AcoesBolha = {
  responder: (m: MensagemChat) => void;
  reagir: (m: MensagemChat, emoji: string) => void;
  editar: (m: MensagemChat) => void;
  apagar: (m: MensagemChat) => void;
  encaminhar: (m: MensagemChat) => void;
  fixar?: (m: MensagemChat, fixar: boolean) => void;
  denunciar?: (m: MensagemChat) => void;
  leituras?: (m: MensagemChat) => void;
  irPara: (id: string) => void;
  abrirImagem: (mensagemId: string, anexoId: string) => void;
  reenviar: (m: MensagemChat) => void;
  abrirAnexoAntigo?: (m: MensagemChat) => void;
};

export function Bolha({
  m,
  comeca,
  termina,
  destaque,
  acoes,
  grupo,
  api,
}: {
  m: MensagemChat;
  comeca: boolean;
  termina: boolean;
  destaque: boolean;
  acoes: AcoesBolha;
  grupo: boolean;
  api: Pick<ApiChat, "previaLink">;
}) {
  const [menu, setMenu] = useState(false);
  const [maisEmoji, setMaisEmoji] = useState(false);
  const pressao = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raiz = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!menu) return;
    const fora = (e: Event) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) {
        setMenu(false);
        setMaisEmoji(false);
      }
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && (setMenu(false), setMaisEmoji(false));
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  if (m.tipo === "sistema") {
    return (
      <li className="ec-sistema" data-msg={m.id}>
        <span>{m.corpo}</span>
      </li>
    );
  }

  const pode = !m.apagada && !m.local;
  const fechar = () => {
    setMenu(false);
    setMaisEmoji(false);
  };
  const fazer = (f: () => void) => () => {
    fechar();
    f();
  };
  const imagens = m.anexos.filter((a) => a.mime.startsWith("image/") && a.url);
  const outros = m.anexos.filter((a) => !a.mime.startsWith("image/"));
  const link = !m.apagada && m.tipo === "texto" ? primeiroLink(m.corpo) : null;

  return (
    <li
      ref={raiz}
      data-msg={m.id}
      className={clsx(
        "ec-linha",
        m.meu ? "ec-minha" : "ec-dele",
        comeca && "ec-comeca",
        destaque && "ec-destaque",
      )}
      onContextMenu={(e) => {
        if (!pode) return;
        e.preventDefault();
        setMenu(true);
      }}
      onTouchStart={() => {
        if (!pode) return;
        pressao.current = setTimeout(() => {
          setMenu(true);
          try {
            navigator.vibrate?.(12);
          } catch {
            /* sem vibração */
          }
        }, 450);
      }}
      onTouchEnd={() => pressao.current && clearTimeout(pressao.current)}
      onTouchMove={() => pressao.current && clearTimeout(pressao.current)}
    >
      <div
        className={clsx(
          "ec-balao",
          m.apagada && "ec-apagada",
          termina && "ec-cauda",
          m.local === "falhou" && "ec-falhou",
        )}
      >
        {pode && (
          <button
            type="button"
            className="ec-seta sem-toque"
            aria-label="Opções da mensagem"
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu((x) => !x)}
          >
            <ChevronDown size={16} aria-hidden />
          </button>
        )}

        {comeca && !m.meu && m.autor && grupo && <p className="ec-autor">{m.autor}</p>}
        {(m.encaminhada || m.fixada || m.legado) && !m.apagada && (
          <p className="ec-encaminhada cu-etiquetas">
            {m.fixada && (
              <span>
                <Pin size={12} aria-hidden /> Fixada
              </span>
            )}
            {m.encaminhada && (
              <span>
                <Forward size={12} aria-hidden /> Encaminhada
              </span>
            )}
            {m.legado && (
              <span>
                <History size={12} aria-hidden /> Do chat anterior
              </span>
            )}
          </p>
        )}

        {m.responde && !m.apagada && (
          <button
            type="button"
            className="ec-citacao sem-toque"
            onClick={() => acoes.irPara(m.responde!.id)}
          >
            <b>{m.responde.meu ? "Você" : (m.responde.autor ?? "Mensagem")}</b>
            <span>
              {m.responde.apagada
                ? "Mensagem apagada"
                : resumoMensagem({ tipo: m.responde.tipo, corpo: m.responde.corpo })}
            </span>
          </button>
        )}

        {m.apagada ? (
          <p className="ec-texto ec-texto-apagado">
            <Ban size={14} aria-hidden />{" "}
            {m.meu ? "Você apagou esta mensagem" : "Esta mensagem foi apagada"}
          </p>
        ) : (
          <>
            {imagens.length > 0 && <GradeImagens m={m} abrir={acoes.abrirImagem} />}
            {m.tipo === "audio" && m.anexos[0]?.url && (
              <Tocador id={m.id} url={m.anexos[0].url} ms={m.duracao_ms ?? 0} meu={m.meu} />
            )}
            {m.tipo !== "audio" &&
              outros.map((a) =>
                a.mime.startsWith("video/") && a.url ? (
                  <video
                    key={a.id}
                    className="ec-video cu-video"
                    src={a.url}
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <a
                    key={a.id}
                    href={a.url ? `${a.url}${a.url.includes("?") ? "&" : "?"}baixar=1` : undefined}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="ec-arquivo"
                  >
                    <span className="ec-arquivo-icone">
                      <FileText size={20} aria-hidden />
                    </span>
                    <span className="cu-min0">
                      <b>{a.nome}</b>
                      <small>
                        {(a.nome.split(".").pop() ?? a.mime.split("/")[1] ?? "")
                          .toUpperCase()
                          .slice(0, 6)}{" "}
                        · {tamanho(a.tamanho)}
                      </small>
                    </span>
                    <Download size={16} className="cu-sem-encolher" aria-hidden />
                  </a>
                ),
              )}
            {m.legado?.anexo && (
              <button
                type="button"
                className="ec-arquivo cu-anexo-antigo"
                onClick={() => acoes.abrirAnexoAntigo?.(m)}
              >
                <span className="ec-arquivo-icone">
                  <History size={20} aria-hidden />
                </span>
                <span className="cu-min0">
                  <b>
                    {m.legado.anexo.nome ?? (m.legado.anexo.caminho ?? "arquivo").split("/").pop()}
                  </b>
                  <small>Anexo do chat anterior</small>
                </span>
                <ExternalLink size={16} className="cu-sem-encolher" aria-hidden />
              </button>
            )}
            {m.corpo && (
              <p className="ec-texto">
                {partesComLinks(m.corpo).map((p, i) =>
                  p.url ? (
                    <a
                      key={i}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer noopener nofollow"
                      className="cu-link"
                    >
                      {p.texto}
                    </a>
                  ) : (
                    <span key={i}>{p.texto}</span>
                  ),
                )}
              </p>
            )}
            {link && api.previaLink && <Previa url={link} api={api} />}
          </>
        )}

        <span className="ec-meta">
          {m.editada && !m.apagada && <span>editada</span>}
          <span>{hora(m.criado_em)}</span>
          {m.meu && !m.apagada && <Visto m={m} />}
        </span>
      </div>

      {m.local === "falhou" && (
        <button type="button" className="ec-reenviar sem-toque" onClick={() => acoes.reenviar(m)}>
          <RotateCw size={14} aria-hidden /> Não saiu. Tocar para reenviar
        </button>
      )}

      {m.reacoes.length > 0 && (
        <ul className="ec-reacoes" aria-label="Reações">
          {m.reacoes.map((r) => (
            <li key={r.emoji}>
              <button
                type="button"
                className={clsx("sem-toque", r.minha && "ec-reacao-minha")}
                onClick={() => acoes.reagir(m, r.emoji)}
                aria-label={`${r.emoji} ${r.total}${r.minha ? ", sua reação: tocar para tirar" : ""}`}
              >
                {r.emoji}
                {r.total > 1 && <span className="num">{r.total}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {menu && (
        <div className="ec-menu" role="menu">
          <div className="ec-menu-reacoes">
            {REACOES_RAPIDAS.map((e) => (
              <button
                key={e}
                type="button"
                className="sem-toque"
                onClick={fazer(() => acoes.reagir(m, e))}
                aria-label={`Reagir com ${e}`}
              >
                {e}
              </button>
            ))}
            <button
              type="button"
              className="sem-toque ec-menu-mais"
              onClick={() => setMaisEmoji((x) => !x)}
              aria-label="Mais reações"
            >
              <Plus size={16} aria-hidden />
            </button>
          </div>
          {maisEmoji && (
            <div className="ec-menu-emojis">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="sem-toque"
                  onClick={fazer(() => acoes.reagir(m, e))}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
          <button type="button" role="menuitem" onClick={fazer(() => acoes.responder(m))}>
            <CornerUpLeft size={16} aria-hidden /> Responder
          </button>
          {m.corpo && (
            <button
              type="button"
              role="menuitem"
              onClick={fazer(() => void navigator.clipboard?.writeText(m.corpo ?? ""))}
            >
              <Copy size={16} aria-hidden /> Copiar
            </button>
          )}
          <button type="button" role="menuitem" onClick={fazer(() => acoes.encaminhar(m))}>
            <Forward size={16} aria-hidden /> Encaminhar
          </button>
          {acoes.fixar && (
            <button type="button" role="menuitem" onClick={fazer(() => acoes.fixar!(m, !m.fixada))}>
              {m.fixada ? <PinOff size={16} aria-hidden /> : <Pin size={16} aria-hidden />}{" "}
              {m.fixada ? "Desafixar" : "Fixar"}
            </button>
          )}
          {m.pode_editar && m.tipo === "texto" && (
            <button type="button" role="menuitem" onClick={fazer(() => acoes.editar(m))}>
              <Pencil size={16} aria-hidden /> Editar
            </button>
          )}
          {m.meu && acoes.leituras && (
            <button type="button" role="menuitem" onClick={fazer(() => acoes.leituras!(m))}>
              <Info size={16} aria-hidden /> Dados da mensagem
            </button>
          )}
          {!m.meu && acoes.denunciar && (
            <button type="button" role="menuitem" onClick={fazer(() => acoes.denunciar!(m))}>
              <Flag size={16} aria-hidden /> Denunciar
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="ec-menu-perigo"
            onClick={fazer(() => acoes.apagar(m))}
          >
            <Trash2 size={16} aria-hidden /> Apagar
          </button>
          <button
            type="button"
            className="ec-menu-fechar sem-toque"
            onClick={fechar}
            aria-label="Fechar o menu"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      )}
    </li>
  );
}

function Visto({ m }: { m: MensagemChat }) {
  if (m.local === "enviando") return <Clock className="ec-visto" size={14} aria-label="enviando" />;
  if (m.local === "falhou") return null;
  if (m.status === "lida")
    return <CheckCheck className="ec-visto ec-visto-lida" size={16} aria-label="lida" />;
  if (m.status === "entregue")
    return <CheckCheck className="ec-visto" size={16} aria-label="entregue" />;
  return <Check className="ec-visto" size={16} aria-label="enviada" />;
}

function GradeImagens({
  m,
  abrir,
}: {
  m: MensagemChat;
  abrir: (mensagemId: string, anexoId: string) => void;
}) {
  const lista = m.anexos.filter((a) => a.mime.startsWith("image/") && a.url);
  const mostrar = lista.slice(0, 4);
  return (
    <div className={clsx("ec-imagens", `ec-imagens-${Math.min(4, mostrar.length)}`)}>
      {mostrar.map((a, i) => (
        <button
          key={a.id}
          type="button"
          className="sem-toque"
          onClick={() => abrir(m.id, a.id)}
          aria-label={`Ampliar ${a.nome}`}
        >
          <img
            src={a.url}
            alt={a.nome}
            loading="lazy"
            width={a.largura}
            height={a.altura}
            style={
              a.largura && a.altura && lista.length === 1
                ? { aspectRatio: `${a.largura} / ${a.altura}` }
                : undefined
            }
          />
          {i === 3 && lista.length > 4 && (
            <span className="ec-imagens-mais">+{lista.length - 4}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Tocador de voz: play/pausa, forma de onda que se toca/arrasta, tempo e 1×/1,5×/2×. */
function Tocador({ id, url, ms, meu }: { id: string; url: string; ms: number; meu: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [pos, setPos] = useState(0);
  const [vel, setVel] = useState(1);
  const [dur, setDur] = useState(ms / 1000);
  const barras = barrasDaOnda(id, 34);
  const total = dur || ms / 1000 || 0;
  const fracao = total ? Math.min(1, pos / total) : 0;

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const t = () => setPos(a.currentTime);
    const fim = () => {
      setTocando(false);
      setPos(0);
    };
    const meta = () => Number.isFinite(a.duration) && a.duration > 0 && setDur(a.duration);
    a.addEventListener("timeupdate", t);
    a.addEventListener("ended", fim);
    a.addEventListener("loadedmetadata", meta);
    return () => {
      a.removeEventListener("timeupdate", t);
      a.removeEventListener("ended", fim);
      a.removeEventListener("loadedmetadata", meta);
    };
  }, []);

  const irPara = (f: number) => {
    const a = audio.current;
    if (!a || !total) return;
    a.currentTime = Math.max(0, Math.min(total, f * total));
    setPos(a.currentTime);
  };

  return (
    <div className={clsx("ec-audio cu-audio", meu && "ec-audio-meu")}>
      <audio ref={audio} src={url} preload="metadata" />
      <button
        type="button"
        className="ec-audio-play sem-toque"
        aria-label={tocando ? "Pausar" : "Ouvir"}
        onClick={() => {
          const a = audio.current;
          if (!a) return;
          if (tocando) {
            a.pause();
            setTocando(false);
          } else {
            document.querySelectorAll("audio").forEach((x) => x !== a && x.pause());
            a.playbackRate = vel;
            void a
              .play()
              .then(() => setTocando(true))
              .catch(() => setTocando(false));
          }
        }}
      >
        {tocando ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
      </button>
      <div
        className="cu-onda"
        role="slider"
        tabIndex={0}
        aria-label="Posição do áudio"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(pos)}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          irPara((e.clientX - r.left) / r.width);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") irPara(fracao + 0.05);
          if (e.key === "ArrowLeft") irPara(fracao - 0.05);
        }}
      >
        {barras.map((b, i) => (
          <i
            key={i}
            className={clsx(i / barras.length < fracao && "cu-onda-tocada")}
            style={{ height: `${Math.round(b * 100)}%` }}
          />
        ))}
      </div>
      <span className="num ec-audio-tempo">
        {duracao((tocando || pos > 0 ? pos : total) * 1000)}
      </span>
      <button
        type="button"
        className="ec-audio-vel sem-toque num"
        aria-label={`Velocidade ${vel}×`}
        onClick={() => {
          const v = vel === 1 ? 1.5 : vel === 1.5 ? 2 : 1;
          setVel(v);
          if (audio.current) audio.current.playbackRate = v;
        }}
      >
        {String(vel).replace(".", ",")}×
      </button>
    </div>
  );
}

/** Cache da prévia por endereço (a mesma URL repetida no fio não busca de novo). */
const cachePrevia = new Map<string, Promise<PreviaLink | null>>();

function Previa({ url, api }: { url: string; api: Pick<ApiChat, "previaLink"> }) {
  const [p, setP] = useState<PreviaLink | null>(null);
  useEffect(() => {
    let vale = true;
    let busca = cachePrevia.get(url);
    if (!busca) {
      busca = api.previaLink!(url)
        .then((r) => (r.ok ? (r.dados ?? null) : null))
        .catch(() => null);
      cachePrevia.set(url, busca);
    }
    void busca.then((x) => vale && setP(x));
    return () => {
      vale = false;
    };
  }, [url, api]);
  if (!p || (!p.titulo && !p.descricao)) return null;
  return (
    <a href={p.url} target="_blank" rel="noreferrer noopener nofollow" className="cu-previa-link">
      <small>{p.dominio}</small>
      {p.titulo && <b>{p.titulo}</b>}
      {p.descricao && <span>{p.descricao}</span>}
    </a>
  );
}
