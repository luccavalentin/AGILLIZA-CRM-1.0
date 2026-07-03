import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Settings2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  obterParametros,
  salvarParametros,
  type ParametrosGlobais,
} from "@/lib/admin/parametros.functions";

export const Route = createFileRoute("/_authenticated/admin/parametros")({
  head: () => ({ meta: [{ title: "Parâmetros Globais — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.parametros"),
  component: Pagina,
});

type Form = Omit<ParametrosGlobais, "id" | "logo_url">;

const VAZIO: Form = {
  nome_empresa: "",
  cnpj: "",
  cor_primaria: "",
  endereco: "",
  telefone_sac: "",
  politica_lgpd: "",
  politica_privacidade: "",
  email_dpo: "",
};

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
        cnpj: q.data.cnpj ?? "",
        cor_primaria: q.data.cor_primaria ?? "",
        endereco: q.data.endereco ?? "",
        telefone_sac: q.data.telefone_sac ?? "",
        politica_lgpd: q.data.politica_lgpd ?? "",
        politica_privacidade: q.data.politica_privacidade ?? "",
        email_dpo: q.data.email_dpo ?? "",
      });
    }
  }, [q.data]);

  const salvar = useMutation({
    mutationFn: () => salvarParametros({ data: form }),
    onSuccess: () => {
      toast.success("Parâmetros salvos.");
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
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <header className="flex items-center gap-3">
        <Settings2 className="size-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Parâmetros Globais</h1>
          <p className="text-sm text-muted-foreground">
            Dados institucionais e políticas exibidas aos clientes.
          </p>
        </div>
      </header>

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          salvar.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="nome_empresa">Nome da empresa</Label>
            <Input
              id="nome_empresa"
              value={form.nome_empresa ?? ""}
              onChange={(e) => set("nome_empresa")(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              value={form.cnpj ?? ""}
              onChange={(e) => set("cnpj")(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefone_sac">Telefone SAC</Label>
            <Input
              id="telefone_sac"
              value={form.telefone_sac ?? ""}
              onChange={(e) => set("telefone_sac")(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email_dpo">E-mail do DPO</Label>
            <Input
              id="email_dpo"
              type="email"
              value={form.email_dpo ?? ""}
              onChange={(e) => set("email_dpo")(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              value={form.endereco ?? ""}
              onChange={(e) => set("endereco")(e.target.value)}
            />
          </div>
        </div>

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
