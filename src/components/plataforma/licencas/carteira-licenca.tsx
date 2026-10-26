import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { reenviarAcessoLicenca, type Licenca } from "@/lib/plataforma/licencas.functions";
import { adicionarContasCarteira, removerContaCarteira } from "@/lib/plataforma/carteiras.functions";

const SEM = "__nenhuma__";

/**
 * Carteira e acesso dentro da gaveta da licença: escolhe a carteira nomeada da conta (uma
 * por vez; o responsável dela passa a atender a conta) e reenvia o e-mail de criar senha.
 */
export function CarteiraLicenca({
  licenca,
  carteiras,
}: {
  licenca: Licenca;
  carteiras: { id: string; nome: string }[];
}) {
  const qc = useQueryClient();
  const adicionarFn = useServerFn(adicionarContasCarteira);
  const removerFn = useServerFn(removerContaCarteira);
  const reenviarFn = useServerFn(reenviarAcessoLicenca);
  const atual = licenca.carteira_grupo_id ?? SEM;
  const [escolha, setEscolha] = useState(atual);

  const salvar = useMutation({
    mutationFn: async () => {
      if (escolha === SEM) {
        if (licenca.carteira_grupo_id) {
          await removerFn({ data: { id: licenca.carteira_grupo_id, conta: licenca.id } });
        }
        return;
      }
      await adicionarFn({ data: { id: escolha, contas: [licenca.id] } });
    },
    onSuccess: () => {
      toast.success(escolha === SEM ? "Conta tirada da carteira." : "Carteira atualizada.");
      qc.invalidateQueries({ queryKey: ["plataforma-licencas"] });
      qc.invalidateQueries({ queryKey: ["plataforma-carteiras"] });
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
          <SelectTrigger aria-label="Carteira da conta" className="flex-1">
            <SelectValue placeholder="Escolha a carteira" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM}>Sem carteira</SelectItem>
            {carteiras.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="min-h-11 w-full sm:min-h-9 sm:w-auto"
          onClick={() => salvar.mutate()}
          disabled={salvar.isPending || escolha === atual}
        >
          Salvar carteira
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {licenca.carteira_nome
          ? `Hoje quem atende é ${licenca.carteira_nome}.`
          : "Hoje ninguém responde por esta conta."}{" "}
        <Link to="/plataforma/carteiras" className="text-primary underline-offset-2 hover:underline">
          Gerir carteiras
        </Link>
      </p>
      <Button
        size="sm"
        variant="outline"
        className="min-h-11 w-full sm:min-h-9 sm:w-auto"
        onClick={() => reenviar.mutate()}
        disabled={reenviar.isPending}
      >
        <Mail className="mr-1.5 size-4" /> Reenviar e-mail de criar senha
      </Button>
    </div>
  );
}
