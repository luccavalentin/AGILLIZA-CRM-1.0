"use client";

/**
 * Onde se escreve: texto com emoji, anexos (foto e vídeo com prévia e legenda, documento,
 * câmera do celular, colar imagem, arrastar e soltar), áudio gravado no navegador com a
 * forma de onda ao vivo, responder e editar. Rascunho por conversa (neste aparelho).
 *
 * Enter envia no monitor; no celular Enter quebra a linha e quem envia é o botão (como no
 * WhatsApp). Campo com 16 px no celular, senão o iPhone dá zoom.
 */
import clsx from "clsx";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  Camera,
  Check,
  FileText,
  Image as IconeImagem,
  Loader2,
  Mic,
  Paperclip,
  Send,
  Smile,
  Square,
  Trash2,
  Video,
  X,
} from "lucide-react";
import type { AnexoChat, ApiChat, MensagemChat } from "./tipos";
import { MIMES_CONVERSA, TETO_ANEXO_BYTES } from "./tipos";
import { EMOJIS, duracao, reduzirImagem, resumoMensagem, tamanho } from "./util";

export type EnvioCompositor = {
  corpo: string;
  anexos?: (AnexoChat & { largura?: number; altura?: number })[];
  duracaoMs?: number;
};

export type CompositorRef = { adicionar: (lista: FileList | File[]) => void };

type Pendente = { chave: string; arquivo: File; url: string | null; progresso: number };

const ACEITA_IMAGEM = "image/jpeg,image/png,image/webp";
const ACEITA_VIDEO = "video/mp4,video/quicktime,video/webm";
const ACEITA_DOC =
  MIMES_CONVERSA.filter(
    (m) => !m.startsWith("image/") && !m.startsWith("audio/") && !m.startsWith("video/"),
  ).join(",") + ",.doc,.docx,.xls,.xlsx,.odt,.ods,.txt,.csv,.pdf";

async function dimensoes(arquivo: File): Promise<{ largura?: number; altura?: number }> {
  try {
    const b = await createImageBitmap(arquivo);
    return { largura: b.width, altura: b.height };
  } catch {
    return {};
  }
}

export const Compositor = forwardRef<
  CompositorRef,
  {
    api: Pick<ApiChat, "enviarArquivo">;
    conversaId: string;
    nomeContraparte: string;
    respondendo: MensagemChat | null;
    editando: MensagemChat | null;
    aoCancelarContexto: () => void;
    aoEnviar: (e: EnvioCompositor) => Promise<boolean>;
    aoEditar: (corpo: string) => Promise<boolean>;
    aoDigitar: () => void;
    aoErro: (m: string) => void;
  }
