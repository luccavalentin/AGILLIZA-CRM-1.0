import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { criarCliente, atualizarCliente, salvarEndereco } from "@/lib/crm/clientes.functions";
import { validarDocumento, soDigitos } from "@/lib/crm/documento";

export interface ClienteFormValues {
  id?: string;
  tipo_pessoa: "PF" | "PJ";
  nome: string;
  documento: string;
  documento_secundario: string;
  data_nascimento: string;
  estado_civil: string;
  regime_casamento: string;
  mae: string;
  email: string;
  telefone_celular: string;
  renda_total_declarada: string;
  uf_interesse: string;
  origem: string;
}

const ESTADOS_CIVIS = [
  { v: "solteiro", l: "Solteiro(a)" },
  { v: "casado", l: "Casado(a)" },
  { v: "uniao_estavel", l: "União estável" },
  { v: "divorciado", l: "Divorciado(a)" },
  { v: "viuvo", l: "Viúvo(a)" },
];

const REGIMES = [
  { v: "comunhao_parcial", l: "Comunhão parcial" },
  { v: "comunhao_universal", l: "Comunhão universal" },
  { v: "separacao_total", l: "Separação total" },
  { v: "participacao_final", l: "Participação final" },
  { v: "nao_aplicavel", l: "Não aplicável" },
];

