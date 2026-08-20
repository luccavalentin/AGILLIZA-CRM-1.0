import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChecklistDados, listarDocumentos } from "@/lib/crm/clientes.functions";
import { AdicionarItem } from "./documentos-checklist/AdicionarItem";
import { ChecklistsPersonalizados } from "./documentos-checklist/ChecklistsPersonalizados";
import { DocItem } from "./documentos-checklist/doc-item";
import { SecaoComprador } from "./documentos-checklist/secao-comprador";
import { SecaoVendedor } from "./documentos-checklist/secao-vendedor";
import { SecaoImovel } from "./documentos-checklist/secao-imovel";
import { useChecklistState } from "./documentos-checklist/use-checklist-state";
import type { Categoria } from "./documentos-checklist/types";

export function DocumentosChecklist({ clienteId }: { clienteId: string }) {
  const getDados = useServerFn(getChecklistDados);
  const listar = useServerFn(listarDocumentos);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["cliente-checklist", clienteId],
    queryFn: () => getDados({ data: { cliente_id: clienteId } }),
  });
  const { data: docs } = useQuery({
    queryKey: ["cliente-docs", clienteId],
    queryFn: () => listar({ data: { cliente_id: clienteId } }),
  });

  const state = useChecklistState(clienteId, data);
  const {
    custom,
    grupos,
    addCustom,
    removeCustom,
    addGrupo,
    renameGrupo,
    removeGrupo,
    addItemGrupo,
    toggleItemGrupo,
    renameItemGrupo,
    removeItemGrupo,
    moverGrupo,
    moverItem,
  } = state;

  const cli = data?.cliente;
  const vendedores = data?.vendedores ?? [];
  const vend = vendedores[0];
  const casado = cli?.estado_civil === "casado" || cli?.estado_civil === "uniao_estavel";
  const [vendTipoManual, setVendTipoManual] = useState<"PF" | "PJ" | null>(null);
  const vendPJ = vendTipoManual ? vendTipoManual === "PJ" : vend?.tipo_pessoa === "PJ";

  const temDoc = (cat: Categoria, key: string) =>
    (docs ?? []).some((d: any) => d.categoria === cat && d.tipo_documento === key);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist de documentação</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            {error instanceof Error
              ? error.message
              : "Não foi possível carregar todos os dados do checklist."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <SecaoComprador state={state} cli={cli} casado={casado} temDoc={temDoc} />

      {vendedores.length > 0 ? (
        vendedores.map((v: any, index: number) => {
          const vendedorPJ = vendTipoManual ? vendTipoManual === "PJ" : v?.tipo_pessoa === "PJ";
          const vendedorCasado =
            v?.estado_civil === "casado" || v?.estado_civil === "uniao_estavel";
          return (
            <SecaoVendedor
              key={v.id ?? index}
              state={state}
              vend={v}
              vendPJ={vendedorPJ}
              vendCasado={vendedorCasado}
              setVendTipoManual={setVendTipoManual}
              temDoc={temDoc}
              itemPrefix={`v${index + 1}_`}
              titulo={v?.nome ? `Checklist do vendedor — ${v.nome}` : undefined}
            />
          );
        })
      ) : (
        <SecaoVendedor
          state={state}
          vend={vend}
          vendPJ={vendPJ}
          vendCasado={false}
          setVendTipoManual={setVendTipoManual}
          temDoc={temDoc}
        />
      )}

      <SecaoImovel state={state} temDoc={temDoc} />

      {/* ITENS PERSONALIZADOS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens personalizados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="pb-2">
            <AdicionarItem onAdd={(l) => addCustom(l, "outros")} />
          </div>
          {custom.filter((c) => !c.cat || c.cat === "outros").length === 0 && (
            <p className="text-sm text-muted-foreground">
              Adicione itens próprios ao checklist deste cliente.
            </p>
          )}
          {custom
            .filter((c) => !c.cat || c.cat === "outros")
            .map((item) => (
              <DocItem
                key={item.id}
                state={state}
                temDoc={temDoc}
                itemKey={`custom_${item.id}`}
                label={item.label}
                cat="outros"
                onRemove={() => removeCustom(item.id)}
              />
            ))}
        </CardContent>
      </Card>

      <ChecklistsPersonalizados
        grupos={grupos}
        addGrupo={addGrupo}
        renameGrupo={renameGrupo}
        removeGrupo={removeGrupo}
        addItem={addItemGrupo}
        toggleItem={toggleItemGrupo}
        renameItem={renameItemGrupo}
        removeItem={removeItemGrupo}
        moverGrupo={moverGrupo}
        moverItem={moverItem}
      />
    </div>
  );
}
