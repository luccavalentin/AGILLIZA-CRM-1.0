/**
 * Planos do catálogo: o cartão-resumo (o que o assinante vê no site), a gaveta de edição
 * em abas (preços e venda · limites e recursos) e o cadastro de plano novo. As regras de
 * gravação são as mesmas de antes (`planos.functions.ts`, permissão `saas.planos`).
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil, Plus, ShieldCheck, Tags, Trash2, Users } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { IconeGestao, Selo } from "@/components/plataforma/kit";
import { AbaComContagem, Dinheiro, TIPO_CONTA, TrilhoAbas } from "@/components/plataforma/receita/comum";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL } from "@/lib/financeiro/format";
import { cn } from "@/lib/utils";
import {
  criarPlanoCatalogo,
  removerLimitePlano,
  salvarLimitePlano,
  salvarPlanoCatalogo,
  type PlanoCatalogo,
} from "@/lib/plataforma/planos.functions";
import {
  assinaturasAtivas,
  menorMensal,
  normalizarMoeda,
  numero,
  partesLimite,
  porMes,
  rotuloLimite,
  texto,
  vitrineDoPlano,
} from "./comum";

export function useSalvarCatalogo<T>(fn: (v: T) => Promise<unknown>, sucesso: string) {
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

/** Campo de moeda com "R$" fixo e máscara ao sair. */
function CampoMoeda({
  id,
  rotulo,
  valor,
  onChange,
  ajuda,
  disabled,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  ajuda?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{rotulo}</Label>
      <div className="relative max-w-[12rem]">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          R$
        </span>
        <Input
          id={id}
          inputMode="decimal"
          className="pl-9 tabular-nums"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onChange(normalizarMoeda(e.target.value))}
          disabled={disabled}
        />
      </div>
      {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  );
}

