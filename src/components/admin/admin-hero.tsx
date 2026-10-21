import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/page-header";

/**
 * Cabeçalho das telas administrativas e da Plataforma.
 *
 * Mantém a API de antes, mas agora desenha o `PageHeader` único do sistema
 * (sem cartão, título 24/500): antes era um cartão claro com filete e título
 * 18/700, um dos 4 padrões de cabeçalho que conviviam no Agilliza.
 */
export function AdminHero({
  icon,
  titulo,
  descricao,
  acoes,
  secao = "Administrativo",
}: {
  icon: ReactNode;
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
  secao?: string;
}) {
  return (
    <PageHeader icone={icon} secao={secao} titulo={titulo} descricao={descricao} acoes={acoes} />
  );
}
