import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CampoBusca,
  ChipsFiltro,
  EstadoVazio,
  IconeGestao,
  Selo,
} from "@/components/plataforma/kit";
import { cn } from "@/lib/utils";
import type { EscopoAlvo, EscopoDados, NivelAcesso } from "@/lib/admin/regras-modulos.functions";
import type { GrupoDoMenu, ModuloNoMenu } from "@/lib/admin/modulos-por-menu";
import { chave, ESCOPOS, PAPEL_LABEL, type MatrizEstado } from "./constants";

/** Lista de níveis (papéis) à esquerda da matriz. */
export function ListaNiveis({
  niveis,
  selecionadoId,
  onSelecionar,
}: {
  niveis: NivelAcesso[];
  selecionadoId: string | null;
  onSelecionar: (id: string) => void;
}) {
  return (
    <nav aria-label="Papéis" className="space-y-1.5">
      <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Papéis ({niveis.length})
      </p>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
        {niveis.map((n) => {
          const ativo = selecionadoId === n.id;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onSelecionar(n.id)}
              aria-current={ativo ? "true" : undefined}
              className={cn(
                "flex min-h-11 w-56 shrink-0 items-start gap-2.5 rounded-[12px] border p-2.5 text-left transition-colors md:w-full",
                ativo
                  ? "border-primary/40 bg-primary/[0.06] ring-1 ring-primary/20"
                  : "border-border/80 bg-card hover:bg-primary/[0.03]",
              )}
            >
              <IconeGestao icone={<ShieldCheck />} tamanho="sm" tom={ativo ? "marca" : "neutro"} />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-foreground">{n.nome}</span>
                  {n.is_padrao ? <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="Padrão" /> : null}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {PAPEL_LABEL[n.papel] ?? n.papel} ·{" "}
                  {n.acesso_tipo === "portal_parceiro" ? "Parceiro" : "Correspondente"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

type Visao = "todos" | "liberados" | "sem";

/**
 * Matriz de permissões de um papel, agrupada como o menu (CRM, Operacional, …,
 * Configurações gerais). Cada linha é um módulo com o nome que a pessoa vê no menu; a
 * chave técnica fica discreta embaixo (ela nunca muda).
 */
export function MatrizPermissoes({
  selecionado,
  estado,
  alvos,
  editavel,
  dirty,
  salvando,
  grupos,
  onToggle,
  onToggleModulo,
  onSetEscopo,
  onAbrirAlvos,
  onSalvar,
  onEditar,
  onExcluir,
}: {
  selecionado: NivelAcesso;
  estado: MatrizEstado;
  alvos: Record<string, EscopoAlvo[]>;
  editavel: boolean;
  dirty: boolean;
  salvando: boolean;
  grupos: GrupoDoMenu[];
  onToggle: (modulo: string, acao: string, permitido: boolean) => void;
  onToggleModulo: (modulo: string, permitido: boolean) => void;
  onSetEscopo: (modulo: string, escopo: EscopoDados) => void;
  onAbrirAlvos: (modulo: string) => void;
  onSalvar: () => void;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [visao, setVisao] = useState<Visao>("todos");

  const ativosDe = (m: ModuloNoMenu) =>
    m.acoes.filter((a) => estado[chave(m.modulo, a.acao)]?.permitido).length;

  const total = grupos.reduce((n, g) => n + g.modulos.length, 0);
  const liberados = grupos.reduce((n, g) => n + g.modulos.filter((m) => ativosDe(m) > 0).length, 0);

  const filtrados = useMemo(() => {
    const termo = busca
      .trim()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
    const casa = (m: ModuloNoMenu) =>
      !termo ||
      [m.rotuloMenu, m.label, m.modulo, ...m.telas]
        .join(" ")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .includes(termo);
    return grupos
      .map((g) => ({
        grupo: g.grupo,
        modulos: g.modulos.filter((m) => {
          const n = m.acoes.filter((a) => estado[chave(m.modulo, a.acao)]?.permitido).length;
          if (visao === "liberados" && n === 0) return false;
          if (visao === "sem" && n > 0) return false;
          return casa(m);
        }),
      }))
      .filter((g) => g.modulos.length > 0);
  }, [grupos, busca, visao, estado]);

  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-[14px] border border-border/80 bg-card p-4 shadow-[0_1px_2px_rgb(16_24_40/0.04)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <IconeGestao icone={<KeyRound />} tamanho="lg" />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-foreground">{selecionado.nome}</h2>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Selo tom="marca">{PAPEL_LABEL[selecionado.papel] ?? selecionado.papel}</Selo>
                <Selo>
                  {selecionado.acesso_tipo === "portal_parceiro"
                    ? "Portal do Parceiro"
                    : "Portal do Correspondente"}
                </Selo>
                {selecionado.is_padrao ? <Selo tom="info">Padrão</Selo> : null}
                <Selo tom={liberados > 0 ? "sucesso" : "neutro"} ponto>
                  {liberados} de {total} módulos liberados
                </Selo>
              </div>
              {selecionado.descricao ? (
                <p className="mt-1.5 text-sm text-muted-foreground">{selecionado.descricao}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {editavel ? (
              <>
                <Button variant="outline" size="sm" className="min-h-11 sm:min-h-8" onClick={onEditar}>
                  <Pencil className="size-4" /> Editar papel
                </Button>
                {!selecionado.is_padrao ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 text-destructive hover:text-destructive sm:min-h-8"
                    onClick={onExcluir}
                  >
                    <Trash2 className="size-4" /> Excluir
                  </Button>
                ) : null}
              </>
            ) : null}
            <Button
              size="sm"
              className="min-h-11 sm:min-h-8"
              onClick={onSalvar}
              disabled={!editavel || !dirty || salvando}
            >
              {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{" "}
              Salvar permissões
            </Button>
          </div>
        </div>
        {!editavel ? (
          <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Você vê as permissões deste papel, mas não pode alterá-las.
          </p>
        ) : selecionado.is_padrao ? (
          <p className="mt-3 rounded-md bg-primary/[0.04] px-3 py-2 text-sm text-muted-foreground">
            Papel padrão: dá para renomear e ajustar as permissões; as mudanças valem para este
            mesmo papel e para todas as pessoas dele.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
        <CampoBusca
          valor={busca}
          onChange={setBusca}
          rotulo="Buscar módulo"
          placeholder="Buscar por módulo ou tela…"
        />
        <ChipsFiltro<Visao>
          rotulo="Mostrar"
          valor={visao}
          onChange={setVisao}
          opcoes={[
            { valor: "todos", rotulo: "Todos", contagem: total },
            { valor: "liberados", rotulo: "Liberados", contagem: liberados },
            { valor: "sem", rotulo: "Sem acesso", contagem: total - liberados },
          ]}
        />
      </div>

      {filtrados.length === 0 ? (
        <EstadoVazio
          icone={<KeyRound />}
          titulo="Nenhum módulo com estes filtros"
          descricao="Limpe a busca ou escolha outra visão."
        />
      ) : (
        filtrados.map((g) => {
          const doGrupo = grupos.find((x) => x.grupo === g.grupo)?.modulos ?? g.modulos;
          const liberadosGrupo = doGrupo.filter((m) => ativosDe(m) > 0).length;
          const tudo = doGrupo.every((m) => ativosDe(m) === m.acoes.length);
          return (
            <details
              key={g.grupo}
              open
              className="group/grupo overflow-hidden rounded-[14px] border border-border/80 bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]"
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 border-b border-border/70 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 items-center gap-2">
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open/grupo:rotate-0 -rotate-90" />
                  <span className="truncate text-[15px] font-semibold text-foreground">{g.grupo}</span>
                  <Selo tom={liberadosGrupo > 0 ? "sucesso" : "neutro"}>
                    {liberadosGrupo}/{doGrupo.length}
                  </Selo>
                </span>
                {editavel ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      for (const m of doGrupo) onToggleModulo(m.modulo, !tudo);
                    }}
                    className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/[0.04] hover:text-foreground"
                  >
                    {tudo ? "Limpar grupo" : "Liberar o grupo"}
                  </button>
                ) : null}
              </summary>
              <div className="divide-y divide-border/70">
                {g.modulos.map((mod) => (
                  <LinhaModulo
                    key={mod.modulo}
                    mod={mod}
                    estado={estado}
                    alvos={alvos}
                    editavel={editavel}
                    onToggle={onToggle}
                    onToggleModulo={onToggleModulo}
                    onSetEscopo={onSetEscopo}
                    onAbrirAlvos={onAbrirAlvos}
                  />
                ))}
              </div>
            </details>
          );
        })
      )}

      {editavel && dirty ? (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-primary/25 bg-card/95 p-3 shadow-[0_8px_24px_-12px_rgb(0_10_112/0.35)]">
          <p className="text-sm text-foreground">Há mudanças nas permissões que ainda não foram salvas.</p>
          <Button size="sm" className="min-h-11 sm:min-h-8" onClick={onSalvar} disabled={salvando}>
            {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{" "}
            Salvar permissões
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function LinhaModulo({
  mod,
  estado,
  alvos,
  editavel,
  onToggle,
  onToggleModulo,
  onSetEscopo,
  onAbrirAlvos,
}: {
  mod: ModuloNoMenu;
  estado: MatrizEstado;
  alvos: Record<string, EscopoAlvo[]>;
  editavel: boolean;
  onToggle: (modulo: string, acao: string, permitido: boolean) => void;
  onToggleModulo: (modulo: string, permitido: boolean) => void;
  onSetEscopo: (modulo: string, escopo: EscopoDados) => void;
  onAbrirAlvos: (modulo: string) => void;
}) {
  const escopoAtual = estado[chave(mod.modulo, mod.acoes[0]?.acao ?? "view")]?.escopo ?? "proprios";
  const ativos = mod.acoes.filter((a) => estado[chave(mod.modulo, a.acao)]?.permitido).length;
  const todos = ativos === mod.acoes.length && ativos > 0;
  const nenhum = ativos === 0;
  const outrasTelas = mod.telas.filter((t) => t !== mod.rotuloMenu);

  return (
    <div className="grid gap-3 p-4 lg:grid-cols-[minmax(200px,1fr)_minmax(0,2fr)_13rem] lg:items-center">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{mod.rotuloMenu}</p>
          <p className="truncate font-mono text-[11px] text-muted-foreground" title={mod.modulo}>
            {mod.modulo}
            {mod.rotuloMenu !== mod.label ? ` · antes “${mod.label}”` : ""}
          </p>
          {outrasTelas.length > 0 ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              Abre também: {outrasTelas.join(", ")}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={!editavel}
          onClick={() => onToggleModulo(mod.modulo, !todos)}
          className={cn(
            "min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-50",
            todos
              ? "border-primary bg-primary/[0.08] text-primary"
              : "border-border text-muted-foreground hover:bg-primary/[0.04] hover:text-foreground",
          )}
        >
          {todos ? "Limpar" : "Tudo"}
        </button>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {mod.acoes.map((a) => {
          const ativo = estado[chave(mod.modulo, a.acao)]?.permitido ?? false;
          return (
            <button
              key={a.acao}
              type="button"
              disabled={!editavel}
              aria-pressed={ativo}
              onClick={() => onToggle(mod.modulo, a.acao, !ativo)}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50",
                ativo
                  ? "border-primary bg-primary text-primary-foreground shadow-[0_1px_2px_rgb(0_10_112/0.2)]"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <Check
                className={cn(
                  "size-3.5 transition-all",
                  ativo ? "-ml-0.5 scale-100 opacity-100" : "-ml-2 scale-0 opacity-0",
                )}
              />
              {a.label}
            </button>
          );
        })}
      </div>
      <div className="w-full sm:w-64 lg:w-full">
        <Select
          value={escopoAtual}
          disabled={!editavel || nenhum}
          onValueChange={(v) => onSetEscopo(mod.modulo, v as EscopoDados)}
        >
          <SelectTrigger className="h-10" aria-label={`Dados que ${mod.rotuloMenu} mostra`}>
            <SelectValue placeholder="Escopo" />
          </SelectTrigger>
          <SelectContent>
            {ESCOPOS.map((e) => (
              <SelectItem key={e.value} value={e.value}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {escopoAtual === "personalizado" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!editavel}
            className="mt-2 w-full"
            onClick={() => onAbrirAlvos(mod.modulo)}
          >
            Escolher quem ({(alvos[mod.modulo] ?? []).length})
          </Button>
        ) : null}
      </div>
    </div>
  );
}
