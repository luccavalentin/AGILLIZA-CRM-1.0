import { ChevronRight, FileSearch, Loader2, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exibirDocumento } from "@/lib/crm/documento";
import type { ConsultaHistorico } from "@/lib/bureau/bureau.functions";
import {
  finalidadeCurta,
  pluralizar,
  quandoRelativo,
  scoreNaEscala,
  situacaoDoHistorico,
  tomScore,
} from "./logica";
import { Selo } from "./resultado-ficha";
import { Estado3D } from "@/components/ui/estado-3d";

/** Histórico de consultas: tabela no computador, cartões no celular (sem rolagem lateral). */
export function HistoricoConsultas({
  linhas,
  carregando,
  erro,
  onTentar,
  onAbrir,
  filtradoPorCliente,
  onVerTodas,
}: {
  linhas: ConsultaHistorico[];
  carregando: boolean;
  erro: string | null;
  onTentar: () => void;
  onAbrir: (id: string) => void;
  filtradoPorCliente: boolean;
  onVerTodas: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <header className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        <ScrollText className="size-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">Histórico de consultas</h2>
        {filtradoPorCliente && (
          <button
            type="button"
            onClick={onVerTodas}
            className="ml-auto text-xs font-medium text-primary hover:underline"
          >
            Ver todas
          </button>
        )}
      </header>

      {carregando ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Carregando histórico…
        </div>
      ) : erro ? (
        <Estado3D
          tipo="erro"
          descricao={erro}
          acao={
            <Button variant="outline" size="sm" onClick={onTentar}>
              Tentar de novo
            </Button>
          }
        />
      ) : linhas.length === 0 ? (
        <Estado3D
          icone={FileSearch}
          tom="marca"
          titulo="Nenhuma consulta ainda"
          descricao="Consulte a ficha antes de enviar a proposta: evita queimar a operação com uma restrição que ninguém viu."
        />
      ) : (
        <>
          {/* Computador */}
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Consultado</th>
                <th className="px-4 py-2.5 text-right font-medium">Score</th>
                <th className="px-4 py-2.5 font-medium">Situação</th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Finalidade</th>
                <th className="px-4 py-2.5 text-right font-medium">Quando</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <LinhaTabela key={l.id} l={l} onAbrir={onAbrir} />
              ))}
            </tbody>
          </table>

          {/* Celular */}
          <ul className="divide-y divide-border/70 md:hidden">
            {linhas.map((l) => {
              const s = situacaoDoHistorico(l);
              const score = scoreNaEscala(l.score, l.score_maximo);
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => onAbrir(l.id)}
                    className="flex w-full min-w-0 items-start gap-3 px-4 py-3 text-left hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="truncate text-sm font-medium text-foreground">
                        {l.nome ?? (exibirDocumento(l.documento) || "—")}
                      </p>
                      <p className="truncate text-xs tabular-nums text-muted-foreground">
                        {l.nome ? exibirDocumento(l.documento) : "sem cliente vinculado"} ·{" "}
                        {quandoRelativo(l.created_at)}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <Selo tom={s.tom} ponto>
                          {s.texto}
                        </Selo>
                        {score != null && <Selo tom={tomScore(score)}>Score {score}</Selo>}
                      </div>
                    </div>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function LinhaTabela({ l, onAbrir }: { l: ConsultaHistorico; onAbrir: (id: string) => void }) {
  const s = situacaoDoHistorico(l);
  const score = scoreNaEscala(l.score, l.score_maximo);
  return (
    <tr
      className="group cursor-pointer border-b border-border/50 last:border-0 hover:bg-muted/40"
      onClick={() => onAbrir(l.id)}
    >
      <td className="max-w-[16rem] px-4 py-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAbrir(l.id);
          }}
          className="block w-full min-w-0 text-left focus-visible:outline-none"
        >
          <span className="block truncate font-medium text-foreground group-hover:text-primary">
            {l.nome ?? (exibirDocumento(l.documento) || "—")}
          </span>
          <span className="block truncate text-xs tabular-nums text-muted-foreground">
            {l.nome ? exibirDocumento(l.documento) : "sem cliente vinculado"}
          </span>
        </button>
      </td>
      <td className="px-4 py-3 text-right">
        {score != null ? (
          <Selo tom={tomScore(score)}>{score}</Selo>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Selo tom={s.tom} ponto>
            {s.texto}
          </Selo>
          {l.sucesso && l.apontamentos != null && (
            <Selo tom={l.apontamentos > 0 ? "alerta" : "sucesso"}>
              {l.apontamentos > 0 ? pluralizar(l.apontamentos, "apontamento") : "Sem apontamentos"}
            </Selo>
          )}
        </div>
      </td>
      <td className="hidden max-w-[18rem] px-4 py-3 lg:table-cell">
        <span className="block truncate text-xs text-muted-foreground" title={l.finalidade}>
          {finalidadeCurta(l.finalidade)}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
        <span className="block tabular-nums">{quandoRelativo(l.created_at)}</span>
        {l.responsavel && <span className="block truncate">{l.responsavel}</span>}
      </td>
      <td className="pr-3">
        <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden />
      </td>
    </tr>
  );
}
