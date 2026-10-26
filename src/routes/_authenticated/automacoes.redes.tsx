import { useEffect, useState } from "react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plug,
  Trash2,
  Waypoints,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EstadoErro, EstadoVazio, ListaCarregando, Secao, Selo } from "@/components/plataforma/kit";
import {
  MarcaRede,
  copiarTexto,
  rotuloRede,
  useRecarregarAutomacoes,
} from "@/components/automacoes/comum";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { CONECTORES, type Conector } from "@/lib/social/catalogo";
import {
  confirmarContasAgz,
  contasPendentesAgz,
  linkConectarRedeAgz,
  listarRedesAgz,
  removerRedeAgz,
  type RedeConectada,
} from "@/lib/social/automacoes.functions";

type Busca = { conectadas?: string; erro?: string; escolher?: string };

export const Route = createFileRoute("/_authenticated/automacoes/redes")({
  head: () => ({ meta: [{ title: "Redes — Automações — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>): Busca => ({
    conectadas: typeof s.conectadas === "string" ? s.conectadas.slice(0, 4) : undefined,
    erro: typeof s.erro === "string" ? s.erro.slice(0, 20) : undefined,
    escolher:
      typeof s.escolher === "string" && /^[0-9a-f-]{36}$/i.test(s.escolher)
        ? s.escolher
        : undefined,
  }),
  component: PaginaRedes,
});

const pai = getRouteApi("/_authenticated/automacoes");

const ERROS_LOGIN: Record<string, string> = {
  sessao: "O login da rede expirou. Tente de novo.",
  recusado: "A permissão foi negada na rede. Para conectar, aceite todas as permissões pedidas.",
  indisponivel:
    "As chaves do app desta rede ainda não foram cadastradas em Configurações gerais › Chaves dos provedores (ou o servidor das Automações está desligado).",
  sem_contas:
    "O login não trouxe nenhuma conta que possa publicar (no Instagram, use conta profissional ligada a uma Página).",
  falhou: "Não foi possível concluir a conexão com a rede. Tente de novo em instantes.",
};

/** Para cada rede, o que libera as métricas da conta (escopo pedido no login). */
const ESCOPO_METRICAS: Partial<Record<string, string[]>> = {
  instagram: ["instagram_manage_insights"],
  facebook: ["read_insights"],
  youtube: ["https://www.googleapis.com/auth/yt-analytics.readonly"],
  tiktok: ["user.info.stats"],
};

const RETORNO: Record<Exclude<Conector, "teste">, string> = {
  meta: "meta",
  linkedin: "linkedin",
  tiktok: "tiktok",
  youtube: "youtube",
  google_business: "google_business",
};

function situacaoConexao(r: RedeConectada): {
  tom: "sucesso" | "alerta" | "perigo";
  texto: string;
} {
  if (r.status !== "ativa")
    return {
      tom: "perigo",
      texto:
        r.status === "expirada"
          ? "Reconecte"
          : r.status === "revogada"
            ? "Desconectada"
            : "Com erro",
    };
  if (r.token_expira_em && !r.renovavel) {
    const dias = Math.floor((Date.parse(r.token_expira_em) - Date.now()) / 86_400_000);
    if (dias < 0) return { tom: "perigo", texto: "Conexão vencida" };
    if (dias <= 7) return { tom: "alerta", texto: `Vence em ${dias} dia(s)` };
  }
  return { tom: "sucesso", texto: "Conectada" };
}

function PaginaRedes() {
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const estado = pai.useLoaderData();
  const podeEditar = usePermissao("marketing.automacoes", "edit");
  const recarregar = useRecarregarAutomacoes();
  const listarFn = useServerFn(listarRedesAgz);
  const removerFn = useServerFn(removerRedeAgz);
  const linkFn = useServerFn(linkConectarRedeAgz);
  const q = useQuery({ queryKey: ["automacoes", "redes"], queryFn: () => listarFn() });
  const [conectando, setConectando] = useState<Conector | null>(null);

  // Volta do login da rede: avisa o resultado uma vez e limpa o endereço.
  useEffect(() => {
    if (!busca.conectadas && !busca.erro) return;
    if (busca.erro) toast.error(ERROS_LOGIN[busca.erro] ?? ERROS_LOGIN.falhou);
    else toast.success(`${busca.conectadas} conta(s) conectada(s).`);
    recarregar();
    void navigate({ search: (s) => ({ escolher: s.escolher }), replace: true });
  }, [busca.conectadas, busca.erro, navigate, recarregar]);

  const remover = useMutation({
    mutationFn: (id: string) => removerFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Rede desconectada.");
      recarregar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível desconectar.")),
  });

  async function conectar(c: Conector) {
    setConectando(c);
    try {
      const r = await linkFn({ data: { conector: c } });
      window.location.href = r.url;
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível iniciar a conexão."));
      setConectando(null);
    }
  }

  const disponiveis = CONECTORES.filter((c) => estado.conectores.includes(c.id));
  const redes = q.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium tracking-tight sm:text-xl">Redes conectadas</h2>
        <p className="text-sm text-muted-foreground">
          As redes da AgillizaTech. A conexão é feita no site oficial de cada rede: o Agilliza não
          pede nem guarda senha.
        </p>
      </div>

      <Secao titulo="Contas conectadas" semRespiro>
        {q.isError ? (
          <EstadoErro
            mensagem={mensagemDeErro(q.error, "Não foi possível carregar as redes.")}
            onTentar={() => q.refetch()}
          />
        ) : q.isLoading ? (
          <ListaCarregando linhas={3} />
        ) : redes.length === 0 ? (
          <EstadoVazio
            icone={<Waypoints />}
            titulo="Nenhuma rede conectada"
            descricao="Conecte as redes abaixo para agendar e publicar."
          />
        ) : (
          <ul className="divide-y">
            {redes.map((r) => {
              const s = situacaoConexao(r);
              const falta = (ESCOPO_METRICAS[r.rede] ?? []).filter(
                (e) => !(r.escopos ?? []).includes(e),
              );
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="relative">
                    {r.avatar_url ? (
                      <img
                        src={r.avatar_url}
                        alt=""
                        className="size-10 rounded-full object-cover ring-1 ring-border"
                      />
                    ) : (
                      <span className="grid size-10 place-items-center rounded-full bg-secondary text-sm font-medium">
                        {r.nome.slice(0, 1)}
                      </span>
                    )}
                    <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-card ring-1 ring-border">
                      <MarcaRede rede={r.rede} className="size-3.5" />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.nome}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {rotuloRede(r.rede)}
                      {r.tipo === "organization"
                        ? " · página de empresa"
                        : r.tipo === "person"
                          ? " · perfil pessoal"
                          : ""}
                      {r.usuario ? ` · ${r.usuario}` : ""}
                    </span>
                    {r.ultimo_erro && r.status !== "ativa" && (
                      <span className="mt-1 block text-xs text-destructive">{r.ultimo_erro}</span>
                    )}
                    {r.status === "ativa" &&
                      (falta.length > 0 || r.metricas_situacao === "sem_permissao") && (
                        <span className="mt-1 block text-xs text-warning-foreground">
                          Reconecte para liberar as métricas da conta (seguidores e alcance).
                        </span>
                      )}
                  </span>
                  <Selo tom={s.tom} ponto={s.tom === "sucesso"}>
                    {s.texto}
                  </Selo>
                  {podeEditar && (
                    <span className="flex gap-1">
                      {(r.status !== "ativa" || s.tom !== "sucesso" || falta.length > 0) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-11 sm:min-h-8"
                          disabled={conectando !== null}
                          onClick={() => {
                            const c = CONECTORES.find((x) => x.redes.includes(r.rede));
                            if (c) void conectar(c.id);
                          }}
                        >
                          Reconectar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-11 text-muted-foreground hover:text-destructive sm:size-8"
                        aria-label={`Desconectar ${r.nome}`}
                        disabled={remover.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Desconectar ${r.nome} (${rotuloRede(r.rede)})? Os posts agendados para ela serão cancelados.`,
                            )
                          )
                            remover.mutate(r.id);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Secao>

      {podeEditar && (
        <Secao
          titulo="Conectar uma rede"
          descricao="Você entra na rede pelo site oficial e escolhe quais contas conectar."
        >
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {disponiveis.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={conectando !== null}
                  onClick={() => void conectar(c.id)}
                  className="flex min-h-16 w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.02] disabled:opacity-60"
                >
                  <span className="flex shrink-0 -space-x-1.5">
                    {c.redes.map((r) => (
                      <span
                        key={r}
                        className="grid size-9 place-items-center rounded-lg border bg-card"
                      >
                        <MarcaRede rede={r} className="size-5" />
                      </span>
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{c.rotulo}</span>
                    <span className="block text-xs text-muted-foreground">{c.descricao}</span>
                  </span>
                  {conectando === c.id ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Plug className="size-4 text-muted-foreground" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      <ParaConectar corretorUrl={estado.corretorUrl} />

      {busca.escolher && (
        <EscolherContas
          lote={busca.escolher}
          aoFechar={() => {
            recarregar();
            void navigate({ search: {}, replace: true });
          }}
        />
      )}
    </div>
  );
}

/** O que precisa estar pronto para a conexão funcionar (chaves e endereços de retorno). */
function ParaConectar({ corretorUrl }: { corretorUrl: string }) {
  const itens = (Object.keys(RETORNO) as (keyof typeof RETORNO)[]).map((c) => ({
    c,
    rotulo: CONECTORES.find((x) => x.id === c)?.rotulo ?? c,
    url: `${corretorUrl}/api/social/retorno/${RETORNO[c]}`,
  }));
  return (
    <Secao
      titulo="Para conectar"
      icone={<KeyRound />}
      descricao="As chaves de cada app ficam em Configurações gerais › Chaves dos provedores (Meta, LinkedIn, TikTok e Google)."
    >
      <p className="text-sm text-muted-foreground">
        No painel de desenvolvedor de cada rede, cadastre este endereço de retorno (redirect URI)
        exatamente como está:
      </p>
      <ul className="mt-3 divide-y rounded-xl border">
        {itens.map((i) => (
          <li key={i.c} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
            <span className="w-40 shrink-0 text-sm font-medium">{i.rotulo}</span>
            <code className="min-w-0 flex-1 truncate rounded bg-secondary/70 px-2 py-1 text-xs">
              {i.url}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 sm:size-8"
              aria-label={`Copiar endereço de retorno de ${i.rotulo}`}
              onClick={() =>
                copiarTexto(i.url, (ok) =>
                  ok ? toast.success("Endereço copiado.") : toast.error("Não foi possível copiar."),
                )
              }
            >
              <Copy className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      <a
        href="/plataforma/provedores"
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        Abrir Chaves dos provedores <ArrowUpRight className="size-3.5" />
      </a>
    </Secao>
  );
}

/** Escolha das contas depois do login (a Meta exige): marca quais conectar. */
function EscolherContas({ lote, aoFechar }: { lote: string; aoFechar: () => void }) {
  const pendentesFn = useServerFn(contasPendentesAgz);
  const confirmarFn = useServerFn(confirmarContasAgz);
  const q = useQuery({
    queryKey: ["automacoes", "pendentes", lote],
    queryFn: () => pendentesFn({ data: { lote } }),
  });
  const [marcadas, setMarcadas] = useState<string[] | null>(null);
  const lista = q.data ?? [];
  const sel = marcadas ?? lista.map((c) => c.id);
  const confirmar = useMutation({
    mutationFn: () => confirmarFn({ data: { lote, ids: sel } }),
    onSuccess: (r) => {
      toast.success(r.n ? `${r.n} conta(s) conectada(s).` : "Nenhuma conta conectada.");
      aoFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível conectar as contas.")),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-24px)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Escolha as contas</DialogTitle>
          <DialogDescription>
            O login da rede liberou estas contas. Marque as que a AgillizaTech vai usar para
            publicar.
          </DialogDescription>
        </DialogHeader>
        {q.isLoading ? (
          <ListaCarregando linhas={3} className="p-0" />
        ) : q.isError ? (
          <p className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />{" "}
            {mensagemDeErro(q.error, "Não foi possível carregar as contas.")}
          </p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            A escolha venceu (30 minutos). Conecte a rede de novo.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {lista.map((c) => {
              const on = sel.includes(c.id);
              return (
                <li key={c.id}>
                  <label
                    htmlFor={`pend-${c.id}`}
                    className="flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2"
                  >
                    <Checkbox
                      id={`pend-${c.id}`}
                      checked={on}
                      onCheckedChange={(v) =>
                        setMarcadas((m) => {
                          const base = m ?? lista.map((x) => x.id);
                          return v ? [...new Set([...base, c.id])] : base.filter((x) => x !== c.id);
                        })
                      }
                    />
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border">
                      <MarcaRede rede={c.rede} className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.nome}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {rotuloRede(c.rede)}
                        {c.detalhe ? ` · ${c.detalhe}` : ""}
                      </span>
                    </span>
                    {c.ja_conectada && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Check className="size-3.5" /> já conectada
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <DialogFooter className="gap-2">
          <Button variant="ghost" className="min-h-11 sm:min-h-9" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button
            className="min-h-11 sm:min-h-9"
            disabled={!lista.length || !sel.length || confirmar.isPending}
            onClick={() => confirmar.mutate()}
          >
            {confirmar.isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Conectar {sel.length ? `${sel.length} conta(s)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
