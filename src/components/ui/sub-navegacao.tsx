import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Icone3D, type TomIcone3D } from "./icone-3d";

/**
 * Abas entre telas irmãs de um mesmo submenu (Conta, Gestão de tecnologia...), com o
 * ícone 3D de cada tela. A atual fica em papel branco; as outras, em cinza.
 *
 * @example
 *   <SubNavegacao rotulo="Conta" itens={[
 *     { to: "/conta/perfil", rotulo: "Meus dados", icone: UserRound },
 *     { to: "/conta/seguranca", rotulo: "Segurança", icone: Lock, tom: "sucesso" },
 *   ]} />
 */
export interface ItemSubNavegacao {
  to: string;
  rotulo: string;
  icone: LucideIcon;
  tom?: TomIcone3D;
  /** Só ativo no caminho exato (para a tela-raiz do grupo). */
  exato?: boolean;
}

export function SubNavegacao({
  itens,
  rotulo,
  className,
}: {
  itens: ItemSubNavegacao[];
  rotulo: string;
  className?: string;
}) {
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const atual = (i: ItemSubNavegacao) =>
    i.exato
      ? caminho === i.to || caminho === `${i.to}/`
      : caminho === i.to || caminho.startsWith(`${i.to}/`);
  // No celular o trilho rola de lado: a aba atual entra na tela sozinha.
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = nav.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const trilho = nav.current;
    if (el && trilho && trilho.scrollWidth > trilho.clientWidth) {
      const dx = el.getBoundingClientRect().left - trilho.getBoundingClientRect().left;
      trilho.scrollLeft += dx - (trilho.clientWidth - el.offsetWidth) / 2;
    }
  }, [caminho]);
  return (
    <nav ref={nav} aria-label={rotulo} className={cn("subnav-3d", className)}>
      {itens.map((i) => (
        <Link
          key={i.to}
          to={i.to as never}
          // Sem isto o Link marca a tela-raiz (`exato`) como atual em todas as filhas.
          activeOptions={{ exact: !!i.exato }}
          aria-current={atual(i) ? "page" : undefined}
        >
          <Icone3D icone={i.icone} tom={i.tom ?? "marca"} tamanho="sm" />
          {i.rotulo}
        </Link>
      ))}
    </nav>
  );
}
