/**
 * Calendário das Automações (estrutura do Postei): grade do mês e da semana no monitor,
 * agenda e mês compacto no celular, datas comemorativas, arrastar para reagendar e a faixa
 * com os números da semana.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { chaveDoDia, datasDoDia, type DataEspecial } from "@/lib/social/datas-br";
import {
  DIAS_SEMANA,
  diasDaSemana,
  diasDoMes,
  gradeDoMes,
  inicioDoDia,
  mesmoDia,
  mesmoMes,
  podeArrastar,
  porDia,
  somarDias,
} from "@/lib/social/calendario";
import type { PostResumo, ResumoSemana } from "@/lib/social/automacoes.functions";
import { cn } from "@/lib/utils";
import { Miniatura, RedesDoPost, SeloStatus, STATUS_POST, hora, primeiraLinha } from "./comum";

export type ModoCalendario = "auto" | "mes" | "semana" | "agenda";

const TOM_DATA: Record<DataEspecial["tipo"], string> = {
  feriado: "bg-destructive/[0.08] text-destructive",
  varejo: "bg-primary/[0.08] text-primary",
  imobiliario: "bg-success/10 text-success-texto",
  campanha: "bg-secondary text-muted-foreground",
};

function EtiquetaData({ dia }: { dia: Date }) {
  const datas = datasDoDia(dia);
  if (!datas.length) return null;
  const d = datas[0]!;
  return (
    <span
      title={datas.map((x) => x.nome).join(" · ")}
      className={cn(
        "min-w-0 truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-medium",
        TOM_DATA[d.tipo],
      )}
    >
      {d.nome}
      {datas.length > 1 ? ` +${datas.length - 1}` : ""}
    </span>
  );
}

const plural = (n: number) => `${n} ${n === 1 ? "post" : "posts"}`;

function rotuloMes(base: Date) {
  const m = base.toLocaleDateString("pt-BR", { month: "long" });
  return (
    <>
      <span className="capitalize">{m}</span>{" "}
      <span className="font-normal text-muted-foreground">{base.getFullYear()}</span>
    </>
  );
}

function rotuloSemana(dias: Date[]) {
  const a = dias[0]!;
  const b = dias[6]!;
  const fim = b.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  return (
    <>
      {a.getDate()}–{fim}{" "}
      <span className="font-normal text-muted-foreground">{b.getFullYear()}</span>
    </>
  );
}

export function Calendario({
  base,
  modo,
  posts,
  carregando,
  resumo,
  contas,
  podeEditar,
  aoReagendar,
}: {
  base: Date;
  modo: ModoCalendario;
  posts: PostResumo[];
  carregando: boolean;
  resumo: ResumoSemana | null;
  contas: number | null;
  podeEditar: boolean;
  aoReagendar: (id: string, quando: Date) => void;
}) {
  const [sobre, setSobre] = useState<string | null>(null);
  const hoje = inicioDoDia(new Date());
  const semana = modo === "semana";
  const grade = semana ? diasDaSemana(base) : gradeDoMes(base);
  const dias = useMemo(() => porDia(posts), [posts]);
  const semData = posts.filter((p) => !p.agendado_para && p.status !== "cancelado");

  const busca = (d: Date | null, m: ModoCalendario = modo) => ({
    ...(d ? { data: chaveDoDia(d) } : {}),
    ...(m !== "auto" ? { visao: m } : {}),
  });
  const anterior = semana
    ? somarDias(base, -7)
    : new Date(base.getFullYear(), base.getMonth() - 1, 1);
  const proximo = semana
    ? somarDias(base, 7)
    : new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const titulo = semana ? rotuloSemana(grade) : rotuloMes(base);

  function soltar(dia: Date, id: string) {
    setSobre(null);
    const p = posts.find((x) => x.id === id);
    if (!p?.agendado_para || mesmoDia(new Date(p.agendado_para), dia)) return;
    const o = new Date(p.agendado_para);
    aoReagendar(
      id,
      new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), o.getHours(), o.getMinutes()),
    );
  }

  const modosMonitor: { m: ModoCalendario; rotulo: string }[] = [
    { m: "auto", rotulo: "Mês" },
    { m: "semana", rotulo: "Semana" },
    { m: "agenda", rotulo: "Agenda" },
  ];
  const ativoMonitor: ModoCalendario = modo === "mes" ? "auto" : modo;
  const modosCelular: { m: ModoCalendario; rotulo: string }[] = [
    { m: "auto", rotulo: "Agenda" },
    { m: "semana", rotulo: "Semana" },
    { m: "mes", rotulo: "Mês" },
  ];
  const ativoCelular: ModoCalendario = modo === "agenda" ? "auto" : modo;
  const vazio = !carregando && posts.length === 0;

  return (
    <div className="space-y-4">
      {/* Barra: título com setas, visões e criar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 items-center">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-11 sm:size-9"
            aria-label="Período anterior"
          >
            <Link to="/automacoes" search={busca(anterior)}>
              <ChevronLeft className="size-5" />
            </Link>
          </Button>
          <h2 className="min-w-0 truncate px-1 text-lg font-medium tracking-tight text-foreground sm:text-xl">
            {titulo}
          </h2>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-11 sm:size-9"
            aria-label="Próximo período"
          >
            <Link to="/automacoes" search={busca(proximo)}>
              <ChevronRight className="size-5" />
            </Link>
          </Button>
        </div>
        <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-8">
          <Link to="/automacoes" search={busca(null)}>
            Hoje
          </Link>
        </Button>
        <nav
          aria-label="Visualização"
          className="ml-auto hidden rounded-[10px] border bg-secondary p-0.5 md:inline-flex"
        >
          {modosMonitor.map(({ m, rotulo }) => (
            <Link
              key={m}
              to="/automacoes"
              search={busca(base, m)}
              aria-current={ativoMonitor === m ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center rounded-[8px] px-3 text-[13px] font-medium",
                ativoMonitor === m
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {rotulo}
            </Link>
          ))}
        </nav>
        {podeEditar && (
          <Button asChild className="min-h-11 max-md:ml-auto sm:min-h-9">
            <Link to="/automacoes/novo">
              <Plus className="mr-1.5 size-4" /> Criar post
            </Link>
          </Button>
        )}
        <nav
          aria-label="Visualização"
          className="grid w-full grid-cols-3 rounded-[12px] border bg-secondary p-0.5 md:hidden"
        >
          {modosCelular.map(({ m, rotulo }) => (
            <Link
              key={m}
              to="/automacoes"
              search={busca(base, m)}
              aria-current={ativoCelular === m ? "page" : undefined}
              className={cn(
                "inline-flex h-11 items-center justify-center rounded-[10px] text-sm font-medium",
                ativoCelular === m
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground",
              )}
            >
              {rotulo}
            </Link>
          ))}
        </nav>
      </div>

      {resumo && <FaixaSemana resumo={resumo} />}

      {vazio && contas !== null && posts.length === 0 && (
        <PrimeirosPassos contas={contas} podeEditar={podeEditar} />
      )}

      {/* Celular */}
      {modo !== "agenda" && (
        <div className="md:hidden">
          {carregando ? (
            <Skeleton className="h-80 w-full rounded-xl" />
          ) : modo === "mes" ? (
            <MiniMes base={base} grade={grade} dias={dias} hoje={hoje} podeEditar={podeEditar} />
          ) : (
            <Agenda
              dias={modo === "semana" ? grade : diasDoMes(base)}
              porDia={dias}
              hoje={hoje}
              podeEditar={podeEditar}
              recolherPassado={modo === "auto" && mesmoMes(base, hoje)}
            />
          )}
        </div>
      )}

      {/* Agenda em qualquer tela */}
      {modo === "agenda" && (
        <div className="overflow-hidden rounded-[14px] border bg-card md:max-w-3xl">
          {carregando ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <Agenda
              dias={diasDoMes(base)}
              porDia={dias}
              hoje={hoje}
              podeEditar={podeEditar}
              recolherPassado={mesmoMes(base, hoje)}
            />
          )}
        </div>
      )}

      {/* Grade (tablet e monitor) */}
      {modo !== "agenda" && (
        <div className="hidden md:block">
          <div className="overflow-hidden rounded-[14px] border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]">
            <div className="grid grid-cols-7 border-b bg-secondary/60">
              {grade.slice(0, 7).map((d, i) => {
                const eHoje = mesmoDia(d, hoje);
                return (
                  <div key={i} className="flex min-w-0 items-baseline gap-2 px-2 py-2.5 lg:px-3">
                    <span
                      className={cn(
                        "text-[11px] font-medium uppercase tracking-wide",
                        eHoje && semana ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {DIAS_SEMANA[d.getDay()]}
                    </span>
                    {semana && (
                      <span
                        className={cn(
                          "text-lg font-medium leading-none tabular-nums",
                          eHoje
                            ? "rounded-md bg-primary px-1.5 py-0.5 text-primary-foreground"
                            : "text-foreground",
                        )}
                      >
                        {d.getDate()}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7">
              {grade.map((dia, i) => {
                const k = chaveDoDia(dia);
                const itens = dias.get(k) ?? [];
                const passado = dia < hoje;
                const doMes = semana || mesmoMes(dia, base);
                const eHoje = mesmoDia(dia, hoje);
                const max = semana ? 50 : 3;
                const ultimaColuna = i % 7 === 6;
                const ultimaLinha = i >= grade.length - 7;
                return (
                  <div
                    key={k}
                    onDragOver={(e) => {
                      if (passado || !podeEditar) return;
                      e.preventDefault();
                      setSobre(k);
                    }}
                    onDragLeave={() => setSobre((s) => (s === k ? null : s))}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!passado && podeEditar)
                        soltar(dia, e.dataTransfer.getData("text/post-id"));
                    }}
                    className={cn(
                      "group relative flex min-w-0 flex-col gap-1.5 border-border p-1.5 transition-colors lg:p-2",
                      semana ? "min-h-[460px]" : "min-h-[124px] xl:min-h-[132px]",
                      !ultimaColuna && "border-r",
                      !ultimaLinha && "border-b",
                      doMes ? (passado ? "bg-secondary/30" : "bg-card") : "bg-secondary/60",
                      sobre === k &&
                        "!bg-primary/[0.06] outline-dashed outline-2 -outline-offset-4 outline-primary/50",
                    )}
                  >
                    {!semana && (
                      <div className="flex h-6 min-w-0 items-center justify-between gap-1">
                        <span
                          className={cn(
                            "grid h-6 min-w-6 place-items-center rounded-md px-1 text-[12.5px] tabular-nums",
                            eHoje
                              ? "bg-primary font-semibold text-primary-foreground"
                              : doMes && !passado
                                ? "font-medium text-foreground"
                                : "text-muted-foreground/70",
                          )}
                        >
                          {dia.getDate()}
                        </span>
                        <EtiquetaData dia={dia} />
                      </div>
                    )}
                    {semana && datasDoDia(dia).length > 0 && (
                      <div>
                        <EtiquetaData dia={dia} />
                      </div>
                    )}
                    {itens
                      .slice(0, max)
                      .map((p) =>
                        semana ? (
                          <CartaoSemana key={p.id} post={p} podeEditar={podeEditar} />
                        ) : (
                          <ChipMes key={p.id} post={p} podeEditar={podeEditar} />
                        ),
                      )}
                    {itens.length > max && (
                      <Link
                        to="/automacoes"
                        search={{ data: k, visao: "semana" }}
                        className="px-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-primary"
                      >
                        +{itens.length - max} posts
                      </Link>
                    )}
                    {!passado && podeEditar && (
                      <Link
                        to="/automacoes/novo"
                        search={{ data: k }}
                        aria-label={`Criar post em ${dia.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}`}
                        className={cn(
                          "mt-auto flex items-center justify-center gap-1 rounded-lg border border-dashed border-border text-[12px] text-muted-foreground opacity-0 transition-opacity hover:border-primary/50 hover:text-primary focus:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:hidden",
                          itens.length ? "h-7" : "h-8",
                        )}
                      >
                        <Plus className="size-3.5" /> Agendar
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {podeEditar && (
            <p className="mt-2.5 text-xs text-muted-foreground [@media(pointer:coarse)]:hidden">
              Arraste um post para outro dia para reagendar (o horário fica o mesmo).
            </p>
          )}
        </div>
      )}

      {semData.length > 0 && (
        <section className="rounded-[14px] border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">Rascunhos sem data</h3>
          <ul className="mt-2 divide-y">
            {semData.map((p) => (
              <li key={p.id}>
                <Link
                  to="/automacoes/posts/$id"
                  params={{ id: p.id }}
                  className="flex min-h-12 items-center gap-3 py-2 hover:text-primary"
                >
                  <Miniatura capa={p.capa} className="size-9 rounded-md ring-1 ring-border" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {primeiraLinha(p.legenda) || "Sem legenda"}
                  </span>
                  <SeloStatus status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function propsArrastar(p: PostResumo, podeEditar: boolean) {
  const pode = podeEditar && podeArrastar(p);
  return {
    draggable: pode,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("text/post-id", p.id);
      e.dataTransfer.effectAllowed = "move";
    },
    className: pode ? "cursor-grab active:cursor-grabbing" : "",
  };
}

function ChipMes({ post, podeEditar }: { post: PostResumo; podeEditar: boolean }) {
  const a = propsArrastar(post, podeEditar);
  return (
    <Link
      to="/automacoes/posts/$id"
      params={{ id: post.id }}
      draggable={a.draggable}
      onDragStart={a.onDragStart}
      title={post.legenda}
      className={cn(
        "block min-w-0 rounded-[9px] border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)] transition-[transform,border-color] hover:-translate-y-px hover:border-primary/30",
        a.className,
        post.status === "falhou" && "border-destructive/40 bg-destructive/[0.04]",
      )}
    >
      <span className="block px-1.5 py-1 xl:hidden">
        <span className="flex min-w-0 items-center gap-1">
          <span
            className={cn("size-1.5 shrink-0 rounded-full", STATUS_POST[post.status]?.ponto)}
            aria-hidden
          />
          <span className="text-[11.5px] font-semibold tabular-nums">
            {post.agendado_para ? hora(post.agendado_para) : "--:--"}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[11.5px] leading-snug text-muted-foreground">
          {primeiraLinha(post.legenda) || "Sem legenda"}
        </span>
      </span>
      <span className="hidden items-center gap-2 p-1 pr-1.5 xl:flex">
        <Miniatura capa={post.capa} className="size-8 rounded-[7px]" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <span
              className={cn("size-1.5 shrink-0 rounded-full", STATUS_POST[post.status]?.ponto)}
              aria-hidden
            />
            <span className="text-[11.5px] font-semibold tabular-nums">
              {post.agendado_para ? hora(post.agendado_para) : "--:--"}
            </span>
          </span>
          <span className="mt-0.5 block">
            <RedesDoPost post={post} tamanho="size-3" />
          </span>
        </span>
      </span>
    </Link>
  );
}

function CartaoSemana({ post, podeEditar }: { post: PostResumo; podeEditar: boolean }) {
  const a = propsArrastar(post, podeEditar);
  return (
    <Link
      to="/automacoes/posts/$id"
      params={{ id: post.id }}
      draggable={a.draggable}
      onDragStart={a.onDragStart}
      className={cn(
        "block overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)] transition-[transform,border-color] hover:-translate-y-px hover:border-primary/30",
        a.className,
        post.status === "falhou" && "border-destructive/40",
      )}
    >
      {post.capa && <Miniatura capa={post.capa} className="block aspect-[4/5] w-full" />}
      <div className="p-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold tabular-nums">
            {post.agendado_para ? hora(post.agendado_para) : "--:--"}
          </span>
          <span
            className={cn("size-1.5 rounded-full", STATUS_POST[post.status]?.ponto)}
            aria-hidden
          />
        </div>
        <p className="mt-1 line-clamp-2 break-words text-xs leading-snug text-muted-foreground">
          {primeiraLinha(post.legenda) || "Sem legenda"}
        </p>
        <div className="mt-2">
          <RedesDoPost post={post} />
        </div>
      </div>
    </Link>
  );
}

function FaixaSemana({ resumo }: { resumo: ResumoSemana }) {
  const proximo = resumo.proximo_em ? new Date(resumo.proximo_em) : null;
  const itens = [
    {
      rotulo: "Agendados na semana",
      valor: resumo.agendados,
      icone: CalendarClock,
      tom: "text-primary",
      situacao: "agendados",
    },
    {
      rotulo: "Publicados na semana",
      valor: resumo.publicados,
      icone: CheckCircle2,
      tom: "text-success",
      situacao: "publicados",
    },
    {
      rotulo: "Precisam de atenção",
      valor: resumo.falhas,
      icone: AlertTriangle,
      tom: resumo.falhas ? "text-destructive" : "text-muted-foreground",
      situacao: "falhas",
    },
    {
      rotulo: "Próximo post",
      valor: proximo
        ? proximo.toLocaleString("pt-BR", {
            weekday: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Nenhum",
      icone: Clock3,
      tom: "text-foreground",
      situacao: "agendados",
    },
  ] as const;
  return (
    <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-4">
      {itens.map((t) => (
        <Link
          key={t.rotulo}
          to="/automacoes/posts"
          search={{ situacao: t.situacao }}
          className="flex w-[168px] shrink-0 snap-start flex-col rounded-xl border bg-card px-3 py-2 transition-colors hover:border-primary/30 md:w-auto md:flex-row md:items-center md:gap-2.5 md:px-4 md:py-2.5"
        >
          <span className="flex items-center gap-1.5 md:contents">
            <t.icone className={cn("size-4 shrink-0", t.tom)} />
            <span className="text-[15px] font-semibold tabular-nums text-foreground md:order-last md:ml-auto md:text-sm">
              {t.valor}
            </span>
          </span>
          <span className="mt-0.5 truncate text-xs text-muted-foreground md:mt-0 md:text-[12.5px]">
            {t.rotulo}
          </span>
        </Link>
      ))}
    </div>
  );
}

function PrimeirosPassos({ contas, podeEditar }: { contas: number; podeEditar: boolean }) {
  const conectado = contas > 0;
  const passos = [
    {
      feito: conectado,
      titulo: "Conecte uma rede",
      texto: conectado
        ? `${contas} ${contas === 1 ? "conta conectada" : "contas conectadas"}.`
        : "Instagram, Facebook, LinkedIn, TikTok, YouTube e Google Meu Negócio. A publicação sai direto pela conta conectada.",
      to: "/automacoes/redes" as const,
      acao: conectado ? "Ver redes" : "Conectar rede",
      primario: !conectado,
    },
    {
      feito: false,
      titulo: "Crie o primeiro post",
      texto:
        "Escreva a legenda, escolha a mídia e o dia e horário. O post aparece aqui no calendário.",
      to: "/automacoes/novo" as const,
      acao: "Criar post",
      primario: conectado,
    },
  ];
  return (
    <section aria-labelledby="primeiros-passos" className="rounded-[14px] border bg-card">
      <div className="px-4 pb-2 pt-4 sm:px-5">
        <h2 id="primeiros-passos" className="text-[15px] font-semibold text-foreground">
          O calendário ainda está vazio
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Dois passos para o primeiro post sair no horário.
        </p>
      </div>
      <ol className="divide-y border-t">
        {passos.map((s, i) => (
          <li
            key={s.titulo}
            className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums",
                  s.feito ? "bg-success/10 text-success" : "bg-secondary text-foreground",
                )}
                aria-hidden
              >
                {s.feito ? <Check className="size-3.5" /> : i + 1}
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    s.feito ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {s.titulo}
                </p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{s.texto}</p>
              </div>
            </div>
            {podeEditar && (
              <Button
                asChild
                variant={s.primario ? "default" : "outline"}
                className="min-h-11 w-full sm:min-h-9 sm:w-auto"
              >
                <Link to={s.to}>{s.acao}</Link>
              </Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Lista vertical dia a dia: dias vazios seguidos viram uma linha só; o passado recolhe. */
function Agenda({
  dias,
  porDia: mapa,
  hoje,
  podeEditar,
  recolherPassado,
}: {
  dias: Date[];
  porDia: Map<string, PostResumo[]>;
  hoje: Date;
  podeEditar: boolean;
  recolherPassado: boolean;
}) {
  const [verPassado, setVerPassado] = useState(false);
  const primeiroFuturo = dias.findIndex((d) => d >= hoje);
  const corte = recolherPassado && !verPassado && primeiroFuturo > 0 ? primeiroFuturo : 0;
  const escondidos = dias
    .slice(0, corte)
    .reduce((n, d) => n + (mapa.get(chaveDoDia(d))?.length ?? 0), 0);

  type Bloco =
    { tipo: "dia"; dia: Date; itens: PostResumo[] } | { tipo: "vazio"; de: Date; ate: Date };
  const blocos: Bloco[] = [];
  for (const dia of dias.slice(corte)) {
    const itens = mapa.get(chaveDoDia(dia)) ?? [];
    if (itens.length || mesmoDia(dia, hoje) || datasDoDia(dia).length) {
      blocos.push({ tipo: "dia", dia, itens });
      continue;
    }
    const ult = blocos[blocos.length - 1];
    if (ult?.tipo === "vazio") ult.ate = dia;
    else blocos.push({ tipo: "vazio", de: dia, ate: dia });
  }

  return (
    <div className="divide-y overflow-hidden rounded-[14px] border bg-card md:rounded-none md:border-0">
      {corte > 0 && (
        <button
          type="button"
          onClick={() => setVerPassado(true)}
          className="flex h-11 w-full items-center gap-2 px-4 text-left text-[13px] text-muted-foreground hover:bg-secondary/50"
        >
          <ChevronDown className="size-4 shrink-0" />
          {corte === 1 ? "Mostrar o dia anterior" : `Mostrar ${corte} dias anteriores`}
          {escondidos > 0 && (
            <span className="text-muted-foreground/70"> · {plural(escondidos)}</span>
          )}
        </button>
      )}
      {blocos.map((b) =>
        b.tipo === "vazio" ? (
          <p
            key={`v-${chaveDoDia(b.de)}`}
            className="flex h-10 items-center gap-2 px-4 text-[12.5px] text-muted-foreground/80"
          >
            <span className="tabular-nums">
              {mesmoDia(b.de, b.ate)
                ? b.de.toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })
                : `${b.de.getDate()} a ${b.ate.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`}
            </span>
            <span className="ml-auto">Sem posts</span>
          </p>
        ) : (
          <SecaoDia
            key={chaveDoDia(b.dia)}
            dia={b.dia}
            itens={b.itens}
            hoje={hoje}
            podeEditar={podeEditar}
          />
        ),
      )}
    </div>
  );
}

function SecaoDia({
  dia,
  itens,
  hoje,
  podeEditar,
  vazio = "Sem posts",
}: {
  dia: Date;
  itens: PostResumo[];
  hoje: Date;
  podeEditar: boolean;
  vazio?: string;
}) {
  const passado = dia < hoje;
  const rotulo = dia.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const destaque = mesmoDia(dia, hoje)
    ? "Hoje"
    : mesmoDia(dia, somarDias(hoje, 1))
      ? "Amanhã"
      : null;
  return (
    <section aria-label={dia.toLocaleDateString("pt-BR", { dateStyle: "full" })}>
      <h3 className="flex h-11 items-center gap-2 border-b bg-secondary/60 pl-4 pr-1.5 text-[12.5px]">
        <span
          className={cn(
            "shrink-0 tabular-nums",
            passado ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {destaque && <span className="font-semibold">{destaque} · </span>}
          <span className={destaque ? "" : "font-semibold"}>{rotulo}</span>
        </span>
        <EtiquetaData dia={dia} />
        {itens.length > 0 && (
          <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
            {plural(itens.length)}
          </span>
        )}
        {!passado && podeEditar && (
          <Button
            asChild
            variant="ghost"
            size="icon"
            className={cn("size-11 shrink-0 text-muted-foreground", !itens.length && "ml-auto")}
          >
            <Link
              to="/automacoes/novo"
              search={{ data: chaveDoDia(dia) }}
              aria-label={`Criar post em ${rotulo}`}
            >
              <Plus className="size-4" />
            </Link>
          </Button>
        )}
      </h3>
      {itens.length ? (
        <ul className="divide-y">
          {itens.map((p) => (
            <li key={p.id}>
              <Link
                to="/automacoes/posts/$id"
                params={{ id: p.id }}
                className={cn(
                  "flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40",
                  p.status === "falhou" && "bg-destructive/[0.04]",
                )}
              >
                <span className="w-11 shrink-0 text-[13px] font-semibold tabular-nums">
                  {p.agendado_para ? hora(p.agendado_para) : "--:--"}
                </span>
                <Miniatura capa={p.capa} className="size-10 rounded-[8px] ring-1 ring-border" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm leading-snug">
                    {primeiraLinha(p.legenda) || "Sem legenda"}
                  </span>
                  <span className="mt-1.5 flex min-w-0 items-center gap-2">
                    <RedesDoPost post={p} />
                    <span className="ml-auto">
                      <SeloStatus status={p.status} />
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex h-11 items-center px-4 text-[13px] text-muted-foreground/80">
          {mesmoDia(dia, hoje) ? "Nada agendado para hoje" : vazio}
        </p>
      )}
    </section>
  );
}

const LETRAS = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Mês compacto do celular: pontos por dia (cor = situação) e os posts do dia tocado. */
function MiniMes({
  base,
  grade,
  dias,
  hoje,
  podeEditar,
}: {
  base: Date;
  grade: Date[];
  dias: Map<string, PostResumo[]>;
  hoje: Date;
  podeEditar: boolean;
}) {
  const [sel, setSel] = useState(() => {
    if (mesmoMes(hoje, base)) return chaveDoDia(hoje);
    const com = grade.find((d) => mesmoMes(d, base) && dias.get(chaveDoDia(d))?.length);
    return chaveDoDia(com ?? grade.find((d) => mesmoMes(d, base)) ?? grade[0]!);
  });
  const diaSel = grade.find((d) => chaveDoDia(d) === sel) ?? grade[0]!;
  return (
    <div className="overflow-hidden rounded-[14px] border bg-card">
      <div className="px-2 pt-2">
        <div
          className="grid grid-cols-7 pb-1 text-center text-[11px] font-medium text-muted-foreground"
          aria-hidden
        >
          {LETRAS.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grade.map((d) => {
            const k = chaveDoDia(d);
            const itens = dias.get(k) ?? [];
            const marcado = k === sel;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={marcado}
                aria-label={`${d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}${itens.length ? `, ${plural(itens.length)}` : ""}`}
                onClick={() => setSel(k)}
                className="flex h-12 flex-col items-center justify-center gap-1 rounded-[10px]"
              >
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-[13px] tabular-nums",
                    marcado
                      ? "bg-foreground font-semibold text-background"
                      : mesmoDia(d, hoje)
                        ? "bg-primary font-semibold text-primary-foreground"
                        : mesmoMes(d, base)
                          ? d < hoje
                            ? "text-muted-foreground"
                            : "text-foreground"
                          : "text-muted-foreground/50",
                  )}
                >
                  {d.getDate()}
                </span>
                <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
                  {itens.slice(0, 3).map((p) => (
                    <span
                      key={p.id}
                      className={cn("size-1.5 rounded-full", STATUS_POST[p.status]?.ponto)}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-2 border-t">
        <SecaoDia
          dia={diaSel}
          itens={dias.get(sel) ?? []}
          hoje={hoje}
          podeEditar={podeEditar}
          vazio="Nenhum post neste dia"
        />
      </div>
    </div>
  );
}
