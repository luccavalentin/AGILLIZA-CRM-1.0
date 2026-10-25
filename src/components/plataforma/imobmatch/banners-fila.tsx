/**
 * Aba "Fila de criativos": banners enviados pelos patrocinadores, esperando aprovação. A
 * prévia mostra o banner do jeito que vai aparecer no portal (selo "Patrocinado", imagem,
 * título, texto e botão). Aprovar põe no ar (se a campanha estiver paga e no período);
 * reprovar exige o motivo que o patrocinador lê para corrigir.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Check,
  Eye,
  GalleryHorizontalEnd,
  ImageOff,
  Loader2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import {
  aprovarCriativo,
  lerFilaCriativos,
  reprovarCriativo,
  type CriativoBanner,
} from "@/lib/plataforma/patrocinados.functions";
import { cn } from "@/lib/utils";
import { CHAVE_BANNERS, ROTULO_BOTAO, ROTULO_PERIODO, SEGMENTO, praca } from "./banners-comum";
import { Carregando, dataHora, Vazio } from "./comum";

export function AbaFilaCriativos() {
  const lerFn = useServerFn(lerFilaCriativos);
  const q = useQuery({
    queryKey: [...CHAVE_BANNERS, "fila"],
    queryFn: () => lerFn(),
    staleTime: 20_000,
  });
  if (q.isLoading) return <Carregando />;
  if (q.isError)
    return (
      <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        {mensagemDeErro(q.error, "Não foi possível ler a fila de criativos.")}
      </p>
    );
  const itens = q.data ?? [];
  if (itens.length === 0)
    return (
      <Vazio
        icone={<GalleryHorizontalEnd className="size-5" aria-hidden />}
        titulo="Nenhum banner esperando aprovação"
        texto="Quando um patrocinador enviar um criativo para análise, ele aparece aqui com a prévia do banner."
      />
    );
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {itens.length} criativo(s) na fila, do mais antigo para o mais novo.
      </p>
      {itens.map((c) => (
        <Criativo key={c.id} c={c} />
      ))}
    </div>
  );
}

/** O banner como o portal o desenha (largo, com selo "Patrocinado"). */
export function PreviaBanner({ c }: { c: CriativoBanner }) {
  let dominio: string | null = null;
  try {
    dominio = new URL(c.destino).hostname.replace(/^www\./, "");
  } catch {
    dominio = null;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="grid sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="relative aspect-[1.91/1] bg-muted">
          <span className="absolute left-2 top-2 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
            Patrocinado
          </span>
          {c.imagem_url ? (
            <img src={c.imagem_url} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ImageOff className="size-4" aria-hidden /> Sem imagem para mostrar
              </span>
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-1.5 p-3 sm:p-4">
          <p className="text-[11px] text-muted-foreground">
            {c.patrocinador.nome}
            {dominio ? ` · ${dominio}` : ""}
          </p>
          <p className="break-words text-base font-semibold leading-snug">{c.titulo}</p>
          {c.texto && <p className="break-words text-sm text-muted-foreground">{c.texto}</p>}
          <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            {ROTULO_BOTAO[c.botao] ?? c.botao} <ArrowUpRight className="size-3.5" aria-hidden />
          </span>
        </div>
      </div>
    </div>
  );
}

function Criativo({ c }: { c: CriativoBanner }) {
  const podeModerar = usePermissao("saas.patrocinados", "edit");
  const qc = useQueryClient();
  const aprovarFn = useServerFn(aprovarCriativo);
  const reprovarFn = useServerFn(reprovarCriativo);
  const [reprovando, setReprovando] = useState(false);
  const [motivo, setMotivo] = useState("");
  // A versão que o moderador analisou. Se o patrocinador mandar outra enquanto a tela está
  // aberta (o banco recusa com 55000 e a fila recarrega), a decisão fica travada até ele
  // conferir a prévia nova e confirmar — o mesmo clique nunca aprova o que não foi visto.
  const [versaoVista, setVersaoVista] = useState(c.versao);
  const mudou = c.versao !== versaoVista;
  const atualizar = () => qc.invalidateQueries({ queryKey: CHAVE_BANNERS });

  const aprovar = useMutation({
    mutationFn: () => aprovarFn({ data: { id: c.id, versao: versaoVista } }),
    onSuccess: (r) => {
      toast.success(
        r.situacao === "no_ar"
          ? "Aprovado: o banner já está no ar."
          : "Aprovado: entra no ar quando a campanha estiver paga e no período.",
      );
      atualizar();
    },
    onError: (e) => {
      toast.error(mensagemDeErro(e, "Não foi possível aprovar o criativo."));
      // O criativo pode ter mudado enquanto a análise estava aberta: traz a versão nova.
      atualizar();
    },
  });
  const reprovar = useMutation({
    mutationFn: () => reprovarFn({ data: { id: c.id, motivo, versao: versaoVista } }),
    onSuccess: () => {
      toast.success("Reprovado. O patrocinador recebe o motivo para corrigir.");
      atualizar();
    },
    onError: (e) => {
      toast.error(mensagemDeErro(e, "Não foi possível reprovar o criativo."));
      atualizar();
    },
  });
  const camp = c.campanha;

  return (
    <section className="grid min-w-0 gap-4 rounded-xl border border-border bg-card/60 p-3 sm:p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div
        className={cn("min-w-0 space-y-2", mudou && "rounded-xl p-1.5 ring-2 ring-amber-500/70")}
      >
        <PreviaBanner c={c} />
        <p className="break-all text-xs text-muted-foreground">
          Leva para: <span className="font-mono">{c.destino}</span>
        </p>
        {c.imagem && (
          <p className="text-[11px] tabular-nums text-muted-foreground">
            Imagem {c.imagem.largura}×{c.imagem.altura} px · {Math.round(c.imagem.bytes / 1024)} KB
          </p>
        )}
      </div>
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="break-words text-sm font-semibold">{c.patrocinador.nome}</span>
          {c.patrocinador.segmento && (
            <Badge variant="outline">
              {SEGMENTO[c.patrocinador.segmento] ?? c.patrocinador.segmento}
            </Badge>
          )}
          {c.patrocinador.situacao === "bloqueado" && (
            <Badge variant="destructive">Bloqueado</Badge>
          )}
          <Badge variant={c.pago ? "success" : "warning"}>
            {c.pago ? "Pago" : "Aguardando pagamento"}
          </Badge>
        </div>
        {camp && (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-muted/40 p-2.5 text-xs">
            <div className="col-span-2 min-w-0">
              <dt className="text-muted-foreground">Campanha</dt>
              <dd className="break-words font-medium">{camp.nome}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Espaço</dt>
              <dd>{camp.espaco_nome ?? camp.espaco}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Pacote</dt>
              <dd>
                {camp.periodo ? (ROTULO_PERIODO[camp.periodo] ?? camp.periodo) : "—"}
                {camp.preco != null ? ` · ${formatBRL(Number(camp.preco))}` : ""}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Período</dt>
              <dd>
                {camp.inicio ? formatData(camp.inicio) : "—"} a{" "}
                {camp.fim ? formatData(camp.fim) : "—"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Praça</dt>
              <dd className="break-words">{praca(camp)}</dd>
            </div>
          </dl>
        )}
        <p className="text-[11px] text-muted-foreground">
          Enviado em {dataHora(c.enviado_em)} · versão {c.versao}
        </p>

        {podeModerar && mudou && (
          <div
            role="alert"
            className="space-y-2 rounded-lg border border-amber-400/70 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <p className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <strong className="font-semibold">O criativo mudou enquanto você analisava</strong>{" "}
                (versão {versaoVista} → {c.versao}). A prévia já mostra a versão nova: confira
                imagem, texto e link antes de decidir.
              </span>
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full border-amber-500/60 bg-background sm:w-auto"
              onClick={() => setVersaoVista(c.versao)}
            >
              <Eye className="mr-2 size-4" aria-hidden /> Analisei a versão nova
            </Button>
          </div>
        )}

        {podeModerar ? (
          reprovando ? (
            <div className="space-y-2 rounded-lg border border-destructive/30 p-3">
              <Label htmlFor={`rep-${c.id}`}>Motivo da reprovação (obrigatório)</Label>
              <Textarea
                id={`rep-${c.id}`}
                rows={3}
                maxLength={500}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: a imagem promete juros que o banco não oferece. Troque o texto."
              />
              <p className="text-right text-[11px] tabular-nums text-muted-foreground">
                {motivo.length}/500{motivo.trim().length < 5 ? " · mínimo 5" : ""}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={() => setReprovando(false)}>
                  Voltar
                </Button>
                <Button
                  variant="destructive"
                  disabled={motivo.trim().length < 5 || reprovar.isPending || mudou}
                  onClick={() => reprovar.mutate()}
                >
                  {reprovar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Reprovar
                </Button>
              </div>
            </div>
          ) : (
            <div className={cn("grid gap-2 sm:grid-cols-2")}>
              <Button variant="outline" disabled={mudou} onClick={() => setReprovando(true)}>
                <X className="mr-2 size-4" /> Reprovar
              </Button>
              <Button disabled={aprovar.isPending || mudou} onClick={() => aprovar.mutate()}>
                {aprovar.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Check className="mr-2 size-4" />
                )}
                Aprovar
              </Button>
            </div>
          )
        ) : (
          <p className="text-xs text-muted-foreground">Você pode ver a fila, mas não aprovar.</p>
        )}
      </div>
    </section>
  );
}