// Exibe um número no formato R$ pt-BR (ex.: 20000 -> "20.000,00").
function formatarMoedaBR(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Aplica máscara de moeda enquanto o usuário digita (tratando os dígitos como centavos).
function mascararMoedaBR(raw: string): string {
  const digitos = raw.replace(/\D/g, "");
  if (!digitos) return "";
  return formatarMoedaBR(parseInt(digitos, 10) / 100);
}

const emptyValues: ClienteFormValues = {
  tipo_pessoa: "PF",
  nome: "",
  documento: "",
  documento_secundario: "",
  data_nascimento: "",
  estado_civil: "solteiro",
  regime_casamento: "",
  mae: "",
  email: "",
  telefone_celular: "",
  renda_total_declarada: "",
  uf_interesse: "",
  origem: "direto",
};

export function ClienteForm({
  inicial,
  portalAtivo,
  enderecoInicial,
}: {
  inicial?: Partial<ClienteFormValues>;
  portalAtivo?: boolean;
  enderecoInicial?: { cep?: string; logradouro?: string; numero?: string; bairro?: string; cidade?: string; uf?: string } | null;
}) {
  const navigate = useNavigate();
  const criar = useServerFn(criarCliente);
  const atualizar = useServerFn(atualizarCliente);
  const salvarEnd = useServerFn(salvarEndereco);

  const [v, setV] = useState<ClienteFormValues>(() => {
    const base = { ...emptyValues, ...inicial };
    // Formata a renda inicial (vinda como número cru) para exibição em R$.
    if (base.renda_total_declarada) {
      const n = Number(base.renda_total_declarada);
      if (!isNaN(n)) base.renda_total_declarada = formatarMoedaBR(n);
    }
    return base;
  });
  const [end, setEnd] = useState({
    cep: enderecoInicial?.cep ?? "",
    logradouro: enderecoInicial?.logradouro ?? "",
    numero: enderecoInicial?.numero ?? "",
    bairro: enderecoInicial?.bairro ?? "",
    cidade: enderecoInicial?.cidade ?? "",
    uf: enderecoInicial?.uf ?? "",
  });
  const [portal, setPortal] = useState(Boolean(portalAtivo));
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const set = <K extends keyof ClienteFormValues>(k: K, val: ClienteFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  // Busca automática do endereço pelo CEP (ViaCEP) — apenas visual/preenchimento.
  async function buscarCep(cepRaw: string) {
    const cep = cepRaw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const dados = await resp.json();
      if (dados?.erro) {
        toast.error("CEP não encontrado.");
        return;
      }
      setEnd((p) => ({
        ...p,
        logradouro: dados.logradouro || p.logradouro,
        bairro: dados.bairro || p.bairro,
        cidade: dados.localidade || p.cidade,
        uf: dados.uf || p.uf,
      }));
    } catch {
      toast.error("Não foi possível consultar o CEP.");
    } finally {
      setBuscandoCep(false);
    }
  }

  function mascararCep(raw: string) {
    const d = raw.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.nome.trim()) return toast.error("Informe o nome.");
    if (!validarDocumento(v.documento, v.tipo_pessoa)) return toast.error("Documento inválido.");
    if (!v.data_nascimento) return toast.error("Informe a data.");
    if (!v.email.includes("@")) return toast.error("E-mail inválido.");
    if (soDigitos(v.telefone_celular).length < 10) return toast.error("Celular inválido.");
    const renda = Number(v.renda_total_declarada.replace(/\./g, "").replace(",", "."));
    if (isNaN(renda) || renda < 0) return toast.error("Renda inválida.");

    setSalvando(true);
    try {
      const payload = {
        tipo_pessoa: v.tipo_pessoa,
        nome: v.nome.trim(),
        documento: soDigitos(v.documento),
        documento_secundario: v.documento_secundario || null,
        data_nascimento: v.data_nascimento,
        estado_civil: v.estado_civil as any,
        regime_casamento: (v.regime_casamento || null) as any,
        mae: v.mae || null,
        email: v.email.trim(),
        telefone_celular: soDigitos(v.telefone_celular),
        renda_total_declarada: renda,
        uf_interesse: v.uf_interesse || null,
        origem: v.origem as any,
      };
      let id = v.id;
      if (id) {
        await atualizar({ data: { id, ...payload } });
      } else {
        const r = await criar({ data: payload });
        id = r.id;
      }
      if (id && (end.cep || end.logradouro)) {
        await salvarEnd({ data: { cliente_id: id, ...end } });
      }
      toast.success("Cliente salvo.");
      navigate({ to: "/crm/clientes/$id", params: { id: id! } });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acesso ao Portal do Cliente</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            O login do cliente em /portal é por documento + data de nascimento. Nenhuma senha é criada.
          </div>
          <div className="flex items-center gap-2">
            <Switch id="portal" checked={portal} onCheckedChange={setPortal} disabled={!v.id} />
            <Label htmlFor="portal">Habilitar acesso</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados básicos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Tipo de pessoa</Label>
            <Select value={v.tipo_pessoa} onValueChange={(x) => set("tipo_pessoa", x as "PF" | "PJ")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PF">Pessoa Física</SelectItem>
                <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{v.tipo_pessoa === "PF" ? "CPF *" : "CNPJ *"}</Label>
            <Input value={v.documento} onChange={(e) => set("documento", e.target.value)} placeholder="Somente números" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{v.tipo_pessoa === "PF" ? "Nome completo *" : "Razão social *"}</Label>
            <Input value={v.nome} onChange={(e) => set("nome", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{v.tipo_pessoa === "PF" ? "Data de nascimento *" : "Data de abertura *"}</Label>
            <Input type="date" value={v.data_nascimento} onChange={(e) => set("data_nascimento", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Estado civil *</Label>
            <Select value={v.estado_civil} onValueChange={(x) => set("estado_civil", x)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADOS_CIVIS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(v.estado_civil === "casado" || v.estado_civil === "uniao_estavel") && (
            <div className="space-y-1.5">
              <Label>Regime de casamento</Label>
              <Select value={v.regime_casamento} onValueChange={(x) => set("regime_casamento", x)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {REGIMES.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Nome da mãe</Label>
            <Input value={v.mae} onChange={(e) => set("mae", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail *</Label>
            <Input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Celular *</Label>
            <Input value={v.telefone_celular} onChange={(e) => set("telefone_celular", e.target.value)} placeholder="(11) 99999-9999" />
          </div>
          <div className="space-y-1.5">
            <Label>Renda total declarada (R$) *</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <Input
                inputMode="numeric"
                className="pl-9"
                value={v.renda_total_declarada}
                onChange={(e) => set("renda_total_declarada", mascararMoedaBR(e.target.value))}
                placeholder="0,00"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>UF de interesse</Label>
            <Input maxLength={2} value={v.uf_interesse} onChange={(e) => set("uf_interesse", e.target.value.toUpperCase())} placeholder="SP" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endereço</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>CEP</Label>
            <Input value={end.cep} onChange={(e) => setEnd((p) => ({ ...p, cep: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Logradouro</Label>
            <Input value={end.logradouro} onChange={(e) => setEnd((p) => ({ ...p, logradouro: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Número</Label>
            <Input value={end.numero} onChange={(e) => setEnd((p) => ({ ...p, numero: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Bairro</Label>
            <Input value={end.bairro} onChange={(e) => setEnd((p) => ({ ...p, bairro: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <Input value={end.cidade} onChange={(e) => setEnd((p) => ({ ...p, cidade: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>UF</Label>
            <Input maxLength={2} value={end.uf} onChange={(e) => setEnd((p) => ({ ...p, uf: e.target.value.toUpperCase() }))} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/crm/clientes" })}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar cliente"}
        </Button>
      </div>
    </form>
  );
}
