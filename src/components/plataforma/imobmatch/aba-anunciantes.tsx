/**
 * Aba "Anunciantes": as contas que anunciam (profissionais com o ImobMatch Pro e
 * particulares) e, ao lado, os compradores — só com o necessário (LGPD): primeiro nome,
 * e-mail mascarado, cidade e o que fizeram no portal. A busca de comprador é pelo e-mail
 * inteiro (atendimento), nunca por pedaço.
 */
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Building2, Flag, Search, UserRound, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatData } from "@/lib/financeiro/format";
import { RodapePaginas, useValorAssentado } from "@/components/plataforma/paginacao";
import { cn } from "@/lib/utils";
import {
  lerAnunciantes,
  lerCompradores,
  TIPOS_ANUNCIANTE,
} from "@/lib/plataforma/imobmatch.functions";
import { CHAVE_IMOBMATCH } from "./aba-revisao";
import { inteiro, TIPO_CONTA, Vazio } from "./comum";

type Vista = "anunciantes" | "compradores";
type Tipo = (typeof TIPOS_ANUNCIANTE)[number];
const ROTULO_TIPO: Record<Tipo, string> = {
  todos: "Todos",
  profissionais: "Profissionais",
  particulares: "Particulares",
};
const SITUACAO_CONTA: Record<string, string> = {
  trial: "Em teste",
  ativo: "Ativa",
  somente_leitura: "Somente leitura",
  suspenso: "Suspensa",
  cancelado: "Cancelada",
};

export function AbaAnunciantes() {
  const [vista, setVista] = useState<Vista>("anunciantes");
  return (
    <div className="space-y-4">
      <div
        className="inline-flex rounded-lg bg-muted p-1"
        role="tablist"
        aria-label="Anunciantes ou compradores"
      >
        {(
          [
            { id: "anunciantes", rotulo: "Anunciantes", icone: Building2 },
            { id: "compradores", rotulo: "Compradores", icone: Users },
          ] as const
        ).map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={vista === o.id}
            onClick={() => setVista(o.id)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
              vista === o.id
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <o.icone className="size-4" aria-hidden /> {o.rotulo}
          </button>
        ))}
      </div>
      {vista === "anunciantes" ? <ListaAnunciantes /> : <ListaCompradores />}
    </div>
  );
}

