import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Tags, X } from "lucide-react";
import { AdminHero } from "@/components/admin/admin-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL } from "@/lib/financeiro/format";
import {
  criarPlanoCatalogo,
  lerCatalogoPlanos,
  removerLimitePlano,
  salvarCustoOperacao,
  salvarLimitePlano,
  salvarPacoteCredito,
  salvarPlanoCatalogo,
  salvarSlaPlano,
  type CustoOperacao,
  type PacoteCredito,
  type PlanoCatalogo,
  type SlaSuporte,
} from "@/lib/plataforma/planos.functions";

export const Route = createFileRoute("/_authenticated/plataforma/planos")({
  head: () => ({ meta: [{ title: "Planos e preços — Plataforma — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.planos"),
  component: Pagina,
});

const PUBLICO: Record<string, string> = {
  corretor: "Corretor",
  imobiliaria: "Imobiliária",
  parceiro: "Parceiro",
  todos: "Todos",
};

/** "1.234,50" ou "1234.5" → número; vazio → null; inválido → NaN. */
function numero(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : NaN;
}
/** Número → "79,90" (máscara de moeda pt-BR; até 4 casas para preço por contato). */
const texto = (n: number | null | undefined) =>
  n == null
    ? ""
    : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
/** Reescreve o que foi digitado no formato da máscara ao sair do campo. */
const normalizarMoeda = (v: string) => {
  const n = numero(v);
  return n == null || Number.isNaN(n) ? v : texto(n);
};

/** Ajuda do campo de pacote: "= R$ 287,70 por mês" (o número grande do site) ou "Vazio = não vende." */
const porMes = (v: string, meses: number) => {
  const n = numero(v);
  return n == null || Number.isNaN(n)
    ? "Vazio = não vende."
    : `= ${formatBRL(Math.round((n / meses) * 100) / 100)} por mês no site.`;
};

/** Plural de verdade: "1 assinatura ativa" / "2 assinaturas ativas". */
const assinaturasAtivas = (n: number) =>
  `${n.toLocaleString("pt-BR")} ${n === 1 ? "assinatura ativa" : "assinaturas ativas"}`;

/** Nome legível dos recursos guardados nos limites do plano (`imoveis.max` etc.). */
const RECURSO: Record<string, string> = {
  usuarios: "Usuários",
  imoveis: "Imóveis",
  clientes: "Clientes",
  contatos: "Contatos",
  financeiro: "Financeiro",
  ia: "IA",
  site: "Site",
  locacao: "Locação",
  creditos: "Créditos",
  marketplace: "Marketplace",
  simulacoes: "Simulações",
  propostas: "Propostas",
  armazenamento: "Armazenamento",
};
const ATRIBUTO: Record<string, string> = {
  max: "",
  creditos_mes: "créditos por mês",
  por_mes: "por mês",
};
const capitalizar = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** `imoveis.max: 50` → "Imóveis: até 50"; `financeiro: "completo"` → "Financeiro: Completo". */
function rotuloLimite(chave: string, valor: unknown): string {
  const [base, ...resto] = chave.split(".");
  const nome = RECURSO[base] ?? capitalizar(base.replace(/_/g, " "));
  const sub = resto
    .map((r) => ATRIBUTO[r] ?? r.replace(/_/g, " "))
    .filter(Boolean)
    .join(" ");
  const titulo = sub ? `${nome} · ${sub}` : nome;
  let v: string;
  if (valor === -1 || valor === "-1") v = "sem limite";
  else if (valor === true) v = "incluído";
  else if (valor === false) v = "não incluído";
  else if (typeof valor === "number")
    v = resto[0] === "max" ? `até ${valor.toLocaleString("pt-BR")}` : valor.toLocaleString("pt-BR");
  else if (typeof valor === "string") v = capitalizar(valor.replace(/_/g, " "));
  else v = JSON.stringify(valor);
  return `${titulo}: ${v}`;
}

function Pagina() {
  const lerFn = useServerFn(lerCatalogoPlanos);
  const q = useQuery({ queryKey: ["plataforma-planos"], queryFn: () => lerFn() });
  const pode = usePermissao("saas.planos", "edit");

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        secao="Plataforma"
        icon={<Tags className="h-5 w-5" />}
        titulo="Planos, preços e créditos"
        descricao="Catálogo dos assinantes. Plano com dias de acesso e à venda aparece na página de vendas: o cliente paga e a conta fica liberada pelos dias."
        acoes={pode ? <NovoPlano /> : undefined}
      />
      {q.isError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(q.error, "Não foi possível carregar o catálogo.")}
        </p>
      )}
      <Tabs defaultValue="planos">
        <TabsList className="flex-wrap">
          <TabsTrigger value="planos">Planos</TabsTrigger>
          <TabsTrigger value="pacotes">Pacotes de crédito</TabsTrigger>
          <TabsTrigger value="custos">Custo por operação</TabsTrigger>
          <TabsTrigger value="sla">Prazos de suporte</TabsTrigger>
        </TabsList>
        <TabsContent value="planos" className="mt-4 grid gap-4 xl:grid-cols-2">
          {q.isLoading && <Skeleton className="h-64" />}
          {(q.data?.planos ?? []).map((p) => (
            <CartaoPlano key={p.id} plano={p} pode={pode} />
          ))}
        </TabsContent>
        <TabsContent value="pacotes" className="mt-4 space-y-3">
          {(q.data?.pacotes ?? []).map((p) => (
            <LinhaPacote key={p.id} pacote={p} pode={pode} />
          ))}
        </TabsContent>
        <TabsContent value="custos" className="mt-4 space-y-3">
          {/* Operações de teste (ex.: "teste_cpf") não são cobradas de ninguém. */}
          {(q.data?.custos ?? [])
            .filter((c) => !/^teste/i.test(c.operacao))
            .map((c) => (
              <LinhaCusto key={c.operacao} custo={c} pode={pode} />
            ))}
        </TabsContent>
        <TabsContent value="sla" className="mt-4 space-y-3">
          {(q.data?.slas ?? []).map((s) => (
            <LinhaSla key={s.plano_codigo} sla={s} pode={pode} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function useSalvar<T>(fn: (v: T) => Promise<unknown>, sucesso: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(sucesso);
      qc.invalidateQueries({ queryKey: ["plataforma-planos"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar.")),
  });
}

function CartaoPlano({ plano: p, pode }: { plano: PlanoCatalogo; pode: boolean }) {
  const salvarFn = useServerFn(salvarPlanoCatalogo);
  const limiteFn = useServerFn(salvarLimitePlano);
  const removerFn = useServerFn(removerLimitePlano);
  const inicial = () => ({
    nome: p.nome,
    descricao: p.descricao ?? "",
    preco_mensal: texto(p.preco_mensal),
    preco_trimestral: texto(p.preco_trimestral),
    preco_semestral: texto(p.preco_semestral),
    preco_anual: texto(p.preco_anual),
    preco_por_usuario: texto(p.preco_por_usuario),
    preco_por_contato: texto(p.preco_por_contato),
    trial_dias: String(p.trial_dias),
    dias_acesso: p.dias_acesso == null ? "" : String(p.dias_acesso),
    ativo: p.ativo,
    vende_mensal: p.vende_mensal !== false,
  });
  const [f, setF] = useState(inicial);
  useEffect(
    () => setF(inicial()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      p.id,
      p.nome,
      p.preco_mensal,
      p.preco_trimestral,
      p.preco_semestral,
      p.preco_anual,
      p.vende_mensal,
      p.ativo,
    ],
  );
  const [chave, setChave] = useState("");
  const [valor, setValor] = useState("");
  /** Limite aguardando confirmação de remoção (vale para todos os assinantes). */
  const [removendo, setRemovendo] = useState<string | null>(null);

  const salvar = useSalvar(() => {
    const valores = [
      f.preco_mensal,
      f.preco_anual,
      f.preco_por_usuario,
      f.preco_por_contato,
      f.preco_trimestral,
      f.preco_semestral,
    ].map(numero);
    if (valores.some((v) => Number.isNaN(v))) throw new Error("Algum preço não é um valor válido.");
    const dias = f.dias_acesso.trim() ? Number(f.dias_acesso) : null;
    if (dias != null && (!Number.isInteger(dias) || dias < 1 || dias > 3650))
      throw new Error("Dias de acesso: de 1 a 3650, ou vazio para plano recorrente.");
    if (!f.vende_mensal && valores[1] == null && valores[4] == null && valores[5] == null)
      throw new Error(
        "O plano precisa vender algum período: ligue o mensal ou informe o preço de um pacote.",
      );
    return salvarFn({
      data: {
        id: p.id,
        nome: f.nome,
        descricao: f.descricao || null,
        preco_mensal: valores[0],
        preco_anual: valores[1],
        preco_por_usuario: valores[2],
        preco_por_contato: valores[3],
        preco_trimestral: valores[4],
        preco_semestral: valores[5],
        vende_mensal: f.vende_mensal,
        trial_dias: Number(f.trial_dias) || 0,
        ativo: f.ativo,
        dias_acesso: dias,
      },
    });
  }, `${f.nome} salvo.`);
  /** O que o site mostra, do que está gravado: "Trimestral R$ 287,70/mês" etc. (0253). */
  const vitrine = [
    p.vende_mensal !== false && { nome: "Mensal", total: p.preco_mensal, meses: 1 },
    p.preco_trimestral != null && { nome: "Trimestral", total: p.preco_trimestral, meses: 3 },
    p.preco_semestral != null && { nome: "Semestral", total: p.preco_semestral, meses: 6 },
    p.preco_anual != null && { nome: "Anual", total: p.preco_anual, meses: 12 },
  ].filter((x): x is { nome: string; total: number; meses: number } => Boolean(x));
  const addLimite = useSalvar(
    () => limiteFn({ data: { planoId: p.id, chave, valor } }),
    "Limite salvo.",
  );
  const remLimite = useSalvar(
    (k: string) => removerFn({ data: { planoId: p.id, chave: k } }),
    "Limite removido.",
  );

  const campo = (k: keyof typeof f, rotulo: string, ajuda?: string, moeda = false) => (
    <div className="space-y-1">
      <Label htmlFor={`pl-${p.id}-${k}`}>{rotulo}</Label>
      <div className="relative">
        {moeda && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            R$
          </span>
        )}
        <Input
          id={`pl-${p.id}-${k}`}
          inputMode="decimal"
          className={moeda ? "pl-9 tabular-nums" : undefined}
          value={String(f[k])}
          onChange={(e) => setF((v) => ({ ...v, [k]: e.target.value }))}
          onBlur={
            moeda ? (e) => setF((v) => ({ ...v, [k]: normalizarMoeda(e.target.value) })) : undefined
          }
          disabled={!pode}
        />
      </div>
      {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  );

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">{p.nome}</h2>
          {/* O código técnico (slug) fica só no title: quem opera não precisa dele. */}
          <p className="text-xs text-muted-foreground" title={`Código: ${p.codigo}`}>
            {PUBLICO[p.publico] ?? p.publico} · {assinaturasAtivas(p.assinaturas)}
          </p>
          {p.ativo && p.dias_acesso != null && (
            <div className="mt-1 flex flex-wrap gap-1.5" aria-label="Como aparece no site">
              {vitrine.map((v) => (
                <Badge key={v.nome} variant="secondary" className="tabular-nums">
                  {v.nome}: {formatBRL(v.total / v.meses)}/mês
                  {v.meses > 1 ? ` · ${formatBRL(v.total)}` : ""}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`pl-${p.id}-ativo`} className="text-sm">
            À venda
          </Label>
          <Switch
            id={`pl-${p.id}-ativo`}
            checked={f.ativo}
            onCheckedChange={(v) => setF((x) => ({ ...x, ativo: v }))}
            disabled={!pode}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {campo("nome", "Nome")}
        {campo("trial_dias", "Dias de teste grátis", "De 0 a 90.")}
        {campo(
          "dias_acesso",
          "Dias de acesso por pagamento",
          "Preenchido: vendido no site; cada pagamento libera estes dias. Vazio: plano recorrente.",
        )}
        {campo(
          "preco_mensal",
          f.dias_acesso.trim() ? "Preço do período (mensal)" : "Preço mensal",
          f.dias_acesso.trim() && !f.vende_mensal
            ? "Mensal desligado: fica só como referência."
            : undefined,
          true,
        )}
        {f.dias_acesso.trim() ? (
          <>
            {/* Pacotes (0253): o administrador liga e desliga sem código novo. */}
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 sm:col-span-2">
              <div>
                <Label htmlFor={`pl-${p.id}-vende_mensal`} className="text-sm">
                  Vende mensal
                </Label>
                <p className="text-xs text-muted-foreground">
                  Desligado: o plano só é vendido nos pacotes, e quem pagava o mensal renova no
                  menor pacote.
                </p>
              </div>
              <Switch
                id={`pl-${p.id}-vende_mensal`}
                checked={f.vende_mensal}
                onCheckedChange={(v) => setF((x) => ({ ...x, vende_mensal: v }))}
                disabled={!pode}
              />
            </div>
            {campo(
              "preco_trimestral",
              "Pacote trimestral (total, 90 dias)",
              porMes(f.preco_trimestral, 3),
              true,
            )}
            {campo(
              "preco_semestral",
              "Pacote semestral (total, 180 dias)",
              porMes(f.preco_semestral, 6),
              true,
            )}
            {campo(
              "preco_anual",
              "Pacote anual (total, 365 dias)",
              porMes(f.preco_anual, 12),
              true,
            )}
          </>
        ) : (
          campo("preco_anual", "Preço anual", "Vazio = sem plano anual.", true)
        )}
        {campo("preco_por_usuario", "Por usuário extra", undefined, true)}
        {campo("preco_por_contato", "Por contato", undefined, true)}
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`pl-${p.id}-descricao`}>Descrição</Label>
          <Textarea
            id={`pl-${p.id}-descricao`}
            rows={2}
            value={f.descricao}
            onChange={(e) => setF((v) => ({ ...v, descricao: e.target.value }))}
            disabled={!pode}
          />
        </div>
      </div>
      {pode && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => salvar.mutate(undefined)} disabled={salvar.isPending}>
            Salvar plano
          </Button>
        </div>
      )}

      <div className="space-y-2 border-t border-border pt-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Limites e recursos
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(p.limites).length === 0 && (
            <span className="text-sm text-muted-foreground">Nenhum limite cadastrado.</span>
          )}
          {Object.entries(p.limites).map(([k, v]) => (
            <Badge
              key={k}
              variant="secondary"
              className="gap-1"
              title={`${k}: ${JSON.stringify(v)}`}
            >
              {rotuloLimite(k, v)}
              {pode && (
                <button
                  type="button"
                  aria-label={`Remover limite ${rotuloLimite(k, v)}`}
                  className="ml-1 rounded hover:text-destructive"
                  onClick={() => setRemovendo(k)}
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
        {/* Remover limite vale na hora para todos os assinantes do plano: pede confirmação. */}
        <AlertDialog open={removendo !== null} onOpenChange={(o) => !o && setRemovendo(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover limite do plano {p.nome}?</AlertDialogTitle>
              <AlertDialogDescription>
                {removendo ? `“${rotuloLimite(removendo, p.limites[removendo])}” ` : ""}
                deixa de valer na hora para{" "}
                {p.assinaturas > 0
                  ? `as ${assinaturasAtivas(p.assinaturas)} deste plano`
                  : "todas as assinaturas deste plano (hoje nenhuma ativa)"}
                .
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (removendo) remLimite.mutate(removendo);
                  setRemovendo(null);
                }}
              >
                Remover limite
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {pode && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="Chave do limite"
              placeholder="chave (ex.: usuarios)"
              value={chave}
              onChange={(e) => setChave(e.target.value)}
            />
            <Input
              aria-label="Valor do limite"
              placeholder='valor (5, -1, true, "texto")'
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                addLimite.mutate(undefined, {
                  onSuccess: () => {
                    setChave("");
                    setValor("");
                  },
                })
              }
              disabled={addLimite.isPending || !chave.trim() || !valor.trim()}
            >
              <Plus className="mr-1 size-4" /> Limite
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function LinhaPacote({ pacote, pode }: { pacote: PacoteCredito; pode: boolean }) {
  const fn = useServerFn(salvarPacoteCredito);
  const [nome, setNome] = useState(pacote.nome);
  const [qtd, setQtd] = useState(String(pacote.quantidade));
  const [preco, setPreco] = useState(texto(pacote.preco));
  const [ativo, setAtivo] = useState(pacote.ativo);
  const salvar = useSalvar(() => {
    const p = numero(preco);
    if (p === null || Number.isNaN(p)) throw new Error("Preço inválido.");
    return fn({
      data: { id: pacote.id, nome, quantidade: Math.trunc(Number(qtd)), preco: p, ativo },
    });
  }, "Pacote salvo.");
  const q = Number(qtd);
  const p = numero(preco);
  return (
    <div className="grid items-end gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-[2fr_1fr_1fr_auto_auto]">
      <div className="space-y-1">
        <Label htmlFor={`pc-${pacote.id}-nome`}>Pacote</Label>
        <Input
          id={`pc-${pacote.id}-nome`}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          disabled={!pode}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`pc-${pacote.id}-qtd`}>Créditos</Label>
        <Input
          id={`pc-${pacote.id}-qtd`}
          inputMode="numeric"
          value={qtd}
          onChange={(e) => setQtd(e.target.value)}
          disabled={!pode}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`pc-${pacote.id}-preco`}>Preço</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            R$
          </span>
          <Input
            id={`pc-${pacote.id}-preco`}
            inputMode="decimal"
            className="pl-9 tabular-nums"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            onBlur={(e) => setPreco(normalizarMoeda(e.target.value))}
            disabled={!pode}
          />
        </div>
        {q > 0 && p != null && !Number.isNaN(p) && (
          <p className="text-xs text-muted-foreground">{formatBRL(p / q)} por crédito</p>
        )}
      </div>
      <div className="flex items-center gap-2 pb-2">
        <Switch checked={ativo} onCheckedChange={setAtivo} disabled={!pode} aria-label="À venda" />
        <span className="text-sm">À venda</span>
      </div>
      {pode && (
        <Button size="sm" onClick={() => salvar.mutate(undefined)} disabled={salvar.isPending}>
          Salvar
        </Button>
      )}
    </div>
  );
}

function LinhaCusto({ custo, pode }: { custo: CustoOperacao; pode: boolean }) {
  const fn = useServerFn(salvarCustoOperacao);
  const [v, setV] = useState(String(custo.creditos));
  const salvar = useSalvar(
    () => fn({ data: { operacao: custo.operacao, creditos: Math.trunc(Number(v)) } }),
    `Custo de ${custo.operacao} atualizado.`,
  );
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-[12rem] flex-1">
        <p className="font-medium">{custo.operacao.replace(/_/g, " ")}</p>
        <p className="text-xs text-muted-foreground">Créditos consumidos por uso</p>
      </div>
      <Input
        aria-label={`Créditos de ${custo.operacao}`}
        className="w-28"
        inputMode="numeric"
        value={v}
        onChange={(e) => setV(e.target.value)}
        disabled={!pode}
      />
      {pode && (
        <Button size="sm" onClick={() => salvar.mutate(undefined)} disabled={salvar.isPending}>
          Salvar
        </Button>
      )}
    </div>
  );
}

function LinhaSla({ sla, pode }: { sla: SlaSuporte; pode: boolean }) {
  const fn = useServerFn(salvarSlaPlano);
  const [a, setA] = useState(String(sla.primeira_resposta_horas));
  const [b, setB] = useState(String(sla.resolucao_horas));
  const salvar = useSalvar(
    () =>
      fn({
        data: {
          plano_codigo: sla.plano_codigo,
          primeira: Math.trunc(Number(a)),
          resolucao: Math.trunc(Number(b)),
        },
      }),
    "Prazos de suporte atualizados.",
  );
  return (
    <div className="grid items-end gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
      <div>
        <p className="font-medium">{sla.plano ?? sla.plano_codigo}</p>
        <p className="text-xs text-muted-foreground">Prazo do chamado de suporte</p>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`sla-${sla.plano_codigo}-a`}>1ª resposta (h)</Label>
        <Input
          id={`sla-${sla.plano_codigo}-a`}
          inputMode="numeric"
          value={a}
          onChange={(e) => setA(e.target.value)}
          disabled={!pode}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`sla-${sla.plano_codigo}-b`}>Resolução (h)</Label>
        <Input
          id={`sla-${sla.plano_codigo}-b`}
          inputMode="numeric"
          value={b}
          onChange={(e) => setB(e.target.value)}
          disabled={!pode}
        />
      </div>
      {pode && (
        <Button size="sm" onClick={() => salvar.mutate(undefined)} disabled={salvar.isPending}>
          Salvar
        </Button>
      )}
    </div>
  );
}

/**
 * Cadastro de plano novo por dias de acesso — vai para o site assim que fica à venda.
 *
 * Começa FORA da venda: a página de vendas cobra de verdade (Asaas), e um plano
 * criado por engano não pode aparecer na vitrine. Publicar é um segundo passo
 * consciente (o interruptor "À venda" aqui ou no cartão do plano).
 */
function NovoPlano() {
  const criarFn = useServerFn(criarPlanoCatalogo);
  const [aberto, setAberto] = useState(false);
  const vazio = { nome: "", publico: "", descricao: "", preco: "", dias: "30", ativo: false };
  const [f, setF] = useState(vazio);
  // "Criar plano" só habilita com o essencial preenchido (antes a validação só
  // aparecia no clique, com o formulário vazio).
  const completo = !!(f.nome.trim() && f.publico && f.preco.trim() && f.dias.trim());
  const criar = useSalvar(() => {
    const preco = numero(f.preco);
    if (preco == null || Number.isNaN(preco)) throw new Error("Informe o preço do plano.");
    const dias = Number(f.dias);
    if (!Number.isInteger(dias) || dias < 1 || dias > 3650)
      throw new Error("Dias de acesso: de 1 a 3650.");
    if (!f.publico) throw new Error("Escolha para quem é o plano.");
    return criarFn({
      data: {
        nome: f.nome,
        publico: f.publico as "corretor" | "imobiliaria" | "parceiro",
        descricao: f.descricao || null,
        preco,
        dias_acesso: dias,
        ativo: f.ativo,
      },
    }).then(() => {
      setAberto(false);
      setF(vazio);
    });
  }, "Plano criado.");

  return (
    <>
      <Button size="sm" onClick={() => setAberto(true)}>
        <Plus className="mr-1 size-4" /> Novo plano
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo plano</DialogTitle>
            <DialogDescription>
              O plano nasce fora da venda. Quando ligar “À venda”, ele aparece na página de vendas
              do Corretor: o cliente paga (cobrança real) e a conta fica liberada pelos dias.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="np-nome">Nome</Label>
              <Input
                id="np-nome"
                value={f.nome}
                onChange={(e) => setF((v) => ({ ...v, nome: e.target.value }))}
                placeholder="Imobiliária 30 dias"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="np-publico">Para quem</Label>
              <Select value={f.publico} onValueChange={(v) => setF((x) => ({ ...x, publico: v }))}>
                <SelectTrigger id="np-publico">
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corretor">Corretor</SelectItem>
                  <SelectItem value="imobiliaria">Imobiliária</SelectItem>
                  <SelectItem value="parceiro">Parceiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="np-dias">Dias de acesso</Label>
              <Input
                id="np-dias"
                inputMode="numeric"
                value={f.dias}
                onChange={(e) => setF((v) => ({ ...v, dias: e.target.value.replace(/\D/g, "") }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="np-preco">Preço</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  id="np-preco"
                  inputMode="decimal"
                  className="pl-9 tabular-nums"
                  value={f.preco}
                  onChange={(e) => setF((v) => ({ ...v, preco: e.target.value }))}
                  onBlur={(e) => setF((v) => ({ ...v, preco: normalizarMoeda(e.target.value) }))}
                  placeholder="5,00"
                />
              </div>
            </div>
            <div className="space-y-1 self-end pb-1">
              <div className="flex items-center gap-2">
                <Switch
                  id="np-ativo"
                  checked={f.ativo}
                  onCheckedChange={(v) => setF((x) => ({ ...x, ativo: v }))}
                />
                <Label htmlFor="np-ativo">À venda no site</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Desligado: o plano é criado só como rascunho, fora da página de vendas.
              </p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="np-descricao">Descrição (aparece no site)</Label>
              <Textarea
                id="np-descricao"
                rows={2}
                value={f.descricao}
                onChange={(e) => setF((v) => ({ ...v, descricao: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => criar.mutate(undefined)} disabled={criar.isPending || !completo}>
              {f.ativo ? "Criar e pôr à venda" : "Criar plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
