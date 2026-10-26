import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, Landmark, Pencil, Plus, Settings2, SlidersHorizontal, Tags, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { executarOuFalhar, invalidarFinanceiro } from "@/lib/financeiro/cliente";
import { GRUPOS_GATILHOS_COMISSAO, rotuloGatilho } from "@/lib/financeiro/comissoes-gatilhos";
import type { Cadastros, Parametros, RegraBanco, RegraParticipante } from "@/lib/financeiro/tipos";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/simulacao/currency-input";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { Carregando, Chip, Erro, PaginaFin, Vazio, dataBR, moeda, pct } from "@/components/financeiro/matriz/base";
import { MenuAcoes, SecaoCartao, useCadastros } from "@/components/financeiro/matriz/comuns";
import { DialogoMotivo } from "@/components/financeiro/matriz/dialogos";
import { PAPEIS } from "@/components/financeiro/matriz/demonstrativo";

export const Route = createFileRoute("/_authenticated/financeiro/configuracoes")({
  head: () => ({ meta: [{ title: "Regras e configurações — Financeiro — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.regras", ["financeiro.painel", "financeiro.comissoes", "financeiro.comissoes_bancos"]),
  component: Pagina,
});

const BASES: Record<string, string> = { valor_financiado: "Valor financiado", valor_contrato: "Valor do contrato", comissao_banco: "Comissão do banco" };

function Pagina() {
  const cad = useCadastros();
  return (
    <PaginaFin
      titulo="Regras e configurações"
      descricao="Regras de comissão (a cópia da regra fica em cada lançamento: mudar aqui não recalcula o que já existe), cadastros e parâmetros do financeiro."
      icone={SlidersHorizontal}
    >
      {cad.isLoading ? (
        <Carregando />
      ) : cad.error ? (
        <Erro erro={cad.error} onTentar={() => cad.refetch()} />
      ) : cad.data ? (
        <Tabs defaultValue="bancos" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="bancos" className="gap-1.5">
              <Landmark className="h-4 w-4" /> Bancos
            </TabsTrigger>
            <TabsTrigger value="participantes" className="gap-1.5">
              <UserRoundCheck className="h-4 w-4" /> Corretores e parceiros
            </TabsTrigger>
            <TabsTrigger value="cadastros" className="gap-1.5">
              <Tags className="h-4 w-4" /> Cadastros
            </TabsTrigger>
            <TabsTrigger value="parametros" className="gap-1.5">
              <Settings2 className="h-4 w-4" /> Parâmetros
            </TabsTrigger>
          </TabsList>
          <TabsContent value="bancos">
            <RegrasBanco regras={cad.data.regras_banco} bancos={cad.data.bancos} produtos={cad.data.produtos} />
          </TabsContent>
          <TabsContent value="participantes">
            <RegrasParticipantes cad={cad.data} />
          </TabsContent>
          <TabsContent value="cadastros">
            <CadastrosAba cad={cad.data} />
          </TabsContent>
          <TabsContent value="parametros">
            <ParametrosAba p={cad.data.parametros} />
          </TabsContent>
        </Tabs>
      ) : null}
      <p className="text-xs text-muted-foreground">
        As regras do repasse aos assinantes (0,25% padrão e percentual próprio por conta) ficam em{" "}
        <Link to="/financeiro/repasses" className="text-primary hover:underline">
          Repasses aos assinantes
        </Link>
        .
      </p>
    </PaginaFin>
  );
}

function RegrasBanco({ regras, bancos, produtos }: { regras: RegraBanco[] | null; bancos: string[]; produtos: string[] }) {
  const qc = useQueryClient();
  const pode = usePermissao("financeiro.comissoes_bancos", "regras");
  const [editar, setEditar] = useState<RegraBanco | "nova" | null>(null);
  const [encerrar, setEncerrar] = useState<RegraBanco | null>(null);
  if (!regras) return <Vazio titulo="Sem acesso às regras dos bancos" />;
  return (
    <SecaoCartao
      titulo="Comissão que cada banco paga"
      descricao="Gera a previsão no gatilho (contrato emitido/registrado). A regra mais específica (produto, banco, faixa) vence."
      acoes={
        pode && (
          <Button size="sm" className="gap-1.5" onClick={() => setEditar("nova")}>
            <Plus className="h-4 w-4" /> Nova regra
          </Button>
        )
      }
    >
      {regras.length === 0 ? (
        <Vazio titulo="Nenhuma regra cadastrada" descricao="Sem regra, a previsão nasce com valor zero e aparece como “sem regra” para você informar." />
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {regras.map((r) => (
            <li key={r.id} className={`flex items-center gap-3 rounded-xl border p-3 ${r.ativo ? "border-border/70" : "border-dashed opacity-60"}`}>
              <BancoLogo nome={r.banco_nome} size="lg" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">
                  {r.banco_nome ?? "Qualquer banco"} · {r.produto ?? "qualquer produto"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.tipo === "percentual" ? pct(r.valor, 4) : moeda(r.valor)} · faixa {moeda(r.faixa_min)} a {r.faixa_max != null ? moeda(r.faixa_max) : "sem teto"}
                  {r.vigencia_inicio || r.vigencia_fim ? ` · ${dataBR(r.vigencia_inicio)} a ${dataBR(r.vigencia_fim)}` : ""}
                </p>
              </div>
              {!r.ativo && <Chip def={{ rotulo: "Encerrada", tom: "neutro" }} />}
              {pode && r.ativo && (
                <MenuAcoes
                  itens={[
                    { rotulo: "Editar", icone: Pencil, onClick: () => setEditar(r) },
                    { rotulo: "Encerrar", icone: Ban, perigo: true, onClick: () => setEncerrar(r) },
                  ]}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <FormRegraBanco regra={editar} onFechar={() => setEditar(null)} bancos={bancos} produtos={produtos} />
      <DialogoMotivo
        aberto={!!encerrar}
        titulo="Encerrar regra"
        descricao="Deixa de gerar previsões a partir de hoje. As já geradas não mudam."
        onFechar={() => setEncerrar(null)}
        onConfirmar={async (motivo) => {
          await executarOuFalhar("regraEncerrar", { _tipo: "banco", _id: encerrar!.id, _motivo: motivo });
          toast.success("Regra encerrada.");
          await invalidarFinanceiro(qc);
        }}
      />
    </SecaoCartao>
  );
}

function FormRegraBanco({ regra, onFechar, bancos, produtos }: { regra: RegraBanco | "nova" | null; onFechar: () => void; bancos: string[]; produtos: string[] }) {
  const qc = useQueryClient();
  const r = regra && regra !== "nova" ? regra : null;
  const [chave, setChave] = useState<string | null>(null);
  const [f, setF] = useState({ banco: "", produto: "", tipo: "percentual", valor: "", fixo: 0, min: 0, max: 0, inicio: "", fim: "" });
  const [enviando, setEnviando] = useState(false);
  const atual = regra ? (r?.id ?? "nova") : null;
  if (atual !== chave) {
    setChave(atual);
    setF({
      banco: r?.banco_nome ?? "",
      produto: r?.produto ?? "",
      tipo: r?.tipo ?? "percentual",
      valor: r && r.tipo === "percentual" ? String(r.valor).replace(".", ",") : "",
      fixo: r && r.tipo === "fixo" ? r.valor : 0,
      min: r?.faixa_min ?? 0,
      max: r?.faixa_max ?? 0,
      inicio: r?.vigencia_inicio ?? "",
      fim: r?.vigencia_fim ?? "",
    });
  }
  return (
    <Dialog open={!!regra} onOpenChange={(o) => !o && !enviando && onFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{r ? "Editar regra do banco" : "Nova regra do banco"}</DialogTitle>
          <DialogDescription>Vale para as próximas previsões. As já geradas guardam a regra que usaram.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Banco (vazio = todos)</Label>
            <Input value={f.banco} onChange={(e) => setF({ ...f, banco: e.target.value })} list="fin-bancos-regra" />
            <datalist id="fin-bancos-regra">
              {bancos.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Produto (vazio = todos)</Label>
            <Input value={f.produto} onChange={(e) => setF({ ...f, produto: e.target.value })} list="fin-produtos-regra" />
            <datalist id="fin-produtos-regra">
              {produtos.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentual">Percentual do financiado</SelectItem>
                <SelectItem value="fixo">Valor fixo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{f.tipo === "percentual" ? "Percentual (%)" : "Valor"}</Label>
            {f.tipo === "percentual" ? (
              <Input inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} placeholder="1,20" />
            ) : (
              <CurrencyInput value={f.fixo} onChange={(v) => setF({ ...f, fixo: v })} />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Faixa mínima (financiado)</Label>
            <CurrencyInput value={f.min} onChange={(v) => setF({ ...f, min: v })} mostrarZero />
          </div>
          <div className="space-y-1.5">
            <Label>Faixa máxima (vazio = sem teto)</Label>
            <CurrencyInput value={f.max} onChange={(v) => setF({ ...f, max: v })} />
          </div>
          <div className="space-y-1.5">
            <Label>Vigência — início</Label>
            <Input type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Vigência — fim</Label>
            <Input type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onFechar} disabled={enviando}>
            Voltar
          </Button>
          <Button
            disabled={enviando || (f.tipo === "percentual" ? !f.valor : f.fixo <= 0)}
            onClick={async () => {
              setEnviando(true);
              try {
                await executarOuFalhar("regraBanco", {
                  _d: {
                    id: r?.id ?? null,
                    banco_nome: f.banco || null,
                    produto: f.produto || null,
                    tipo: f.tipo,
                    valor: f.tipo === "percentual" ? Number(f.valor.replace(",", ".")) : f.fixo,
                    faixa_min: f.min,
                    faixa_max: f.max > 0 ? f.max : null,
                    vigencia_inicio: f.inicio || null,
                    vigencia_fim: f.fim || null,
                  },
                });
                toast.success("Regra gravada.");
                await invalidarFinanceiro(qc);
                onFechar();
              } catch (e) {
                toast.error(mensagemDeErro(e, "Não foi possível gravar."));
              } finally {
                setEnviando(false);
              }
            }}
          >
            Gravar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RegrasParticipantes({ cad }: { cad: Cadastros }) {
  const qc = useQueryClient();
  const pode = usePermissao("financeiro.comissoes", "regras");
  const [editar, setEditar] = useState<RegraParticipante | "nova" | null>(null);
  const [encerrar, setEncerrar] = useState<RegraParticipante | null>(null);
  const regras = cad.regras_participantes;
  if (!regras) return <Vazio titulo="Sem acesso às regras de corretores e parceiros" />;
  return (
    <SecaoCartao
      titulo="Regras de corretores e parceiros"
      descricao="Regra da pessoa (prevalece) ou regra geral do papel (originou, atendeu, participou). Percentual ou fixo, sobre a base escolhida, na etapa do gatilho."
      acoes={
        pode && (
          <Button size="sm" className="gap-1.5" onClick={() => setEditar("nova")}>
            <Plus className="h-4 w-4" /> Nova regra
          </Button>
        )
      }
    >
      {regras.length === 0 ? (
        <Vazio titulo="Nenhuma regra cadastrada" />
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {regras.map((r) => (
            <li key={r.id} className={`flex items-start gap-3 rounded-xl border p-3 ${r.ativo ? "border-border/70" : "border-dashed opacity-60"}`}>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">
                  {r.pessoa ?? `Todos que ${r.papel ? PAPEIS[r.papel].toLowerCase() : ""}`}
                  {r.papel && r.pessoa ? ` · ${PAPEIS[r.papel]}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.tipo_valor === "fixo" ? moeda(r.valor_fixo) : `${pct(r.percentual, 4)} de ${BASES[r.base_calculo] ?? r.base_calculo}`} · {rotuloGatilho(r.gatilho)}
                  {r.banco_nome ? ` · ${r.banco_nome}` : ""}
                  {r.produto ? ` · ${r.produto}` : ""}
                  {r.exige_recebimento_banco ? " · só após o banco pagar" : ""}
                </p>
                {(r.vigencia_inicio || r.vigencia_fim) && (
                  <p className="text-[11px] text-muted-foreground">
                    Vigência {dataBR(r.vigencia_inicio)} a {dataBR(r.vigencia_fim)}
                  </p>
                )}
              </div>
              {!r.ativo && <Chip def={{ rotulo: "Encerrada", tom: "neutro" }} />}
              {pode && r.ativo && (
                <MenuAcoes
                  itens={[
                    { rotulo: "Editar", icone: Pencil, onClick: () => setEditar(r) },
                    { rotulo: "Encerrar", icone: Ban, perigo: true, onClick: () => setEncerrar(r) },
                  ]}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <FormRegraParticipante regra={editar} onFechar={() => setEditar(null)} cad={cad} />
      <DialogoMotivo
        aberto={!!encerrar}
        titulo="Encerrar regra"
        descricao="Para de gerar comissões a partir de hoje. Os lançamentos já feitos ficam como estão (nada é apagado)."
        onFechar={() => setEncerrar(null)}
        onConfirmar={async (motivo) => {
          await executarOuFalhar("regraEncerrar", { _tipo: "participante", _id: encerrar!.id, _motivo: motivo });
          toast.success("Regra encerrada.");
          await invalidarFinanceiro(qc);
        }}
      />
    </SecaoCartao>
  );
}

function FormRegraParticipante({ regra, onFechar, cad }: { regra: RegraParticipante | "nova" | null; onFechar: () => void; cad: Cadastros }) {
  const qc = useQueryClient();
  const r = regra && regra !== "nova" ? regra : null;
  const [chave, setChave] = useState<string | null>(null);
  const vazio = {
    pessoa: "",
    papel: "",
    gatilho: "contrato_emitido",
    base: "valor_financiado",
    tipo: "percentual",
    percentual: "",
    fixo: 0,
    banco: "",
    produto: "",
    inicio: "",
    fim: "",
    exige: false,
  };
  const [f, setF] = useState(vazio);
  const [enviando, setEnviando] = useState(false);
  const atual = regra ? (r?.id ?? "nova") : null;
  if (atual !== chave) {
    setChave(atual);
    setF(
      r
        ? {
            pessoa: r.usuario_id ?? "",
            papel: r.papel ?? "",
            gatilho: r.gatilho,
            base: r.base_calculo,
            tipo: r.tipo_valor,
            percentual: String(r.percentual).replace(".", ","),
            fixo: r.valor_fixo ?? 0,
            banco: r.banco_nome ?? "",
            produto: r.produto ?? "",
            inicio: r.vigencia_inicio ?? "",
            fim: r.vigencia_fim ?? "",
            exige: r.exige_recebimento_banco,
          }
        : vazio,
    );
  }
  const valido = (f.pessoa || f.papel) && (f.tipo === "percentual" ? !!f.percentual : f.fixo > 0);
  return (
    <Dialog open={!!regra} onOpenChange={(o) => !o && !enviando && onFechar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{r ? "Editar regra" : "Nova regra de corretor/parceiro"}</DialogTitle>
          <DialogDescription>Sem pessoa = regra geral do papel (vale para quem não tem regra própria).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Pessoa</Label>
            <Select value={f.pessoa || "_"} onValueChange={(v) => setF({ ...f, pessoa: v === "_" ? "" : v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_">Regra geral do papel</SelectItem>
                {(cad.pessoas ?? [])
                  .filter((p) => p.ativo)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Papel</Label>
            <Select value={f.papel || "_"} onValueChange={(v) => setF({ ...f, papel: v === "_" ? "" : v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_">Qualquer papel</SelectItem>
                {Object.entries(PAPEIS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Gatilho (etapa da proposta)</Label>
            <Select value={f.gatilho} onValueChange={(v) => setF({ ...f, gatilho: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRUPOS_GATILHOS_COMISSAO.map((g) => (
                  <SelectGroup key={g.titulo}>
                    <SelectLabel>{g.titulo}</SelectLabel>
                    {g.itens
                      .filter((i) => i.valor !== "manual")
                      .map((i) => (
                        <SelectItem key={i.valor} value={i.valor}>
                          {i.rotulo}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                ))}
                <SelectGroup>
                  <SelectLabel>Cartório</SelectLabel>
                  <SelectItem value="registrado">Contrato registrado</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentual">Percentual</SelectItem>
                <SelectItem value="fixo">Valor fixo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {f.tipo === "percentual" ? (
            <div className="space-y-1.5">
              <Label>Percentual (%)</Label>
              <Input inputMode="decimal" value={f.percentual} onChange={(e) => setF({ ...f, percentual: e.target.value })} placeholder="0,50" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <CurrencyInput value={f.fixo} onChange={(v) => setF({ ...f, fixo: v })} />
            </div>
          )}
          {f.tipo === "percentual" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Base</Label>
              <Select value={f.base} onValueChange={(v) => setF({ ...f, base: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BASES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Banco (vazio = todos)</Label>
            <Input value={f.banco} onChange={(e) => setF({ ...f, banco: e.target.value })} list="fin-bancos-part" />
            <datalist id="fin-bancos-part">
              {cad.bancos.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Produto (vazio = todos)</Label>
            <Input value={f.produto} onChange={(e) => setF({ ...f, produto: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Vigência — início</Label>
            <Input type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Vigência — fim</Label>
            <Input type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2 text-sm sm:col-span-2">
            <span>Só fica pronta para pagar depois que o banco pagar a comissão</span>
            <Switch checked={f.exige || f.base === "comissao_banco"} disabled={f.base === "comissao_banco"} onCheckedChange={(v) => setF({ ...f, exige: v })} />
          </label>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onFechar} disabled={enviando}>
            Voltar
          </Button>
          <Button
            disabled={!valido || enviando}
            onClick={async () => {
              setEnviando(true);
              try {
                await executarOuFalhar("regraParticipante", {
                  _d: {
                    id: r?.id ?? null,
                    usuario_id: f.pessoa || null,
                    papel: f.papel || null,
                    gatilho: f.gatilho,
                    base_calculo: f.base,
                    tipo_valor: f.tipo,
                    percentual: f.tipo === "percentual" ? Number(f.percentual.replace(",", ".")) : 0,
                    valor_fixo: f.tipo === "fixo" ? f.fixo : null,
                    banco_nome: f.banco || null,
                    produto: f.produto || null,
                    vigencia_inicio: f.inicio || null,
                    vigencia_fim: f.fim || null,
                    exige_recebimento_banco: f.exige,
                  },
                });
                toast.success("Regra gravada.");
                await invalidarFinanceiro(qc);
                onFechar();
              } catch (e) {
                toast.error(mensagemDeErro(e, "Não foi possível gravar."));
              } finally {
                setEnviando(false);
              }
            }}
          >
            Gravar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Entidade = "categoria" | "centro" | "forma" | "conta_bancaria" | "fornecedor";
const ENTIDADES: { chave: Entidade; rotulo: string; lista: (c: Cadastros) => { id: string; nome: string; ativo: boolean; extra?: string }[] }[] = [
  { chave: "categoria", rotulo: "Categorias", lista: (c) => c.categorias.map((x) => ({ id: x.id, nome: x.nome, ativo: x.ativo, extra: x.tipo === "receita" ? "Receita" : "Despesa" })) },
  { chave: "centro", rotulo: "Centros de custo", lista: (c) => c.centros },
  { chave: "forma", rotulo: "Formas de pagamento", lista: (c) => c.formas },
  {
    chave: "conta_bancaria",
    rotulo: "Contas bancárias",
    lista: (c) => c.contas_bancarias.map((x) => ({ id: x.id, nome: x.apelido, ativo: x.ativo, extra: [x.banco_nome, x.agencia, x.conta].filter(Boolean).join(" · ") })),
  },
  { chave: "fornecedor", rotulo: "Fornecedores", lista: (c) => (c.fornecedores ?? []).map((x) => ({ id: x.id, nome: x.nome, ativo: x.ativo, extra: x.documento ?? "" })) },
];

function CadastrosAba({ cad }: { cad: Cadastros }) {
  const pode = usePermissao("financeiro.regras", "edit");
  const [form, setForm] = useState<{ entidade: Entidade; item: Record<string, unknown> | null } | null>(null);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {ENTIDADES.map((e) => {
        const lista = e.lista(cad);
        return (
          <SecaoCartao
            key={e.chave}
            titulo={e.rotulo}
            acoes={
              pode && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setForm({ entidade: e.chave, item: null })}>
                  <Plus className="h-4 w-4" /> Novo
                </Button>
              )
            }
          >
            {lista.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum cadastro.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {lista.map((x) => (
                  <li key={x.id} className={`flex items-center justify-between gap-2 py-2 text-sm ${x.ativo ? "" : "opacity-50"}`}>
                    <span className="min-w-0">
                      <span className="block truncate">{x.nome}</span>
                      {x.extra && <span className="text-[11px] text-muted-foreground">{x.extra}</span>}
                    </span>
                    {pode && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label="Editar"
                        onClick={() => {
                          const bruto =
                            e.chave === "conta_bancaria"
                              ? cad.contas_bancarias.find((c) => c.id === x.id)
                              : e.chave === "fornecedor"
                                ? cad.fornecedores?.find((c) => c.id === x.id)
                                : (e.chave === "categoria" ? cad.categorias : e.chave === "centro" ? cad.centros : cad.formas).find((c) => c.id === x.id);
                          setForm({ entidade: e.chave, item: (bruto ?? null) as Record<string, unknown> | null });
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SecaoCartao>
        );
      })}
      <FormCadastro form={form} onFechar={() => setForm(null)} categorias={cad.categorias} />
    </div>
  );
}

function FormCadastro({
  form,
  onFechar,
  categorias,
}: {
  form: { entidade: Entidade; item: Record<string, unknown> | null } | null;
  onFechar: () => void;
  categorias: Cadastros["categorias"];
}) {
  const qc = useQueryClient();
  const [chave, setChave] = useState<string | null>(null);
  const [d, setD] = useState<Record<string, string | boolean>>({});
  const [enviando, setEnviando] = useState(false);
  const atual = form ? `${form.entidade}:${String(form.item?.id ?? "novo")}` : null;
  if (atual !== chave) {
    setChave(atual);
    const it = form?.item ?? {};
    setD({
      nome: String(it.nome ?? it.apelido ?? ""),
      tipo: String(it.tipo ?? "despesa"),
      banco_codigo: String(it.banco_codigo ?? ""),
      banco_nome: String(it.banco_nome ?? ""),
      agencia: String(it.agencia ?? ""),
      conta: String(it.conta ?? ""),
      documento: String(it.documento ?? ""),
      email: String(it.email ?? ""),
      telefone: String(it.telefone ?? ""),
      categoria_id: String(it.categoria_id ?? ""),
      ativo: it.ativo === undefined ? true : Boolean(it.ativo),
    });
  }
  const e = form?.entidade;
  const campo = (k: string, rotulo: string, extra?: Partial<React.ComponentProps<typeof Input>>) => (
    <div className="space-y-1.5">
      <Label>{rotulo}</Label>
      <Input value={String(d[k] ?? "")} onChange={(ev) => setD({ ...d, [k]: ev.target.value })} {...extra} />
    </div>
  );
  return (
    <Dialog open={!!form} onOpenChange={(o) => !o && !enviando && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{form?.item ? "Editar cadastro" : "Novo cadastro"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {campo("nome", e === "conta_bancaria" ? "Apelido da conta" : "Nome", { maxLength: 160 })}
          {e === "categoria" && (
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={String(d.tipo)} onValueChange={(v) => setD({ ...d, tipo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {e === "conta_bancaria" && (
            <div className="grid grid-cols-2 gap-3">
              {campo("banco_codigo", "Código do banco", { maxLength: 3, inputMode: "numeric", placeholder: "341" })}
              {campo("banco_nome", "Banco")}
              {campo("agencia", "Agência", { maxLength: 10 })}
              {campo("conta", "Conta", { maxLength: 20 })}
            </div>
          )}
          {e === "fornecedor" && (
            <>
              {campo("documento", "CPF/CNPJ (só números)", { inputMode: "numeric", maxLength: 18 })}
              <div className="grid grid-cols-2 gap-3">
                {campo("email", "E-mail")}
                {campo("telefone", "Telefone")}
              </div>
              <div className="space-y-1.5">
                <Label>Categoria padrão</Label>
                <Select value={String(d.categoria_id) || "_"} onValueChange={(v) => setD({ ...d, categoria_id: v === "_" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">Nenhuma</SelectItem>
                    {categorias
                      .filter((c) => c.tipo !== "receita")
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <label className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-sm">
            Ativo
            <Switch checked={Boolean(d.ativo)} onCheckedChange={(v) => setD({ ...d, ativo: v })} />
          </label>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onFechar} disabled={enviando}>
            Voltar
          </Button>
          <Button
            disabled={enviando || String(d.nome ?? "").trim().length < 2}
            onClick={async () => {
              setEnviando(true);
              try {
                await executarOuFalhar("cadastro", {
                  _entidade: e,
                  _d: { ...d, id: form?.item?.id ?? null, apelido: d.nome, documento: String(d.documento ?? "").replace(/\D/g, "") },
                });
                toast.success("Cadastro salvo.");
                await invalidarFinanceiro(qc);
                onFechar();
              } catch (err) {
                toast.error(mensagemDeErro(err, "Não foi possível salvar."));
              } finally {
                setEnviando(false);
              }
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ParametrosAba({ p }: { p: Parametros }) {
  const qc = useQueryClient();
  const pode = usePermissao("financeiro.regras", "edit");
  const [f, setF] = useState({
    gatilho_comissao_banco: p.gatilho_comissao_banco,
    dias_previsao_recebimento: String(p.dias_previsao_recebimento),
    dias_vencimento_comissao: String(p.dias_vencimento_comissao),
    tolerancia_divergencia: String(p.tolerancia_divergencia).replace(".", ","),
    dias_janela_conciliacao: String(p.dias_janela_conciliacao),
  });
  const [enviando, setEnviando] = useState(false);
  return (
    <SecaoCartao titulo="Parâmetros do financeiro" descricao="Nada fixo no código: prazos, tolerâncias e o gatilho da previsão do banco.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Previsão da comissão do banco nasce em</Label>
          <Select
            value={f.gatilho_comissao_banco}
            onValueChange={(v) => setF({ ...f, gatilho_comissao_banco: v as Parametros["gatilho_comissao_banco"] })}
            disabled={!pode}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contrato_emitido">Contrato emitido</SelectItem>
              <SelectItem value="registrado">Contrato registrado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Dias até a previsão de recebimento</Label>
          <Input type="number" min={0} max={365} value={f.dias_previsao_recebimento} disabled={!pode} onChange={(e) => setF({ ...f, dias_previsao_recebimento: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Dias até o vencimento das comissões</Label>
          <Input type="number" min={0} max={365} value={f.dias_vencimento_comissao} disabled={!pode} onChange={(e) => setF({ ...f, dias_vencimento_comissao: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Tolerância de diferença (R$)</Label>
          <Input inputMode="decimal" value={f.tolerancia_divergencia} disabled={!pode} onChange={(e) => setF({ ...f, tolerancia_divergencia: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Janela da conciliação (± dias)</Label>
          <Input type="number" min={0} max={30} value={f.dias_janela_conciliacao} disabled={!pode} onChange={(e) => setF({ ...f, dias_janela_conciliacao: e.target.value })} />
        </div>
      </div>
      {pode && (
        <div className="mt-4 flex justify-end">
          <Button
            disabled={enviando}
            onClick={async () => {
              setEnviando(true);
              try {
                await executarOuFalhar("parametros", {
                  _d: {
                    gatilho_comissao_banco: f.gatilho_comissao_banco,
                    dias_previsao_recebimento: Number(f.dias_previsao_recebimento),
                    dias_vencimento_comissao: Number(f.dias_vencimento_comissao),
                    tolerancia_divergencia: Number(f.tolerancia_divergencia.replace(",", ".")),
                    dias_janela_conciliacao: Number(f.dias_janela_conciliacao),
                  },
                });
                toast.success("Parâmetros salvos.");
                await invalidarFinanceiro(qc);
              } catch (e) {
                toast.error(mensagemDeErro(e, "Não foi possível salvar."));
              } finally {
                setEnviando(false);
              }
            }}
          >
            Salvar parâmetros
          </Button>
        </div>
      )}
    </SecaoCartao>
  );
}
