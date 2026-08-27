import { Info, Link2, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { avaliarRendaMinima } from "@/lib/simulacao/renda";
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
    selecionarClienteCRM,
    limparTitular,
    isPJ,
  } = ctx;

  return (
    <section className="space-y-4">
      {/* Modalidade do proponente. Em PJ só o Bradesco opera, o financiamento
          fica em 70% do valor de compra e venda e o prazo em 180–240 meses. */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/15 bg-primary/[0.04] px-4 py-3">
        <span className="text-sm font-medium text-foreground">Modalidade</span>
        <div className="flex rounded-lg bg-background p-1">
          {[
            { v: "PF", l: "Pessoa física" },
            { v: "PJ", l: "Pessoa jurídica" },
          ].map((o) => (
            <Button
              key={o.v}
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-4 text-xs font-semibold",
                (f.tipo_pessoa ?? "PF") === o.v && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
              )}
              onClick={() => set("tipo_pessoa", o.v)}
            >
              {o.l}
            </Button>
          ))}
        </div>
        {isPJ && (
          <span className="text-[11.5px] text-muted-foreground">
            Bradesco · financiamento até 70% · prazo de 180 a 240 meses
          </span>
        )}
      </div>

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
            Vincular Cliente do CRM
          </label>
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
            <Badge
              variant="secondary"
              className="h-7 gap-1 px-3 font-medium shadow-sm transition-all hover:bg-secondary/80"
            >
              <Link2 className="h-3.5 w-3.5" />
              Vinculado: {cadastroNome}
            </Badge>
          )}
          {invertido && (
            <Badge
              variant="outline"
              className="h-7 gap-1 border-primary/40 bg-primary/5 px-3 font-semibold text-primary shadow-sm"
            >
              <Repeat className="h-3.5 w-3.5" />
              CPFs Invertidos
            </Badge>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Campo
          label={
            <>
              {isPJ ? "Razão social" : "Nome"} <Ast />
            </>
          }
        >
          <Input
            value={f.nome_cliente}
            onChange={(e) => set("nome_cliente", e.target.value)}
            aria-invalid={!!erros.nome_cliente}
          />
          <Erro erros={erros} campo="nome_cliente" />
        </Campo>
        <Campo
          label={
            <>
              {isPJ ? "CNPJ" : "CPF/CNPJ"} <Ast />
            </>
          }
        >
          <Input
            value={f.cpf_cnpj}
            onChange={(e) => set("cpf_cnpj", maskCpfCnpj(e.target.value))}
            placeholder="Apenas números"
            aria-invalid={!!erros.cpf_cnpj}
          />
          <Erro erros={erros} campo="cpf_cnpj" />
        </Campo>

        <Campo
          label={
            <>
              {isPJ ? "Faturamento mensal (R$)" : "Renda familiar — SAC (R$)"} <Ast />
            </>
          }
        >
          <div id="campo-renda-sac" className="flex flex-col gap-2">
            <div className="flex gap-2">
              <CurrencyInput
                value={f.renda_total ?? 0}
                onChange={(v) => {
                  set("renda_total", v);
                }}
                placeholder="Ex: 10.000,00"
                aria-invalid={!!erros.renda_total}
                className="flex-1"
              />
              {f.valor_financiamento > 0 && f.prazo > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
                  title="Preencher renda necessária (Qualificação)"
                  onClick={() => {
                    const aval = avaliarRendaMinima({
                      valor_financiamento: f.valor_financiamento,
                      valor_imovel: f.valor_imovel,
                      prazo_meses: f.prazo,
                      taxa_ano: ctx.melhorTaxaAno,
                      sistema: "S",
                    });
                    if (aval) set("renda_total", aval.rendaMinima);
                  }}
                >
                  <Repeat className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Erro erros={erros} campo="renda_total" />

            {f.valor_financiamento > 0 &&
              (f.sistema_amortizacao === "S" || f.sistema_amortizacao === "B") && (
                <div className="pt-1">
                  <DicaRendaMinima
                    valorFinanciamento={f.valor_financiamento}
                    valorImovel={f.valor_imovel}
                    prazoMeses={f.prazo}
                    taxaAno={ctx.melhorTaxaAno}
                    sistema="S"
                    rendaInformada={0}
                    compoeRendaConjuge={f.compoe_renda && f.compoe_renda_conjuge}
                  />
                </div>
              )}
          </div>
        </Campo>

        {f.sistema_amortizacao === "B" && (
          <Campo
            label={
              <>
                {isPJ ? "Faturamento mensal — PRICE (R$)" : "Renda familiar — PRICE (R$)"} <Ast />
              </>
            }
          >
            <div id="campo-renda-price" className="flex flex-col gap-2">
              <div className="flex gap-2">
                <CurrencyInput
                  value={f.renda_price ?? 0}
                  onChange={(v) => {
                    set("renda_price", v);
                  }}
                  placeholder="Ex: 12.000,00"
                  aria-invalid={!!erros.renda_price}
                  className="flex-1"
                />
                {f.valor_financiamento > 0 && f.prazo > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
                    title="Preencher renda necessária (Qualificação)"
                    onClick={() => {
                      const aval = avaliarRendaMinima({
                        valor_financiamento: f.valor_financiamento,
                        valor_imovel: f.valor_imovel,
                        prazo_meses: f.prazo,
                        taxa_ano: ctx.melhorTaxaAno,
                        sistema: "P",
                      });
                      if (aval) set("renda_price", aval.rendaMinima);
                    }}
                  >
                    <Repeat className="h-4 w-4" />
                  </Button>
                )}
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
                    rendaInformada={0}
                  />
                </div>
              )}
            </div>
          </Campo>
        )}

        <Campo
          label={
            <>
              {isPJ ? "Data de abertura" : "Data de nascimento"} <Ast />
            </>
          }
        >
          <DateInput
            value={f.data_nascimento}
            onChange={(v) => set("data_nascimento", v)}
            aria-invalid={!!erros.data_nascimento}
          />
          {ctx.maxPrazoIdade && ctx.maxPrazoIdade < 420 && ctx.limitadorPrazo?.vinculo === "Titular" && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-amber-600 font-medium">
              <Info className="h-3.5 w-3.5" />
              <span>Prazo limitado a {ctx.maxPrazoIdade} meses pela idade do titular.</span>
            </div>
          )}
          <Erro erros={erros} campo="data_nascimento" />
        </Campo>
        {/* Sexo e estado civil são atributos de pessoa física; empresa não
            tem nenhum dos dois. */}
        {!isPJ && (
          <>
          <Campo
            label={
              <>
                Sexo <Ast />
              </>
            }
          >
            <Select value={f.sexo} onValueChange={(v) => set("sexo", v as any)}>
              <SelectTrigger aria-invalid={!!erros.sexo}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Masculino</SelectItem>
                <SelectItem value="F">Feminino</SelectItem>
              </SelectContent>
            </Select>
            <Erro erros={erros} campo="sexo" />
          </Campo>
          <Campo
            label={
              <>
                Estado civil <Ast />
              </>
            }
          >
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
          </>
        )}
        <Campo
          label={
            <>
              E-mail <Ast />
            </>
          }
        >
          <Input
            type="email"
            value={f.email}
            onChange={(e) => set("email", e.target.value)}
            readOnly={!!f.email_verificado_em}
            aria-invalid={!!erros.email}
          />
          <Erro erros={erros} campo="email" />
        </Campo>
        <Campo
          label={
            <>
              Celular <Ast />
            </>
          }
        >
          <Input
            value={f.celular}
            onChange={(e) => set("celular", maskCelular(e.target.value))}
            placeholder="(11) 99999-9999"
            aria-invalid={!!erros.celular}
          />
          <Erro erros={erros} campo="celular" />
        </Campo>
      </div>
    </section>
  );
}
