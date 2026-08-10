import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarCelular } from "@/lib/crm/documento";
import { Linha, formatarDataCivil } from "./utils";
import { TransferirAtendimentoDialog } from "./transferir-atendimento-dialog";

export function ResumoTab({
  cliente: c,
  docExib,
  responsavelNome,
  etapaNome,
}: {
  cliente: any;
  docExib: string;
  responsavelNome: string | null | undefined;
  etapaNome: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <Linha rotulo="CPF" valor={docExib} />
          <Linha
            rotulo="RG"
            valor={
              (c as any).numero_documento
                ? `${(c as any).numero_documento}${(c as any).orgao_expedidor ? " · " + (c as any).orgao_expedidor : ""}${(c as any).uf_expedicao ? "/" + (c as any).uf_expedicao : ""}`
                : "—"
            }
          />
          <Linha
            rotulo="RG - data de emissão"
            valor={(c as any).data_expedicao ? formatarDataCivil((c as any).data_expedicao) : "—"}
          />
          <Linha rotulo="E-mail" valor={c.email ?? "—"} />
          <Linha
            rotulo="Celular"
            valor={c.telefone_celular ? formatarCelular(c.telefone_celular) : "—"}
          />
          <Linha rotulo="Nascimento" valor={formatarDataCivil(c.data_nascimento)} />
          <Linha
            rotulo="Renda declarada"
            valor={
              c.renda_total_declarada != null
                ? `R$ ${Number(c.renda_total_declarada).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                : "—"
            }
          />
          <Linha rotulo="UF de interesse" valor={c.uf_interesse ?? "—"} />
          <Linha
            rotulo="Conta bancária"
            valor={
              (c as any).agencia || (c as any).conta_corrente
                ? `${(c as any).banco_conta ? (c as any).banco_conta + " · " : ""}Ag. ${(c as any).agencia ?? "—"} · CC ${(c as any).conta_corrente ?? "—"}${(c as any).digito_conta ? "-" + (c as any).digito_conta : ""}`
                : "—"
            }
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm">Atendimento</CardTitle>
          <TransferirAtendimentoDialog
            clienteId={c.id}
            responsavelAtualId={c.responsavel_id ?? null}
          />
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <Linha rotulo="Responsável" valor={responsavelNome ?? "—"} />
          <Linha rotulo="Etapa atual" valor={etapaNome} />
          <Linha rotulo="Origem" valor={c.origem} />
          <Linha
            rotulo="Cadastrado em"
            valor={new Date(c.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
