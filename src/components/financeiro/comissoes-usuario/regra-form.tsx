import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { GRUPOS_GATILHOS_COMISSAO } from "@/lib/financeiro/comissoes-gatilhos";
import {
  TIPOS_VINCULO_COMISSAO,
  listarBancosComissao,
  listarUsuariosComissionaveis,
  salvarRegraComissaoUsuario,
  type RegraComissaoUsuario,
  type TipoVinculoComissao,
} from "@/lib/financeiro/comissoes-usuario.functions";

const TIPOS_VINCULO_VALIDOS = new Set(TIPOS_VINCULO_COMISSAO.map((t) => t.valor));

/** Papel (role) → tipo de vínculo de comissão. */
const PAPEL_PARA_VINCULO: Record<string, TipoVinculoComissao> = {
  corretor: "corretor",
  imobiliaria: "imobiliaria",
  analista: "analista",
  comercial: "comercial_agilliza",
  comercial_agilliza: "comercial_agilliza",
  parceiro: "parceiro",
};

function inferirTipoVinculo(
  tipoPessoa: string | null | undefined,
  papeis: string[] = [],
): TipoVinculoComissao {
  for (const p of papeis) {
    const v = PAPEL_PARA_VINCULO[(p ?? "").toLowerCase()];
    if (v) return v;
  }
  const slug = (tipoPessoa ?? "").toLowerCase();
  if (TIPOS_VINCULO_VALIDOS.has(slug as TipoVinculoComissao)) {
    return slug as TipoVinculoComissao;
  }
  return "outro";
}



interface Props {
  aberto: boolean;
  onFechar: () => void;
  tipoInicial: TipoVinculoComissao;
  regra?: RegraComissaoUsuario | null;
}

