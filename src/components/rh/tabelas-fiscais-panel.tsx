/**
 * RH › Configurações › Tabelas da folha. As vigências padrão do sistema aparecem para
 * consulta; a empresa cria uma vigência própria (copiando a vigente) quando a lei muda.
 * Na mesma data, a própria vence a padrão. Competência fechada não é recalculada.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EstadoLista } from "@/components/rh/estado-lista";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { usePermissao } from "@/hooks/use-permissao";
import { excluirTabelaFiscal, listarTabelasFiscais, salvarTabelaFiscal } from "@/lib/rh/tabelas-fiscais.functions";
import type { TabelaFiscal } from "@/lib/rh/clt";
import { formatBRL } from "@/lib/financeiro/format";
import { mensagemDeErro } from "@/lib/erros/mensagem";

const pct = (n: number) => `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}%`;
const mesAno = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
/** "2.793,88" ou "2793.88" → 2793.88 (vírgula manda quando aparece). */
const num = (s: string) => {
  const t = String(s).trim();
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t) || 0;
};
const txt = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

export function TabelasFiscaisPanel() {
  const qc = useQueryClient();
  const podeEditar = usePermissao("rh.configuracoes", "edit");
  const fnListar = useServerFn(listarTabelasFiscais);
  const fnSalvar = useServerFn(salvarTabelaFiscal);
  const fnExcluir = useServerFn(excluirTabelaFiscal);
  const q = useQuery({ queryKey: ["rh-tabelas-fiscais"], queryFn: () => fnListar() });
  const [edit, setEdit] = useState<TabelaFiscal | null>(null);

  const salvar = useMutation({
    mutationFn: (t: TabelaFiscal) =>
      fnSalvar({
        data: {
          id: t.correspondente_id ? t.id : undefined,
          vigencia_desde: t.vigencia_desde,
          salario_minimo: t.salario_minimo,
          inss_faixas: t.inss_faixas,
          irrf_faixas: t.irrf_faixas,
          irrf_dependente: t.irrf_dependente,
          irrf_desconto_simplificado: t.irrf_desconto_simplificado,
          irrf_reducao: t.irrf_reducao,
          salario_familia_quota: t.salario_familia_quota,
          salario_familia_teto: t.salario_familia_teto,
          fgts_aliquota: t.fgts_aliquota,
          fonte: t.fonte ?? null,
        },
      }),
    onSuccess: () => {
      toast.success("Tabela da folha salva.");
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["rh-tabelas-fiscais"] });
      qc.invalidateQueries({ queryKey: ["rh-tabela-fiscal"] });
      qc.invalidateQueries({ queryKey: ["rh-previa-folha"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar.")),
  });

  function novaAPartirDe(t: TabelaFiscal) {
    const d = new Date();
    const prox = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    setEdit({
      ...t,
      id: undefined,
      correspondente_id: "nova",
      vigencia_desde: `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, "0")}-01`,
      fonte: "",
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
        A folha usa a vigência mais recente até a competência. As padrão do sistema são atualizadas pela
        Agilliza; quando a lei mudar antes, crie uma vigência própria a partir da atual.
      </div>
      {!q.data || q.data.length === 0 ? (
        <EstadoLista q={q} vazio="Nenhuma tabela cadastrada." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {q.data.map((t) => (
            <Card key={t.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Landmark className="h-4 w-4 text-primary" /> Desde {mesAno(t.vigencia_desde)}
                  </CardTitle>
                  <p className="truncate text-xs text-muted-foreground">{t.fonte ?? "—"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge variant="outline" className={t.correspondente_id ? "border-primary/40 text-primary" : ""}>
                    {t.correspondente_id ? "Da empresa" : "Padrão"}
                  </Badge>
                  {podeEditar && (
                    <Button size="icon" variant="ghost" aria-label="Nova vigência a partir desta" onClick={() => novaAPartirDe(t)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                  {podeEditar && t.correspondente_id && (
                    <>
                      <Button size="icon" variant="ghost" aria-label="Editar vigência" onClick={() => setEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ConfirmDelete
                        titulo="Excluir esta vigência?"
                        descricao="As competências seguintes voltam a usar a tabela anterior. Folhas fechadas não mudam."
                        onConfirm={async () => {
                          await fnExcluir({ data: { id: t.id! } });
                          qc.invalidateQueries({ queryKey: ["rh-tabelas-fiscais"] });
                        }}
                        trigger={
                          <Button size="icon" variant="ghost" aria-label="Excluir vigência">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        }
                      />
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">INSS</p>
                  <ul className="space-y-0.5 tabular-nums">
                    {t.inss_faixas.map((f) => (
                      <li key={f.ate} className="flex justify-between gap-2">
                        <span>até {formatBRL(f.ate)}</span>
                        <span>{pct(f.aliquota)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">IRRF</p>
                  <ul className="space-y-0.5 tabular-nums">
                    {t.irrf_faixas.map((f, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span>{f.ate == null ? "acima" : `até ${formatBRL(f.ate)}`}</span>
                        <span>
                          {pct(f.aliquota)} · −{formatBRL(f.deducao)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Mínimo {formatBRL(t.salario_minimo)} · dependente IR {formatBRL(t.irrf_dependente)} · simplificado{" "}
                  {formatBRL(t.irrf_desconto_simplificado)} · salário-família {formatBRL(t.salario_familia_quota)} até{" "}
                  {formatBRL(t.salario_familia_teto)} · FGTS {pct(t.fgts_aliquota)}
                  {t.irrf_reducao ? ` · redução IR: isenção até ${formatBRL(t.irrf_reducao.isencao_ate)}` : ""}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {edit && <EditorTabela inicial={edit} salvando={salvar.isPending} onCancelar={() => setEdit(null)} onSalvar={(t) => salvar.mutate(t)} />}
    </div>
  );
}

function EditorTabela({
  inicial,
  salvando,
  onCancelar,
  onSalvar,
}: {
  inicial: TabelaFiscal;
  salvando: boolean;
  onCancelar: () => void;
  onSalvar: (t: TabelaFiscal) => void;
}) {
  const [vig, setVig] = useState(inicial.vigencia_desde.slice(0, 7));
  const [inss, setInss] = useState(inicial.inss_faixas.map((f) => ({ ate: txt(f.ate), aliquota: txt(f.aliquota * 100) })));
  const [irrf, setIrrf] = useState(
    inicial.irrf_faixas.map((f) => ({ ate: txt(f.ate), aliquota: txt(f.aliquota * 100), deducao: txt(f.deducao) })),
  );
  const [g, setG] = useState({
    salario_minimo: txt(inicial.salario_minimo),
    irrf_dependente: txt(inicial.irrf_dependente),
    irrf_desconto_simplificado: txt(inicial.irrf_desconto_simplificado),
    salario_familia_quota: txt(inicial.salario_familia_quota),
    salario_familia_teto: txt(inicial.salario_familia_teto),
    fgts: txt(inicial.fgts_aliquota * 100),
    fonte: inicial.fonte ?? "",
  });

  function salvar() {
    onSalvar({
      ...inicial,
      vigencia_desde: `${vig}-01`,
      salario_minimo: num(g.salario_minimo),
      inss_faixas: inss.map((f) => ({ ate: num(f.ate), aliquota: num(f.aliquota) / 100 })),
      irrf_faixas: irrf.map((f, i) => ({
        ate: i === irrf.length - 1 ? null : num(f.ate),
        aliquota: num(f.aliquota) / 100,
        deducao: num(f.deducao),
      })),
      irrf_dependente: num(g.irrf_dependente),
      irrf_desconto_simplificado: num(g.irrf_desconto_simplificado),
      salario_familia_quota: num(g.salario_familia_quota),
      salario_familia_teto: num(g.salario_familia_teto),
      fgts_aliquota: num(g.fgts) / 100,
      fonte: g.fonte || null,
    });
  }

  const campo = (rot: string, k: keyof typeof g) => (
    <div className="space-y-1">
      <Label className="text-xs">{rot}</Label>
      <Input inputMode="decimal" value={g[k]} onChange={(e) => setG((p) => ({ ...p, [k]: e.target.value }))} />
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onCancelar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{inicial.id ? "Editar vigência da empresa" : "Nova vigência da empresa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Vale a partir de</Label>
              <Input type="month" value={vig} onChange={(e) => setVig(e.target.value)} />
            </div>
            {campo("Salário mínimo (R$)", "salario_minimo")}
            {campo("FGTS (%)", "fgts")}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">INSS (faixas progressivas)</p>
            <div className="space-y-2">
              {inss.map((f, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input aria-label="Até (R$)" placeholder="Até (R$)" inputMode="decimal" value={f.ate} onChange={(e) => setInss((l) => l.map((x, j) => (j === i ? { ...x, ate: e.target.value } : x)))} />
                  <Input aria-label="Alíquota (%)" placeholder="Alíquota (%)" inputMode="decimal" value={f.aliquota} onChange={(e) => setInss((l) => l.map((x, j) => (j === i ? { ...x, aliquota: e.target.value } : x)))} />
                  <Button size="icon" variant="ghost" aria-label="Tirar faixa" disabled={inss.length <= 1} onClick={() => setInss((l) => l.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setInss((l) => [...l, { ate: "", aliquota: "" }])}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Faixa
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">IRRF (a última faixa não tem limite)</p>
            <div className="space-y-2">
              {irrf.map((f, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                  <Input
                    aria-label="Até (R$)"
                    placeholder={i === irrf.length - 1 ? "acima" : "Até (R$)"}
                    disabled={i === irrf.length - 1}
                    inputMode="decimal"
                    value={i === irrf.length - 1 ? "" : f.ate}
                    onChange={(e) => setIrrf((l) => l.map((x, j) => (j === i ? { ...x, ate: e.target.value } : x)))}
                  />
                  <Input aria-label="Alíquota (%)" placeholder="Alíquota (%)" inputMode="decimal" value={f.aliquota} onChange={(e) => setIrrf((l) => l.map((x, j) => (j === i ? { ...x, aliquota: e.target.value } : x)))} />
                  <Input aria-label="Dedução (R$)" placeholder="Dedução (R$)" inputMode="decimal" value={f.deducao} onChange={(e) => setIrrf((l) => l.map((x, j) => (j === i ? { ...x, deducao: e.target.value } : x)))} />
                  <Button size="icon" variant="ghost" aria-label="Tirar faixa" disabled={irrf.length <= 1} onClick={() => setIrrf((l) => l.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setIrrf((l) => [...l.slice(0, -1), { ate: "", aliquota: "", deducao: "" }, l[l.length - 1]])}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Faixa
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {campo("Dedução por dependente IR (R$)", "irrf_dependente")}
            {campo("Desconto simplificado (R$)", "irrf_desconto_simplificado")}
            {campo("Cota do salário-família (R$)", "salario_familia_quota")}
            {campo("Teto do salário-família (R$)", "salario_familia_teto")}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fonte (portaria, lei)</Label>
            <Input maxLength={500} value={g.fonte} onChange={(e) => setG((p) => ({ ...p, fonte: e.target.value }))} />
          </div>
          {inicial.irrf_reducao && (
            <p className="text-xs text-muted-foreground">
              A redução do IRRF (Lei 15.270/2025) da vigência copiada é mantida.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || !/^\d{4}-\d{2}$/.test(vig)}>
            Salvar vigência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
