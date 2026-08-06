import { Label } from "@/components/ui/label";
import { STATUS_EDITAVEIS } from "@/lib/propostas/state-machine";

export function TabImovel({ proposta }: { proposta: any; propostaId: string }) {
  const editavel = STATUS_EDITAVEIS.includes(proposta.status);
  const campos: [string, string][] = [
    ["Tipo do imóvel", proposta.tipo_imovel ?? "—"],
    ["Uso do imóvel", proposta.uso_imovel ?? "—"],
    ["CEP", proposta.cep_imovel ?? "—"],
    ["Endereço", proposta.endereco_imovel ?? "—"],
    ["Bairro", proposta.bairro_imovel ?? "—"],
    ["Cidade", proposta.cidade_imovel ?? "—"],
    ["UF", proposta.uf ?? "—"],
  ];
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Dados do imóvel
      </p>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {campos.map(([l, v]) => (
          <div key={l}>
            <Label className="text-xs text-muted-foreground">{l}</Label>
            <div className="mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              {v}
            </div>
          </div>
        ))}
      </div>
      {!editavel && (
        <p className="mt-4 text-xs text-muted-foreground">Dados congelados no status atual.</p>
      )}
    </div>
  );
}