>(function Compositor(
  {
    api,
    conversaId,
    nomeContraparte,
    respondendo,
    editando,
    aoCancelarContexto,
    aoEnviar,
    aoEditar,
    aoDigitar,
    aoErro,
  },
  ref,
) {
  const [texto, setTexto] = useState("");
  const [emoji, setEmoji] = useState(false);
  const [menuAnexo, setMenuAnexo] = useState(false);
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [legenda, setLegenda] = useState("");
  const [enviando, setEnviando] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const seletorImagem = useRef<HTMLInputElement>(null);
  const seletorVideo = useRef<HTMLInputElement>(null);
  const seletorCamera = useRef<HTMLInputElement>(null);
  const seletorDoc = useRef<HTMLInputElement>(null);
  const ultimoDigitar = useRef(0);
  const toque = useRef(false);

  useEffect(() => {
    toque.current = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  }, []);
  useEffect(() => {
    if (editando) {
      setTexto(editando.corpo ?? "");
      campo.current?.focus();
    }
  }, [editando]);
  useEffect(() => {
    if (respondendo) campo.current?.focus();
  }, [respondendo]);

  // Rascunho por conversa (só neste aparelho): trocar de conversa não perde o que estava escrito.
  useEffect(() => {
    try {
      setTexto(localStorage.getItem(`cu-rascunho:${conversaId}`) ?? "");
    } catch {
      setTexto("");
    }
    setPendentes([]);
    setLegenda("");
  }, [conversaId]);
  useEffect(() => {
    if (editando) return;
    try {
      if (texto) localStorage.setItem(`cu-rascunho:${conversaId}`, texto);
      else localStorage.removeItem(`cu-rascunho:${conversaId}`);
    } catch {
      /* armazenamento bloqueado: só não guarda o rascunho */
    }
  }, [texto, conversaId, editando]);

  useEffect(() => {
    const c = campo.current;
    if (!c) return;
    c.style.height = "auto";
    c.style.height = `${Math.min(c.scrollHeight, 148)}px`;
  }, [texto]);

  const gravacao = useGravador({
    aoTerminar: async (blob, ms) => {
      setEnviando(true);
      try {
        const tipo = blob.type.split(";")[0] || "audio/webm";
        const ext = tipo.includes("mp4") ? "m4a" : tipo.includes("ogg") ? "ogg" : "webm";
        const a = await api.enviarArquivo(
          conversaId,
          new File([blob], `audio.${ext}`, { type: tipo }),
          () => {},
        );
        await aoEnviar({ corpo: "", anexos: [a], duracaoMs: ms });
      } catch (e) {
        aoErro(e instanceof Error ? e.message : "Falha ao enviar o áudio.");
      } finally {
        setEnviando(false);
      }
    },
    aoFalhar: aoErro,
  });

  const mandarTexto = async () => {
    const corpo = texto.trim();
    if (!corpo || enviando) return;
    if (editando) {
      setEnviando(true);
      const ok = await aoEditar(corpo);
      setEnviando(false);
      if (ok) setTexto("");
      return;
    }
    setTexto("");
    setEmoji(false);
    const ok = await aoEnviar({ corpo });
    if (!ok) setTexto((t) => t || corpo);
  };

  const escolher = (lista: FileList | File[] | null) => {
    setMenuAnexo(false);
    if (!lista || lista.length === 0) return;
    const novos: Pendente[] = [];
    for (const f of Array.from(lista).slice(0, Math.max(0, 10 - pendentes.length))) {
      if (f.size > TETO_ANEXO_BYTES * 4) {
        aoErro(`${f.name} é grande demais.`);
        continue;
      }
      if (f.type && !(MIMES_CONVERSA as readonly string[]).includes(f.type.split(";")[0]!)) {
        aoErro(`${f.name}: tipo de arquivo não aceito.`);
        continue;
      }
      novos.push({
        chave: `${f.name}-${f.size}-${Math.random()}`,
        arquivo: f,
        url:
          f.type.startsWith("image/") || f.type.startsWith("video/")
            ? URL.createObjectURL(f)
            : null,
        progresso: 0,
      });
    }
    setPendentes((p) => [...p, ...novos]);
    for (const s of [seletorImagem, seletorVideo, seletorCamera, seletorDoc])
      if (s.current) s.current.value = "";
  };

  useImperativeHandle(ref, () => ({ adicionar: (lista) => escolher(lista) }));

  const mandarAnexos = async () => {
    if (enviando || pendentes.length === 0) return;
    setEnviando(true);
    const lote = pendentes;
    try {
      const prontos: NonNullable<EnvioCompositor["anexos"]> = [];
      for (const p of lote) {
        let arquivo = p.arquivo;
        if (arquivo.type.startsWith("image/"))
          arquivo = await reduzirImagem(arquivo, { ladoMaximo: 1920, qualidade: 0.82 });
        if (arquivo.size > TETO_ANEXO_BYTES) throw new Error(`${p.arquivo.name} passa de 16 MB.`);
        const dims = arquivo.type.startsWith("image/") ? await dimensoes(arquivo) : {};
        const a = await api.enviarArquivo(conversaId, arquivo, (x) =>
          setPendentes((l) => l.map((y) => (y.chave === p.chave ? { ...y, progresso: x } : y))),
        );
        prontos.push({ ...a, ...dims });
      }
      // Fotos juntas numa mensagem; vídeo e documento um por mensagem (como no WhatsApp).
      const imagens = prontos.filter((a) => a.mime.startsWith("image/"));
      const outros = prontos.filter((a) => !a.mime.startsWith("image/"));
      let ok = true;
      if (imagens.length) ok = (await aoEnviar({ corpo: legenda.trim(), anexos: imagens })) && ok;
      for (const d of outros)
        ok = (await aoEnviar({ corpo: imagens.length ? "" : legenda.trim(), anexos: [d] })) && ok;
      if (ok) {
        lote.forEach((p) => p.url && URL.revokeObjectURL(p.url));
        const enviados = new Set(lote.map((p) => p.chave));
        setPendentes((l) => l.filter((p) => !enviados.has(p.chave)));
        setLegenda("");
      }
    } catch (e) {
      aoErro(e instanceof Error ? e.message : "Falha ao enviar o arquivo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="ec-rodape">
      {pendentes.length > 0 && (
        <div className="ec-previa" role="dialog" aria-label="Arquivos para enviar">
          <div className="ec-previa-topo">
            <b>
              {pendentes.length === 1 ? "1 arquivo" : `${pendentes.length} arquivos`} para{" "}
              {nomeContraparte}
            </b>
            <button
              type="button"
              className="ec-icone sem-toque"
              aria-label="Descartar os arquivos"
              onClick={() => {
                pendentes.forEach((p) => p.url && URL.revokeObjectURL(p.url));
                setPendentes([]);
              }}
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          <ul className="ec-previa-lista">
            {pendentes.map((p) => (
              <li key={p.chave}>
                {p.url && p.arquivo.type.startsWith("image/") ? (
                  <img src={p.url} alt={p.arquivo.name} />
                ) : p.url ? (
                  <video
                    src={p.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="cu-previa-video"
                  />
                ) : (
                  <span className="ec-previa-doc">
                    <FileText size={24} aria-hidden />
                    <small>{p.arquivo.name}</small>
                    <small className="num">{tamanho(p.arquivo.size)}</small>
                  </span>
                )}
                {enviando && (
                  <span
                    className="ec-previa-progresso"
                    style={{ ["--p" as string]: `${Math.round(p.progresso * 100)}%` }}
                  />
                )}
                {!enviando && (
                  <button
                    type="button"
                    className="ec-previa-tirar sem-toque"
                    aria-label={`Tirar ${p.arquivo.name}`}
                    onClick={() => setPendentes((l) => l.filter((x) => x.chave !== p.chave))}
                  >
                    <X size={14} aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="ec-compositor">
            <input
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !toque.current && (e.preventDefault(), void mandarAnexos())
              }
              placeholder="Escreva uma legenda…"
              aria-label="Legenda"
              className="ec-campo"
              maxLength={4000}
            />
            <button
              type="button"
              className="ec-enviar sem-toque"
              onClick={() => void mandarAnexos()}
              disabled={enviando}
              aria-label="Enviar os arquivos"
            >
              {enviando ? (
                <Loader2 size={20} className="cu-girar" aria-hidden />
              ) : (
                <Send size={20} aria-hidden />
              )}
            </button>
          </div>
        </div>
      )}

      {(respondendo || editando) && (
        <div className="ec-contexto">
          <div className="cu-min0 cu-flex1">
            <b>
              {editando
                ? "Editando a mensagem"
                : respondendo!.meu
                  ? "Respondendo a você"
                  : `Respondendo a ${respondendo!.autor ?? nomeContraparte}`}
            </b>
            <span>{resumoMensagem(editando ?? respondendo!)}</span>
          </div>
          <button
            type="button"
            className="ec-icone sem-toque"
            aria-label="Cancelar"
            onClick={() => {
              if (editando) setTexto("");
              aoCancelarContexto();
            }}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      )}

      {emoji && (
        <div className="ec-emojis" role="listbox" aria-label="Emojis">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              className="sem-toque"
              onClick={() => {
                const c = campo.current;
                const ini = c?.selectionStart ?? texto.length;
                const fim = c?.selectionEnd ?? texto.length;
                setTexto(texto.slice(0, ini) + e + texto.slice(fim));
                requestAnimationFrame(() => {
                  c?.focus();
                  c?.setSelectionRange(ini + e.length, ini + e.length);
                });
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {gravacao.gravando ? (
        <div className="ec-gravando" role="status">
          <button
            type="button"
            className="ec-icone sem-toque"
            onClick={gravacao.cancelar}
            aria-label="Descartar o áudio"
          >
            <Trash2 size={20} aria-hidden />
          </button>
          <span className="ec-gravando-ponto" aria-hidden />
          <span className="num">{duracao(gravacao.decorridoMs)}</span>
          <span className="cu-onda cu-onda-viva" aria-hidden>
            {gravacao.niveis.map((n, i) => (
              <i key={i} style={{ height: `${Math.round(Math.max(0.12, n) * 100)}%` }} />
            ))}
          </span>
          <button
            type="button"
            className="ec-enviar sem-toque"
            onClick={gravacao.parar}
            aria-label="Parar e enviar o áudio"
          >
            <Square size={16} className="cu-preenchido" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="ec-compositor">
          <button
            type="button"
            className={clsx("ec-icone sem-toque", emoji && "ec-icone-ativo")}
            aria-label="Emojis"
            aria-expanded={emoji}
            onClick={() => setEmoji((x) => !x)}
          >
            <Smile size={20} aria-hidden />
          </button>
          <div className="cu-relativo">
            <button
              type="button"
              className="ec-icone sem-toque"
              aria-label="Anexar"
              aria-expanded={menuAnexo}
              onClick={() => setMenuAnexo((x) => !x)}
              disabled={!!editando}
            >
              <Paperclip size={20} aria-hidden />
            </button>
            {menuAnexo && (
              <div className="ec-menu-anexo" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => seletorImagem.current?.click()}
                >
                  <IconeImagem size={16} aria-hidden /> Fotos
                </button>
                <button type="button" role="menuitem" onClick={() => seletorVideo.current?.click()}>
                  <Video size={16} aria-hidden /> Vídeo
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="cu-so-celular"
                  onClick={() => seletorCamera.current?.click()}
                >
                  <Camera size={16} aria-hidden /> Câmera
                </button>
                <button type="button" role="menuitem" onClick={() => seletorDoc.current?.click()}>
                  <FileText size={16} aria-hidden /> Documento
                </button>
              </div>
            )}
            <input
              ref={seletorImagem}
              type="file"
              accept={ACEITA_IMAGEM}
              multiple
              hidden
              onChange={(e) => escolher(e.target.files)}
            />
            <input
              ref={seletorVideo}
              type="file"
              accept={ACEITA_VIDEO}
              hidden
              onChange={(e) => escolher(e.target.files)}
            />
            <input
              ref={seletorCamera}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => escolher(e.target.files)}
            />
            <input
              ref={seletorDoc}
              type="file"
              accept={ACEITA_DOC}
              multiple
              hidden
              onChange={(e) => escolher(e.target.files)}
            />
          </div>
          <textarea
            ref={campo}
            rows={1}
            value={texto}
            maxLength={4000}
            onChange={(e) => {
              setTexto(e.target.value);
              const agora = Date.now();
              if (e.target.value && agora - ultimoDigitar.current > 2500) {
                ultimoDigitar.current = agora;
                aoDigitar();
              }
            }}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !toque.current &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void mandarTexto();
              }
              if (e.key === "Escape" && (respondendo || editando)) {
                if (editando) setTexto("");
                aoCancelarContexto();
              }
            }}
            onPaste={(e) => {
              const arquivos = e.clipboardData?.files;
              if (arquivos && arquivos.length > 0) {
                e.preventDefault();
                escolher(arquivos);
              }
            }}
            placeholder={editando ? "Corrija a mensagem…" : "Mensagem"}
            aria-label="Mensagem"
            className="ec-campo"
          />
          {texto.trim() || editando ? (
            <button
              type="button"
              className="ec-enviar sem-toque"
              onClick={() => void mandarTexto()}
              disabled={enviando || !texto.trim()}
              aria-label={editando ? "Salvar a edição" : "Enviar"}
            >
              {enviando ? (
                <Loader2 size={20} className="cu-girar" aria-hidden />
              ) : editando ? (
                <Check size={20} aria-hidden />
              ) : (
                <Send size={20} aria-hidden />
              )}
            </button>
          ) : (
            <button
              type="button"
              className="ec-enviar sem-toque"
              onClick={() => void gravacao.comecar()}
              disabled={!gravacao.disponivel || enviando}
              aria-label="Gravar mensagem de voz"
              title={
                gravacao.disponivel ? "Gravar mensagem de voz" : "Este navegador não grava áudio"
              }
            >
              {enviando ? (
                <Loader2 size={20} className="cu-girar" aria-hidden />
              ) : (
                <Mic size={20} aria-hidden />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
});

/**
 * Gravador (MediaRecorder) com a forma de onda ao vivo (AnalyserNode). A trilha do
 * microfone sempre para no fim (senão a luz do microfone fica acesa). Teto de 15 min;
 * menos de 1 segundo é esbarrão.
 */
function useGravador({
  aoTerminar,
  aoFalhar,
}: {
  aoTerminar: (b: Blob, ms: number) => void;
  aoFalhar: (m: string) => void;
}) {
  const [gravando, setGravando] = useState(false);
  const [decorridoMs, setDecorrido] = useState(0);
  const [disponivel, setDisponivel] = useState(false);
  const [niveis, setNiveis] = useState<number[]>(() => Array(28).fill(0.12));
  const gravador = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const inicio = useRef(0);
  const cancelado = useRef(false);
  const audioCtx = useRef<AudioContext | null>(null);
  const quadro = useRef<number | null>(null);

  useEffect(() => {
    setDisponivel(
      typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
    );
  }, []);
  useEffect(() => {
    if (!gravando) return;
    const t = setInterval(() => {
      const d = Date.now() - inicio.current;
      setDecorrido(d);
      if (d >= 15 * 60 * 1000) gravador.current?.stop();
    }, 200);
    return () => clearInterval(t);
  }, [gravando]);

  const pararOnda = () => {
    if (quadro.current) cancelAnimationFrame(quadro.current);
    quadro.current = null;
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
    setNiveis(Array(28).fill(0.12));
  };

  const comecar = async () => {
    try {
      const trilha = await navigator.mediaDevices.getUserMedia({ audio: true });
      const g = new MediaRecorder(trilha);
      pedacos.current = [];
      cancelado.current = false;
      g.ondataavailable = (e) => e.data.size > 0 && pedacos.current.push(e.data);
      g.onstop = () => {
        const ms = Date.now() - inicio.current;
        const blob = new Blob(pedacos.current, { type: g.mimeType || "audio/webm" });
        trilha.getTracks().forEach((t) => t.stop());
        gravador.current = null;
        pararOnda();
        setGravando(false);
        setDecorrido(0);
        if (!cancelado.current && blob.size > 0 && ms >= 1000) aoTerminar(blob, ms);
      };
      // Onda ao vivo: volume do microfone em 28 barras que andam da direita para a esquerda.
      try {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const fonte = ctx.createMediaStreamSource(trilha);
        const analisador = ctx.createAnalyser();
        analisador.fftSize = 512;
        fonte.connect(analisador);
        audioCtx.current = ctx;
        const dados = new Uint8Array(analisador.fftSize);
        let ultimo = 0;
        const passo = (t: number) => {
          quadro.current = requestAnimationFrame(passo);
          if (t - ultimo < 90) return;
          ultimo = t;
          analisador.getByteTimeDomainData(dados);
          let soma = 0;
          for (const v of dados) soma += ((v - 128) / 128) ** 2;
          const nivel = Math.min(1, Math.sqrt(soma / dados.length) * 3.2);
          setNiveis((n) => [...n.slice(1), nivel]);
        };
        quadro.current = requestAnimationFrame(passo);
      } catch {
        /* sem Web Audio: grava sem a onda */
      }
      inicio.current = Date.now();
      gravador.current = g;
      g.start(250);
      setGravando(true);
    } catch {
      aoFalhar("Não foi possível usar o microfone. Libere a permissão no navegador.");
    }
  };
  return {
    gravando,
    decorridoMs,
    disponivel,
    niveis,
    comecar,
    parar: () => gravador.current?.stop(),
    cancelar: () => {
      cancelado.current = true;
      gravador.current?.stop();
    },
  };
}
