import { Link2, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/simulacao/currency-input";
import { ClienteCRMPicker } from "@/components/simulacao/cliente-crm-picker";
import { DateInput } from "@/components/shared/date-input";
import { DicaRendaMinima } from "@/components/simulacao/dica-renda-minima";

import { Campo, Ast, Erro } from "@/components/simulacao/completa/campo";
import { maskCpfCnpj, maskCelular } from "@/lib/simulacao/format";
import { ESTADOS_CIVIS } from "@/lib/simulacao/schemas";
import type { SimulacaoCompletaCtx } from "@/lib/simulacao/use-simulacao-completa";

export function SecaoTitular({ ctx }: { ctx: SimulacaoCompletaCtx }) {
  const {
    f,
    set,
    erros,
    cadastroNome,
    invertido,
    crmVinculado,
    podePuxarConjugeCrm,
    puxarConjugeDoCRM,
    selecionarClienteCRM,
    limparTitular,
  } = ctx;

  return (
    <section className="space-y-4">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Vincular Cliente do CRM</label>
          <ClienteCRMPicker
            selecionado={f.cliente_id ? f.nome_cliente : null}
            onSelect={selecionarClienteCRM}
          />
        </div>
        {f.cliente_id && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={limparTitular}
          >
            Limpar
          </Button>
        )}
      </div>
      {(cadastroNome || invertido) && (
        <div className="flex flex-wrap items-center gap-2 pb-1">
          {cadastroNome && (
            <Badge variant="secondary" className="h-7 gap-1 px-3 font-medium shadow-sm transition-all hover:bg-secondary/80">
              <Link2 className="h-3.5 w-3.5" />
              Vinculado: {cadastroNome}
            </Badge>
          )}
          {invertido && (
            <Badge variant="outline" className="h-7 gap-1 border-primary/40 bg-primary/5 px-3 font-semibold text-primary shadow-sm">
              <Repeat className="h-3.5 w-3.5" />
              CPFs Invertidos
            </Badge>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Campo label={<>Nome <Ast /></>}>
          <Input
            value={f.nome_cliente}
            onChange={(e) => set("nome_cliente", e.target.value)}
            aria-invalid={!!erros.nome_cliente}
          />
          <Erro erros={erros} campo="nome_cliente" />
        </Campo>
        <Campo label={<>CPF/CNPJ <Ast /></>}>
          <Input
            value={f.cpf_cnpj}
            onChange={(e) => set("cpf_cnpj", maskCpfCnpj(e.target.value))}
            placeholder="Apenas números"
            aria-invalid={!!erros.cpf_cnpj}
          />
          <Erro erros={erros} campo="cpf_cnpj" />
        </Campo>
        <Campo label={<>{f.sistema_amortizacao === "B" ? "Renda familiar — SAC (R$)" : "Renda total (R$)"} <Ast /></>}>
          <CurrencyInput
            value={f.renda_total}
            onChange={(v) => set("renda_total", v)}
            placeholder="Ex: 9.500,00"
          />
          <Erro erros={erros} campo="renda_total" />
          {f.valor_financiamento > 0 && (f.sistema_amortizacao === "S" || f.sistema_amortizacao === "B") && (
            <div className="pt-1">
              <DicaRendaMinima
                valorFinanciamento={f.valor_financiamento}
                valorImovel={f.valor_imovel}
                prazoMeses={f.prazo}
                taxaAno={ctx.melhorTaxaAno}
                sistema="S"
                rendaInformada={ctx.rendaConsiderada}
                compoeRendaConjuge={f.compoe_renda && f.compoe_renda_conjuge}
              />
            </div>
          )}

          {f.valor_financiamento > 0 && f.sistema_amortizacao === "P" && (
            <div className="pt-1">
              <DicaRendaMinima
                valorFinanciamento={f.valor_financiamento}
                valorImovel={f.valor_imovel}
                prazoMeses={f.prazo}
                taxaAno={ctx.melhorTaxaAno}
                sistema="P"
                rendaInformada={ctx.rendaConsiderada}
                compoeRendaConjuge={f.compoe_renda && f.compoe_renda_conjuge}
              />
            </div>
          )}

        </Campo>
        {f.sistema_amortizacao === "B" && (
          <Campo label={<>Renda familiar — PRICE (R$) <Ast /></>}>
            <div id="campo-renda-price">
              <CurrencyInput
                value={f.renda_price ?? 0}
                onChange={(v) => set("renda_price", v)}
                placeholder="Ex: 12.000,00"
                aria-invalid={!!erros.renda_price}
              />
            </div>
            <Erro erros={erros} campo="renda_price" />
            {f.valor_financiamento > 0 && (
              <div className="pt-1">
                <DicaRendaMinima
                  valorFinanciamento={f.valor_financiamento}
                  valorImovel={f.valor_imovel}
                  prazoMeses={f.prazo}
                  taxaAno={ctx.melhorTaxaAno}
                  sistema="P"
                  rendaInformada={f.renda_price}
                />
              </div>
            )}
          </Campo>
        )}
        <Campo label={<>Data de nascimento <Ast /></>}>
          <DateInput
            value={f.data_nascimento}
            onChange={(v) => set("data_nascimento", v)}
            aria-invalid={!!erros.data_nascimento}
          />
          <Erro erros={erros} campo="data_nascimento" />
        </Campo>
        <Campo label={<>Estado civil <Ast /></>}>
          <Select value={f.estado_civil} onValueChange={(v) => set("estado_civil", v)}>
            <SelectTrigger aria-invalid={!!erros.estado_civil}>
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
          <Erro erros={erros} campo="estado_civil" />
        </Campo>
        <Campo label={<>E-mail <Ast /></>}>
          <Input
            type="email"
            value={f.email}
            onChange={(e) => set("email", e.target.value)}
            readOnly={!!f.email_verificado_em}
            aria-invalid={!!erros.email}
          />
          <Erro erros={erros} campo="email" />
        </Campo>
        <Campo label={<>Celular <Ast /></>}>
          <Input
            value={f.celular}
            onChange={(e) => set("celular", maskCelular(e.target.value))}
            placeholder="(11) 99999-9999"
            aria-invalid={!!erros.celular}
          />
          <Erro erros={erros} campo="celular" />
        </Campo>
      </div>
      {podePuxarConjugeCrm && (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            O cadastro do CRM
            {crmVinculado?.conjuge_nome ? ` de ${crmVinculado.conjuge_nome}` : ""} tem um cônjuge
            registrado. Deseja puxar esses dados para esta simulação?
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            onClick={puxarConjugeDoCRM}
          >
            <Link2 className="h-4 w-4" />
            Puxar cônjuge do CRM
          </Button>
        </div>
      )}
    </section>
  );
}
