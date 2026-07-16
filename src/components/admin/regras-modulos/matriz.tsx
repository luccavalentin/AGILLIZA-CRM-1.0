import { Check, Loader2, Lock, Pencil, Save, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATALOGO_MODULOS,
  type EscopoAlvo,
  type EscopoDados,
  type NivelAcesso,
} from "@/lib/admin/regras-modulos.functions";
import { chave, ESCOPOS, PAPEL_LABEL, type MatrizEstado } from "./constants";

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
    <div className="space-y-2">
      {niveis.map((n) => {
        const ativo = selecionadoId === n.id;
        return (
          <button
            key={n.id}
            onClick={() => onSelecionar(n.id)}
            className={`flex w-full items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
              ativo ? "border-primary bg-accent" : "border-border bg-card hover:bg-accent/50"
            }`}
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium text-foreground">{n.nome}</span>
                {n.is_padrao ? (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    Padrão
                  </Badge>
                ) : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {PAPEL_LABEL[n.papel] ?? n.papel} ·{" "}
                {n.acesso_tipo === "portal_parceiro" ? "Parceiro" : "Correspondente"}
              </p>
              {n.descricao ? (
                <p className="truncate text-xs text-muted-foreground">{n.descricao}</p>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

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
  grupos: [string, typeof CATALOGO_MODULOS][];
  onToggle: (modulo: string, acao: string, permitido: boolean) => void;
  onToggleModulo: (modulo: string, permitido: boolean) => void;
  onSetEscopo: (modulo: string, escopo: EscopoDados) => void;
  onAbrirAlvos: (modulo: string) => void;
  onSalvar: () => void;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-medium text-foreground">{selecionado.nome}</h2>
          <Badge variant="outline">{PAPEL_LABEL[selecionado.papel] ?? selecionado.papel}</Badge>
          <Badge variant="outline">
            {selecionado.acesso_tipo === "portal_parceiro"
              ? "Portal do Parceiro"
              : "Portal do Correspondente"}
          </Badge>
          {selecionado.is_padrao ? (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" /> Padrão
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {editavel ? (
            <>
              <Button variant="outline" size="sm" onClick={onEditar}>
                <Pencil className="h-4 w-4" /> Editar
              </Button>
              {!selecionado.is_padrao ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={onExcluir}
                >
                  <Trash2 className="h-4 w-4" /> Excluir
                </Button>
              ) : null}
            </>
          ) : null}
          <Button onClick={onSalvar} disabled={!editavel || !dirty || salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
            Salvar
          </Button>
        </div>
      </div>
      {!editavel ? (
        <p className="text-sm text-muted-foreground">
          Você não tem permissão para editar níveis de acesso.
        </p>
      ) : selecionado.is_padrao ? (
        <p className="text-sm text-muted-foreground">
          Este é um nível padrão. Você pode renomeá-lo e ajustar as permissões diretamente — as
          alterações são aplicadas a este mesmo nível.
        </p>
      ) : null}

      {grupos.map(([grupo, mods]) => (
        <Card key={grupo} className="overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-2">
            <h3 className="text-sm font-semibold text-foreground">{grupo}</h3>
          </div>
          <div className="divide-y divide-border">
            {mods.map((mod) => {
              const escopoAtual =
                estado[chave(mod.modulo, mod.acoes[0].acao)]?.escopo ?? "proprios";
              const ativos = mod.acoes.filter(
                (a) => estado[chave(mod.modulo, a.acao)]?.permitido,
              ).length;
              const todos = ativos === mod.acoes.length && ativos > 0;
              const nenhum = ativos === 0;
              return (
                <div
                  key={mod.modulo}
                  className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex min-w-[160px] items-center justify-between gap-2 lg:justify-start">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{mod.label}</p>
                      <p className="text-xs text-muted-foreground">{mod.modulo}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!editavel}
                      onClick={() => onToggleModulo(mod.modulo, !todos)}
                      className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50 lg:hidden"
                    >
                      {todos ? "Limpar" : "Tudo"}
                    </button>
                  </div>
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!editavel}
                      onClick={() => onToggleModulo(mod.modulo, !todos)}
                      className={`hidden shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 lg:inline-flex ${
                        todos
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      {todos ? "Limpar" : "Tudo"}
                    </button>
                    {mod.acoes.map((a) => {
                      const ativo = estado[chave(mod.modulo, a.acao)]?.permitido ?? false;
                      return (
                        <button
                          key={a.acao}
                          type="button"
                          disabled={!editavel}
                          aria-pressed={ativo}
                          onClick={() => onToggle(mod.modulo, a.acao, !ativo)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                            ativo
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          }`}
                        >
                          <Check
                            className={`h-3.5 w-3.5 transition-all ${
                              ativo ? "scale-100 opacity-100" : "scale-0 opacity-0"
                            } ${ativo ? "-ml-0.5" : "-ml-2"}`}
                          />
                          {a.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="w-full lg:w-52">
                    <Select
                      value={escopoAtual}
                      disabled={!editavel || nenhum}
                      onValueChange={(v) => onSetEscopo(mod.modulo, v as EscopoDados)}
                    >
                      <SelectTrigger className="h-9">
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
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
