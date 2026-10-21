import { createFileRoute, redirect } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { AdminHero } from "@/components/admin/admin-hero";
import { FilaDosAssinantes } from "@/components/plataforma/fila-assinantes/fila";
import { assertModuloPermitido, moduloPermitido } from "@/lib/route-guards";

/**
 * Item "Fila de propostas dos assinantes" do menu Plataforma. A fila mora em
 * Operacional › Propostas (aba "Dos assinantes"), junto do fluxo de envio ao banco; este
 * endereço leva para lá. Quem tem a fila mas não vê Propostas usa a mesma fila aqui.
 */
export const Route = createFileRoute("/_authenticated/plataforma/fila")({
  head: () => ({ meta: [{ title: "Fila de propostas dos assinantes — Agilliza" }] }),
  beforeLoad: async () => {
    await assertModuloPermitido("saas.fila");
    if (await moduloPermitido("operacional.propostas")) {
      throw redirect({
        to: "/operacional/propostas",
        search: { aba: "assinantes" },
        replace: true,
      });
    }
  },
  component: Pagina,
});

function Pagina() {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 p-3 sm:space-y-6 sm:p-6">
      <AdminHero
        secao="Plataforma"
        icon={<Inbox className="h-5 w-5" />}
        titulo="Fila de propostas dos assinantes"
        descricao="Propostas enviadas por corretores e imobiliárias. Ficam pendentes até um analista assumir ou ser designado."
      />
      <FilaDosAssinantes />
    </div>
  );
}
