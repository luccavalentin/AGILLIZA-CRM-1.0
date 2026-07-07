import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputAutocomplete } from "@/components/ui/input-autocomplete";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  criarCliente,
  atualizarCliente,
  salvarEndereco,
  definirAcessoPortal,
  listarParceirosDisponiveis,
  vincularParceiro,
  TIPOS_VINCULO,
  TIPO_VINCULO_PESSOA,
  type TipoVinculo,
} from "@/lib/crm/clientes.functions";
import {
  validarDocumento,
  validarCPF,
  soDigitos,
  validarEmail,
  validarTelefone,
  mascararTelefone,
  mascararCPF,
  mascararDocumentoTipo,
} from "@/lib/crm/documento";

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
  pai: string;
  sexo: string;
  nacionalidade: string;
  naturalidade: string;
  tipo_documento_identidade: string;
  numero_documento: string;
  orgao_expedidor: string;
  uf_expedicao: string;
  data_expedicao: string;
  profissao: string;
  empresa: string;
  banco_conta: string;
  agencia: string;
  conta_corrente: string;
  digito_conta: string;
  email: string;
  telefone_celular: string;
  renda_total_declarada: string;
  uf_interesse: string;
  utiliza_fgts: boolean;
  fg_autorizacao_dados: boolean;
  origem: string;
  conjuge_nome: string;
  conjuge_cpf: string;
  conjuge_data_nascimento: string;
  conjuge_nome_mae: string;
  conjuge_sexo: string;
  conjuge_nacionalidade: string;
  conjuge_tipo_documento_identidade: string;
  conjuge_numero_documento: string;
  conjuge_orgao_expedidor: string;
  conjuge_uf_expedicao: string;
  conjuge_data_expedicao: string;
  conjuge_profissao: string;
  conjuge_empresa: string;
  conjuge_renda: string;
  conjuge_email: string;
  conjuge_celular: string;
  conjuge_banco_conta: string;
  conjuge_agencia: string;
  conjuge_conta_corrente: string;
  conjuge_digito_conta: string;
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

// Sugestões pré-cadastradas para os campos de autocomplete (texto livre + seleção).
const OPCOES_SEXO = [
  { v: "M", l: "Masculino" },
  { v: "F", l: "Feminino" },
];

/**
 * Normaliza o sexo salvo para o valor canônico do <Select> ("M"/"F").
 * O cadastro antigo e a sincronização de propostas podem gravar tanto o
 * nome completo ("Masculino"/"Feminino") quanto a inicial ("M"/"F"); sem
 * normalizar, o valor não bate com as opções e o campo aparece vazio.
 */
function normalizarSexo(valor?: string | null): string {
  if (!valor) return "";
  const c = valor.trim().charAt(0).toUpperCase();
  return c === "M" || c === "F" ? c : "";
}
const OPCOES_NACIONALIDADE = [
  "Brasileira",
  "Portuguesa",
  "Argentina",
  "Boliviana",
  "Paraguaia",
  "Uruguaia",
  "Chilena",
  "Colombiana",
  "Venezuelana",
  "Peruana",
  "Espanhola",
  "Italiana",
  "Alemã",
  "Francesa",
  "Japonesa",
  "Chinesa",
  "Norte-americana",
];
const OPCOES_TIPO_DOCUMENTO = ["RG", "CNH", "RNE", "Passaporte", "CTPS"];
const OPCOES_ORGAO_EXPEDIDOR = [
  "SSP",
  "DETRAN",
  "DIC",
  "IFP",
  "PC",
  "PM",
  "Marinha",
  "Exército",
  "Aeronáutica",
  "OAB",
  "CRM",
  "CREA",
  "MTE",
  "DPF",
];
const OPCOES_UF = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

