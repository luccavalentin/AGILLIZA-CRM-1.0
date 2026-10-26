import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Info, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabelaSimulacoes } from "@/components/simulacao/lista-page/tabela-simulacoes";
import { CartoesSimulacoes } from "@/components/simulacao/lista-page/cartoes-simulacoes";
import type { HandlersLinha } from "@/components/simulacao/lista-page/tipos";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { listarSimulacoesDaContaNativas } from "@/lib/plataforma/conta-nativa.functions";
import { useHandlersDeConta } from "./simulacoes-do-grupo";
import type { ContaAssinante } from "@/lib/plataforma/contas.functions";

/**
 * Simulações de uma conta assinante com os MESMOS cartões, tabela e ações da base própria.
 * A lista vem do Corretor (sem cópia); cada ação abre a simulação no Agilliza (espelho
 * idempotente, com as mesmas cotações) e chama o handler nativo da tela com o id de lá.
 */
export function SimulacoesDaContaNativas({
  conta,
  handlers,
}: {
  conta: ContaAssinante;
  /** Os handlers da própria tela de Simulações (ver, editar, PDFs, enviar…). */
  handlers: HandlersLinha;
}) {
  const listarFn = useServerFn(listarSimulacoesDaContaNativas);
  const [q, setQ] = useState("");
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setTermo(q.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPagina(1), [conta.id]);

  const consulta = useQuery({
    queryKey: ["simulacoes-conta", conta.id, termo, pagina],
    queryFn: () => listarFn({ data: { licenca: conta.id, termo: termo || null, pagina } }),
    staleTime: 30_000,
    placeholderData: (anterior) => anterior,
  });
  const itens = useMemo(() => consulta.data?.itens ?? [], [consulta.data]);
  const total = consulta.data?.total ?? 0;
  const porPagina = consulta.data?.porPagina ?? 20;

  // Mesma regra das listas de grupo: espelha pela conta da linha (aqui, a conta da tela).
  const handlersConta = useHandlersDeConta({
    itens,
    handlers,
    contaDaTela: conta.id,
    chaveLista: ["simulacoes-conta", conta.id],
  });

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Simulações de <strong>{conta.nome}</strong> (
          {conta.tipo === "imobiliaria" ? "imobiliária" : "corretor"}). Ver, editar, baixar e enviar
          funcionam como na sua base; ao enviar para aprovação, a proposta também aparece para o
          assinante acompanhar.
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-2">
        <div className="relative">
          <Label htmlFor="busca-simulacoes-conta" className="sr-only">
            Buscar simulação da conta
          </Label>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="busca-simulacoes-conta"
            className="h-11 pl-9 md:h-9"
            placeholder="Buscar por número ou cliente"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {consulta.isError && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(consulta.error, "Não foi possível carregar as simulações da conta.")}
        </p>
      )}

      <TabelaSimulacoes
        itens={itens}
        isLoading={consulta.isLoading}
        escopo="todas"
        verExcluidas={false}
        handlers={handlersConta}
      />
      <CartoesSimulacoes
        itens={itens}
        isLoading={consulta.isLoading}
        escopo="todas"
        verExcluidas={false}
        handlers={handlersConta}
      />

      {total > porPagina && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Button
            variant="outline"
            className="h-11 md:h-8"
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={pagina === 1}
          >
            Anterior
          </Button>
          <span className="text-xs font-semibold text-foreground">
            Página {pagina} de {Math.ceil(total / porPagina)}
          </span>
          <Button
            variant="outline"
            className="h-11 md:h-8"
            onClick={() => setPagina((p) => p + 1)}
            disabled={pagina >= Math.ceil(total / porPagina)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
