import type { ReactNode } from "react";
import {
  CheckCircle2,
  Clock3,
  FileText,
  Hourglass,
  ShieldCheck,
  ShoppingCart,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Icone3D, type TomIcone3D } from "@/components/ui/icone-3d";
import { SubNavegacao } from "@/components/ui/sub-navegacao";
import { usePermissao } from "@/hooks/use-permissao";
import { ROTULO_STATUS, type StatusCompra } from "@/lib/admin/compras-regras";
import type { CompraLinha } from "@/lib/admin/compras.functions";
import "./compras.css";

/**
 * Peças das telas de Diversos > Pedidos de compras e Aprovação de compras (C67, 26/10/2026):
 * cartão de pedido com valor em destaque, situação, quem pediu e o histórico (pedido →
 * decisão com motivo → conta a pagar), e a sub-navegação entre as duas telas.
 */

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const TOM_STATUS: Record<StatusCompra, TomIcone3D> = {
  pendente: "alerta",
  aprovada: "sucesso",
  recusada: "perigo",
};

export function SeloStatusCompra({ status }: { status: string }) {
  const s = (status as StatusCompra) in ROTULO_STATUS ? (status as StatusCompra) : "pendente";
  const Icone = s === "aprovada" ? CheckCircle2 : s === "recusada" ? XCircle : Hourglass;
  return (
    <span className={cn("compra-selo", `compra-selo-${s}`)}>
      <Icone aria-hidden className="size-3.5" />
      {ROTULO_STATUS[s] ?? status}
    </span>
  );
}

function iniciais(nome: string | null | undefined) {
  return (nome ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Cartão de um pedido: o que é, quanto, quem pediu, situação e histórico. */
export function CartaoPedido({
  pedido,
  mostrarSolicitante,
  acoes,
}: {
  pedido: CompraLinha;
  mostrarSolicitante?: boolean;
  acoes?: ReactNode;
}) {
  const s =
    (pedido.status as StatusCompra) in TOM_STATUS ? (pedido.status as StatusCompra) : "pendente";
  return (
    <article className={cn("compra-cartao i3d-grupo", `compra-cartao-${s}`)}>
      <div className="compra-cartao-topo">
        <Icone3D icone={ShoppingCart} tom={TOM_STATUS[s]} tamanho="md" />
        <div className="min-w-0 flex-1">
          <p className="compra-cartao-meta">
            {pedido.numero ? (
              <span className="tabular-nums">Nº {pedido.numero}</span>
            ) : (
              <span>Sem número</span>
            )}
            {pedido.categoria && <span className="compra-categoria">{pedido.categoria}</span>}
          </p>
          <h3 className="compra-cartao-titulo" title={pedido.descricao}>
            {pedido.descricao}
          </h3>
        </div>
        <div className="compra-cartao-valor">
          <b className="tabular-nums">{brl(pedido.valor)}</b>
          <SeloStatusCompra status={pedido.status} />
        </div>
      </div>

      <ol className="compra-historico" aria-label="Histórico do pedido">
        <li>
          <span className="compra-ponto" aria-hidden />
          <span>
            {mostrarSolicitante ? (
              <>
                <span className="compra-avatar" aria-hidden>
                  {iniciais(pedido.solicitante_nome)}
                </span>
                <b>{pedido.solicitante_nome ?? "Solicitante"}</b> pediu
              </>
            ) : (
              <>Pedido enviado</>
            )}{" "}
            em <time dateTime={pedido.created_at}>{dataHora(pedido.created_at)}</time>
          </span>
        </li>
        {s === "pendente" ? (
          <li className="compra-historico-espera">
            <Clock3 aria-hidden className="size-3.5" />
            <span>Aguardando a decisão da gestão</span>
          </li>
        ) : (
          <li className={`compra-historico-${s}`}>
            <span className="compra-ponto" aria-hidden />
            <span>
              {s === "aprovada" ? "Aprovado" : "Recusado"}
              {pedido.aprovador_nome ? (
                <>
                  {" "}
                  por <b>{pedido.aprovador_nome}</b>
                </>
              ) : null}
              {pedido.aprovado_em && (
                <>
                  {" "}
                  em <time dateTime={pedido.aprovado_em}>{dataHora(pedido.aprovado_em)}</time>
                </>
              )}
              {pedido.observacao && <q className="compra-motivo">{pedido.observacao}</q>}
            </span>
          </li>
        )}
        {s === "aprovada" && pedido.payable_id && (
          <li>
            <FileText aria-hidden className="size-3.5 text-muted-foreground" />
            <span>Lançado em Contas a pagar</span>
          </li>
        )}
      </ol>

      {acoes && <div className="compra-cartao-acoes">{acoes}</div>}
    </article>
  );
}

/** Pedidos ↔ Aprovação: as duas telas de compras de Diversos, cada uma com a sua permissão. */
export function SubNavCompras() {
  const verPedidos = usePermissao("admin.compras.pedidos", "view");
  const verAprovacao = usePermissao("admin.compras.aprovacoes", "view");
  const itens = [
    verPedidos && {
      to: "/admin/compras/pedidos",
      rotulo: "Pedidos de compras",
      icone: ShoppingCart,
      tom: "marca" as const,
    },
    verAprovacao && {
      to: "/admin/compras/aprovacoes",
      rotulo: "Aprovação de compras",
      icone: ShieldCheck,
      tom: "sucesso" as const,
    },
  ].filter(Boolean) as {
    to: string;
    rotulo: string;
    icone: typeof ShoppingCart;
    tom: TomIcone3D;
  }[];
  if (itens.length < 2) return null;
  return <SubNavegacao rotulo="Compras" itens={itens} />;
}

/** Abas de situação com contagem (Todos, Aguardando, Aprovados, Recusados). */
export function AbasSituacao<T extends string>({
  valor,
  opcoes,
  aoMudar,
}: {
  valor: T;
  opcoes: { id: T; texto: string; n: number }[];
  aoMudar: (v: T) => void;
}) {
  return (
    <div role="tablist" aria-label="Situação" className="compra-abas">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={valor === o.id}
          data-depth="off"
          onClick={() => aoMudar(o.id)}
        >
          {o.texto}
          <span className="tabular-nums">{o.n}</span>
        </button>
      ))}
    </div>
  );
}