export function RegraComissaoUsuarioForm({ aberto, onFechar, tipoInicial, regra }: Props) {
  const qc = useQueryClient();
  const [usuarioId, setUsuarioId] = useState("");
  const [usuarioOpen, setUsuarioOpen] = useState(false);
  const [tipoVinculo, setTipoVinculo] = useState<TipoVinculoComissao>(tipoInicial);
  const [gatilho, setGatilho] = useState<string>("contrato_emitido");
  const [baseCalculo, setBaseCalculo] = useState<"valor_contrato" | "percentual_repasse">(
    "valor_contrato",
  );
  const [percentual, setPercentual] = useState<string>("");
  const [bancoNome, setBancoNome] = useState<string>("__todos__");
  const [produto, setProduto] = useState<string>("__todos__");
  const [vigIni, setVigIni] = useState<string>("");
  const [vigFim, setVigFim] = useState<string>("");
  const [ativo, setAtivo] = useState<boolean>(true);
  const [observacao, setObservacao] = useState<string>("");

  useEffect(() => {
    if (!aberto) return;
    if (regra) {
      setUsuarioId(regra.usuario_id);
      setTipoVinculo(regra.tipo_vinculo);
      setGatilho(regra.gatilho);
      setBaseCalculo(regra.base_calculo);
      setPercentual(String(regra.percentual));
      setBancoNome(regra.banco_nome ?? "__todos__");
      setProduto(regra.produto ?? "__todos__");
      setVigIni(regra.vigencia_inicio ?? "");
      setVigFim(regra.vigencia_fim ?? "");
      setAtivo(regra.ativo);
      setObservacao(regra.observacao ?? "");
    } else {
      setUsuarioId("");
      setTipoVinculo(tipoInicial);
      setGatilho("contrato_emitido");
      setBaseCalculo("valor_contrato");
      setPercentual("");
      setBancoNome("__todos__");
      setProduto("__todos__");
      setVigIni("");
      setVigFim("");
      setAtivo(true);
      setObservacao("");
    }
  }, [aberto, regra, tipoInicial]);

  const { data: usuarios } = useQuery({
    queryKey: ["fin-com-usr-usuarios"],
    queryFn: () => listarUsuariosComissionaveis(),
    enabled: aberto,
  });
  const { data: bancos } = useQuery({
    queryKey: ["fin-com-usr-bancos"],
    queryFn: () => listarBancosComissao(),
    enabled: aberto,
  });
  const usuarioSelecionado = useMemo(
    () => (usuarios ?? []).find((u) => u.id === usuarioId) ?? null,
    [usuarios, usuarioId],
  );

  const salvar = useMutation({
    mutationFn: () =>
      salvarRegraComissaoUsuario({
        data: {
          id: regra?.id,
          usuario_id: usuarioId,
          tipo_vinculo: tipoVinculo,
          gatilho: gatilho as never,
          base_calculo: baseCalculo,
          percentual: Number(percentual.replace(",", ".")) || 0,
          banco_nome: bancoNome === "__todos__" ? null : bancoNome,
          produto: produto === "__todos__" ? null : produto,
          vigencia_inicio: vigIni || null,
          vigencia_fim: vigFim || null,
          ativo,
          observacao: observacao || null,
        },
      }),
    onSuccess: (r: any) => {
      toast.success(
        r?.gerados
          ? `${regra ? "Regra atualizada" : "Regra criada"} — ${r.gerados} lançamento(s) gerado(s) em contas a pagar.`
          : regra
            ? "Regra atualizada."
            : "Regra criada.",
      );
      qc.invalidateQueries({ queryKey: ["fin-com-usr-regras"] });
      qc.invalidateQueries({ queryKey: ["fin-com-usr-resumo"] });
      qc.invalidateQueries({ queryKey: ["fin-com-usr-lanc"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      onFechar();
    },

    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar regra."),
  });

  const podeSalvar = usuarioId && percentual && Number(percentual.replace(",", ".")) >= 0;

  return (
    <Dialog open={aberto} onOpenChange={(o) => (!o ? onFechar() : null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{regra ? "Editar regra" : "Nova regra de comissão"}</DialogTitle>
          <DialogDescription>
            Defina quanto o usuário recebe por contrato. Deixe banco/produto vazios para valer em todos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Usuário</Label>
            <Popover open={usuarioOpen} onOpenChange={setUsuarioOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-full justify-between font-normal",
                    !usuarioSelecionado && "text-muted-foreground",
                  )}
                >
                  <span className="truncate">
                    {usuarioSelecionado
                      ? usuarioSelecionado.nome ?? usuarioSelecionado.email ?? usuarioSelecionado.id
                      : "Selecione ou digite o nome do usuário"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command
                  filter={(value, search) =>
                    value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                  }
                >
                  <CommandInput placeholder="Digite nome, e-mail ou iniciais…" />
                  <CommandList>
                    <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                    <CommandGroup>
                      {(usuarios ?? []).map((u) => {
                        const label = u.nome ?? u.email ?? u.id;
                        return (
                          <CommandItem
                            key={u.id}
                            value={`${label} ${u.email ?? ""}`}
                            onSelect={() => {
                              setUsuarioId(u.id);
                              if (!regra) setTipoVinculo(inferirTipoVinculo(u.tipo_pessoa, u.papeis));
                              setUsuarioOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                usuarioId === u.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{label}</span>
                              {u.email && u.nome && (
                                <span className="text-xs text-muted-foreground">{u.email}</span>
                              )}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de vínculo</Label>
            <Select value={tipoVinculo} onValueChange={(v) => setTipoVinculo(v as TipoVinculoComissao)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_VINCULO_COMISSAO.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>
                    {t.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


          <div className="space-y-1.5">
            <Label>Gatilho</Label>
            <Select value={gatilho} onValueChange={setGatilho}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRUPOS_GATILHOS_COMISSAO.map((grupo) => (
                  <SelectGroup key={grupo.titulo}>
                    <SelectLabel>{grupo.titulo}</SelectLabel>
                    {grupo.itens.map((g) => (
                      <SelectItem key={g.valor} value={g.valor}>
                        {g.rotulo}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label>Base de cálculo</Label>
            <RadioGroup
              value={baseCalculo}
              onValueChange={(v) => setBaseCalculo(v as typeof baseCalculo)}
              className="grid gap-2 sm:grid-cols-2"
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-accent">
                <RadioGroupItem value="valor_contrato" className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">% do valor do contrato</div>
                  <div className="text-xs text-muted-foreground">
                    Calcula sobre o valor financiado da proposta.
                  </div>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-accent">
                <RadioGroupItem value="percentual_repasse" className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">% do repasse</div>
                  <div className="text-xs text-muted-foreground">
                    Calcula sobre o repasse que o correspondente recebeu do banco.
                  </div>
                </div>
              </label>
            </RadioGroup>
            {baseCalculo === "percentual_repasse" && (
              <p className="rounded-md bg-primary/[0.04] px-3 py-2 text-xs text-muted-foreground">
                Exemplo: repasse de R$ 10.000 × 20% = R$ 2.000 para este usuário.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Percentual (%)</Label>
            <Input
              inputMode="decimal"
              placeholder="Ex.: 10"
              value={percentual}
              onChange={(e) => setPercentual(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Banco</Label>
            <Select value={bancoNome} onValueChange={setBancoNome}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos os bancos</SelectItem>
                {(bancos ?? []).map((b) => (
                  <SelectItem key={b} value={b}>
                    <span className="flex items-center gap-2">
                      <BancoLogo nome={b} size="xs" />
                      {b}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Produto</Label>
            <Select value={produto} onValueChange={setProduto}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos os produtos</SelectItem>
                <SelectItem value="financiamento">Financiamento</SelectItem>
                <SelectItem value="home_equity">Home Equity</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Vigência início</Label>
            <Input type="date" value={vigIni} onChange={(e) => setVigIni(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Vigência fim</Label>
            <Input type="date" value={vigFim} onChange={(e) => setVigFim(e.target.value)} />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label>Observação</Label>
            <Textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">Regra ativa</div>
              <div className="text-xs text-muted-foreground">
                Se desligada, deixa de gerar novos lançamentos.
              </div>
            </div>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={!podeSalvar || salvar.isPending}>
            {salvar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
