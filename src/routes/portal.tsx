import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { BiometricAuth } from "@/components/auth/BiometricAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validarAcessoCliente } from "@/lib/portal/cliente.functions";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [{ title: "Portal do Cliente — Agilliza" }, { name: "robots", content: "noindex" }],
  }),
  component: PortalCliente,
});

function maskCPF(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskCNPJ(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function PortalCliente() {
  const [documento, setDocumento] = useState("");
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  async function acessar(e: React.FormEvent<HTMLFormElement>, tipo: "PF" | "PJ") {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = String(form.get("data"));
    setCarregando(true);
    try {
      const resultado = await validarAcessoCliente({
        data: { tipo, documento: documento.replace(/\D/g, ""), data },
      });
      if (!resultado.ok) {
        toast.error(resultado.error ?? "Não foi possível acessar.");
        return;
      }
      // Salva documento para biometria futura
      localStorage.setItem("last_logged_in_email", documento);

      navigate({ to: "/cliente/visao-geral", replace: true });
    } catch {
      toast.error("Não foi possível acessar. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <AuthSplitLayout
      portalNome="Portal do Cliente"
      portalDescricao="Acesse com seus dados para acompanhar o processo."
      bannerTitulo="Acompanhe seu financiamento em tempo real."
      bannerSubtitulo="Consulte o andamento do seu processo, documentos e próximos passos."
      recursos={[
        { titulo: "Andamento", descricao: "Veja cada etapa do seu financiamento." },
        { titulo: "Documentos", descricao: "Envie e consulte tudo pelo celular." },
        { titulo: "Atendimento", descricao: "Fale com seu consultor pelo chat." },
      ]}
    >
      <Tabs defaultValue="pf" className="mt-6 w-full" onValueChange={() => setDocumento("")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pf">Pessoa Física</TabsTrigger>
          <TabsTrigger value="pj">Pessoa Jurídica</TabsTrigger>
        </TabsList>

        <TabsContent value="pf">
          <form onSubmit={(e) => acessar(e, "PF")} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={documento}
                onChange={(e) => setDocumento(maskCPF(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nasc">Data de nascimento</Label>
              <Input id="nasc" name="data" type="date" required />
            </div>
            <Button type="submit" className="w-full" disabled={carregando}>
              {carregando ? "Acessando…" : "Acessar Portal"}
            </Button>
            <BiometricAuth
              onSuccess={(doc) => console.log("Biometria cliente:", doc)}
              disabled={carregando}
            />
          </form>
        </TabsContent>

        <TabsContent value="pj">
          <form onSubmit={(e) => acessar(e, "PJ")} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                value={documento}
                onChange={(e) => setDocumento(maskCNPJ(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="abertura">Data de abertura</Label>
              <Input id="abertura" name="data" type="date" required />
            </div>
            <Button type="submit" className="w-full" disabled={carregando}>
              {carregando ? "Acessando…" : "Acessar Portal"}
            </Button>
            <BiometricAuth
              onSuccess={(doc) => console.log("Biometria cliente PJ:", doc)}
              disabled={carregando}
            />
          </form>
        </TabsContent>
      </Tabs>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Ainda não tem acesso? Peça ao seu correspondente para habilitar seu Portal do Cliente.
      </p>
    </AuthSplitLayout>
  );
}
