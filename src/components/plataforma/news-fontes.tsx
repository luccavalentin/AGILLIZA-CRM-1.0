import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Clock,
  History,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Rss,
  Trash2,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Estado3D } from "@/components/ui/estado-3d";
import { Icone3D } from "@/components/ui/icone-3d";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { formatData } from "@/lib/financeiro/format";
import {
  alternarFonteNews,
  alternarIndicadorNews,
  coletarAgoraNews,
  removerFonteNews,
  salvarFonteNews,
  type CategoriaNews,
  type ColetaNews,
  type FonteNews,
  type IndicadorNews,
} from "@/lib/plataforma/news.functions";
import { SeletorCategoria, ha, useAcaoNews } from "./news-comum";

const INTERVALOS = [
  { v: 15, r: "15 min" },
  { v: 30, r: "30 min" },
  { v: 60, r: "1 hora" },
  { v: 180, r: "3 horas" },
  { v: 360, r: "6 horas" },
  { v: 720, r: "12 horas" },
  { v: 1440, r: "1 dia" },
];

type Rascunho = {
  id: string | null;
  nome: string;
  url: string;
  categoria: string;
  intervalo_min: number;
  ativa: boolean;
};

/**
 * O coletor de RSS da News (0338): fontes cadastradas, situação de cada uma (última coleta,
 * próxima, itens novos, erro), "Coletar agora" (uma ou todas) e o histórico das coletas.
 */
