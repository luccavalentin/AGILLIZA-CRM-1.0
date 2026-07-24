import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { TIPOS_DOCUMENTO_POR_CATEGORIA } from "@/lib/crm/documento-tipos";
import { AutoItem } from "./AutoItem";
import { AdicionarItem } from "./AdicionarItem";
import { DocItem } from "./doc-item";
import type { Categoria } from "./types";
import type { ChecklistState } from "./use-checklist-state";

const T = TIPOS_DOCUMENTO_POR_CATEGORIA;
const filled = (v: unknown) => typeof v === "string" && v.trim().length > 0;

export function SecaoVendedor({
  state,
  vend,
  vendPJ,
  vendCasado,
  setVendTipoManual,
  temDoc,
  itemPrefix = "",
  titulo,
}: {
  state: ChecklistState;
  vend: any;
  vendPJ: boolean;
  vendCasado: boolean;
  setVendTipoManual: (t: "PF" | "PJ") => void;
  temDoc: (c: Categoria, k: string) => boolean;
  itemPrefix?: string;
  titulo?: string;
}) {
  const { check, setManual, custom, addCustom, removeCustom } = state;
  const p = { state, temDoc };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            {titulo ?? "Checklist do vendedor"} — {vendPJ ? "Pessoa Jurídica" : "Pessoa Física"}
          </CardTitle>
          <div className="inline-flex items-center gap-1 rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setVendTipoManual("PF")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${!vendPJ ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              Pessoa Física
            </button>
            <button
              type="button"
              onClick={() => setVendTipoManual("PJ")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${vendPJ ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              Pessoa Jurídica
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {vend
            ? 'O tipo é detectado automaticamente pelo vendedor cadastrado na aba "Vendedores". Use os botões acima para visualizar o outro checklist.'
            : 'Nenhum vendedor cadastrado ainda. Escolha PF ou PJ acima para preparar os documentos, ou cadastre o vendedor na aba "Vendedores".'}
        </p>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="pb-2">
          <AdicionarItem onAdd={(l) => addCustom(l, "vendedor")} />
        </div>
        {vendPJ ? (
          <>
            <DocItem {...p} itemKey={`${itemPrefix}v_contrato_social`} cat="vendedor" label={T.vendedor[3]} />
            <DocItem {...p} itemKey={`${itemPrefix}v_cnpj`} cat="vendedor" label={T.vendedor[4]} />
            <DocItem {...p} itemKey={`${itemPrefix}v_doc_socios`} cat="vendedor" label={T.vendedor[5]} />
            <DocItem {...p} itemKey={`${itemPrefix}v_comp_end_pj`} cat="vendedor" label={T.vendedor[6]} />
          </>
        ) : (
          <>
            <DocItem {...p} itemKey={`${itemPrefix}v_doc_id`} cat="vendedor" label={T.vendedor[0]} />
            <DocItem {...p} itemKey={`${itemPrefix}v_comp_end`} cat="vendedor" label={T.vendedor[1]} />
            <DocItem {...p} itemKey={`${itemPrefix}v_cert_ec`} cat="vendedor" label={T.vendedor[2]} />
            {vendCasado && (
              <DocItem
                {...p}
                itemKey={`${itemPrefix}v_doc_id_conj`}
                cat="vendedor_conjuge"
                label={T.vendedor_conjuge[0]}
              />
            )}
            <div className="my-2 border-t border-border" />
            <AutoItem label="Profissão" ok={filled(vend?.profissao)} />
            <AutoItem label="Telefone" ok={filled(vend?.telefone_celular)} />
            <AutoItem label="E-mail" ok={filled(vend?.email)} />
            <AutoItem
              label="Dados bancários: Banco / AG e CC para recebimento"
              ok={filled(vend?.agencia) && filled(vend?.conta_corrente)}
            />
            {vendCasado && (
              <div className="flex items-center gap-3 py-1.5">
                <Checkbox
                  checked={check[`${itemPrefix}v_dados_banc_conj`] === true}
                  onCheckedChange={(v) => setManual(`${itemPrefix}v_dados_banc_conj`, v === true)}
                />
                <span className="flex-1 text-sm text-muted-foreground">
                  Dados bancários do cônjuge do vendedor
                </span>
              </div>
            )}
          </>
        )}
        {!vend && (
          <p className="pt-2 text-xs text-muted-foreground">
            Cadastre um vendedor na aba “Vendedores” para validar os dados automaticamente.
          </p>
        )}
        {custom
          .filter((c) => c.cat === "vendedor")
          .map((item) => (
            <DocItem
              {...p}
              key={item.id}
              itemKey={`custom_${item.id}`}
              label={item.label}
              cat="vendedor"
              onRemove={() => removeCustom(item.id)}
            />
          ))}
      </CardContent>
    </Card>
  );
}
