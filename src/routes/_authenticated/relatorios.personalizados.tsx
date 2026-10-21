import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Play, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listarReportsBase,
  listarFiltrosSalvos,
  salvarFiltro,
  excluirFiltro,
  getEscopoRelatorios,
} from "@/lib/relatorios/reports.functions";
import { getMinhaSessao } from "@/lib/session.functions";
import { ESCOPO_LABEL, PERIODO_LABEL, type Escopo, type Periodo } from "@/lib/relatorios/shared";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { mensagemDeErro } from "@/lib/erros/mensagem";

export const Route = createFileRoute("/_authenticated/relatorios/personalizados")({
  // Sem permissão de relatórios, a URL direta levava à tela mesmo com o
  // item escondido no menu (QA 19/09/2026).
  beforeLoad: () => assertModuloPermitido("relatorios.geral"),
  head: () => ({ meta: [{ title: "Personalizados — Relatórios — Agilliza" }] }),
  component: Pagina,
});

const PERIODOS: Periodo[] = ["hoje", "7d", "15d", "30d", "mes", "mes_anterior", "ano", "custom"];
// "Equipe" saiu do produto (mesmo seletor dos relatórios: Minha e Geral).
const ESCOPOS: Escopo[] = ["minha", "geral"];
/** Salvos antigos com "equipe" abrem como "Geral" (o servidor já trata os dois iguais). */
const rotuloEscopo = (e: string) => ESCOPO_LABEL[(e === "equipe" ? "geral" : e) as Escopo] ?? e;

/**
 * Nome e endereço de cada base. As duas bases operacionais não têm tela própria:
 * moram em /relatorios/operacional, escolhidas pelo `tipo` — o "Executar" delas
 * abria uma URL inexistente (404).
 */
const BASES: Record<string, { rotulo: string; rota: string; busca?: Record<string, string> }> = {
  consolidado: { rotulo: "Consolidado", rota: "/relatorios/consolidado" },
  comerciais: { rotulo: "Comerciais", rota: "/relatorios/comerciais" },
  simulacoes: { rotulo: "Simulações", rota: "/relatorios/simulacoes" },
  propostas: { rotulo: "Propostas", rota: "/relatorios/propostas" },
  crm: { rotulo: "CRM", rota: "/relatorios/crm" },
  clientes: { rotulo: "Clientes", rota: "/relatorios/clientes" },
  demandas: { rotulo: "Demandas", rota: "/relatorios/demandas" },
  tarefas: { rotulo: "Tarefas", rota: "/relatorios/tarefas" },
  financeiros: { rotulo: "Financeiros", rota: "/relatorios/financeiros" },
  "app-cliente": { rotulo: "App do cliente", rota: "/relatorios/app-cliente" },
  operacionais: {
    rotulo: "Operacional consolidado",
    rota: "/relatorios/operacional",
    busca: { tipo: "operacional-consolidado" },
  },
  "operacional-simulacoes": {
    rotulo: "Operacional — simulações",
    rota: "/relatorios/operacional",
    busca: { tipo: "simulacoes" },
  },
};
const rotuloBase = (c: string) => BASES[c]?.rotulo ?? c;

