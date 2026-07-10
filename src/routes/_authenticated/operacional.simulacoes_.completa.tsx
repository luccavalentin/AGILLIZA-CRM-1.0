import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, FileText, Send, Home, User, Users, Landmark, ShieldCheck } from "lucide-react";
import { SecaoCabecalho } from "@/components/simulacao/secao-cabecalho";
import { assertModuloPermitido } from "@/lib/route-guards";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConsultandoOverlay } from "@/components/simulacao/consultando-overlay";
import { SecaoOperacaoImovel } from "@/components/simulacao/completa/secao-operacao-imovel";
import { SecaoTitular } from "@/components/simulacao/completa/secao-titular";
import { SecaoConjuge } from "@/components/simulacao/completa/secao-conjuge";
import { SecaoBancos } from "@/components/simulacao/completa/secao-bancos";
import { SecaoConsentimentos } from "@/components/simulacao/completa/secao-consentimentos";
import { formatBRL } from "@/lib/simulacao/format";
import { useSimulacaoCompleta } from "@/lib/simulacao/use-simulacao-completa";

export const Route = createFileRoute("/_authenticated/operacional/simulacoes_/completa")({
  head: () => ({ meta: [{ title: "Simulação completa — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.simulacoes"),
  validateSearch: (
    search: Record<string, unknown>,
  ): { duplicar?: string; origem?: "proposta" } => ({
    duplicar: typeof search.duplicar === "string" ? search.duplicar : undefined,
    origem: search.origem === "proposta" ? "proposta" : undefined,
  }),
  component: Pagina,
});

function Pagina() {
  const { duplicar, origem: origemFluxo } = Route.useSearch();
  const ctx = useSimulacaoCompleta({ duplicar, modoProposta: origemFluxo === "proposta" });
  const { router, modoProposta, f, enviando, concluidos, mostraConjuge, confirmRenda, setConfirmRenda, enviar, executarEnvio } = ctx;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 p-4 md:p-8">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
        onClick={() =>
          router.history.canGoBack()
            ? router.history.back()
            : router.navigate({ to: "/operacional/simulacoes" })
        }
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-gradient-to-br from-primary/5 via-card to-card p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
          <FileText className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {modoProposta ? "Nova Proposta" : "Solicitar Simulação Completa"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {modoProposta
              ? "Preencha a simulação completa e envie direto ao banco — a proposta é criada automaticamente."
              : "Preencha os dados para enviar aos bancos parceiros."}
          </p>
        </div>
      </div>

      <Card className="p-5 md:p-6">
        <SecaoOperacaoImovel ctx={ctx} />
      </Card>

      <Card className="p-5 md:p-6">
        <SecaoTitular ctx={ctx} />
      </Card>

      {mostraConjuge && (
        <Card className="p-5 md:p-6">
          <SecaoConjuge ctx={ctx} />
        </Card>
      )}

      <Card className="p-5 md:p-6">
        <SecaoBancos ctx={ctx} />
      </Card>

      <Card className="p-5 md:p-6">
        <SecaoConsentimentos ctx={ctx} />
      </Card>

      <div className="flex justify-end pt-1">
        <Button className="h-11 gap-2 px-8" onClick={enviar} disabled={enviando}>
          <Send className="h-4 w-4" /> Gerar Simulação
        </Button>
      </div>


      <ConsultandoOverlay aberto={enviando} total={f.bancos_ids.length} concluidos={concluidos} />

      <AlertDialog open={!!confirmRenda} onOpenChange={(o) => !o && setConfirmRenda(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renda abaixo do sugerido</AlertDialogTitle>
            <AlertDialogDescription>
              A renda informada de{" "}
              <span className="font-semibold text-foreground">
                {formatBRL(confirmRenda?.rendaInformada ?? 0)}
              </span>{" "}
              é inferior à renda familiar mínima estimada de{" "}
              <span className="font-semibold text-foreground">
                {formatBRL(confirmRenda?.rendaMinima ?? 0)}
              </span>{" "}
              para este financiamento. O banco poderá reprovar a operação. Deseja enviar mesmo
              assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar dados</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmRenda(null);
                void executarEnvio();
              }}
            >
              Enviar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
