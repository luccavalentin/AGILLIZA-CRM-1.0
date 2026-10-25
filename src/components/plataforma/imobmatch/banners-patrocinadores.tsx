/**
 * Aba "Patrocinadores": as empresas que compram banner, com o que pagaram e o que está no
 * ar. Na gaveta, as campanhas do patrocinador e o bloqueio (com motivo): bloqueado, nada
 * dele vai ao ar e ele não compra nem envia criativo.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ban, Building, ChevronRight, Loader2, Search, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import { useValorAssentado } from "@/components/plataforma/paginacao";
import {
  bloquearPatrocinador,
  lerCampanhas,
  lerPatrocinadores,
  type Patrocinador,
} from "@/lib/plataforma/patrocinados.functions";
import { CHAVE_BANNERS, SEGMENTO, SeloCampanha, praca } from "./banners-comum";
import { inteiro, Vazio } from "./comum";

export function AbaPatrocinadores() {
  const lerFn = useServerFn(lerPatrocinadores);
  const [busca, setBusca] = useState("");
  const b = useValorAssentado(busca.trim());
  const [aberto, setAberto] = useState<Patrocinador | null>(null);
  const q = useQuery({
    queryKey: [...CHAVE_BANNERS, "patrocinadores", b],
    queryFn: () => lerFn({ data: { busca: b } }),
    staleTime: 30_000,
    placeholderData: (a) => a,
  });
  const itens = q.data ?? [];

  return (
    <section className="min-w-0 rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <p className="text-xs text-muted-foreground">
          {q.data ? `${itens.length} patrocinador(es)` : "Carregando…"}
        </p>
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, razão social ou e-mail"
            aria-label="Buscar patrocinador"
            className="pl-8 text-base sm:text-sm"
          />
        </div>
      </div>
      {q.isLoading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : q.isError ? (
        <p className="m-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(q.error, "Não foi possível ler os patrocinadores.")}
        </p>
      ) : itens.length === 0 ? (
        <div className="p-4">
          <Vazio
            icone={<Building className="size-5" aria-hidden />}
            titulo={b ? "Ninguém com essa busca" : "Nenhum patrocinador ainda"}
            texto="Empresas que se cadastram em “Anuncie sua marca” aparecem aqui."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {itens.map((p) => (
            <li key={p.conta}>
              <button
                type="button"
                onClick={() => setAberto(p)}
                className="grid min-h-11 w-full gap-2 p-3 text-left transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:p-4"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="break-words font-medium">{p.nome}</span>
                    {p.segmento && (
                      <Badge variant="outline">{SEGMENTO[p.segmento] ?? p.segmento}</Badge>
                    )}
                    {p.situacao === "bloqueado" && <Badge variant="destructive">Bloqueado</Badge>}
                  </span>
                  <span className="block break-words text-xs text-muted-foreground">
                    {p.razao_social ?? p.responsavel ?? "—"} · desde {formatData(p.desde)}
                  </span>
                </span>
                <span className="grid grid-cols-3 gap-3 text-center text-xs sm:w-[230px]">
                  <span>
                    <span className="block text-muted-foreground">No ar</span>
                    <span className="font-semibold tabular-nums">{inteiro(p.no_ar)}</span>
                  </span>
                  <span>
                    <span className="block text-muted-foreground">Em análise</span>
                    <span className="font-semibold tabular-nums">{inteiro(p.em_analise)}</span>
                  </span>
                  <span>
                    <span className="block text-muted-foreground">Pago</span>
                    <span className="font-semibold tabular-nums">
                      {formatBRL(Number(p.pago_total))}
                    </span>
                  </span>
                </span>
                <ChevronRight
                  className="hidden size-4 text-muted-foreground sm:block"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      <DetalhePatrocinador p={aberto} onFechar={() => setAberto(null)} />
    </section>
  );
}

function DetalhePatrocinador({ p, onFechar }: { p: Patrocinador | null; onFechar: () => void }) {
  const podeModerar = usePermissao("saas.patrocinados", "edit");
  const lerFn = useServerFn(lerCampanhas);
  const camp = useQuery({
    queryKey: [...CHAVE_BANNERS, "campanhas-do", p?.conta],
    queryFn: () => lerFn({ data: { conta: p!.conta, situacao: null } }),
    enabled: !!p,
    staleTime: 30_000,
  });
  return (
    <Sheet open={!!p} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {p && (
          <>
            <SheetHeader>
              <SheetTitle className="break-words pr-6">{p.nome}</SheetTitle>
              <SheetDescription>
                {p.tipo_pessoa === "PJ" ? "Empresa" : "Pessoa física"} · desde {formatData(p.desde)}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border p-3 text-sm">
                {(
                  [
                    ["Razão social", p.razao_social],
                    ["Documento", p.documento],
                    ["Responsável", p.responsavel],
                    ["E-mail", p.email],
                    ["Celular", p.celular],
                    ["Site", p.site],
                  ] as const
                ).map(([r, v]) => (
                  <div key={r} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{r}</dt>
                    <dd className="break-all">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Campanhas</h3>
                {camp.isLoading ? (
                  <Skeleton className="h-16" />
                ) : (camp.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma campanha.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {camp.data!.map((c) => (
                      <li key={c.id} className="space-y-0.5 p-2.5 text-sm">
                        <p className="flex flex-wrap items-center gap-1.5">
                          <span className="break-words font-medium">{c.nome}</span>
                          <SeloCampanha situacao={c.situacao} />
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.espaco_nome ?? c.espaco} · {praca(c)} ·{" "}
                          {c.inicio ? formatData(c.inicio) : "—"} a{" "}
                          {c.fim ? formatData(c.fim) : "—"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {podeModerar ? (
                <Bloqueio key={p.conta} p={p} onFeito={onFechar} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Você pode ver os patrocinadores, mas não bloquear.
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Bloqueio({ p, onFeito }: { p: Patrocinador; onFeito: () => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(bloquearPatrocinador);
  const bloquear = p.situacao !== "bloqueado";
  const [motivo, setMotivo] = useState("");
  const m = useMutation({
    mutationFn: () => fn({ data: { conta: p.conta, bloquear, motivo } }),
    onSuccess: () => {
      toast.success(
        bloquear ? "Patrocinador bloqueado: nada dele vai ao ar." : "Patrocinador liberado.",
      );
      qc.invalidateQueries({ queryKey: CHAVE_BANNERS });
      onFeito();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível mudar o bloqueio.")),
  });
  return (
    <section
      className={`space-y-3 rounded-lg border p-3 ${bloquear ? "border-destructive/30" : "border-border"}`}
    >
      <div>
        <h3 className="text-sm font-semibold">
          {bloquear ? "Bloquear patrocinador" : "Liberar patrocinador"}
        </h3>
        <p className="text-xs text-muted-foreground">
          {bloquear
            ? "Nada dele vai ao ar e ele não compra nem envia criativo. Ele lê o motivo na conta."
            : `Bloqueado: ${p.bloqueio_motivo ?? "sem motivo registrado"}.`}
        </p>
      </div>
      {bloquear && (
        <div className="space-y-1">
          <Label htmlFor={`blq-${p.conta}`}>Motivo (obrigatório)</Label>
          <Textarea
            id={`blq-${p.conta}`}
            rows={3}
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: banners com promessa enganosa repetidas vezes."
          />
        </div>
      )}
      <Button
        variant={bloquear ? "destructive" : "default"}
        disabled={(bloquear && motivo.trim().length < 5) || m.isPending}
        onClick={() => m.mutate()}
      >
        {m.isPending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : bloquear ? (
          <Ban className="mr-2 size-4" />
        ) : (
          <Unlock className="mr-2 size-4" />
        )}
        {bloquear ? "Bloquear" : "Liberar"}
      </Button>
    </section>
  );
}
