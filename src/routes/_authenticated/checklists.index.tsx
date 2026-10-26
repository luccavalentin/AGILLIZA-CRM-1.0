import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, FileCheck2, ListChecks } from "lucide-react";
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
import { CHECKLISTS_BANCOS } from "@/lib/formularios/checklists.functions";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/checklists/")({
  beforeLoad: () => assertModuloPermitido("documentos.formularios"),
  head: () => ({ meta: [{ title: "Checklists — Agilliza" }] }),
  component: Pagina,
});

/** Cartão compacto de banco: logo oficial, nome e quantos itens. */
function CartaoBanco({ nome, detalhe }: { nome: string; detalhe: string }) {
  return (
    <span className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5 transition-all hover:border-primary/40 hover:shadow-sm">
      <BancoLogo nome={nome} size="lg" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{nome}</span>
        <span className="block truncate text-xs text-muted-foreground">{detalhe}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </span>
  );
}

function Secao({ titulo, descricao, children }: { titulo: string; descricao: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
        <p className="text-xs text-muted-foreground">{descricao}</p>
      </div>
      {children}
    </section>
  );
}

function Pagina() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Checklists</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Listas prontas para conferir com o cliente e enviar por WhatsApp ou e-mail.
        </p>
      </header>

      <Secao titulo="Docs para abertura de conta" descricao="O mínimo que cada banco pede para abrir a conta do cliente.">
        <div data-tour="checklists-abertura" className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {BANCOS_ABERTURA.map((banco) => {
            const checklist = CHECKLIST_ABERTURA_CONTA[banco];
            return (
              <Link key={banco} to="/checklists/$id" params={{ id: checklist.id }} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <CartaoBanco nome={NOME_BANCO_ABERTURA[banco]} detalhe={`${totalItens(checklist)} itens`} />
              </Link>
            );
          })}
        </div>
      </Secao>

      <Secao titulo="Docs para sequenciar proposta" descricao="O dossiê para dar andamento à proposta — igual para todos os bancos.">
        <Link to="/checklists/$id" params={{ id: CHECKLIST_PROPOSTA.id }} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span data-tour="checklists-proposta" className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-3 transition-all hover:border-primary/40 hover:shadow-sm">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileCheck2 className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">{CHECKLIST_PROPOSTA.titulo}</span>
              <span className="block text-xs text-muted-foreground">
                {totalItens(CHECKLIST_PROPOSTA)} itens em {CHECKLIST_PROPOSTA.blocos.length} blocos
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </span>
        </Link>
      </Secao>

      <Secao titulo="Checklist de documentos por banco" descricao="A lista completa da esteira de crédito de cada banco, com PDF.">
        <div data-tour="checklists-por-banco" className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {BANCOS_EXIGIDOS.map((banco) => (
            <Link
              key={banco}
              to="/formularios/$banco"
              params={{ banco: "checklist" }}
              search={{ banco }}
              className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CartaoBanco
                nome={NOME_BANCO_EXIGIDO[banco]}
                detalhe={`${(CHECKLISTS_BANCOS[banco]?.docs ?? []).filter((d) => !d.trim().endsWith(":")).length} documentos`}
              />
            </Link>
          ))}
        </div>
      </Secao>

      <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
        <ListChecks className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          As marcações feitas nas listas servem para a conferência na hora e não ficam gravadas.
        </span>
      </div>
    </div>
  );
}
