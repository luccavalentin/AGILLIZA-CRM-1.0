import { ArrowLeftRight } from "lucide-react";
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
import { maskCpfCnpj, maskCelular } from "@/lib/simulacao/format";
import { ESTADOS_CIVIS } from "@/lib/simulacao/schemas";
import type { SimulacaoCompletaCtx } from "@/lib/simulacao/use-simulacao-completa";

export function SecaoConjuge({ ctx }: { ctx: SimulacaoCompletaCtx }) {
  const { f, set, podeInverter, inverterPrincipal } = ctx;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-foreground">Cônjuge / coobrigado</h2>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!podeInverter}
            onClick={inverterPrincipal}
          >
            <ArrowLeftRight className="h-4 w-4" />
            Inverter principal
          </Button>
          {!podeInverter && (
            <p className="text-xs text-muted-foreground">
              Preencha nome, CPF e data de nascimento do cônjuge para inverter.
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
        <Campo label="Renda (R$)">
          <CurrencyInput
            value={f.renda_conjuge ?? 0}
            onChange={(v) => set("renda_conjuge", v)}
          />
        </Campo>
        <Campo label="Data de nascimento">
          <Input
            type="date"
            value={f.data_nascimento_conjuge ?? ""}
            onChange={(e) => set("data_nascimento_conjuge", e.target.value)}
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