// Capitais e principais cidades (Cidade/UF) para sugerir na naturalidade.
const OPCOES_NATURALIDADE = [
  "Aracaju/SE", "Belém/PA", "Belo Horizonte/MG", "Boa Vista/RR", "Brasília/DF",
  "Campo Grande/MS", "Cuiabá/MT", "Curitiba/PR", "Florianópolis/SC", "Fortaleza/CE",
  "Goiânia/GO", "João Pessoa/PB", "Macapá/AP", "Maceió/AL", "Manaus/AM",
  "Natal/RN", "Palmas/TO", "Porto Alegre/RS", "Porto Velho/RO", "Recife/PE",
  "Rio Branco/AC", "Rio de Janeiro/RJ", "Salvador/BA", "São Luís/MA", "São Paulo/SP",
  "Teresina/PI", "Vitória/ES",
  "Campinas/SP", "Guarulhos/SP", "Santo André/SP", "São Bernardo do Campo/SP",
  "Osasco/SP", "Sorocaba/SP", "Ribeirão Preto/SP", "Santos/SP",
  "Niterói/RJ", "Duque de Caxias/RJ", "São Gonçalo/RJ", "Campos dos Goytacazes/RJ",
  "Contagem/MG", "Uberlândia/MG", "Juiz de Fora/MG", "Betim/MG",
  "Londrina/PR", "Maringá/PR", "Foz do Iguaçu/PR",
  "Joinville/SC", "Blumenau/SC", "Caxias do Sul/RS", "Pelotas/RS", "Canoas/RS",
  "Feira de Santana/BA", "Jaboatão dos Guararapes/PE", "Caruaru/PE",
];

// Bancos previamente cadastrados para pesquisa/sugestão (conta do cliente).
const OPCOES_BANCO = [
  "001 - Banco do Brasil",
  "033 - Santander",
  "070 - BRB - Banco de Brasília",
  "077 - Banco Inter",
  "104 - Caixa Econômica Federal",
  "208 - Banco BTG Pactual",
  "212 - Banco Original",
  "237 - Bradesco",
  "260 - Nubank (Nu Pagamentos)",
  "290 - PagBank (PagSeguro)",
  "323 - Mercado Pago",
  "336 - Banco C6",
  "341 - Itaú Unibanco",
  "356 - Banco Real",
  "380 - PicPay",
  "422 - Banco Safra",
  "623 - Banco PAN",
  "633 - Banco Rendimento",
  "655 - Banco Votorantim / BV",
  "745 - Citibank",
  "746 - Banco Modal",
  "748 - Sicredi",
  "756 - Sicoob",
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
  pai: "",
  sexo: "",
  nacionalidade: "Brasileira",
  naturalidade: "",
  tipo_documento_identidade: "",
  numero_documento: "",
  orgao_expedidor: "",
  uf_expedicao: "",
  data_expedicao: "",
  profissao: "",
  empresa: "",
  banco_conta: "",
  agencia: "",
  conta_corrente: "",
  digito_conta: "",
  email: "",
  telefone_celular: "",
  renda_total_declarada: "",
  uf_interesse: "",
  utiliza_fgts: false,
  fg_autorizacao_dados: false,
  origem: "direto",
  conjuge_nome: "",
  conjuge_cpf: "",
  conjuge_data_nascimento: "",
  conjuge_nome_mae: "",
  conjuge_sexo: "",
  conjuge_nacionalidade: "Brasileira",
  conjuge_tipo_documento_identidade: "",
  conjuge_numero_documento: "",
  conjuge_orgao_expedidor: "",
  conjuge_uf_expedicao: "",
  conjuge_data_expedicao: "",
  conjuge_profissao: "",
  conjuge_empresa: "",
  conjuge_renda: "",
  conjuge_email: "",
  conjuge_celular: "",
  conjuge_banco_conta: "",
  conjuge_agencia: "",
  conjuge_conta_corrente: "",
  conjuge_digito_conta: "",
};

