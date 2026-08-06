/**
 * Construtor de holerite CLT: o usuário seleciona o funcionário e vai
 * marcando eventos (horas extras, faltas, VT, VR, plano de saúde…) enquanto
 * o recibo é calculado ao vivo. Ao confirmar, gera o PDF com a identidade
 * Agilliza, envia ao Storage e registra o holerite do funcionário.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Calculator, FileDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FuncionarioPicker } from "@/components/rh/funcionario-picker";
import { YearPicker } from "@/components/rh/year-picker";
import { obterFuncionario } from "@/lib/rh/funcionarios.functions";
import { anexarHolerite } from "@/lib/rh/submodulos.functions";
import { gerarHoleritePdf } from "@/lib/rh/pdf-lazy";
import {
  calcularHolerite,
  ENTRADA_PADRAO,
  type HoleriteEntrada,
} from "@/lib/rh/holerite-calc";
import { formatBRL } from "@/lib/financeiro/format";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function CampoNum({
  label,
  value,
  onChange,
  sufixo,
  passo = "0.01",
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  sufixo?: string;
  passo?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label}
        {sufixo ? <span className="ml-1 opacity-70">({sufixo})</span> : null}
      </Label>
      <Input
        type="number"
        step={passo}
        min={0}
        placeholder="0"
        value={Number.isFinite(value) && value !== 0 ? value : ""}
        onChange={(ev) => {
          const t = ev.target.value;
          onChange(t === "" ? 0 : Number(t));
        }}
        onFocus={(ev) => ev.currentTarget.select()}
        className="tabular-nums"
      />
    </div>
  );
}

export interface HoleriteEdicao {
  id: string;
  funcionario_id: string;
  mes: number;
  ano: number;
  entrada: Record<string, string | number | boolean> | null;
}

export function HoleriteBuilderDialog({
  trigger,
  funcionarioFixo,
  edicao,
  open: openProp,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  /** Quando informado, o holerite já abre travado neste funcionário (ficha individual). */
  funcionarioFixo?: string;
  /** Quando informado, abre um holerite já gerado para edição e regeração do PDF. */
  edicao?: HoleriteEdicao;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {

  const qc = useQueryClient();
  const hoje = new Date();
  const fnFunc = useServerFn(obterFuncionario);
  const fnAnexar = useServerFn(anexarHolerite);

  const [openInterno, setOpenInterno] = useState(false);
  const open = openProp ?? openInterno;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setOpenInterno(v);
  };
  const editando = !!edicao;
  const [funcionarioId, setFuncionarioId] = useState<string | null>(
    edicao?.funcionario_id ?? funcionarioFixo ?? null,
  );
  const [mes, setMes] = useState(edicao?.mes ?? hoje.getMonth() + 1);
  const [ano, setAno] = useState(edicao?.ano ?? hoje.getFullYear());
  const [e, setE] = useState<HoleriteEntrada>({
    ...ENTRADA_PADRAO,
    ...((edicao?.entrada ?? {}) as Partial<HoleriteEntrada>),
  });

  const set = <K extends keyof HoleriteEntrada>(k: K, v: HoleriteEntrada[K]) =>
    setE((p) => ({ ...p, [k]: v }));

  const qFunc = useQuery({
    queryKey: ["rh-holerite-func", funcionarioId],
    enabled: !!funcionarioId,
    queryFn: async () => {
      const f = await fnFunc({ data: { id: funcionarioId! } });
      // Em edição os valores salvos prevalecem sobre o salário atual da ficha.
      if (f && !(editando && edicao?.entrada)) {
        setE((p) => ({
          ...p,
          salario_base: Number(f.salario_atual ?? 0),
        }));
      }
      return f;
    },
  });

  const calc = useMemo(() => calcularHolerite(e), [e]);
  const func = qFunc.data;

  const gerar = useMutation({
    mutationFn: async () => {
      if (!funcionarioId || !func) throw new Error("Selecione o funcionário.");
      // Campos não preenchidos são tratados como zero: o PDF sempre é gerado.


      const { blob, filename } = await gerarHoleritePdf({
        competencia: { mes, ano },
        funcionario: {
          nome: func.nome,
          numero: func.numero,
          cpf: func.cpf,
          cargo: func.cargo_nome,
          departamento: func.departamento_nome,
        },
        salario_base: e.salario_base,
        detalhamento: {
          inss: calc.inss,
          irrf: calc.irrf,
          base_irrf: calc.base_irrf,
          base_inss: calc.base_inss,
          fgts: calc.fgts,
          dependentes_ir: e.dependentes_ir,
        },
        linhas: { proventos: calc.proventos, descontos: calc.descontos },
        liquido: calc.liquido,
      });

      // O download acontece sempre, mesmo que o anexo à ficha falhe.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      let anexado = false;
      try {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) throw new Error("Sessão expirada.");
        const prof = await supabase
          .from("profiles")
          .select("correspondente_id")
          .eq("id", user.id)
          .maybeSingle();
        const cid = prof.data?.correspondente_id as string | undefined;
        if (!cid) throw new Error("Correspondente não encontrado.");

        const path = `${cid}/holerites/${funcionarioId}/${ano}-${String(mes).padStart(2, "0")}.pdf`;
        const { error } = await supabase.storage
          .from("rh-documentos")
          .upload(path, blob, { contentType: "application/pdf", upsert: true });
        if (error) throw new Error(error.message);

        await fnAnexar({
          data: {
            funcionario_id: funcionarioId,
            mes,
            ano,
            arquivo_path: path,
            arquivo_nome: filename,
            valor_liquido: calc.liquido,
            entrada: e as unknown as Record<string, string | number | boolean>,
          },
        });
        anexado = true;
      } catch (err: any) {
        toast.warning(
          `PDF baixado, mas não foi possível anexar à ficha: ${err?.message ?? "erro desconhecido"}`,
        );
      }
      return { anexado };
    },

    onSuccess: (res) => {
      if (res?.anexado) {
        toast.success(
          editando
            ? "Holerite atualizado, PDF substituído e baixado."
            : "Holerite gerado, anexado à ficha e baixado.",
        );
      } else {
        toast.success("Holerite gerado e baixado.");
      }
      qc.invalidateQueries({ queryKey: ["rh-holerites"] });
      qc.invalidateQueries({ queryKey: ["rh-ficha-hol"] });
      setOpen(false);
    },

    onError: (err: any) => toast.error(err?.message ?? "Falha ao gerar o holerite."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button>
              <Calculator className="mr-2 h-4 w-4" /> Novo holerite
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />{" "}
            {editando ? "Editar holerite (CLT)" : "Montar holerite (CLT)"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Selecione o funcionário e os eventos do mês. O recibo é calculado ao vivo com INSS
            progressivo, IRRF, FGTS, adicionais e limites legais.
          </p>
        </DialogHeader>

        <div className="grid max-h-[70vh] gap-0 md:grid-cols-[1fr_340px]">
          {/* Formulário */}
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-5 p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label className="text-xs text-muted-foreground">Funcionário</Label>
                  {funcionarioFixo || editando ? (
                    <div className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-sm">
                      {func?.nome ?? "Carregando…"}
                    </div>
                  ) : (
                    <FuncionarioPicker value={funcionarioId} onChange={setFuncionarioId} />
                  )}

                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Mês</Label>
                  <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MESES.map((m, i) => (
                        <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Ano</Label>
                  <YearPicker value={ano} onChange={setAno} />
                </div>
              </div>

              {func && (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{func.nome}</span>
                  {func.cargo_nome ? ` · ${func.cargo_nome}` : ""}
                  {func.departamento_nome ? ` · ${func.departamento_nome}` : ""}
                  {" · Admissão "}
                  {new Date(func.data_admissao + "T00:00:00").toLocaleDateString("pt-BR")}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <CampoNum label="Salário base" sufixo="R$" value={e.salario_base} onChange={(v) => set("salario_base", v)} />
                <CampoNum label="Jornada mensal" sufixo="h" passo="1" value={e.jornada_mensal} onChange={(v) => set("jornada_mensal", v)} />
                <CampoNum label="Dias trabalhados" sufixo="/30" passo="1" value={e.dias_trabalhados} onChange={(v) => set("dias_trabalhados", v)} />
              </div>

              <Accordion type="multiple" defaultValue={["extras", "descontos"]} className="w-full">
                <AccordionItem value="extras">
                  <AccordionTrigger className="text-sm">Horas extras, adicionais e variáveis</AccordionTrigger>
                  <AccordionContent className="grid gap-3 sm:grid-cols-3">
                    <CampoNum label="Horas extras 50%" sufixo="h" value={e.horas_extras_50} onChange={(v) => set("horas_extras_50", v)} />
                    <CampoNum label="Horas extras 100%" sufixo="h" value={e.horas_extras_100} onChange={(v) => set("horas_extras_100", v)} />
                    <CampoNum label="Horas noturnas" sufixo="h" value={e.horas_noturnas} onChange={(v) => set("horas_noturnas", v)} />
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Insalubridade</Label>
                      <Select
                        value={String(e.insalubridade_pct)}
                        onValueChange={(v) => set("insalubridade_pct", Number(v))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Não possui</SelectItem>
                          <SelectItem value="10">Grau mínimo (10%)</SelectItem>
                          <SelectItem value="20">Grau médio (20%)</SelectItem>
                          <SelectItem value="40">Grau máximo (40%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 sm:col-span-2">
                      <div>
                        <p className="text-sm text-foreground">Periculosidade (30%)</p>
                        <p className="text-xs text-muted-foreground">Sobre o salário base</p>
                      </div>
                      <Switch checked={e.periculosidade} onCheckedChange={(v) => set("periculosidade", v)} />
                    </div>
                    <CampoNum label="Comissões" sufixo="R$" value={e.comissoes} onChange={(v) => set("comissoes", v)} />
                    <CampoNum label="Bonificação / prêmio" sufixo="R$" value={e.bonificacoes} onChange={(v) => set("bonificacoes", v)} />
                    <CampoNum label="Férias + 1/3" sufixo="R$" value={e.ferias_valor} onChange={(v) => set("ferias_valor", v)} />
                    <CampoNum label="13º salário" sufixo="R$" value={e.decimo_terceiro} onChange={(v) => set("decimo_terceiro", v)} />
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">Descrição de outros proventos</Label>
                      <Input
                        value={e.outros_proventos_desc}
                        onChange={(ev) => set("outros_proventos_desc", ev.target.value)}
                      />
                    </div>
                    <CampoNum label="Outros proventos" sufixo="R$" value={e.outros_proventos} onChange={(v) => set("outros_proventos", v)} />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="faltas">
                  <AccordionTrigger className="text-sm">Faltas e ausências</AccordionTrigger>
                  <AccordionContent className="grid gap-3 sm:grid-cols-3">
                    <CampoNum label="Faltas injustificadas" sufixo="dias" passo="1" value={e.faltas_dias} onChange={(v) => set("faltas_dias", v)} />
                    <CampoNum label="DSR perdidos" sufixo="dias" passo="1" value={e.dsr_perdidos} onChange={(v) => set("dsr_perdidos", v)} />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="descontos">
                  <AccordionTrigger className="text-sm">Benefícios e descontos</AccordionTrigger>
                  <AccordionContent className="grid gap-3 sm:grid-cols-3">
                    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 sm:col-span-2">
                      <div>
                        <p className="text-sm text-foreground">Descontar vale-transporte</p>
                        <p className="text-xs text-muted-foreground">Limitado a 6% do salário base</p>
                      </div>
                      <Switch checked={e.desconta_vt} onCheckedChange={(v) => set("desconta_vt", v)} />
                    </div>
                    <CampoNum label="Custo das passagens" sufixo="R$" value={e.vt_valor_passagens} onChange={(v) => set("vt_valor_passagens", v)} />

                    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 sm:col-span-2">
                      <div>
                        <p className="text-sm text-foreground">Descontar vale-refeição</p>
                        <p className="text-xs text-muted-foreground">Coparticipação do empregado</p>
                      </div>
                      <Switch checked={e.desconta_vr} onCheckedChange={(v) => set("desconta_vr", v)} />
                    </div>
                    <CampoNum label="Desconto VR" sufixo="R$" value={e.vr_desconto} onChange={(v) => set("vr_desconto", v)} />

                    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 sm:col-span-2">
                      <div>
                        <p className="text-sm text-foreground">Descontar vale-alimentação</p>
                        <p className="text-xs text-muted-foreground">Coparticipação do empregado</p>
                      </div>
                      <Switch checked={e.desconta_va} onCheckedChange={(v) => set("desconta_va", v)} />
                    </div>
                    <CampoNum label="Desconto VA" sufixo="R$" value={e.va_desconto} onChange={(v) => set("va_desconto", v)} />

                    <CampoNum label="Plano de saúde" sufixo="R$" value={e.plano_saude} onChange={(v) => set("plano_saude", v)} />
                    <CampoNum label="Plano odontológico" sufixo="R$" value={e.plano_odonto} onChange={(v) => set("plano_odonto", v)} />
                    <CampoNum label="Adiantamento salarial" sufixo="R$" value={e.adiantamento} onChange={(v) => set("adiantamento", v)} />
                    <CampoNum label="Empréstimo consignado" sufixo="R$" value={e.emprestimo_consignado} onChange={(v) => set("emprestimo_consignado", v)} />
                    <CampoNum label="Contribuição sindical" sufixo="R$" value={e.contribuicao_sindical} onChange={(v) => set("contribuicao_sindical", v)} />
                    <CampoNum label="Pensão alimentícia" sufixo="R$" value={e.pensao_alimenticia} onChange={(v) => set("pensao_alimenticia", v)} />
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">Descrição de outros descontos</Label>
                      <Input
                        value={e.outros_descontos_desc}
                        onChange={(ev) => set("outros_descontos_desc", ev.target.value)}
                      />
                    </div>
                    <CampoNum label="Outros descontos" sufixo="R$" value={e.outros_descontos} onChange={(v) => set("outros_descontos", v)} />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="familia">
                  <AccordionTrigger className="text-sm">Dependentes e salário-família</AccordionTrigger>
                  <AccordionContent className="grid gap-3 sm:grid-cols-3">
                    <CampoNum label="Dependentes IRRF" passo="1" value={e.dependentes_ir} onChange={(v) => set("dependentes_ir", v)} />
                    <CampoNum label="Filhos p/ salário-família" passo="1" value={e.filhos_salario_familia} onChange={(v) => set("filhos_salario_familia", v)} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </ScrollArea>

          {/* Prévia ao vivo */}
          <div className="border-t border-border bg-muted/30 md:border-l md:border-t-0">
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-3 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Prévia do recibo
                </p>

                <div className="space-y-1">
                  {calc.proventos.map((l) => (
                    <div key={l.codigo} className="flex justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate text-muted-foreground">{l.descricao}</span>
                      <span className="tabular-nums text-foreground">{formatBRL(l.valor)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-border pt-1 text-xs font-medium">
                    <span>Total de proventos</span>
                    <span className="tabular-nums">{formatBRL(calc.total_proventos)}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-1">
                  {calc.descontos.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sem descontos lançados.</p>
                  )}
                  {calc.descontos.map((l) => (
                    <div key={l.codigo} className="flex justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate text-muted-foreground">{l.descricao}</span>
                      <span className="tabular-nums text-destructive">−{formatBRL(l.valor)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-border pt-1 text-xs font-medium">
                    <span>Total de descontos</span>
                    <span className="tabular-nums">{formatBRL(calc.total_descontos)}</span>
                  </div>
                </div>

                <div className="rounded-lg bg-primary px-3 py-3 text-primary-foreground">
                  <p className="text-[10px] uppercase tracking-wide opacity-80">Líquido a receber</p>
                  <p className="text-xl font-semibold tabular-nums">{formatBRL(calc.liquido)}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <div>Base INSS<br /><span className="tabular-nums text-foreground">{formatBRL(calc.base_inss)}</span></div>
                  <div>Base IRRF<br /><span className="tabular-nums text-foreground">{formatBRL(calc.base_irrf)}</span></div>
                  <div>FGTS do mês<br /><span className="tabular-nums text-foreground">{formatBRL(calc.fgts)}</span></div>
                  <div>Valor hora<br /><span className="tabular-nums text-foreground">{formatBRL(calc.valor_hora)}</span></div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-3">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => gerar.mutate()} disabled={gerar.isPending || !funcionarioId}>
            {gerar.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            {editando ? "Salvar e gerar PDF" : "Gerar holerite em PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
