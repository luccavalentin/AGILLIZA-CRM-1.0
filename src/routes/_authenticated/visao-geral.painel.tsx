import { createFileRoute } from "@tanstack/react-router";
import { PainelView } from "@/components/reports/painel-view";

export const Route = createFileRoute("/_authenticated/visao-geral/painel")({
  head: () => ({ meta: [{ title: "Painel — Visão geral — Agilliza" }] }),
  component: Pagina,
});

function Pagina() {
  return (
    <PainelView
      modulo="visao-geral"
      eyebrow="Visão geral · Painel"
      titulo="Produção comercial"
      descricao="Como está a produção comercial agora."
      realtimeTabelas={["propostas", "simulacoes", "clientes"]}
      abrirTo="/relatorios/painel-geral"
    />
  );
}
