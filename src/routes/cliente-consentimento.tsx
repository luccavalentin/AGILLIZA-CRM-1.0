import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import {
  getSessaoCliente,
  clienteRegistrarConsentimentoLGPD,
} from "@/lib/portal/cliente.functions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/cliente-consentimento")({
  head: () => ({
    meta: [
      { title: "Termo de Consentimento — Agilliza" },
      { name: "robots", content: "noindex" },
      { name: "theme-color", content: "#000F9F" },
    ],
  }),
  loader: async () => {
    const { cliente } = await getSessaoCliente();
    if (!cliente) throw redirect({ to: "/portal" });
    if (cliente.lgpd_aceito) throw redirect({ to: "/cliente/visao-geral" });
    return { cliente };
  },
  component: ConsentimentoLGPD,
});

function ConsentimentoLGPD() {
  const { cliente } = Route.useLoaderData();
  const navigate = useNavigate();
  const [aceito, setAceito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    if (!aceito) return;
    setEnviando(true);
    try {
      await clienteRegistrarConsentimentoLGPD();
      navigate({ to: "/cliente/visao-geral", replace: true });
    } catch {
      toast.error("Não foi possível registrar o consentimento. Tente novamente.");
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="bg-primary px-4 py-5 text-primary-foreground">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
          <ShieldCheck className="h-7 w-7 shrink-0" />
          <div>
            <p className="text-sm opacity-90">Olá, {cliente.nome}</p>
            <h1 className="text-lg font-semibold leading-tight">Termo de Consentimento — LGPD</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <p className="text-sm text-muted-foreground">
          Para acessar o App do Cliente pela primeira vez, precisamos do seu consentimento quanto ao
          tratamento dos seus dados pessoais, conforme a Lei nº 13.709/2018 (Lei Geral de Proteção
          de Dados — LGPD).
        </p>

        <div className="mt-4 max-h-[46vh] space-y-4 overflow-y-auto rounded-lg border border-border bg-card p-4 text-sm leading-relaxed text-card-foreground">
          <div>
            <h2 className="font-semibold">1. Dados coletados</h2>
            <p className="text-muted-foreground">
              Coletamos e tratamos dados cadastrais, de contato, documentos e informações
              necessárias à análise e ao acompanhamento do seu processo de financiamento imobiliário
              e crédito.
            </p>
          </div>
          <div>
            <h2 className="font-semibold">2. Finalidade</h2>
            <p className="text-muted-foreground">
              Seus dados são utilizados exclusivamente para viabilizar a simulação, a originação e o
              acompanhamento da sua proposta junto às instituições financeiras parceiras, além de
              comunicações sobre o andamento do seu processo.
            </p>
          </div>
          <div>
            <h2 className="font-semibold">3. Compartilhamento</h2>
            <p className="text-muted-foreground">
              As informações poderão ser compartilhadas com instituições financeiras e prestadores
              estritamente necessários à conclusão do seu processo, sempre respeitando a
              confidencialidade e a segurança dos dados.
            </p>
          </div>
          <div>
            <h2 className="font-semibold">4. Seus direitos</h2>
            <p className="text-muted-foreground">
              Você pode, a qualquer momento, solicitar acesso, correção, portabilidade ou exclusão
              dos seus dados diretamente pelo App, na área "Privacidade e meus dados (LGPD)".
            </p>
          </div>
          <div>
            <h2 className="font-semibold">5. Armazenamento</h2>
            <p className="text-muted-foreground">
              Seus dados são armazenados de forma segura pelo período necessário ao cumprimento das
              finalidades acima e das obrigações legais aplicáveis.
            </p>
          </div>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4">
          <Checkbox
            checked={aceito}
            onCheckedChange={(v) => setAceito(v === true)}
            className="mt-0.5"
          />
          <span className="text-sm text-card-foreground">
            Li e concordo com o Termo de Consentimento e autorizo o tratamento dos meus dados
            pessoais conforme descrito acima.
          </span>
        </label>

        <Button
          className="mt-5 w-full"
          size="lg"
          disabled={!aceito || enviando}
          onClick={confirmar}
        >
          {enviando ? "Registrando…" : "Aceitar e continuar"}
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          O seu aceite será registrado com data, hora e IP para fins de conformidade.
        </p>
      </main>
    </div>
  );
}
