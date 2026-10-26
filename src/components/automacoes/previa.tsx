/**
 * Prévia realista por rede (estrutura do `preview.tsx` do Postei): celular para os formatos
 * verticais (Reels, Stories, TikTok, Shorts), cartão do feed para Instagram, Facebook,
 * LinkedIn, YouTube e Google Meu Negócio. As cores dentro da prévia são as de cada rede (é o
 * que a pessoa vai ver lá); a moldura segue o padrão do Agilliza.
 */
import { useState } from "react";
import {
  Bookmark,
  CircleCheck,
  CircleX,
  Earth,
  Ellipsis,
  Heart,
  MessageCircle,
  Music2,
  Repeat2,
  Send,
  Share2,
  ThumbsUp,
} from "lucide-react";
import { REDES, type Rede } from "@/lib/social/catalogo";
import { cn } from "@/lib/utils";
import { MarcaRede } from "./comum";

export type ContaPrevia = {
  id: string;
  rede: Rede;
  nome: string;
  usuario: string | null;
  avatar_url: string | null;
};
export type MidiaPrevia = {
  id: string;
  mime: string;
  url: string | null;
  duracaoMs: number | null;
};

export function Previa({
  contas,
  formatos,
  legenda,
  legendas,
  midias,
  problemas,
  opcoes,
}: {
  contas: ContaPrevia[];
  formatos: Record<string, string>;
  legenda: string;
  legendas: Record<string, string | null>;
  midias: MidiaPrevia[];
  problemas: Record<string, string[]>;
  opcoes: Record<string, Record<string, unknown>>;
}) {
  const [aba, setAba] = useState<string | null>(null);
  const atual = contas.find((c) => c.id === aba) ?? contas[0];
  return (
    <div className="rounded-[14px] border bg-secondary/50 p-3">
      <div className="flex items-center justify-between px-1 pb-2">
        <h3 className="text-sm font-semibold">Prévia</h3>
        {contas.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {contas.length} {contas.length === 1 ? "rede" : "redes"}
          </span>
        )}
      </div>
      {contas.length > 0 && (
        <div
          className="-mx-3 mb-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none]"
          role="group"
          aria-label="Rede da prévia"
        >
          {contas.map((c) => {
            const on = c.id === atual?.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setAba(c.id)}
                aria-pressed={on}
                className={cn(
                  "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border pl-1.5 pr-3 text-[13px] transition-colors lg:h-9",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-foreground hover:border-primary/40",
                )}
              >
                <span className="grid size-6 place-items-center rounded-full bg-card">
                  <MarcaRede rede={c.rede} className="size-4" />
                </span>
                <span className="max-w-32 truncate">{c.nome}</span>
                {(problemas[c.id]?.length ?? 0) > 0 && (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-destructive"
                    aria-label="Precisa de ajuste"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
      {!atual ? (
        <PreviaVazia />
      ) : (
        <Maquete
          conta={atual}
          formato={formatos[atual.id] ?? ""}
          texto={legendas[atual.id] ?? legenda}
          midias={midias}
          opcoes={opcoes[atual.id] ?? {}}
        />
      )}
      {contas.length > 0 && (
        <ul className="mt-3 space-y-1.5 rounded-xl border bg-card p-3">
          {contas.map((c) => {
            const erros = problemas[c.id] ?? [];
            const f = REDES[c.rede].formatos.find((x) => x.id === formatos[c.id]);
            return (
              <li key={c.id} className="flex items-start gap-2 text-[12.5px]">
                {erros.length ? (
                  <CircleX className="mt-px size-4 shrink-0 text-destructive" />
                ) : (
                  <CircleCheck className="mt-px size-4 shrink-0 text-success" />
                )}
                <span className="min-w-0">
                  <span className="font-medium">{c.nome}</span>
                  <span className="text-muted-foreground"> · {f?.rotulo ?? formatos[c.id]}</span>
                  {erros.length > 0 && (
                    <span className="block text-destructive">
                      {erros.map((e) => e.split(": ").slice(1).join(": ") || e).join(" · ")}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PreviaVazia() {
  return (
    <div className="mx-auto w-full max-w-[280px] rounded-[38px] bg-foreground p-2.5 shadow-lg">
      <div className="flex aspect-[9/17] flex-col items-center justify-center gap-3 rounded-[30px] bg-card px-8 text-center">
        <div className="flex -space-x-2">
          {(["instagram", "tiktok", "linkedin"] as const).map((r) => (
            <span
              key={r}
              className="grid size-9 place-items-center rounded-[10px] bg-card ring-2 ring-card"
            >
              <MarcaRede rede={r} className="size-6" />
            </span>
          ))}
        </div>
        <p className="text-[13px] text-muted-foreground">
          Escolha uma rede para ver a prévia do post.
        </p>
      </div>
    </div>
  );
}

const arroba = (c: ContaPrevia) =>
  (c.usuario ?? c.nome.toLowerCase().replace(/\s+/g, "")).replace(/^@/, "");

function Avatar({ c, tamanho = 32 }: { c: ContaPrevia; tamanho?: number }) {
  return c.avatar_url ? (
    <img
      src={c.avatar_url}
      alt=""
      className="shrink-0 rounded-full object-cover"
      style={{ width: tamanho, height: tamanho }}
    />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-[#e9e9ee] font-semibold text-[#333]"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.4 }}
    >
      {c.nome.slice(0, 1).toUpperCase()}
    </span>
  );
}

function VerMidia({ m, className = "" }: { m?: MidiaPrevia; className?: string }) {
  if (!m || !m.url)
    return (
      <div
        className={cn("grid place-items-center bg-[#e9e9ee] text-[12px] text-[#888]", className)}
      >
        Sem mídia
      </div>
    );
  return m.mime.startsWith("video/") ? (
    <video src={m.url} className={cn("object-cover", className)} muted playsInline loop autoPlay />
  ) : (
    <img src={m.url} alt="" className={cn("object-cover", className)} />
  );
}

function TextoRico({
  texto,
  limite,
  corLink = "#00376b",
}: {
  texto: string;
  limite: number;
  corLink?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const longo = texto.length > limite;
  const mostra = aberto || !longo ? texto : texto.slice(0, limite).trimEnd();
  return (
    <>
      {mostra.split(/(#[\p{L}\p{N}_]+|@[\w.]+)/u).map((parte, i) =>
        /^[#@]/.test(parte) ? (
          <span key={i} style={{ color: corLink }}>
            {parte}
          </span>
        ) : (
          parte
        ),
      )}
      {longo && !aberto && (
        <button type="button" onClick={() => setAberto(true)} className="text-[#737373]">
          … mais
        </button>
      )}
    </>
  );
}

function Celular({ children, escuro = false }: { children: React.ReactNode; escuro?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[42px] bg-[#111] p-[9px] shadow-lg ring-1 ring-black/10">
      <div
        className={cn(
          "relative overflow-hidden rounded-[34px]",
          escuro ? "bg-black text-white" : "bg-white text-[#0f1419]",
        )}
      >
        <div className="flex h-8 items-center justify-between px-6 pt-1 text-[11px] font-semibold">
          <span>9:41</span>
          <span className="absolute left-1/2 top-2 h-[18px] w-[76px] -translate-x-1/2 rounded-full bg-black" />
          <span className="h-2 w-3.5 rounded-[2px] border border-current opacity-80" />
        </div>
        {children}
      </div>
    </div>
  );
}

function CartaoFeed({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white text-[#050505] shadow-md ring-1 ring-black/5">
      {children}
    </div>
  );
}

export function Maquete({
  conta,
  formato,
  texto,
  midias,
  opcoes,
}: {
  conta: ContaPrevia;
  formato: string;
  texto: string;
  midias: MidiaPrevia[];
  opcoes: Record<string, unknown>;
}) {
  const r = conta.rede;
  const primeira = midias[0];
  const vertical =
    ((r === "instagram" || r === "facebook") && (formato === "reel" || formato === "story")) ||
    r === "tiktok" ||
    (r === "youtube" && formato === "short");

  if (vertical) {
    return (
      <Celular escuro>
        <div className="relative -mt-8 aspect-[9/16]">
          <VerMidia m={primeira} className="absolute inset-0 size-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
          {formato === "story" ? (
            <div className="absolute inset-x-3 top-10 flex items-center gap-2">
              <Avatar c={conta} tamanho={26} />
              <span className="text-[12px] font-semibold">{arroba(conta)}</span>
              <span className="text-[11px] opacity-70">agora</span>
            </div>
          ) : (
            <>
              <div className="absolute bottom-24 right-2.5 flex flex-col items-center gap-4 text-[10px]">
                {[Heart, MessageCircle, r === "tiktok" ? Bookmark : Send, Share2].map((I, i) => (
                  <span key={i} className="flex flex-col items-center gap-0.5">
                    <I size={24} strokeWidth={1.8} />
                    {i < 2 && <span>{i === 0 ? "1,2 mil" : "48"}</span>}
                  </span>
                ))}
              </div>
              <div className="absolute inset-x-3 bottom-5 pr-12">
                <div className="flex items-center gap-2">
                  <Avatar c={conta} tamanho={28} />
                  <span className="text-[12.5px] font-semibold">
                    {r === "tiktok" ? `@${arroba(conta)}` : arroba(conta)}
                  </span>
                  {r !== "tiktok" && (
                    <span className="rounded-md border border-white/70 px-1.5 py-px text-[10.5px] font-semibold">
                      Seguir
                    </span>
                  )}
                </div>
                <p className="mt-1.5 line-clamp-3 break-words text-[12px] leading-snug">
                  {r === "youtube" && typeof opcoes.titulo === "string" && opcoes.titulo ? (
                    opcoes.titulo
                  ) : (
                    <TextoRico texto={texto} limite={90} corLink="#fff" />
                  )}
                </p>
                <p className="mt-1.5 flex items-center gap-1 text-[11px] opacity-85">
                  <Music2 size={11} /> Áudio original
                </p>
              </div>
            </>
          )}
        </div>
      </Celular>
    );
  }

  if (r === "instagram" || r === "teste") {
    return (
      <Celular>
        <div className="flex items-center gap-2 px-3 py-2">
          <span
            className="rounded-full p-[2px]"
            style={{ background: "linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf)" }}
          >
            <span className="block rounded-full bg-white p-[1.5px]">
              <Avatar c={conta} tamanho={26} />
            </span>
          </span>
          <span className="text-[12.5px] font-semibold">{arroba(conta)}</span>
          <Ellipsis size={16} className="ml-auto" />
        </div>
        <div className="relative aspect-[4/5] bg-[#efefef]">
          <VerMidia m={primeira} className="absolute inset-0 size-full" />
          {midias.length > 1 && (
            <span className="absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
              1/{midias.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3.5 px-3 pt-2.5">
          <Heart size={22} strokeWidth={1.8} />
          <MessageCircle size={22} strokeWidth={1.8} className="-scale-x-100" />
          <Send size={21} strokeWidth={1.8} />
          {midias.length > 1 && (
            <span className="mx-auto flex gap-1">
              {midias.slice(0, 5).map((_, i) => (
                <span
                  key={i}
                  className={cn("size-1.5 rounded-full", i === 0 ? "bg-[#0095f6]" : "bg-[#c7c7c7]")}
                />
              ))}
            </span>
          )}
          <Bookmark size={21} strokeWidth={1.8} className="ml-auto" />
        </div>
        <div className="px-3 pb-5 pt-2 text-[12.5px] leading-snug">
          <p className="font-semibold">1.248 curtidas</p>
          {texto && (
            <p className="mt-1 whitespace-pre-line break-words">
              <span className="mr-1 font-semibold">{arroba(conta)}</span>
              <TextoRico texto={texto} limite={110} />
            </p>
          )}
          {typeof opcoes.primeiroComentario === "string" && opcoes.primeiroComentario.trim() && (
            <p className="mt-1 break-words text-[#262626]">
              <span className="mr-1 font-semibold">{arroba(conta)}</span>
              {opcoes.primeiroComentario}
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-[#737373]">Agora mesmo</p>
        </div>
      </Celular>
    );
  }

  if (r === "facebook") {
    return (
      <CartaoFeed>
        <div className="flex items-center gap-2.5 px-3.5 pt-3">
          <Avatar c={conta} tamanho={38} />
          <div className="leading-tight">
            <p className="text-[13.5px] font-semibold">{conta.nome}</p>
            <p className="flex items-center gap-1 text-[11.5px] text-[#65676b]">
              Agora · <Earth size={11} />
            </p>
          </div>
          <Ellipsis size={18} className="ml-auto text-[#65676b]" />
        </div>
        {texto && (
          <p className="whitespace-pre-line break-words px-3.5 pb-3 pt-2.5 text-[13.5px] leading-snug">
            <TextoRico texto={texto} limite={220} corLink="#216fdb" />
          </p>
        )}
        {primeira && (
          <div className="relative">
            <VerMidia m={primeira} className="block aspect-[4/3] w-full" />
            {midias.length > 1 && (
              <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] text-white">
                +{midias.length - 1}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center justify-between px-3.5 py-2 text-[12px] text-[#65676b]">
          <span className="flex items-center gap-1">
            <span className="grid size-4 place-items-center rounded-full bg-[#1877f2] text-white">
              <ThumbsUp size={9} fill="currentColor" />
            </span>
            128
          </span>
          <span>14 comentários · 6 compartilhamentos</span>
        </div>
        <div className="mx-3.5 grid grid-cols-3 border-t border-[#ced0d4] py-1 text-[12.5px] font-semibold text-[#65676b]">
          {[
            [ThumbsUp, "Curtir"],
            [MessageCircle, "Comentar"],
            [Share2, "Compartilhar"],
          ].map(([I, l]) => {
            const Icone = I as typeof ThumbsUp;
            return (
              <span key={l as string} className="flex items-center justify-center gap-1.5 py-1.5">
                <Icone size={15} /> {l as string}
              </span>
            );
          })}
        </div>
      </CartaoFeed>
    );
  }

  if (r === "linkedin") {
    return (
      <CartaoFeed>
        <div className="flex items-start gap-2.5 px-3.5 pt-3">
          <Avatar c={conta} tamanho={42} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13.5px] font-semibold">{conta.nome}</p>
            <p className="truncate text-[11.5px] text-[#666]">AgillizaTech</p>
            <p className="flex items-center gap-1 text-[11.5px] text-[#666]">
              Agora · <Earth size={11} />
            </p>
          </div>
          <span className="ml-auto text-[13px] font-semibold text-[#0a66c2]">+ Seguir</span>
        </div>
        {texto && (
          <p className="whitespace-pre-line break-words px-3.5 pb-3 pt-2.5 text-[13px] leading-snug text-[#191919]">
            <TextoRico texto={texto} limite={210} corLink="#0a66c2" />
          </p>
        )}
        {primeira && <VerMidia m={primeira} className="block aspect-[1.2] w-full" />}
        <div className="flex items-center gap-1.5 px-3.5 py-2 text-[11.5px] text-[#666]">
          <span className="grid size-4 place-items-center rounded-full bg-[#378fe9] text-white">
            <ThumbsUp size={9} fill="currentColor" />
          </span>
          87 · 9 comentários
        </div>
        <div className="mx-2 grid grid-cols-4 border-t border-[#e8e8e8] py-1 text-[11.5px] font-semibold text-[#666]">
          {[
            [ThumbsUp, "Gostei"],
            [MessageCircle, "Comentar"],
            [Repeat2, "Compartilhar"],
            [Send, "Enviar"],
          ].map(([I, l]) => {
            const Icone = I as typeof ThumbsUp;
            return (
              <span key={l as string} className="flex flex-col items-center gap-0.5 py-1.5">
                <Icone size={15} />
                {l as string}
              </span>
            );
          })}
        </div>
      </CartaoFeed>
    );
  }

  if (r === "youtube") {
    const titulo = (
      (typeof opcoes.titulo === "string" && opcoes.titulo.trim()) ||
      texto.split("\n")[0] ||
      "Título do vídeo"
    ).slice(0, 100);
    return (
      <CartaoFeed>
        <div className="relative aspect-video bg-black">
          <VerMidia m={primeira} className="absolute inset-0 size-full" />
          {primeira?.duracaoMs ? (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1 text-[10.5px] font-medium text-white">
              {Math.floor(primeira.duracaoMs / 60000)}:
              {String(Math.round(primeira.duracaoMs / 1000) % 60).padStart(2, "0")}
            </span>
          ) : null}
        </div>
        <div className="flex gap-2.5 p-3">
          <Avatar c={conta} tamanho={34} />
          <div className="min-w-0">
            <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug">{titulo}</p>
            <p className="mt-0.5 text-[11.5px] text-[#606060]">
              {conta.nome} · 0 visualizações · agora
            </p>
          </div>
        </div>
      </CartaoFeed>
    );
  }

  // Google Meu Negócio
  const tipo = formato === "evento" ? "Evento" : formato === "oferta" ? "Oferta" : "Novidade";
  const botao =
    formato === "oferta"
      ? "Ver oferta"
      : ((
          {
            BOOK: "Reservar",
            ORDER: "Pedir",
            SHOP: "Comprar",
            SIGN_UP: "Inscrever-se",
            CALL: "Ligar",
          } as Record<string, string>
        )[String(opcoes.tipoBotao ?? "")] ?? "Saiba mais");
  return (
    <CartaoFeed>
      <div className="flex items-center gap-2.5 px-3.5 pt-3">
        <Avatar c={conta} tamanho={36} />
        <div className="leading-tight">
          <p className="text-[13.5px] font-medium">{conta.nome}</p>
          <p className="text-[11.5px] text-[#70757a]">{tipo} · agora</p>
        </div>
      </div>
      {primeira && <VerMidia m={primeira} className="mt-3 block aspect-[4/3] w-full" />}
      {formato !== "atualizacao" && typeof opcoes.titulo === "string" && opcoes.titulo && (
        <p className="px-3.5 pt-3 text-[15px] font-medium text-[#202124]">{opcoes.titulo}</p>
      )}
      {texto && (
        <p className="whitespace-pre-line break-words px-3.5 pt-3 text-[13px] leading-snug text-[#3c4043]">
          <TextoRico texto={texto} limite={180} corLink="#1a73e8" />
        </p>
      )}
      <div className="px-3.5 py-3">
        <span className="inline-flex rounded-full border border-[#dadce0] px-4 py-1.5 text-[13px] font-medium text-[#1a73e8]">
          {botao}
        </span>
      </div>
    </CartaoFeed>
  );
}
