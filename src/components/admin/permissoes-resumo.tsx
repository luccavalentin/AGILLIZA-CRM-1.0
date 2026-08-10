import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  CATALOGO_MODULOS,
  type EscopoDados,
  type NivelAcesso,
} from "@/lib/admin/regras-modulos.functions";

const ROTULO_ESCOPO: Record<EscopoDados, string> = {
  todos: "todos os dados",
  equipe: "dados da equipe",
  proprios: "apenas os próprios",
  personalizado: "escopo personalizado",
};

const rotuloAcao = (modulo: string, acao: string) =>
  CATALOGO_MODULOS.find((m) => m.modulo === modulo)?.acoes.find((a) => a.acao === acao)?.label ??
  acao;

/**
 * Resumo somente-leitura das permissões efetivas de um nível de acesso.
 * Mostra, agrupado por módulo, o que a pessoa desse nível pode fazer e com
 * qual abrangência de dados. Como as permissões são vinculadas ao nível,
 * qualquer alteração nas regras vale imediatamente para todas as pessoas dele.
 */
export function PermissoesResumo({ nivel }: { nivel: NivelAcesso | undefined }) {
  const porModulo = useMemo(() => {
    const ativos = (nivel?.permissoes ?? []).filter((p) => p.permitido);
    const mapa = new Map<string, { escopo: EscopoDados; acoes: string[] }>();
    for (const mod of CATALOGO_MODULOS) {
      const perms = ativos.filter((p) => p.modulo === mod.modulo);
      if (perms.length === 0) continue;
      mapa.set(mod.modulo, {
        escopo: perms[0].escopo_dados,
        acoes: perms.map((p) => rotuloAcao(mod.modulo, p.acao)),
      });
    }
    return mapa;
  }, [nivel]);

  if (!nivel) return null;

  if (porModulo.size === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Este nível ainda não tem permissões liberadas. Ajuste em “Papéis &amp; Permissões”.
      </p>
    );
  }

  const grupos = Array.from(new Set(CATALOGO_MODULOS.map((m) => m.grupo)));

  return (
    <div className="space-y-3">
      {grupos.map((grupo) => {
        const mods = CATALOGO_MODULOS.filter((m) => m.grupo === grupo && porModulo.has(m.modulo));
        if (mods.length === 0) return null;
        return (
          <div key={grupo} className="space-y-1.5">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {grupo}
            </p>
            <div className="space-y-1.5">
              {mods.map((mod) => {
                const info = porModulo.get(mod.modulo)!;
                return (
                  <div
                    key={mod.modulo}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                  >
                    <span className="font-medium text-foreground">{mod.label}:</span>
                    {info.acoes.map((a) => (
                      <Badge key={a} variant="secondary" className="font-normal">
                        {a}
                      </Badge>
                    ))}
                    <span className="text-xs text-muted-foreground">
                      ({ROTULO_ESCOPO[info.escopo]})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
