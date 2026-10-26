import type React from "react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save, ArrowLeft, ArrowRight, Check, ChevronsUpDown, Lock } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  criarFuncionario,
  atualizarFuncionario,
  listarUsuariosVinculaveis,
  type Funcionario,
  type FuncionarioInput,
  type StatusFuncionario,
  type TipoContrato,
} from "@/lib/rh/funcionarios.functions";
import { listarCargos, listarCentrosCusto, listarDepartamentos } from "@/lib/rh/cargos-departamentos.functions";
import { usePermissao } from "@/hooks/use-permissao";
import { OPCOES_UF } from "@/components/crm/cliente-form/constants";
import { mascararCep, apenasDigitosCep, consultarCep } from "@/lib/cep";
import {
  mascararCPF,
  mascararTelefone,
  validarCPF,
  validarEmail,
  validarTelefone,
  validarPIS,
  soDigitos,
} from "@/lib/crm/documento";
import { InputAutocomplete } from "@/components/ui/input-autocomplete";
import { FuncionarioFoto } from "@/components/rh/funcionario-foto";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatarMoedaInput, parseMoeda } from "@/lib/rh/moeda";
import { CONTRATO_LABEL, STATUS_FUNCIONARIO_LABEL } from "@/lib/rh/rotulos";

const OPCOES_ORGAO_EMISSOR = [
  "SSP",
  "SSP/SP",
  "SSP/RJ",
  "SSP/MG",
  "SSP/RS",
  "SSP/PR",
  "SSP/SC",
  "SSP/BA",
  "SSP/PE",
  "SSP/CE",
  "SSP/GO",
  "SSP/DF",
  "SSP/ES",
  "SSP/PA",
  "SSP/AM",
  "DETRAN",
  "PC",
  "PM",
  "IFP",
  "IIRGD",
  "IGP",
  "PTC",
  "CNIG",
  "MRE",
  "MJ",
  "OAB",
  "CRM",
  "CREA",
  "CRC",
  "CRO",
  "CRP",
  "CRF",
  "COREN",
];

const OPCOES_NACIONALIDADE = [
  "Brasileira",
  "Portuguesa",
  "Argentina",
  "Uruguaia",
  "Paraguaia",
  "Chilena",
  "Boliviana",
  "Peruana",
  "Colombiana",
  "Venezuelana",
  "Equatoriana",
  "Espanhola",
  "Italiana",
  "Francesa",
  "Alemã",
  "Inglesa",
  "Americana",
  "Canadense",
  "Mexicana",
  "Japonesa",
  "Chinesa",
  "Coreana",
  "Angolana",
  "Moçambicana",
  "Cabo-verdiana",
  "Haitiana",
  "Outra",
];

const OPCOES_ESTADO_CIVIL = [
  { v: "solteiro", l: "Solteiro(a)" },
  { v: "casado", l: "Casado(a)" },
  { v: "divorciado", l: "Divorciado(a)" },
  { v: "separado", l: "Separado(a)" },
  { v: "viuvo", l: "Viúvo(a)" },
  { v: "uniao_estavel", l: "União estável" },
];

const STATUS_LABEL = STATUS_FUNCIONARIO_LABEL;

/** Classe padrão das abas da ficha (usada também pelas abas extras da página). */
export const ABA_CLASS =
  "shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:text-sm";

/** Etapas da admissão guiada (as abas do formulário viram passos). */
const ETAPAS_ADMISSAO = [
  { aba: "pessoal", rotulo: "Dados pessoais" },
  { aba: "endereco", rotulo: "Endereço" },
  { aba: "profissional", rotulo: "Contrato e cargo" },
  { aba: "bancario", rotulo: "Remuneração e banco" },
  { aba: "revisao", rotulo: "Revisão" },
] as const;

