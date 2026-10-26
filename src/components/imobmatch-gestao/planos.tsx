/**
 * ImobMatch Gestão › Planos e preços: os planos do ImobMatch (Pro e anunciante particular),
 * os produtos das lojas (App Store e Google Play) e, para consulta, os pacotes de banner.
 *
 * Editar exige o módulo com "editar" e, no banco, `planos.editar`: o plano passa por
 * `plataforma.imobmatch_salvar_plano` (0460 — recusa plano do CRM) e o produto da loja por
 * `imobmatch.configurar_produto_loja` (0286/0303). Preço novo vale para as próximas faturas;
 * fatura já emitida não muda.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Apple, Lock, Megaphone, Pencil, Play, RefreshCw, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  CabecalhoGestao,
  EstadoErro,
  EstadoVazio,
  ListaCarregando,
  PaginaGestao,
  Secao,
  Selo,
} from "@/components/plataforma/kit";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  lerPlanosImobMatch,
  salvarPlanoImobMatch,
  salvarProdutoLojaImobMatch,
  type PlanoImobMatch,
  type ProdutoLojaImobMatch,
} from "@/lib/plataforma/imobmatch-gestao.functions";
import { cn } from "@/lib/utils";
import { CHAVE_IMOBMATCH_GESTAO, inteiro, moeda } from "./comum";

const PERIODO: Record<string, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};
const CHAVE = [...CHAVE_IMOBMATCH_GESTAO, "planos"] as const;

export function PlanosImobMatchTela() {
  const fn = useServerFn(lerPlanosImobMatch);
  const q = useQuery({ queryKey: CHAVE, queryFn: () => fn(), staleTime: 30_000 });
  const editarModulo = usePermissao("imobmatch.planos", "edit");
  const podeEditar = editarModulo && !!q.data?.pode_editar;
  const [plano, setPlano] = useState<PlanoImobMatch | null>(null);
  const [produto, setProduto] = useState<ProdutoLojaImobMatch | null>(null);
  const d = q.data;

  return (
    <PaginaGestao>
      <CabecalhoGestao
        secao="ImobMatch Gestão"
        titulo="Planos e preços"
        icone={<Tags />}
        descricao="Os planos do ImobMatch Pro e do anunciante particular, os produtos vendidos na App Store e no Google Play e os pacotes de banner. Preço novo vale para as próximas faturas."
        acoes={
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-9"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
          >
            <RefreshCw className={cn("mr-1.5 size-4", q.isFetching && "animate-spin")} /> Atualizar
          </Button>
        }
      />

      {!podeEditar && d && (
        <p className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden /> Só leitura: alterar preços pede o módulo
          “ImobMatch — Planos e preços” com editar.
        </p>
      )}

      {q.isError && (
        <EstadoErro
          mensagem={mensagemDeErro(q.error, "Não foi possível ler os planos.")}
          onTentar={() => q.refetch()}
        />
      )}

      <Secao
        titulo="Planos do ImobMatch"
        descricao="Pro avulso (sem o CRM) e anunciante particular"
      >
        {q.isLoading ? (
          <ListaCarregando linhas={2} className="p-0" />
        ) : !d?.planos.length ? (
          <EstadoVazio icone={<Tags />} titulo="Nenhum plano do ImobMatch" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {d.planos.map((p) => (
              <CartaoPlano key={p.id} p={p} podeEditar={podeEditar} onEditar={() => setPlano(p)} />
            ))}
          </div>
        )}
      </Secao>

      <Secao
        semRespiro
        titulo="Produtos nas lojas"
        descricao="Assinaturas vendidas dentro do aplicativo (App Store e Google Play)"
      >
        {q.isLoading ? (
          <ListaCarregando linhas={3} />
        ) : !d?.loja.length ? (
          <EstadoVazio titulo="Nenhum produto de loja configurado" />
        ) : (
          <ul className="divide-y divide-border/70">
            {d.loja.map((l) => (
              <li
                key={l.id}
                className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                    {l.loja === "apple" ? (
                      <Apple className="size-4" aria-hidden />
                    ) : (
                      <Play className="size-4" aria-hidden />
                    )}
                    {l.plano} · {PERIODO[l.periodo] ?? l.periodo}
                  </p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    {l.produto_id}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium tabular-nums">
                    {l.preco != null ? moeda(l.preco) : "sem preço"}
                  </span>
                  {l.preco_site != null && (
                    <span className="text-xs text-muted-foreground">
                      no site {moeda(l.preco_site)}
                    </span>
                  )}
                  <Selo tom={l.ativo ? "sucesso" : "neutro"} ponto={l.ativo}>
                    {l.ativo ? "À venda" : "Fora de venda"}
                  </Selo>
                </div>
                {podeEditar && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-11 justify-self-start sm:min-h-8 sm:justify-self-end"
                    onClick={() => setProduto(l)}
                  >
                    <Pencil className="mr-1.5 size-3.5" /> Editar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao
        semRespiro
        titulo="Pacotes de banner"
        descricao="Para consulta: preços e venda dos pacotes se alteram em Patrocinados e banners › Pacotes e preços"
        icone={<Megaphone />}
        acoes={
          <Button asChild variant="ghost" size="sm" className="min-h-11 sm:min-h-8">
            <Link to="/imobmatch/patrocinados" search={{ aba: "pacotes" }}>
              Abrir os pacotes
            </Link>
          </Button>
        }
      >
        {q.isLoading ? (
          <ListaCarregando linhas={2} />
        ) : !d?.pacotes_banner.length ? (
          <EstadoVazio titulo="Nenhum pacote de banner" />
        ) : (
          <ul className="divide-y divide-border/70">
            {d.pacotes_banner.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{b.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.espaco} · {inteiro(b.dias)} dias
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium tabular-nums">{moeda(b.preco)}</span>
                  <Selo tom={b.a_venda ? "sucesso" : "neutro"}>
                    {b.a_venda ? "À venda" : "Fora de venda"}
                  </Selo>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <EditarPlano plano={plano} onFechar={() => setPlano(null)} />
      <EditarProdutoLoja produto={produto} onFechar={() => setProduto(null)} />
    </PaginaGestao>
  );
}

function CartaoPlano({
  p,
  podeEditar,
  onEditar,
}: {
  p: PlanoImobMatch;
  podeEditar: boolean;
  onEditar: () => void;
}) {
  const precos = [
    { r: "Mensal", v: p.vende_mensal ? p.preco_mensal : null },
    { r: "Trimestral", v: p.preco_trimestral },
    { r: "Semestral", v: p.preco_semestral },
    { r: "Anual", v: p.preco_anual },
  ].filter((x) => x.v != null);
  return (
    <article
      className={cn(
        "flex min-w-0 flex-col rounded-xl border border-border/80 p-4",
        !p.ativo && "bg-secondary/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {p.produto === "imobmatch_pro" ? "ImobMatch Pro" : "Anunciante particular"} ·{" "}
            {p.publico}
          </p>
          <h3 className="truncate text-base font-medium text-foreground">{p.nome}</h3>
        </div>
        <Selo tom={p.ativo ? "sucesso" : "neutro"} ponto={p.ativo}>
          {p.ativo ? "À venda" : "Fora de venda"}
        </Selo>
      </div>
      {p.descricao && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.descricao}</p>
      )}
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-medium tracking-tight tabular-nums">
          {moeda(p.preco_mensal)}
        </span>
        <span className="text-xs text-muted-foreground">
          / {p.dias_acesso ? `${p.dias_acesso} dias` : "mês"}
        </span>
      </div>
      <dl className="mb-4 mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        {precos.map((x) => (
          <div key={x.r} className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{x.r}</dt>
            <dd className="tabular-nums text-foreground">{moeda(x.v)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Anúncios</dt>
          <dd className="tabular-nums text-foreground">
            {p.anuncios_max ? `até ${p.anuncios_max}` : "sem limite"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Contas</dt>
          <dd className="tabular-nums text-foreground">{inteiro(p.contas)}</dd>
        </div>
      </dl>
      {podeEditar && (
        <Button
          variant="outline"
          size="sm"
          className="mt-auto min-h-11 sm:min-h-8"
          onClick={onEditar}
        >
          <Pencil className="mr-1.5 size-3.5" /> Editar preços
        </Button>
      )}
    </article>
  );
}

/** "1.234,56" ou "197,00" (vírgula decimal) e também "197.50" (ponto decimal, sem vírgula). */
const paraNumero = (s: string): number | null => {
  const b = s.trim().replace(/^R\$\s*/, "");
  const t = b.includes(",") ? b.replace(/\./g, "").replace(",", ".") : b;
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
};
const paraTexto = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

