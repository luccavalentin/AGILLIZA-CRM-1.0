import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileSearch, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { obterConfigBureau, salvarConfigBureau } from "@/lib/bureau/bureau.functions";
import { mensagemDeErro } from "@/lib/erros/mensagem";

/**
 * Cadastro do bureau de crédito em Administração · Integrações.
 *
 * O valor das chaves nunca volta do servidor: a tela sabe apenas QUAIS campos
 * já estão preenchidos. Por isso um campo deixado em branco significa "não
 * mexi nele", e não "apague o que estava lá".
 */
export function BureauIntegracaoCard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["bureau-config"],
    queryFn: () => obterConfigBureau(),
  });

  const [provedor, setProvedor] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [valores, setValores] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    setProvedor(data.provedor ?? "");
    setBaseUrl(data.base_url ?? "");
    setAtivo(data.ativo);
    setValores({});
  }, [data]);

  const catalogo = useMemo(() => data?.catalogo ?? [], [data]);
  const escolhido = useMemo(
    () => catalogo.find((p) => p.chave === provedor) ?? null,
    [catalogo, provedor],
  );

  const salvar = useMutation({
    mutationFn: () =>
      salvarConfigBureau({
        data: {
          provedor,
          nome: escolhido?.nome ?? provedor,
          base_url: (baseUrl || escolhido?.baseUrlPadrao || null) as string | null,
          credenciais: valores,
          ativo,
        },
      }),
    onSuccess: () => {
      toast.success("Bureau salvo. As chaves ficam guardadas no servidor.");
      setValores({});
      void qc.invalidateQueries({ queryKey: ["bureau-config"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar o bureau.")),
  });

  const preenchidos = new Set(data?.camposPreenchidos ?? []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileSearch className="h-4 w-4 text-primary" />
          Bureau de crédito &mdash; Consulta Ficha Cliente
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground">
          SPC e Serasa não têm API aberta: a consulta sai de um contrato. Escolha o fornecedor e
          informe as chaves que ele entregou. Elas ficam no servidor e nunca voltam para esta tela.
        </p>

        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bureau-provedor">Fornecedor</Label>
                <select
                  id="bureau-provedor"
                  value={provedor}
                  onChange={(e) => {
                    setProvedor(e.target.value);
                    const novo = catalogo.find((p) => p.chave === e.target.value);
                    setBaseUrl(novo?.baseUrlPadrao ?? "");
                    setValores({});
                  }}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecione…</option>
                  {catalogo.map((p) => (
                    <option key={p.chave} value={p.chave}>
                      {p.nome}
                    </option>
                  ))}
                </select>
                {escolhido && (
                  <p className="text-[11px] text-muted-foreground">{escolhido.descricao}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bureau-url">Endereço da API</Label>
                <Input
                  id="bureau-url"
                  placeholder="https://api.fornecedor.com.br"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>
            </div>

            {escolhido && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <KeyRound className="h-3.5 w-3.5" /> Chaves de acesso
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  {escolhido.campos.map((campo) => {
                    const jaTem = preenchidos.has(campo.chave);
                    return (
                      <div key={campo.chave} className="space-y-1.5">
                        <Label
                          htmlFor={`bureau-${campo.chave}`}
                          className="flex items-center gap-1.5"
                        >
                          {campo.rotulo}
                          {jaTem && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                              <Check className="h-3 w-3" /> guardada
                            </span>
                          )}
                        </Label>
                        <Input
                          id={`bureau-${campo.chave}`}
                          type={campo.segredo ? "password" : "text"}
                          autoComplete="off"
                          placeholder={jaTem ? "•••••••• (deixe em branco para manter)" : ""}
                          value={valores[campo.chave] ?? ""}
                          onChange={(e) =>
                            setValores((v) => ({ ...v, [campo.chave]: e.target.value }))
                          }
                        />
                        {campo.ajuda && (
                          <p className="text-[11px] text-muted-foreground">{campo.ajuda}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!escolhido.implementado && (
                  <p className="rounded-md bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
                    As chaves podem ser salvas desde já. A tradução da resposta deste fornecedor
                    para a ficha do Agilliza ainda precisa ser escrita — envie a documentação da API
                    dele para concluir.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch id="bureau-ativo" checked={ativo} onCheckedChange={setAtivo} />
                <Label htmlFor="bureau-ativo" className="text-sm">
                  Consulta habilitada
                </Label>
              </div>

              <Button
                onClick={() => salvar.mutate()}
                disabled={!provedor || salvar.isPending}
                size="sm"
              >
                {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar bureau
              </Button>
            </div>

            <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Toda consulta feita pelo sistema fica registrada com o operador, a data e a finalidade
              declarada — exigência da LGPD e dos contratos de bureau.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
