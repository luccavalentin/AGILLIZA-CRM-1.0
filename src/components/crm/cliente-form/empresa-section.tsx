import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIPOS_EMPRESA, type ClienteFormValues } from "./constants";

/**
 * Dados da empresa exigidos pela integração bancária no participante PJ:
 * `tipoEmpresa`, `faturamentoEmpresa`, `patrimonioLiquidoEmpresa` e
 * `capitalSocialEmpresa`. A data de abertura fica em "Dados básicos", no mesmo
 * campo que em PF guarda a data de nascimento.
 *
 * Só é renderizada para cadastros PJ.
 */
export function EmpresaSection({
  v,
  set,
  erros,
}: {
  v: ClienteFormValues;
  set: <K extends keyof ClienteFormValues>(k: K, val: ClienteFormValues[K]) => void;
  erros?: Set<string>;
}) {
  const cls = (campo: string) =>
    erros?.has(campo) ? "border-destructive ring-1 ring-destructive/40" : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="size-4 text-primary" /> Dados da empresa
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Exigidos pelos bancos na análise de pessoa jurídica.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Natureza jurídica *</Label>
          <Select value={v.tipo_empresa} onValueChange={(x) => set("tipo_empresa", x)}>
            <SelectTrigger className={cls("tipo_empresa")}>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_EMPRESA.map((o) => (
                <SelectItem key={o.v} value={o.v}>
                  {o.l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Faturamento mensal (R$)</Label>
          <Input
            value={v.faturamento_empresa}
            onChange={(e) => set("faturamento_empresa", e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Patrimônio líquido (R$)</Label>
          <Input
            value={v.patrimonio_liquido_empresa}
            onChange={(e) => set("patrimonio_liquido_empresa", e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Capital social (R$)</Label>
          <Input
            value={v.capital_social_empresa}
            onChange={(e) => set("capital_social_empresa", e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
          />
        </div>
      </CardContent>
    </Card>
  );
}