function EditarPlano({ plano, onFechar }: { plano: PlanoImobMatch | null; onFechar: () => void }) {
  return (
    <Sheet open={!!plano} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {plano && <FormPlano key={plano.id} plano={plano} onFechar={onFechar} />}
      </SheetContent>
    </Sheet>
  );
}

function FormPlano({ plano, onFechar }: { plano: PlanoImobMatch; onFechar: () => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(salvarPlanoImobMatch);
  const [f, setF] = useState({
    descricao: plano.descricao ?? "",
    mensal: paraTexto(plano.preco_mensal),
    trimestral: paraTexto(plano.preco_trimestral),
    semestral: paraTexto(plano.preco_semestral),
    anual: paraTexto(plano.preco_anual),
    vende_mensal: plano.vende_mensal,
    ativo: plano.ativo,
    anuncios_max: plano.anuncios_max ?? "",
  });
  const salvar = useMutation({
    mutationFn: () => {
      const mensal = paraNumero(f.mensal);
      const nums = [mensal, paraNumero(f.trimestral), paraNumero(f.semestral), paraNumero(f.anual)];
      if (nums.some((n) => Number.isNaN(n)))
        throw new Error("Confira os preços: use números como 197 ou 197,00.");
      return fn({
        data: {
          id: plano.id,
          descricao: f.descricao.trim() || null,
          preco_mensal: mensal ?? 0,
          preco_trimestral: nums[1],
          preco_semestral: nums[2],
          preco_anual: nums[3],
          vende_mensal: f.vende_mensal,
          ativo: f.ativo,
          anuncios_max: f.anuncios_max.trim(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Plano salvo. O preço novo vale para as próximas faturas.");
      void qc.invalidateQueries({ queryKey: CHAVE });
      onFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar o plano.")),
  });
  const campo = (id: keyof typeof f, rotulo: string, ajuda?: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`pl-${id}`}>{rotulo}</Label>
      <Input
        id={`pl-${id}`}
        inputMode="decimal"
        className="h-11 text-base sm:h-10 sm:text-sm"
        value={String(f[id])}
        onChange={(e) => setF((v) => ({ ...v, [id]: e.target.value }))}
      />
      {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  );
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      <SheetHeader>
        <SheetTitle>{plano.nome}</SheetTitle>
        <SheetDescription>
          Faturas já emitidas não mudam. Vazio = não vende esse pacote.
        </SheetDescription>
      </SheetHeader>
      <div className="grid grid-cols-2 gap-3">
        {campo("mensal", "Preço mensal (R$)")}
        {campo("trimestral", "Trimestral (R$)")}
        {campo("semestral", "Semestral (R$)")}
        {campo("anual", "Anual (R$)")}
      </div>
      {campo("anuncios_max", "Limite de anúncios no ar", "Vazio = sem limite.")}
      <div className="grid gap-1.5">
        <Label htmlFor="pl-descricao">Descrição</Label>
        <Textarea
          id="pl-descricao"
          rows={3}
          maxLength={500}
          className="text-base sm:text-sm"
          value={f.descricao}
          onChange={(e) => setF((v) => ({ ...v, descricao: e.target.value }))}
        />
      </div>
      <div className="space-y-3 rounded-xl border border-border/70 p-3">
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
          Vende o mensal
          <Switch
            checked={f.vende_mensal}
            onCheckedChange={(c) => setF((v) => ({ ...v, vende_mensal: c }))}
          />
        </label>
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
          Plano à venda
          <Switch checked={f.ativo} onCheckedChange={(c) => setF((v) => ({ ...v, ativo: c }))} />
        </label>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 flex-1 sm:min-h-10"
          onClick={onFechar}
        >
          Cancelar
        </Button>
        <Button type="submit" className="min-h-11 flex-1 sm:min-h-10" disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

function EditarProdutoLoja({
  produto,
  onFechar,
}: {
  produto: ProdutoLojaImobMatch | null;
  onFechar: () => void;
}) {
  return (
    <Sheet open={!!produto} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {produto && <FormProdutoLoja key={produto.id} produto={produto} onFechar={onFechar} />}
      </SheetContent>
    </Sheet>
  );
}

function FormProdutoLoja({
  produto,
  onFechar,
}: {
  produto: ProdutoLojaImobMatch;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(salvarProdutoLojaImobMatch);
  const [f, setF] = useState({
    produto_id: produto.produto_id,
    plano_base: produto.plano_base ?? "",
    preco: paraTexto(produto.preco),
    ativo: produto.ativo,
  });
  const salvar = useMutation({
    mutationFn: () => {
      const preco = paraNumero(f.preco);
      if (Number.isNaN(preco)) throw new Error("Confira o preço: use números como 197 ou 197,00.");
      return fn({
        data: {
          id: produto.id,
          produto_id: f.produto_id,
          plano_base: f.plano_base,
          preco,
          ativo: f.ativo,
        },
      });
    },
    onSuccess: () => {
      toast.success("Produto da loja salvo.");
      void qc.invalidateQueries({ queryKey: CHAVE });
      onFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar o produto da loja.")),
  });
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      <SheetHeader>
        <SheetTitle>
          {produto.loja === "apple" ? "App Store" : "Google Play"} · {produto.plano}
        </SheetTitle>
        <SheetDescription>
          O preço é o cadastrado na loja (para conferência). O código precisa ser igual ao da loja.
        </SheetDescription>
      </SheetHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="lj-produto">Código do produto na loja</Label>
        <Input
          id="lj-produto"
          className="h-11 font-mono text-base sm:h-10 sm:text-sm"
          value={f.produto_id}
          onChange={(e) => setF((v) => ({ ...v, produto_id: e.target.value }))}
        />
      </div>
      {produto.loja === "google" && (
        <div className="grid gap-1.5">
          <Label htmlFor="lj-base">Plano base (Google Play)</Label>
          <Input
            id="lj-base"
            className="h-11 font-mono text-base sm:h-10 sm:text-sm"
            value={f.plano_base}
            onChange={(e) => setF((v) => ({ ...v, plano_base: e.target.value }))}
          />
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="lj-preco">Preço na loja (R$)</Label>
        <Input
          id="lj-preco"
          inputMode="decimal"
          className="h-11 text-base sm:h-10 sm:text-sm"
          value={f.preco}
          onChange={(e) => setF((v) => ({ ...v, preco: e.target.value }))}
        />
        {produto.preco_site != null && (
          <p className="text-xs text-muted-foreground">
            No site, o mesmo período custa {moeda(produto.preco_site)}.
          </p>
        )}
      </div>
      <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border/70 px-3 text-sm">
        À venda no aplicativo
        <Switch checked={f.ativo} onCheckedChange={(c) => setF((v) => ({ ...v, ativo: c }))} />
      </label>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 flex-1 sm:min-h-10"
          onClick={onFechar}
        >
          Cancelar
        </Button>
        <Button type="submit" className="min-h-11 flex-1 sm:min-h-10" disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
