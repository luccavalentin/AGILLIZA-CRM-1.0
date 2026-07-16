import { createFileRoute } from "@tanstack/react-router";
import { CentralChatPage } from "@/components/operacional/central-chat/central-chat";

export const Route = createFileRoute("/_authenticated/operacional/chats")({
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
