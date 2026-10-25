/**
 * Banners patrocinados do ImobMatch (frente F3 do Corretor, 0275–0278): patrocinadores,
 * fila de criativos com a prévia do banner, pacotes e preços, campanhas no ar e métricas.
 * Tudo pelas funções `plataforma.patrocinio_*` (contrato `docs/imobmatch/CONTRATO-PATROCINADOS.md`),
 * lidas em `lib/plataforma/patrocinados.functions.ts` — sem regra nenhuma aqui.
 */
import { AbaCampanhas } from "./banners-campanhas";
import { AbaFilaCriativos } from "./banners-fila";
import { AbaMetricasBanners } from "./banners-metricas";
import { AbaPacotes } from "./banners-pacotes";
import { AbaPatrocinadores } from "./banners-patrocinadores";

export const ABAS_PATROCINADOS = [
  "patrocinadores",
  "criativos",
  "pacotes",
  "campanhas",
  "metricas",
] as const;
export type AbaPatrocinados = (typeof ABAS_PATROCINADOS)[number];

export const ROTULO_PATROCINADOS: Record<AbaPatrocinados, string> = {
  patrocinadores: "Patrocinadores",
  criativos: "Fila de criativos",
  pacotes: "Pacotes e preços",
  campanhas: "Campanhas no ar",
  metricas: "Métricas",
};

export function AbaBanners({ aba }: { aba: AbaPatrocinados }) {
  switch (aba) {
    case "patrocinadores":
      return <AbaPatrocinadores />;
    case "criativos":
      return <AbaFilaCriativos />;
    case "pacotes":
      return <AbaPacotes />;
    case "campanhas":
      return <AbaCampanhas />;
    case "metricas":
      return <AbaMetricasBanners />;
  }
}
