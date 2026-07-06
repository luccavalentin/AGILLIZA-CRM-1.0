import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, IdCard, MapPin, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClienteForm } from "@/components/crm/cliente-form";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/crm/clientes_/novo")({
  head: () => ({ meta: [{ title: "Novo cliente — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
});

const DICAS = [
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
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link to="/crm/clientes">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
              Novo cliente
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              Cadastre um novo cliente no CRM
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
          <ClienteForm />
        </div>
      </div>
    </div>
  );
}