function ListaAnunciantes() {
  const lerFn = useServerFn(lerAnunciantes);
  const [tipo, setTipo] = useState<Tipo>("todos");
  const [busca, setBusca] = useState("");
  const buscaAssentada = useValorAssentado(busca.trim());
  const [pagina, setPagina] = useState(1);
  const q = useQuery({
    queryKey: [...CHAVE_IMOBMATCH, "anunciantes", tipo, buscaAssentada, pagina],
    queryFn: () => lerFn({ data: { tipo, busca: buscaAssentada, pagina } }),
    staleTime: 30_000,
    placeholderData: (a) => a,
  });
  const itens = q.data?.itens ?? [];

  return (
    <section className="min-w-0 rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label="Tipo"
        >
          {TIPOS_ANUNCIANTE.map((t) => (
            <Button
              key={t}
              type="button"
              size="sm"
              variant={tipo === t ? "default" : "outline"}
              aria-pressed={tipo === t}
              className="shrink-0 rounded-full"
              onClick={() => {
                setTipo(t);
                setPagina(1);
              }}
            >
              {ROTULO_TIPO[t]}
              {q.data && t !== "todos" && (
                <span className="ml-1 tabular-nums opacity-70">
                  {t === "profissionais"
                    ? q.data.contagem.profissionais
                    : q.data.contagem.particulares}
                </span>
              )}
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
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
            placeholder="Nome da conta"
            aria-label="Buscar anunciante"
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
          {mensagemDeErro(q.error, "Não foi possível ler os anunciantes.")}
        </p>
      ) : itens.length === 0 ? (
        <div className="p-4">
          <Vazio
            icone={<Building2 className="size-5" aria-hidden />}
            titulo="Nenhum anunciante neste recorte"
            texto="Contas com o ImobMatch Pro e particulares que pagam para anunciar aparecem aqui."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {itens.map((a) => (
            <li
              key={a.id}
              className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="break-words font-medium">{a.nome}</span>
                  {a.verificado && (
                    <BadgeCheck className="size-4 text-emerald-600" aria-label="CRECI verificado" />
                  )}
                  <Badge variant="outline">{TIPO_CONTA[a.tipo] ?? a.tipo}</Badge>
                  <Badge
                    variant={a.status === "ativo" || a.status === "trial" ? "secondary" : "warning"}
                  >
                    {SITUACAO_CONTA[a.status] ?? a.status}
                  </Badge>
                </p>
                <p className="break-words text-xs text-muted-foreground">
                  {a.plano ?? "sem plano"}
                  {a.documento_mascarado ? ` · ${a.documento_mascarado}` : ""} · desde{" "}
                  {formatData(a.criado_em)}
                  {a.acesso_ate ? ` · pago até ${formatData(a.acesso_ate)}` : ""}
                </p>
              </div>
              <dl className="grid grid-cols-4 gap-3 text-center text-xs sm:w-[320px]">
                <Numero rotulo="No ar" valor={a.no_ar} />
                <Numero rotulo="Revisão" valor={a.em_revisao} alerta={a.em_revisao > 0} />
                <Numero rotulo="Moderados" valor={a.moderados} alerta={a.moderados > 0} />
                <Numero
                  rotulo="Denúncias"
                  valor={a.denuncias_abertas}
                  alerta={a.denuncias_abertas > 0}
                  icone={<Flag className="size-3" aria-hidden />}
                />
              </dl>
              <p className="text-[11px] text-muted-foreground sm:col-span-2">
                Limite do plano:{" "}
                {a.limite == null || Number(a.limite) < 0
                  ? "sem limite de anúncios"
                  : `${inteiro(Number(a.limite))} anúncio(s)`}
              </p>
            </li>
          ))}
        </ul>
      )}
      <RodapePaginas
        pagina={pagina}
        porPagina={q.data?.por_pagina ?? 50}
        quantidade={itens.length}
        total={q.data?.total}
        carregando={q.isFetching}
        onPagina={setPagina}
      />
    </section>
  );
}

function Numero({
  rotulo,
  valor,
  alerta,
  icone,
}: {
  rotulo: string;
  valor: number;
  alerta?: boolean;
  icone?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-muted-foreground">{rotulo}</dt>
      <dd
        className={cn(
          "inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums",
          alerta ? "text-amber-700 dark:text-amber-400" : "",
        )}
      >
        {icone}
        {inteiro(valor)}
      </dd>
    </div>
  );
}

function ListaCompradores() {
  const lerFn = useServerFn(lerCompradores);
  const [email, setEmail] = useState("");
  const [procurado, setProcurado] = useState("");
  const [pagina, setPagina] = useState(1);
  const q = useQuery({
    queryKey: [...CHAVE_IMOBMATCH, "compradores", procurado, pagina],
    queryFn: () => lerFn({ data: { email: procurado, pagina } }),
    staleTime: 30_000,
    placeholderData: (a) => a,
  });
  const itens = q.data?.itens ?? [];
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <section className="min-w-0 rounded-xl border border-border bg-card">
      <div className="space-y-2 border-b border-border p-3 sm:p-4">
        <p className="text-xs text-muted-foreground">
          {q.data
            ? `${inteiro(q.data.total)} comprador(es) · ${inteiro(q.data.confirmados)} com e-mail confirmado. `
            : ""}
          Por privacidade, a lista mostra só o primeiro nome e o e-mail mascarado; a busca é pelo
          e-mail inteiro.
        </p>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (emailValido || !email.trim()) {
              setProcurado(email.trim());
              setPagina(1);
            }
          }}
        >
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail completo do comprador"
            aria-label="E-mail do comprador"
            autoComplete="off"
            className="text-base sm:max-w-sm sm:text-sm"
          />
          <div className="flex gap-2">
            <Button type="submit" variant="outline" disabled={!!email.trim() && !emailValido}>
              <Search className="mr-2 size-4" /> Procurar
            </Button>
            {procurado && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEmail("");
                  setProcurado("");
                }}
              >
                Ver todos
              </Button>
            )}
          </div>
        </form>
      </div>

      {q.isLoading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : q.isError ? (
        <p className="m-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(q.error, "Não foi possível ler os compradores.")}
        </p>
      ) : itens.length === 0 ? (
        <div className="p-4">
          <Vazio
            icone={<UserRound className="size-5" aria-hidden />}
            titulo={procurado ? "Nenhum comprador com este e-mail" : "Nenhum comprador ainda"}
            texto="Quem cria conta no portal do ImobMatch para salvar imóveis, dar AMEI e falar com anunciantes aparece aqui."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {itens.map((c) => (
            <li
              key={c.id}
              className="grid gap-1 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{c.primeiro_nome || "Comprador"}</span>
                  <span className="break-all text-xs text-muted-foreground">{c.email ?? "—"}</span>
                  {!c.confirmado && <Badge variant="warning">E-mail não confirmado</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[c.cidade, c.uf].filter(Boolean).join("/") || "sem cidade"} · entrou em{" "}
                  {formatData(c.criado_em)}
                  {c.ultimo_acesso ? ` · último acesso ${formatData(c.ultimo_acesso)}` : ""}
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-3 text-center text-xs sm:w-[240px]">
                <Numero rotulo="AMEI" valor={c.amei} />
                <Numero rotulo="Pedidos" valor={c.pedidos} />
                <Numero rotulo="Denúncias" valor={c.denuncias} />
              </dl>
            </li>
          ))}
        </ul>
      )}
      <RodapePaginas
        pagina={pagina}
        porPagina={q.data?.por_pagina ?? 50}
        quantidade={itens.length}
        total={q.data?.total}
        carregando={q.isFetching}
        onPagina={setPagina}
      />
    </section>
  );
}
