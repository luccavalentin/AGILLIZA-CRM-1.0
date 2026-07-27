import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { GenericReportPage } from "@/components/reports/generic-report-page";
import { getEscopoRelatorios } from "@/lib/relatorios/reports.functions";
import {
  filtrosPadrao,
  type ReportFiltros,
  type Periodo,
  type Escopo,
} from "@/lib/relatorios/shared";

const PERIODOS: Periodo[] = ["hoje", "7d", "15d", "30d", "mes", "mes_anterior", "ano", "custom"];
const ESCOPOS: Escopo[] = ["minha", "equipe", "geral"];

/** Valida/normaliza os filtros vindos da query string (link compartilhável). */
export function parseReportSearch(search: Record<string, unknown>): ReportFiltros {
  const base = filtrosPadrao();
  const periodo = PERIODOS.includes(search.periodo as Periodo)
    ? (search.periodo as Periodo)
    : base.periodo;
  const escopo = ESCOPOS.includes(search.escopo as Escopo)
    ? (search.escopo as Escopo)
    : base.escopo;
  const num = (v: unknown) =>
    v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined;
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const arr = (v: unknown) => {
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
    if (typeof v === "string" && v) return v.split(",").filter(Boolean);
    return undefined;
  };
  return {
    periodo,
    escopo,
    de: str(search.de),
    ate: str(search.ate),
    banco: str(search.banco),
    produto: str(search.produto),
    status: str(search.status),
    responsavel: str(search.responsavel),
    cliente: str(search.cliente),
    valorMin: num(search.valorMin),
    valorMax: num(search.valorMax),
    busca: str(search.busca),
    bancos: arr(search.bancos),
    analistas: arr(search.analistas),
    comerciais: arr(search.comerciais),
    corretores: arr(search.corretores),
    imobiliarias: arr(search.imobiliarias),
  };
}

/** Wrapper de rota: liga filtros à URL e escopo do usuário ao GenericReportPage. */
export function ReportView({
  codigo,
  comFiltroBanco,
  comFiltroStatus,
  typeSelector,
}: {
  codigo: string;
  comFiltroBanco?: boolean;
  comFiltroStatus?: boolean;
  typeSelector?: import("react").ReactNode;
}) {

  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const filtros = parseReportSearch(search);

  const escopoFn = useServerFn(getEscopoRelatorios);
  const { data: escopo } = useQuery({
    queryKey: ["report-escopo"],
    queryFn: () => escopoFn(),
    staleTime: 5 * 60_000,
  });

  // "Painel geral" deve mostrar toda a operação: se o usuário pode ver geral/equipe
  // e não escolheu um escopo na URL, amplia o escopo automaticamente.
  const escopoInformadoNaUrl = ESCOPOS.includes(search.escopo as Escopo);
  const filtrosEfetivos: ReportFiltros =
    !escopoInformadoNaUrl && escopo
      ? { ...filtros, escopo: escopo.podeGeral ? "geral" : "minha" }
      : filtros;

  const onFiltros = (f: ReportFiltros) => {
    const s: Record<string, string> = {};
    for (const [k, v] of Object.entries(f)) {
      if (v === undefined || v === "" || v === null) continue;
      if (Array.isArray(v)) {
        if (v.length > 0) s[k] = v.join(",");
        continue;
      }
      s[k] = String(v);
    }
    navigate({ to: ".", search: s, replace: true });
  };

  return (
    <GenericReportPage
      codigo={codigo}
      filtros={filtrosEfetivos}
      onFiltros={onFiltros}
      podeEquipe={escopo?.podeEquipe ?? false}
      podeGeral={escopo?.podeGeral ?? false}
      comFiltroBanco={comFiltroBanco}
      comFiltroStatus={comFiltroStatus}
      typeSelector={typeSelector}
    />

  );
}
