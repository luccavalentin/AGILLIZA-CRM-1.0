import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronRight,
  Eye,
  Landmark,
  Layers,
  Loader2,
  Package,
  RefreshCw,
  SlidersHorizontal,
  ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BancoLogo } from "@/components/bancos/banco-logo";
import {
  CabecalhoGestao,
  CampoBusca,
  EstadoErro,
  EstadoVazio,
  FaixaIndicadores,
  Indicador,
  ListaCarregando,
  PaginaGestao,
  Secao,
  Selo,
} from "@/components/plataforma/kit";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { cn } from "@/lib/utils";
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
  head: () => ({
    meta: [{ title: "Configurações do Agilliza Tech — Configurações gerais — Agilliza" }],
  }),
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

/** A chave interna do grupo da integração bancária não aparece na tela (só o rótulo). */
const chaveVisivel = (chave: string) => chave.replace(/^home\s*fin/i, "integracao_bancaria");

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
  const [aba, setAba] = useState("bancos");
  const [busca, setBusca] = useState("");

  const d = q.data;
  const configs = d?.configs ?? [];
  const bancos = d?.bancos ?? [];
  const produtos = d?.produtos ?? [];
  const flags = d?.flags ?? [];
  // Editar exige o módulo em "editar" no Agilliza E a permissão config.editar no banco.
  const podeEditar = moduloEdita && !!d?.podeEditar;
  const comTaxaPendente = bancos.filter(temProposta).length;
  const termo = busca.trim().toLowerCase();
  const configsFiltradas = termo
    ? configs.filter(
        (c) =>
          chaveVisivel(c.chave).toLowerCase().includes(termo) ||
          (c.descricao ?? "").toLowerCase().includes(termo),
      )
    : configs;
  const grupos = [...new Set(configsFiltradas.map((c) => c.chave.split(".")[0] ?? c.chave))];
  // Bancos com taxa proposta primeiro, depois ativos, depois por nome.
  const bancosOrdenados = [...bancos].sort(
    (a, b) =>
      Number(temProposta(b)) - Number(temProposta(a)) ||
      Number(b.ativo) - Number(a.ativo) ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );

  return (
    <PaginaGestao>
      <CabecalhoGestao
        secao="Configurações gerais"
        icone={<SlidersHorizontal />}
        titulo="Configurações do Agilliza Tech"
        descricao="Os números que valem para todas as contas de assinantes: taxas dos bancos, parâmetros de simulação, produtos de crédito e recursos liberados. Cada gravação entra na auditoria da plataforma."
        acoes={
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-8"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
          >
            <RefreshCw className={cn("mr-2 size-4", q.isFetching && "animate-spin")} />
            Atualizar
          </Button>
        }
      />

      {q.isError && (
        <Secao>
          <EstadoErro
            mensagem={mensagemDeErro(q.error, "Não foi possível carregar as configurações globais.")}
            onTentar={() => q.refetch()}
          />
        </Secao>
      )}

      {d && !d.permitido && (
        <div className="flex items-start gap-2.5 rounded-[14px] border border-warning/50 bg-warning/10 p-3 text-sm text-warning-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Seu acesso à plataforma não inclui a leitura das configurações globais. Peça a liberação a
          um administrador.
        </div>
      )}

      {d?.permitido && !podeEditar && (
        <div className="flex items-start gap-2.5 rounded-[14px] border border-primary/15 bg-primary/[0.04] p-3 text-sm">
          <Eye className="mt-0.5 size-4 shrink-0 text-primary" />
          Seu acesso vê as configurações, mas não pode alterá-las.
        </div>
      )}

      <FaixaIndicadores>
        <Indicador
          rotulo="Bancos ativos"
          valor={bancos.filter((b) => b.ativo).length}
          detalhe={`${bancos.length} cadastrado(s)`}
          icone={<Landmark />}
          carregando={q.isLoading}
        />
        <Indicador
          rotulo="Taxas propostas"
          valor={comTaxaPendente}
          detalhe="Esperando aprovação"
          icone={<AlertTriangle />}
          tom={comTaxaPendente > 0 ? "alerta" : "neutro"}
          onClick={comTaxaPendente > 0 ? () => setAba("bancos") : undefined}
          carregando={q.isLoading}
        />
        <Indicador
          rotulo="Parâmetros"
          valor={configs.length}
          detalhe={`${new Set(configs.map((c) => c.chave.split(".")[0])).size} grupo(s)`}
          icone={<Layers />}
          carregando={q.isLoading}
        />
        <Indicador
          rotulo="Recursos ligados"
          valor={flags.filter((f) => f.ligado).length}
          detalhe={`${flags.length} no total`}
          icone={<ToggleRight />}
          tom="sucesso"
          carregando={q.isLoading}
        />
      </FaixaIndicadores>

      <Tabs value={aba} onValueChange={setAba} className="space-y-4">
        <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
          <TabsList className="h-auto w-max">
            <TabsTrigger value="bancos" className="min-h-11 gap-1.5 sm:min-h-8">
              Bancos e taxas
              {comTaxaPendente > 0 && (
                <span className="rounded-full bg-warning/25 px-1.5 text-[11px] tabular-nums text-warning-foreground">
                  {comTaxaPendente}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="parametros" className="min-h-11 sm:min-h-8">
              Parâmetros
            </TabsTrigger>
            <TabsTrigger value="produtos" className="min-h-11 sm:min-h-8">
              Produtos de crédito
            </TabsTrigger>
            <TabsTrigger value="flags" className="min-h-11 sm:min-h-8">
              Recursos
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="bancos" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            As taxas que entram em toda simulação da plataforma. Alterar aqui muda o resultado de
            todas as contas a partir da próxima simulação.
          </p>
          {q.isLoading ? (
            <Secao>
              <ListaCarregando linhas={3} className="p-0" />
            </Secao>
          ) : !bancos.length ? (
            <Secao>
              <EstadoVazio icone={<Landmark />} titulo="Nenhum banco cadastrado" />
            </Secao>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {bancosOrdenados.map((b) => (
                <li key={b.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setBanco(b)}
                    aria-label={`Abrir ${b.nome}`}
                    className={cn(
                      "group flex h-full w-full flex-col gap-3 rounded-[14px] border bg-card p-4 text-left shadow-[0_1px_2px_rgb(16_24_40/0.04)] transition-shadow hover:shadow-[0_6px_16px_-10px_rgb(0_10_112/0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                      temProposta(b) ? "border-warning/50" : "border-border/80",
                      !b.ativo && "opacity-75",
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <BancoLogo nome={b.nome} size="lg" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">{b.nome}</span>
                          <span className="block truncate font-mono text-[11px] tabular-nums text-muted-foreground">
                            {b.codigo_compe != null
                              ? `COMPE ${String(b.codigo_compe).padStart(3, "0")}`
                              : `código ${b.id}`}
                            {b.sistemas?.length ? ` · ${b.sistemas.join(" e ")}` : ""}
                          </span>
                        </span>
                      </span>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {b.ativo ? (
                        <Selo tom="sucesso" ponto>
                          Ativo
                        </Selo>
                      ) : (
                        <Selo tom="neutro">Inativo</Selo>
                      )}
                      {temProposta(b) && <Selo tom="alerta">Taxa proposta</Selo>}
                      {b.espera_cotacao && <Selo tom="info">Cotação online</Selo>}
                    </span>
                    <span className="grid grid-cols-2 gap-2">
                      <span className="rounded-lg bg-secondary/60 px-2.5 py-2">
                        <span className="block font-mono text-sm tabular-nums text-foreground">{pct(b.taxa_sac)}</span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">SAC ao ano</span>
                      </span>
                      <span className="rounded-lg bg-secondary/60 px-2.5 py-2">
                        <span className="block font-mono text-sm tabular-nums text-foreground">{pct(b.taxa_price)}</span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Price ao ano</span>
                      </span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">Atualizado {ha(b.atualizado_em)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="parametros" className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Valores em JSON, como o banco guarda. Cada grupo é uma área do sistema.
            </p>
            <CampoBusca
              valor={busca}
              onChange={setBusca}
              rotulo="Buscar parâmetro"
              placeholder="Buscar parâmetro"
            />
          </div>
          {q.isLoading ? (
            <Secao>
              <ListaCarregando linhas={4} className="p-0" />
            </Secao>
          ) : !configsFiltradas.length ? (
            <Secao>
              <EstadoVazio
                icone={<Layers />}
                titulo={termo ? "Nenhum parâmetro com esta busca" : "Nenhum parâmetro cadastrado"}
              />
            </Secao>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {grupos.map((g) => {
                const itens = configsFiltradas.filter((c) => c.chave === g || c.chave.startsWith(`${g}.`));
                return (
                  <Secao
                    key={g}
                    titulo={GRUPO[g] ?? g}
                    descricao={`${itens.length} parâmetro(s)`}
                    icone={<SlidersHorizontal />}
                    semRespiro
                  >
                    <ul className="divide-y divide-border/60">
                      {itens.map((c) => (
                        <LinhaParametro
                          key={`${c.chave}-${c.atualizado_em}`}
                          c={c}
                          podeEditar={podeEditar}
                        />
                      ))}
                    </ul>
                  </Secao>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="produtos" className="space-y-3">
          <p className="text-sm text-muted-foreground">O que aparece no seletor de produto da simulação.</p>
          {q.isLoading ? (
            <Secao>
              <ListaCarregando linhas={3} className="p-0" />
            </Secao>
          ) : !produtos.length ? (
            <Secao>
              <EstadoVazio icone={<Package />} titulo="Nenhum produto de crédito cadastrado" />
            </Secao>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {produtos.map((p) => (
                <li
                  key={p.id}
                  className={cn(
                    "min-w-0 rounded-[14px] border border-border/80 bg-card p-4 shadow-[0_1px_2px_rgb(16_24_40/0.04)]",
                    !p.ativo && "opacity-75",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{p.nome}</p>
                    {p.ativo ? (
                      <Selo tom="sucesso" ponto>
                        Ativo
                      </Selo>
                    ) : (
                      <Selo tom="neutro">Inativo</Selo>
                    )}
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {/* `teto` é a fração máxima do imóvel que dá para financiar (LTV), não um valor em reais. */}
                    <Numero rotulo="Financia até" valor={p.teto != null ? `${Math.round(p.teto * 100)}%` : "—"} />
                    <Numero rotulo="Prazo (meses)" valor={`${p.prazo_minimo ?? "—"}–${p.prazo_maximo ?? "—"}`} />
                    <Numero
                      rotulo="Idade + prazo"
                      valor={p.idade_mais_prazo_max != null ? `≤ ${p.idade_mais_prazo_max}` : "—"}
                    />
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="flags" className="space-y-3">
          <p className="text-sm text-muted-foreground">Recurso ligado para todas as contas, ou só para uma.</p>
          {q.isLoading ? (
            <Secao>
              <ListaCarregando linhas={3} className="p-0" />
            </Secao>
          ) : !flags.length ? (
            <Secao>
              <EstadoVazio icone={<ToggleRight />} titulo="Nenhum recurso com liberação controlada" />
            </Secao>
          ) : (
            <Secao semRespiro>
              <ul className="divide-y divide-border/60">
                {flags.map((f) => (
                  <LinhaFlag key={f.id} f={f} podeEditar={podeEditar} />
                ))}
              </ul>
            </Secao>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={!!banco} onOpenChange={(v) => !v && setBanco(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {banco && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <BancoLogo nome={banco.nome} size="xl" />
                  <div className="min-w-0 text-left">
                    <SheetTitle>{banco.nome}</SheetTitle>
                    <SheetDescription>
                      código {banco.id}
                      {banco.codigo_compe != null ? ` · COMPE ${banco.codigo_compe}` : ""}
                    </SheetDescription>
                  </div>
                </div>
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
    </PaginaGestao>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-secondary/60 px-2 py-2">
      <dd className="font-mono text-sm tabular-nums text-foreground">{valor}</dd>
      <dt className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
    </div>
  );
}

function LinhaParametro({ c, podeEditar }: { c: ParametroGlobal; podeEditar: boolean }) {
  const qc = useQueryClient();
  const salvarFn = useServerFn(salvarParametroGlobal);
  const original = JSON.stringify(c.valor);
  const [texto, setTexto] = useState(original);
  const id = `param-${c.chave.replace(/\W/g, "-")}`;
  const mudou = texto !== original;

  const salvar = useMutation({
    mutationFn: () => salvarFn({ data: { chave: c.chave, valorJson: texto } }),
    onSuccess: () => {
      toast.success(`${chaveVisivel(c.chave)} atualizado.`);
      qc.invalidateQueries({ queryKey: CHAVE });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar o parâmetro.")),
  });

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="break-all font-mono text-xs font-medium text-foreground">
          {chaveVisivel(c.chave)}
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
            className={cn(
              "h-10 min-w-0 flex-1 font-mono text-base tabular-nums sm:text-xs",
              mudou && "border-primary/50",
            )}
            aria-label={`Valor de ${chaveVisivel(c.chave)}`}
          />
          <Button
            type="submit"
            size="sm"
            variant={mudou ? "default" : "secondary"}
            className="min-h-11 sm:min-h-10"
            disabled={salvar.isPending || !mudou}
          >
            {salvar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Salvar
          </Button>
        </form>
      ) : (
        <p
          id={id}
          className="break-all rounded-md bg-secondary/70 px-2.5 py-1.5 font-mono text-xs tabular-nums"
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
    <li className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span className="break-all font-mono text-xs font-medium text-foreground">{f.chave}</span>
          {f.conta ? <Selo tom="info">só em {f.conta}</Selo> : <Selo tom="marca">todas as contas</Selo>}
        </p>
        {f.descricao && <p className="mt-0.5 text-xs text-muted-foreground">{f.descricao}</p>}
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
        <Selo tom="sucesso" ponto>
          Ligada
        </Selo>
      ) : (
        <Selo tom="neutro">Desligada</Selo>
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

const ROTULO_CAMPO: Record<string, string> = {
  taxa_sac: "SAC (% a.a.)",
  taxa_price: "Price (% a.a.)",
  taxa_he_sac: "Home equity SAC (% a.a.)",
  taxa_he_price: "Home equity Price (% a.a.)",
  comprometimento_max: "Comprometimento máximo",
  dfi_mensal: "DFI ao mês",
  tarifa_mensal: "Tarifa mensal",
  teto_comercial_ltv: "LTV máximo comercial",
  teto_comercial_prazo: "Prazo máximo comercial",
};

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
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={`banco-${k}`}>{rotulo}</Label>
      <Input
        id={`banco-${k}`}
        inputMode="decimal"
        value={f[k]}
        onChange={(e) => setF((v) => ({ ...v, [k]: e.target.value }))}
        disabled={!podeEditar}
        className="h-10 text-base tabular-nums sm:text-sm"
      />
      {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  );

  const mip = Array.isArray(b.mip)
    ? (b.mip as { idadeAte?: unknown; taxaMensal?: unknown }[])
    : null;
  const proposta =
    temProposta(b) && b.taxas_propostas && typeof b.taxas_propostas === "object" && !Array.isArray(b.taxas_propostas)
      ? Object.entries(b.taxas_propostas as Record<string, unknown>)
      : [];
  const atual = b as unknown as Record<string, unknown>;

  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (podeEditar) salvar.mutate();
      }}
    >
      {temProposta(b) && (
        <section className="space-y-3 rounded-xl border border-warning/50 bg-warning/10 p-3 text-sm text-warning-foreground">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4" /> Taxas propostas esperando aprovação
          </p>
          {proposta.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide opacity-80">
                  <th className="py-1 font-medium">Campo</th>
                  <th className="py-1 text-right font-medium">Atual</th>
                  <th className="py-1 text-right font-medium">Proposta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warning/30">
                {proposta.map(([k, v]) => (
                  <tr key={k}>
                    <td className="py-1.5 pr-2">{ROTULO_CAMPO[k] ?? k}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">
                      {atual[k] == null ? "—" : String(atual[k])}
                    </td>
                    <td className="py-1.5 text-right font-mono font-medium tabular-nums">
                      {typeof v === "object" ? JSON.stringify(v) : String(v)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs">
              {JSON.stringify(b.taxas_propostas, null, 2)}
            </pre>
          )}
          {b.taxas_propostas_em && <p className="text-xs">Recebidas em {dataHora(b.taxas_propostas_em)}.</p>}
          {podeEditar && (
            <Button
              type="button"
              size="sm"
              className="min-h-11 sm:min-h-8"
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <div className="mt-4 divide-y divide-border/60 rounded-lg border border-border/70">
          <label htmlFor="banco-financia" className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm">
            Financia as despesas (ITBI, registro)
            <Switch id="banco-financia" checked={financia} onCheckedChange={setFinancia} disabled={!podeEditar} />
          </label>
          <label htmlFor="banco-ativo" className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm">
            Banco ativo na simulação
            <Switch id="banco-ativo" checked={ativo} onCheckedChange={setAtivo} disabled={!podeEditar} />
          </label>
        </div>
      </Bloco>

      <Bloco
        titulo="MIP por idade"
        descricao="Seguro de morte e invalidez, taxa mensal por faixa de idade. Só leitura nesta tela."
      >
        {mip && mip.length ? (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs tabular-nums sm:grid-cols-3">
            {mip.map((m, i) => (
              <li key={i} className="flex justify-between gap-2 border-b border-border/50 py-1">
                <span className="text-muted-foreground">até {String(m.idadeAte ?? "—")} anos</span>
                <span className="font-mono">{String(m.taxaMensal ?? "—")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="break-all font-mono text-xs">{JSON.stringify(b.mip)}</p>
        )}
      </Bloco>

      {b.sistemas && b.sistemas.length > 0 && (
        <p className="text-xs text-muted-foreground">Sistemas de amortização aceitos: {b.sistemas.join(", ")}.</p>
      )}

      {podeEditar && (
        <div className="sticky bottom-0 -mx-5 border-t border-border bg-background/95 px-5 py-3 sm:-mx-6 sm:px-6">
          <Button type="submit" className="min-h-11 w-full sm:min-h-9 sm:w-auto" disabled={salvar.isPending}>
            {salvar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Salvar banco
          </Button>
        </div>
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
    <section className="rounded-xl border border-border/80 p-3.5">
      <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
      {descricao && <p className="mb-3 text-xs text-muted-foreground">{descricao}</p>}
      {children}
    </section>
  );
}
