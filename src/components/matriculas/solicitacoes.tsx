import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { formatBRL } from "@/lib/simulacao/format";
import {
  alternarReembolsoMatricula,
  excluirSolicitacaoMatricula,
  type MatriculaSolicitacao,
} from "@/lib/matriculas/matriculas.functions";
import { SolicitacaoDialog } from "./solicitacao-dialog";

export function Solicitacoes({
  lista,
  totalCreditos,
  onMudou,
}: {
  lista: MatriculaSolicitacao[];
  totalCreditos: number;
  onMudou: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [reembolso, setReembolso] = useState<"todos" | "sim" | "nao">("todos");

  async function toggle(id: string, reembolsado: boolean) {
    try {
      await alternarReembolsoMatricula({ data: { id, reembolsado } });
      onMudou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar.");
    }
  }

  // Saldo acumulado (crédito − gastos acumulados) calculado do mais antigo ao mais novo.
  const saldoPorId = useMemo(() => {
    const cronologica = [...lista].sort((a, b) =>
      a.data_solicitacao.localeCompare(b.data_solicitacao),
    );
    const mapa = new Map<string, number>();
    let acumulado = 0;
    for (const s of cronologica) {
      acumulado += Number(s.valor);
      mapa.set(s.id, totalCreditos - acumulado);
    }
    return mapa;
  }, [lista, totalCreditos]);

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lista.filter((s) => {
      if (de && s.data_solicitacao < de) return false;
      if (ate && s.data_solicitacao > ate) return false;
      if (reembolso === "sim" && !s.reembolsado) return false;
      if (reembolso === "nao" && s.reembolsado) return false;
      if (q) {
        const alvo =
          `${s.solicitante} ${s.corretor ?? ""} ${s.cliente ?? ""} ${s.numero_matricula ?? ""}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
  }, [lista, busca, de, ate, reembolso]);

  function limpar() {
    setBusca("");
    setDe("");
    setAte("");
    setReembolso("todos");
  }

  const temFiltro = busca || de || ate || reembolso !== "todos";

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Solicitações ({filtrada.length})</h2>
        <SolicitacaoDialog onMudou={onMudou} />
      </div>

      <div className="grid grid-cols-1 gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1 lg:col-span-2">
          <Label className="text-xs">Buscar (solicitante, corretor, cliente, matrícula)</Label>
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite para filtrar…"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">De</Label>
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Reembolso</Label>
          <Select value={reembolso} onValueChange={(v) => setReembolso(v as typeof reembolso)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="sim">Recebidos</SelectItem>
              <SelectItem value="nao">Pendentes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {temFiltro && (
          <div className="flex items-end lg:col-span-5">
            <Button variant="ghost" size="sm" onClick={limpar}>
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Corretor</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Nº da matrícula</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Reembolso recebido</TableHead>
              <TableHead>Data do reembolso</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrada.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma solicitação encontrada.
                </TableCell>
              </TableRow>
            )}
            {filtrada.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="tabular-nums">
                  {new Date(s.data_solicitacao + "T00:00:00").toLocaleDateString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                </TableCell>
                <TableCell className="font-medium">{s.solicitante}</TableCell>
                <TableCell>{s.corretor ?? "—"}</TableCell>
                <TableCell className="max-w-[220px] truncate" title={s.cliente ?? undefined}>
                  {s.cliente ?? "—"}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {s.numero_matricula ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatBRL(s.valor)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={s.reembolsado} onCheckedChange={(v) => toggle(s.id, v)} />
                    {s.reembolsado ? (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Recebido
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" /> Pendente
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {s.data_pagto_reembolso
                    ? new Date(s.data_pagto_reembolso + "T00:00:00").toLocaleDateString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })
                    : "—"}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${(saldoPorId.get(s.id) ?? 0) < 0 ? "text-destructive" : ""}`}
                >
                  {formatBRL(saldoPorId.get(s.id) ?? 0)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <SolicitacaoDialog onMudou={onMudou} inicial={s} />
                    <ConfirmDelete
                      descricao="Excluir esta solicitação de matrícula?"
                      onConfirm={async () => {
                        await excluirSolicitacaoMatricula({ data: { id: s.id } });
                        onMudou();
                      }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
