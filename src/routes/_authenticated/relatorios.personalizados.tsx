import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Play, Trash2, Save } from "lucide-react";
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
} from "@/lib/relatorios/reports.functions";
import { PERIODO_LABEL, type Periodo } from "@/lib/relatorios/shared";

export const Route = createFileRoute("/_authenticated/relatorios/personalizados")({
  head: () => ({ meta: [{ title: "Personalizados — Relatórios — Agilliza" }] }),
  component: Pagina,
});

const PERIODOS: Periodo[] = ["hoje", "7d", "15d", "30d", "mes", "mes_anterior", "ano", "custom"];

function Pagina() {
  const qc = useQueryClient();
  const basesFn = useServerFn(listarReportsBase);
  const listaFn = useServerFn(listarFiltrosSalvos);
  const salvarFn = useServerFn(salvarFiltro);
  const excluirFn = useServerFn(excluirFiltro);

  const { data: bases } = useQuery({
    queryKey: ["report-bases"],
    queryFn: () => basesFn(),
    staleTime: Infinity,
  });
  const { data: salvos, isLoading } = useQuery({
    queryKey: ["report-saved"],
    queryFn: () => listaFn(),
    staleTime: 30_000,
  });

  const [nome, setNome] = useState("");
  const [base, setBase] = useState("consolidado");
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [visibilidade, setVisibilidade] = useState<"private" | "shared_team">("private");
  const [busy, setBusy] = useState(false);

  async function salvar() {
    if (!nome.trim()) {
      toast.error("Informe um nome.");
      return;
    }
    setBusy(true);
    try {
      await salvarFn({
        data: {
          nome: nome.trim(),
          report_codigo: base,
          filtros: { periodo, escopo: "minha" },
          visibilidade,
        },
      });
      toast.success("Relatório personalizado salvo.");
      setNome("");
      qc.invalidateQueries({ queryKey: ["report-saved"] });
    } catch {
      toast.error("Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function remover(id: string) {
    try {
      await excluirFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["report-saved"] });
    } catch {
      toast.error("Não foi possível excluir.");
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
                {(bases ?? []).map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
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
                <SelectItem value="shared_team">Compartilhado com a equipe</SelectItem>
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
                    Base: {s.report_codigo} ·{" "}
                    {PERIODO_LABEL[(s.filtros?.periodo as Periodo) ?? "mes"]}
                  </p>
                </div>
                <div className="flex flex-wrap shrink-0 items-center gap-2">
                  <Badge variant="secondary">
                    {s.visibilidade === "shared_team" ? "Equipe" : "Privado"}
                  </Badge>
                  <Link
                    to={`/relatorios/${s.report_codigo}` as any}
                    search={(s.filtros ?? {}) as any}
                  >
                    <Button variant="outline" size="sm">
                      <Play className="mr-1 h-3.5 w-3.5" /> Executar
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remover(s.id)}
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
