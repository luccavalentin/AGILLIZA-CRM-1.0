import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { enviarFotoSocial } from "@/lib/plataforma/midias.functions";
import { REDES, formatoSugerido, validarDestino } from "@/lib/social/catalogo";
import {
  salvarPostAgz,
  type PostDetalhe,
  type RedeConectada,
} from "@/lib/social/automacoes.functions";
import { MarcaRede } from "./marca-rede";

type Midia = { id: string; mime: string; previa: string | null };

function paraCampoData(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Compositor do post: legenda, redes (com formato), fotos e horário, com as regras de cada rede. */
export function CompositorAgz({
  aberto,
  aoFechar,
  aoSalvar,
  redes,
  post,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: (id: string) => void;
  redes: RedeConectada[];
  post?: PostDetalhe | null;
}) {
  const salvarFn = useServerFn(salvarPostAgz);
  const fotoFn = useServerFn(enviarFotoSocial);
  const ativas = redes.filter((r) => r.status === "ativa");
  const [legenda, setLegenda] = useState(post?.legenda ?? "");
  const [quando, setQuando] = useState(paraCampoData(post?.agendado_para ?? null));
  const [midias, setMidias] = useState<Midia[]>(
    (post?.midias ?? []).map((m) => ({ id: m.id, mime: "image/jpeg", previa: null })),
  );
  const [escolhas, setEscolhas] = useState<Record<string, string>>(() =>
    Object.fromEntries((post?.destinos ?? []).map((d) => [d.conta_id, d.formato])),
  );
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  const selecionadas = ativas.filter((r) => escolhas[r.id]);
  const problemas = useMemo(
    () => selecionadas.flatMap((r) => validarDestino(r.rede, escolhas[r.id]!, legenda, midias)),
    [selecionadas, escolhas, legenda, midias],
  );
  const limite = Math.min(
    ...(selecionadas.length ? selecionadas.map((r) => REDES[r.rede].limiteLegenda) : [5000]),
  );

  async function enviarFotos(lista: FileList | null) {
    if (!lista?.length) return;
    setEnviando(true);
    try {
      for (const f of Array.from(lista).slice(0, 10 - midias.length)) {
        const form = new FormData();
        form.set("arquivo", f);
        form.set("destino", "social_post");
        try {
          const r = await fotoFn({ data: form });
          setMidias((m) => [
            ...m,
            { id: r.id, mime: r.tipo, previa: r.url ?? URL.createObjectURL(f) },
          ]);
        } catch (e) {
          toast.error(mensagemDeErro(e, `Não foi possível enviar ${f.name}.`));
        }
      }
    } finally {
      setEnviando(false);
      if (arquivo.current) arquivo.current.value = "";
    }
  }

  async function salvar(intencao: "rascunho" | "aprovacao" | "agendar") {
    setSalvando(intencao);
    try {
      const r = await salvarFn({
        data: {
          id: post?.id ?? null,
          legenda,
          agendadoPara: quando ? new Date(quando).toISOString() : null,
          destinos: selecionadas.map((x) => ({
            conta_id: x.id,
            rede: x.rede,
            formato: escolhas[x.id]!,
            legenda_propria: null,
          })),
          midias: midias.map((m) => ({ id: m.id, mime: m.mime })),
          intencao,
        },
      });
      toast.success(
        intencao === "agendar"
          ? "Post agendado. Ele sai sozinho no horário."
          : intencao === "aprovacao"
            ? "Post enviado para aprovação. Copie o link no post."
            : "Rascunho salvo.",
      );
      aoSalvar(r.id);
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível salvar o post."));
    } finally {
      setSalvando(null);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{post ? "Editar post" : "Novo post"}</DialogTitle>
          <DialogDescription>
            Escreva uma vez e publique nas redes da AgillizaTech no horário que escolher.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-2">
            <Label>Redes</Label>
            {ativas.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Conecte uma rede na aba Redes para publicar.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {ativas.map((r) => {
                  const on = Boolean(escolhas[r.id]);
                  return (
                    <li key={r.id} className="space-y-1.5">
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setEscolhas((e) => {
                            const n = { ...e };
                            if (n[r.id]) delete n[r.id];
                            else n[r.id] = formatoSugerido(r.rede, midias);
                            return n;
                          })
                        }
                        className={
                          "flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-left text-sm " +
                          (on
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:bg-muted/50")
                        }
                      >
                        <MarcaRede rede={r.rede} />
                        <span className="min-w-0 truncate">{r.nome}</span>
                      </button>
                      {on && (
                        <select
                          aria-label={`Formato no ${REDES[r.rede].rotulo}`}
                          className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                          value={escolhas[r.id]}
                          onChange={(e) => setEscolhas((x) => ({ ...x, [r.id]: e.target.value }))}
                        >
                          {REDES[r.rede].formatos.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.rotulo}
                            </option>
                          ))}
                        </select>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="agz-legenda">Legenda</Label>
            <Textarea
              id="agz-legenda"
              rows={6}
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
            />
            <p
              className={`text-right text-xs tabular-nums ${legenda.length > limite ? "font-semibold text-destructive" : "text-muted-foreground"}`}
            >
              {legenda.length.toLocaleString("pt-BR")} / {limite.toLocaleString("pt-BR")}
            </p>
          </section>

          <section className="space-y-2">
            <Label>Fotos</Label>
            <div className="flex flex-wrap gap-2">
              {midias.map((m) => (
                <figure
                  key={m.id}
                  className="relative h-20 w-20 overflow-hidden rounded-lg bg-muted"
                >
                  {m.previa ? (
                    <img src={m.previa} alt="" className="h-full w-full object-cover" />
                  ) : null}
                  <button
                    type="button"
                    aria-label="Tirar foto"
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
                    onClick={() => setMidias((x) => x.filter((y) => y.id !== m.id))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </figure>
              ))}
              {midias.length < 10 && (
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => arquivo.current?.click()}
                  className="grid h-20 w-20 place-content-center justify-items-center gap-1 rounded-lg border-2 border-dashed text-xs text-muted-foreground hover:border-primary hover:text-primary"
                >
                  {enviando ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                  {enviando ? "Enviando…" : "Adicionar"}
                </button>
              )}
              <input
                ref={arquivo}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(e) => void enviarFotos(e.target.files)}
              />
            </div>
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="agz-quando">Data e hora da publicação</Label>
            <Input
              id="agz-quando"
              type="datetime-local"
              className="sm:max-w-xs"
              value={quando}
              min={paraCampoData(new Date().toISOString())}
              onChange={(e) => setQuando(e.target.value)}
            />
          </section>

          {problemas.length > 0 && selecionadas.length > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="font-medium">Ajuste antes de agendar</p>
              <ul className="mt-1 list-disc pl-5">
                {problemas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            className="w-full sm:w-auto"
            disabled={!!salvando}
            onClick={() => void salvar("rascunho")}
          >
            Salvar rascunho
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            disabled={!!salvando || selecionadas.length === 0}
            onClick={() => void salvar("aprovacao")}
          >
            Enviar para aprovação
          </Button>
          <Button
            className="w-full sm:w-auto"
            disabled={!!salvando || selecionadas.length === 0 || !quando || problemas.length > 0}
            onClick={() => void salvar("agendar")}
          >
            {salvando === "agendar" ? "Agendando…" : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
