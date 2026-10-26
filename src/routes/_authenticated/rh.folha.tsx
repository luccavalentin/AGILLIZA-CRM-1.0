import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarRange, Check, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listarCompetencias } from "@/lib/rh/folha.functions";
import { LancamentosCompetencia } from "@/components/rh/folha/lancamentos-competencia";
import { PreviaCompetencia } from "@/components/rh/folha/previa-competencia";
import { HoleritesCompetencia } from "@/components/rh/folha/holerites-competencia";
import { OcorrenciasPanel } from "@/components/rh/ocorrencias-panel";
import { ABA_CLASS } from "@/components/rh/funcionario-form";
import { usePermissao } from "@/hooks/use-permissao";
import { limitesDaCompetencia } from "@/lib/rh/entrada-competencia";
import { formatBRL } from "@/lib/financeiro/format";

const ABAS = ["lancamentos", "ocorrencias", "previa", "holerites"] as const;
type Aba = (typeof ABAS)[number];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface Busca {
  aba?: Aba;
  mes?: number;
  ano?: number;
}

export const Route = createFileRoute("/_authenticated/rh/folha")({
  head: () => ({ meta: [{ title: "Folha mensal — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.folha"),
  validateSearch: (s: Record<string, unknown>): Busca => {
    const mes = Number(s.mes);
    const ano = Number(s.ano);
    return {
      aba: ABAS.includes(s.aba as Aba) ? (s.aba as Aba) : undefined,
      mes: Number.isInteger(mes) && mes >= 1 && mes <= 12 ? mes : undefined,
      ano: Number.isInteger(ano) && ano >= 2020 && ano <= 2100 ? ano : undefined,
    };
  },
  component: Pagina,
});

function Pagina() {
  const busca = Route.useSearch();
  const navigate = useNavigate({ from: "/rh/folha" });
  const hoje = new Date();
  const mes = busca.mes ?? hoje.getMonth() + 1;
  const ano = busca.ano ?? hoje.getFullYear();
  const aba: Aba = busca.aba ?? "lancamentos";
  const verOcorrencias = usePermissao("rh.ocorrencias", "view");

  const fnComp = useServerFn(listarCompetencias);
  const comps = useQuery({ queryKey: ["rh-competencias"], queryFn: () => fnComp() });
  const atual = (comps.data ?? []).find((c) => c.mes === mes && c.ano === ano);
  const fechada = atual?.status === "fechada";
  const { inicio, fim } = limitesDaCompetencia({ ano, mes });

  const ir = (p: Partial<Busca>) => navigate({ search: (s: Busca) => ({ ...s, ...p }), replace: true });
  const mover = (delta: number) => {
    const d = new Date(ano, mes - 1 + delta, 1);
    ir({ mes: d.getMonth() + 1, ano: d.getFullYear() });
  };

  const passos = [
    { rotulo: "Lançar", feito: fechada },
    { rotulo: "Conferir a prévia", feito: fechada },
    { rotulo: "Fechar", feito: fechada },
    { rotulo: "Publicar holerites", feito: false },
  ];

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground md:text-[22px]">
            <CalendarRange className="h-5 w-5 text-primary" /> Folha mensal
          </h1>
          <p className="text-sm text-muted-foreground">
            Tudo da competência num lugar: lançamentos, ocorrências, prévia, fechamento e holerites.
          </p>
        </div>
        <div data-tour="rh-folha-competencia" className="flex items-center gap-1 self-start rounded-xl border border-border/60 bg-card p-1 md:self-auto">
          <Button size="icon" variant="ghost" aria-label="Competência anterior" onClick={() => mover(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[150px] px-2 text-center">
            <p className="text-sm font-semibold text-foreground">
              {MESES[mes - 1]} de {ano}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {fechada ? "Fechada" : atual ? "Aberta" : "Ainda não iniciada"}
            </p>
          </div>
          <Button size="icon" variant="ghost" aria-label="Próxima competência" onClick={() => mover(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ol data-tour="rh-folha-passos" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {passos.map((p, i) => (
          <li
            key={p.rotulo}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
              p.feito ? "border-primary/30 bg-primary/5 text-primary" : "border-border/60 bg-card text-muted-foreground"
            }`}
          >
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                p.feito ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              {p.feito ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className="truncate">{p.rotulo}</span>
          </li>
        ))}
      </ol>

      {fechada && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
          <Lock className="h-4 w-4" />
          Competência fechada{atual?.total_liquido ? ` · líquido ${formatBRL(atual.total_liquido)}` : ""}. Lançamentos,
          faltas e adiantamentos do mês estão travados.
        </div>
      )}

      <Tabs value={aba} onValueChange={(v) => ir({ aba: v as Aba })}>
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border/60 bg-muted/50 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="lancamentos" className={ABA_CLASS}>
            Lançamentos
          </TabsTrigger>
          {verOcorrencias && (
            <TabsTrigger value="ocorrencias" className={ABA_CLASS}>
              Faltas e atestados
            </TabsTrigger>
          )}
          <TabsTrigger value="previa" className={ABA_CLASS}>
            Prévia e fechamento
          </TabsTrigger>
          <TabsTrigger value="holerites" className={ABA_CLASS}>
            Holerites
          </TabsTrigger>
        </TabsList>
        <TabsContent value="lancamentos" className="mt-4">
          <LancamentosCompetencia mes={mes} ano={ano} fechada={fechada} />
        </TabsContent>
        {verOcorrencias && (
          <TabsContent value="ocorrencias" className="mt-4">
            <OcorrenciasPanel desde={inicio} ate={fim} />
          </TabsContent>
        )}
        <TabsContent value="previa" className="mt-4">
          <PreviaCompetencia mes={mes} ano={ano} fechada={fechada} />
        </TabsContent>
        <TabsContent value="holerites" className="mt-4">
          <HoleritesCompetencia mes={mes} ano={ano} fechada={fechada} />
        </TabsContent>
      </Tabs>

      {(comps.data ?? []).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Competências recentes</p>
          <div className="flex flex-wrap gap-2">
            {(comps.data ?? []).slice(0, 12).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => ir({ mes: c.mes, ano: c.ano })}
                className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors hover:border-primary/40 ${
                  c.mes === mes && c.ano === ano ? "border-primary/50 bg-primary/5" : "border-border/60 bg-card"
                }`}
              >
                <span className="font-medium text-foreground">
                  {String(c.mes).padStart(2, "0")}/{c.ano}
                </span>{" "}
                <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[10px]">
                  {c.status === "fechada" ? "fechada" : c.status}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
