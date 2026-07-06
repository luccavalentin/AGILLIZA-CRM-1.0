import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  obterParametros,
  salvarParametros,
  type ParametrosGlobais,
} from "@/lib/admin/parametros.functions";

export const Route = createFileRoute("/_authenticated/admin/parametros")({
  head: () => ({ meta: [{ title: "Cadastro da Empresa — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.parametros"),
  component: Pagina,
});

type Form = Omit<ParametrosGlobais, "id" | "logo_url" | "cor_primaria">;

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
  politica_lgpd: "",
  politica_privacidade: "",
  email_dpo: "",
};

function Campo({
  id,
  label,
  value,
  onChange,
  type,
  className,
  placeholder,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
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

  useEffect(() => {
    if (q.data) {
      setForm({
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
        politica_lgpd: q.data.politica_lgpd ?? "",
        politica_privacidade: q.data.politica_privacidade ?? "",
        email_dpo: q.data.email_dpo ?? "",
      });
    }
  }, [q.data]);

  const salvar = useMutation({
    mutationFn: () => salvarParametros({ data: form }),
    onSuccess: () => {
      toast.success("Cadastro da empresa salvo.");
      qc.invalidateQueries({ queryKey: ["admin-parametros"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (q.isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <header className="flex items-center gap-3">
        <Building2 className="size-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Cadastro da Empresa</h1>
          <p className="text-sm text-muted-foreground">
            Dados completos do correspondente: identificação, endereço e contatos.
          </p>
        </div>
      </header>

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          salvar.mutate();
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identificação</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Endereço</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-6">
            <Campo
              id="cep"
              label="CEP"
              value={form.cep ?? ""}
              onChange={set("cep")}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contatos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
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
              id="telefone_sac"
              label="Telefone SAC"
              value={form.telefone_sac ?? ""}
              onChange={set("telefone_sac")}
            />
            <Campo
              id="site"
              label="Site"
              value={form.site ?? ""}
              onChange={set("site")}
              placeholder="https://"
            />
            <Campo
              id="email_dpo"
              label="E-mail do DPO"
              type="email"
              value={form.email_dpo ?? ""}
              onChange={set("email_dpo")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Políticas exibidas aos clientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="politica_lgpd">Política de LGPD</Label>
              <Textarea
                id="politica_lgpd"
                rows={6}
                value={form.politica_lgpd ?? ""}
                onChange={(e) => set("politica_lgpd")(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="politica_privacidade">Política de privacidade</Label>
              <Textarea
                id="politica_privacidade"
                rows={6}
                value={form.politica_privacidade ?? ""}
                onChange={(e) => set("politica_privacidade")(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={salvar.isPending}>
            <Save className="mr-2 size-4" />
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
