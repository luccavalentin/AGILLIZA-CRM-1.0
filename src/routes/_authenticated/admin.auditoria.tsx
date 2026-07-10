import { AdminHero } from "@/components/admin/admin-hero";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Filter, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarAuditoria, opcoesAuditoria } from "@/lib/admin/auditoria.functions";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.auditoria"),
  component: Pagina,
});

function fmtData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

const TODOS = "__todos__";

interface Filtros {
  dataInicio: string;
  dataFim: string;
  userId: string;
  acao: string;
  entidade: string;
  busca: string;
}

const FILTROS_VAZIOS: Filtros = {
  dataInicio: "",
  dataFim: "",
  userId: "",
  acao: "",
  entidade: "",
  busca: "",
};

function Pagina() {
  const [rascunho, setRascunho] = useState<Filtros>(FILTROS_VAZIOS);
  const [aplicados, setAplicados] = useState<Filtros>(FILTROS_VAZIOS);

  const opcoes = useQuery({
    queryKey: ["admin-auditoria-opcoes"],
    queryFn: () => opcoesAuditoria(),
  });

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (aplicados.dataInicio) p.dataInicio = new Date(aplicados.dataInicio).toISOString();
    if (aplicados.dataFim) {
      const d = new Date(aplicados.dataFim);
      d.setHours(23, 59, 59, 999);
      p.dataFim = d.toISOString();
    }
    if (aplicados.userId) p.userId = aplicados.userId;
    if (aplicados.acao) p.acao = aplicados.acao;
    if (aplicados.entidade) p.entidade = aplicados.entidade;
    if (aplicados.busca.trim()) p.busca = aplicados.busca.trim();
    return p;
  }, [aplicados]);

  const q = useQuery({
    queryKey: ["admin-auditoria", params],
    queryFn: () => listarAuditoria({ data: params }),
  });

  const temFiltro = Object.values(aplicados).some((v) => v);

  function aplicar() {
    setAplicados(rascunho);
  }
  function limpar() {
    setRascunho(FILTROS_VAZIOS);
    setAplicados(FILTROS_VAZIOS);
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        icon={<ShieldCheck className="h-5 w-5" />}
        titulo="Auditoria"
        descricao="Registro de ações administrativas do seu ecossistema."
      />

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="size-4 text-primary" /> Filtros
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Data inicial</Label>
            <Input
              type="date"
              value={rascunho.dataInicio}
              onChange={(e) => setRascunho((s) => ({ ...s, dataInicio: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data final</Label>
            <Input
              type="date"
              value={rascunho.dataFim}
              onChange={(e) => setRascunho((s) => ({ ...s, dataFim: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Usuário</Label>
            <Select
              value={rascunho.userId || TODOS}
              onValueChange={(v) => setRascunho((s) => ({ ...s, userId: v === TODOS ? "" : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os usuários</SelectItem>
                {(opcoes.data?.atores ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo de operação</Label>
            <Select
              value={rascunho.acao || TODOS}
              onValueChange={(v) => setRascunho((s) => ({ ...s, acao: v === TODOS ? "" : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas as operações</SelectItem>
                {(opcoes.data?.acoes ?? []).map((a) => (
                  <SelectItem key={a.valor} value={a.valor}>
                    {a.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Entidade</Label>
            <Select
              value={rascunho.entidade || TODOS}
              onValueChange={(v) => setRascunho((s) => ({ ...s, entidade: v === TODOS ? "" : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas as entidades</SelectItem>
                {(opcoes.data?.entidades ?? []).map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Busca livre</Label>
            <Input
              placeholder="Ação, entidade ou IP…"
              value={rascunho.busca}
              onChange={(e) => setRascunho((s) => ({ ...s, busca: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && aplicar()}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={aplicar}>
            <Filter className="mr-2 size-4" /> Aplicar filtros
          </Button>
          {temFiltro && (
            <Button size="sm" variant="ghost" onClick={limpar}>
              <X className="mr-2 size-4" /> Limpar
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {q.data?.length ?? 0} registro(s)
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Ator</TableHead>
              <TableHead>O que aconteceu</TableHead>
              <TableHead>Operação</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : (q.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nenhum registro encontrado para os filtros.
                </TableCell>
              </TableRow>
            ) : (
              (q.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {fmtData(r.created_at)}
                  </TableCell>
                  <TableCell>{r.ator_nome ?? "—"}</TableCell>
                  <TableCell className="font-medium text-foreground">{r.mensagem}</TableCell>
                  <TableCell className="text-muted-foreground">{r.acao_label}</TableCell>
                  <TableCell className="text-muted-foreground">{r.ip ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
