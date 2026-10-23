import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgePercent } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  concederDescontoLicenca,
  descontoLicenca,
  encerrarDescontoLicenca,
  type Licenca,
} from "@/lib/plataforma/licencas.functions";
import {
  DESCONTO_INICIAL,
  paraDesconto,
  resumoDesconto,
  type Duracao,
  type EstadoDesconto,
} from "@/lib/plataforma/desconto-licenca";

export { DESCONTO_INICIAL, paraDesconto, type EstadoDesconto };

/*
 * Desconto na licença (0254, pedido do dono de 23/10/2026): em porcentagem ou em reais, por
 * quantas faturas a pessoa escolher (só a primeira, as próximas N, ou para sempre). O banco
 * aplica o desconto na fatura de licença quando ela nasce e só conta como usado quando ela é
 * paga. Usado em "Nova licença" e no bloco Desconto das ações da licença.
 */

const DURACOES: { id: Duracao; rotulo: string }[] = [
  { id: "primeira", rotulo: "Só a primeira" },
  { id: "proximas", rotulo: "Próximas faturas" },
  { id: "sempre", rotulo: "Para sempre" },
];

/** Campos do desconto: tipo (% ou R$), quanto e por quanto tempo. */
export function CamposDesconto({
  estado,
  aoMudar,
  prefixo,
}: {
  estado: EstadoDesconto;
  aoMudar: (e: EstadoDesconto) => void;
  prefixo: string;
}) {
  const d = paraDesconto(estado);
  const resumo = resumoDesconto(d);
  const digitou = estado.valor.trim() !== "";
  return (
    <div className="space-y-3">
      <div className="grid gap-3 min-[420px]:grid-cols-[auto_1fr]">
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">Desconto em</span>
          <div
            className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
            role="radiogroup"
            aria-label="Tipo de desconto"
          >
            {(["percentual", "valor"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={estado.tipo === t}
                onClick={() => aoMudar({ ...estado, tipo: t })}
                className={
                  "min-h-10 rounded-md px-4 text-sm font-medium transition-colors " +
                  (estado.tipo === t
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {t === "percentual" ? "%" : "R$"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefixo}-valor`}>
            {estado.tipo === "percentual" ? "Porcentagem" : "Valor por fatura"}
          </Label>
          <div className="relative">
            {estado.tipo === "valor" && (
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                R$
              </span>
            )}
            <Input
              id={`${prefixo}-valor`}
              inputMode="decimal"
              autoComplete="off"
              placeholder={estado.tipo === "percentual" ? "Ex.: 20" : "Ex.: 100,00"}
              className={"tabular-nums " + (estado.tipo === "valor" ? "pl-9" : "pr-8")}
              value={estado.valor}
              aria-invalid={digitou && !d ? true : undefined}
              onChange={(e) => aoMudar({ ...estado, valor: e.target.value })}
            />
            {estado.tipo === "percentual" && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            )}
          </div>
        </div>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-sm font-medium">Por quanto tempo</legend>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="radiogroup">
          {DURACOES.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={estado.duracao === o.id}
              onClick={() => aoMudar({ ...estado, duracao: o.id })}
              className={
                "min-h-10 rounded-md px-2 text-[13px] font-medium leading-tight transition-colors " +
                (estado.duracao === o.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {o.rotulo}
            </button>
          ))}
        </div>
        {estado.duracao === "proximas" && (
          <div className="flex items-center gap-2 pt-1">
            <Label htmlFor={`${prefixo}-faturas`} className="shrink-0 text-sm font-normal">
              Quantas faturas
            </Label>
            <Input
              id={`${prefixo}-faturas`}
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              className="w-24 tabular-nums"
              value={estado.faturas}
              onChange={(e) => aoMudar({ ...estado, faturas: e.target.value })}
            />
          </div>
        )}
      </fieldset>

      {resumo ? (
        <p className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
          <BadgePercent className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            {resumo}{" "}
            <span className="text-muted-foreground">
              Fatura cancelada não conta; a que zerar já nasce paga.
            </span>
          </span>
        </p>
      ) : digitou ? (
        <p className="text-xs text-destructive">
          {estado.tipo === "percentual"
            ? "Informe de 0,01% a 100%."
            : "Informe um valor maior que zero, com até duas casas."}
        </p>
      ) : null}
    </div>
  );
}

/** Bloco "Desconto" nas ações da licença: o vigente, encerrar e conceder (ou trocar). */
export function DescontoDaLicenca({ licenca }: { licenca: Licenca }) {
  const qc = useQueryClient();
  const lerFn = useServerFn(descontoLicenca);
  const concederFn = useServerFn(concederDescontoLicenca);
  const encerrarFn = useServerFn(encerrarDescontoLicenca);
  const chave = ["plataforma-licenca-desconto", licenca.id];
  const q = useQuery({ queryKey: chave, queryFn: () => lerFn({ data: { id: licenca.id } }) });

  const [abrindo, setAbrindo] = useState(false);
  const [estado, setEstado] = useState<EstadoDesconto>(DESCONTO_INICIAL);
  const [motivo, setMotivo] = useState("");
  const [encerrando, setEncerrando] = useState(false);
  const [motivoFim, setMotivoFim] = useState("");

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: chave });
    qc.invalidateQueries({ queryKey: ["plataforma-licenca", licenca.id] });
  };
  const desconto = paraDesconto(estado);

  const conceder = useMutation({
    mutationFn: () => concederFn({ data: { id: licenca.id, desconto: desconto!, motivo } }),
    onSuccess: (r) => {
      toast.success(`Desconto de ${r.rotulo ?? ""} concedido. Vale a partir da próxima fatura.`);
      setEstado(DESCONTO_INICIAL);
      setMotivo("");
      setAbrindo(false);
      recarregar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível conceder o desconto.")),
  });
  const encerrar = useMutation({
    mutationFn: () => encerrarFn({ data: { id: licenca.id, motivo: motivoFim } }),
    onSuccess: () => {
      toast.success("Desconto encerrado. As próximas faturas vêm cheias.");
      setMotivoFim("");
      setEncerrando(false);
      recarregar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível encerrar o desconto.")),
  });

  if (q.isLoading) return <Skeleton className="h-20" />;
  if (q.isError)
    return (
      <p className="text-sm text-destructive">
        {mensagemDeErro(q.error, "Não foi possível ler o desconto.")}
      </p>
    );
  const vigente = q.data?.vigente ?? null;
  const anteriores = q.data?.anteriores ?? [];

  return (
    <div className="space-y-3">
      {vigente ? (
        <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
          <div className="flex items-start gap-2.5">
            <BadgePercent className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {vigente.rotulo} de desconto ·{" "}
                {vigente.faturas_total === null
                  ? `para sempre (${vigente.faturas_usadas} fatura${vigente.faturas_usadas === 1 ? "" : "s"} paga${vigente.faturas_usadas === 1 ? "" : "s"})`
                  : `${vigente.faturas_usadas} de ${vigente.faturas_total} fatura${vigente.faturas_total === 1 ? "" : "s"} usada${vigente.faturas_total === 1 ? "" : "s"}`}
              </p>
              <p className="mt-0.5 break-words text-xs text-muted-foreground">{vigente.motivo}</p>
            </div>
          </div>
          {encerrando ? (
            <div className="mt-3 space-y-2">
              <Textarea
                aria-label="Motivo para encerrar o desconto"
                rows={2}
                placeholder="Motivo (fica registrado na auditoria)"
                value={motivoFim}
                onChange={(e) => setMotivoFim(e.target.value)}
              />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEncerrando(false)}>
                  Voltar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => encerrar.mutate()}
                  disabled={encerrar.isPending || motivoFim.trim().length < 5}
                >
                  {encerrar.isPending ? "Encerrando…" : "Encerrar desconto"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" size="sm" onClick={() => setEncerrando(true)}>
                Encerrar
              </Button>
              {!abrindo && (
                <Button variant="ghost" size="sm" onClick={() => setAbrindo(true)}>
                  Trocar por outro desconto
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        !abrindo && (
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Sem desconto. As faturas vêm cheias.</p>
            <Button size="sm" onClick={() => setAbrindo(true)}>
              <BadgePercent /> Conceder desconto
            </Button>
          </div>
        )
      )}

      {abrindo && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <CamposDesconto estado={estado} aoMudar={setEstado} prefixo={`desc-${licenca.id}`} />
          <Textarea
            aria-label="Motivo do desconto"
            rows={2}
            placeholder="Motivo (ex.: retenção combinada com o cliente)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Vale a partir da próxima fatura. A fatura que já está em aberto não muda.
            {vigente ? " O desconto atual é encerrado e substituído por este." : ""}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAbrindo(false);
                setEstado(DESCONTO_INICIAL);
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => conceder.mutate()}
              disabled={conceder.isPending || !desconto || motivo.trim().length < 5}
            >
              {conceder.isPending
                ? "Concedendo…"
                : vigente
                  ? "Trocar desconto"
                  : "Conceder desconto"}
            </Button>
          </div>
        </div>
      )}

      {anteriores.length > 0 && (
        <details className="group text-sm">
          <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground">
            Descontos anteriores ({anteriores.length})
          </summary>
          <ul className="mt-2 divide-y divide-border">
            {anteriores.map((a) => (
              <li key={a.id} className="py-1.5">
                <p className="text-sm">
                  {a.rotulo} ·{" "}
                  {a.faturas_total === null
                    ? `para sempre, ${a.faturas_usadas} paga(s)`
                    : `${a.faturas_usadas} de ${a.faturas_total} usada(s)`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.encerrado_motivo ?? "Encerrado."} · {a.motivo}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
