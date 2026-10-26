import { createFileRoute } from "@tanstack/react-router";
import { Newspaper } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { NewsEquipePagina } from "@/components/news/news-equipe";

/**
 * Agilliza News para a equipe do Agilliza (C60): o que a curadoria publicou para todo o
 * ecossistema ou só para a equipe. Aberta a toda pessoa ativa da equipe (o banco confere).
 */
export const Route = createFileRoute("/_authenticated/news")({
  head: () => ({ meta: [{ title: "Agilliza News — Agilliza" }] }),
  component: Pagina,
});

function Pagina() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        secao="Agilliza News"
        icone={<Newspaper className="h-5 w-5" />}
        titulo="Agilliza News"
        descricao="Mercado, crédito, regras novas e os comunicados da Agilliza para a equipe."
      />
      <NewsEquipePagina />
    </div>
  );
}
