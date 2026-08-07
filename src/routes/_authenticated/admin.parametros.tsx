import { AdminHero } from "@/components/admin/admin-hero";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  obterParametros,
  salvarParametros,
  type ParametrosGlobais,
} from "@/lib/admin/parametros.functions";
import { mascararCep, cepValido, consultarCep } from "@/lib/cep";


export const Route = createFileRoute("/_authenticated/admin/parametros")({
  head: () => ({ meta: [{ title: "Cadastro da Empresa — Agilliza" }] }),
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

function Secao({
  numero,
  icon,
  titulo,
  descricao,
  children,
}: {
  numero: string;
  icon: ReactNode;
  titulo: string;
  descricao: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <div className="flex items-center gap-3 border-b border-border/60 bg-muted/30 px-5 py-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.18em] text-primary/70">
              {numero}
            </span>
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
              {titulo}
            </h2>
          </div>
          <p className="truncate text-xs text-muted-foreground">{descricao}</p>
        </div>
      </div>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

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
  inputMode?: "text" | "numeric";
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
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
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur?.(e.target.value)}
        />
        {busy && (
          <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

function Pagina() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-parametros"],
    queryFn: () => obterParametros(),
  });
  const [form, setForm] = useState<Form>(VAZIO);
  const [salvo, setSalvo] = useState<Form>(VAZIO);

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

  const salvar = useMutation({
    mutationFn: () => salvarParametros({ data: form }),
    onSuccess: () => {
      toast.success("Cadastro da empresa salvo.");
      setSalvo(form);
      qc.invalidateQueries({ queryKey: ["admin-parametros"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
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


  const alterado = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(salvo),
    [form, salvo],
  );

  const completude = useMemo(() => {
    const essenciais: (keyof Form)[] = [
      "razao_social",
      "nome_fantasia",
      "nome_empresa",
      "cnpj",
      "cep",
      "logradouro",
      "cidade",
      "uf",
      "email_empresa",
      "telefone_empresa",
    ];
    const preenchidos = essenciais.filter((k) => (form[k] ?? "").toString().trim() !== "").length;
    return Math.round((preenchidos / essenciais.length) * 100);
  }, [form]);

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <AdminHero
        icon={<Building2 className="h-5 w-5" />}
        titulo="Cadastro da Empresa"
        descricao="Dados institucionais do correspondente: identificação, endereço, contatos e políticas."
        acoes={
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1.5">
            {completude === 100 ? (
              <CheckCircle2 className="size-4 text-emerald-500" />
            ) : (
              <Circle className="size-4 text-primary/60" />
            )}
            <span className="text-xs font-semibold text-foreground">{completude}%</span>
            <span className="text-[11px] text-muted-foreground">preenchido</span>
          </div>
        }
      />

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          salvar.mutate();
        }}
      >
        <Secao
          numero="01"
          icon={<Building2 className="size-5" />}
          titulo="Identificação"
          descricao="Razão social, nome fantasia e inscrições fiscais."
        >
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
        </Secao>

        <Secao
          numero="02"
          icon={<MapPin className="size-5" />}
          titulo="Endereço"
          descricao="Localização fiscal e sede do correspondente."
        >
          <div className="grid gap-4 sm:grid-cols-6">
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
          </div>
        </Secao>

        <Secao
          numero="03"
          icon={<Contact className="size-5" />}
          titulo="Contatos"
          descricao="Responsável e canais oficiais de atendimento."
        >
          <div className="grid gap-4 sm:grid-cols-2">
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
              value={form.email_empresa ?? ""}
              onChange={set("email_empresa")}
            />
            <Campo
              id="telefone_empresa"
              label="Telefone"
              value={form.telefone_empresa ?? ""}
              onChange={set("telefone_empresa")}
            />
            <Campo
              id="site"
              label="Site"
              value={form.site ?? ""}
              onChange={set("site")}
              placeholder="https://"
            />
          </div>
        </Secao>

        <Secao
          numero="04"
          icon={<ShieldCheck className="size-5" />}
          titulo="Políticas exibidas aos clientes"
          descricao="Textos legais apresentados no portal do cliente."
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="politica_lgpd" className="text-xs font-medium text-muted-foreground">
                Política de LGPD
              </Label>
              <Textarea
                id="politica_lgpd"
                rows={6}
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
                rows={6}
                className="font-mono text-xs leading-relaxed"
                value={form.politica_privacidade ?? ""}
                onChange={(e) => set("politica_privacidade")(e.target.value)}
              />
            </div>
          </div>
        </Secao>
      </form>

      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:-mx-6">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={`size-2 rounded-full ${alterado ? "bg-amber-500" : "bg-emerald-500"}`}
            />
            {alterado ? "Alterações não salvas" : "Tudo salvo"}
          </span>
          <Button
            type="button"
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || !alterado}
          >
            <Save className="mr-2 size-4" />
            {salvar.isPending ? "Salvando…" : "Salvar cadastro"}
          </Button>
        </div>
      </div>
    </div>
  );
}
