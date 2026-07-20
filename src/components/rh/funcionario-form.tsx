import { useState } from "react";
import { z } from "zod";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  criarFuncionario,
  atualizarFuncionario,
  type Funcionario,
  type FuncionarioInput,
  type StatusFuncionario,
  type TipoContrato,
} from "@/lib/rh/funcionarios.functions";
import {
  listarCargos,
  listarDepartamentos,
} from "@/lib/rh/cargos-departamentos.functions";
import { OPCOES_UF } from "@/components/crm/cliente-form/constants";

const STATUS_LABEL: Record<StatusFuncionario, string> = {
  ativo: "Ativo",
  experiencia: "Em experiência",
  afastado: "Afastado",
  ferias: "Em férias",
  desligado: "Desligado",
};

const CONTRATO_LABEL: Record<TipoContrato, string> = {
  clt: "CLT",
  pj: "PJ",
  estagio: "Estágio",
  autonomo: "Autônomo",
  temporario: "Temporário",
  aprendiz: "Aprendiz",
};

function toEmpty<T extends string | number | null | undefined>(v: T): string {
  return v === null || v === undefined ? "" : String(v);
}

/** Formulário completo do funcionário (usado em Novo e Editar). */
export function FuncionarioForm({ inicial }: { inicial?: Funcionario | null }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const criar = useServerFn(criarFuncionario);
  const atualizar = useServerFn(atualizarFuncionario);
  const fnCargos = useServerFn(listarCargos);
  const fnDeptos = useServerFn(listarDepartamentos);

  const cargos = useQuery({ queryKey: ["rh-cargos"], queryFn: () => fnCargos() });
  const deptos = useQuery({ queryKey: ["rh-departamentos"], queryFn: () => fnDeptos() });

  const [erros, setErros] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState("pessoal");
  const [f, setF] = useState<FuncionarioInput & { salario_atual_str: string }>(() => ({
    id: inicial?.id,
    nome: inicial?.nome ?? "",
    nome_social: inicial?.nome_social ?? "",
    cpf: inicial?.cpf ?? "",
    rg: inicial?.rg ?? "",
    rg_orgao: inicial?.rg_orgao ?? "",
    rg_uf: inicial?.rg_uf ?? "",
    data_nascimento: inicial?.data_nascimento ?? "",
    sexo: inicial?.sexo ?? "",
    estado_civil: inicial?.estado_civil ?? "",
    nacionalidade: inicial?.nacionalidade ?? "Brasileira",
    naturalidade: inicial?.naturalidade ?? "",
    nome_mae: inicial?.nome_mae ?? "",
    nome_pai: inicial?.nome_pai ?? "",
    email_pessoal: inicial?.email_pessoal ?? "",
    telefone: inicial?.telefone ?? "",
    cep: inicial?.cep ?? "",
    logradouro: inicial?.logradouro ?? "",
    numero_endereco: inicial?.numero_endereco ?? "",
    complemento: inicial?.complemento ?? "",
    bairro: inicial?.bairro ?? "",
    cidade: inicial?.cidade ?? "",
    uf: inicial?.uf ?? "",
    cargo_id: inicial?.cargo_id ?? null,
    departamento_id: inicial?.departamento_id ?? null,
    gestor_id: inicial?.gestor_id ?? null,
    tipo_contrato: inicial?.tipo_contrato ?? "clt",
    status: inicial?.status ?? "experiencia",
    matricula: inicial?.matricula ?? "",
    ctps_numero: inicial?.ctps_numero ?? "",
    ctps_serie: inicial?.ctps_serie ?? "",
    ctps_uf: inicial?.ctps_uf ?? "",
    pis: inicial?.pis ?? "",
    data_admissao: inicial?.data_admissao ?? "",
    fim_experiencia: inicial?.fim_experiencia ?? "",
    data_demissao: inicial?.data_demissao ?? "",
    motivo_demissao: inicial?.motivo_demissao ?? "",
    jornada_horas_semanais: inicial?.jornada_horas_semanais ?? 44,
    jornada_descricao: inicial?.jornada_descricao ?? "Segunda a sexta, 8h às 18h",
    email_corporativo: inicial?.email_corporativo ?? "",
    salario_atual: Number(inicial?.salario_atual ?? 0),
    salario_atual_str: toEmpty(inicial?.salario_atual ?? ""),
    salario_desde: inicial?.salario_desde ?? "",
    banco_nome: inicial?.banco_nome ?? "",
    banco_agencia: inicial?.banco_agencia ?? "",
    banco_conta: inicial?.banco_conta ?? "",
    banco_tipo_conta: inicial?.banco_tipo_conta ?? "corrente",
    banco_pix: inicial?.banco_pix ?? "",
    observacoes: inicial?.observacoes ?? "",
  }));

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const mut = useMutation({
    mutationFn: async (payload: FuncionarioInput) => {
      if (payload.id) {
        await atualizar({ data: payload as never });
        return payload.id;
      }
      const res = await criar({ data: payload });
      return res.id;
    },
    onSuccess: (id) => {
      toast.success("Funcionário salvo.");
      qc.invalidateQueries({ queryKey: ["rh-funcionarios"] });
      qc.invalidateQueries({ queryKey: ["rh-kpis"] });
      navigate({ to: "/rh/funcionarios/$id", params: { id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  function validar(): boolean {
    const req = new Set<string>();
    if (!f.nome.trim()) req.add("nome");
    if (f.cpf.replace(/\D/g, "").length < 11) req.add("cpf");
    if (!f.data_admissao) req.add("data_admissao");
    setErros(req);
    if (req.size > 0) {
      toast.error("Preencha os campos obrigatórios.");
      setTab(req.has("data_admissao") ? "profissional" : "pessoal");
      return false;
    }
    return true;
  }

  function salvar() {
    if (!validar()) return;
    const payload: FuncionarioInput = {
      ...f,
      salario_atual: Number(f.salario_atual_str.replace(/[^0-9,]/g, "").replace(",", ".") || 0),
    };
    delete (payload as any).salario_atual_str;
    mut.mutate(payload);
  }

  const errClass = (k: string) =>
    erros.has(k) ? "border-destructive ring-1 ring-destructive/40" : undefined;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            onClick={() => navigate({ to: "/rh/funcionarios" })}
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </button>
          <h1 className="text-xl font-semibold text-foreground md:text-2xl">
            {inicial ? `Editar · ${inicial.nome}` : "Novo funcionário"}
          </h1>
          {inicial?.numero && (
            <p className="text-xs text-muted-foreground">Nº {inicial.numero}</p>
          )}
        </div>
        <Button onClick={salvar} disabled={mut.isPending}>
          {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="pessoal">Dados pessoais</TabsTrigger>
          <TabsTrigger value="endereco">Endereço</TabsTrigger>
          <TabsTrigger value="profissional">Profissional</TabsTrigger>
          <TabsTrigger value="bancario">Bancário</TabsTrigger>
        </TabsList>

        <TabsContent value="pessoal" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identificação</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label>
                  Nome completo <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={f.nome}
                  onChange={(e) => set("nome", e.target.value)}
                  className={errClass("nome")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nome social</Label>
                <Input value={f.nome_social ?? ""} onChange={(e) => set("nome_social", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>
                  CPF <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={f.cpf}
                  onChange={(e) => set("cpf", e.target.value)}
                  className={errClass("cpf")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>RG</Label>
                <Input value={f.rg ?? ""} onChange={(e) => set("rg", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Órgão emissor</Label>
                <Input value={f.rg_orgao ?? ""} onChange={(e) => set("rg_orgao", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de nascimento</Label>
                <Input
                  type="date"
                  value={f.data_nascimento ?? ""}
                  onChange={(e) => set("data_nascimento", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sexo</Label>
                <Select value={f.sexo ?? ""} onValueChange={(v) => set("sexo", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estado civil</Label>
                <Input value={f.estado_civil ?? ""} onChange={(e) => set("estado_civil", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Nacionalidade</Label>
                <Input value={f.nacionalidade ?? ""} onChange={(e) => set("nacionalidade", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Naturalidade</Label>
                <Input value={f.naturalidade ?? ""} onChange={(e) => set("naturalidade", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Nome da mãe</Label>
                <Input value={f.nome_mae ?? ""} onChange={(e) => set("nome_mae", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Nome do pai</Label>
                <Input value={f.nome_pai ?? ""} onChange={(e) => set("nome_pai", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail pessoal</Label>
                <Input
                  type="email"
                  value={f.email_pessoal ?? ""}
                  onChange={(e) => set("email_pessoal", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={f.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endereco" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Endereço residencial</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>CEP</Label>
                <Input value={f.cep ?? ""} onChange={(e) => set("cep", e.target.value)} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Logradouro</Label>
                <Input value={f.logradouro ?? ""} onChange={(e) => set("logradouro", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Número</Label>
                <Input value={f.numero_endereco ?? ""} onChange={(e) => set("numero_endereco", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Complemento</Label>
                <Input value={f.complemento ?? ""} onChange={(e) => set("complemento", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Bairro</Label>
                <Input value={f.bairro ?? ""} onChange={(e) => set("bairro", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input value={f.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>UF</Label>
                <Select value={f.uf ?? ""} onValueChange={(v) => set("uf", v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {OPCOES_UF.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profissional" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contrato e vínculo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={f.status}
                  onValueChange={(v) => set("status", v as StatusFuncionario)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as StatusFuncionario[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de contrato</Label>
                <Select
                  value={f.tipo_contrato}
                  onValueChange={(v) => set("tipo_contrato", v as TipoContrato)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CONTRATO_LABEL) as TipoContrato[]).map((t) => (
                      <SelectItem key={t} value={t}>{CONTRATO_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Select
                  value={f.cargo_id ?? ""}
                  onValueChange={(v) => set("cargo_id", v || null)}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {(cargos.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Departamento</Label>
                <Select
                  value={f.departamento_id ?? ""}
                  onValueChange={(v) => set("departamento_id", v || null)}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {(deptos.data ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Data de admissão <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={f.data_admissao}
                  onChange={(e) => set("data_admissao", e.target.value)}
                  className={errClass("data_admissao")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fim da experiência</Label>
                <Input
                  type="date"
                  value={f.fim_experiencia ?? ""}
                  onChange={(e) => set("fim_experiencia", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Matrícula interna</Label>
                <Input value={f.matricula ?? ""} onChange={(e) => set("matricula", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>CTPS nº</Label>
                <Input value={f.ctps_numero ?? ""} onChange={(e) => set("ctps_numero", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>CTPS série</Label>
                <Input value={f.ctps_serie ?? ""} onChange={(e) => set("ctps_serie", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>PIS</Label>
                <Input value={f.pis ?? ""} onChange={(e) => set("pis", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Jornada (h/semana)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={f.jornada_horas_semanais ?? ""}
                  onChange={(e) => set("jornada_horas_semanais", e.target.value ? Number(e.target.value) : null)}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Descrição da jornada</Label>
                <Input value={f.jornada_descricao ?? ""} onChange={(e) => set("jornada_descricao", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail corporativo</Label>
                <Input
                  type="email"
                  value={f.email_corporativo ?? ""}
                  onChange={(e) => set("email_corporativo", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Salário atual (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={f.salario_atual_str}
                  onChange={(e) => setF((p) => ({ ...p, salario_atual_str: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Salário vigente desde</Label>
                <Input
                  type="date"
                  value={f.salario_desde ?? ""}
                  onChange={(e) => set("salario_desde", e.target.value)}
                />
              </div>
              <div className="space-y-1.5 md:col-span-3">
                <Label>Observações</Label>
                <Textarea
                  rows={3}
                  value={f.observacoes ?? ""}
                  onChange={(e) => set("observacoes", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bancario" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados bancários para folha</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Banco</Label>
                <Input value={f.banco_nome ?? ""} onChange={(e) => set("banco_nome", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Agência</Label>
                <Input value={f.banco_agencia ?? ""} onChange={(e) => set("banco_agencia", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Conta</Label>
                <Input value={f.banco_conta ?? ""} onChange={(e) => set("banco_conta", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de conta</Label>
                <Select
                  value={f.banco_tipo_conta ?? "corrente"}
                  onValueChange={(v) => set("banco_tipo_conta", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                    <SelectItem value="salario">Salário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Chave Pix</Label>
                <Input value={f.banco_pix ?? ""} onChange={(e) => set("banco_pix", e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// util reserved for future validation extensions
export const _schemaGuard = z.any();
