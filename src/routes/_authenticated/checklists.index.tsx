import { createFileRoute, Link } from "@tanstack/react-router";
import { FileCheck2, ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BancoLogo } from "@/components/bancos/banco-logo";
import {
  BANCOS_ABERTURA,
  BANCOS_EXIGIDOS,
  CHECKLIST_ABERTURA_CONTA,
  CHECKLIST_PROPOSTA,
  NOME_BANCO_ABERTURA,
  NOME_BANCO_EXIGIDO,
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
        <p className="-mt-1 text-xs text-muted-foreground">
          O mínimo que cada instituição pede para abrir a conta do cliente.
        </p>
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
                      <p className="text-xs text-muted-foreground">{totalItens(checklist)} itens</p>
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
                  {totalItens(CHECKLIST_PROPOSTA)} itens em {CHECKLIST_PROPOSTA.blocos.length}{" "}
                  blocos
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </section>

      {/* Terceira família: a esteira de crédito. Ficava só em Documentos ·
          Formulários, fora daqui — quem abria "Checklists" não encontrava. */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Exigidos pelo banco, por instituição
        </h2>
        <p className="-mt-1 text-xs text-muted-foreground">
          A lista completa da esteira de crédito, com opção de baixar em PDF.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {BANCOS_EXIGIDOS.map((banco) => (
            <Link
              key={banco}
              to="/formularios/$banco"
              params={{ banco: "checklist" }}
              search={{ banco }}
            >
              <Card className="h-full cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="flex flex-col items-center gap-3 p-5 text-center">
                  <BancoLogo nome={NOME_BANCO_EXIGIDO[banco]} size="xl" />
                  <div>
                    <h3 className="font-semibold text-foreground">{NOME_BANCO_EXIGIDO[banco]}</h3>
                    <p className="text-xs text-muted-foreground">Documentos exigidos</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <ListChecks className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          As três famílias de checklist ficam aqui: abertura de conta, dossiê para seguir com a
          proposta e documentos exigidos pelo banco na esteira de crédito.
        </span>
      </div>
    </div>
  );
}
