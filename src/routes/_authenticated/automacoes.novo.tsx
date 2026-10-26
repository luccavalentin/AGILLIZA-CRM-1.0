import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Compositor } from "@/components/automacoes/compositor";
import { EstadoErro, EstadoVazio, ListaCarregando, Secao } from "@/components/plataforma/kit";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { lerDia } from "@/lib/social/calendario";
import { carregarPostAgz, listarRedesAgz } from "@/lib/social/automacoes.functions";

type Busca = { post?: string; data?: string };

export const Route = createFileRoute("/_authenticated/automacoes/novo")({
  head: () => ({ meta: [{ title: "Novo post — Automações — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>): Busca => ({
    post: typeof s.post === "string" && /^[0-9a-f-]{36}$/i.test(s.post) ? s.post : undefined,
    data: typeof s.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.data) ? s.data : undefined,
  }),
  component: PaginaNovo,
});

function PaginaNovo() {
  const busca = Route.useSearch();
  const podeEditar = usePermissao("marketing.automacoes", "edit");
  const redesFn = useServerFn(listarRedesAgz);
  const postFn = useServerFn(carregarPostAgz);
  const redes = useQuery({ queryKey: ["automacoes", "redes"], queryFn: () => redesFn() });
  const post = useQuery({
    queryKey: ["automacoes", "post", busca.post ?? "novo"],
    queryFn: () => (busca.post ? postFn({ data: { id: busca.post } }) : Promise.resolve(null)),
    // O compositor começa do que estava salvo; não recarrega no meio da edição.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  if (redes.isLoading || post.isLoading)
    return (
      <Secao>
        <ListaCarregando linhas={5} />
      </Secao>
    );
  if (redes.isError || post.isError)
    return (
      <Secao>
        <EstadoErro
          mensagem={mensagemDeErro(
            redes.error ?? post.error,
            "Não foi possível abrir o compositor.",
          )}
          onTentar={() => {
            void redes.refetch();
            void post.refetch();
          }}
        />
      </Secao>
    );
  if (busca.post && !post.data)
    return (
      <Secao>
        <EstadoVazio titulo="Post não encontrado" descricao="Ele pode ter sido apagado." />
      </Secao>
    );
  return (
    <Compositor
      key={busca.post ?? "novo"}
      redes={redes.data ?? []}
      post={post.data ?? null}
      diaInicial={lerDia(busca.data)}
      podeEditar={podeEditar}
    />
  );
}
