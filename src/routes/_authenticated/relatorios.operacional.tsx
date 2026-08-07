import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { ReportView } from "@/components/reports/report-view";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const typeSelector = (
    <Select
      value={tipo}
      onValueChange={(v) => navigate({ to: ".", search: { tipo: v }, replace: true })}
    >
      <SelectTrigger className="h-9 w-full border-border/60 bg-background/70 text-sm font-semibold text-foreground shadow-sm backdrop-blur-sm hover:bg-background focus:ring-2 focus:ring-primary/30">
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
  );

  return (
    <ReportView
      key={tipo}
      codigo={tipo}
      comFiltroBanco={opt.comBanco}
      comFiltroStatus={opt.comStatus}
      typeSelector={typeSelector}
    />
  );
}
