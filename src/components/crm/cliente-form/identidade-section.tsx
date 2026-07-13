import { FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  OPCOES_SEXO,
  OPCOES_NACIONALIDADE,
  OPCOES_NATURALIDADE,
  OPCOES_TIPO_DOCUMENTO,
  OPCOES_ORGAO_EXPEDIDOR,
  OPCOES_UF,
  CLASSE_ERRO,
  type ClienteFormValues,
  type SetCampo,
} from "./constants";

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
  const clsBox = (k: string) => (erros?.has(k) ? "rounded-md ring-1 ring-destructive" : undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4 text-primary" /> Documento de identidade e qualificação
        </CardTitle>

        <p className="text-sm text-muted-foreground">
          Dados exigidos pelos bancos para análise e aprovação do financiamento.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Sexo</Label>
          <Select value={v.sexo || undefined} onValueChange={(x) => set("sexo", x)}>
            <SelectTrigger className={cls("sexo")}>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {OPCOES_SEXO.map((o) => (
                <SelectItem key={o.v} value={o.v}>
                  {o.l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Nacionalidade</Label>
          <Combobox
            value={v.nacionalidade}
            onValueChange={(x) => set("nacionalidade", x)}
            options={OPCOES_NACIONALIDADE}
            placeholder="Selecione"
            searchPlaceholder="Buscar nacionalidade…"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Naturalidade (cidade/UF de nascimento)</Label>
          <Combobox
            value={v.naturalidade}
            onValueChange={(x) => set("naturalidade", x)}
            options={OPCOES_NATURALIDADE}
            placeholder="Selecione"
            searchPlaceholder="Buscar cidade/UF…"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Tipo de documento</Label>
          <Combobox
            value={v.tipo_documento_identidade}
            onValueChange={(x) => set("tipo_documento_identidade", x)}
            options={OPCOES_TIPO_DOCUMENTO}
            placeholder="Selecione"
            searchPlaceholder="Buscar tipo…"
            className={clsBox("tipo_documento_identidade")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Número do documento</Label>
          <Input
            value={v.numero_documento}
            onChange={(e) => set("numero_documento", e.target.value)}
            className={cls("numero_documento")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Órgão expedidor</Label>
          <Combobox
            value={v.orgao_expedidor}
            onValueChange={(x) => set("orgao_expedidor", x)}
            options={OPCOES_ORGAO_EXPEDIDOR}
            placeholder="Selecione"
            searchPlaceholder="Buscar órgão…"
            className={clsBox("orgao_expedidor")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>UF de expedição</Label>
          <Select value={v.uf_expedicao} onValueChange={(x) => set("uf_expedicao", x)}>
            <SelectTrigger className={cls("uf_expedicao")}>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {OPCOES_UF.map((uf) => (
                <SelectItem key={uf} value={uf}>
                  {uf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Data de expedição</Label>
          <Input
            type="date"
            value={v.data_expedicao}
            onChange={(e) => set("data_expedicao", e.target.value)}
          />
        </div>
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
