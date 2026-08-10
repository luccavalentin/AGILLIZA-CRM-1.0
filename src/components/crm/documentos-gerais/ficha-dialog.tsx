import { Printer, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { obterFichaConsolidada } from "@/lib/crm/documentos-gerais.functions";
import { imprimirFichaPDF } from "@/lib/crm/pdf-lazy";
import { Campo } from "./card-cliente";
import { brl, fmtData, titulo } from "./helpers";

export function FichaDialog({
  clienteId,
  clienteNome,
  open,
  onOpenChange,
}: {
  clienteId: string;
  clienteNome: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const obter = useServerFn(obterFichaConsolidada);
  const { data, isLoading } = useQuery({
    queryKey: ["crm-ficha-consolidada", clienteId],
    queryFn: () => obter({ data: { cliente_id: clienteId } }),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="relative overflow-hidden border-b border-border/60 bg-gradient-to-r from-primary/12 via-primary/5 to-transparent p-5">
          <span className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md ring-1 ring-inset ring-primary/30">
                <User className="h-5 w-5" />
              </span>
              <span className="flex flex-col">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Ficha consolidada
                </span>
                <span className="text-base font-semibold text-foreground">
                  {titulo(clienteNome)}
                </span>
              </span>
            </DialogTitle>
            <Button
              size="sm"
              variant="outline"
              disabled={!data}
              onClick={() => void (data && imprimirFichaPDF(clienteNome, data))}
              className="mr-8 shrink-0 gap-2 border-primary/30 bg-background/70 text-primary hover:bg-primary/10"
            >
              <Printer className="h-4 w-4" /> Imprimir PDF
            </Button>
          </div>
        </DialogHeader>
        <div className="max-h-[calc(90vh-5.5rem)] overflow-y-auto p-5">
          {isLoading || !data ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <Tabs defaultValue="comprador">
              <TabsList className="flex-wrap">
                <TabsTrigger value="comprador">Comprador</TabsTrigger>
                {data.conjuge && <TabsTrigger value="conjuge">Cônjuge</TabsTrigger>}
                <TabsTrigger value="vendedor">
                  Vendedor{data.vendedores.length > 1 ? `es (${data.vendedores.length})` : ""}
                </TabsTrigger>
                <TabsTrigger value="imovel">Imóvel</TabsTrigger>
              </TabsList>

              <TabsContent value="comprador" className="mt-4">
                {data.comprador ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Campo rotulo="Nome" valor={data.comprador.nome} />
                    <Campo rotulo="Documento" valor={data.comprador.documento} />
                    <Campo rotulo="Nascimento" valor={fmtData(data.comprador.data_nascimento)} />
                    <Campo rotulo="Estado civil" valor={data.comprador.estado_civil} />
                    <Campo rotulo="Profissão" valor={data.comprador.profissao} />
                    <Campo rotulo="Nacionalidade" valor={data.comprador.nacionalidade} />
                    <Campo rotulo="E-mail" valor={data.comprador.email} />
                    <Campo rotulo="Celular" valor={data.comprador.telefone_celular} />
                    <Campo
                      rotulo="Renda declarada"
                      valor={brl(data.comprador.renda_total_declarada)}
                    />
                    <Campo rotulo="Nome da mãe" valor={data.comprador.nome_mae} />
                    <Campo rotulo="Banco" valor={data.comprador.banco_conta} />
                    <Campo
                      rotulo="Agência / Conta"
                      valor={
                        [data.comprador.agencia, data.comprador.conta_corrente]
                          .filter(Boolean)
                          .join(" / ") || "—"
                      }
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem dados.</p>
                )}
              </TabsContent>

              {data.conjuge && (
                <TabsContent value="conjuge" className="mt-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Campo rotulo="Nome" valor={data.conjuge.nome} />
                    <Campo rotulo="Documento" valor={data.conjuge.documento} />
                    <Campo rotulo="Nascimento" valor={fmtData(data.conjuge.data_nascimento)} />
                    <Campo rotulo="Profissão" valor={data.conjuge.profissao} />
                    <Campo rotulo="Nacionalidade" valor={data.conjuge.nacionalidade} />
                    <Campo rotulo="E-mail" valor={data.conjuge.email} />
                    <Campo rotulo="Celular" valor={data.conjuge.telefone_celular} />
                    <Campo rotulo="Renda" valor={brl(data.conjuge.renda)} />
                    <Campo rotulo="Nome da mãe" valor={data.conjuge.nome_mae} />
                    <Campo rotulo="Empresa" valor={data.conjuge.empresa} />
                    <Campo rotulo="Banco" valor={data.conjuge.banco_conta} />
                    <Campo
                      rotulo="Agência / Conta"
                      valor={
                        [data.conjuge.agencia, data.conjuge.conta_corrente]
                          .filter(Boolean)
                          .join(" / ") || "—"
                      }
                    />
                  </div>
                </TabsContent>
              )}

              <TabsContent value="vendedor" className="mt-4 space-y-4">
                {data.vendedores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum vendedor cadastrado.</p>
                ) : (
                  data.vendedores.map((v, i) => (
                    <div key={v.id ?? i} className="rounded-lg border border-border p-3">
                      <p className="mb-2 text-sm font-semibold text-foreground">
                        {v.nome ?? `Vendedor ${i + 1}`}
                      </p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Campo rotulo="Documento" valor={v.documento ?? v.cpf_cnpj} />
                        <Campo rotulo="Estado civil" valor={v.estado_civil} />
                        <Campo rotulo="Profissão" valor={v.profissao} />
                        <Campo rotulo="E-mail" valor={v.email} />
                        <Campo rotulo="Celular" valor={v.telefone_celular} />
                        <Campo rotulo="Banco" valor={v.banco_conta} />
                        <Campo
                          rotulo="Agência / Conta"
                          valor={[v.agencia, v.conta_corrente].filter(Boolean).join(" / ") || "—"}
                        />
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="imovel" className="mt-4 space-y-4">
                {data.imoveis.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum imóvel cadastrado.</p>
                ) : (
                  data.imoveis.map((im, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 sm:grid-cols-2"
                    >
                      <Campo rotulo="Tipo" valor={im.tipo} />
                      <Campo rotulo="Uso" valor={im.uso} />
                      <Campo rotulo="Logradouro" valor={im.logradouro} />
                      <Campo
                        rotulo="Cidade / UF"
                        valor={[im.cidade, im.uf].filter(Boolean).join(" / ") || "—"}
                      />
                      <Campo rotulo="Valor" valor={brl(im.valor)} />
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
