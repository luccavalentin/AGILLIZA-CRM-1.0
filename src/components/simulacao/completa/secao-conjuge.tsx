import { ArrowLeftRight, AlertTriangle } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PRAZO_MAX, prazoMaximoParaProponentes } from "@/lib/simulacao/prazo";
import { formatBRL } from "@/lib/simulacao/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/simulacao/currency-input";
import { Campo, Ast, Erro } from "@/components/simulacao/completa/campo";
import { DateInput } from "@/components/shared/date-input";
import { maskCpfCnpj, maskCelular } from "@/lib/simulacao/format";
import { ESTADOS_CIVIS } from "@/lib/simulacao/schemas";
import { REGIMES } from "@/components/crm/cliente-form/constants";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { SimulacaoCompletaCtx } from "@/lib/simulacao/use-simulacao-completa";

export function SecaoConjuge({ ctx }: { ctx: SimulacaoCompletaCtx }) {
  const {
    f,
    set,
    erros,
    podeInverter,
    inverterPrincipal,
  } = ctx;
  const [confirmacaoReducao, setConfirmacaoReducao] = useState<{
    callback: () => void;
    prazoAntigo: number;
    prazoNovo: number;
    participanteNome: string;
    participanteIdade: number;
    rendaAntiga: number;
    rendaNova: number;
  } | null>(null);

  const handleToggleComposicao = (checked: boolean) => {
    if (!checked) {
      set("compoe_renda_conjuge", false);
      set("compoe_renda", false);
      return;
    }

    if (f.data_nascimento_conjuge) {
      const proponentesAtuais = [
        { nome: f.nome_cliente || "Titular", vinculo: "Titular", dataNascimento: f.data_nascimento },
        { nome: f.nome_conjuge || "Cônjuge", vinculo: "cônjuge", dataNascimento: f.data_nascimento_conjuge },
        ...(f.participantes || []).filter((p: any) => p.compoe_renda).map((p: any) => ({
          nome: p.nome,
          vinculo: p.vinculo,
          dataNascimento: p.data_nascimento
        }))
      ];

      const resNovo = prazoMaximoParaProponentes(proponentesAtuais);
      const prazoNovo = resNovo?.prazo ?? PRAZO_MAX;
      const prazoAtual = ctx.maxPrazoIdade ?? PRAZO_MAX;

      if (prazoNovo < prazoAtual) {
        const nascimentoDate = new Date(f.data_nascimento_conjuge);
        const hoje = new Date();
        const idade = isNaN(nascimentoDate.getTime()) ? 0 : hoje.getFullYear() - nascimentoDate.getFullYear();

        setConfirmacaoReducao({
          callback: () => {
            set("compoe_renda_conjuge", true);
            set("compoe_renda", true);
          },
          prazoAntigo: prazoAtual,
          prazoNovo: prazoNovo,
          participanteNome: f.nome_conjuge || "Cônjuge",
          participanteIdade: idade,
          rendaAntiga: ctx.rendaConsiderada,
          rendaNova: ctx.rendaConsiderada + (f.renda_conjuge || 0)
        });
        return;
      }
    }

    set("compoe_renda_conjuge", true);
    set("compoe_renda", true);
  };

  const handleUpdateNascimento = (data: string) => {
    if (!f.compoe_renda_conjuge || !data) {
      set("data_nascimento_conjuge", data);
      return;
    }

    const proponentesAtuais = [
      { nome: f.nome_cliente || "Titular", vinculo: "Titular", dataNascimento: f.data_nascimento },
      { nome: f.nome_conjuge || "Cônjuge", vinculo: "cônjuge", dataNascimento: data },
      ...(f.participantes || []).filter((p: any) => p.compoe_renda).map((p: any) => ({
        nome: p.nome,
        vinculo: p.vinculo,
        dataNascimento: p.data_nascimento
      }))
    ];

    const resNovo = prazoMaximoParaProponentes(proponentesAtuais);
    const prazoNovo = resNovo?.prazo ?? PRAZO_MAX;
    const prazoAtual = ctx.maxPrazoIdade ?? PRAZO_MAX;

    if (prazoNovo < prazoAtual) {
      const nascimentoDate = new Date(data);
      const hoje = new Date();
      const idade = isNaN(nascimentoDate.getTime()) ? 0 : hoje.getFullYear() - nascimentoDate.getFullYear();

      setConfirmacaoReducao({
        callback: () => set("data_nascimento_conjuge", data),
        prazoAntigo: prazoAtual,
        prazoNovo: prazoNovo,
        participanteNome: f.nome_conjuge || "Cônjuge",
        participanteIdade: idade,
        rendaAntiga: ctx.rendaConsiderada,
        rendaNova: ctx.rendaConsiderada
      });
      return;
    }

    set("data_nascimento_conjuge", data);
  };

  const casado = f.estado_civil === "CA" || f.estado_civil === "UE";

  return (
    <>
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Switch
            id="compoe-renda-conjuge"
            checked={casado && Boolean(f.compoe_renda_conjuge)}
            disabled={!casado}
            onCheckedChange={handleToggleComposicao}
          />
          <Label htmlFor="compoe-renda-conjuge" className="text-sm font-medium cursor-pointer">
            Compor renda com este cônjuge
          </Label>
          {!casado && (
            <span className="text-[11px] text-muted-foreground">
              Disponível apenas para casado(a) ou união estável.
            </span>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!podeInverter}
            onClick={inverterPrincipal}
          >
            <ArrowLeftRight className="h-4 w-4" />
            Inverter principal (Testar CPF)
          </Button>
          {!podeInverter && (
            <p className="text-[10px] text-muted-foreground">
              Nome, CPF e Nascimento do cônjuge são obrigatórios para inverter.
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Campo label="Nome">
          <Input
            value={f.nome_conjuge ?? ""}
            onChange={(e) => set("nome_conjuge", e.target.value)}
          />
        </Campo>
        <Campo label="CPF/CNPJ">
          <Input
            value={f.cpf_conjuge ?? ""}
            onChange={(e) => set("cpf_conjuge", maskCpfCnpj(e.target.value))}
          />
        </Campo>
        {f.compoe_renda_conjuge && (
          <Campo label="Renda do Cônjuge (R$)">
            <CurrencyInput value={f.renda_conjuge ?? 0} onChange={(v) => set("renda_conjuge", v)} />
          </Campo>
        )}

        <Campo label="Data de nascimento">
          <DateInput
            value={f.data_nascimento_conjuge ?? ""}
            onChange={handleUpdateNascimento}
          />
        </Campo>
        <Campo label={f.compoe_renda_conjuge ? <>Sexo <Ast /></> : "Sexo"}>
          <Select
            value={f.sexo_conjuge ?? ""}
            onValueChange={(v) => set("sexo_conjuge", v as any)}
          >
            <SelectTrigger aria-invalid={!!erros.sexo_conjuge}>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="M">Masculino</SelectItem>
              <SelectItem value="F">Feminino</SelectItem>
            </SelectContent>
          </Select>
          <Erro erros={erros} campo="sexo_conjuge" />
        </Campo>
        <Campo label="Estado civil">
          <Select
            value={f.estado_civil_conjuge ?? ""}
            onValueChange={(v) => set("estado_civil_conjuge", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS_CIVIS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        {/* Regime de casamento vive aqui para não obrigar uma volta ao CRM
            só para completar o cadastro no meio de uma simulação. */}
        <Campo label="Regime de casamento">
          <Select
            value={f.regime_casamento ?? ""}
            onValueChange={(v) => set("regime_casamento", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {REGIMES.map((r) => (
                <SelectItem key={r.v} value={r.v}>
                  {r.l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo label="E-mail">
          <Input
            type="email"
            value={f.email_conjuge ?? ""}
            onChange={(e) => set("email_conjuge", e.target.value)}
          />
        </Campo>
        <Campo label="Celular">
          <Input
            value={f.celular_conjuge ?? ""}
            onChange={(e) => set("celular_conjuge", maskCelular(e.target.value))}
          />
        </Campo>
      </div>
    </section>

      <AlertDialog open={!!confirmacaoReducao} onOpenChange={(open) => !open && setConfirmacaoReducao(null)}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Redução do Prazo Máximo
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p className="text-foreground">
                Adicionar <strong>{confirmacaoReducao?.participanteNome}</strong> ({confirmacaoReducao?.participanteIdade} anos) 
                reduz o prazo máximo de <strong>{confirmacaoReducao?.prazoAntigo}</strong> para <strong>{confirmacaoReducao?.prazoNovo} meses</strong>, 
                porque a regra de idade usa o proponente mais velho.
              </p>
              <div className="rounded-lg bg-muted p-3 text-xs space-y-1">
                <p>Renda considerada: <span className="line-through opacity-50">{formatBRL(confirmacaoReducao?.rendaAntiga || 0)}</span> → <span className="font-bold text-primary">{formatBRL(confirmacaoReducao?.rendaNova || 0)}</span></p>
                <p>Prazo máximo: <span className="line-through opacity-50">{confirmacaoReducao?.prazoAntigo}</span> → <span className="font-bold text-amber-600">{confirmacaoReducao?.prazoNovo} meses</span></p>
              </div>
              <p className="text-[11px] text-muted-foreground italic">
                Deseja continuar com a inclusão deste participante?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-primary hover:bg-primary/90"
              onClick={() => {
                confirmacaoReducao?.callback();
                setConfirmacaoReducao(null);
              }}
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
