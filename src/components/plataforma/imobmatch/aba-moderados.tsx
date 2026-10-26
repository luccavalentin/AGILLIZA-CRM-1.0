/**
 * Aba "Moderados": o que a equipe tirou do ar (moderação, duplicado, denúncia procedente).
 * O anunciante não republica um anúncio moderado; desfazer a moderação devolve o anúncio
 * a ele, liberado para publicar de novo pelo caminho de sempre (0283).
 *
 * No topo, "Moderar pelo código": para tirar do ar um anúncio que não chegou pela revisão
 * nem pelas denúncias (ex.: aviso do suporte).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ban, Loader2, Search, ShieldOff, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { RodapePaginas, useValorAssentado } from "@/components/plataforma/paginacao";
import {
  lerAnuncioPorCodigo,
  lerModerados,
  moderarAnuncio,
  reverterModeracao,
  type FichaAnuncio,
} from "@/lib/plataforma/imobmatch.functions";
import { CHAVE_IMOBMATCH } from "./aba-revisao";
import { CampoMotivo, Carregando, FichaDoAnuncio, HistoricoDecisoes, Vazio } from "./comum";
import { useModeraImobMatch } from "@/hooks/use-permissao-imobmatch";

export function AbaModerados() {
  const lerFn = useServerFn(lerModerados);
  const [busca, setBusca] = useState("");
  const buscaAssentada = useValorAssentado(busca.trim());
  const [pagina, setPagina] = useState(1);
  const [aberto, setAberto] = useState<FichaAnuncio | null>(null);
  const q = useQuery({
    queryKey: [...CHAVE_IMOBMATCH, "moderados", buscaAssentada, pagina],
    queryFn: () => lerFn({ data: { busca: buscaAssentada, pagina } }),
    staleTime: 20_000,
    placeholderData: (a) => a,
  });
  const itens = q.data?.itens ?? [];

  return (
    <div className="space-y-5">
      <ModerarPorCodigo onAbrir={setAberto} />

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold">Anúncios moderados</h3>
            <p className="text-xs text-muted-foreground">
              {q.data ? `${q.data.total} fora do ar pela equipe` : "Carregando…"}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
              placeholder="Código, título, cidade ou conta"
              aria-label="Buscar nos moderados"
              className="pl-8 text-base sm:text-sm"
            />
          </div>
        </div>

        {q.isLoading ? (
          <Carregando />
        ) : q.isError ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {mensagemDeErro(q.error, "Não foi possível ler os anúncios moderados.")}
          </p>
        ) : itens.length === 0 ? (
          <Vazio
            icone={<ShieldOff className="size-5" aria-hidden />}
            titulo={buscaAssentada ? "Nada com essa busca" : "Nenhum anúncio moderado"}
            texto="Anúncios tirados do ar pela equipe aparecem aqui, com o motivo que o anunciante leu."
          />
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {itens.map((f) => (
                <FichaDoAnuncio
                  key={f.id}
                  f={f}
                  rodape={
                    <Button variant="outline" size="sm" onClick={() => setAberto(f)}>
                      Ver decisões e desfazer
                    </Button>
                  }
                />
              ))}
            </div>
            <div className="rounded-lg border border-border bg-card">
              <RodapePaginas
                pagina={pagina}
                porPagina={q.data?.por_pagina ?? 30}
                quantidade={itens.length}
                total={q.data?.total}
                carregando={q.isFetching}
                onPagina={setPagina}
              />
            </div>
          </>
        )}
      </section>

      <DetalheModeracao f={aberto} onFechar={() => setAberto(null)} />
    </div>
  );
}

function ModerarPorCodigo({ onAbrir }: { onAbrir: (f: FichaAnuncio) => void }) {
  const lerFn = useServerFn(lerAnuncioPorCodigo);
  const [codigo, setCodigo] = useState("");
  const procurar = useMutation({
    mutationFn: () => lerFn({ data: { codigo: codigo.trim() } }),
    onSuccess: (f) => onAbrir(f),
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível procurar o anúncio.")),
  });
  const valido = /^(IMV-)?\d{1,12}$/i.test(codigo.trim());
  return (
    <form
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-end sm:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valido) procurar.mutate();
      }}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <Label htmlFor="im-codigo">Moderar um anúncio pelo código</Label>
        <Input
          id="im-codigo"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder="IMV-000123"
          inputMode="text"
          autoComplete="off"
          className="text-base sm:text-sm"
        />
      </div>
      <Button type="submit" variant="outline" disabled={!valido || procurar.isPending}>
        {procurar.isPending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Search className="mr-2 size-4" />
        )}
        Procurar
      </Button>
    </form>
  );
}

/** Gaveta do anúncio: histórico de decisões, moderar (se no ar) ou desfazer (se moderado). */
function DetalheModeracao({ f, onFechar }: { f: FichaAnuncio | null; onFechar: () => void }) {
  const podeModerar = useModeraImobMatch("edit");
  return (
    <Sheet open={!!f} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {f && (
          <>
            <SheetHeader>
              <SheetTitle className="break-words pr-6">{f.titulo ?? f.codigo}</SheetTitle>
              <SheetDescription>
                {f.codigo} · {f.conta.nome}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <FichaDoAnuncio f={f} />
              {f.historico.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Decisões da equipe</h3>
                  <HistoricoDecisoes f={f} />
                </section>
              )}
              {podeModerar ? (
                f.status === "moderado" ? (
                  <Desfazer key={f.id} f={f} onFeito={onFechar} />
                ) : (
                  <Moderar key={f.id} f={f} onFeito={onFechar} />
                )
              ) : (
                <p className="text-xs text-muted-foreground">
                  Você pode ver, mas não moderar anúncios.
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Moderar({ f, onFeito }: { f: FichaAnuncio; onFeito: () => void }) {
  const qc = useQueryClient();
  const moderarFn = useServerFn(moderarAnuncio);
  const [motivo, setMotivo] = useState("");
  const m = useMutation({
    mutationFn: () => moderarFn({ data: { anuncioId: f.id, motivo } }),
    onSuccess: () => {
      toast.success(`${f.codigo} saiu do ar. O anunciante foi avisado com o motivo.`);
      qc.invalidateQueries({ queryKey: CHAVE_IMOBMATCH });
      onFeito();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível moderar o anúncio.")),
  });
  return (
    <section className="space-y-3 rounded-lg border border-destructive/30 p-3">
      <div>
        <h3 className="text-sm font-semibold">Tirar do ar</h3>
        <p className="text-xs text-muted-foreground">
          O anúncio some da vitrine e o anunciante não republica até a equipe desfazer.
        </p>
      </div>
      <CampoMotivo
        id={`motivo-mod-${f.id}`}
        valor={motivo}
        onValor={setMotivo}
        obrigatorio
        dica="Ex.: fotos de outro imóvel, confirmado pela equipe."
      />
      <Button
        variant="destructive"
        disabled={motivo.trim().length < 10 || m.isPending}
        onClick={() => m.mutate()}
      >
        {m.isPending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Ban className="mr-2 size-4" />
        )}
        Tirar do ar
      </Button>
    </section>
  );
}

function Desfazer({ f, onFeito }: { f: FichaAnuncio; onFeito: () => void }) {
  const qc = useQueryClient();
  const reverterFn = useServerFn(reverterModeracao);
  const [motivo, setMotivo] = useState("");
  const tam = motivo.trim().length;
  const m = useMutation({
    mutationFn: () => reverterFn({ data: { anuncioId: f.id, motivo } }),
    onSuccess: () => {
      toast.success(`Moderação desfeita. ${f.conta.nome} já pode publicar ${f.codigo} de novo.`);
      qc.invalidateQueries({ queryKey: CHAVE_IMOBMATCH });
      onFeito();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível desfazer a moderação.")),
  });
  return (
    <section className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <h3 className="text-sm font-semibold">Desfazer a moderação</h3>
        <p className="text-xs text-muted-foreground">
          O anúncio volta ao anunciante, liberado: ele publica de novo pela ficha do imóvel (o que
          falta, o limite do plano e a conta em dia valem de novo).
        </p>
      </div>
      <CampoMotivo
        id={`motivo-rev-mod-${f.id}`}
        valor={motivo}
        onValor={setMotivo}
        obrigatorio={false}
        dica="Opcional: por que a moderação foi desfeita."
      />
      <Button disabled={(tam > 0 && tam < 10) || m.isPending} onClick={() => m.mutate()}>
        {m.isPending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Undo2 className="mr-2 size-4" />
        )}
        Desfazer moderação
      </Button>
    </section>
  );
}
