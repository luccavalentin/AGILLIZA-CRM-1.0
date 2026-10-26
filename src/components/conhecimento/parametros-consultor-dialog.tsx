import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  obterParametrosConsultor,
  salvarParametrosConsultor,
} from "@/lib/consultor-ia/consultor-ia.functions";

type Municipio = { municipio: string; uf: string; percentual: string };

const n = (s: string) => Number(String(s).replace(",", "."));

/**
 * Parâmetros que o Consultor IA usa nas contas (C18): ITBI padrão e por município, cartório,
 * avaliação, certidões, limite de comprometimento e taxa de referência. Nada disso é fixo no
 * código — cada conta ajusta à sua praça.
 */
export function ParametrosConsultorDialog({
  aberto,
  onAbertoChange,
  podeEditar,
}: {
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  podeEditar: boolean;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["consultor-ia-parametros"],
    queryFn: () => obterParametrosConsultor(),
    enabled: aberto,
  });
  const [f, setF] = useState({
    itbi: "",
    cartorio: "",
    avaliacao: "",
    certidoes: "",
    comprometimento: "",
    taxa: "",
  });
  const [municipios, setMunicipios] = useState<Municipio[]>([]);

  useEffect(() => {
    if (!q.data) return;
    setF({
      itbi: String(q.data.itbi_percentual).replace(".", ","),
      cartorio: String(q.data.cartorio_percentual).replace(".", ","),
      avaliacao: String(q.data.avaliacao_banco).replace(".", ","),
      certidoes: String(q.data.certidoes_valor).replace(".", ","),
      comprometimento: String(q.data.comprometimento_max_percentual).replace(".", ","),
      taxa:
        q.data.taxa_referencia_anual == null
          ? ""
          : String(q.data.taxa_referencia_anual).replace(".", ","),
    });
    setMunicipios(
      q.data.itbi_municipios.map((m) => ({
        ...m,
        percentual: String(m.percentual).replace(".", ","),
      })),
    );
  }, [q.data]);

  const salvar = useMutation({
    mutationFn: () =>
      salvarParametrosConsultor({
        data: {
          itbi_percentual: n(f.itbi),
          cartorio_percentual: n(f.cartorio),
          avaliacao_banco: n(f.avaliacao),
          certidoes_valor: n(f.certidoes),
          comprometimento_max_percentual: n(f.comprometimento),
          taxa_referencia_anual: f.taxa.trim() ? n(f.taxa) : null,
          itbi_municipios: municipios
            .filter((m) => m.municipio.trim())
            .map((m) => ({
              municipio: m.municipio.trim(),
              uf: m.uf.trim().toUpperCase(),
              percentual: n(m.percentual),
            })),
        },
      }),
    onSuccess: () => {
      toast.success("Parâmetros salvos. O Consultor já calcula com eles.");
      qc.invalidateQueries({ queryKey: ["consultor-ia-parametros"] });
      onAbertoChange(false);
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Confira os valores (use números).")),
  });

  const campo = (k: keyof typeof f, rotulo: string, dica?: string) => (
    <div className="space-y-1">
      <Label htmlFor={`par-${k}`} className="text-xs">
        {rotulo}
      </Label>
      <Input
        id={`par-${k}`}
        inputMode="decimal"
        disabled={!podeEditar}
        value={f[k]}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
      />
      {dica && <p className="text-[11px] text-muted-foreground">{dica}</p>}
    </div>
  );

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="size-5 text-primary" /> Parâmetros de cálculo do Consultor
          </DialogTitle>
          <DialogDescription>
            Usados nas contas de parcela, renda e custos. Confira com a prefeitura e a tabela de
            emolumentos do seu estado.
          </DialogDescription>
        </DialogHeader>
        {q.isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {campo("itbi", "ITBI padrão (%)", "Quando o município não está na lista.")}
              {campo("cartorio", "Escritura + registro (%)")}
              {campo("comprometimento", "Comprometimento máx. (%)")}
              {campo("avaliacao", "Avaliação do banco (R$)")}
              {campo("certidoes", "Certidões (R$)")}
              {campo(
                "taxa",
                "Taxa de referência (% a.a.)",
                "Opcional. Em branco, o Consultor pede a taxa.",
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">ITBI por município</p>
                {podeEditar && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setMunicipios([...municipios, { municipio: "", uf: "", percentual: "" }])
                    }
                  >
                    <Plus className="mr-1 size-3.5" /> Município
                  </Button>
                )}
              </div>
              {!municipios.length && (
                <p className="text-xs text-muted-foreground">
                  Nenhum município cadastrado: vale o ITBI padrão.
                </p>
              )}
              {municipios.map((m, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_64px_88px_auto] gap-2">
                  <Input
                    placeholder="Município"
                    value={m.municipio}
                    disabled={!podeEditar}
                    onChange={(e) =>
                      setMunicipios(
                        municipios.map((x, k) =>
                          k === i ? { ...x, municipio: e.target.value } : x,
                        ),
                      )
                    }
                    aria-label="Município"
                  />
                  <Input
                    placeholder="UF"
                    maxLength={2}
                    value={m.uf}
                    disabled={!podeEditar}
                    onChange={(e) =>
                      setMunicipios(
                        municipios.map((x, k) =>
                          k === i ? { ...x, uf: e.target.value.toUpperCase() } : x,
                        ),
                      )
                    }
                    aria-label="UF"
                  />
                  <Input
                    placeholder="%"
                    inputMode="decimal"
                    value={m.percentual}
                    disabled={!podeEditar}
                    onChange={(e) =>
                      setMunicipios(
                        municipios.map((x, k) =>
                          k === i ? { ...x, percentual: e.target.value } : x,
                        ),
                      )
                    }
                    aria-label="Alíquota"
                  />
                  {podeEditar && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setMunicipios(municipios.filter((_, k) => k !== i))}
                      aria-label="Remover município"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onAbertoChange(false)}>
            Fechar
          </Button>
          {podeEditar && (
            <Button disabled={salvar.isPending || q.isLoading} onClick={() => salvar.mutate()}>
              Salvar parâmetros
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
