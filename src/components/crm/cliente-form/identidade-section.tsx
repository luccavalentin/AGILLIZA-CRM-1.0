import { FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CLASSE_ERRO, type ClienteFormValues, type SetCampo } from "./constants";

export function IdentidadeSection({
  v,
  set,
  erros,
}: {
  v: ClienteFormValues;
  set: SetCampo;
  erros?: Set<string>;
}) {
  const cls = (k: string) => (erros?.has(k) ? CLASSE_ERRO : undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4 text-primary" /> Qualificação profissional
        </CardTitle>

        <p className="text-sm text-muted-foreground">
          Dados exigidos pelos bancos para análise e aprovação do financiamento.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Profissão</Label>
          <Input
            value={v.profissao}
            onChange={(e) => set("profissao", e.target.value)}
            placeholder="Digite a profissão"
            className={cls("profissao")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Empresa onde trabalha</Label>
          <Input value={v.empresa} onChange={(e) => set("empresa", e.target.value)} />
        </div>
      </CardContent>
    </Card>
  );
}
