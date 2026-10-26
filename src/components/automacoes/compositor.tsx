/**
 * Novo post / editar (estrutura do compositor do Postei): redes e formato por destino, legenda
 * geral com legenda própria por rede, mídia da biblioteca (ou enviada na hora, foto e vídeo),
 * opções de cada rede, horários recomendados, prévia por rede e validação ao vivo pelas mesmas
 * regras do servidor de publicação. Ações: rascunho, aprovação, agendar e publicar agora.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  Clock,
  ImagePlus,
  Images,
  Loader2,
  Play,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Secao } from "@/components/plataforma/kit";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { REDES, formatoSugerido, validarDestino } from "@/lib/social/catalogo";
import { horariosRecomendados } from "@/lib/social/horarios";
import {
  salvarPostAgz,
  type Opcoes,
  type PostDetalhe,
  type RedeConectada,
} from "@/lib/social/automacoes.functions";
import { cn } from "@/lib/utils";
import { ACEITOS, Biblioteca, useEnvioDeMidia, type MidiaEscolhida } from "./biblioteca";
import { MarcaRede, useRecarregarAutomacoes } from "./comum";
import { OpcoesDestino, temOpcoes } from "./opcoes-destino";
import { Previa, type ContaPrevia, type MidiaPrevia } from "./previa";

type Escolha = { formato: string; legendaPropria: string | null; opcoes: Opcoes };
type Intencao = "rascunho" | "aprovacao" | "agendar" | "agora";

const MAX_MIDIAS = 35;

/** "2026-10-22T14:30" (o que o <input type="datetime-local"> usa) a partir de uma data. */
export function paraCampo(d: Date | string | null | undefined): string {
  if (!d) return "";
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
}

