/**
 * Recarga automática do saldo pré-pago da APIFull (0552 do Corretor), na tela "Consultas pagas".
 *
 * O custo das vendas (compra de créditos e consulta avulsa pagas) repõe o saldo da APIFull por um
 * Pix pago pela conta do Asaas; a margem fica no Asaas. Aqui a plataforma liga/desliga, ajusta piso,
 * tetos e o recebedor esperado do Pix, vê o saldo, o que falta repor, a margem estimada por produto e
 * o histórico — e resolve à mão a recarga que ficou em conferência. A regra mora no banco.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, BatteryCharging, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { EstadoErro, Secao, Selo, type Tom } from "@/components/plataforma/kit";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL } from "@/lib/financeiro/format";
import { cn } from "@/lib/utils";
import {
  lerRecargaApifull,
  resolverRecargaApifull,
  salvarRecargaApifull,
  type ConfigRecargaApifull,
  type RecargaApifull,
} from "@/lib/plataforma/consultas.functions";

const QK = "plataforma-recarga-apifull";

const ESTADO: Record<RecargaApifull["estado"], { rotulo: string; tom: Tom }> = {
  pendente: { rotulo: "Pendente", tom: "neutro" },
  cobranca_criada: { rotulo: "Cobrança criada", tom: "info" },
  pagando: { rotulo: "Pagando", tom: "info" },
  paga_no_asaas: { rotulo: "Paga no Asaas", tom: "info" },
  creditada: { rotulo: "Creditada", tom: "sucesso" },
  falhou: { rotulo: "Falhou", tom: "perigo" },
  reconciliar: { rotulo: "Em conferência", tom: "alerta" },
};
const MOTIVO: Record<RecargaApifull["motivo"], string> = {
  repor: "repor vendas",
  piso: "saldo abaixo do piso",
  repor_e_piso: "repor vendas e piso",
};
const PRODUTO: Record<string, string> = {
  "serasa-premium": "Serasa Premium",
  "spc-brasil": "SPC Brasil",
};

const reais = (v: number | null | undefined) => (v == null ? "—" : formatBRL(Number(v)));
const virgula = (v: number | null | undefined) =>
  v == null ? "" : Number(v).toFixed(2).replace(".", ",");
const quando = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export function RecargaApifullSecao() {
  const lerFn = useServerFn(lerRecargaApifull);
  const q = useQuery({ queryKey: [QK], queryFn: () => lerFn() });
  const p = q.data?.painel ?? null;
  const podeEditar = usePermissao("saas.consultas", "edit") && Boolean(q.data?.podeEditar);
  const ligado = Boolean(p?.config.ligado);

  return (
    <Secao
      titulo="Recarga automática da APIFull"
      descricao="A parte do custo de cada venda paga repõe o saldo pré-pago da APIFull por Pix, pago pela conta do Asaas. A margem fica no Asaas."
      icone={<BatteryCharging />}
      acoes={
        <div className="flex items-center gap-2">
          {p && (
            <Selo tom={ligado ? "sucesso" : "neutro"} ponto={ligado}>
              {ligado ? "Ligada" : "Desligada"}
            </Selo>
          )}
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-8"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
            aria-label="Atualizar a recarga"
          >
            <RefreshCw className={cn("size-4", q.isFetching && "animate-spin")} />
          </Button>
        </div>
      }
    >
      {q.isError ? (
        <EstadoErro
          mensagem={mensagemDeErro(q.error, "Não foi possível carregar a recarga da APIFull.")}
          onTentar={() => q.refetch()}
        />
      ) : q.isLoading || !p ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Valor
              rotulo="Saldo na APIFull"
              detalhe={
                p.saldo_apifull ? `lido ${quando(p.saldo_apifull.lido_em)}` : "ainda não lido"
              }
            >
              {reais(p.saldo_apifull?.saldo ?? null)}
            </Valor>
            <Valor rotulo="A repor" detalhe="custo das vendas pagas ainda não recarregado">
              {reais(p.a_repor)}
            </Valor>
            <Valor rotulo="Recarregado hoje" detalhe={`teto diário ${reais(p.config.teto_diario)}`}>
              {reais(p.gasto_hoje)}
            </Valor>
            <Valor rotulo="Piso" detalhe={`até ${reais(p.config.teto_recarga)} por recarga`}>
              {reais(p.config.piso)}
            </Valor>
          </dl>

          <Margens margens={p.margens} taxaPorCredito={p.taxa_por_credito} />

          {podeEditar ? (
            <FormConfig config={p.config} />
          ) : (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" aria-hidden /> Só quem edita Consultas pagas liga a
              recarga e muda tetos.
            </p>
          )}

          <Historico recargas={p.recargas} podeResolver={podeEditar} />
        </div>
      )}
    </Secao>
  );
}

function Valor({
  rotulo,
  detalhe,
  children,
}: {
  rotulo: string;
  detalhe?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border/80 bg-background p-2.5">
      <dt className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </dt>
      <dd className="mt-1 text-base font-medium tabular-nums text-foreground">{children}</dd>
      {detalhe && (
        <dd className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{detalhe}</dd>
      )}
    </div>
  );
}

function Margens({
  margens,
  taxaPorCredito,
}: {
  margens: {
    produto: string;
    creditos: number | null;
    preco: number | null;
    custo: number | null;
    taxa: number | null;
    margem: number | null;
  }[];
  taxaPorCredito: number | null;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-sm font-medium text-foreground">Margem estimada por consulta</p>
      <div className="overflow-x-auto rounded-lg border border-border/80">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Produto</th>
              <th className="px-3 py-2 text-right font-medium">Preço</th>
              <th className="px-3 py-2 text-right font-medium">Custo APIFull</th>
              <th className="px-3 py-2 text-right font-medium">Taxa Asaas</th>
              <th className="px-3 py-2 text-right font-medium">Margem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {margens.map((m) => (
              <tr key={m.produto}>
                <td className="px-3 py-2">
                  {PRODUTO[m.produto] ?? m.produto}
                  {m.creditos != null && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({m.creditos} crédito{m.creditos === 1 ? "" : "s"})
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{reais(m.preco)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {reais(m.custo)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {reais(m.taxa)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-medium tabular-nums",
                    m.margem != null && m.margem > 0 ? "text-success-texto" : "text-destructive",
                  )}
                >
                  {reais(m.margem)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Preço − custo vigente da APIFull − taxa média do Asaas
        {taxaPorCredito != null
          ? ` (${reais(taxaPorCredito)} por crédito, compras dos últimos 90 dias)`
          : " (ainda sem compras com taxa informada)"}
        . Não é lucro líquido.
      </p>
    </div>
  );
}

function FormConfig({ config }: { config: ConfigRecargaApifull }) {
  const qc = useQueryClient();
  const salvarFn = useServerFn(salvarRecargaApifull);
  const [ligado, setLigado] = useState(config.ligado);
  const [piso, setPiso] = useState(virgula(config.piso));
  const [tetoRecarga, setTetoRecarga] = useState(virgula(config.teto_recarga));
  const [tetoDiario, setTetoDiario] = useState(virgula(config.teto_diario));
  const [documento, setDocumento] = useState(config.recebedor_documento ?? "");
  const [nome, setNome] = useState(config.recebedor_nome ?? "");
  useEffect(() => {
    setLigado(config.ligado);
    setPiso(virgula(config.piso));
    setTetoRecarga(virgula(config.teto_recarga));
    setTetoDiario(virgula(config.teto_diario));
    setDocumento(config.recebedor_documento ?? "");
    setNome(config.recebedor_nome ?? "");
  }, [config]);

  const salvar = useMutation({
    mutationFn: () =>
      salvarFn({
        data: {
          ligado,
          piso,
          tetoRecarga,
          tetoDiario,
          recebedorDocumento: documento,
          recebedorNome: nome,
        },
      }),
    onSuccess: () => {
      toast.success(ligado ? "Recarga automática ligada." : "Configuração salva.");
      qc.invalidateQueries({ queryKey: [QK] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar a recarga.")),
  });

  return (
    <form
      className="space-y-4 rounded-lg border border-border/80 bg-secondary/30 p-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      <label
        htmlFor="recarga-ligada"
        className="flex min-h-10 items-center gap-2 text-sm font-medium"
      >
        <Switch
          id="recarga-ligada"
          checked={ligado}
          onCheckedChange={setLigado}
          aria-label="Recarga automática ligada"
        />
        Recarga automática ligada
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo id="recarga-piso" rotulo="Piso de saldo (R$)" valor={piso} onChange={setPiso} />
        <Campo
          id="recarga-teto"
          rotulo="Teto por recarga (R$)"
          valor={tetoRecarga}
          onChange={setTetoRecarga}
        />
        <Campo
          id="recarga-teto-dia"
          rotulo="Teto diário (R$)"
          valor={tetoDiario}
          onChange={setTetoDiario}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="recarga-cnpj">CNPJ da APIFull (obrigatório para ligar)</Label>
          <Input
            id="recarga-cnpj"
            inputMode="numeric"
            className="h-10 text-base tabular-nums sm:text-sm"
            placeholder="00.000.000/0000-00"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="recarga-nome">Nome do recebedor (opcional, conferido igual)</Label>
          <Input
            id="recarga-nome"
            maxLength={120}
            className="h-10 text-base sm:text-sm"
            placeholder="Como aparece no Pix da APIFull"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
      </div>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />O Pix só é pago se o
        recebedor do QR for este CNPJ (e o nome, se informado, for igual) e o valor for o da
        recarga. Recebedor ou valor errado DESLIGA a recarga e abre incidente crítico: confira antes
        de religar. Antes de ligar, libere o pagamento de QR Code pela API no Asaas.
      </p>
      <Button type="submit" size="sm" className="min-h-11 sm:min-h-9" disabled={salvar.isPending}>
        {salvar.isPending ? "Salvando…" : "Salvar recarga"}
      </Button>
    </form>
  );
}

function Campo({
  id,
  rotulo,
  valor,
  onChange,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input
        id={id}
        inputMode="decimal"
        className="h-10 text-base tabular-nums sm:text-sm"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Historico({
  recargas,
  podeResolver,
}: {
  recargas: RecargaApifull[];
  podeResolver: boolean;
}) {
  if (!recargas.length) {
    return <p className="text-sm text-muted-foreground">Nenhuma recarga ainda.</p>;
  }
  return (
    <div className="min-w-0">
      <p className="mb-2 text-sm font-medium text-foreground">Recargas</p>
      <ul className="divide-y divide-border/60 rounded-lg border border-border/80">
        {recargas.map((r) => {
          const e = ESTADO[r.estado] ?? { rotulo: r.estado, tom: "neutro" as Tom };
          return (
            <li key={r.id} className="space-y-1.5 px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium tabular-nums text-foreground">{reais(r.valor)}</span>
                <Selo tom={e.tom} ponto={r.estado === "pagando"}>
                  {e.rotulo}
                </Selo>
              </div>
              <p className="text-xs text-muted-foreground">
                {quando(r.criado_em)} · {MOTIVO[r.motivo] ?? r.motivo}
                {r.saldo_apifull_antes != null
                  ? ` · saldo antes ${reais(r.saldo_apifull_antes)}`
                  : ""}
                {r.asaas_status ? ` · Asaas ${r.asaas_status}` : ""}
              </p>
              {r.erro && <p className="break-words text-xs text-destructive">{r.erro}</p>}
              {r.estado === "reconciliar" && podeResolver && <Resolver id={r.id} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Resolver({ id }: { id: string }) {
  const qc = useQueryClient();
  const fn = useServerFn(resolverRecargaApifull);
  const [motivo, setMotivo] = useState("");
  const resolver = useMutation({
    mutationFn: (desfecho: "creditada" | "falhou") => fn({ data: { id, desfecho, motivo } }),
    onSuccess: () => {
      toast.success("Recarga resolvida.");
      qc.invalidateQueries({ queryKey: [QK] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível resolver a recarga.")),
  });
  const ok = motivo.trim().length >= 10;
  return (
    <div className="space-y-2 rounded-md bg-warning/10 p-2.5">
      <p className="text-xs text-warning-foreground">
        Sem resposta conclusiva do Asaas. Confira o extrato da APIFull e o Asaas antes de decidir —
        a recarga nunca é paga de novo sozinha.
      </p>
      <Input
        aria-label="O que foi conferido"
        placeholder="O que foi conferido (ex.: extrato da APIFull mostra a recarga)"
        className="h-10 text-base sm:text-sm"
        maxLength={300}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="min-h-11 sm:min-h-8"
          disabled={!ok || resolver.isPending}
          onClick={() => resolver.mutate("creditada")}
        >
          O crédito entrou
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="min-h-11 sm:min-h-8"
          disabled={!ok || resolver.isPending}
          onClick={() => resolver.mutate("falhou")}
        >
          Nada foi pago
        </Button>
      </div>
    </div>
  );
}
