import { createFileRoute } from "@tanstack/react-router";
import { Minus } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { LancamentosPage } from "@/components/rh/lancamentos-page";
import { listarDescontos, registrarDesconto } from "@/lib/rh/submodulos.functions";

export const Route = createFileRoute("/_authenticated/rh/descontos")({
  head: () => ({ meta: [{ title: "Descontos — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.descontos"),
  component: () => (
    <LancamentosPage
      titulo="Descontos"
      descricao="Descontos diversos aplicados na folha (danos, faltas, empréstimos)."
      icon={Minus}
      queryKey="rh-descontos"
      listarFn={listarDescontos}
      salvarFn={registrarDesconto}
      labelBotao="Novo desconto"
      labelValor="Valor do desconto"
    />
  ),
});
