import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronRight,
  Landmark,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { AdminHero } from "@/components/admin/admin-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  alternarFeatureFlag,
  aprovarTaxasBanco,
  lerConfiguracoesGlobais,
  salvarBancoGlobal,
  salvarParametroGlobal,
  type BancoGlobal,
  type FeatureFlag,
  type ParametroGlobal,
} from "@/lib/plataforma/configuracoes.functions";

export const Route = createFileRoute("/_authenticated/plataforma/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações globais — Plataforma — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.configuracoes"),
  component: Pagina,
});

const CHAVE = ["plataforma-configuracoes"];

const GRUPO: Record<string, string> = {
  simulacao: "Simulação",
  homefin: "Integração bancária",
  cobranca: "Cobrança",
  credito: "Crédito",
  locacao: "Locação",
  marketplace: "Marketplace",
  rede: "Rede",
  retencao: "Retenção de dados",
};

/** As taxas vêm com 3 casas; mostrar em pt-BR evita ler "12.390%" como doze mil. */
const pct = (v: number | null) =>
  v == null
    ? "—"
    : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}%`;

/** "há 3 dias" a partir de um instante ISO. */
function ha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(min)) return "—";
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} dia(s)`;
}

function dataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const temProposta = (b: BancoGlobal) =>
  !!b.taxas_propostas &&
  typeof b.taxas_propostas === "object" &&
  Object.keys(b.taxas_propostas).length > 0;

