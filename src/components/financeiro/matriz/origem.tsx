/** Caminho do resumo até o lançamento de origem (relatórios, fluxo, painel). */
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

export interface Origem {
  tipo: string;
  id: string;
  proposta_id?: string | null;
}

export function LinkOrigem({ origem, rotulo = "Abrir" }: { origem: Origem; rotulo?: string }) {
  const classe = "inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline";
  const conteudo = (
    <>
      {rotulo} <ArrowUpRight className="h-3 w-3" />
    </>
  );
  switch (origem.tipo) {
    case "comissao_banco":
      return (
        <Link to="/financeiro/comissoes-bancos" search={{ id: origem.id }} className={classe}>
          {conteudo}
        </Link>
      );
    case "comissao_participante":
      return (
        <Link to="/financeiro/comissoes-corretores" search={{ id: origem.id }} className={classe}>
          {conteudo}
        </Link>
      );
    case "conta_pagar":
      return (
        <Link to="/financeiro/contas-a-pagar" search={{ id: origem.id }} className={classe}>
          {conteudo}
        </Link>
      );
    case "conta_receber":
      return (
        <Link to="/financeiro/contas-a-receber" search={{ id: origem.id }} className={classe}>
          {conteudo}
        </Link>
      );
    case "repasse_assinante":
      return (
        <Link to="/financeiro/repasses" className={classe}>
          {conteudo}
        </Link>
      );
    case "proposta":
      return (
        <Link to="/operacional/propostas/$id" params={{ id: origem.id }} className={classe}>
          {conteudo}
        </Link>
      );
    default:
      return null;
  }
}