/** Cartão-resumo do plano: preço "a partir de", períodos à venda, assinantes e limites. */
export function CartaoPlano({
  plano: p,
  onAbrir,
  pode,
}: {
  plano: PlanoCatalogo;
  onAbrir: () => void;
  pode: boolean;
}) {
  const vitrine = vitrineDoPlano(p);
  const limites = Object.entries(p.limites);
  return (
    <article
      className={cn(
        "flex min-w-0 flex-col rounded-[14px] border bg-card p-4 shadow-[0_1px_2px_rgb(16_24_40/0.04)] transition-shadow hover:shadow-[0_6px_16px_-10px_rgb(0_10_112/0.25)]",
        p.ativo ? "border-border/80" : "border-dashed border-border",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <IconeGestao icone={<Tags />} tom={p.ativo ? "marca" : "neutro"} tamanho="sm" />
          <div className="min-w-0">
            {/* O código técnico fica só no title: quem opera não precisa dele. */}
            <h3 className="truncate text-[15px] font-semibold text-foreground" title={`Código: ${p.codigo}`}>
              {p.nome}
            </h3>
            <p className="text-xs text-muted-foreground">
              {TIPO_CONTA[p.publico] ?? p.publico} ·{" "}
              {p.dias_acesso != null ? `${p.dias_acesso} dias por pagamento` : "recorrente"}
            </p>
          </div>
        </div>
        <Selo tom={p.ativo ? "sucesso" : "neutro"} ponto={p.ativo}>
          {p.ativo ? "À venda" : "Fora da venda"}
        </Selo>
      </header>

      <div className="mt-4 flex items-baseline gap-1.5">
        {vitrine.length > 1 && <span className="text-xs text-muted-foreground">a partir de</span>}
        <span className="text-2xl font-medium tracking-tight">
          <Dinheiro valor={menorMensal(p)} />
        </span>
        <span className="text-sm text-muted-foreground">/mês</span>
      </div>
      {vitrine.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Períodos à venda">
          {vitrine.map((v) => (
            <span
              key={v.nome}
              className="rounded-md bg-secondary px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground"
              title={v.meses > 1 ? `${formatBRL(v.total)} no período` : undefined}
            >
              {v.nome} {v.meses > 1 ? `· ${formatBRL(v.total)}` : ""}
            </span>
          ))}
        </div>
      )}

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border/70 pt-3 text-xs">
        <div>
          <dt className="text-muted-foreground">Assinantes</dt>
          <dd className="mt-0.5 flex items-center gap-1 text-sm font-medium tabular-nums">
            <Users className="size-3.5 text-muted-foreground" /> {p.assinaturas.toLocaleString("pt-BR")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Teste grátis</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums">{p.trial_dias} dias</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Limites</dt>
          <dd className="mt-0.5 flex items-center gap-1 text-sm font-medium tabular-nums">
            <ShieldCheck className="size-3.5 text-muted-foreground" /> {limites.length}
          </dd>
        </div>
      </dl>
      {limites.length > 0 && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {limites
            .slice(0, 4)
            .map(([k, v]) => rotuloLimite(k, v))
            .join(" · ")}
          {limites.length > 4 ? ` · +${limites.length - 4}` : ""}
        </p>
      )}

      <div className="mt-auto pt-4">
        <Button variant="outline" size="sm" className="min-h-11 w-full sm:min-h-9" onClick={onAbrir}>
          <Pencil className="mr-1.5 size-4" /> {pode ? "Editar plano" : "Ver detalhes"}
        </Button>
      </div>
    </article>
  );
}

/** Gaveta de edição do plano: preços e venda · limites e recursos. */
export function GavetaPlano({
  plano: p,
  pode,
  aoFechar,
}: {
  plano: PlanoCatalogo | null;
  pode: boolean;
  aoFechar: () => void;
}) {
  return (
    <Sheet open={!!p} onOpenChange={(v) => !v && aoFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {p && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3 pr-8">
                <IconeGestao icone={<Tags />} />
                <div className="min-w-0 text-left">
                  <SheetTitle className="truncate">{p.nome}</SheetTitle>
                  <SheetDescription>
                    {TIPO_CONTA[p.publico] ?? p.publico} · {assinaturasAtivas(p.assinaturas)}. Mudar
                    preço não mexe em quem já assinou até a próxima renovação.
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <Tabs defaultValue="precos" className="space-y-4">
              <TrilhoAbas>
                <AbaComContagem value="precos" rotulo="Preços e venda" />
                <AbaComContagem
                  value="limites"
                  rotulo="Limites e recursos"
                  contagem={Object.keys(p.limites).length}
                />
              </TrilhoAbas>
              <TabsContent value="precos" className="mt-0">
                <FormPrecos plano={p} pode={pode} />
              </TabsContent>
              <TabsContent value="limites" className="mt-0">
                <Limites plano={p} pode={pode} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function FormPrecos({ plano: p, pode }: { plano: PlanoCatalogo; pode: boolean }) {
  const salvarFn = useServerFn(salvarPlanoCatalogo);
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
    [p.id, p.nome, p.preco_mensal, p.preco_trimestral, p.preco_semestral, p.preco_anual, p.vende_mensal, p.ativo],
  );
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const porDias = f.dias_acesso.trim() !== "";

  const salvar = useSalvarCatalogo(() => {
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
      throw new Error("O plano precisa vender algum período: ligue o mensal ou informe o preço de um pacote.");
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

  const bloco = "space-y-3 rounded-[14px] border border-border/80 p-4";
  const titulo = "text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-[14px] border border-border/80 px-4 py-3">
        <div>
          <Label htmlFor={`pl-${p.id}-ativo`} className="text-sm font-medium">
            À venda no site
          </Label>
          <p className="text-xs text-muted-foreground">
            Ligado: aparece na página de vendas e o cliente paga de verdade.
          </p>
        </div>
        <Switch
          id={`pl-${p.id}-ativo`}
          checked={f.ativo}
          onCheckedChange={(v) => setF((x) => ({ ...x, ativo: v }))}
          disabled={!pode}
        />
      </div>

      <section className={bloco}>
        <h4 className={titulo}>Identificação</h4>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1">
            <Label htmlFor={`pl-${p.id}-nome`}>Nome</Label>
            <Input id={`pl-${p.id}-nome`} value={f.nome} onChange={(e) => set("nome")(e.target.value)} disabled={!pode} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`pl-${p.id}-trial`}>Teste grátis</Label>
            <div className="relative w-28">
              <Input
                id={`pl-${p.id}-trial`}
                inputMode="numeric"
                className="pr-12 tabular-nums"
                value={f.trial_dias}
                onChange={(e) => set("trial_dias")(e.target.value)}
                disabled={!pode}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                dias
              </span>
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`pl-${p.id}-descricao`}>Descrição (aparece no site)</Label>
          <Textarea
            id={`pl-${p.id}-descricao`}
            rows={2}
            value={f.descricao}
            onChange={(e) => set("descricao")(e.target.value)}
            disabled={!pode}
          />
        </div>
      </section>

      <section className={bloco}>
        <h4 className={titulo}>Como é vendido</h4>
        <div className="space-y-1">
          <Label htmlFor={`pl-${p.id}-dias`}>Dias de acesso por pagamento</Label>
          <Input
            id={`pl-${p.id}-dias`}
            inputMode="numeric"
            className="w-28 tabular-nums"
            value={f.dias_acesso}
            onChange={(e) => set("dias_acesso")(e.target.value)}
            disabled={!pode}
          />
          <p className="text-xs text-muted-foreground">
            Preenchido: vendido no site; cada pagamento libera estes dias. Vazio: plano recorrente.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoMoeda
            id={`pl-${p.id}-mensal`}
            rotulo={porDias ? "Preço do período (mensal)" : "Preço mensal"}
            valor={f.preco_mensal}
            onChange={set("preco_mensal")}
            ajuda={porDias && !f.vende_mensal ? "Mensal desligado: fica só como referência." : undefined}
            disabled={!pode}
          />
          {!porDias && (
            <CampoMoeda
              id={`pl-${p.id}-anual`}
              rotulo="Preço anual"
              valor={f.preco_anual}
              onChange={set("preco_anual")}
              ajuda="Vazio = sem plano anual."
              disabled={!pode}
            />
          )}
        </div>
        {porDias && (
          <>
            {/* Pacotes (0253): o administrador liga e desliga sem código novo. */}
            <div className="flex items-center justify-between gap-3 rounded-[10px] bg-secondary/60 px-3 py-2">
              <div>
                <Label htmlFor={`pl-${p.id}-vende_mensal`} className="text-sm">
                  Vende mensal
                </Label>
                <p className="text-xs text-muted-foreground">
                  Desligado: só vende pacotes, e quem pagava o mensal renova no menor pacote.
                </p>
              </div>
              <Switch
                id={`pl-${p.id}-vende_mensal`}
                checked={f.vende_mensal}
                onCheckedChange={(v) => setF((x) => ({ ...x, vende_mensal: v }))}
                disabled={!pode}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <CampoMoeda
                id={`pl-${p.id}-tri`}
                rotulo="Trimestral (90 dias)"
                valor={f.preco_trimestral}
                onChange={set("preco_trimestral")}
                ajuda={porMes(f.preco_trimestral, 3)}
                disabled={!pode}
              />
              <CampoMoeda
                id={`pl-${p.id}-sem`}
                rotulo="Semestral (180 dias)"
                valor={f.preco_semestral}
                onChange={set("preco_semestral")}
                ajuda={porMes(f.preco_semestral, 6)}
                disabled={!pode}
              />
              <CampoMoeda
                id={`pl-${p.id}-anu`}
                rotulo="Anual (365 dias)"
                valor={f.preco_anual}
                onChange={set("preco_anual")}
                ajuda={porMes(f.preco_anual, 12)}
                disabled={!pode}
              />
            </div>
          </>
        )}
      </section>

      <section className={bloco}>
        <h4 className={titulo}>Adicionais</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoMoeda
            id={`pl-${p.id}-usuario`}
            rotulo="Por usuário extra"
            valor={f.preco_por_usuario}
            onChange={set("preco_por_usuario")}
            disabled={!pode}
          />
          <CampoMoeda
            id={`pl-${p.id}-contato`}
            rotulo="Por contato"
            valor={f.preco_por_contato}
            onChange={set("preco_por_contato")}
            disabled={!pode}
          />
        </div>
      </section>

      {pode && (
        <div className="sticky bottom-0 -mx-1 flex justify-end border-t border-border bg-background/95 px-1 py-3">
          <Button className="min-h-11 sm:min-h-10" onClick={() => salvar.mutate(undefined)} disabled={salvar.isPending}>
            Salvar plano
          </Button>
        </div>
      )}
    </div>
  );
}

function Limites({ plano: p, pode }: { plano: PlanoCatalogo; pode: boolean }) {
  const limiteFn = useServerFn(salvarLimitePlano);
  const removerFn = useServerFn(removerLimitePlano);
  const [chave, setChave] = useState("");
  const [valor, setValor] = useState("");
  /** Limite aguardando confirmação de remoção (vale para todos os assinantes). */
  const [removendo, setRemovendo] = useState<string | null>(null);
  const addLimite = useSalvarCatalogo(() => limiteFn({ data: { planoId: p.id, chave, valor } }), "Limite salvo.");
  const remLimite = useSalvarCatalogo(
    (k: string) => removerFn({ data: { planoId: p.id, chave: k } }),
    "Limite removido.",
  );
  const limites = Object.entries(p.limites);

  return (
    <div className="space-y-4">
      {limites.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum limite cadastrado: o plano libera tudo o que o sistema oferece.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-[14px] border border-border/80">
          {limites.map(([k, v]) => {
            const [nome, val] = partesLimite(k, v);
            return (
              <li key={k} className="flex items-center gap-3 px-4 py-2.5 text-sm" title={`${k}: ${JSON.stringify(v)}`}>
                <span className="min-w-0 flex-1 truncate text-foreground">{nome}</span>
                <span className="shrink-0 font-medium tabular-nums">{val}</span>
                {pode && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-11 text-muted-foreground hover:text-destructive sm:size-8"
                    aria-label={`Remover limite ${rotuloLimite(k, v)}`}
                    onClick={() => setRemovendo(k)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

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
        <div className="space-y-2 rounded-[14px] border border-border/80 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Novo limite ou recurso
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="space-y-1 sm:flex-1">
              <Label htmlFor={`lim-${p.id}-chave`}>Chave</Label>
              <Input
                id={`lim-${p.id}-chave`}
                placeholder="ex.: usuarios ou imoveis.max"
                value={chave}
                onChange={(e) => setChave(e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:w-44">
              <Label htmlFor={`lim-${p.id}-valor`}>Valor</Label>
              <Input
                id={`lim-${p.id}-valor`}
                placeholder='5, -1, true, "texto"'
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              className="min-h-11 sm:min-h-10"
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
              <Plus className="mr-1 size-4" /> Adicionar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Número = quantidade · -1 = sem limite · true/false = recurso incluído ou não.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Plano novo por dias de acesso — vai para o site assim que fica à venda.
 *
 * Começa FORA da venda: a página de vendas cobra de verdade (Asaas), e um plano criado por
 * engano não pode aparecer na vitrine. Publicar é um segundo passo consciente.
 */
export function NovoPlano() {
  const criarFn = useServerFn(criarPlanoCatalogo);
  const [aberto, setAberto] = useState(false);
  const vazio = { nome: "", publico: "", descricao: "", preco: "", dias: "30", ativo: false };
  const [f, setF] = useState(vazio);
  // "Criar plano" só habilita com o essencial preenchido.
  const completo = !!(f.nome.trim() && f.publico && f.preco.trim() && f.dias.trim());
  const criar = useSalvarCatalogo(() => {
    const preco = numero(f.preco);
    if (preco == null || Number.isNaN(preco)) throw new Error("Informe o preço do plano.");
    const dias = Number(f.dias);
    if (!Number.isInteger(dias) || dias < 1 || dias > 3650) throw new Error("Dias de acesso: de 1 a 3650.");
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
      <Button size="sm" className="min-h-11 sm:min-h-9" onClick={() => setAberto(true)}>
        <Plus className="mr-1.5 size-4" /> Novo plano
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo plano</DialogTitle>
            <DialogDescription>
              O plano nasce fora da venda. Quando ligar “À venda”, ele aparece na página de vendas do
              Agilliza Tech: o cliente paga (cobrança real) e a conta fica liberada pelos dias.
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
                className="w-28 tabular-nums"
                value={f.dias}
                onChange={(e) => setF((v) => ({ ...v, dias: e.target.value.replace(/\D/g, "") }))}
              />
            </div>
            <CampoMoeda
              id="np-preco"
              rotulo="Preço"
              valor={f.preco}
              onChange={(v) => setF((x) => ({ ...x, preco: v }))}
            />
            <div className="space-y-1 self-end pb-1">
              <div className="flex items-center gap-2">
                <Switch id="np-ativo" checked={f.ativo} onCheckedChange={(v) => setF((x) => ({ ...x, ativo: v }))} />
                <Label htmlFor="np-ativo">À venda no site</Label>
              </div>
              <p className="text-xs text-muted-foreground">Desligado: nasce como rascunho, fora da vitrine.</p>
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
