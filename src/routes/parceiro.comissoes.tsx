import { createFileRoute, redirect } from "@tanstack/react-router";

// O parceiro vê o próprio demonstrativo de comissões (só as dele; o banco confere).
export const Route = createFileRoute("/parceiro/comissoes")({
  beforeLoad: () => {
    throw redirect({ to: "/financeiro/minhas-comissoes" });
  },
});