export function FontesNews({
  fontes,
  coletas,
  categorias,
  carregando,
  pode,
}: {
  fontes: FonteNews[];
  coletas: ColetaNews[];
  categorias: CategoriaNews[];
  carregando: boolean;
  pode: boolean;
}) {
  const alternarFn = useServerFn(alternarFonteNews);
  const coletarFn = useServerFn(coletarAgoraNews);
  const salvarFn = useServerFn(salvarFonteNews);
  const removerFn = useServerFn(removerFonteNews);
  const alternar = useAcaoNews(
    (f: FonteNews) => alternarFn({ data: { id: f.id, ativa: !f.ativa } }),
    "Não foi possível alterar a fonte.",
  );
  const coletar = useAcaoNews(
    (id: string | null) => coletarFn({ data: { id } }),
    "Não foi possível pedir a coleta.",
  );
  const salvar = useAcaoNews(
    (r: Rascunho) => salvarFn({ data: r }),
    "Não foi possível salvar a fonte.",
  );
  const remover = useAcaoNews(
    (id: string) => removerFn({ data: { id } }),
    "Não foi possível remover a fonte.",
  );
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const [historicoDe, setHistoricoDe] = useState<string | null>(null);

  const feeds = fontes.filter((f) => f.url_rss);
  const veiculos = fontes.filter((f) => !f.url_rss);
  const ativas = feeds.filter((f) => f.ativa);
  const comErro = feeds.filter((f) => f.ativa && f.erro);
  const ultima = feeds
    .map((f) => f.ultima_coleta_em)
    .filter((x): x is string => !!x)
    .sort()
    .at(-1);

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Icone3D icone={Rss} tamanho="md" tom="alerta" />
          <div>
            <h2 className="font-semibold">Coletor de RSS</h2>
            <p className="text-sm text-muted-foreground">
              {ativas.length} fonte(s) ativa(s) · última coleta{" "}
              {ultima ? ha(ultima) : "ainda não houve"}
              {comErro.length ? ` · ${comErro.length} com erro` : ""}. O que é novo entra na fila da
              curadoria.
            </p>
          </div>
        </div>
        {pode && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={coletar.isPending || !ativas.length}
              onClick={() => coletar.mutate(null)}
            >
              {coletar.isPending ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 size-4" />
              )}
              Coletar todas agora
            </Button>
            <Button
              size="sm"
              onClick={() =>
                setEditando({
                  id: null,
                  nome: "",
                  url: "",
                  categoria: categorias[0]?.id ?? "geral",
                  intervalo_min: 60,
                  ativa: true,
                })
              }
            >
              <Plus className="mr-1 size-4" /> Nova fonte
            </Button>
          </div>
        )}
      </div>

      {editando && (
        <div className="grid gap-3 rounded-xl border border-primary/25 bg-primary/[0.03] p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="fonte-nome">Veículo</Label>
            <Input
              id="fonte-nome"
              value={editando.nome}
              onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fonte-url">Endereço do feed (RSS ou Atom)</Label>
            <Input
              id="fonte-url"
              type="url"
              inputMode="url"
              placeholder="https://…/rss"
              value={editando.url}
              onChange={(e) => setEditando({ ...editando, url: e.target.value })}
            />
          </div>
          <SeletorCategoria
            id="fonte-categoria"
            valor={editando.categoria}
            onChange={(v) => setEditando({ ...editando, categoria: v })}
            opcoes={categorias}
          />
          <div className="space-y-1">
            <Label htmlFor="fonte-intervalo">Coletar a cada</Label>
            <Select
              value={String(editando.intervalo_min)}
              onValueChange={(v) => setEditando({ ...editando, intervalo_min: Number(v) })}
            >
              <SelectTrigger id="fonte-intervalo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVALOS.map((i) => (
                  <SelectItem key={i.v} value={String(i.v)}>
                    {i.r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              disabled={salvar.isPending}
              onClick={() => salvar.mutate(editando, { onSuccess: () => setEditando(null) })}
            >
              {salvar.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              {editando.id ? "Salvar fonte" : "Cadastrar e coletar"}
            </Button>
            <Button variant="ghost" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {carregando ? (
        <Skeleton className="h-40" />
      ) : !feeds.length ? (
        <Estado3D
          compacto
          icone={Rss}
          titulo="Nenhum feed cadastrado"
          descricao="Cadastre o RSS dos portais que a Agilliza acompanha: o coletor lê sozinho no intervalo escolhido."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {feeds.map((f) => {
            const historico = coletas.filter((c) => c.fonte_id === f.id).slice(0, 6);
            return (
              <li
                key={f.id}
                className="space-y-2 rounded-xl border border-border bg-background p-3"
              >
                <div className="flex items-start gap-2">
                  {!f.ativa ? (
                    <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  ) : f.erro ? (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  ) : f.ultima_coleta_em ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                      {f.nome}
                      {!f.ativa && <Badge variant="outline">Pausada</Badge>}
                      <Badge variant="secondary" className="font-normal">
                        {categorias.find((c) => c.id === f.categoria)?.nome ?? f.categoria}
                      </Badge>
                    </div>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {f.url_rss}
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Última coleta</dt>
                  <dd className="text-right">
                    {f.ultima_coleta_em ? ha(f.ultima_coleta_em) : "ainda não"}
                  </dd>
                  <dt className="text-muted-foreground">Próxima</dt>
                  <dd className="text-right">
                    {!f.ativa
                      ? "pausada"
                      : f.coletando_desde
                        ? "coletando…"
                        : f.proxima_coleta_em
                          ? formatData(f.proxima_coleta_em)
                          : "—"}
                  </dd>
                  <dt className="text-muted-foreground">Último resultado</dt>
                  <dd className="text-right tabular-nums">
                    {f.itens_ultima_coleta == null
                      ? "—"
                      : `${f.novos_ultima_coleta ?? 0} novas de ${f.itens_ultima_coleta}`}
                  </dd>
                  <dt className="text-muted-foreground">Matérias</dt>
                  <dd className="text-right tabular-nums">{f.noticias}</dd>
                </dl>
                {f.erro && (
                  <p className="break-words rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
                    {f.erro}
                    {f.falhas_seguidas > 1
                      ? ` (${f.falhas_seguidas} tentativas seguidas; o coletor espaça as próximas)`
                      : ""}
                  </p>
                )}
                {historicoDe === f.id && (
                  <ul className="space-y-1 rounded-md bg-muted/40 p-2 text-[11px]">
                    {historico.length ? (
                      historico.map((c) => (
                        <li key={c.id} className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">
                            {formatData(c.iniciada_em)}{" "}
                            {new Date(c.iniciada_em).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {c.origem === "manual" ? " · pedida" : ""}
                          </span>
                          <span
                            className={
                              c.ok === false
                                ? "text-destructive"
                                : c.ok
                                  ? "text-success"
                                  : "text-muted-foreground"
                            }
                          >
                            {c.ok === null
                              ? "em andamento"
                              : c.ok
                                ? `${c.novos ?? 0} nova(s)`
                                : "erro"}
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground">Sem coletas registradas.</li>
                    )}
                  </ul>
                )}
                {pode && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={coletar.isPending || !f.ativa}
                      onClick={() => coletar.mutate(f.id)}
                    >
                      <RefreshCw className="mr-1 size-3.5" /> Coletar agora
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => setHistoricoDe(historicoDe === f.id ? null : f.id)}
                    >
                      <History className="mr-1 size-3.5" /> Histórico
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() =>
                        setEditando({
                          id: f.id,
                          nome: f.nome,
                          url: f.url_rss ?? "",
                          categoria: f.categoria ?? "geral",
                          intervalo_min: f.intervalo_min,
                          ativa: f.ativa,
                        })
                      }
                    >
                      <Pencil className="mr-1 size-3.5" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      disabled={alternar.isPending}
                      onClick={() => alternar.mutate(f)}
                    >
                      {f.ativa ? "Pausar" : "Ativar"}
                    </Button>
                    <ConfirmDelete
                      titulo={`Remover "${f.nome}"?`}
                      descricao="A fonte sai do coletor. As matérias já publicadas continuam com o nome do veículo."
                      onConfirm={async () => {
                        await remover.mutateAsync(f.id).catch(() => undefined);
                      }}
                      trigger={
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-destructive"
                          aria-label={`Remover ${f.nome}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      }
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {veiculos.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Veículos sem feed (só atribuição de matérias apontadas):{" "}
          {veiculos.map((v) => v.nome).join(", ")}.
        </p>
      )}
    </section>
  );
}

/** Indicadores do Banco Central. O valor vem da coleta automática; aqui só se mostra/oculta. */
export function IndicadoresNews({
  indicadores,
  carregando,
  pode,
}: {
  indicadores: IndicadorNews[];
  carregando: boolean;
  pode: boolean;
}) {
  const fn = useServerFn(alternarIndicadorNews);
  const alternar = useAcaoNews(
    (i: IndicadorNews) => fn({ data: { codigo: i.codigo, ativo: !i.ativo } }),
    "Não foi possível alterar o indicador.",
  );

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <TrendingUp className="size-4" /> Indicadores
        </h2>
        <p className="text-sm text-muted-foreground">
          Os valores vêm da API do Banco Central pela coleta automática — nunca se digitam à mão.
        </p>
      </div>
      {carregando ? (
        <Skeleton className="h-32" />
      ) : (
        <ul className="divide-y divide-border">
          {indicadores.map((i) => (
            <li key={i.codigo} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {i.nome}
                  {i.usado_reajuste && <Badge variant="secondary">Reajuste</Badge>}
                  {Number(i.pontos) === 0 && (
                    <Badge variant="outline" className="border-amber-400 text-amber-700">
                      Sem série
                    </Badge>
                  )}
                  {!i.ativo && <Badge variant="outline">Oculto</Badge>}
                </div>
                <p className="text-xs tabular-nums text-muted-foreground">
                  série SGS {i.serie_sgs} · {i.unidade} · {i.periodicidade} ·{" "}
                  {Number(i.pontos).toLocaleString("pt-BR")} ponto(s)
                  {i.ultima_data ? ` até ${formatData(i.ultima_data)}` : ""}
                </p>
              </div>
              {pode && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={alternar.isPending}
                  onClick={() => alternar.mutate(i)}
                  aria-label={`${i.ativo ? "Ocultar" : "Mostrar"} o indicador ${i.nome}`}
                >
                  {i.ativo ? "Ocultar" : "Mostrar"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