function Pagina() {
  const qc = useQueryClient();
  const basesFn = useServerFn(listarReportsBase);
  const listaFn = useServerFn(listarFiltrosSalvos);
  const salvarFn = useServerFn(salvarFiltro);
  const excluirFn = useServerFn(excluirFiltro);
  const escopoFn = useServerFn(getEscopoRelatorios);

  const { data: permEscopo } = useQuery({
    queryKey: ["report-escopo"],
    queryFn: () => escopoFn(),
    staleTime: 5 * 60_000,
  });
  const { data: sessao } = useQuery({
    queryKey: ["minha-sessao"],
    queryFn: () => getMinhaSessao(),
    staleTime: 5 * 60_000,
  });
  const meuId = sessao?.profile?.id ?? null;
  const escoposVisiveis = ESCOPOS.filter((e) => e === "minha" || permEscopo?.podeGeral);

  const { data: bases } = useQuery({
    queryKey: ["report-bases"],
    queryFn: () => basesFn(),
    staleTime: Infinity,
  });
  const {
    data: salvos,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["report-saved"],
    queryFn: () => listaFn(),
    staleTime: 30_000,
  });

  const [nome, setNome] = useState("");
  const [base, setBase] = useState("consolidado");
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [escopo, setEscopo] = useState<Escopo>("minha");
  const [visibilidade, setVisibilidade] = useState<"private" | "shared_team">("private");
  const [busy, setBusy] = useState(false);

  async function salvar() {
    if (!nome.trim()) {
      toast.error("Informe um nome.");
      return;
    }
    if (periodo === "custom" && (!de || !ate || de > ate)) {
      toast.error("No período personalizado, informe o início e o fim (o fim depois do início).");
      return;
    }
    setBusy(true);
    try {
      await salvarFn({
        data: {
          nome: nome.trim(),
          report_codigo: base,
          filtros: { periodo, escopo, ...(periodo === "custom" ? { de, ate } : {}) },
          visibilidade,
        },
      });
      toast.success("Relatório personalizado salvo.");
      setNome("");
      qc.invalidateQueries({ queryKey: ["report-saved"] });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível salvar."));
    } finally {
      setBusy(false);
    }
  }

  async function remover(id: string) {
    try {
      await excluirFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["report-saved"] });
      toast.success("Relatório excluído.");
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível excluir."));
    }
  }

  return (
    <div className="mx-auto w-full max-w-none space-y-6 p-4 md:p-6">
      <header className="border-b border-border pb-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Relatórios · Personalizados
        </p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight text-foreground">
          Relatórios personalizados
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monte um relatório a partir de uma base, defina o período e salve para reutilizar.
        </p>
      </header>

      <Card className="space-y-4 p-4">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Novo relatório
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nome</label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Produção mensal por banco"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Base</label>
            <Select value={base} onValueChange={setBase}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(bases ?? [])
                  .filter((b) => BASES[b])
                  .map((b) => (
                    <SelectItem key={b} value={b}>
                      {rotuloBase(b)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Período</label>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODOS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PERIODO_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {periodo === "custom" && (
            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="rp-de">
                  De
                </label>
                <Input id="rp-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="rp-ate">
                  Até
                </label>
                <Input
                  id="rp-ate"
                  type="date"
                  value={ate}
                  onChange={(e) => setAte(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Abrangência</label>
            <Select value={escopo} onValueChange={(v) => setEscopo(v as Escopo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {escoposVisiveis.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ESCOPO_LABEL[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Compartilhamento</label>
            <Select
              value={visibilidade}
              onValueChange={(v) => setVisibilidade(v as "private" | "shared_team")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Privado</SelectItem>
                <SelectItem value="shared_team">Compartilhado com os colegas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={salvar} disabled={busy}>
          <Save className="mr-1.5 h-4 w-4" /> Salvar relatório
        </Button>
      </Card>

      <section className="space-y-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Salvos
        </h2>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : isError ? (
          <Card className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-destructive">
              {mensagemDeErro(error, "Não foi possível carregar os relatórios salvos.")}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          </Card>
        ) : !salvos?.length ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhum relatório personalizado salvo.
          </Card>
        ) : (
          <div className="space-y-2">
            {salvos.map((s: any) => (
              <Card
                key={s.id}
                className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{s.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Base: {rotuloBase(s.report_codigo)} ·{" "}
                    {PERIODO_LABEL[(s.filtros?.periodo as Periodo) ?? "mes"]}
                    {s.filtros?.escopo ? ` · ${rotuloEscopo(String(s.filtros.escopo))}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap shrink-0 items-center gap-2">
                  <Badge variant="secondary">
                    {s.visibilidade === "shared_team" ? "Compartilhado" : "Privado"}
                  </Badge>
                  <Link
                    to={(BASES[s.report_codigo]?.rota ?? `/relatorios/${s.report_codigo}`) as any}
                    search={
                      { ...(s.filtros ?? {}), ...(BASES[s.report_codigo]?.busca ?? {}) } as any
                    }
                  >
                    <Button variant="outline" size="sm">
                      <Play className="mr-1 h-3.5 w-3.5" /> Executar
                    </Button>
                  </Link>
                  {/* Só quem salvou exclui (excluirFiltro filtra por user_id); para os
                      compartilhados de colegas a lixeira "excluía" sem excluir. */}
                  {s.user_id === meuId && (
                    <ConfirmDelete
                      titulo={`Excluir "${s.nome}"?`}
                      descricao="O relatório salvo sai da lista. Os dados dele não são apagados."
                      onConfirm={() => remover(s.id)}
                    />
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
