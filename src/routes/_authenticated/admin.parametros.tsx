import { mensagemDeErro } from "@/lib/erros/mensagem";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  Save,
  MapPin,
  Contact,
  ShieldCheck,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CabecalhoGestao,
  EstadoErro,
  PaginaGestao,
  Secao,
  Selo,
} from "@/components/plataforma/kit";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import {
  obterParametros,
  salvarParametros,
  type ParametrosGlobais,
} from "@/lib/admin/parametros.functions";
import { mascararCep, cepValido, consultarCep } from "@/lib/cep";

/**
 * Parâmetros (Configurações gerais, pedido do dono de 26/10/2026, item C68): os dados da
 * empresa organizados por assunto (Empresa · Contatos · Políticas), com o quanto falta
 * preencher ao lado. Mesmos campos e mesma função de salvar de antes.
 */
export const Route = createFileRoute("/_authenticated/admin/parametros")({
  head: () => ({ meta: [{ title: "Parâmetros — Configurações gerais — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.parametros"),
  component: Pagina,
});

type Form = Omit<ParametrosGlobais, "id" | "logo_url" | "cor_primaria">;

const POLITICA_LGPD_PADRAO = `POLÍTICA DE PROTEÇÃO DE DADOS (LGPD)

Esta Política descreve como tratamos os dados pessoais de clientes, parceiros e usuários, em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais — LGPD).

1. Controlador dos dados
Somos o controlador responsável pelas decisões sobre o tratamento dos seus dados pessoais, garantindo a observância dos princípios da finalidade, adequação, necessidade, transparência, segurança e prevenção previstos na LGPD.

2. Dados tratados
Coletamos apenas os dados necessários à prestação dos nossos serviços de correspondência bancária e crédito imobiliário, tais como dados cadastrais (nome, CPF/CNPJ, data de nascimento), dados de contato, dados financeiros e documentos exigidos pelas instituições financeiras parceiras.

3. Finalidades e bases legais
Tratamos os dados para: (a) executar contratos e procedimentos pré-contratuais; (b) cumprir obrigações legais e regulatórias; (c) atender ao legítimo interesse na análise e viabilização de operações de crédito; e (d) com base no consentimento, quando aplicável. Os dados não são utilizados para finalidades incompatíveis com as aqui informadas.

4. Compartilhamento
Os dados podem ser compartilhados com instituições financeiras parceiras, órgãos reguladores e prestadores de serviço estritamente necessários à operação, sempre observando salvaguardas contratuais e de segurança.

5. Direitos do titular
Nos termos do art. 18 da LGPD, o titular pode solicitar: confirmação da existência de tratamento; acesso, correção, anonimização, portabilidade ou eliminação de dados; informação sobre compartilhamento; e revogação do consentimento. As solicitações são atendidas nos prazos legais.

6. Segurança e retenção
Adotamos medidas técnicas e administrativas para proteger os dados contra acessos não autorizados e situações acidentais ou ilícitas. Os dados são mantidos pelo tempo necessário às finalidades e às obrigações legais aplicáveis, sendo posteriormente eliminados de forma segura.

7. Encarregado (DPO)
As solicitações e dúvidas relacionadas à proteção de dados podem ser encaminhadas ao Encarregado pelo Tratamento de Dados Pessoais por meio dos nossos canais oficiais de atendimento.`;

const POLITICA_PRIVACIDADE_PADRAO = `POLÍTICA DE PRIVACIDADE

Esta Política de Privacidade tem por objetivo esclarecer, de forma transparente, como coletamos, utilizamos, armazenamos e protegemos as informações dos usuários, em conformidade com a legislação brasileira aplicável, incluindo a Lei nº 13.709/2018 (LGPD) e o Marco Civil da Internet (Lei nº 12.965/2014).

1. Informações coletadas
Coletamos informações fornecidas diretamente pelo usuário (dados cadastrais, de contato e financeiros) e informações geradas pelo uso da plataforma (registros de acesso e dados de navegação), sempre limitadas ao necessário.

2. Uso das informações
As informações são utilizadas para viabilizar e acompanhar operações de crédito, prestar suporte, cumprir obrigações legais e regulatórias, aprimorar nossos serviços e garantir a segurança da plataforma.

3. Cookies e tecnologias similares
Podemos utilizar cookies e tecnologias semelhantes para melhorar a experiência de navegação, lembrar preferências e produzir estatísticas de uso. O usuário pode gerenciar cookies nas configurações do seu navegador.

4. Compartilhamento de informações
Não comercializamos dados pessoais. O compartilhamento ocorre apenas com instituições financeiras parceiras, prestadores de serviço essenciais e autoridades competentes, quando exigido por lei ou necessário à execução dos serviços.

5. Armazenamento e segurança
Empregamos medidas de segurança técnicas e organizacionais adequadas para proteger as informações. Os dados são armazenados em ambiente controlado e mantidos apenas pelo período necessário às finalidades e às exigências legais.

6. Direitos do usuário
O usuário pode solicitar acesso, correção, atualização, portabilidade ou exclusão de seus dados, bem como revogar consentimentos, mediante contato pelos nossos canais oficiais de atendimento.

7. Alterações desta Política
Esta Política pode ser atualizada a qualquer momento para refletir mudanças legais ou operacionais. A versão vigente estará sempre disponível na plataforma.`;

const VAZIO: Form = {
  nome_empresa: "",
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  inscricao_estadual: "",
  inscricao_municipal: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  endereco: "",
  email_empresa: "",
  telefone_empresa: "",
  telefone_sac: "",
  site: "",
  responsavel_nome: "",
  politica_lgpd: POLITICA_LGPD_PADRAO,
  politica_privacidade: POLITICA_PRIVACIDADE_PADRAO,
  email_dpo: "",
};

function Campo({
  id,
  label,
  value,
  onChange,
  onBlur,
  busy,
  type,
  className,
  placeholder,
  maxLength,
  inputMode,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: (v: string) => void;
  busy?: boolean;
  type?: string;
  className?: string;
  placeholder?: string;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "email" | "tel" | "url";
  disabled?: boolean;
}) {
  return (
    <div className={`min-w-0 space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={type}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          inputMode={inputMode}
          disabled={disabled}
          className="h-10 text-base sm:text-sm"
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur?.(e.target.value)}
        />
        {busy && (
          <Loader2 className="absolute right-2 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

type Aba = "empresa" | "contatos" | "politicas";

/** Campos que contam para o "cadastro completo", com o nome e a aba onde moram. */
const ESSENCIAIS: { campo: keyof Form; rotulo: string; aba: Aba }[] = [
  { campo: "razao_social", rotulo: "Razão social", aba: "empresa" },
  { campo: "nome_fantasia", rotulo: "Nome fantasia", aba: "empresa" },
  { campo: "nome_empresa", rotulo: "Nome de exibição", aba: "empresa" },
  { campo: "cnpj", rotulo: "CNPJ", aba: "empresa" },
  { campo: "cep", rotulo: "CEP", aba: "empresa" },
  { campo: "logradouro", rotulo: "Logradouro", aba: "empresa" },
  { campo: "cidade", rotulo: "Cidade", aba: "empresa" },
  { campo: "uf", rotulo: "UF", aba: "empresa" },
  { campo: "email_empresa", rotulo: "E-mail da empresa", aba: "contatos" },
  { campo: "telefone_empresa", rotulo: "Telefone", aba: "contatos" },
];

function Pagina() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-parametros"],
    queryFn: () => obterParametros(),
  });
  const [form, setForm] = useState<Form>(VAZIO);
  const [salvo, setSalvo] = useState<Form>(VAZIO);
  const [aba, setAba] = useState<Aba>("empresa");

  useEffect(() => {
    if (q.data) {
      const carregado: Form = {
        nome_empresa: q.data.nome_empresa ?? "",
        razao_social: q.data.razao_social ?? "",
        nome_fantasia: q.data.nome_fantasia ?? "",
        cnpj: q.data.cnpj ?? "",
        inscricao_estadual: q.data.inscricao_estadual ?? "",
        inscricao_municipal: q.data.inscricao_municipal ?? "",
        cep: q.data.cep ?? "",
        logradouro: q.data.logradouro ?? "",
        numero: q.data.numero ?? "",
        complemento: q.data.complemento ?? "",
        bairro: q.data.bairro ?? "",
        cidade: q.data.cidade ?? "",
        uf: q.data.uf ?? "",
        endereco: q.data.endereco ?? "",
        email_empresa: q.data.email_empresa ?? "",
        telefone_empresa: q.data.telefone_empresa ?? "",
        telefone_sac: q.data.telefone_sac ?? "",
        site: q.data.site ?? "",
        responsavel_nome: q.data.responsavel_nome ?? "",
        politica_lgpd: q.data.politica_lgpd || POLITICA_LGPD_PADRAO,
        politica_privacidade: q.data.politica_privacidade || POLITICA_PRIVACIDADE_PADRAO,
        email_dpo: q.data.email_dpo ?? "",
      };
      setForm(carregado);
      setSalvo(carregado);
    }
  }, [q.data]);

  // Salvar exige "Parâmetros: editar" (o servidor confere).
  const podeEditar = usePermissao("admin.parametros", "edit");
  const salvar = useMutation({
    mutationFn: () => salvarParametros({ data: form }),
    onSuccess: () => {
      toast.success("Parâmetros salvos.");
      setSalvo(form);
      qc.invalidateQueries({ queryKey: ["admin-parametros"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Falha ao salvar.")),
  });

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const [buscandoCep, setBuscandoCep] = useState(false);

  async function buscarCepEmpresa(cepRaw: string) {
    if (!cepValido(cepRaw)) return;
    setBuscandoCep(true);
    try {
      const end = await consultarCep(cepRaw);
      if (!end) {
        toast.error("CEP não encontrado.");
        return;
      }
      setForm((f) => ({
        ...f,
        logradouro: end.logradouro || f.logradouro,
        bairro: end.bairro || f.bairro,
        cidade: end.cidade || f.cidade,
        uf: end.uf || f.uf,
      }));
    } catch {
      toast.error("Não foi possível consultar o CEP.");
    } finally {
      setBuscandoCep(false);
    }
  }

  const alterado = useMemo(() => JSON.stringify(form) !== JSON.stringify(salvo), [form, salvo]);
  const faltando = ESSENCIAIS.filter((e) => (form[e.campo] ?? "").toString().trim() === "");
  const completude = Math.round(((ESSENCIAIS.length - faltando.length) / ESSENCIAIS.length) * 100);
  const bloqueado = !podeEditar;

  if (q.isError) {
    return (
      <PaginaGestao>
        <EstadoErro
          mensagem={mensagemDeErro(q.error, "Não foi possível carregar os parâmetros.")}
          onTentar={() => q.refetch()}
        />
      </PaginaGestao>
    );
  }

  return (
    <PaginaGestao>
      <CabecalhoGestao
        secao="Configurações gerais"
        icone={<Building2 />}
        titulo="Parâmetros"
        descricao="Dados da empresa que aparecem para clientes, parceiros e bancos: identificação, endereço, contatos e as políticas exibidas no portal."
      />

      {q.isLoading ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Skeleton className="h-96 rounded-[14px]" />
          <Skeleton className="h-56 rounded-[14px]" />
        </div>
      ) : (
        <form
          className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start"
          onSubmit={(e) => {
            e.preventDefault();
            if (podeEditar && alterado) salvar.mutate();
          }}
        >
          <div className="min-w-0 space-y-4">
            {bloqueado && (
              <p className="rounded-[14px] border border-border/80 bg-muted px-4 py-3 text-sm text-muted-foreground">
                Você pode consultar os parâmetros, mas não alterá-los.
              </p>
            )}
            <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
              <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
                <TabsTrigger value="empresa" className="min-h-11 flex-1 gap-1.5 sm:min-h-8 sm:flex-none">
                  <Building2 className="size-4" /> Empresa
                </TabsTrigger>
                <TabsTrigger value="contatos" className="min-h-11 flex-1 gap-1.5 sm:min-h-8 sm:flex-none">
                  <Contact className="size-4" /> Contatos
                </TabsTrigger>
                <TabsTrigger value="politicas" className="min-h-11 flex-1 gap-1.5 sm:min-h-8 sm:flex-none">
                  <ShieldCheck className="size-4" /> Políticas
                </TabsTrigger>
              </TabsList>

              <TabsContent value="empresa" className="mt-4 space-y-4">
                <Secao
                  titulo="Identificação"
                  descricao="Razão social, nome fantasia e inscrições fiscais."
                  icone={<Building2 />}
                >
                  <fieldset disabled={bloqueado} className="grid gap-4 sm:grid-cols-2">
                    <Campo
                      id="razao_social"
                      label="Razão social"
                      value={form.razao_social ?? ""}
                      onChange={set("razao_social")}
                    />
                    <Campo
                      id="nome_fantasia"
                      label="Nome fantasia"
                      value={form.nome_fantasia ?? ""}
                      onChange={set("nome_fantasia")}
                    />
                    <Campo
                      id="nome_empresa"
                      label="Nome de exibição"
                      value={form.nome_empresa ?? ""}
                      onChange={set("nome_empresa")}
                      placeholder="Nome exibido a clientes e parceiros"
                    />
                    <Campo
                      id="cnpj"
                      label="CNPJ"
                      value={form.cnpj ?? ""}
                      onChange={set("cnpj")}
                      placeholder="00.000.000/0000-00"
                      inputMode="numeric"
                    />
                    <Campo
                      id="inscricao_estadual"
                      label="Inscrição estadual"
                      value={form.inscricao_estadual ?? ""}
                      onChange={set("inscricao_estadual")}
                    />
                    <Campo
                      id="inscricao_municipal"
                      label="Inscrição municipal"
                      value={form.inscricao_municipal ?? ""}
                      onChange={set("inscricao_municipal")}
                    />
                  </fieldset>
                </Secao>

                <Secao titulo="Endereço" descricao="Sede e endereço fiscal do correspondente." icone={<MapPin />}>
                  <fieldset disabled={bloqueado} className="grid gap-4 sm:grid-cols-6">
                    <Campo
                      id="cep"
                      label="CEP"
                      value={form.cep ?? ""}
                      onChange={(v) => {
                        const m = mascararCep(v);
                        set("cep")(m);
                        if (cepValido(m)) buscarCepEmpresa(m);
                      }}
                      onBlur={buscarCepEmpresa}
                      busy={buscandoCep}
                      inputMode="numeric"
                      className="sm:col-span-2"
                      placeholder="00000-000"
                    />
                    <Campo
                      id="logradouro"
                      label="Logradouro"
                      value={form.logradouro ?? ""}
                      onChange={set("logradouro")}
                      className="sm:col-span-4"
                    />
                    <Campo
                      id="numero"
                      label="Número"
                      value={form.numero ?? ""}
                      onChange={set("numero")}
                      className="sm:col-span-2"
                    />
                    <Campo
                      id="complemento"
                      label="Complemento"
                      value={form.complemento ?? ""}
                      onChange={set("complemento")}
                      className="sm:col-span-4"
                    />
                    <Campo
                      id="bairro"
                      label="Bairro"
                      value={form.bairro ?? ""}
                      onChange={set("bairro")}
                      className="sm:col-span-2"
                    />
                    <Campo
                      id="cidade"
                      label="Cidade"
                      value={form.cidade ?? ""}
                      onChange={set("cidade")}
                      className="sm:col-span-3"
                    />
                    <Campo
                      id="uf"
                      label="UF"
                      value={form.uf ?? ""}
                      onChange={(v) => set("uf")(v.toUpperCase())}
                      className="sm:col-span-1"
                      maxLength={2}
                    />
                  </fieldset>
                </Secao>
              </TabsContent>

              <TabsContent value="contatos" className="mt-4 space-y-4">
                <Secao
                  titulo="Contatos e atendimento"
                  descricao="Responsável e canais oficiais exibidos a clientes e parceiros."
                  icone={<Contact />}
                >
                  <fieldset disabled={bloqueado} className="grid gap-4 sm:grid-cols-2">
                    <Campo
                      id="responsavel_nome"
                      label="Responsável"
                      value={form.responsavel_nome ?? ""}
                      onChange={set("responsavel_nome")}
                    />
                    <Campo
                      id="email_empresa"
                      label="E-mail da empresa"
                      type="email"
                      inputMode="email"
                      value={form.email_empresa ?? ""}
                      onChange={set("email_empresa")}
                    />
                    <Campo
                      id="telefone_empresa"
                      label="Telefone"
                      inputMode="tel"
                      value={form.telefone_empresa ?? ""}
                      onChange={set("telefone_empresa")}
                    />
                    <Campo
                      id="telefone_sac"
                      label="Telefone do atendimento (SAC)"
                      inputMode="tel"
                      value={form.telefone_sac ?? ""}
                      onChange={set("telefone_sac")}
                    />
                    <Campo
                      id="site"
                      label="Site"
                      inputMode="url"
                      value={form.site ?? ""}
                      onChange={set("site")}
                      placeholder="https://"
                      className="sm:col-span-2"
                    />
                  </fieldset>
                </Secao>
              </TabsContent>

              <TabsContent value="politicas" className="mt-4 space-y-4">
                <Secao
                  titulo="Políticas exibidas aos clientes"
                  descricao="Textos legais apresentados no portal do cliente."
                  icone={<ShieldCheck />}
                >
                  <fieldset disabled={bloqueado} className="space-y-4">
                    <Campo
                      id="email_dpo"
                      label="E-mail do encarregado de dados (DPO)"
                      type="email"
                      inputMode="email"
                      value={form.email_dpo ?? ""}
                      onChange={set("email_dpo")}
                      className="sm:max-w-md"
                    />
                    <div className="space-y-1.5">
                      <Label htmlFor="politica_lgpd" className="text-xs font-medium text-muted-foreground">
                        Política de LGPD
                      </Label>
                      <Textarea
                        id="politica_lgpd"
                        rows={10}
                        className="font-mono text-xs leading-relaxed"
                        value={form.politica_lgpd ?? ""}
                        onChange={(e) => set("politica_lgpd")(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="politica_privacidade"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Política de privacidade
                      </Label>
                      <Textarea
                        id="politica_privacidade"
                        rows={10}
                        className="font-mono text-xs leading-relaxed"
                        value={form.politica_privacidade ?? ""}
                        onChange={(e) => set("politica_privacidade")(e.target.value)}
                      />
                    </div>
                  </fieldset>
                </Secao>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="min-w-0 space-y-4 lg:sticky lg:top-20">
            <Secao titulo="Cadastro da empresa" icone={completude === 100 ? <CheckCircle2 /> : <Circle />}>
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[clamp(1.2rem,1rem+0.8vw,1.6rem)] font-medium tabular-nums tracking-tight">
                    {completude}%
                  </span>
                  <Selo tom={completude === 100 ? "sucesso" : "alerta"}>
                    {completude === 100 ? "Completo" : `${faltando.length} faltando`}
                  </Selo>
                </div>
                <Progress value={completude} className="h-1.5" aria-label="Cadastro preenchido" />
                {faltando.length > 0 ? (
                  <ul className="space-y-1">
                    {faltando.map((f) => (
                      <li key={f.campo}>
                        <button
                          type="button"
                          onClick={() => {
                            setAba(f.aba);
                            setTimeout(() => document.getElementById(String(f.campo))?.focus(), 50);
                          }}
                          className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-muted-foreground transition-colors hover:bg-primary/[0.04] hover:text-foreground"
                        >
                          <Circle className="size-3.5 shrink-0 text-warning" />
                          {f.rotulo}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Todos os dados essenciais estão preenchidos.
                  </p>
                )}
              </div>
            </Secao>
          </aside>
        </form>
      )}

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-border/80 bg-card/95 px-4 py-3 shadow-[0_8px_24px_-12px_rgb(0_10_112/0.3)]">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className={`size-2 rounded-full ${alterado ? "bg-warning" : "bg-success"}`} />
          {alterado ? "Alterações não salvas" : "Tudo salvo"}
        </span>
        <Button
          type="button"
          className="min-h-11 sm:min-h-9"
          onClick={() => salvar.mutate()}
          disabled={!podeEditar || salvar.isPending || !alterado}
          title={podeEditar ? undefined : "Você não tem permissão para alterar os parâmetros."}
        >
          <Save className="mr-2 size-4" />
          {salvar.isPending ? "Salvando…" : "Salvar parâmetros"}
        </Button>
      </div>
    </PaginaGestao>
  );
}
