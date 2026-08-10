import { ShieldCheck } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { type ClienteFormValues, type SetCampo } from "./constants";

export function FgtsSection({
  v,
  set,
  erros,
}: {
  v: ClienteFormValues;
  set: SetCampo;
  erros?: Set<string>;
}) {
  const destaque = erros?.has("fg_autorizacao_dados");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-primary" /> FGTS e autorização de dados
        </CardTitle>

        <p className="text-sm text-muted-foreground">
          Informações exigidas no envio da proposta ao banco — preenchidas aqui já seguem para a
          proposta automaticamente.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="utiliza_fgts">Utiliza FGTS na operação</Label>
            <p className="text-xs text-muted-foreground">
              Indique se o cliente pretende usar o saldo do FGTS.
            </p>
          </div>
          <Switch
            id="utiliza_fgts"
            checked={v.utiliza_fgts}
            onCheckedChange={(x) => set("utiliza_fgts", x)}
          />
        </div>
        <div
          className={
            "flex items-start gap-3 rounded-lg border p-3 " +
            (destaque ? "border-destructive ring-1 ring-destructive/40" : "border-border")
          }
        >
          <Checkbox
            id="fg_autorizacao_dados"
            checked={v.fg_autorizacao_dados}
            onCheckedChange={(x: boolean | "indeterminate") =>
              set("fg_autorizacao_dados", x === true)
            }
            className="mt-0.5"
          />
          <Label htmlFor="fg_autorizacao_dados" className="text-sm font-normal leading-snug">
            O cliente autoriza a consulta e o uso dos seus dados junto aos bancos e instituições
            financeiras para análise de crédito.
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}
