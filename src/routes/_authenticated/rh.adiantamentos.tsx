import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { LancamentosPage } from "@/components/rh/lancamentos-page";
import { listarAdiantamentos, registrarAdiantamento } from "@/lib/rh/submodulos.functions";

export const Route = createFileRoute("/_authenticated/rh/adiantamentos")({
  head: () => ({ meta: [{ title: "Adiantamentos — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.adiantamentos"),
  component: () => (
    <LancamentosPage
      titulo="Adiantamentos"
      descricao="Vales e adiantamentos concedidos, com desconto na folha da competência."
      icon={Wallet}
      queryKey="rh-adiantamentos"
      listarFn={listarAdiantamentos}
      salvarFn={registrarAdiantamento}
      labelBotao="Novo adiantamento"
      labelValor="Valor do vale"
    />
  ),
});
