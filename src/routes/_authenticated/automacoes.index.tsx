import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Calendario, type ModoCalendario } from "@/components/automacoes/calendario";
import { useRecarregarAutomacoes } from "@/components/automacoes/comum";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { lerDia, periodoDaVisao } from "@/lib/social/calendario";
import {
  listarRedesAgz,
  postsDoPeriodoAgz,
  reagendarPostAgz,
  resumoSemanaAgz,
} from "@/lib/social/automacoes.functions";

type Busca = { data?: string; visao?: "mes" | "semana" | "agenda" };

export const Route = createFileRoute("/_authenticated/automacoes/")({
  head: () => ({ meta: [{ title: "Calendário — Automações — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>): Busca => ({
    data: typeof s.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.data) ? s.data : undefined,
    visao: s.visao === "mes" || s.visao === "semana" || s.visao === "agenda" ? s.visao : undefined,
  }),
  component: PaginaCalendario,
});

function PaginaCalendario() {
  const busca = Route.useSearch();
  const base = useMemo(() => lerDia(busca.data) ?? new Date(), [busca.data]);
  const modo: ModoCalendario = busca.visao ?? "auto";
  const periodo = periodoDaVisao(base, modo === "semana" ? "semana" : "mes");
  const podeEditar = usePermissao("marketing.automacoes", "edit");
  const recarregar = useRecarregarAutomacoes();

  const postsFn = useServerFn(postsDoPeriodoAgz);
  const resumoFn = useServerFn(resumoSemanaAgz);
  const redesFn = useServerFn(listarRedesAgz);
  const reagendarFn = useServerFn(reagendarPostAgz);

  const de = periodo.de.toISOString();
  const ate = periodo.ate.toISOString();
  const posts = useQuery({
    queryKey: ["automacoes", "periodo", de, ate],
    queryFn: () => postsFn({ data: { de, ate } }),
    // A publicação acontece no servidor: a tela confere de 20 em 20 segundos.
    refetchInterval: 20_000,
  });
  const resumo = useQuery({
    queryKey: ["automacoes", "resumo"],
    queryFn: () => resumoFn(),
    refetchInterval: 60_000,
  });
  const redes = useQuery({ queryKey: ["automacoes", "redes"], queryFn: () => redesFn() });

  const reagendar = useMutation({
    mutationFn: (v: { id: string; quando: Date }) =>
      reagendarFn({ data: { id: v.id, quando: v.quando.toISOString() } }),
    onSuccess: (_, v) => {
      toast.success("Post reagendado", {
        description: v.quando.toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" }),
      });
      recarregar();
    },
    onError: (e) => {
      toast.error(mensagemDeErro(e, "Não foi possível reagendar."));
      recarregar();
    },
  });

  return (
    <Calendario
      base={base}
      modo={modo}
      posts={posts.data ?? []}
      carregando={posts.isLoading}
      resumo={resumo.data ?? null}
      contas={redes.data ? redes.data.filter((r) => r.status === "ativa").length : null}
      podeEditar={podeEditar}
      aoReagendar={(id, quando) => reagendar.mutate({ id, quando })}
    />
  );
}
