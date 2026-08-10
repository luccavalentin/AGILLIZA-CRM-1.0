import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TIPOS_DOCUMENTO_POR_CATEGORIA } from "@/lib/crm/documento-tipos";
import { AutoItem } from "./AutoItem";
import { AdicionarItem } from "./AdicionarItem";
import { DocItem } from "./doc-item";
import type { Categoria } from "./types";
import type { ChecklistState } from "./use-checklist-state";

const T = TIPOS_DOCUMENTO_POR_CATEGORIA;
const filled = (v: unknown) => typeof v === "string" && v.trim().length > 0;

export function SecaoComprador({
  state,
  cli,
  casado,
  temDoc,
}: {
  state: ChecklistState;
  cli: any;
  casado: boolean;
  temDoc: (c: Categoria, k: string) => boolean;
}) {
  const { fgts, toggleFgts, custom, addCustom, removeCustom } = state;
  const p = { state, temDoc };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Checklist do comprador</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="pb-2">
          <AdicionarItem onAdd={(l) => addCustom(l, "comprador")} />
        </div>
        <DocItem {...p} itemKey="c_doc_id" cat="comprador" label={T.comprador[0]} />
        {casado && <DocItem {...p} itemKey="c_doc_id_conj" cat="conjuge" label={T.conjuge[0]} />}
        <DocItem {...p} itemKey="c_comp_end" cat="comprador" label={T.comprador[1]} />
        <DocItem {...p} itemKey="c_cert_ec" cat="comprador" label={T.comprador[2]} />
        <div className="my-2 border-t border-border" />
        <AutoItem label="Profissão" ok={filled(cli?.profissao)} />
        <AutoItem label="Telefone do comprador" ok={filled(cli?.telefone_celular)} />
        {casado && <AutoItem label="Telefone do cônjuge" ok={filled(cli?.conjuge_celular)} />}
        <AutoItem label="E-mail do comprador" ok={filled(cli?.email)} />
        {casado && <AutoItem label="E-mail do cônjuge" ok={filled(cli?.conjuge_email)} />}
        <AutoItem
          label="Dados da conta (agência e conta)"
          ok={filled(cli?.agencia) && filled(cli?.conta_corrente)}
        />
        <div className="mt-3 flex items-center justify-between rounded-lg border border-border p-3">
          <Label className="text-sm">Irá utilizar FGTS?</Label>
          <Switch checked={fgts} onCheckedChange={toggleFgts} />
        </div>
        {fgts && (
          <div className="mt-2 space-y-1 rounded-lg border border-dashed border-border p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Documentos para uso do FGTS
            </p>
            <DocItem {...p} itemKey="fgts_end" cat="comprador" label={T.comprador[3]} />
            <DocItem {...p} itemKey="fgts_irpf" cat="comprador" label={T.comprador[4]} />
            <DocItem {...p} itemKey="fgts_ctps" cat="comprador" label={T.comprador[5]} />
            <DocItem {...p} itemKey="fgts_extrato" cat="comprador" label={T.comprador[6]} />
          </div>
        )}
        {custom
          .filter((c) => c.cat === "comprador")
          .map((item) => (
            <DocItem
              {...p}
              key={item.id}
              itemKey={`custom_${item.id}`}
              label={item.label}
              cat="comprador"
              onRemove={() => removeCustom(item.id)}
            />
          ))}
      </CardContent>
    </Card>
  );
}
