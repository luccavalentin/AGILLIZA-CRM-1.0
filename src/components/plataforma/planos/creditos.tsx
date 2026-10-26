/**
 * Pacotes de crédito, custo por operação e prazos de suporte do catálogo. Mesmas funções de
 * antes; o desenho agora é de lista compacta (pacotes e prazos) e grade de cartões (custos).
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Clock3, Coins, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { IconeGestao, Selo } from "@/components/plataforma/kit";
import { formatBRL } from "@/lib/financeiro/format";
import {
  salvarCustoOperacao,
  salvarPacoteCredito,
  salvarSlaPlano,
  type CustoOperacao,
  type PacoteCredito,
  type SlaSuporte,
} from "@/lib/plataforma/planos.functions";
import { horasLegiveis, normalizarMoeda, numero, texto } from "./comum";
import { useSalvarCatalogo } from "./plano";

const cartao = "rounded-[14px] border border-border/80 bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]";

export function LinhaPacote({ pacote, pode }: { pacote: PacoteCredito; pode: boolean }) {
  const fn = useServerFn(salvarPacoteCredito);
  const [nome, setNome] = useState(pacote.nome);
  const [qtd, setQtd] = useState(String(pacote.quantidade));
  const [preco, setPreco] = useState(texto(pacote.preco));
  const [ativo, setAtivo] = useState(pacote.ativo);
  const salvar = useSalvarCatalogo(() => {
    const p = numero(preco);
    if (p === null || Number.isNaN(p)) throw new Error("Preço inválido.");
    return fn({ data: { id: pacote.id, nome, quantidade: Math.trunc(Number(qtd)), preco: p, ativo } });
  }, "Pacote salvo.");
  const q = Number(qtd);
  const p = numero(preco);
  const mudou =
    nome !== pacote.nome || qtd !== String(pacote.quantidade) || p !== pacote.preco || ativo !== pacote.ativo;

  return (
    <div className={`${cartao} grid items-end gap-3 p-3.5 lg:grid-cols-[auto_minmax(0,2fr)_7rem_10rem_auto_auto]`}>
      <IconeGestao icone={<Coins />} tom={ativo ? "marca" : "neutro"} className="hidden lg:inline-grid" />
      <div className="space-y-1">
        <Label htmlFor={`pc-${pacote.id}-nome`}>Pacote</Label>
        <Input id={`pc-${pacote.id}-nome`} value={nome} onChange={(e) => setNome(e.target.value)} disabled={!pode} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:contents">
        <div className="space-y-1">
          <Label htmlFor={`pc-${pacote.id}-qtd`}>Créditos</Label>
          <Input
            id={`pc-${pacote.id}-qtd`}
            inputMode="numeric"
            className="tabular-nums"
            value={qtd}
            onChange={(e) => setQtd(e.target.value)}
            disabled={!pode}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`pc-${pacote.id}-preco`}>Preço</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              R$
            </span>
            <Input
              id={`pc-${pacote.id}-preco`}
              inputMode="decimal"
              className="pl-9 tabular-nums"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              onBlur={(e) => setPreco(normalizarMoeda(e.target.value))}
              disabled={!pode}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 lg:block lg:pb-1">
        <p className="text-xs text-muted-foreground lg:mb-1.5">
          {q > 0 && p != null && !Number.isNaN(p) ? `${formatBRL(p / q)} por crédito` : "—"}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={ativo} onCheckedChange={setAtivo} disabled={!pode} aria-label="À venda" />
          À venda
        </label>
      </div>
      {pode && (
        <Button
          size="sm"
          className="min-h-11 sm:min-h-10"
          variant={mudou ? "default" : "outline"}
          onClick={() => salvar.mutate(undefined)}
          disabled={salvar.isPending}
        >
          Salvar
        </Button>
      )}
    </div>
  );
}

export function CartaoCusto({ custo, pode }: { custo: CustoOperacao; pode: boolean }) {
  const fn = useServerFn(salvarCustoOperacao);
  const [v, setV] = useState(String(custo.creditos));
  const salvar = useSalvarCatalogo(
    () => fn({ data: { operacao: custo.operacao, creditos: Math.trunc(Number(v)) } }),
    `Custo de ${custo.operacao.replace(/_/g, " ")} atualizado.`,
  );
  const nome = custo.operacao.replace(/_/g, " ");
  return (
    <div className={`${cartao} flex flex-col gap-3 p-4`}>
      <div className="flex items-start gap-2.5">
        <IconeGestao icone={<Gauge />} tamanho="sm" />
        <div className="min-w-0">
          <p className="truncate font-medium capitalize text-foreground" title={nome}>
            {nome}
          </p>
          <p className="text-xs text-muted-foreground">Créditos consumidos por uso</p>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2">
        <div className="relative w-28">
          <Input
            aria-label={`Créditos de ${nome}`}
            inputMode="numeric"
            className="pr-14 tabular-nums"
            value={v}
            onChange={(e) => setV(e.target.value)}
            disabled={!pode}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            créd.
          </span>
        </div>
        {pode && (
          <Button
            size="sm"
            variant={v !== String(custo.creditos) ? "default" : "outline"}
            className="min-h-11 sm:min-h-10"
            onClick={() => salvar.mutate(undefined)}
            disabled={salvar.isPending}
          >
            Salvar
          </Button>
        )}
      </div>
    </div>
  );
}

export function LinhaSla({ sla, pode }: { sla: SlaSuporte; pode: boolean }) {
  const fn = useServerFn(salvarSlaPlano);
  const [a, setA] = useState(String(sla.primeira_resposta_horas));
  const [b, setB] = useState(String(sla.resolucao_horas));
  const salvar = useSalvarCatalogo(
    () =>
      fn({
        data: { plano_codigo: sla.plano_codigo, primeira: Math.trunc(Number(a)), resolucao: Math.trunc(Number(b)) },
      }),
    "Prazos de suporte atualizados.",
  );
  const invertido = Number(b) < Number(a);
  const campo = (id: string, rotulo: string, valor: string, set: (v: string) => void) => (
    <div className="space-y-1">
      <Label htmlFor={id}>{rotulo}</Label>
      <div className="relative w-28">
        <Input
          id={id}
          inputMode="numeric"
          className="pr-8 tabular-nums"
          value={valor}
          onChange={(e) => set(e.target.value)}
          disabled={!pode}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          h
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{horasLegiveis(Number(valor))}</p>
    </div>
  );
  return (
    <div className={`${cartao} grid items-start gap-3 p-3.5 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]`}>
      <div className="flex min-w-0 items-start gap-2.5">
        <IconeGestao icone={<Clock3 />} tamanho="sm" />
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{sla.plano ?? sla.plano_codigo}</p>
          <p className="text-xs text-muted-foreground">Prazo do chamado de suporte</p>
          {invertido && (
            <Selo tom="perigo" className="mt-1">
              Resolução menor que a 1ª resposta
            </Selo>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:contents">
        {campo(`sla-${sla.plano_codigo}-a`, "1ª resposta", a, setA)}
        {campo(`sla-${sla.plano_codigo}-b`, "Resolução", b, setB)}
      </div>
      {pode && (
        <Button
          size="sm"
          className="min-h-11 lg:mt-6 lg:min-h-10"
          variant={a !== String(sla.primeira_resposta_horas) || b !== String(sla.resolucao_horas) ? "default" : "outline"}
          onClick={() => salvar.mutate(undefined)}
          disabled={salvar.isPending}
        >
          Salvar
        </Button>
      )}
    </div>
  );
}
