import type { ReactNode } from "react";
import { Icone3D, type TomIcone3D } from "@/components/ui/icone-3d";

/**
 * Cabeçalho de página único do Agilliza (crítica de design, rodada 2).
 *
 * Antes havia 4 padrões (herói azul 36/700, cartão branco com ícone 24/600,
 * ícone + título solto, cartão claro com filete 18/700). Este é o padrão:
 * sem cartão, título 24/500, descrição 14/400, ações à direita. A seção
 * ("Plataforma", "Administrativo") vem em caixa de frase, discreta.
 *
 * 26/10/2026 (C00): o ícone virou a peça 3D do sistema (`Icone3D`), igual aos portais
 * dos assinantes. Quem passa `<Shield className="h-5 w-5" />` não precisa mudar nada:
 * o CSS do 3D ajusta tamanho e cor do glifo. `tom` muda a cor da peça.
 */
export function PageHeader({
  titulo,
  descricao,
  acoes,
  icone,
  secao,
  tom = "marca",
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  /** Ícone pequeno à esquerda do título (opcional). */
  icone?: ReactNode;
  /** Área do sistema, acima do título (opcional). */
  secao?: string;
  /** Cor da peça 3D do ícone (padrão: azul da marca). */
  tom?: TomIcone3D;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {icone && (
          <Icone3D tom={tom} tamanho="lg" className="mt-0.5">
            {icone}
          </Icone3D>
        )}
        <div className="min-w-0 space-y-0.5">
          {secao && <p className="text-xs font-medium text-muted-foreground">{secao}</p>}
          <h1 data-tour="titulo" className="text-xl font-medium tracking-tight text-foreground sm:text-2xl">
            {titulo}
          </h1>
          {descricao && (
            <p className="max-w-3xl text-sm font-normal text-muted-foreground">{descricao}</p>
          )}
        </div>
      </div>
      {acoes && (
        <div
          data-tour="acoes"
          className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end"
        >
          {acoes}
        </div>
      )}
    </header>
  );
}
