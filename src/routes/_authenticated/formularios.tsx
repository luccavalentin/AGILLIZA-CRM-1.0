import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/formularios")({
  head: () => ({ meta: [{ title: "Formulários — Agilliza" }] }),
  component: () => <Outlet />,
});
