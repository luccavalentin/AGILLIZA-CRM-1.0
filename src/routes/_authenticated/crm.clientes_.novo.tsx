import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, IdCard, Loader2, MapPin, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClienteForm } from "@/components/crm/cliente-form";
import { getPrefillCadastroProposta } from "@/lib/propostas/propostas.functions";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/crm/clientes_/novo")({
  head: () => ({ meta: [{ title: "Novo cliente — Agilliza" }] }),
  validateSearch: z.object({ proposta: z.string().uuid().optional(), enviar: z.coerce.number().optional() }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
});

const DICAS = [
  {
    icon: Users,
    titulo: "Vínculos de atendimento",
    texto: "Comece definindo os parceiros/usuários responsáveis pelo atendimento do cliente.",
  },
  {
    icon: IdCard,
    titulo: "Dados básicos",
    texto: "Documento e data de nascimento identificam o cliente e habilitam o login no portal.",
  },
  {
    icon: MapPin,
    titulo: "Endereço",
    texto: "Opcional agora — você pode complementar depois na ficha do cliente.",
  },
  {
    icon: ShieldCheck,
    titulo: "Portal do cliente",
    texto: "O acesso pode ser habilitado após salvar, sem criação de senha.",
  },
];

function Pagina() {
  const { proposta, enviar } = Route.useSearch();
  const getPrefill = useServerFn(getPrefillCadastroProposta);
  const prefill = useQuery({
    queryKey: ["prefill-cadastro-proposta", proposta],
    queryFn: () => getPrefill({ data: { proposta_id: proposta as string } }),
    enabled: Boolean(proposta),
  });

  const carregandoPrefill = Boolean(proposta) && prefill.isLoading;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link to={proposta ? "/operacional/propostas/$id" : "/crm/clientes"} params={proposta ? { id: proposta } : undefined as never}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
              Novo cliente
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {proposta
                ? "Complete o cadastro com os dados da proposta e vincule-o automaticamente"
                : "Cadastre um novo cliente no CRM"}
            </p>
          </div>
        </div>
        <div className="hidden size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary sm:grid">
          <UserPlus className="size-5" />
        </div>
      </div>


      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="order-last space-y-4 lg:order-first lg:sticky lg:top-6 lg:self-start">
          <Card className="overflow-hidden">
            <CardContent className="space-y-5 p-5">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Como preencher</p>
                <p className="text-xs text-muted-foreground">Campos com * são obrigatórios.</p>
              </div>
              <ul className="space-y-4">
                {DICAS.map((d) => (
                  <li key={d.titulo} className="flex gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                      <d.icon className="size-4" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium text-foreground">{d.titulo}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{d.texto}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>

        <div className="min-w-0">
          {carregandoPrefill ? (
            <div className="flex items-center justify-center rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando dados da proposta…
            </div>
          ) : (
            <ClienteForm
              inicial={proposta ? (prefill.data?.valores as any) : undefined}
              vincularPropostaId={proposta}
              enviarBancoAposVincular={enviar === 1}
            />
          )}
        </div>

      </div>
    </div>
  );
}