function Pagina() {
  const lerFn = useServerFn(lerConfiguracoesGlobais);
  const moduloEdita = usePermissao("saas.configuracoes", "edit");
  const q = useQuery({ queryKey: CHAVE, queryFn: () => lerFn() });
  const [banco, setBanco] = useState<BancoGlobal | null>(null);

  const d = q.data;
  const configs = d?.configs ?? [];
  const bancos = d?.bancos ?? [];
  const produtos = d?.produtos ?? [];
  const flags = d?.flags ?? [];
  // Editar exige o módulo em "editar" no Agilliza E a permissão config.editar no banco.
  const podeEditar = moduloEdita && !!d?.podeEditar;
  const comTaxaPendente = bancos.filter(temProposta).length;
  const grupos = [...new Set(configs.map((c) => c.chave.split(".")[0] ?? c.chave))];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        secao="Plataforma"
        icon={<SlidersHorizontal className="h-5 w-5" />}
        titulo="Configurações globais"
        descricao="Os números que valem para todas as contas de assinantes: taxas dos bancos, parâmetros de simulação, retenção e recursos liberados. Cada gravação entra na auditoria da plataforma."
        acoes={
          <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`mr-2 size-4 ${q.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      />

      {q.isError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(q.error, "Não foi possível carregar as configurações globais.")}
        </p>
      )}

      {d && !d.permitido && (
        <p className="rounded-lg border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Seu acesso à plataforma não inclui a leitura das configurações globais. Peça a liberação a
          um administrador.
        </p>
      )}

      {d?.permitido && !podeEditar && (
        <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
          Seu acesso vê as configurações, mas não pode alterá-las.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metrica
          rotulo="Bancos ativos"
          valor={bancos.filter((b) => b.ativo).length}
          detalhe={`${bancos.length} cadastrado(s)`}
          carregando={q.isLoading}
        />
        <Metrica
          rotulo="Taxas propostas"
          valor={comTaxaPendente}
          detalhe="esperando aprovação"
          alerta={comTaxaPendente > 0}
          carregando={q.isLoading}
        />
        <Metrica rotulo="Parâmetros" valor={configs.length} carregando={q.isLoading} />
        <Metrica
          rotulo="Recursos ligados"
          valor={flags.filter((f) => f.ligado).length}
          detalhe={`${flags.length} no total`}
          carregando={q.isLoading}
        />
      </div>

      <Tabs defaultValue="bancos">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="bancos">Bancos e taxas</TabsTrigger>
          <TabsTrigger value="parametros">Parâmetros</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="flags">Recursos</TabsTrigger>
        </TabsList>

        <TabsContent value="bancos" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            As taxas que entram em toda simulação da plataforma. Alterar aqui muda o resultado de
            todas as contas a partir da próxima simulação.
          </p>
          {q.isLoading ? (
            <Skeleton className="h-32" />
          ) : !bancos.length ? (
            <Vazio texto="Nenhum banco cadastrado." />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {bancos.map((b) => (
                <li key={b.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setBanco(b)}
                    aria-label={`Abrir ${b.nome}`}
                    className={`flex h-full w-full flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30 ${
                      b.ativo ? "" : "opacity-70"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <Landmark className="size-5 shrink-0 text-primary" aria-hidden />
                        <span className="min-w-0">
                          <b className="block truncate">{b.nome}</b>
                          <small className="block truncate text-xs tabular-nums text-muted-foreground">
                            {b.codigo_compe != null
                              ? `COMPE ${String(b.codigo_compe).padStart(3, "0")}`
                              : `código ${b.id}`}
                            {b.sistemas?.length ? ` · ${b.sistemas.join(" e ")}` : ""}
                          </small>
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {b.ativo ? <Badge>ativo</Badge> : <Badge variant="secondary">inativo</Badge>}
                      {temProposta(b) && (
                        <Badge variant="outline" className="border-amber-500 text-amber-700">
                          taxa proposta
                        </Badge>
                      )}
                      {b.espera_cotacao && <Badge variant="outline">cotação online</Badge>}
                    </span>
                    <span className="grid grid-cols-2 gap-2 text-sm">
                      <span>
                        <b className="block tabular-nums">{pct(b.taxa_sac)}</b>
                        <small className="text-xs text-muted-foreground">SAC ao ano</small>
                      </span>
                      <span>
                        <b className="block tabular-nums">{pct(b.taxa_price)}</b>
                        <small className="text-xs text-muted-foreground">Price ao ano</small>
                      </span>
                    </span>
                    <small className="text-xs text-muted-foreground">
                      atualizado {ha(b.atualizado_em)}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="parametros" className="mt-4">
          {q.isLoading ? (
            <Skeleton className="h-40" />
          ) : !configs.length ? (
            <Vazio texto="Nenhum parâmetro cadastrado." />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {grupos.map((g) => (
                <section key={g} className="min-w-0 rounded-lg border border-border bg-card">
                  <h2 className="border-b border-border p-4 font-semibold">{GRUPO[g] ?? g}</h2>
                  <ul className="divide-y divide-border">
                    {configs
                      .filter((c) => c.chave === g || c.chave.startsWith(`${g}.`))
                      .map((c) => (
                        <LinhaParametro
                          key={`${c.chave}-${c.atualizado_em}`}
                          c={c}
                          podeEditar={podeEditar}
                        />
                      ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="produtos" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            O que aparece no seletor de produto da simulação.
          </p>
          {q.isLoading ? (
            <Skeleton className="h-24" />
          ) : !produtos.length ? (
            <Vazio texto="Nenhum produto de crédito cadastrado." />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {produtos.map((p) => (
                <li key={p.id} className="flex items-start gap-3 p-4">
                  <Landmark
                    className={`mt-0.5 size-5 shrink-0 ${p.ativo ? "text-primary" : "text-muted-foreground"}`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {p.nome}
                      {p.ativo ? <Badge>ativo</Badge> : <Badge variant="secondary">inativo</Badge>}
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {/* `teto` é a fração máxima do imóvel que dá para financiar (LTV), não um valor em reais. */}
                      {p.teto != null
                        ? `financia até ${Math.round(p.teto * 100)}% do imóvel · `
                        : ""}
                      prazo {p.prazo_minimo ?? "—"} a {p.prazo_maximo ?? "—"} meses
                      {p.idade_mais_prazo_max != null
                        ? ` · idade + prazo ≤ ${p.idade_mais_prazo_max} meses`
                        : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="flags" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Recurso ligado para todas as contas, ou só para uma.
          </p>
          {q.isLoading ? (
            <Skeleton className="h-24" />
          ) : !flags.length ? (
            <Vazio texto="Nenhum recurso com liberação controlada." />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {flags.map((f) => (
                <LinhaFlag key={f.id} f={f} podeEditar={podeEditar} />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={!!banco} onOpenChange={(v) => !v && setBanco(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {banco && (
            <>
              <SheetHeader>
                <SheetTitle>{banco.nome}</SheetTitle>
                <SheetDescription>
                  código {banco.id}
                  {banco.codigo_compe != null ? ` · COMPE ${banco.codigo_compe}` : ""}
                </SheetDescription>
              </SheetHeader>
              <EditorBanco
                key={`${banco.id}-${banco.atualizado_em}`}
                b={banco}
                podeEditar={podeEditar}
                onFeito={() => setBanco(null)}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Metrica({
  rotulo,
  valor,
  detalhe,
  carregando,
  alerta,
}: {
  rotulo: string;
  valor: number;
  detalhe?: string;
  carregando: boolean;
  alerta?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-lg border bg-card p-3 md:p-4 ${alerta ? "border-amber-400/70" : "border-border"}`}
    >
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {alerta && <AlertTriangle className="size-3.5 text-amber-600" aria-hidden />}
        {rotulo}
      </p>
      {carregando ? (
        <Skeleton className="mt-2 h-7 w-12" />
      ) : (
        <p className="mt-1 text-2xl font-bold tabular-nums">{valor.toLocaleString("pt-BR")}</p>
      )}
      {detalhe && <p className="truncate text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {texto}
    </p>
  );
}

function LinhaParametro({ c, podeEditar }: { c: ParametroGlobal; podeEditar: boolean }) {
  const qc = useQueryClient();
  const salvarFn = useServerFn(salvarParametroGlobal);
  const original = JSON.stringify(c.valor);
  const [texto, setTexto] = useState(original);
  const id = `param-${c.chave.replace(/\W/g, "-")}`;

  const salvar = useMutation({
    mutationFn: () => salvarFn({ data: { chave: c.chave, valorJson: texto } }),
    onSuccess: (r) => {
      toast.success(`${r.chave} atualizado.`);
      qc.invalidateQueries({ queryKey: CHAVE });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar o parâmetro.")),
  });

  return (
    <li className="space-y-2 p-4">
      <div className="min-w-0">
        <Label htmlFor={id} className="break-all font-mono text-xs font-semibold">
          {c.chave}
        </Label>
        {c.descricao && <p className="text-xs text-muted-foreground">{c.descricao}</p>}
      </div>
      {podeEditar ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate();
          }}
        >
          <Input
            id={id}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="min-w-0 flex-1 font-mono text-xs tabular-nums"
            aria-label={`Valor de ${c.chave}`}
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={salvar.isPending || texto === original}
          >
            {salvar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Salvar
          </Button>
        </form>
      ) : (
        <p
          id={id}
          className="break-all rounded bg-muted/50 px-2 py-1 font-mono text-xs tabular-nums"
        >
          {original}
        </p>
      )}
    </li>
  );
}

function LinhaFlag({ f, podeEditar }: { f: FeatureFlag; podeEditar: boolean }) {
  const qc = useQueryClient();
  const alternarFn = useServerFn(alternarFeatureFlag);
  const alternar = useMutation({
    mutationFn: (ligado: boolean) => alternarFn({ data: { id: f.id, ligado } }),
    onSuccess: (r, ligado) => {
      toast.success(`${r.chave} ${ligado ? "ligada" : "desligada"}.`);
      qc.invalidateQueries({ queryKey: CHAVE });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível alterar o recurso.")),
  });

  return (
    <li className="flex items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span className="break-all font-mono text-sm font-semibold">{f.chave}</span>
          {f.conta ? (
            <Badge variant="outline">só em {f.conta}</Badge>
          ) : (
            <Badge variant="secondary">todas as contas</Badge>
          )}
        </p>
        {f.descricao && <p className="text-xs text-muted-foreground">{f.descricao}</p>}
      </div>
      {podeEditar ? (
        <div className="flex shrink-0 items-center gap-2">
          {alternar.isPending && <Loader2 className="size-4 animate-spin" />}
          <Switch
            checked={f.ligado}
            onCheckedChange={(v) => alternar.mutate(v)}
            disabled={alternar.isPending}
            aria-label={`${f.ligado ? "Desligar" : "Ligar"} ${f.chave}`}
          />
        </div>
      ) : f.ligado ? (
        <Badge>ligada</Badge>
      ) : (
        <Badge variant="secondary">desligada</Badge>
      )}
    </li>
  );
}

type CampoBanco =
  | "taxa_sac"
  | "taxa_price"
  | "taxa_he_sac"
  | "taxa_he_price"
  | "comprometimento_max"
  | "dfi_mensal"
  | "tarifa_mensal"
  | "teto_comercial_ltv"
  | "teto_comercial_prazo";

const texto = (v: number | null) => (v == null ? "" : String(v));
/** Aceita vírgula ou ponto decimal. Vazio vira NaN para o servidor recusar com a mensagem certa. */
const paraNumero = (s: string) => (s.trim() === "" ? Number.NaN : Number(s.replace(",", ".")));

function EditorBanco({
  b,
  podeEditar,
  onFeito,
}: {
  b: BancoGlobal;
  podeEditar: boolean;
  onFeito: () => void;
}) {
  const qc = useQueryClient();
  const salvarFn = useServerFn(salvarBancoGlobal);
  const aprovarFn = useServerFn(aprovarTaxasBanco);
  const [f, setF] = useState<Record<CampoBanco, string>>({
    taxa_sac: texto(b.taxa_sac),
    taxa_price: texto(b.taxa_price),
    taxa_he_sac: texto(b.taxa_he_sac),
    taxa_he_price: texto(b.taxa_he_price),
    comprometimento_max: texto(b.comprometimento_max),
    dfi_mensal: texto(b.dfi_mensal),
    tarifa_mensal: texto(b.tarifa_mensal),
    teto_comercial_ltv: texto(b.teto_comercial_ltv),
    teto_comercial_prazo: texto(b.teto_comercial_prazo),
  });
  const [ativo, setAtivo] = useState(b.ativo);
  const [financia, setFinancia] = useState(b.financia_despesas);
  const recarregar = () => qc.invalidateQueries({ queryKey: CHAVE });
  const erro = (e: unknown) => toast.error(mensagemDeErro(e, "Não foi possível salvar o banco."));

  const salvar = useMutation({
    mutationFn: () =>
      salvarFn({
        data: {
          id: b.id,
          ativo,
          financia_despesas: financia,
          taxa_sac: paraNumero(f.taxa_sac),
          taxa_price: paraNumero(f.taxa_price),
          taxa_he_sac: paraNumero(f.taxa_he_sac),
          taxa_he_price: paraNumero(f.taxa_he_price),
          comprometimento_max: paraNumero(f.comprometimento_max),
          dfi_mensal: paraNumero(f.dfi_mensal),
          tarifa_mensal: paraNumero(f.tarifa_mensal),
          teto_comercial_ltv: paraNumero(f.teto_comercial_ltv),
          teto_comercial_prazo: paraNumero(f.teto_comercial_prazo),
        },
      }),
    onSuccess: () => {
      toast.success("Banco atualizado. A próxima simulação já usa as novas taxas.");
      recarregar();
      onFeito();
    },
    onError: erro,
  });
  const aprovar = useMutation({
    mutationFn: () => aprovarFn({ data: { id: b.id } }),
    onSuccess: () => {
      toast.success("Taxas aprovadas e em vigor.");
      recarregar();
      onFeito();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível aprovar as taxas.")),
  });

  const campo = (k: CampoBanco, rotulo: string, ajuda?: string) => (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={`banco-${k}`}>{rotulo}</Label>
      <Input
        id={`banco-${k}`}
        inputMode="decimal"
        value={f[k]}
        onChange={(e) => setF((v) => ({ ...v, [k]: e.target.value }))}
        disabled={!podeEditar}
        className="tabular-nums"
      />
      {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  );

  const mip = Array.isArray(b.mip)
    ? (b.mip as { idadeAte?: unknown; taxaMensal?: unknown }[])
    : null;

  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (podeEditar) salvar.mutate();
      }}
    >
      {temProposta(b) && (
        <section className="space-y-2 rounded-lg border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4" /> Há taxas propostas esperando aprovação
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs">
            {JSON.stringify(b.taxas_propostas, null, 2)}
          </pre>
          {b.taxas_propostas_em && (
            <p className="text-xs">Recebidas em {dataHora(b.taxas_propostas_em)}.</p>
          )}
          {podeEditar && (
            <Button
              type="button"
              size="sm"
              disabled={aprovar.isPending}
              onClick={() => aprovar.mutate()}
            >
              {aprovar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Aprovar e aplicar
            </Button>
          )}
        </section>
      )}

      <Bloco titulo="Taxas anuais" descricao="Em porcentagem ao ano, como o banco divulga.">
        <div className="grid grid-cols-2 gap-3">
          {campo("taxa_sac", "SAC (%)")}
          {campo("taxa_price", "Price (%)")}
          {campo("taxa_he_sac", "Home equity — SAC (%)")}
          {campo("taxa_he_price", "Home equity — Price (%)")}
        </div>
      </Bloco>

      <Bloco titulo="Seguros, tarifas e limites" descricao="Em fração: 0,30 = 30%.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {campo("dfi_mensal", "DFI ao mês (fração)", "Ex.: 0,000071")}
          {campo("tarifa_mensal", "Tarifa mensal (R$)")}
          {campo("comprometimento_max", "Comprometimento máximo (fração)", "Ex.: 0,30 = 30%")}
          {campo("teto_comercial_ltv", "LTV máximo — comercial (fração)", "Ex.: 0,60 = 60%")}
          {campo("teto_comercial_prazo", "Prazo máximo — comercial (meses)")}
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="banco-financia">Financia as despesas (ITBI, registro)</Label>
            <Switch
              id="banco-financia"
              checked={financia}
              onCheckedChange={setFinancia}
              disabled={!podeEditar}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="banco-ativo">Banco ativo na simulação</Label>
            <Switch
              id="banco-ativo"
              checked={ativo}
              onCheckedChange={setAtivo}
              disabled={!podeEditar}
            />
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="MIP por idade"
        descricao="Seguro de morte e invalidez, taxa mensal por faixa de idade. Só leitura nesta tela."
      >
        {mip && mip.length ? (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs tabular-nums sm:grid-cols-3">
            {mip.map((m, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="text-muted-foreground">até {String(m.idadeAte ?? "—")} anos</span>
                <span>{String(m.taxaMensal ?? "—")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="break-all font-mono text-xs">{JSON.stringify(b.mip)}</p>
        )}
      </Bloco>

      {b.sistemas && b.sistemas.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Sistemas de amortização aceitos: {b.sistemas.join(", ")}.
        </p>
      )}

      {podeEditar && (
        <Button type="submit" disabled={salvar.isPending}>
          {salvar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Salvar banco
        </Button>
      )}
    </form>
  );
}

function Bloco({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border p-3">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      {descricao && <p className="mb-3 text-xs text-muted-foreground">{descricao}</p>}
      {children}
    </section>
  );
}
