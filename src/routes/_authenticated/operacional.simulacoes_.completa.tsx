import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/simulacao/currency-input";
import { ConsultandoOverlay } from "@/components/simulacao/consultando-overlay";
import {
  completaSchema, ESTADOS_CIVIS, TIPOS_IMOVEL, USOS_IMOVEL, SITUACOES_IMOVEL, PRODUTOS,
} from "@/lib/simulacao/schemas";
import { UFS, maskCpfCnpj, maskCelular } from "@/lib/simulacao/format";
import { listarBancosAtivos, listarOperacoes, criarSimulacao, enviarSimulacaoBanco } from "@/lib/simulacao/simulacoes.functions";

export const Route = createFileRoute("/_authenticated/operacional/simulacoes_/completa")({
  head: () => ({ meta: [{ title: "Simulação personalizada — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.simulacoes"),
  component: Pagina,
});

type Form = Record<string, any>;

function Pagina() {
  const router = useRouter();
  const [f, setF] = useState<Form>({
    produto: "financiamento_imobiliario",
    tipo_imovel: "", uso_imovel: "", situacao_imovel: "", uf: "",
    valor_imovel: 0, valor_entrada: 0, valor_financiamento: 0, prazo: 360,
    utiliza_fgts: "N", sistema_amortizacao: "S",
    nome_cliente: "", cpf_cnpj: "", renda_total: 0, data_nascimento: "",
    estado_civil: "", email: "", celular: "",
    possui_conjuge: false, compoe_renda: false,
    bancos_ids: [] as string[],
    consentimento_lgpd: false, consentimento_scr: false,
    email_verificado_em: null,
  });
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});

  const { data: bancos } = useQuery({ queryKey: ["bancos-ativos"], queryFn: () => listarBancosAtivos() });
  const { data: operacoes } = useQuery({ queryKey: ["operacoes"], queryFn: () => listarOperacoes() });

  // pré-preenche do wizard
  useEffect(() => {
    const raw = sessionStorage.getItem("simulacao_wizard");
    if (raw) {
      try {
        const w = JSON.parse(raw);
        setF((prev) => ({ ...prev, ...w }));
      } catch { /* ignore */ }
    }
  }, []);

  // default bancos padrão
  useEffect(() => {
    if (bancos && f.bancos_ids.length === 0) {
      const padrao = bancos.filter((b) => b.flag_padrao).map((b) => b.id);
      if (padrao.length > 0) setF((prev) => ({ ...prev, bancos_ids: padrao }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bancos]);

  const idOperacao = useMemo(() => {
    const op = operacoes?.find((o) => o.produto_sistema === f.produto);
    return op?.id_operacao ?? null;
  }, [operacoes, f.produto]);

  function set(k: string, v: any) {
    setF((prev) => {
      const next = { ...prev, [k]: v };
      if (k === "valor_imovel" || k === "valor_entrada") next.valor_financiamento = Math.max(0, next.valor_imovel - next.valor_entrada);
      if (k === "estado_civil") next.possui_conjuge = v === "CA" || v === "UE";
      return next;
    });
  }

  function toggleBanco(id: string) {
    setF((prev) => {
      const has = prev.bancos_ids.includes(id);
      return { ...prev, bancos_ids: has ? prev.bancos_ids.filter((x: string) => x !== id) : [...prev.bancos_ids, id] };
    });
  }

  const mostraConjuge = f.possui_conjuge || f.compoe_renda;

  async function enviar() {
    const parsed = completaSchema.safeParse({ ...f, id_operacao_homefin: idOperacao });
    if (!parsed.success) {
      const novos: Record<string, string> = {};
      for (const issue of parsed.error.issues) novos[String(issue.path[0])] = issue.message;
      setErros(novos);
      toast.error("Revise os campos destacados.");
      return;
    }
    setErros({});
    setEnviando(true);
    try {
      const { id } = await criarSimulacao({
        data: { modo: "completa", dados: { ...parsed.data, id_operacao_homefin: idOperacao, email_verificado_em: f.email_verificado_em } as any },
      });
      sessionStorage.removeItem("simulacao_wizard");
      try {
        await enviarSimulacaoBanco({ data: { simulacao_id: id } });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao enviar ao banco. Você pode reenviar na tela da simulação.");
      }
      router.navigate({ to: "/operacional/simulacoes/$id", params: { id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a simulação.");
      setEnviando(false);
    }
  }

  const err = (k: string) => erros[k] && <p className="text-xs text-destructive">{erros[k]}</p>;
  const Ast = () => <span className="text-destructive">*</span>;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-semibold text-primary">Solicitar Simulação Personalizada</h1>
        <p className="text-sm text-muted-foreground">Preencha os dados para enviar aos bancos parceiros.</p>
      </div>

      {/* Bloco 1 — Operação/Imóvel */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Operação e imóvel</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Campo label={<>Produto <Ast /></>}>
            <Select value={f.produto} onValueChange={(v) => set("produto", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRODUTOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </Campo>
          <Campo label={<>Tipo de imóvel <Ast /></>}>
            <Select value={f.tipo_imovel} onValueChange={(v) => set("tipo_imovel", v)}>
              <SelectTrigger aria-invalid={!!erros.tipo_imovel}><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{TIPOS_IMOVEL.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
            {err("tipo_imovel")}
          </Campo>
          <Campo label={<>Uso do imóvel <Ast /></>}>
            <Select value={f.uso_imovel} onValueChange={(v) => set("uso_imovel", v)}>
              <SelectTrigger aria-invalid={!!erros.uso_imovel}><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{USOS_IMOVEL.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
            {err("uso_imovel")}
          </Campo>
          <Campo label={<>Situação do imóvel <Ast /></>}>
            <Select value={f.situacao_imovel} onValueChange={(v) => set("situacao_imovel", v)}>
              <SelectTrigger aria-invalid={!!erros.situacao_imovel}><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{SITUACOES_IMOVEL.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
            {err("situacao_imovel")}
          </Campo>
          <Campo label={<>UF <Ast /></>}>
            <Select value={f.uf} onValueChange={(v) => set("uf", v)}>
              <SelectTrigger aria-invalid={!!erros.uf}><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
            {err("uf")}
          </Campo>
        </div>
        <Separator className="border-border/60" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Campo label={<>Valor do imóvel (R$) <Ast /></>}>
            <CurrencyInput value={f.valor_imovel} onChange={(v) => set("valor_imovel", v)} placeholder="Ex: 500.000,00" />
            {err("valor_imovel")}
          </Campo>
          <Campo label={<>Valor de entrada (R$) <Ast /></>}>
            <CurrencyInput value={f.valor_entrada} onChange={(v) => set("valor_entrada", v)} placeholder="Ex: 100.000,00" />
          </Campo>
          <Campo label={<>Prazo (meses) <Ast /></>}>
            <Input type="number" min={60} max={420} value={f.prazo || ""} onChange={(e) => set("prazo", Number(e.target.value))} aria-invalid={!!erros.prazo} />
            {err("prazo")}
          </Campo>
          <Campo label={<>Utiliza FGTS? <Ast /></>}>
            <Select value={f.utiliza_fgts} onValueChange={(v) => set("utiliza_fgts", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent><SelectItem value="S">Sim</SelectItem><SelectItem value="N">Não</SelectItem></SelectContent>
            </Select>
          </Campo>
          <Campo label={<>Sistema de amortização <Ast /></>}>
            <Select value={f.sistema_amortizacao} onValueChange={(v) => set("sistema_amortizacao", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent><SelectItem value="S">SAC</SelectItem><SelectItem value="P">PRICE</SelectItem></SelectContent>
            </Select>
          </Campo>
        </div>
      </section>

      <Separator className="border-border/60" />

      {/* Bloco 2 — Titular */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Titular</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Campo label={<>Nome <Ast /></>}>
            <Input value={f.nome_cliente} onChange={(e) => set("nome_cliente", e.target.value)} aria-invalid={!!erros.nome_cliente} />
            {err("nome_cliente")}
          </Campo>
          <Campo label={<>CPF/CNPJ <Ast /></>}>
            <Input value={f.cpf_cnpj} onChange={(e) => set("cpf_cnpj", maskCpfCnpj(e.target.value))} placeholder="Apenas números" aria-invalid={!!erros.cpf_cnpj} />
            {err("cpf_cnpj")}
          </Campo>
          <Campo label={<>Renda total (R$) <Ast /></>}>
            <CurrencyInput value={f.renda_total} onChange={(v) => set("renda_total", v)} placeholder="Ex: 9.500,00" />
            {err("renda_total")}
          </Campo>
          <Campo label={<>Data de nascimento <Ast /></>}>
            <Input type="date" value={f.data_nascimento} onChange={(e) => set("data_nascimento", e.target.value)} aria-invalid={!!erros.data_nascimento} />
            {err("data_nascimento")}
          </Campo>
          <Campo label={<>Estado civil <Ast /></>}>
            <Select value={f.estado_civil} onValueChange={(v) => set("estado_civil", v)}>
              <SelectTrigger aria-invalid={!!erros.estado_civil}><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{ESTADOS_CIVIS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
            {err("estado_civil")}
          </Campo>
          <Campo label={<>E-mail <Ast /></>}>
            <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} readOnly={!!f.email_verificado_em} aria-invalid={!!erros.email} />
            {err("email")}
          </Campo>
          <Campo label={<>Celular <Ast /></>}>
            <Input value={f.celular} onChange={(e) => set("celular", maskCelular(e.target.value))} placeholder="(11) 99999-9999" aria-invalid={!!erros.celular} />
            {err("celular")}
          </Campo>
          <Campo label="Composição de renda">
            <label className="flex items-center gap-2 pt-2 text-sm">
              <Checkbox checked={f.compoe_renda} onCheckedChange={(c) => set("compoe_renda", Boolean(c))} />
              Incluir cônjuge/coobrigado na renda
            </label>
          </Campo>
        </div>
      </section>

      {/* Bloco 3 — Cônjuge */}
      {mostraConjuge && (
        <>
          <Separator className="border-border/60" />
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Cônjuge / coobrigado</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Campo label="Nome"><Input value={f.nome_conjuge ?? ""} onChange={(e) => set("nome_conjuge", e.target.value)} /></Campo>
              <Campo label="CPF/CNPJ"><Input value={f.cpf_conjuge ?? ""} onChange={(e) => set("cpf_conjuge", maskCpfCnpj(e.target.value))} /></Campo>
              <Campo label="Renda (R$)"><CurrencyInput value={f.renda_conjuge ?? 0} onChange={(v) => set("renda_conjuge", v)} /></Campo>
              <Campo label="Data de nascimento"><Input type="date" value={f.data_nascimento_conjuge ?? ""} onChange={(e) => set("data_nascimento_conjuge", e.target.value)} /></Campo>
              <Campo label="E-mail"><Input type="email" value={f.email_conjuge ?? ""} onChange={(e) => set("email_conjuge", e.target.value)} /></Campo>
              <Campo label="Celular"><Input value={f.celular_conjuge ?? ""} onChange={(e) => set("celular_conjuge", maskCelular(e.target.value))} /></Campo>
            </div>
          </section>
        </>
      )}

      <Separator className="border-border/60" />

      {/* Bloco 4 — Bancos */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Bancos</h2>
        {(!bancos || bancos.length === 0) ? (
          <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
            Nenhum banco habilitado — abra Configurações → Bancos para ativar.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {bancos.map((b) => (
              <label key={b.id} className="flex items-center gap-2 rounded-md border border-border bg-card p-3 text-sm">
                <Checkbox checked={f.bancos_ids.includes(b.id)} onCheckedChange={() => toggleBanco(b.id)} />
                {b.nome_banco}
              </label>
            ))}
          </div>
        )}
        {err("bancos_ids")}
      </section>

      <Separator className="border-border/60" />

      {/* Bloco 5 — Consentimentos */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Consentimentos</h2>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={f.consentimento_lgpd} onCheckedChange={(c) => set("consentimento_lgpd", Boolean(c))} />
          <span>Autorizo o tratamento dos meus dados pessoais conforme a LGPD para fins desta simulação e proposta.</span>
        </label>
        {err("consentimento_lgpd")}
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={f.consentimento_scr} onCheckedChange={(c) => set("consentimento_scr", Boolean(c))} />
          <span>Autorizo a consulta ao SCR/Bacen e o compartilhamento de dados com os bancos selecionados.</span>
        </label>
        {err("consentimento_scr")}
      </section>

      <div className="flex justify-end pt-2">
        <Button className="h-11 px-8" onClick={enviar} disabled={enviando}>Enviar solicitação</Button>
      </div>

      <ConsultandoOverlay aberto={enviando} total={f.bancos_ids.length} concluidos={0} />
    </div>
  );
}

function Campo({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
