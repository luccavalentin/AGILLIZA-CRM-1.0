import { AdminHero } from "@/components/admin/admin-hero";
import { createFileRoute } from "@tanstack/react-router";
import { Percent } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  SecaoRegrasComissao,
  SimuladorComissao,
} from "@/components/financeiro/comissoes-gestao";

export const Route = createFileRoute("/_authenticated/admin/comissoes")({
  head: () => ({ meta: [{ title: "Repasses — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.comissoes"),
  component: Pagina,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-destructive">
      {error.message}
    </div>
  ),
});

function Pagina() {
  return (
    <div className="mx-auto w-full max-w-none space-y-6 p-4 md:p-6">
      <AdminHero
        icon={<Percent className="h-5 w-5" />}
        titulo="Repasses"
        descricao="Regras de repasse por banco, produto e faixa. Todo contrato emitido gera automaticamente o repasse de acordo com a regra configurada."
      />
      <SecaoRegrasComissao />
      <SimuladorComissao />
    </div>
  );
}
