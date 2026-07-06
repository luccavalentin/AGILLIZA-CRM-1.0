import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { logoutCliente } from "@/lib/portal/cliente.functions";

export const Route = createFileRoute("/cliente/logout")({
  head: () => ({ meta: [{ title: "Saindo…" }, { name: "robots", content: "noindex" }] }),
  component: Logout,
});

function Logout() {
  const navigate = useNavigate();
  useEffect(() => {
    logoutCliente().finally(() => navigate({ to: "/portal", replace: true }));
  }, [navigate]);
  return <p className="py-20 text-center text-sm text-muted-foreground">Saindo…</p>;
}