export function Compositor({
  redes,
  post,
  diaInicial,
  podeEditar,
}: {
  redes: RedeConectada[];
  post: PostDetalhe | null;
  diaInicial: Date | null;
  podeEditar: boolean;
}) {
  const navigate = useNavigate();
  const recarregar = useRecarregarAutomacoes();
  const salvarFn = useServerFn(salvarPostAgz);
  const ativas = redes.filter((r) => r.status === "ativa");
  const [legenda, setLegenda] = useState(post?.legenda ?? "");
  const [quando, setQuando] = useState(() => {
    if (post?.agendado_para) return paraCampo(post.agendado_para);
    if (diaInicial) {
      const d = new Date(
        diaInicial.getFullYear(),
        diaInicial.getMonth(),
        diaInicial.getDate(),
        9,
        0,
      );
      return paraCampo(
        d.getTime() > Date.now() + 30 * 60_000 ? d : new Date(Date.now() + 60 * 60_000),
      );
    }
    return "";
  });
  const [midias, setMidias] = useState<MidiaPrevia[]>(() =>
    [...(post?.midias ?? [])]
      .sort((a, b) => a.posicao - b.posicao)
      .map((m) => ({
        id: m.id,
        mime: m.mime ?? "image/jpeg",
        url: post?.urls?.[m.id] ?? null,
        duracaoMs: m.duracao_ms ?? null,
      })),
  );
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>(() =>
    Object.fromEntries(
      (post?.destinos ?? [])
        .filter((d) => ativas.some((a) => a.id === d.conta_id))
        .map((d) => [
          d.conta_id,
          { formato: d.formato, legendaPropria: d.legenda_propria, opcoes: d.opcoes ?? {} },
        ]),
    ),
  );
  const [abaLegenda, setAbaLegenda] = useState<string>("todas");
  const [biblioteca, setBiblioteca] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const envio = useEnvioDeMidia((m) => adicionar(m));
  const redesForaDoAr = (post?.destinos ?? []).filter(
    (d) => !ativas.some((a) => a.id === d.conta_id),
  );

  function adicionar(m: MidiaEscolhida) {
    setMidias((x) => (x.some((y) => y.id === m.id) || x.length >= MAX_MIDIAS ? x : [...x, m]));
  }
  function alternarMidia(m: MidiaEscolhida) {
    setMidias((x) =>
      x.some((y) => y.id === m.id)
        ? x.filter((y) => y.id !== m.id)
        : x.length >= MAX_MIDIAS
          ? x
          : [...x, m],
    );
  }
  function mover(i: number, d: -1 | 1) {
    setMidias((x) => {
      const j = i + d;
      if (j < 0 || j >= x.length) return x;
      const n = [...x];
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });
  }
  function alternarRede(r: RedeConectada) {
    setEscolhas((e) => {
      const n = { ...e };
      if (n[r.id]) delete n[r.id];
      else n[r.id] = { formato: formatoSugerido(r.rede, midias), legendaPropria: null, opcoes: {} };
      return n;
    });
  }
  const mudar = (id: string, p: Partial<Escolha>) =>
    setEscolhas((e) => ({ ...e, [id]: { ...e[id]!, ...p } }));

  const selecionadas = ativas.filter((r) => escolhas[r.id]);
  useEffect(() => {
    if (abaLegenda !== "todas" && !escolhas[abaLegenda]) setAbaLegenda("todas");
  }, [abaLegenda, escolhas]);

  const midiasValidar = midias.map((m) => ({ mime: m.mime, duracaoMs: m.duracaoMs }));
  const problemas = useMemo(
    () =>
      Object.fromEntries(
        selecionadas.map((r) => {
          const e = escolhas[r.id]!;
          return [
            r.id,
            validarDestino(r.rede, e.formato, e.legendaPropria ?? legenda, midiasValidar, e.opcoes),
          ];
        }),
      ) as Record<string, string[]>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selecionadas.map((r) => r.id).join(), escolhas, legenda, midias],
  );
  const todosProblemas = Object.values(problemas).flat();
  const limite = Math.min(
    ...(selecionadas.length ? selecionadas.map((r) => REDES[r.rede].limiteLegenda) : [5000]),
  );
  const textoAtual =
    abaLegenda === "todas" ? legenda : (escolhas[abaLegenda]?.legendaPropria ?? legenda);
  const limiteAtual =
    abaLegenda === "todas"
      ? limite
      : REDES[ativas.find((a) => a.id === abaLegenda)!.rede].limiteLegenda;
  const sugestoes = horariosRecomendados(selecionadas.map((r) => r.rede));
  const quandoData = quando ? new Date(quando) : null;
  const passado = quandoData ? quandoData.getTime() < Date.now() - 60_000 : false;

  const salvar = useMutation({
    mutationFn: (intencao: Intencao) =>
      salvarFn({
        data: {
          id: post?.id ?? null,
          legenda,
          agendadoPara:
            intencao === "agora"
              ? new Date().toISOString()
              : quandoData && !Number.isNaN(quandoData.getTime())
                ? quandoData.toISOString()
                : null,
          destinos: selecionadas.map((r) => ({
            conta_id: r.id,
            rede: r.rede,
            formato: escolhas[r.id]!.formato,
            legenda_propria: escolhas[r.id]!.legendaPropria,
            opcoes: escolhas[r.id]!.opcoes,
          })),
          midias: midias.map((m) => ({ id: m.id, mime: m.mime, duracaoMs: m.duracaoMs })),
          intencao: intencao === "agora" ? "agendar" : intencao,
        },
      }),
    onSuccess: (r, intencao) => {
      toast.success(
        intencao === "agora"
          ? "Post na fila: sai em até um minuto."
          : intencao === "agendar"
            ? "Post agendado. Ele sai sozinho no horário."
            : intencao === "aprovacao"
              ? "Enviado para aprovação. Copie o link no post e mande ao cliente."
              : "Rascunho salvo.",
      );
      recarregar();
      void navigate({ to: "/automacoes/posts/$id", params: { id: r.id } });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar o post.")),
  });

  const contasPrevia: ContaPrevia[] = selecionadas.map((r) => ({
    id: r.id,
    rede: r.rede,
    nome: r.nome,
    usuario: r.usuario,
    avatar_url: r.avatar_url,
  }));
  const comOpcoes = selecionadas.filter((r) => temOpcoes(r.rede, escolhas[r.id]!.formato));
  const temTiktok = selecionadas.some((r) => r.rede === "tiktok");

  return (
    <div className="space-y-4 pb-24 md:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 min-h-11 text-muted-foreground sm:min-h-8"
        >
          <Link
            to={post ? "/automacoes/posts/$id" : "/automacoes"}
            params={post ? { id: post.id } : undefined}
          >
            <ArrowLeft className="mr-1 size-4" /> Voltar
          </Link>
        </Button>
        <h2 className="text-lg font-medium tracking-tight sm:text-xl">
          {post ? "Editar post" : "Novo post"}
        </h2>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <Secao
            titulo="Redes"
            descricao="Escolha onde publicar e o formato em cada rede. Tudo sai no mesmo horário."
          >
            {ativas.length === 0 ? (
              <div className="flex flex-col items-start gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center">
                <span className="flex-1">Nenhuma rede conectada ainda.</span>
                <Button asChild variant="outline" className="min-h-11 sm:min-h-9">
                  <Link to="/automacoes/redes">Conectar rede</Link>
                </Button>
              </div>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {ativas.map((r) => {
                  const e = escolhas[r.id];
                  return (
                    <li
                      key={r.id}
                      className={cn(
                        "rounded-xl border p-2 transition-colors",
                        e ? "border-primary/40 bg-primary/[0.03]" : "bg-card",
                      )}
                    >
                      <button
                        type="button"
                        aria-pressed={Boolean(e)}
                        onClick={() => alternarRede(r)}
                        disabled={!podeEditar}
                        className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-1 text-left"
                      >
                        <span className="relative grid size-9 shrink-0 place-items-center rounded-lg border bg-card">
                          <MarcaRede rede={r.rede} className="size-5" />
                          {e && (
                            <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground">
                              <Check className="size-3" />
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{r.nome}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {REDES[r.rede].rotulo}
                            {r.usuario ? ` · ${r.usuario}` : ""}
                          </span>
                        </span>
                      </button>
                      {e && (
                        <Select
                          value={e.formato}
                          onValueChange={(v) => mudar(r.id, { formato: v })}
                        >
                          <SelectTrigger
                            className="mt-1.5 h-11 sm:h-9"
                            aria-label={`Formato no ${REDES[r.rede].rotulo}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {REDES[r.rede].formatos.map((f) => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.rotulo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {redesForaDoAr.length > 0 && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
                <AlertTriangle className="mt-px size-3.5 shrink-0" />
                {redesForaDoAr.map((d) => d.conta).join(", ")} não está mais conectada e sai do post
                ao salvar. Reconecte em Redes.
              </p>
            )}
          </Secao>

          <Secao titulo="Legenda">
            {selecionadas.length > 0 && (
              <div
                className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]"
                role="tablist"
                aria-label="Legenda por rede"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={abaLegenda === "todas"}
                  onClick={() => setAbaLegenda("todas")}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-[13px] sm:min-h-8",
                    abaLegenda === "todas"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card",
                  )}
                >
                  Todas as redes
                </button>
                {selecionadas.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="tab"
                    aria-selected={abaLegenda === r.id}
                    onClick={() => setAbaLegenda(r.id)}
                    className={cn(
                      "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border pl-1.5 pr-3 text-[13px] sm:min-h-8",
                      abaLegenda === r.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card",
                    )}
                  >
                    <span className="grid size-5 place-items-center rounded-full bg-card">
                      <MarcaRede rede={r.rede} className="size-3.5" />
                    </span>
                    <span className="max-w-28 truncate">{r.nome}</span>
                    {escolhas[r.id]?.legendaPropria != null && (
                      <span
                        className="size-1.5 rounded-full bg-current"
                        aria-label="Legenda própria"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
            <Label htmlFor="legenda" className="sr-only">
              Legenda
            </Label>
            <Textarea
              id="legenda"
              rows={7}
              value={textoAtual}
              disabled={!podeEditar}
              onChange={(e) =>
                abaLegenda === "todas"
                  ? setLegenda(e.target.value)
                  : mudar(abaLegenda, { legendaPropria: e.target.value })
              }
              placeholder="Ex.: Crédito imobiliário sem complicação: simule com a AgillizaTech e receba a resposta dos bancos no mesmo dia."
              className="text-base sm:text-sm"
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              {abaLegenda !== "todas" && (
                <>
                  <span className="text-muted-foreground">
                    {escolhas[abaLegenda]?.legendaPropria != null
                      ? "Legenda própria desta rede."
                      : "Usando a legenda de todas as redes."}
                  </span>
                  {escolhas[abaLegenda]?.legendaPropria != null && (
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => mudar(abaLegenda, { legendaPropria: null })}
                    >
                      Voltar à legenda geral
                    </button>
                  )}
                </>
              )}
              <span
                className={cn(
                  "ml-auto tabular-nums",
                  textoAtual.length > limiteAtual
                    ? "font-medium text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {textoAtual.length.toLocaleString("pt-BR")} / {limiteAtual.toLocaleString("pt-BR")}
              </span>
            </div>
          </Secao>

          <Secao
            titulo="Mídia"
            descricao="Fotos e vídeos na ordem em que vão aparecer. Carrossel: até 10 no Instagram."
            acoes={
              podeEditar ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 sm:min-h-8"
                    onClick={() => setBiblioteca(true)}
                  >
                    <Images className="mr-1.5 size-4" /> Biblioteca
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 sm:min-h-8"
                    disabled={envio.enviando}
                    onClick={() => entrada.current?.click()}
                  >
                    {envio.enviando ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    ) : (
                      <ImagePlus className="mr-1.5 size-4" />
                    )}
                    Enviar
                  </Button>
                  <input
                    ref={entrada}
                    type="file"
                    accept={ACEITOS}
                    multiple
                    hidden
                    onChange={(e) => {
                      void envio.enviar(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </>
              ) : undefined
            }
          >
            {midias.length === 0 ? (
              <button
                type="button"
                disabled={!podeEditar}
                onClick={() => setBiblioteca(true)}
                className="flex min-h-28 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-sm text-muted-foreground hover:border-primary/40 hover:text-primary"
              >
                <ImagePlus className="size-5" />
                Escolha da biblioteca ou envie foto e vídeo
              </button>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {midias.map((m, i) => (
                  <li
                    key={m.id}
                    className="group relative size-24 overflow-hidden rounded-xl bg-secondary ring-1 ring-border sm:size-28"
                  >
                    {m.url ? (
                      m.mime.startsWith("video/") ? (
                        <video
                          src={m.url}
                          muted
                          preload="metadata"
                          className="size-full object-cover"
                        />
                      ) : (
                        <img src={m.url} alt="" className="size-full object-cover" />
                      )
                    ) : (
                      <span className="grid size-full place-items-center text-xs text-muted-foreground">
                        Arquivo
                      </span>
                    )}
                    {m.mime.startsWith("video/") && (
                      <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded bg-black/65 px-1 text-[10.5px] text-white">
                        <Play className="size-2.5 fill-white" />
                        {m.duracaoMs ? `${Math.round(m.duracaoMs / 1000)} s` : "vídeo"}
                      </span>
                    )}
                    <span className="absolute left-1 top-1 grid size-5 place-items-center rounded-full bg-black/60 text-[10.5px] font-medium text-white">
                      {i + 1}
                    </span>
                    {podeEditar && (
                      <span className="absolute inset-x-1 bottom-1 flex justify-end gap-1">
                        {i > 0 && (
                          <button
                            type="button"
                            onClick={() => mover(i, -1)}
                            aria-label="Mover para a esquerda"
                            className="grid size-7 place-items-center rounded-md bg-card/90 shadow"
                          >
                            <ArrowLeft className="size-3.5" />
                          </button>
                        )}
                        {i < midias.length - 1 && (
                          <button
                            type="button"
                            onClick={() => mover(i, 1)}
                            aria-label="Mover para a direita"
                            className="grid size-7 place-items-center rounded-md bg-card/90 shadow"
                          >
                            <ArrowRight className="size-3.5" />
                          </button>
                        )}
                      </span>
                    )}
                    {podeEditar && (
                      <button
                        type="button"
                        aria-label="Tirar do post"
                        onClick={() => setMidias((x) => x.filter((y) => y.id !== m.id))}
                        className="absolute right-1 top-1 grid size-7 place-items-center rounded-md bg-card/90 shadow"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Secao>

          {comOpcoes.length > 0 && (
            <Secao titulo="Opções de cada rede">
              <div className="space-y-3">
                {comOpcoes.map((r) => (
                  <OpcoesDestino
                    key={r.id}
                    conta={{
                      id: r.id,
                      rede: r.rede,
                      nome: r.nome,
                      usuario: r.usuario,
                      avatar_url: r.avatar_url,
                    }}
                    formato={escolhas[r.id]!.formato}
                    opcoes={escolhas[r.id]!.opcoes}
                    mudar={(o) => mudar(r.id, { opcoes: o })}
                    podeEditar={podeEditar}
                  />
                ))}
              </div>
            </Secao>
          )}

          <Secao titulo="Quando publicar">
            <div className="grid gap-3 sm:grid-cols-[260px_minmax(0,1fr)] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="quando">Data e hora</Label>
                <Input
                  id="quando"
                  type="datetime-local"
                  value={quando}
                  min={paraCampo(new Date())}
                  disabled={!podeEditar}
                  onChange={(e) => setQuando(e.target.value)}
                  className="h-11 text-base sm:h-10 sm:text-sm"
                />
              </div>
              <div className="min-w-0">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="size-3.5" /> Horários recomendados{" "}
                  {selecionadas.length ? "para estas redes" : ""}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sugestoes.map((s) => {
                    const v = paraCampo(s.data);
                    return (
                      <button
                        key={v}
                        type="button"
                        disabled={!podeEditar}
                        onClick={() => setQuando(v)}
                        className={cn(
                          "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-[13px] sm:min-h-8",
                          quando === v
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card hover:border-primary/40",
                        )}
                      >
                        <Clock className="size-3.5" /> {s.rotulo}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {passado && (
              <p className="mt-2 text-xs text-destructive">
                Esta data já passou. Escolha um horário a partir de agora ou use “Publicar agora”.
              </p>
            )}
          </Secao>

          {selecionadas.length > 0 && todosProblemas.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
              <div>
                <p className="font-medium">Ajuste antes de agendar</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px] text-muted-foreground">
                  {todosProblemas.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {podeEditar && (
            <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 overflow-x-auto border-t bg-card/95 p-3 shadow-[0_-6px_16px_-12px_rgb(0_10_112/0.3)] md:static md:flex-wrap md:justify-end md:overflow-visible md:rounded-[14px] md:border md:bg-card md:shadow-none">
              <Button
                variant="ghost"
                className="min-h-11 shrink-0 md:min-h-9"
                disabled={salvar.isPending}
                onClick={() => salvar.mutate("rascunho")}
              >
                Salvar rascunho
              </Button>
              <Button
                variant="outline"
                className="min-h-11 shrink-0 md:min-h-9"
                disabled={
                  salvar.isPending || selecionadas.length === 0 || todosProblemas.length > 0
                }
                onClick={() => salvar.mutate("aprovacao")}
              >
                Enviar para aprovação
              </Button>
              <Button
                variant="outline"
                className="min-h-11 shrink-0 md:min-h-9"
                disabled={
                  salvar.isPending || selecionadas.length === 0 || todosProblemas.length > 0
                }
                onClick={() => {
                  if (window.confirm(`Publicar agora em ${selecionadas.length} rede(s)?`))
                    salvar.mutate("agora");
                }}
              >
                <Send className="mr-1.5 size-4" /> Publicar agora
              </Button>
              <Button
                className="min-h-11 shrink-0 md:min-h-9"
                disabled={
                  salvar.isPending ||
                  selecionadas.length === 0 ||
                  !quando ||
                  passado ||
                  todosProblemas.length > 0
                }
                onClick={() => salvar.mutate("agendar")}
              >
                {salvar.isPending ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <CalendarClock className="mr-1.5 size-4" />
                )}
                Agendar
              </Button>
            </div>
          )}
          {temTiktok && (
            <p className="text-xs text-muted-foreground">
              No TikTok, o post sai pela Content Posting API oficial; a conta recebe o vídeo ou as
              fotos já publicados (não vão para os rascunhos).
            </p>
          )}
        </div>

        <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <Previa
            contas={contasPrevia}
            formatos={Object.fromEntries(selecionadas.map((r) => [r.id, escolhas[r.id]!.formato]))}
            legenda={legenda}
            legendas={Object.fromEntries(
              selecionadas.map((r) => [r.id, escolhas[r.id]!.legendaPropria]),
            )}
            midias={midias}
            problemas={problemas}
            opcoes={Object.fromEntries(selecionadas.map((r) => [r.id, escolhas[r.id]!.opcoes]))}
          />
        </div>
      </div>

      <Dialog open={biblioteca} onOpenChange={setBiblioteca}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-24px)] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Biblioteca de mídia</DialogTitle>
            <DialogDescription>
              Toque para pôr ou tirar do post. {midias.length} escolhida(s).
            </DialogDescription>
          </DialogHeader>
          <Biblioteca
            escolher={alternarMidia}
            selecionadas={midias.map((m) => m.id)}
            podeEditar={podeEditar}
          />
          <div className="flex justify-end">
            <Button className="min-h-11 sm:min-h-9" onClick={() => setBiblioteca(false)}>
              Pronto
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
