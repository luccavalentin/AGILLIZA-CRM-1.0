import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { ReportView } from "@/components/reports/report-view";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3 } from "lucide-react";

type TipoRelatorio =
  | "operacional-consolidado"
  | "simulacoes"
  | "propostas-enviadas"
  | "propostas-aprovadas"
  | "propostas-recusadas"
  | "demandas"
  | "tarefas"
  | "crm";

const OPCOES: { value: TipoRelatorio; label: string; comStatus?: boolean; comBanco?: boolean }[] = [
  { value: "operacional-consolidado", label: "Consolidado operacional (tudo)" },
  { value: "simulacoes", label: "Simulações", comStatus: true, comBanco: true },
  { value: "propostas-enviadas", label: "Propostas enviadas", comBanco: true },
  { value: "propostas-aprovadas", label: "Propostas aprovadas", comBanco: true },
  { value: "propostas-recusadas", label: "Propostas recusadas", comBanco: true },
  { value: "demandas", label: "Demandas", comStatus: true },
  { value: "tarefas", label: "Tarefas", comStatus: true },
  { value: "crm", label: "Clientes / CRM" },
];

export const Route = createFileRoute("/_authenticated/relatorios/operacional")({
  head: () => ({ meta: [{ title: "Relatórios operacionais — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>) => s,
  component: Pagina,
});

function Pagina() {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const tipo = (OPCOES.find((o) => o.value === search.tipo)?.value ??
    "operacional-consolidado") as TipoRelatorio;
  const opt = OPCOES.find((o) => o.value === tipo)!;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/8 text-primary ring-1 ring-inset ring-primary/12">
            <BarChart3 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Relatórios operacionais
            </h1>
            <p className="text-sm text-muted-foreground">
              Selecione o relatório e refine com os filtros abaixo.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Tipo de relatório
          </label>
          <Select
            value={tipo}
            onValueChange={(v) =>
              navigate({ to: ".", search: { tipo: v }, replace: true })
            }
          >
            <SelectTrigger className="h-10 w-full sm:max-w-md">
              <SelectValue placeholder="Escolher relatório" />
            </SelectTrigger>
            <SelectContent>
              {OPCOES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ReportView
        key={tipo}
        codigo={tipo}
        comFiltroBanco={opt.comBanco}
        comFiltroStatus={opt.comStatus}
      />
    </div>
  );
}