export function ClienteForm({
  inicial,
  portalAtivo,
  enderecoInicial,
}: {
  inicial?: Partial<ClienteFormValues>;
  portalAtivo?: boolean;
  enderecoInicial?: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  } | null;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const criar = useServerFn(criarCliente);
  const atualizar = useServerFn(atualizarCliente);
  const salvarEnd = useServerFn(salvarEndereco);
  const definirPortal = useServerFn(definirAcessoPortal);
  const listarParceiros = useServerFn(listarParceirosDisponiveis);
  const vincular = useServerFn(vincularParceiro);

  const [v, setV] = useState<ClienteFormValues>(() => {
    const base = { ...emptyValues, ...inicial };
    // Formata a renda inicial (vinda como número cru) para exibição em R$.
    if (base.renda_total_declarada) {
      const n = Number(base.renda_total_declarada);
      if (!isNaN(n)) base.renda_total_declarada = formatarMoedaBR(n);
    }
    // Normaliza o sexo para o valor canônico ("M"/"F") aceito pelo <Select>.
    base.sexo = normalizarSexo(base.sexo);
    base.conjuge_sexo = normalizarSexo(base.conjuge_sexo);
    // Aplica máscaras de exibição em documentos/telefones vindos crus do banco.
    if (base.documento) base.documento = mascararDocumentoTipo(base.documento, base.tipo_pessoa);
    if (base.conjuge_cpf) base.conjuge_cpf = mascararCPF(base.conjuge_cpf);
    if (base.telefone_celular) base.telefone_celular = mascararTelefone(base.telefone_celular);
    if (base.conjuge_celular) base.conjuge_celular = mascararTelefone(base.conjuge_celular);
    if (base.conjuge_renda) {
      const n = Number(base.conjuge_renda);
      if (!isNaN(n)) base.conjuge_renda = formatarMoedaBR(n);
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
  const [portalSalvando, setPortalSalvando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Vínculos de atendimento: usuários a vincular ao criar um novo cliente, por tipo.
  const novoCadastro = !v.id;
  const [vinculos, setVinculos] = useState<Array<{ parceiro_id: string; tipo_vinculo: TipoVinculo }>>(
    [],
  );
  const [vinculoSel, setVinculoSel] = useState<Record<string, string>>({});
  const parceiros = useQuery({
    queryKey: ["parceiros-disponiveis"],
    queryFn: () => listarParceiros(),
    enabled: novoCadastro,
  });
  const nomeParceiro = (id: string) => {
    const p = (parceiros.data ?? []).find((x) => x.id === id);
    return p?.nome ?? p?.email ?? id;
  };
  const adicionarVinculo = (tipo: TipoVinculo) => {
    const id = vinculoSel[tipo];
    if (!id) return;
    setVinculos((prev) => [...prev, { parceiro_id: id, tipo_vinculo: tipo }]);
    setVinculoSel((prev) => ({ ...prev, [tipo]: "" }));
  };
  const removerVinculo = (parceiro_id: string, tipo: TipoVinculo) =>
    setVinculos((prev) =>
      prev.filter((x) => !(x.parceiro_id === parceiro_id && x.tipo_vinculo === tipo)),
    );

  async function alternarPortal(ativo: boolean) {
    if (!v.id) return;
    setPortal(ativo);
    setPortalSalvando(true);
    try {
      await definirPortal({ data: { cliente_id: v.id, ativo } });
      toast.success(ativo ? "Acesso ao portal habilitado." : "Acesso ao portal desabilitado.");
      qc.invalidateQueries({ queryKey: ["cliente", v.id] });
    } catch (err: any) {
      setPortal(!ativo);
      toast.error(err?.message ?? "Não foi possível salvar o acesso.");
    } finally {
      setPortalSalvando(false);
    }
  }
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
    const ehPF = v.tipo_pessoa === "PF";

    // Nome / razão social
    if (!v.nome.trim()) {
      return toast.error(ehPF ? "Informe o nome completo." : "Informe a razão social.");
    }

    // Documento: CPF (11 dígitos) para PF, CNPJ (14 dígitos) para PJ
    const docDigitos = soDigitos(v.documento);
    if (!docDigitos) {
      return toast.error(ehPF ? "Informe o CPF." : "Informe o CNPJ.");
    }
    if (ehPF && docDigitos.length !== 11) {
      return toast.error("O CPF deve conter 11 dígitos.");
    }
    if (!ehPF && docDigitos.length !== 14) {
      return toast.error("O CNPJ deve conter 14 dígitos.");
    }
    if (!validarDocumento(docDigitos, v.tipo_pessoa)) {
      return toast.error(ehPF ? "CPF inválido." : "CNPJ inválido.");
    }

    // Data de nascimento (PF) / abertura (PJ)
    if (!v.data_nascimento) {
      return toast.error(ehPF ? "Informe a data de nascimento." : "Informe a data de abertura.");
    }

    if (!validarEmail(v.email)) return toast.error("E-mail inválido.");
    if (!validarTelefone(v.telefone_celular)) {
      return toast.error("Celular inválido. Informe DDD + número (ex.: (11) 99999-9999).");
    }
    const renda = Number(v.renda_total_declarada.replace(/\./g, "").replace(",", "."));
    if (isNaN(renda) || renda < 0) return toast.error("Renda inválida.");

    // Estado civil e cônjuge só se aplicam a Pessoa Física.
    const casado =
      ehPF && (v.estado_civil === "casado" || v.estado_civil === "uniao_estavel");
    if (casado && !v.conjuge_nome.trim()) return toast.error("Informe o nome do cônjuge.");
    if (casado && v.conjuge_cpf && !validarCPF(v.conjuge_cpf)) {
      return toast.error("CPF do cônjuge inválido.");
    }
    if (casado && v.conjuge_email && !validarEmail(v.conjuge_email)) {
      return toast.error("E-mail do cônjuge inválido.");
    }
    if (casado && v.conjuge_celular && !validarTelefone(v.conjuge_celular)) {
      return toast.error("Celular do cônjuge inválido.");
    }
    const rendaConjuge = v.conjuge_renda
      ? Number(v.conjuge_renda.replace(/\./g, "").replace(",", "."))
      : null;

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
        mae: v.mae.trim() || null,
        pai: v.pai.trim() || null,
        sexo: v.sexo || null,
        nacionalidade: v.nacionalidade.trim() || null,
        naturalidade: v.naturalidade.trim() || null,
        tipo_documento_identidade: v.tipo_documento_identidade || null,
        numero_documento: v.numero_documento.trim() || null,
        orgao_expedidor: v.orgao_expedidor.trim() || null,
        uf_expedicao: v.uf_expedicao || null,
        data_expedicao: v.data_expedicao || null,
        profissao: v.profissao.trim() || null,
        empresa: v.empresa.trim() || null,
        banco_conta: v.banco_conta.trim() || null,
        agencia: v.agencia.trim() || null,
        conta_corrente: v.conta_corrente.trim() || null,
        digito_conta: v.digito_conta.trim() || null,
        email: v.email.trim(),
        telefone_celular: soDigitos(v.telefone_celular),
        renda_total_declarada: renda,
        uf_interesse: v.uf_interesse || null,
        utiliza_fgts: v.utiliza_fgts,
        fg_autorizacao_dados: v.fg_autorizacao_dados,
        origem: v.origem as any,
        // Cônjuge: só envia quando casado/união estável; caso contrário limpa.
        conjuge_nome: casado ? v.conjuge_nome.trim() || null : null,
        conjuge_cpf: casado ? soDigitos(v.conjuge_cpf) || null : null,
        conjuge_data_nascimento: casado ? v.conjuge_data_nascimento || null : null,
        conjuge_nome_mae: casado ? v.conjuge_nome_mae.trim() || null : null,
        conjuge_sexo: casado ? v.conjuge_sexo || null : null,
        conjuge_nacionalidade: casado ? v.conjuge_nacionalidade.trim() || null : null,
        conjuge_tipo_documento_identidade: casado ? v.conjuge_tipo_documento_identidade || null : null,
        conjuge_numero_documento: casado ? v.conjuge_numero_documento.trim() || null : null,
        conjuge_orgao_expedidor: casado ? v.conjuge_orgao_expedidor.trim() || null : null,
        conjuge_uf_expedicao: casado ? v.conjuge_uf_expedicao || null : null,
        conjuge_data_expedicao: casado ? v.conjuge_data_expedicao || null : null,
        conjuge_profissao: casado ? v.conjuge_profissao.trim() || null : null,
        conjuge_empresa: casado ? v.conjuge_empresa.trim() || null : null,
        conjuge_renda: casado ? rendaConjuge : null,
        conjuge_email: casado ? v.conjuge_email.trim() || null : null,
        conjuge_celular: casado ? soDigitos(v.conjuge_celular) || null : null,
        conjuge_banco_conta: casado ? v.conjuge_banco_conta.trim() || null : null,
        conjuge_agencia: casado ? v.conjuge_agencia.trim() || null : null,
        conjuge_conta_corrente: casado ? v.conjuge_conta_corrente.trim() || null : null,
        conjuge_digito_conta: casado ? v.conjuge_digito_conta.trim() || null : null,
      };
      let id = v.id;
      if (id) {
        await atualizar({ data: { id, ...payload } });
      } else {
        const r = await criar({ data: payload });
        id = r.id;
        // Cria os vínculos de atendimento selecionados no novo cadastro.
        for (const vinc of vinculos) {
          try {
            await vincular({
              data: { cliente_id: id, parceiro_id: vinc.parceiro_id, tipo_vinculo: vinc.tipo_vinculo },
            });
          } catch {
            /* segue mesmo se um vínculo falhar */
          }
        }
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
      {novoCadastro && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" /> Vínculos de atendimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Escolha os usuários responsáveis pelo atendimento deste cliente por tipo. Cada tipo
              aceita mais de um usuário e nenhum é obrigatório. Você poderá ajustar depois na ficha
              do cliente.
            </p>
            {TIPOS_VINCULO.map((tipo) => {
              const desteTipo = vinculos.filter((x) => x.tipo_vinculo === tipo.valor);
              const idsTipo = new Set(desteTipo.map((x) => x.parceiro_id));
              const tipoPessoa = TIPO_VINCULO_PESSOA[tipo.valor];
              const opcoesParceiros = (parceiros.data ?? []).filter(
                (p) => !idsTipo.has(p.id) && (p as any).tipo_pessoa === tipoPessoa,
              );
              const sel = vinculoSel[tipo.valor] ?? "";
              return (
                <div key={tipo.valor} className="space-y-2">
                  <Label className="block">{tipo.rotulo}</Label>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Select
                        value={sel}
                        onValueChange={(val) =>
                          setVinculoSel((prev) => ({ ...prev, [tipo.valor]: val }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um usuário" />
                        </SelectTrigger>
                        <SelectContent>
                          {opcoesParceiros.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              Nenhum usuário disponível
                            </div>
                          ) : (
                            opcoesParceiros.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nome ?? p.email ?? p.id}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      disabled={!sel}
                      onClick={() => adicionarVinculo(tipo.valor)}
                    >
                      <UserPlus className="size-4" />
                    </Button>
                  </div>
                  {desteTipo.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {desteTipo.map((vinc) => (
                        <span
                          key={vinc.parceiro_id}
                          className="inline-flex items-center gap-2 rounded-full border border-border bg-accent px-3 py-1 text-sm text-accent-foreground"
                        >
                          {nomeParceiro(vinc.parceiro_id)}
                          <button
                            type="button"
                            onClick={() => removerVinculo(vinc.parceiro_id, tipo.valor)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Remover vínculo"
                          >
                            <X className="size-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acesso ao Portal do Cliente</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            O login do cliente em /portal é por documento + data de nascimento. Nenhuma senha é
            criada.
            {!v.id && (
              <span className="mt-1 block text-xs">
                Salve o cadastro primeiro para habilitar o acesso.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {portalSalvando && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            <Switch
              id="portal"
              checked={portal}
              onCheckedChange={alternarPortal}
              disabled={!v.id || portalSalvando}
            />
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
            <Select
              value={v.tipo_pessoa}
              onValueChange={(x) => {
                const tp = x as "PF" | "PJ";
                setV((prev) => ({
                  ...prev,
                  tipo_pessoa: tp,
                  documento: mascararDocumentoTipo(prev.documento, tp),
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PF">Pessoa Física</SelectItem>
                <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{v.tipo_pessoa === "PF" ? "CPF *" : "CNPJ *"}</Label>
            <Input
              value={v.documento}
              onChange={(e) => set("documento", mascararDocumentoTipo(e.target.value, v.tipo_pessoa))}
              inputMode="numeric"
              placeholder={v.tipo_pessoa === "PF" ? "000.000.000-00" : "00.000.000/0000-00"}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{v.tipo_pessoa === "PF" ? "Nome completo *" : "Razão social *"}</Label>
            <Input value={v.nome} onChange={(e) => set("nome", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{v.tipo_pessoa === "PF" ? "Data de nascimento *" : "Data de abertura *"}</Label>
            <Input
              type="date"
              value={v.data_nascimento}
              onChange={(e) => set("data_nascimento", e.target.value)}
            />
          </div>
          {v.tipo_pessoa === "PF" && (
            <div className="space-y-1.5">
              <Label>Estado civil *</Label>
              <Select value={v.estado_civil} onValueChange={(x) => set("estado_civil", x)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_CIVIS.map((o) => (
                    <SelectItem key={o.v} value={o.v}>
                      {o.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {v.tipo_pessoa === "PF" &&
            (v.estado_civil === "casado" || v.estado_civil === "uniao_estavel") && (
              <div className="space-y-1.5">
                <Label>Regime de casamento</Label>
                <Select value={v.regime_casamento} onValueChange={(x) => set("regime_casamento", x)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIMES.map((o) => (
                      <SelectItem key={o.v} value={o.v}>
                        {o.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          <div className="space-y-1.5">
            <Label>Nome da mãe</Label>
            <Input value={v.mae} onChange={(e) => set("mae", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Nome do pai</Label>
            <Input value={v.pai} onChange={(e) => set("pai", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail *</Label>
            <Input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Celular *</Label>
            <Input
              value={v.telefone_celular}
              onChange={(e) => set("telefone_celular", mascararTelefone(e.target.value))}
              inputMode="numeric"
              placeholder="(11) 99999-9999"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Renda total declarada (R$) *</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                R$
              </span>
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
            <Combobox
              value={v.uf_interesse}
              onValueChange={(x) => set("uf_interesse", x)}
              options={OPCOES_UF}
              placeholder="Selecione"
              searchPlaceholder="Buscar UF…"
            />
          </div>
        </CardContent>
      </Card>

      {v.tipo_pessoa === "PF" &&
        (v.estado_civil === "casado" || v.estado_civil === "uniao_estavel") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do cônjuge</CardTitle>
            <p className="text-sm text-muted-foreground">
              Exigidos pelos bancos quando o proponente é casado ou vive em união estável.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome completo do cônjuge *</Label>
              <Input value={v.conjuge_nome} onChange={(e) => set("conjuge_nome", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>CPF do cônjuge</Label>
              <Input
                value={v.conjuge_cpf}
                onChange={(e) => set("conjuge_cpf", mascararCPF(e.target.value))}
                inputMode="numeric"
                placeholder="000.000.000-00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data de nascimento</Label>
              <Input
                type="date"
                value={v.conjuge_data_nascimento}
                onChange={(e) => set("conjuge_data_nascimento", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sexo</Label>
              <Select
                value={v.conjuge_sexo || undefined}
                onValueChange={(x) => set("conjuge_sexo", x)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {OPCOES_SEXO.map((o) => (
                    <SelectItem key={o.v} value={o.v}>
                      {o.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nacionalidade</Label>
              <Combobox
                value={v.conjuge_nacionalidade}
                onValueChange={(x) => set("conjuge_nacionalidade", x)}
                options={OPCOES_NACIONALIDADE}
                placeholder="Selecione"
                searchPlaceholder="Buscar nacionalidade…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome da mãe do cônjuge</Label>
              <Input
                value={v.conjuge_nome_mae}
                onChange={(e) => set("conjuge_nome_mae", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de documento</Label>
              <Combobox
                value={v.conjuge_tipo_documento_identidade}
                onValueChange={(x) => set("conjuge_tipo_documento_identidade", x)}
                options={OPCOES_TIPO_DOCUMENTO}
                placeholder="Selecione"
                searchPlaceholder="Buscar tipo…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Número do documento</Label>
              <Input
                value={v.conjuge_numero_documento}
                onChange={(e) => set("conjuge_numero_documento", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Órgão expedidor</Label>
              <Combobox
                value={v.conjuge_orgao_expedidor}
                onValueChange={(x) => set("conjuge_orgao_expedidor", x)}
                options={OPCOES_ORGAO_EXPEDIDOR}
                placeholder="Selecione"
                searchPlaceholder="Buscar órgão…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>UF de expedição</Label>
              <Combobox
                value={v.conjuge_uf_expedicao}
                onValueChange={(x) => set("conjuge_uf_expedicao", x)}
                options={OPCOES_UF}
                placeholder="Selecione"
                searchPlaceholder="Buscar UF…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data de expedição</Label>
              <Input
                type="date"
                value={v.conjuge_data_expedicao}
                onChange={(e) => set("conjuge_data_expedicao", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Profissão</Label>
              <Input
                value={v.conjuge_profissao}
                onChange={(e) => set("conjuge_profissao", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Input
                value={v.conjuge_empresa}
                onChange={(e) => set("conjuge_empresa", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Renda declarada (R$)</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  inputMode="numeric"
                  className="pl-9"
                  value={v.conjuge_renda}
                  onChange={(e) => set("conjuge_renda", mascararMoedaBR(e.target.value))}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>E-mail do cônjuge</Label>
              <Input
                type="email"
                value={v.conjuge_email}
                onChange={(e) => set("conjuge_email", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Celular do cônjuge</Label>
              <Input
                value={v.conjuge_celular}
                onChange={(e) => set("conjuge_celular", mascararTelefone(e.target.value))}
                inputMode="numeric"
                placeholder="(11) 99999-9999"
              />
            </div>
          </CardContent>
        </Card>
      )}



      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documento de identidade e qualificação</CardTitle>
          <p className="text-sm text-muted-foreground">
            Dados exigidos pelos bancos para análise e aprovação do financiamento.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Sexo</Label>
            <Select value={v.sexo || undefined} onValueChange={(x) => set("sexo", x)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {OPCOES_SEXO.map((o) => (
                  <SelectItem key={o.v} value={o.v}>
                    {o.l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nacionalidade</Label>
            <Select value={v.nacionalidade || undefined} onValueChange={(x) => set("nacionalidade", x)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {OPCOES_NACIONALIDADE.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Naturalidade (cidade/UF de nascimento)</Label>
            <Select value={v.naturalidade || undefined} onValueChange={(x) => set("naturalidade", x)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {OPCOES_NATURALIDADE.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de documento</Label>
            <Select value={v.tipo_documento_identidade || undefined} onValueChange={(x) => set("tipo_documento_identidade", x)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {OPCOES_TIPO_DOCUMENTO.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Número do documento</Label>
            <Input
              value={v.numero_documento}
              onChange={(e) => set("numero_documento", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Órgão expedidor</Label>
            <Combobox
              value={v.orgao_expedidor}
              onValueChange={(x) => set("orgao_expedidor", x)}
              options={OPCOES_ORGAO_EXPEDIDOR}
              placeholder="Selecione"
              searchPlaceholder="Buscar órgão…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>UF de expedição</Label>
            <Combobox
              value={v.uf_expedicao}
              onValueChange={(x) => set("uf_expedicao", x)}
              options={OPCOES_UF}
              placeholder="Selecione"
              searchPlaceholder="Buscar UF…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Data de expedição</Label>
            <Input
              type="date"
              value={v.data_expedicao}
              onChange={(e) => set("data_expedicao", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Profissão</Label>
            <Input
              value={v.profissao}
              onChange={(e) => set("profissao", e.target.value)}
              placeholder="Digite a profissão"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Empresa onde trabalha</Label>
            <Input value={v.empresa} onChange={(e) => set("empresa", e.target.value)} />
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
            <div className="relative">
              <Input
                inputMode="numeric"
                value={end.cep}
                onChange={(e) => {
                  const masked = mascararCep(e.target.value);
                  setEnd((p) => ({ ...p, cep: masked }));
                  if (masked.replace(/\D/g, "").length === 8) buscarCep(masked);
                }}
                onBlur={(e) => buscarCep(e.target.value)}
                placeholder="00000-000"
                maxLength={9}
              />
              {buscandoCep && (
                <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Logradouro</Label>
            <Input
              value={end.logradouro}
              onChange={(e) => setEnd((p) => ({ ...p, logradouro: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Número</Label>
            <Input
              value={end.numero}
              onChange={(e) => setEnd((p) => ({ ...p, numero: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Bairro</Label>
            <Input
              value={end.bairro}
              onChange={(e) => setEnd((p) => ({ ...p, bairro: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <Input
              value={end.cidade}
              onChange={(e) => setEnd((p) => ({ ...p, cidade: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>UF</Label>
            <Select value={end.uf || undefined} onValueChange={(x) => setEnd((p) => ({ ...p, uf: x }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {OPCOES_UF.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">FGTS e autorização de dados</CardTitle>
          <p className="text-sm text-muted-foreground">
            Informações exigidas no envio da proposta ao banco — preenchidas aqui já seguem para a
            proposta automaticamente.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="utiliza_fgts">Utiliza FGTS na operação</Label>
              <p className="text-xs text-muted-foreground">
                Indique se o cliente pretende usar o saldo do FGTS.
              </p>
            </div>
            <Switch
              id="utiliza_fgts"
              checked={v.utiliza_fgts}
              onCheckedChange={(x) => set("utiliza_fgts", x)}
            />
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Checkbox
              id="fg_autorizacao_dados"
              checked={v.fg_autorizacao_dados}
              onCheckedChange={(x: boolean | "indeterminate") =>
                set("fg_autorizacao_dados", x === true)
              }
              className="mt-0.5"
            />
            <Label htmlFor="fg_autorizacao_dados" className="text-sm font-normal leading-snug">
              O cliente autoriza a consulta e o uso dos seus dados junto aos bancos e instituições
              financeiras para análise de crédito.
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados bancários</CardTitle>
          <p className="text-sm text-muted-foreground">
            Conta usada para crédito e débito das parcelas do financiamento.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Banco</Label>
            <InputAutocomplete
              value={v.banco_conta}
              onValueChange={(x) => set("banco_conta", x)}
              options={OPCOES_BANCO}
              placeholder="Pesquisar banco ou digitar"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Agência</Label>
            <Input value={v.agencia} onChange={(e) => set("agencia", e.target.value)} />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="space-y-1.5">
              <Label>Conta corrente</Label>
              <Input
                value={v.conta_corrente}
                onChange={(e) => set("conta_corrente", e.target.value)}
              />
            </div>
            <div className="w-20 space-y-1.5">
              <Label>Dígito</Label>
              <Input
                value={v.digito_conta}
                onChange={(e) => set("digito_conta", e.target.value)}
              />
            </div>
          </div>

          {(v.estado_civil === "casado" || v.estado_civil === "uniao_estavel") && (
            <div className="space-y-4 border-t pt-4 sm:col-span-2">
              <p className="text-sm font-medium">Dados bancários do cônjuge (opcional)</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Banco</Label>
                  <InputAutocomplete
                    value={v.conjuge_banco_conta}
                    onValueChange={(x) => set("conjuge_banco_conta", x)}
                    options={OPCOES_BANCO}
                    placeholder="Pesquisar banco ou digitar"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Agência</Label>
                  <Input
                    value={v.conjuge_agencia}
                    onChange={(e) => set("conjuge_agencia", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <div className="space-y-1.5">
                    <Label>Conta corrente</Label>
                    <Input
                      value={v.conjuge_conta_corrente}
                      onChange={(e) => set("conjuge_conta_corrente", e.target.value)}
                    />
                  </div>
                  <div className="w-20 space-y-1.5">
                    <Label>Dígito</Label>
                    <Input
                      value={v.conjuge_digito_conta}
                      onChange={(e) => set("conjuge_digito_conta", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
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
