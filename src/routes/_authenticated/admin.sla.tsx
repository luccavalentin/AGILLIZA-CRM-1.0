import { AdminHero } from "@/components/admin/admin-hero";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Timer, Tags, Signal } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarCatalogoSla,
  type CategoriaCatalogo,
} from "@/lib/admin/sla.functions";
import { SecaoSla } from "@/components/admin/sla-page/secao-sla";
import { SecaoCatalogo } from "@/components/admin/sla-page/secao-catalogo";
import { SecaoFeriados } from "@/components/admin/sla-page/secao-feriados";

export const Route = createFileRoute("/_authenticated/admin/sla")({
  head: () => ({ meta: [{ title: "SLA & Feriados — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.sla"),
  component: Pagina,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-destructive">
      {error.message}
    </div>
  ),
});

function useCatalogo(categoria: CategoriaCatalogo) {
  const listar = useServerFn(listarCatalogoSla);
  return useQuery({
    queryKey: ["admin-sla-catalogo", categoria],
    queryFn: () => listar({ data: { categoria } }),
  });
}

function Pagina() {
  const tipos = useCatalogo("tipo_demanda");
  const prioridades = useCatalogo("prioridade");
  const canais = useCatalogo("canal");

  return (
    <div className="mx-auto w-full max-w-none space-y-6 p-4 md:p-6">
      <AdminHero
        icon={<Timer className="h-5 w-5" />}
        titulo="SLA & Feriados"
        descricao="Prazos por tipo de demanda e prioridade (horas úteis), catálogos configuráveis e calendário de feriados."
      />

      <SecaoSla tipos={tipos.data} prioridades={prioridades.data} canais={canais.data} />

      <div className="grid gap-6 lg:grid-cols-2">
        <SecaoCatalogo
          categoria="tipo_demanda"
          titulo="Tipos de demanda"
          icon={<Tags className="h-4 w-4 text-muted-foreground" />}
          q={tipos}
        />
        <SecaoCatalogo
          categoria="prioridade"
          titulo="Prioridades"
          icon={<Signal className="h-4 w-4 text-muted-foreground" />}
          q={prioridades}
        />
      </div>

      <SecaoFeriados />
    </div>
  );
}