/** Formulário completo do funcionário: edição da ficha ou admissão guiada (modo "admissao"). */
export function FuncionarioForm({
  inicial,
  abasExtras,
  conteudoExtra,
  acoes,
  abaInicial,
  modo = "ficha",
}: {
  inicial?: Funcionario | null;
  /** Aba aberta ao entrar (ex.: "admissao" logo depois de admitir). */
  abaInicial?: string;
  modo?: "ficha" | "admissao";
  /** <TabsTrigger> adicionais renderizados na mesma barra de abas. */
  abasExtras?: React.ReactNode;
  /** <TabsContent> adicionais renderizados dentro do mesmo <Tabs>. */
  conteudoExtra?: React.ReactNode;
  /** Ações extras exibidas ao lado do botão Salvar. */
  acoes?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const criar = useServerFn(criarFuncionario);
  const atualizar = useServerFn(atualizarFuncionario);
  const fnCargos = useServerFn(listarCargos);
  const fnDeptos = useServerFn(listarDepartamentos);
  const fnUsuarios = useServerFn(listarUsuariosVinculaveis);

  const fnCentros = useServerFn(listarCentrosCusto);
  const cargos = useQuery({ queryKey: ["rh-cargos"], queryFn: () => fnCargos() });
  const centros = useQuery({ queryKey: ["rh-centros-custo"], queryFn: () => fnCentros() });
  // Salário e banco: ver exige RH · Salários · ver (a ficha só vem com eles assim);
  // alterar exige RH · Salários · alterar. O servidor e o banco conferem de novo.
  const podeEditarSalario = usePermissao("rh.salarios", "edit");
  const verSalario = inicial ? !!inicial.com_dados_sensiveis : podeEditarSalario;
  const admissao = modo === "admissao";
  const etapas = ETAPAS_ADMISSAO.filter((e) => e.aba !== "bancario" || podeEditarSalario);
  const deptos = useQuery({ queryKey: ["rh-departamentos"], queryFn: () => fnDeptos() });
  const usuarios = useQuery({
    queryKey: ["rh-usuarios-vinculaveis", inicial?.id ?? null],
    queryFn: () => fnUsuarios({ data: { funcionario_id: inicial?.id } }),
  });

  const [erros, setErros] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState(abaInicial ?? "pessoal");
  const [usuarioOpen, setUsuarioOpen] = useState(false);
  const [f, setF] = useState<FuncionarioInput & { salario_atual_str: string }>(() => ({
    id: inicial?.id,
    nome: inicial?.nome ?? "",
    nome_social: inicial?.nome_social ?? "",
    // Gravados só com dígitos: ao reabrir a ficha apareciam sem máscara.
    cpf: inicial?.cpf ? mascararCPF(inicial.cpf) : "",
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
    telefone: inicial?.telefone ? mascararTelefone(inicial.telefone) : "",
    cep: inicial?.cep ? mascararCep(inicial.cep) : "",
    logradouro: inicial?.logradouro ?? "",
    numero_endereco: inicial?.numero_endereco ?? "",
    complemento: inicial?.complemento ?? "",
    bairro: inicial?.bairro ?? "",
    cidade: inicial?.cidade ?? "",
    uf: inicial?.uf ?? "",
    cargo_id: inicial?.cargo_id ?? null,
    departamento_id: inicial?.departamento_id ?? null,
    gestor_id: inicial?.gestor_id ?? null,
    centro_custo_id: inicial?.centro_custo_id ?? null,
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
    salario_atual_str: formatarMoedaInput(inicial?.salario_atual ?? null),
    salario_desde: inicial?.salario_desde ?? "",
    banco_nome: inicial?.banco_nome ?? "",
    banco_agencia: inicial?.banco_agencia ?? "",
    banco_conta: inicial?.banco_conta ?? "",
    banco_tipo_conta: inicial?.banco_tipo_conta ?? "corrente",
    banco_pix: inicial?.banco_pix ?? "",
    observacoes: inicial?.observacoes ?? "",
    user_id: (inicial as any)?.user_id ?? null,
    dia_pagamento_salario: (inicial as any)?.dia_pagamento_salario ?? 5,
    dia_pagamento_adiantamento: (inicial as any)?.dia_pagamento_adiantamento ?? null,
    gerar_contas_pagar_automatico: (inicial as any)?.gerar_contas_pagar_automatico ?? true,
  }));

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const [buscandoCep, setBuscandoCep] = useState(false);
  async function buscarCep(raw: string) {
    if (apenasDigitosCep(raw).length !== 8) return;
    setBuscandoCep(true);
    try {
      const end = await consultarCep(raw);
      if (!end) {
        toast.error("CEP não encontrado.");
        return;
      }
      setF((p) => ({
        ...p,
        logradouro: p.logradouro || end.logradouro,
        bairro: p.bairro || end.bairro,
        cidade: p.cidade || end.cidade,
        uf: p.uf || end.uf,
      }));
    } catch {
      toast.error("Não foi possível consultar o CEP.");
    } finally {
      setBuscandoCep(false);
    }
  }

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
      toast.success(admissao ? "Admissão registrada. Agora, os documentos de admissão." : "Ficha salva.");
      qc.invalidateQueries({ queryKey: ["rh-funcionarios"] });
      qc.invalidateQueries({ queryKey: ["rh-funcionario", id] });
      qc.invalidateQueries({ queryKey: ["rh-kpis"] });
      navigate({
        to: "/rh/funcionarios/$id",
        params: { id },
        search: admissao ? { aba: "admissao" } : {},
      });
    },
    onError: (e: any) => toast.error(mensagemDeErro(e, "Falha ao salvar.")),
  });

  function validar(): boolean {
    const req = new Set<string>();
    if (!f.nome.trim()) req.add("nome");
    if (!validarCPF(f.cpf)) req.add("cpf");
    if (!f.data_admissao) req.add("data_admissao");
    if (f.email_pessoal && !validarEmail(f.email_pessoal)) req.add("email_pessoal");
    if (f.email_corporativo && !validarEmail(f.email_corporativo)) req.add("email_corporativo");
    if (f.telefone && !validarTelefone(f.telefone)) req.add("telefone");
    if (f.pis && !validarPIS(f.pis)) req.add("pis");
    setErros(req);
    if (req.size > 0) {
      const msg = req.has("nome")
        ? "Informe o nome do funcionário."
        : req.has("cpf")
          ? "CPF inválido."
          : req.has("data_admissao")
            ? "Informe a data de admissão."
            : req.has("email_pessoal") || req.has("email_corporativo")
              ? "E-mail inválido."
              : req.has("telefone")
                ? "Telefone inválido."
                : req.has("pis")
                  ? "PIS/PASEP inválido."
                  : "Verifique os campos destacados.";
      toast.error(msg);
      setTab(
        req.has("nome") || req.has("cpf") || req.has("email_pessoal") || req.has("telefone")
          ? "pessoal"
          : "profissional",
      );
      return false;
    }
    return true;
  }

  function salvar() {
    if (!validar()) return;
    const payload: FuncionarioInput = {
      ...f,
      cpf: soDigitos(f.cpf),
      telefone: f.telefone ? soDigitos(f.telefone) : f.telefone,
      salario_atual: parseMoeda(f.salario_atual_str),
    };
    delete (payload as any).salario_atual_str;
    // Sem permissão de alterar salário, salário e banco nem vão (o servidor também tira).
    if (!podeEditarSalario) {
      for (const k of ["salario_atual", "salario_desde", "banco_nome", "banco_agencia", "banco_conta", "banco_tipo_conta", "banco_pix"]) {
        delete (payload as any)[k];
      }
    }
    mut.mutate(payload);
  }

  /** Admissão guiada: confere a etapa antes de avançar. */
  function avancar() {
    const i = etapas.findIndex((e) => e.aba === tab);
    if (tab === "pessoal" && (!f.nome.trim() || !validarCPF(f.cpf))) {
      setErros(new Set([...(f.nome.trim() ? [] : ["nome"]), ...(validarCPF(f.cpf) ? [] : ["cpf"])]));
      toast.error(!f.nome.trim() ? "Informe o nome completo." : "CPF inválido.");
      return;
    }
    if (tab === "profissional" && !f.data_admissao) {
      setErros(new Set(["data_admissao"]));
      toast.error("Informe a data de admissão.");
      return;
    }
    if (i >= 0 && i < etapas.length - 1) setTab(etapas[i + 1].aba);
  }
  const indiceEtapa = Math.max(0, etapas.findIndex((e) => e.aba === tab));

  const errClass = (k: string) =>
    erros.has(k) ? "border-destructive ring-1 ring-destructive/40" : undefined;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-4 md:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          {inicial?.id && (
            <FuncionarioFoto
              funcionarioId={inicial.id}
              nome={inicial.nome}
              fotoPath={(inicial as any).foto_url ?? null}
            />
          )}
          <div className="min-w-0">
            <button
              onClick={() => navigate({ to: "/rh/funcionarios" })}
              className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </button>
            <h1 className="truncate text-lg font-semibold text-foreground sm:text-xl md:text-2xl">
              {inicial ? inicial.nome : "Admissão de colaborador"}
            </h1>
            {inicial?.numero && (
              <p className="text-xs text-muted-foreground">Nº {inicial.numero}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {acoes}
          {!admissao && (
            <Button onClick={salvar} disabled={mut.isPending}>
              {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          )}
        </div>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vincular a usuário do sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Popover open={usuarioOpen} onOpenChange={setUsuarioOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                className={cn(
                  "w-full justify-between bg-background font-normal",
                  !f.user_id && "text-muted-foreground",
                )}
              >
                <span className="truncate">
                  {(() => {
                    if (!f.user_id) return "Nenhum usuário vinculado — clique para escolher";
                    const u = (usuarios.data ?? []).find((x) => x.id === f.user_id);
                    if (u) return u.nome ?? u.email ?? "Usuário sem nome";
                    return usuarios.isLoading ? "Carregando…" : "Usuário vinculado";
                  })()}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command
                filter={(value, search) =>
                  value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                }
              >
                <CommandInput placeholder="Buscar por nome, e-mail ou iniciais…" />
                <CommandList>
                  <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="__nenhum__ sem vínculo"
                      onSelect={() => {
                        set("user_id", null);
                        setUsuarioOpen(false);
                      }}
                    >
                      <Check
                        className={cn("mr-2 h-4 w-4", !f.user_id ? "opacity-100" : "opacity-0")}
                      />
                      <span className="text-muted-foreground">Nenhum (sem vínculo)</span>
                    </CommandItem>
                    {(usuarios.data ?? []).map((u) => {
                      const label = u.nome ?? u.email ?? "Usuário sem nome";
                      const bloqueado = !!u.ja_vinculado_a;
                      return (
                        <CommandItem
                          key={u.id}
                          value={`${label} ${u.email ?? ""}`}
                          disabled={bloqueado}
                          onSelect={() => {
                            if (bloqueado) return;
                            setF((prev) => {
                              const next = { ...prev, user_id: u.id };
                              // Pré-cadastro: preenche automaticamente campos vazios com dados do usuário.
                              if (!prev.nome && u.nome) next.nome = u.nome;
                              if (!prev.cpf && u.documento) next.cpf = mascararCPF(u.documento);
                              if (!prev.telefone && u.telefone)
                                next.telefone = mascararTelefone(u.telefone);
                              if (!prev.email_corporativo && u.email)
                                next.email_corporativo = u.email;
                              return next;
                            });
                            toast.success("Dados do usuário aplicados aos campos vazios.");
                            setUsuarioOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              f.user_id === u.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{label}</span>
                            <span className="text-xs text-muted-foreground">
                              {u.email}
                              {bloqueado && " · já vinculado a outro funcionário"}
                            </span>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            Associa a ficha do funcionário a uma conta de acesso. Cada usuário só pode ser vinculado
            a um funcionário ativo.
          </p>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        {/* Barra única de navegação da ficha: cadastro + submódulos.
            Em telas pequenas rola horizontalmente; a partir de lg quebra em linhas. */}
        {admissao && (
          <ol className="mb-1 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {etapas.map((e, i) => (
              <li key={e.aba}>
                <button
                  type="button"
                  onClick={() => i < indiceEtapa && setTab(e.aba)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs sm:text-sm",
                    i === indiceEtapa
                      ? "border-primary/50 bg-primary/5 font-semibold text-primary"
                      : i < indiceEtapa
                        ? "border-primary/20 text-foreground"
                        : "border-border/60 text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                      i < indiceEtapa ? "bg-primary text-primary-foreground" : i === indiceEtapa ? "bg-primary/15 text-primary" : "bg-muted",
                    )}
                  >
                    {i < indiceEtapa ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className="truncate">{e.rotulo}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
        <div
          className={cn(
            "sticky top-0 z-20 -mx-3 bg-background/85 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:-mx-4 sm:px-4 md:-mx-6 md:px-6",
            admissao && "hidden",
          )}
        >
          <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border/60 bg-muted/50 p-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="pessoal" className={ABA_CLASS}>
              Dados pessoais
            </TabsTrigger>
            <TabsTrigger value="endereco" className={ABA_CLASS}>
              Endereço
            </TabsTrigger>
            <TabsTrigger value="profissional" className={ABA_CLASS}>
              Profissional
            </TabsTrigger>
            {verSalario && (
              <TabsTrigger value="bancario" className={ABA_CLASS}>
                Remuneração e banco
              </TabsTrigger>
            )}
            {abasExtras}
          </TabsList>
        </div>

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
                <Input
                  value={f.nome_social ?? ""}
                  onChange={(e) => set("nome_social", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  CPF <span className="text-destructive">*</span>
                </Label>
                <Input
                  inputMode="numeric"
                  maxLength={14}
                  placeholder="000.000.000-00"
                  value={f.cpf}
                  onChange={(e) => set("cpf", mascararCPF(e.target.value))}
                  className={errClass("cpf")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>RG</Label>
                <Input value={f.rg ?? ""} onChange={(e) => set("rg", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Órgão emissor</Label>
                <InputAutocomplete
                  value={f.rg_orgao ?? ""}
                  onValueChange={(v) => set("rg_orgao", v)}
                  options={OPCOES_ORGAO_EMISSOR}
                  placeholder="Digite ou selecione"
                  transform={(v) => v.toUpperCase()}
                />
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
                <Label>Gênero</Label>
                <Select value={f.sexo ?? ""} onValueChange={(v) => set("sexo", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estado civil</Label>
                <Select value={f.estado_civil ?? ""} onValueChange={(v) => set("estado_civil", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPCOES_ESTADO_CIVIL.map((o) => (
                      <SelectItem key={o.v} value={o.v}>
                        {o.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nacionalidade</Label>
                <InputAutocomplete
                  value={f.nacionalidade ?? ""}
                  onValueChange={(v) => set("nacionalidade", v)}
                  options={OPCOES_NACIONALIDADE}
                  placeholder="Digite ou selecione"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Naturalidade</Label>
                <Input
                  value={f.naturalidade ?? ""}
                  onChange={(e) => set("naturalidade", e.target.value)}
                />
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
                  inputMode="email"
                  placeholder="nome@exemplo.com"
                  value={f.email_pessoal ?? ""}
                  onChange={(e) => set("email_pessoal", e.target.value)}
                  className={errClass("email_pessoal")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  inputMode="tel"
                  maxLength={15}
                  placeholder="(00) 00000-0000"
                  value={f.telefone ?? ""}
                  onChange={(e) => set("telefone", mascararTelefone(e.target.value))}
                  className={errClass("telefone")}
                />
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
                <div className="relative">
                  <Input
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="00000-000"
                    value={f.cep ?? ""}
                    onChange={(e) => {
                      const m = mascararCep(e.target.value);
                      set("cep", m);
                      if (apenasDigitosCep(m).length === 8) buscarCep(m);
                    }}
                    onBlur={(e) => buscarCep(e.target.value)}
                  />
                  {buscandoCep && (
                    <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Logradouro</Label>
                <Input
                  value={f.logradouro ?? ""}
                  onChange={(e) => set("logradouro", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Número</Label>
                <Input
                  value={f.numero_endereco ?? ""}
                  onChange={(e) => set("numero_endereco", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Complemento</Label>
                <Input
                  value={f.complemento ?? ""}
                  onChange={(e) => set("complemento", e.target.value)}
                />
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
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPCOES_UF.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as StatusFuncionario[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CONTRATO_LABEL) as TipoContrato[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {CONTRATO_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Select value={f.cargo_id ?? ""} onValueChange={(v) => set("cargo_id", v || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {(cargos.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
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
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {(deptos.data ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome}
                      </SelectItem>
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
                <Input
                  value={f.matricula ?? ""}
                  onChange={(e) => set("matricula", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>CTPS nº</Label>
                <Input
                  inputMode="numeric"
                  maxLength={7}
                  value={f.ctps_numero ?? ""}
                  onChange={(e) => set("ctps_numero", soDigitos(e.target.value).slice(0, 7))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>CTPS série</Label>
                <Input
                  inputMode="numeric"
                  maxLength={5}
                  value={f.ctps_serie ?? ""}
                  onChange={(e) => set("ctps_serie", soDigitos(e.target.value).slice(0, 5))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>PIS</Label>
                <Input
                  inputMode="numeric"
                  placeholder="000.00000.00-0"
                  className={errClass("pis")}
                  value={mascararPIS(f.pis ?? "")}
                  onChange={(e) => set("pis", soDigitos(e.target.value).slice(0, 11))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Jornada (h/semana)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={f.jornada_horas_semanais ?? ""}
                  onChange={(e) =>
                    set("jornada_horas_semanais", e.target.value ? Number(e.target.value) : null)
                  }
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Descrição da jornada</Label>
                <Input
                  value={f.jornada_descricao ?? ""}
                  onChange={(e) => set("jornada_descricao", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail corporativo</Label>
                <Input
                  type="email"
                  inputMode="email"
                  placeholder="nome@empresa.com"
                  value={f.email_corporativo ?? ""}
                  onChange={(e) => set("email_corporativo", e.target.value)}
                  className={errClass("email_corporativo")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Centro de custo</Label>
                <Select
                  value={f.centro_custo_id ?? "__nenhum__"}
                  onValueChange={(v) => set("centro_custo_id", v === "__nenhum__" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__nenhum__">Sem centro de custo</SelectItem>
                    {(centros.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Pagamento (CLT)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Dia de pagamento do salário</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Ex.: 5"
                  value={f.dia_pagamento_salario ?? ""}
                  onChange={(e) =>
                    set("dia_pagamento_salario", e.target.value ? Number(e.target.value) : null)
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Limite legal CLT: até o 5º dia útil do mês seguinte.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Dia do adiantamento (opcional)</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Ex.: 20"
                  value={f.dia_pagamento_adiantamento ?? ""}
                  onChange={(e) =>
                    set(
                      "dia_pagamento_adiantamento",
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input
                  id="gerar-cp"
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={!!f.gerar_contas_pagar_automatico}
                  onChange={(e) => set("gerar_contas_pagar_automatico", e.target.checked)}
                />
                <Label htmlFor="gerar-cp" className="cursor-pointer">
                  Gerar Conta a Pagar automaticamente ao fechar a folha
                </Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bancario" className="mt-4 space-y-4">
          {!podeEditarSalario && (
            <p className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Só leitura: alterar salário e banco exige RH · Salários · alterar.
              Reajuste é feito em Remuneração › Alteração salarial.
            </p>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Salário</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Salário (R$)</Label>
                <Input
                  inputMode="decimal"
                  disabled={!podeEditarSalario}
                  value={f.salario_atual_str}
                  onChange={(e) => setF((p) => ({ ...p, salario_atual_str: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Vigente desde</Label>
                <Input
                  type="date"
                  disabled={!podeEditarSalario}
                  value={f.salario_desde ?? ""}
                  onChange={(e) => set("salario_desde", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados bancários para a folha</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Banco</Label>
                <Input
                  value={f.banco_nome ?? ""}
                  onChange={(e) => set("banco_nome", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Agência</Label>
                <Input
                  value={f.banco_agencia ?? ""}
                  onChange={(e) => set("banco_agencia", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Conta</Label>
                <Input
                  value={f.banco_conta ?? ""}
                  onChange={(e) => set("banco_conta", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de conta</Label>
                <Select
                  value={f.banco_tipo_conta ?? "corrente"}
                  onValueChange={(v) => set("banco_tipo_conta", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                    <SelectItem value="salario">Salário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Chave Pix</Label>
                <Input
                  value={f.banco_pix ?? ""}
                  onChange={(e) => set("banco_pix", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {admissao && (
          <TabsContent value="revisao" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Confira antes de admitir</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <Resumo rotulo="Nome" valor={f.nome} />
                <Resumo rotulo="CPF" valor={f.cpf} />
                <Resumo rotulo="Admissão" valor={f.data_admissao ? f.data_admissao.split("-").reverse().join("/") : "—"} />
                <Resumo rotulo="Contrato" valor={CONTRATO_LABEL[f.tipo_contrato as TipoContrato] ?? f.tipo_contrato} />
                <Resumo rotulo="Cargo" valor={(cargos.data ?? []).find((c) => c.id === f.cargo_id)?.nome ?? "—"} />
                <Resumo rotulo="Departamento" valor={(deptos.data ?? []).find((d) => d.id === f.departamento_id)?.nome ?? "—"} />
                <Resumo rotulo="Jornada" valor={f.jornada_horas_semanais ? `${f.jornada_horas_semanais} h/semana` : "—"} />
                {podeEditarSalario && <Resumo rotulo="Salário" valor={f.salario_atual_str ? `R$ ${f.salario_atual_str}` : "—"} />}
                <Resumo rotulo="Fim da experiência" valor={f.fim_experiencia ? f.fim_experiencia.split("-").reverse().join("/") : "90 dias após a admissão"} />
              </CardContent>
            </Card>
            <p className="mt-3 text-xs text-muted-foreground">
              Ao admitir, o sistema cria o checklist de documentos de admissão e o primeiro período aquisitivo de férias.
            </p>
          </TabsContent>
        )}
        {conteudoExtra}
      </Tabs>

      {admissao && (
        <div className="sticky bottom-0 z-20 -mx-3 flex items-center justify-between gap-2 border-t border-border/60 bg-background/90 px-3 py-3 backdrop-blur sm:-mx-4 sm:px-4 md:-mx-6 md:px-6">
          <Button variant="outline" disabled={indiceEtapa === 0} onClick={() => setTab(etapas[indiceEtapa - 1].aba)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
          </Button>
          {indiceEtapa < etapas.length - 1 ? (
            <Button onClick={avancar}>
              Próximo <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={salvar} disabled={mut.isPending}>
              {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Concluir admissão
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="truncate font-medium text-foreground">{valor || "—"}</p>
    </div>
  );
}

/** Máscara progressiva do PIS/PASEP (000.00000.00-0). */
function mascararPIS(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 8) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}.${d.slice(3, 8)}.${d.slice(8)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 8)}.${d.slice(8, 10)}-${d.slice(10)}`;
}
