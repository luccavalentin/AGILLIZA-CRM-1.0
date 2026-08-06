import { ArrowLeftRight, Check } from "lucide-react";
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
import { Campo } from "@/components/simulacao/completa/campo";
import { DateInput } from "@/components/shared/date-input";
import { maskCpfCnpj, maskCelular } from "@/lib/simulacao/format";
import { ESTADOS_CIVIS } from "@/lib/simulacao/schemas";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { SimulacaoCompletaCtx } from "@/lib/simulacao/use-simulacao-completa";

export function SecaoConjuge({ ctx }: { ctx: SimulacaoCompletaCtx }) {
  const { f, set, podeInverter, inverterPrincipal } = ctx;

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Switch
            id="compoe-renda-conjuge"
            checked={f.compoe_renda_conjuge}
            onCheckedChange={(checked) => set("compoe_renda_conjuge", checked)}
          />
          <Label
            htmlFor="compoe-renda-conjuge"
            className="text-sm font-medium cursor-pointer"
          >
            Compor renda com este cônjuge
          </Label>
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
            <CurrencyInput
              value={f.renda_conjuge ?? 0}
              onChange={(v) => set("renda_conjuge", v)}
            />
          </Campo>
        )}

        <Campo label="Data de nascimento">
          <DateInput
            value={f.data_nascimento_conjuge ?? ""}
            onChange={(v) => set("data_nascimento_conjuge", v)}
          />
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
  );
}
