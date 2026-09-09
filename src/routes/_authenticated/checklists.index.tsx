import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, FileCheck2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BancoLogo } from "@/components/bancos/banco-logo";
import {
  BANCOS_ABERTURA,
  CHECKLIST_ABERTURA_CONTA,
  CHECKLIST_PROPOSTA,
  NOME_BANCO_ABERTURA,
  totalItens,
} from "@/lib/formularios/checklists-operacao";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/checklists/")({
  beforeLoad: () => assertModuloPermitido("documentos.formularios"),
  head: () => ({ meta: [{ title: "Checklists — Agilliza" }] }),
  component: Pagina,
});

function Pagina() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Checklists</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Listas prontas para conferir com o cliente e enviar por WhatsApp ou e-mail.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Abertura de conta, por banco
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BANCOS_ABERTURA.map((banco) => {
            const checklist = CHECKLIST_ABERTURA_CONTA[banco];
            return (
              <Link key={banco} to="/checklists/$id" params={{ id: checklist.id }}>
                <Card className="h-full cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="flex flex-col items-center gap-3 p-5 text-center">
                    {/*
                      `BancoLogo` já entrega o "app icon" pronto: quadro branco
                      arredondado com a logo nas cores da marca. Envolvê-lo num
                      container colorido e ainda inverter apagava a logo e
                      deixava só um bloco sólido na tela.
                    */}
                    <BancoLogo nome={NOME_BANCO_ABERTURA[banco]} size="xl" />
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {NOME_BANCO_ABERTURA[banco]}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {totalItens(checklist)} itens
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Andamento da operação
        </h2>
        <Link to="/checklists/$id" params={{ id: CHECKLIST_PROPOSTA.id }}>
          <Card className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <FileCheck2 className="h-7 w-7 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground">{CHECKLIST_PROPOSTA.titulo}</h3>
                <p className="text-sm text-muted-foreground">{CHECKLIST_PROPOSTA.descricao}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {totalItens(CHECKLIST_PROPOSTA)} itens em{" "}
                  {CHECKLIST_PROPOSTA.blocos.length} blocos
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </section>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <ClipboardList className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          O checklist de documentos exigidos na esteira de crédito de cada banco continua em
          Documentos · Formulários · Checklist de Documentação.
        </span>
      </div>
    </div>
  );
}
