import { Landmark } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OPCOES_BANCO, type ClienteFormValues, type SetCampo } from "./constants";

export function BancariosSection({ v, set }: { v: ClienteFormValues; set: SetCampo }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="size-4 text-primary" /> Dados bancários
        </CardTitle>

        <p className="text-sm text-muted-foreground">
          Conta usada para crédito e débito das parcelas do financiamento.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Banco</Label>
          <Combobox
            value={v.banco_conta}
            onValueChange={(x) => set("banco_conta", x)}
            options={OPCOES_BANCO}
            placeholder="Selecione o banco"
            searchPlaceholder="Buscar banco…"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Agência</Label>
          <Input value={v.agencia} onChange={(e) => set("agencia", e.target.value)} />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div className="space-y-1.5">
            <Label>Conta corrente</Label>
            <Input
              value={v.conta_corrente}
              onChange={(e) => set("conta_corrente", e.target.value)}
            />
          </div>
          <div className="w-20 space-y-1.5">
            <Label>Dígito</Label>
            <Input value={v.digito_conta} onChange={(e) => set("digito_conta", e.target.value)} />
          </div>
        </div>

        {(v.estado_civil === "casado" || v.estado_civil === "uniao_estavel") && (
          <div className="space-y-4 border-t pt-4 sm:col-span-2">
            <p className="text-sm font-medium">Dados bancários do cônjuge (opcional)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Banco</Label>
                <Combobox
                  value={v.conjuge_banco_conta}
                  onValueChange={(x) => set("conjuge_banco_conta", x)}
                  options={OPCOES_BANCO}
                  placeholder="Selecione o banco"
                  searchPlaceholder="Buscar banco…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Agência</Label>
                <Input
                  value={v.conjuge_agencia}
                  onChange={(e) => set("conjuge_agencia", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div className="space-y-1.5">
                  <Label>Conta corrente</Label>
                  <Input
                    value={v.conjuge_conta_corrente}
                    onChange={(e) => set("conjuge_conta_corrente", e.target.value)}
                  />
                </div>
                <div className="w-20 space-y-1.5">
                  <Label>Dígito</Label>
                  <Input
                    value={v.conjuge_digito_conta}
                    onChange={(e) => set("conjuge_digito_conta", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
