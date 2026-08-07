import { createFileRoute, redirect } from "@tanstack/react-router";

// Consolidado: a tela do parceiro agora é a mesma do correspondente,
// com escopo restrito pela matriz de permissões.
export const Route = createFileRoute("/parceiro/simulacoes")({
  beforeLoad: () => {
    throw redirect({ to: "/operacional/simulacoes" });
  },
});
