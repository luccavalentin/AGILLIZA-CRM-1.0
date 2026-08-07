import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CalendarClock,
  CalendarCheck2,
  ChevronDown,
  Search,
  Wallet,
} from "lucide-react";
import {
  obterControleFerias,
  type ControleFeriasFuncionario,
} from "@/lib/rh/ferias-controle.functions";
import { SITUACAO_LABEL, type FeriasSituacao } from "@/lib/rh/ferias-clt";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBRL } from "@/lib/financeiro/format";
import { cn } from "@/lib/utils";

const dataBR = (iso?: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const TONE: Record<FeriasSituacao, string> = {
  em_curso: "bg-muted text-muted-foreground",
  disponivel: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  a_vencer: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  vencida: "bg-destructive/15 text-destructive",
  gozada: "bg-primary/10 text-primary",
};

export function ControleFeriasPanel({
  onProgramar,
}: {
  onProgramar?: (f: ControleFeriasFuncionario, periodo: { inicio: string; fim: string }) => void;
}) {
  const fn = useServerFn(obterControleFerias);
  const { data, isLoading } = useQuery({
    queryKey: ["rh-ferias-controle"],
    queryFn: () => fn(),
  });
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "vencidas" | "a_vencer" | "saldo">("todos");
  const [aberto, setAberto] = useState<string | null>(null);

  const itens = useMemo(() => {
    let lista = data?.itens ?? [];
    if (filtro === "vencidas") lista = lista.filter((i) => i.dias_vencidos > 0);
    if (filtro === "a_vencer") lista = lista.filter((i) => i.dias_a_vencer > 0);
    if (filtro === "saldo") lista = lista.filter((i) => i.saldo_dias > 0);
    const t = busca.trim().toLowerCase();
    if (t) {
      lista = lista.filter(
        (i) =>
          i.nome.toLowerCase().includes(t) ||
          (i.departamento_nome ?? "").toLowerCase().includes(t) ||
          (i.cargo_nome ?? "").toLowerCase().includes(t),
      );
    }
    return [...lista].sort((a, b) => {
      const peso = (x: ControleFeriasFuncionario) =>
        x.dias_vencidos > 0 ? 0 : x.dias_a_vencer > 0 ? 1 : x.saldo_dias > 0 ? 2 : 3;
      return peso(a) - peso(b) || a.nome.localeCompare(b.nome);
    });
  }, [data, busca, filtro]);

  const r = data?.resumo;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo
          icon={<AlertTriangle className="h-4 w-4" />}
          titulo="Com férias vencidas"
          valor={String(r?.comFeriasVencidas ?? 0)}
          detalhe="Risco de pagamento em dobro"
          tone="danger"
          onClick={() => setFiltro("vencidas")}
        />
        <Resumo
          icon={<CalendarClock className="h-4 w-4" />}
          titulo="Vencem em 90 dias"
          valor={String(r?.aVencer90 ?? 0)}
          detalhe="Programar concessão"
          tone="warning"
          onClick={() => setFiltro("a_vencer")}
        />
        <Resumo
          icon={<CalendarCheck2 className="h-4 w-4" />}
          titulo="Saldo de dias"
          valor={String(r?.diasSaldoTotal ?? 0)}
          detalhe="Dias adquiridos não gozados"
          onClick={() => setFiltro("saldo")}
        />
        <Resumo
          icon={<Wallet className="h-4 w-4" />}
          titulo="Provisão de férias"
          valor={formatBRL(r?.provisaoTotal ?? 0)}
          detalhe="Valor total provisionado"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, cargo ou departamento…"
            className="h-9 pl-8"
          />
        </div>
        {(["todos", "vencidas", "a_vencer", "saldo"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filtro === f ? "default" : "outline"}
            onClick={() => setFiltro(f)}
          >
            {f === "todos"
              ? "Todos"
              : f === "vencidas"
                ? "Vencidas"
                : f === "a_vencer"
                  ? "A vencer"
                  : "Com saldo"}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead className="hidden md:table-cell">Admissão</TableHead>
                  <TableHead className="hidden lg:table-cell">Tempo de casa</TableHead>
                  <TableHead className="text-center">Saldo</TableHead>
                  <TableHead className="hidden sm:table-cell text-center">Avos</TableHead>
                  <TableHead className="hidden lg:table-cell">Limite p/ conceder</TableHead>
                  <TableHead className="hidden xl:table-cell text-right">Provisão</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                      Calculando períodos aquisitivos…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && itens.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum funcionário encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {itens.map((i) => {
                  const expandido = aberto === i.funcionario_id;
                  const situacao: FeriasSituacao =
                    i.dias_vencidos > 0
                      ? "vencida"
                      : i.dias_a_vencer > 0
                        ? "a_vencer"
                        : i.saldo_dias > 0
                          ? "disponivel"
                          : "em_curso";
                  return (
                    <Fragment key={i.funcionario_id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => setAberto(expandido ? null : i.funcionario_id)}
                      >
                        <TableCell className="font-medium">
                          {i.nome}
                          <div className="text-[11px] text-muted-foreground">
                            {[i.cargo_nome, i.departamento_nome].filter(Boolean).join(" · ") || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs">
                          {dataBR(i.data_admissao)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">
                          {Math.floor(i.tempo_casa_meses / 12)}a {i.tempo_casa_meses % 12}m
                        </TableCell>
                        <TableCell className="text-center font-semibold">{i.saldo_dias}</TableCell>
                        <TableCell className="hidden sm:table-cell text-center text-xs">
                          {i.avos_proporcionais}/12
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">
                          {dataBR(i.proximo_vencimento)}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-right text-xs">
                          {formatBRL(i.provisao)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("text-[11px]", TONE[situacao])}>
                            {SITUACAO_LABEL[situacao]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform",
                              expandido && "rotate-180",
                            )}
                          />
                        </TableCell>
                      </TableRow>
                      {expandido && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={9} className="p-3">
                            <div className="mb-2 text-xs font-medium text-muted-foreground">
                              Períodos aquisitivos gerados a partir da admissão
                            </div>
                            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                              {i.periodos
                                .slice()
                                .reverse()
                                .map((p) => (
                                  <div
                                    key={p.indice}
                                    className="rounded-md border border-border bg-card p-2.5"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-medium">
                                        {dataBR(p.inicio)} → {dataBR(p.fim)}
                                      </span>
                                      <Badge
                                        variant="secondary"
                                        className={cn("text-[10px]", TONE[p.situacao])}
                                      >
                                        {SITUACAO_LABEL[p.situacao]}
                                      </Badge>
                                    </div>
                                    <div className="mt-1.5 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                                      <span>Direito: {p.dias_direito} dias</span>
                                      <span>Gozados: {p.dias_gozados + p.dias_abono}</span>
                                      <span>Saldo: {p.saldo_dias}</span>
                                      <span>Faltas: {p.faltas_injustificadas}</span>
                                      <span className="col-span-2">
                                        Conceder até {dataBR(p.limite_concessivo)}
                                      </span>
                                    </div>
                                    {onProgramar && p.saldo_dias > 0 && p.completo && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="mt-2 h-7 w-full text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onProgramar(i, { inicio: p.inicio, fim: p.fim });
                                        }}
                                      >
                                        Programar este período
                                      </Button>
                                    )}
                                  </div>
                                ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Resumo({
  icon,
  titulo,
  valor,
  detalhe,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  titulo: string;
  valor: string;
  detalhe: string;
  tone?: "danger" | "warning";
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        onClick && "cursor-pointer transition-colors hover:border-primary/40",
        tone === "danger" && "border-destructive/30",
        tone === "warning" && "border-amber-500/30",
      )}
    >
      <CardContent className="p-3.5">
        <div
          className={cn(
            "mb-1 flex items-center gap-2 text-xs text-muted-foreground",
            tone === "danger" && "text-destructive",
            tone === "warning" && "text-amber-600 dark:text-amber-400",
          )}
        >
          {icon}
          <span>{titulo}</span>
        </div>
        <div className="text-lg font-semibold text-foreground md:text-xl">{valor}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{detalhe}</div>
      </CardContent>
    </Card>
  );
}
