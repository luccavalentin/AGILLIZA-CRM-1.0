import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, CheckCircle2, CircleSlash, FileUp, GitCompareArrows, Link2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { consultar, executar, executarOuFalhar, invalidarFinanceiro, type AvisoFinanceiro } from "@/lib/financeiro/cliente";
import type { DetalheExtrato, Extrato, LinhaExtrato, SugestaoConciliacao } from "@/lib/financeiro/tipos";
import { lerExtrato, sha256Hex, type LeituraExtrato } from "@/lib/financeiro/extrato";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Carregando, Chip, Erro, Metrica, Metricas, PaginaFin, Pilulas, Vazio, dataBR, moeda, type DefChip } from "@/components/financeiro/matriz/base";
import { useCadastros } from "@/components/financeiro/matriz/comuns";
import { DialogoAviso, DialogoMotivo } from "@/components/financeiro/matriz/dialogos";
import { enviarAnexo } from "@/components/financeiro/matriz/anexos";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/financeiro/conciliacao")({
  head: () => ({ meta: [{ title: "Conciliação bancária — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.conciliacao"),
  component: Pagina,
});

const TIPO: Record<string, string> = {
  baixa: "Pagamento já registrado",
  comissao_banco: "Comissão do banco",
  conta_receber: "Conta a receber",
  conta_pagar: "Conta a pagar",
  comissao_participante: "Comissão de corretor/parceiro",
  repasse_assinante: "Repasse ao assinante",
};
const SINAL: Record<string, DefChip> = {
  exato: { rotulo: "valor exato", tom: "sucesso" },
  parcial: { rotulo: "parcial", tom: "alerta" },
  pagamento_registrado: { rotulo: "já registrado", tom: "info" },
  disputada: { rotulo: "outra linha também", tom: "perigo" },
};
const SITUACAO_LINHA: Record<string, DefChip> = {
  pendente: { rotulo: "Pendente", tom: "alerta" },
  conciliada: { rotulo: "Conciliada", tom: "sucesso" },
  ignorada: { rotulo: "Fora", tom: "neutro" },
  duplicada: { rotulo: "Duplicada", tom: "neutro" },
};

function Pagina() {
  const qc = useQueryClient();
  const podeImportar = usePermissao("financeiro.conciliacao", "create");
  const podeConciliar = usePermissao("financeiro.conciliacao", "conciliar");
  const extratos = useQuery({ queryKey: ["financeiro", "extratos"], queryFn: () => consultar<Extrato[]>("extratos") });
  const [atual, setAtual] = useState<string | null>(null);
  const escolhido = atual ?? extratos.data?.[0]?.id ?? null;
  const [importar, setImportar] = useState(false);
  const lista = extratos.data ?? [];
  const pendentes = lista.reduce((s, e) => s + e.pendentes, 0);

  return (
    <PaginaFin
      titulo="Conciliação bancária"
      descricao="Importe o extrato (OFX ou CSV): o sistema SUGERE o lançamento de cada movimentação por valor, data, descrição e documento. Nada muda até você confirmar; dá para desfazer com motivo."
      icone={GitCompareArrows}
      acoes={
        podeImportar && (
          <Button size="sm" className="gap-1.5" onClick={() => setImportar(true)}>
            <FileUp className="h-4 w-4" /> Importar extrato
          </Button>
        )
      }
    >
      <Metricas colunas={3}>
        <Metrica rotulo="Extratos importados" valor={String(lista.length)} tom="marca" icone={FileUp} />
        <Metrica rotulo="Movimentações pendentes" valor={String(pendentes)} tom={pendentes ? "alerta" : "sucesso"} icone={CircleSlash} />
        <Metrica rotulo="Conciliadas" valor={String(lista.reduce((s, e) => s + e.conciliadas, 0))} tom="sucesso" icone={CheckCircle2} />
      </Metricas>

      {extratos.isLoading ? (
        <Carregando />
      ) : extratos.error ? (
        <Erro erro={extratos.error} onTentar={() => extratos.refetch()} />
      ) : lista.length === 0 ? (
        <Vazio
          titulo="Nenhum extrato importado"
          descricao="Baixe o extrato no internet banking em OFX (preferível) ou CSV e importe aqui. O mesmo arquivo ou a mesma movimentação não entram duas vezes."
          acao={podeImportar && <Button onClick={() => setImportar(true)}>Importar extrato</Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <ul className="space-y-2">
            {lista.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setAtual(e.id)}
                  className={cn(
                    "w-full rounded-2xl border bg-card p-3 text-left shadow-sm transition-colors",
                    escolhido === e.id ? "border-primary ring-2 ring-primary/15" : "border-border/70 hover:border-primary/40",
                  )}
                >
                  <p className="truncate text-sm font-semibold">{e.arquivo}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {e.conta} · {dataBR(e.periodo_de)} a {dataBR(e.periodo_ate)}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded-full bg-warning/15 px-2 py-0.5 font-medium text-warning">{e.pendentes} pendentes</span>
                    <span className="rounded-full bg-success/10 px-2 py-0.5 font-medium text-success">{e.conciliadas} conciliadas</span>
                    {e.duplicadas > 0 && <span className="rounded-full bg-muted px-2 py-0.5">{e.duplicadas} repetidas</span>}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Importado em {new Date(e.importado_em).toLocaleString("pt-BR")} {e.importado_por ? `por ${e.importado_por}` : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          {escolhido && <ExtratoDetalhe id={escolhido} podeConciliar={podeConciliar} />}
        </div>
      )}
      <ImportarExtrato
        aberto={importar}
        onFechar={() => setImportar(false)}
        aoImportar={(id) => {
          setAtual(id);
          void invalidarFinanceiro(qc);
        }}
      />
    </PaginaFin>
  );
}

function ExtratoDetalhe({ id, podeConciliar }: { id: string; podeConciliar: boolean }) {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<"pendente" | "conciliada" | "todas">("pendente");
  const q = useQuery({ queryKey: ["financeiro", "extrato", id], queryFn: () => consultar<DetalheExtrato>("extrato", { _extrato: id }) });
  const [desfazer, setDesfazer] = useState<string | null>(null);
  const [ignorar, setIgnorar] = useState<string | null>(null);
  const [excedente, setExcedente] = useState<{ aviso: AvisoFinanceiro; linha: string; s: SugestaoConciliacao } | null>(null);
  const sug = new Map((q.data?.sugestoes ?? []).map((s) => [s.linha_id, s.sugestoes]));
  const linhas = (q.data?.linhas ?? []).filter((l) => filtro === "todas" || l.situacao === filtro);

  async function confirmar(linha: string, s: SugestaoConciliacao, permitir = false) {
    try {
      const r = await executar("conciliar", { _linha: linha, _tipo: s.tipo, _alvo: s.alvo_id, _permitir_excedente: permitir });
      if (!r.ok) {
        if (r.aviso === "excedente") setExcedente({ aviso: r, linha, s });
        else toast.error(r.mensagem);
        return;
      }
      toast.success("Conciliado.");
      await invalidarFinanceiro(qc);
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível conciliar."));
    }
  }

  async function rejeitar(linha: string, s: SugestaoConciliacao) {
    try {
      await executarOuFalhar("rejeitarSugestao", { _linha: linha, _tipo: s.tipo, _alvo: s.alvo_id });
      await invalidarFinanceiro(qc);
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível rejeitar."));
    }
  }

  return (
    <section className="min-w-0 space-y-3">
      <Pilulas
        valor={filtro}
        onChange={setFiltro}
        opcoes={[
          { valor: "pendente", rotulo: "Pendentes", contador: q.data?.linhas.filter((l) => l.situacao === "pendente").length },
          { valor: "conciliada", rotulo: "Conciliadas" },
          { valor: "todas", rotulo: "Todas" },
        ]}
      />
      {q.isLoading ? (
        <Carregando />
      ) : q.error ? (
        <Erro erro={q.error} onTentar={() => q.refetch()} />
      ) : linhas.length === 0 ? (
        <Vazio titulo={filtro === "pendente" ? "Tudo conciliado neste extrato" : "Nada aqui"} />
      ) : (
        <ul className="space-y-2">
          {linhas.map((l) => (
            <LinhaCartao
              key={l.id}
              l={l}
              sugestoes={sug.get(l.id) ?? []}
              podeConciliar={podeConciliar}
              onConfirmar={(s) => confirmar(l.id, s)}
              onRejeitar={(s) => rejeitar(l.id, s)}
              onDesfazer={() => setDesfazer(l.conciliacao!.id)}
              onIgnorar={() => setIgnorar(l.id)}
              onReabrir={async () => {
                await executarOuFalhar("ignorarLinha", { _linha: l.id, _motivo: "Reaberta", _reabrir: true }).catch((e) => toast.error(e.message));
                await invalidarFinanceiro(qc);
              }}
            />
          ))}
        </ul>
      )}
      <DialogoMotivo
        aberto={!!desfazer}
        titulo="Desfazer conciliação"
        descricao="A movimentação volta a pendente. Se o pagamento foi criado pela conciliação, ele é estornado."
        perigo
        confirmar="Desfazer"
        onFechar={() => setDesfazer(null)}
        onConfirmar={async (motivo) => {
          await executarOuFalhar("desfazerConciliacao", { _id: desfazer, _motivo: motivo });
          toast.success("Conciliação desfeita.");
          await invalidarFinanceiro(qc);
        }}
      />
      <DialogoMotivo
        aberto={!!ignorar}
        titulo="Deixar a movimentação de fora"
        descricao="Ex.: tarifa bancária, transferência entre contas próprias. Pode ser reaberta depois."
        onFechar={() => setIgnorar(null)}
        onConfirmar={async (motivo) => {
          await executarOuFalhar("ignorarLinha", { _linha: ignorar, _motivo: motivo });
          await invalidarFinanceiro(qc);
        }}
      />
      <DialogoAviso
        aviso={excedente ? { ...excedente.aviso, aviso: "duplicidade", mensagem: `${excedente.aviso.mensagem} O recebimento fica registrado como divergente.` } : null}
        onFechar={() => setExcedente(null)}
        onConfirmar={async () => {
          const e = excedente!;
          setExcedente(null);
          await confirmar(e.linha, e.s, true);
        }}
      />
    </section>
  );
}

function LinhaCartao({
  l,
  sugestoes,
  podeConciliar,
  onConfirmar,
  onRejeitar,
  onDesfazer,
  onIgnorar,
  onReabrir,
}: {
  l: LinhaExtrato;
  sugestoes: SugestaoConciliacao[];
  podeConciliar: boolean;
  onConfirmar: (s: SugestaoConciliacao) => void;
  onRejeitar: (s: SugestaoConciliacao) => void;
  onDesfazer: () => void;
  onIgnorar: () => void;
  onReabrir: () => void;
}) {
  const entrada = l.valor > 0;
  return (
    <li className={cn("rounded-2xl border bg-card p-3 shadow-sm", l.situacao === "duplicada" && "opacity-60")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{l.descricao || "Sem descrição"}</p>
          <p className="text-[11px] text-muted-foreground">
            {dataBR(l.data)} {l.documento ? `· doc. ${l.documento}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("font-mono text-sm font-semibold tabular-nums", entrada ? "text-success" : "text-foreground")}>
            {entrada ? "+" : "−"} {moeda(Math.abs(l.valor))}
          </span>
          <Chip def={SITUACAO_LINHA[l.situacao]} />
        </div>
      </div>
      {l.situacao === "conciliada" && l.conciliacao && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-success/5 px-3 py-2 text-xs">
          <span className="flex min-w-0 items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-success" />
            <span className="truncate">
              {TIPO[l.conciliacao.natureza]}: {l.conciliacao.descricao} · {l.conciliacao.confirmado_por ?? ""}
              {l.conciliacao.criou_baixa ? " · registrou o pagamento" : ""}
            </span>
          </span>
          {podeConciliar && (
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-destructive" onClick={onDesfazer}>
              <Undo2 className="h-3.5 w-3.5" /> Desfazer
            </Button>
          )}
        </div>
      )}
      {l.situacao === "ignorada" && (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Fora da conciliação: {l.ignorada_motivo}</span>
          {podeConciliar && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onReabrir}>
              Reabrir
            </Button>
          )}
        </div>
      )}
      {l.situacao === "pendente" && (
        <div className="mt-2 space-y-1.5">
          {sugestoes.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem sugestão: registre o lançamento na tela do fluxo e volte, ou deixe de fora.</p>
          ) : (
            sugestoes.map((s) => (
              <div key={s.tipo + s.alvo_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 px-3 py-2">
                <div className="min-w-0 text-xs">
                  <p className="truncate font-medium text-foreground">{s.descricao ?? TIPO[s.tipo]}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                    {TIPO[s.tipo]} · {moeda(s.valor)} {s.data ? `· ${dataBR(s.data)}` : ""}
                    {s.sinais.map((x) => (
                      <Chip key={x} def={SINAL[x] ?? { rotulo: x, tom: "neutro" }} className="py-0 text-[10px]" />
                    ))}
                  </p>
                </div>
                {podeConciliar && (
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => onConfirmar(s)}>
                      <Check className="h-3.5 w-3.5" /> Confirmar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => onRejeitar(s)} aria-label="Rejeitar sugestão">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
          {podeConciliar && (
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" onClick={onIgnorar}>
              <Ban className="h-3.5 w-3.5" /> Deixar de fora
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function ImportarExtrato({ aberto, onFechar, aoImportar }: { aberto: boolean; onFechar: () => void; aoImportar: (id: string) => void }) {
  const cad = useCadastros();
  const [conta, setConta] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [leitura, setLeitura] = useState<LeituraExtrato | null>(null);
  const [sha, setSha] = useState("");
  const [aviso, setAviso] = useState<AvisoFinanceiro | null>(null);
  const [enviando, setEnviando] = useState(false);
  const contas = (cad.data?.contas_bancarias ?? []).filter((c) => c.ativo);

  async function escolher(f: File | null) {
    setArquivo(f);
    setLeitura(null);
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Arquivo acima de 8 MB.");
      return;
    }
    const buf = await f.arrayBuffer();
    setSha(await sha256Hex(buf));
    let texto = new TextDecoder("utf-8").decode(buf);
    if (texto.includes("�")) texto = new TextDecoder("windows-1252").decode(buf);
    setLeitura(lerExtrato(f.name, texto));
  }

  async function enviar(confirmar = false) {
    if (!leitura || !arquivo) return;
    setEnviando(true);
    try {
      const anexo = await enviarAnexo(arquivo, "conciliacao", "extrato").catch(() => null);
      const r = await executar<{ extrato_id: string; novas: number; duplicadas: number }>("importarExtrato", {
        _conta: conta,
        _arquivo: arquivo.name.slice(0, 200),
        _sha: sha,
        _formato: leitura.formato,
        _linhas: leitura.movimentos,
        _confirmar: confirmar,
        _anexo: anexo,
      });
      if (!r.ok) {
        setAviso(r);
        return;
      }
      toast.success(`${r.dados.novas} movimentação(ões) importada(s)${r.dados.duplicadas ? ` · ${r.dados.duplicadas} já existiam e ficaram marcadas` : ""}.`);
      aoImportar(r.dados.extrato_id);
      setArquivo(null);
      setLeitura(null);
      onFechar();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível importar."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Dialog open={aberto} onOpenChange={(o) => !o && !enviando && onFechar()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar extrato</DialogTitle>
            <DialogDescription>OFX (recomendado) ou CSV do internet banking. O arquivo original fica guardado com quem importou e quando.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Conta bancária</Label>
              <Select value={conta} onValueChange={setConta}>
                <SelectTrigger>
                  <SelectValue placeholder={contas.length ? "Escolha a conta" : "Cadastre a conta em Regras e configurações"} />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.apelido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-border px-4 py-6 text-center hover:border-primary/50">
              <FileUp className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">{arquivo ? arquivo.name : "Escolher arquivo .ofx ou .csv"}</span>
              <input type="file" accept=".ofx,.csv,.txt,text/csv,application/x-ofx" className="hidden" onChange={(e) => void escolher(e.target.files?.[0] ?? null)} />
            </label>
            {leitura && (
              <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-xs">
                <p className="font-medium">
                  {leitura.movimentos.length} movimentação(ões) lida(s) · formato {leitura.formato.toUpperCase()}
                </p>
                {leitura.movimentos.slice(0, 4).map((m) => (
                  <p key={m.ordem} className="flex justify-between gap-2 text-muted-foreground">
                    <span className="truncate">
                      {dataBR(m.data)} {m.descricao}
                    </span>
                    <span className="font-mono tabular-nums">{moeda(m.valor)}</span>
                  </p>
                ))}
                {leitura.avisos.slice(0, 4).map((a) => (
                  <p key={a} className="text-warning">
                    {a}
                  </p>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={onFechar} disabled={enviando}>
              Voltar
            </Button>
            <Button disabled={!conta || !leitura?.movimentos.length || enviando} onClick={() => enviar(false)}>
              {enviando ? "Importando…" : "Importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DialogoAviso aviso={aviso} onFechar={() => setAviso(null)} onConfirmar={() => enviar(true)} />
    </>
  );
}
