import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/formularios/")({
  beforeLoad: () => {
    throw redirect({ to: "/formularios/$banco", params: { banco: "itau" } });
  },
});
