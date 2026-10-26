/**
 * Aba "Profissionais (CRECI)": corretores e imobiliárias do ImobMatch Pro com o CRECI e a
 * situação da verificação. O selo "verificado" do portal é o da Rede (`rede.participantes`):
 * só existe para quem pediu a verificação — a equipe não cria o pedido em nome do
 * profissional (poria os imóveis dele na vitrine da Rede sem o consentimento dele).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgeCheck, ChevronRight, Loader2, Search, UserSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatData } from "@/lib/financeiro/format";
import { RodapePaginas, useValorAssentado } from "@/components/plataforma/paginacao";
import {
  FILTROS_PROFISSIONAIS,
  lerProfissionais,
  verificarCreci,
  type Profissional,
} from "@/lib/plataforma/imobmatch.functions";
import { CHAVE_IMOBMATCH } from "./aba-revisao";
import { dataHora, SeloCreci, TIPO_CONTA, Vazio } from "./comum";
import { useModeraImobMatch } from "@/hooks/use-permissao-imobmatch";

type Filtro = (typeof FILTROS_PROFISSIONAIS)[number];
const ROTULO: Record<Filtro, string> = {
  pendentes: "A conferir",
  verificados: "Verificados",
  sem_pedido: "Sem pedido",
  fora: "Recusados e suspensos",
  todos: "Todos",
};
type Decisao = "pendente" | "verificado" | "recusado" | "suspenso";
const DECISAO: Record<Decisao, string> = {
  verificado: "Verificado (CRECI conferido)",
  pendente: "Voltar para a conferência",
  recusado: "Recusado",
  suspenso: "Suspenso",
};

export function AbaProfissionais() {
  const lerFn = useServerFn(lerProfissionais);
  const [filtro, setFiltro] = useState<Filtro>("pendentes");
  const [busca, setBusca] = useState("");
  const buscaAssentada = useValorAssentado(busca.trim());
  const [pagina, setPagina] = useState(1);
  const [aberto, setAberto] = useState<Profissional | null>(null);
  const q = useQuery({
    queryKey: [...CHAVE_IMOBMATCH, "profissionais", filtro, buscaAssentada, pagina],
    queryFn: () => lerFn({ data: { filtro, busca: buscaAssentada, pagina } }),
    staleTime: 20_000,
    placeholderData: (a) => a,
  });
  const c = q.data?.contagem;
  const itens = q.data?.itens ?? [];

  return (
    <section className="min-w-0 rounded-xl border border-border bg-card">
      <div className="space-y-3 border-b border-border p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Confira o número no site do CRECI da UF (ou no Cofeci) antes de verificar. É o selo que
            o comprador vê no portal.
          </p>
          <div className="relative w-full sm:w-64 sm:shrink-0">
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
              placeholder="Nome ou CRECI"
              aria-label="Buscar profissional"
              className="pl-8 text-base sm:text-sm"
            />
          </div>
        </div>
        <div
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label="Situação"
        >
          {FILTROS_PROFISSIONAIS.map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={filtro === f ? "default" : "outline"}
              aria-pressed={filtro === f}
              className="shrink-0 rounded-full"
              onClick={() => {
                setFiltro(f);
                setPagina(1);
              }}
            >
              {ROTULO[f]}
              {c && <span className="ml-1 tabular-nums opacity-70">{c[f]}</span>}
            </Button>
          ))}
        </div>
      </div>

      {q.isLoading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : q.isError ? (
        <p className="m-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(q.error, "Não foi possível ler os profissionais.")}
        </p>
      ) : itens.length === 0 ? (
        <div className="p-4">
          <Vazio
            icone={<UserSearch className="size-5" aria-hidden />}
            titulo="Ninguém neste recorte"
            texto="Os profissionais com o ImobMatch Pro aparecem aqui. Os pedidos de verificação do CRECI vêm primeiro."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {itens.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setAberto(p)}
                className="flex min-h-11 w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/40 sm:p-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="break-words font-medium">{p.nome}</span>
                    <SeloCreci situacao={p.situacao} />
                    <Badge variant="outline">{TIPO_CONTA[p.tipo] ?? p.tipo}</Badge>
                  </span>
                  <span className="block break-words text-xs text-muted-foreground">
                    {(p.creci_rede ?? p.creci)
                      ? `CRECI ${p.creci_rede ?? p.creci}${(p.creci_uf_rede ?? p.creci_uf) ? `/${p.creci_uf_rede ?? p.creci_uf}` : ""}`
                      : "sem CRECI informado"}{" "}
                    · {p.anuncios_no_ar} anúncio(s) no ar
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <RodapePaginas
        pagina={pagina}
        porPagina={q.data?.por_pagina ?? 50}
        quantidade={itens.length}
        total={c ? c[filtro] : undefined}
        carregando={q.isFetching}
        onPagina={setPagina}
      />
      <DetalheProfissional p={aberto} onFechar={() => setAberto(null)} />
    </section>
  );
}

function DetalheProfissional({ p, onFechar }: { p: Profissional | null; onFechar: () => void }) {
  const podeVerificar = useModeraImobMatch("edit");
  const creci = p ? (p.creci_rede ?? p.creci) : null;
  const uf = p ? (p.creci_uf_rede ?? p.creci_uf) : null;
  return (
    <Sheet open={!!p} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {p && (
          <>
            <SheetHeader>
              <SheetTitle className="break-words pr-6">{p.nome}</SheetTitle>
              <SheetDescription>
                {TIPO_CONTA[p.tipo] ?? p.tipo} · conta desde {formatData(p.criado_em)}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-1.5">
                <SeloCreci situacao={p.situacao} />
                {p.como_empresa != null && (
                  <Badge variant="outline">
                    {p.como_empresa ? "pessoa jurídica" : "pessoa física"}
                  </Badge>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border p-3 text-sm">
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">CRECI</dt>
                  <dd className="break-words">{creci ?? "—"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">UF</dt>
                  <dd>{uf ?? "—"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Pedido em</dt>
                  <dd>{p.pedido_em ? formatData(p.pedido_em) : "—"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Anúncios no ar</dt>
                  <dd className="tabular-nums">{p.anuncios_no_ar}</dd>
                </div>
              </dl>
              {creci && uf && (
                <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                  Confira em <span className="font-mono">creci{uf.toLowerCase()}.gov.br</span> (ou
                  no portal do Cofeci) antes de verificar.
                </p>
              )}
              {p.verificado_em && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <BadgeCheck className="size-3.5 text-emerald-600" aria-hidden />
                  Verificado por {p.verificador ?? "—"} em {dataHora(p.verificado_em)}.
                </p>
              )}
              {p.motivo && p.situacao !== "verificado" && (
                <p className="rounded-md border border-border p-2 text-xs">
                  <span className="font-medium">Motivo: </span>
                  {p.motivo}
                </p>
              )}
              {p.situacao === "sem_pedido" ? (
                <p className="rounded-md border border-amber-400/70 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  Este profissional ainda não pediu a verificação do CRECI. O pedido sai da Rede de
                  Corretores, no AgillizaTech dele — a equipe não cria o pedido por ele.
                </p>
              ) : podeVerificar ? (
                <Decisao key={p.id} p={p} onFeito={onFechar} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Você pode ver os profissionais, mas não verificar o CRECI.
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Decisao({ p, onFeito }: { p: Profissional; onFeito: () => void }) {
  const qc = useQueryClient();
  const verificarFn = useServerFn(verificarCreci);
  const [status, setStatus] = useState<Decisao>(
    p.situacao === "pendente" ? "verificado" : (p.situacao as Decisao),
  );
  const [motivo, setMotivo] = useState(p.motivo ?? "");
  const exige = status === "recusado" || status === "suspenso";
  const m = useMutation({
    mutationFn: () => verificarFn({ data: { tenantId: p.id, status, motivo } }),
    onSuccess: () => {
      toast.success(
        status === "verificado"
          ? "CRECI conferido: o selo aparece no portal."
          : "Situação do CRECI atualizada.",
      );
      qc.invalidateQueries({ queryKey: CHAVE_IMOBMATCH });
      onFeito();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível atualizar o CRECI.")),
  });
  return (
    <section className="space-y-3 rounded-lg border border-border p-3">
      <h3 className="text-sm font-semibold">Decisão</h3>
      <div className="space-y-1">
        <Label htmlFor="creci-situacao">Situação</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as Decisao)}>
          <SelectTrigger id="creci-situacao" aria-label="Situação do CRECI">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(DECISAO) as Decisao[]).map((s) => (
              <SelectItem key={s} value={s}>
                {DECISAO[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="creci-motivo">Motivo{exige ? " (obrigatório)" : " (opcional)"}</Label>
        <Textarea
          id="creci-motivo"
          rows={3}
          value={motivo}
          maxLength={1000}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Obrigatório ao recusar ou suspender (mínimo 10 caracteres)."
        />
      </div>
      <Button
        disabled={m.isPending || (exige && motivo.trim().length < 10)}
        onClick={() => m.mutate()}
      >
        {m.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
        Aplicar
      </Button>
    </section>
  );
}
