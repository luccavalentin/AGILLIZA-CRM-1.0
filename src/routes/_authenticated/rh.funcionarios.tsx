import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Users, UserPlus, Search } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarFuncionarios } from "@/lib/rh/funcionarios.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusFuncionarioBadge } from "@/components/rh/status-badge";
import { formatBRL } from "@/lib/financeiro/format";

export const Route = createFileRoute("/_authenticated/rh/funcionarios")({
  head: () => ({ meta: [{ title: "Funcionários — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.funcionarios"),
  component: Pagina,
});

function Pagina() {
  const navigate = useNavigate();
  const fn = useServerFn(listarFuncionarios);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [incluirDesligados, setIncluirDesligados] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["rh-funcionarios", q, status, incluirDesligados],
    queryFn: () =>
      fn({
        data: {
          q: q || undefined,
          status: status || undefined,
          incluir_desligados: incluirDesligados,
        },
      }),
  });

  const total = data?.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 p-3 sm:p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold text-foreground md:text-2xl">Funcionários</h1>
            <p className="text-sm text-muted-foreground">
              {total} {total === 1 ? "funcionário encontrado" : "funcionários encontrados"}
            </p>
          </div>
        </div>
        <Button asChild>
          <Link to="/rh/funcionarios/novo">
            <UserPlus className="mr-2 h-4 w-4" /> Novo funcionário
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-3 sm:grid-cols-2 md:grid-cols-4 md:p-4">
          <div className="relative sm:col-span-2 md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF ou número"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status || "todos"} onValueChange={(v) => setStatus(v === "todos" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="experiencia">Em experiência</SelectItem>
              <SelectItem value="afastado">Afastados</SelectItem>
              <SelectItem value="ferias">Em férias</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="accent-primary"
              checked={incluirDesligados}
              onChange={(e) => setIncluirDesligados(e.target.checked)}
            />
            Incluir desligados
          </label>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : total === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Nenhum funcionário encontrado</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ajuste os filtros ou cadastre um novo funcionário.
            </p>
            <Button className="mt-4" asChild>
              <Link to="/rh/funcionarios/novo">
                <UserPlus className="mr-2 h-4 w-4" /> Cadastrar funcionário
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Cards em mobile */}
          <div className="grid gap-3 sm:grid-cols-2 md:hidden">
            {data!.map((f) => (
              <Card
                key={f.id}
                className="cursor-pointer transition hover:border-primary/60"
                onClick={() => navigate({ to: "/rh/funcionarios/$id", params: { id: f.id } })}
              >
                <CardContent className="space-y-1.5 p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium text-foreground">{f.nome}</span>
                    <StatusFuncionarioBadge status={f.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {f.numero} · {f.cargo_nome ?? "Sem cargo"}
                    {f.departamento_nome ? ` · ${f.departamento_nome}` : ""}
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {formatBRL(f.salario_atual)} · Admissão {new Date(f.data_admissao).toLocaleDateString("pt-BR")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabela em md+ */}
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Nº</th>
                  <th className="px-4 py-2 text-left">Nome</th>
                  <th className="px-4 py-2 text-left">Cargo / Depto.</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Admissão</th>
                  <th className="px-4 py-2 text-right">Salário atual</th>
                </tr>
              </thead>
              <tbody>
                {data!.map((f, idx) => (
                  <tr
                    key={f.id}
                    className={`cursor-pointer transition hover:bg-muted/60 ${idx % 2 === 0 ? "" : "bg-muted/30"}`}
                    onClick={() => navigate({ to: "/rh/funcionarios/$id", params: { id: f.id } })}
                  >
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{f.numero}</td>
                    <td className="px-4 py-2 font-medium text-foreground">{f.nome}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {f.cargo_nome ?? "—"}
                      {f.departamento_nome ? ` · ${f.departamento_nome}` : ""}
                    </td>
                    <td className="px-4 py-2"><StatusFuncionarioBadge status={f.status} /></td>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">
                      {new Date(f.data_admissao).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatBRL(f.salario_atual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
