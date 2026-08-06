import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/compras/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/compras/pedidos" });
  },
});
