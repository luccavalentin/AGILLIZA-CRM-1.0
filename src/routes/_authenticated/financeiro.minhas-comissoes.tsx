import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { getMinhaSessao } from "@/lib/session.functions";
import { consultar } from "@/lib/financeiro/cliente";
import type { Demonstrativo } from "@/lib/financeiro/tipos";
import { Carregando, Erro, PaginaFin } from "@/components/financeiro/matriz/base";
import { DemonstrativoConteudo } from "@/components/financeiro/matriz/demonstrativo";

/** Demonstrativo individual: qualquer pessoa logada vê só as próprias comissões (fin_demonstrativo confere). */
export const Route = createFileRoute("/_authenticated/financeiro/minhas-comissoes")({
  head: () => ({ meta: [{ title: "Minhas comissões — Agilliza" }] }),
  component: Pagina,
});

function Pagina() {
  const sessao = useQuery({ queryKey: ["minha-sessao"], queryFn: () => getMinhaSessao() });
  const id = sessao.data?.profile?.id;
  const q = useQuery({
    queryKey: ["financeiro", "meu-demonstrativo", id],
    enabled: !!id,
    queryFn: () => consultar<Demonstrativo>("demonstrativo", { _pessoa: id }),
  });
  return (
    <PaginaFin
      titulo="Minhas comissões"
      descricao="Cada comissão sua com a base, o percentual gravado no lançamento, a situação e os pagamentos. Discorda de algum valor? Fale com o financeiro do correspondente."
      icone={UserRound}
    >
      {sessao.isLoading || q.isLoading ? <Carregando /> : q.error ? <Erro erro={q.error} onTentar={() => q.refetch()} /> : q.data ? <DemonstrativoConteudo d={q.data} /> : null}
    </PaginaFin>
  );
}
