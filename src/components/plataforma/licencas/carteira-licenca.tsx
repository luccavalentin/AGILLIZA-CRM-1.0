import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  definirCarteira,
  pessoasParaCarteira,
  reenviarAcessoLicenca,
  type Licenca,
} from "@/lib/plataforma/licencas.functions";

const SEM = "__nenhuma__";

/** Ações de carteira e de acesso dentro da gaveta da licença. */
export function CarteiraLicenca({ licenca }: { licenca: Licenca }) {
  const qc = useQueryClient();
  const pessoasFn = useServerFn(pessoasParaCarteira);
  const definirFn = useServerFn(definirCarteira);
  const reenviarFn = useServerFn(reenviarAcessoLicenca);
  const [escolha, setEscolha] = useState(licenca.carteira_uid ?? SEM);
  const pessoas = useQuery({
    queryKey: ["plataforma-pessoas-carteira"],
    queryFn: () => pessoasFn(),
    staleTime: 60_000,
  });

  const salvar = useMutation({
    mutationFn: () => definirFn({ data: { id: licenca.id, carteira: escolha === SEM ? null : escolha } }),
    onSuccess: () => {
      toast.success(escolha === SEM ? "Conta tirada da carteira." : "Carteira atualizada.");
      qc.invalidateQueries({ queryKey: ["plataforma-licencas"] });
      qc.invalidateQueries({ queryKey: ["plataforma-pessoas-carteira"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível mudar a carteira.")),
  });
  const reenviar = useMutation({
    mutationFn: () => reenviarFn({ data: { id: licenca.id } }),
    onSuccess: () => toast.success("Novo link de criar senha enviado ao dono da conta (vale 72 horas)."),
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível reenviar o acesso.")),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={escolha} onValueChange={setEscolha}>
          <SelectTrigger aria-label="Carteira de" className="flex-1">
            <SelectValue placeholder="Escolha quem cuida da conta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM}>Sem carteira</SelectItem>
            {(pessoas.data ?? []).map((p) => (
              <SelectItem key={p.auth_uid} value={p.auth_uid}>
                {p.nome}
                {p.contas ? ` · ${p.contas} conta(s)` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => salvar.mutate()}
          disabled={salvar.isPending || escolha === (licenca.carteira_uid ?? SEM)}
        >
          Salvar carteira
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        As propostas novas desta conta chegam para a pessoa da carteira.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => reenviar.mutate()}
        disabled={reenviar.isPending}
      >
        Reenviar e-mail de criar senha
      </Button>
    </div>
  );
}
