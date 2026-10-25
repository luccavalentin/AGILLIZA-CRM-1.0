/**
 * Banners patrocinados do ImobMatch (frente F3 do Corretor): patrocinadores, fila de
 * criativos com a prévia do banner, pacotes e preços, campanhas no ar e métricas.
 *
 * As abas estão PRONTAS PARA LIGAR: o desenho e a permissão (`saas.patrocinados`) já
 * existem; as funções `plataforma.*` dos banners e o contrato delas
 * (`docs/imobmatch/CONTRATO-PATROCINADOS.md` da F3) ainda não chegaram. Quando chegarem,
 * cada aba troca o aviso abaixo pela lista lida de um `patrocinados.functions.ts` — sem
 * regra nenhuma aqui (preço, aprovação e pausa são do banco).
 */
import {
  BarChart3,
  Building,
  GalleryHorizontalEnd,
  Megaphone,
  Package,
  PlugZap,
} from "lucide-react";
import type { ReactNode } from "react";

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

const CONTEUDO: Record<AbaPatrocinados, { icone: ReactNode; titulo: string; texto: string }> = {
  patrocinadores: {
    icone: <Building className="size-5" aria-hidden />,
    titulo: "Empresas que anunciam banners",
    texto:
      "A lista das empresas patrocinadoras (bancos, construtoras, serviços), com a situação da conta, o que compraram e o que está no ar.",
  },
  criativos: {
    icone: <GalleryHorizontalEnd className="size-5" aria-hidden />,
    titulo: "Banners esperando aprovação",
    texto:
      "Cada criativo enviado pelo patrocinador, com a prévia do banner do jeito que vai aparecer no portal, para aprovar ou reprovar com motivo.",
  },
  pacotes: {
    icone: <Package className="size-5" aria-hidden />,
    titulo: "Pacotes e preços",
    texto:
      "Os pacotes de exibição e os preços da tabela configurável. O que nasce sem preço aprovado pelo dono fica fora de venda até ser posto à venda aqui.",
  },
  campanhas: {
    icone: <Megaphone className="size-5" aria-hidden />,
    titulo: "Campanhas no ar",
    texto:
      "As campanhas que estão aparecendo agora, com período, praça e entrega — e o botão de pausar quando for preciso.",
  },
  metricas: {
    icone: <BarChart3 className="size-5" aria-hidden />,
    titulo: "Métricas dos banners",
    texto: "Impressões, cliques e taxa de clique por campanha, patrocinador e período.",
  },
};

/** Aba de banners pronta para ligar (aguarda o contrato das funções da F3). */
export function AbaPatrocinadosPronta({ aba }: { aba: AbaPatrocinados }) {
  const c = CONTEUDO[aba];
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
        {c.icone}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{c.titulo}</p>
        <p className="mx-auto max-w-lg text-sm text-muted-foreground">{c.texto}</p>
      </div>
      <p className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
        <PlugZap className="size-3.5" aria-hidden /> Tela pronta. Liga quando a gestão dos banners
        chegar ao banco.
      </p>
    </div>
  );
}
