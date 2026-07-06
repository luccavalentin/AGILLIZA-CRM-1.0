import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/regras-modulos")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/pessoas", search: { tab: "regras" } });
  },
});
