import { createFileRoute, notFound } from "@tanstack/react-router";
import { FormulariosView } from "@/components/formularios/formularios-view";
import { PapelTimbradoView } from "@/components/formularios/papel-timbrado-view";
import { PowerPointModelosView } from "@/components/formularios/powerpoint-modelos-view";
import { ChecklistBancosView } from "@/components/formularios/checklist-bancos-view";
import { BANCOS_FORMULARIO, type BancoFormulario } from "@/lib/formularios/formularios.functions";

import { z } from "zod";

export const Route = createFileRoute("/_authenticated/formularios/$banco")({
  validateSearch: (search: Record<string, unknown>) => {
    return z.object({
      banco: z.string().optional(),
    }).parse(search);
  },
  head: () => ({ meta: [{ title: "Formulários — Agilliza" }] }),
  component: Pagina,
});

function Pagina() {
  const { banco } = Route.useParams();
  if (banco === "papel-timbrado") return <PapelTimbradoView />;
  if (banco === "powerpoint") return <PowerPointModelosView />;
  if (banco === "checklist") return <ChecklistBancosView />;
  if (!BANCOS_FORMULARIO.includes(banco as BancoFormulario)) throw notFound();
  return <FormulariosView banco={banco as BancoFormulario} />;
}
