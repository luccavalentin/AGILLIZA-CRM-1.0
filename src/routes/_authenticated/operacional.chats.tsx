import { createFileRoute } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { CentralChatPage } from "@/components/operacional/central-chat/central-chat";

export const Route = createFileRoute("/_authenticated/operacional/chats")({
  // O módulo de chat foi criado depois; níveis antigos que já viam Demandas
  // ou Clientes continuam com acesso para não perder a conversa interna.
  beforeLoad: () =>
    assertModuloPermitido("operacional.chats", [
      "operacional.demandas",
      "crm.clientes",
    ]),
  head: () => ({
    meta: [
      { title: "Central de Conversas · Operacional" },
      {
        name: "description",
        content:
          "Todos os chats do sistema — colegas, clientes e demandas — em um único painel.",
      },
    ],
  }),
  component: CentralChatPage,
});
