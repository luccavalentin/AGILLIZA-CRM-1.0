import { useMemo, useState } from "react";
import { Check, ClipboardList, Copy, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { type ChecklistOperacao, totalItens } from "@/lib/formularios/checklists-operacao";

/**
 * Exibe um checklist de operação (abertura de conta ou dossiê da proposta).
 *
 * A marcação é local e serve ao uso imediato: o operador vai conferindo com o
 * cliente ao telefone. Não persistimos porque o checklist não pertence a uma
 * proposta — é material de apoio, usado antes mesmo de existir cadastro.
 */
export function ChecklistOperacaoView({
  checklist,
  banco,
}: {
  checklist: ChecklistOperacao;
  banco?: string;
}) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  const total = useMemo(() => totalItens(checklist), [checklist]);
  const concluidos = marcados.size;
  const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  const alternar = (chave: string) => {
    setMarcados((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });
  };

  /** Texto pronto para colar no WhatsApp ou no e-mail do cliente. */
  const copiarTexto = async () => {
    const linhas: string[] = [checklist.titulo, ""];
    for (const bloco of checklist.blocos) {
      if (bloco.titulo) linhas.push(`*${bloco.titulo}*`);
      if (bloco.condicao) linhas.push(`(${bloco.condicao})`);
      for (const item of bloco.itens) linhas.push(`• ${item}`);
      linhas.push("");
    }
    try {
      await navigator.clipboard.writeText(linhas.join("\n").trim());
      toast.success("Checklist copiado. É só colar para o cliente.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie à mão.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {banco ? (
            <BancoLogo nome={banco} size="xl" className="shrink-0" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {checklist.titulo}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{checklist.descricao}</p>
          </div>
        </div>

        <Button variant="outline" onClick={copiarTexto} className="shrink-0">
          <Copy className="mr-1.5 h-4 w-4" /> Copiar para o cliente
        </Button>
      </div>

      {/* Progresso da conferência */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Conferência
          </span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {concluidos} de {total}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {checklist.blocos.map((bloco, i) => (
        <Card key={bloco.titulo ?? `bloco-${i}`} className="overflow-hidden">
          {(bloco.titulo || bloco.condicao) && (
            <CardHeader className="border-b border-border bg-muted/30 py-3">
              {bloco.titulo && (
                <CardTitle className="text-sm font-bold uppercase tracking-wide text-foreground">
                  {bloco.titulo}
                </CardTitle>
              )}
              {bloco.condicao && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  {bloco.condicao}
                </p>
              )}
            </CardHeader>
          )}
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {bloco.itens.map((item, j) => {
                const chave = `${i}-${j}`;
                const marcado = marcados.has(chave);
                return (
                  <li key={chave}>
                    <label className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/40">
                      <Checkbox
                        checked={marcado}
                        onCheckedChange={() => alternar(chave)}
                        className="mt-0.5 shrink-0"
                      />
                      <span
                        className={
                          marcado
                            ? "text-sm text-muted-foreground line-through"
                            : "text-sm text-foreground"
                        }
                      >
                        {item}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ))}

      {concluidos === total && total > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm font-medium text-success">
          <Check className="h-4 w-4 shrink-0" /> Checklist completo.
        </div>
      )}
    </div>
  );
}
