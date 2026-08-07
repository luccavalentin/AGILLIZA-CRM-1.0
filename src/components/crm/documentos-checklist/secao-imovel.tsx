import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIPOS_DOCUMENTO_POR_CATEGORIA } from "@/lib/crm/documento-tipos";
import { AdicionarItem } from "./AdicionarItem";
import { DocItem } from "./doc-item";
import type { Categoria } from "./types";
import type { ChecklistState } from "./use-checklist-state";

const T = TIPOS_DOCUMENTO_POR_CATEGORIA;

export function SecaoImovel({
  state,
  temDoc,
}: {
  state: ChecklistState;
  temDoc: (c: Categoria, k: string) => boolean;
}) {
  const { check, setCheck, setManual, persistir, custom, addCustom, removeCustom } = state;
  const p = { state, temDoc };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Checklist do imóvel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="pb-2">
          <AdicionarItem onAdd={(l) => addCustom(l, "imovel")} />
        </div>
        <DocItem {...p} itemKey="i_matricula" cat="imovel" label={T.imovel[0]} />
        <DocItem {...p} itemKey="i_iptu" cat="imovel" label={T.imovel[1]} />
        <div className="mt-2 flex items-center justify-between rounded-lg border border-border p-3">
          <Label className="text-sm">O imóvel fica em condomínio?</Label>
          <Switch
            checked={check["i_condominio"] === true}
            onCheckedChange={(v) => setManual("i_condominio", v)}
          />
        </div>
        {check["i_condominio"] === true && (
          <div className="mt-2 space-y-1 rounded-lg border border-dashed border-border p-3">
            <DocItem {...p} itemKey="i_cnd_cond" cat="imovel" label={T.imovel[2]} />
            <DocItem {...p} itemKey="i_planta" cat="imovel" label={T.imovel[3]} />
          </div>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Contato da vistoria — Nome
            </Label>
            <Input
              value={check["i_vistoria_nome"] ?? ""}
              onChange={(e) => setCheck((p) => ({ ...p, i_vistoria_nome: e.target.value }))}
              onBlur={() => persistir(check)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Contato da vistoria — Telefone
            </Label>
            <Input
              value={check["i_vistoria_tel"] ?? ""}
              onChange={(e) => setCheck((p) => ({ ...p, i_vistoria_tel: e.target.value }))}
              onBlur={() => persistir(check)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Quantidade de vagas do imóvel
            </Label>
            <Input
              inputMode="numeric"
              value={check["i_vagas"] ?? ""}
              onChange={(e) => setCheck((p) => ({ ...p, i_vagas: e.target.value }))}
              onBlur={() => persistir(check)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">IQ?</Label>
            <Select
              value={check["i_iq"] ?? ""}
              onValueChange={(v) => setManual("i_iq", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {custom
          .filter((c) => c.cat === "imovel")
          .map((item) => (
            <DocItem
              {...p}
              key={item.id}
              itemKey={`custom_${item.id}`}
              label={item.label}
              cat="imovel"
              onRemove={() => removeCustom(item.id)}
            />
          ))}
      </CardContent>
    </Card>
  );
}
