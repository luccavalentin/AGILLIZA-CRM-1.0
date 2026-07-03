import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/simulacao/currency-input";
import { ToneBadge } from "@/components/crm/tone-badge";
import { PRODUTOS } from "@/lib/simulacao/schemas";
import { formatBRL, formatPercent } from "@/lib/simulacao/format";
import { listarBancosAtivos } from "@/lib/simulacao/simulacoes.functions";
import { enviarOtpEmail, validarOtpEmail } from "@/lib/simulacao/simulacoes.functions";
import { compararBancosRapido, taxaAnoDeBanco } from "@/lib/simulacao/simulacao-rapida";

export const Route = createFileRoute("/_authenticated/operacional/simulacoes_/nova")({
  head: () => ({ meta: [{ title: "Nova simulação — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.simulacoes"),
  component: Pagina,
});

interface WizardState {
  produto: "financiamento_imobiliario" | "home_equity";
  valor_imovel: number;
  valor_entrada: number;
  valor_financiamento: number;
  possui_imovel_escolhido: boolean | null;
  data_nascimento: string;
  prazo_anos: number;
}

function Pagina() {
  const router = useRouter();
  const [w, setW] = useState<WizardState>({
    produto: "financiamento_imobiliario",
    valor_imovel: 0,
    valor_entrada: 0,
    valor_financiamento: 0,
    possui_imovel_escolhido: null,
    data_nascimento: "",
    prazo_anos: 0,
  });
  const [mostrarRapida, setMostrarRapida] = useState(false);
  const [otpAberto, setOtpAberto] = useState(false);

  const { data: bancos } = useQuery({
    queryKey: ["bancos-ativos"],
    queryFn: () => listarBancosAtivos(),
  });

  function set<K extends keyof WizardState>(k: K, v: WizardState[K]) {
    setW((prev) => {
      const next = { ...prev, [k]: v };
      if (k === "valor_imovel" || k === "valor_entrada") {
        next.valor_financiamento = Math.max(0, next.valor_imovel - next.valor_entrada);
      }
      if (k === "valor_financiamento") {
        next.valor_entrada = Math.max(0, next.valor_imovel - next.valor_financiamento);
      }
      return next;
    });
  }

  const valido =
    w.valor_imovel > 0 && w.valor_financiamento > 0 && w.data_nascimento !== "" && w.prazo_anos > 0;

  const comparativo = useMemo(() => {
    if (!bancos || !mostrarRapida) return [];
    return compararBancosRapido(
      bancos.map((b) => ({
        banco_id: b.id,
        codigo_banco: b.codigo_banco,
        nome_banco: b.nome_banco,
        taxa_ano: taxaAnoDeBanco(b.codigo_banco),
      })),
      { valor_financiamento: w.valor_financiamento, prazo_meses: w.prazo_anos * 12, sistema: "S" },
    );
  }, [bancos, mostrarRapida, w.valor_financiamento, w.prazo_anos]);

  function irParaPersonalizada(email: string) {
    sessionStorage.setItem(
      "simulacao_wizard",
      JSON.stringify({ ...w, email, prazo: w.prazo_anos * 12, email_verificado_em: new Date().toISOString() }),
    );
    router.navigate({ to: "/operacional/simulacoes/completa" });
  }

  return (
    <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 md:grid-cols-2">
      {/* Coluna esquerda — hero */}
      <div className="hidden flex-col justify-between bg-muted p-10 md:flex">
        <Logo />
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">
            Trabalhamos com os maiores bancos do mercado
          </h2>
          <p className="max-w-sm text-muted-foreground">
            Simule em segundos e compare as melhores condições de financiamento imobiliário e home equity
            para o seu cliente.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Ambiente seguro · Dados protegidos (LGPD)</p>
      </div>

      {/* Coluna direita — wizard */}
      <div className="flex flex-col gap-5 p-6 md:p-10">
        <h1 className="text-lg font-semibold text-foreground">Simular financiamento</h1>

        <div className="space-y-1.5">
          <Label>Produto</Label>
          <Select value={w.produto} onValueChange={(v) => set("produto", v as WizardState["produto"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRODUTOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Valor do imóvel que deseja financiar <span className="text-destructive">*</span></Label>
          <CurrencyInput value={w.valor_imovel} onChange={(v) => set("valor_imovel", v)} placeholder="0,00" />
        </div>

        <div className="space-y-1.5">
          <Label>Valor da entrada <span className="text-destructive">*</span></Label>
          <CurrencyInput value={w.valor_entrada} onChange={(v) => set("valor_entrada", v)} placeholder="0,00" />
        </div>

        <div className="space-y-1.5">
          <Label>Valor do crédito que precisa <span className="text-destructive">*</span></Label>
          <CurrencyInput value={w.valor_financiamento} onChange={(v) => set("valor_financiamento", v)} placeholder="0,00" />
        </div>

        <div className="space-y-2">
          <Label>Você já possui o imóvel escolhido?</Label>
          <RadioGroup
            className="flex flex-col gap-2 sm:flex-row sm:gap-6"
            value={w.possui_imovel_escolhido == null ? "" : w.possui_imovel_escolhido ? "sim" : "nao"}
            onValueChange={(v) => set("possui_imovel_escolhido", v === "sim")}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="sim" id="pie-sim" />
              <Label htmlFor="pie-sim" className="font-normal">Sim, já tenho um imóvel escolhido</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="nao" id="pie-nao" />
              <Label htmlFor="pie-nao" className="font-normal">Não, ainda estou pesquisando</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Informe sua data de nascimento <span className="text-destructive">*</span></Label>
            <Input type="date" value={w.data_nascimento} onChange={(e) => set("data_nascimento", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Em quantos anos irá financiar <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              min={1}
              max={35}
              placeholder="0 anos"
              value={w.prazo_anos || ""}
              onChange={(e) => set("prazo_anos", Number(e.target.value))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
          <Button
            variant="secondary"
            className="h-12"
            disabled={!valido}
            onClick={() => setMostrarRapida(true)}
          >
            Simulação rápida
          </Button>
          <Button className="h-12" disabled={!valido} onClick={() => setOtpAberto(true)}>
            Simulação personalizada
          </Button>
        </div>

        {mostrarRapida && (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Comparativo estimado</h3>
              <span className="text-xs text-muted-foreground">Sistema SAC · {w.prazo_anos * 12} meses</span>
            </div>
            {comparativo.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum banco habilitado. Ative bancos em Configurações → Bancos.
              </p>
            )}
            <div className="space-y-2">
              {comparativo.map((c, i) => (
                <div
                  key={c.banco_id}
                  className="flex items-center justify-between rounded-md border border-border bg-card p-3"
                >
                  <div>
                    <p className="font-medium text-card-foreground">{c.nome_banco}</p>
                    <p className="text-xs text-muted-foreground">Taxa {formatPercent(c.taxa_ano)} a.a.</p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums font-semibold text-card-foreground">
                      {formatBRL(c.resultado.primeira_parcela)}
                    </p>
                    {i === 0 && <ToneBadge tone="success">Melhor taxa</ToneBadge>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <OtpDialog
        aberto={otpAberto}
        onClose={() => setOtpAberto(false)}
        onValidado={irParaPersonalizada}
      />
    </div>
  );
}

function OtpDialog({
  aberto,
  onClose,
  onValidado,
}: {
  aberto: boolean;
  onClose: () => void;
  onValidado: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function enviar() {
    if (!email) return;
    setCarregando(true);
    try {
      await enviarOtpEmail({ data: { email } });
      setEnviado(true);
      toast.success("Código enviado para o e-mail informado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar código.");
    } finally {
      setCarregando(false);
    }
  }

  async function validar() {
    setCarregando(true);
    try {
      await validarOtpEmail({ data: { email, codigo } });
      toast.success("E-mail verificado.");
      onValidado(email);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Código inválido.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-primary">Solicitar Simulação Personalizada</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>E-mail <span className="text-destructive">*</span></Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Código de verificação</Label>
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              disabled={!enviado}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="secondary" onClick={enviar} disabled={carregando || !email}>
            {enviado ? "Reenviar código" : "Enviar código"}
          </Button>
          <Button onClick={validar} disabled={carregando || !enviado || codigo.length !== 6}>
            Validar código
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
