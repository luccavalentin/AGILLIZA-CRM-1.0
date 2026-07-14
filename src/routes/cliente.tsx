import { useEffect } from "react";
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { getSessaoCliente } from "@/lib/portal/cliente.functions";
import { registrarSwCliente } from "@/lib/portal/pwa-cliente";
import { ClienteShell } from "@/components/cliente/cliente-shell";

export const Route = createFileRoute("/cliente")({
  head: () => ({
    meta: [
      { title: "Meu Financiamento — Agilliza" },
      { name: "robots", content: "noindex" },
      { name: "theme-color", content: "#000F9F" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    ],
    links: [
      { rel: "manifest", href: "/manifest-cliente.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/cliente/apple-touch-icon.png" },
    ],
  }),
  loader: async () => {
    const { cliente } = await getSessaoCliente();
    if (!cliente) throw redirect({ to: "/portal" });
    if (!cliente.lgpd_aceito) throw redirect({ to: "/cliente-consentimento" });
    return { cliente };
  },
  component: ClienteLayout,
});

function ClienteLayout() {
  const { cliente } = Route.useLoaderData();
  const navigate = useNavigate();

  useEffect(() => {
    registrarSwCliente();
  }, []);

  return (
    <ClienteShell
      user={{ nome: cliente.nome, foto_url: cliente.foto_url }}
      onSignOut={() => navigate({ to: "/cliente/logout" })}
    >
      <Outlet />
    </ClienteShell>
  );
}
