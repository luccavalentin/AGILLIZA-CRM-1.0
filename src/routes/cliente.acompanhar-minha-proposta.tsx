import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History, Landmark, ListChecks, Route as IconeRota } from "lucide-react";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { semMarcaIntegracao } from "@/lib/texto/sem-marca-integracao";
import { pollingPortal } from "@/lib/portal/polling";
import { clienteObterAcompanhamento } from "@/lib/portal/cliente.functions";
import { clienteInicio } from "@/lib/portal/cliente-portal.functions";
import { etapaAtual, nomeEtapa, progressoJornada } from "@/lib/portal/jornada";
import { CabecalhoPagina } from "@/components/cliente/cabecalho-pagina";
import { JornadaCompra } from "@/components/cliente/portal/jornada-compra";
import { Bloco, CartaoProposta, Carregando, ErroCarregar, Vazio } from "@/components/cliente/portal/partes";

export const Route = createFileRoute("/cliente/acompanhar-minha-proposta")({
  head: () => ({ meta: [{ title: "Minha proposta — Meu Financiamento" }] }),
  component: MinhaProposta,
});

function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * Minha proposta (C15): a jornada inteira com o que cada etapa quer dizer, as propostas
 * com o ID H. e as condições aprovadas, e as últimas movimentações do processo.
 */
function MinhaProposta() {
  const inicio = useQuery({
    queryKey: ["cliente", "inicio"],
    queryFn: () => clienteInicio(),
    ...pollingPortal(30_000),
  });
  const acomp = useQuery({
    queryKey: ["cliente", "acompanhamento"],
    queryFn: () => clienteObterAcompanhamento(),
    ...pollingPortal(30_000),
  });

  if (inicio.isError && !inicio.data) {
    return (
      <ErroCarregar
        mensagem={mensagemDeErro(inicio.error, "Não foi possível carregar sua proposta.")}
        aoTentar={() => inicio.refetch()}
        ocupado={inicio.isFetching}
      />
    );
  }
  if (!inicio.data) return <Carregando linhas={2} />;

  const d = inicio.data;
  const atual = etapaAtual(d.jornada);
  const historico = acomp.data?.historico ?? [];

  return (
    <div className="space-y-4 sm:space-y-5">
      <CabecalhoPagina
        icon={ListChecks}
        titulo="Minha proposta"
        subtitulo={`${atual ? `Agora: ${nomeEtapa(atual.nome)}` : "Compra concluída"} · ${progressoJornada(d.jornada)}% da jornada`}
      />

      <Bloco titulo="Propostas" icone={Landmark}>
        {d.propostas.length === 0 ? (
          <Vazio
            icone={Landmark}
            titulo="Ainda sem proposta aprovada"
            texto="Quando o banco aprovar o seu crédito, a proposta aparece aqui com o número (ID H.) e as condições aprovadas."
          />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {d.propostas.map((p) => (
              <CartaoProposta key={p.id} p={p} detalhada />
            ))}
          </div>
        )}
      </Bloco>

      <div className="grid gap-4 lg:grid-cols-5">
        <Bloco titulo="Etapas da compra" icone={IconeRota} className="lg:col-span-3">
          <JornadaCompra etapas={d.jornada} />
        </Bloco>
        <Bloco titulo="Últimas movimentações" icone={History} className="lg:col-span-2">
          {acomp.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">As movimentações do seu processo aparecem aqui.</p>
          ) : (
            <ol className="space-y-3">
              {historico.map((h) => (
                <li key={h.id} className="relative border-l-2 border-primary/20 pl-3">
                  <p className="text-sm text-foreground">{semMarcaIntegracao(h.descricao)}</p>
                  <p className="text-xs text-muted-foreground">{dataHora(h.created_at)}</p>
                </li>
              ))}
            </ol>
          )}
        </Bloco>
      </div>
    </div>
  );
}
