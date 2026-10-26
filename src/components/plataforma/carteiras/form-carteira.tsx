import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { pessoasParaCarteira } from "@/lib/plataforma/licencas.functions";
import {
  criarCarteira,
  editarCarteira,
  type Carteira,
} from "@/lib/plataforma/carteiras.functions";

export const CHAVE_CARTEIRAS = ["plataforma-carteiras"] as const;

/** Criar (carteira = null) ou editar uma carteira: nome, descrição e responsável. */
export function FormCarteira({
  aberto,
  carteira,
  aoFechar,
  aoCriar,
}: {
  aberto: boolean;
  carteira: Carteira | null;
  aoFechar: () => void;
  aoCriar?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const pessoasFn = useServerFn(pessoasParaCarteira);
  const criarFn = useServerFn(criarCarteira);
  const editarFn = useServerFn(editarCarteira);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavel, setResponsavel] = useState("");

  useEffect(() => {
    if (!aberto) return;
    setNome(carteira?.nome ?? "");
    setDescricao(carteira?.descricao ?? "");
    setResponsavel(carteira?.responsavel.auth_uid ?? "");
  }, [aberto, carteira]);

  const pessoas = useQuery({
    queryKey: ["plataforma-pessoas-carteira"],
    queryFn: () => pessoasFn(),
    staleTime: 60_000,
    enabled: aberto,
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (carteira) {
        await editarFn({
          data: {
            id: carteira.id,
            nome,
            descricao,
            responsavel:
              responsavel && responsavel !== carteira.responsavel.auth_uid ? responsavel : null,
          },
        });
        return carteira.id;
      }
      const r = await criarFn({ data: { nome, descricao, responsavel } });
      return r.id;
    },
    onSuccess: (id) => {
      toast.success(carteira ? "Carteira atualizada." : "Carteira criada. Agora adicione as contas.");
      qc.invalidateQueries({ queryKey: CHAVE_CARTEIRAS });
      qc.invalidateQueries({ queryKey: ["plataforma-licencas"] });
      if (!carteira && id) aoCriar?.(id);
      aoFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar a carteira.")),
  });

  const nomeOk = nome.trim().length >= 2 && nome.trim().length <= 80;
  const trocaResponsavel = !!carteira && !!responsavel && responsavel !== carteira.responsavel.auth_uid;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{carteira ? "Editar carteira" : "Nova carteira"}</DialogTitle>
          <DialogDescription>
            A pessoa responsável passa a atender todas as contas da carteira: as propostas novas
            delas chegam para ela.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (nomeOk && responsavel) salvar.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cart-nome">Nome da carteira</Label>
            <Input
              id="cart-nome"
              value={nome}
              maxLength={80}
              placeholder="Ex.: Imobiliárias da zona sul"
              onChange={(e) => setNome(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cart-resp">Responsável (analista do Agilliza)</Label>
            <Select value={responsavel} onValueChange={setResponsavel}>
              <SelectTrigger id="cart-resp" aria-label="Responsável pela carteira">
                <SelectValue placeholder={pessoas.isLoading ? "Carregando pessoas…" : "Escolha quem cuida"} />
              </SelectTrigger>
              <SelectContent>
                {(pessoas.data ?? []).map((p) => (
                  <SelectItem key={p.auth_uid} value={p.auth_uid}>
                    {p.nome}
                    {p.contas ? ` · ${p.contas} conta(s)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pessoas.isError && (
              <p className="text-xs text-destructive">
                {mensagemDeErro(pessoas.error, "Não foi possível carregar as pessoas.")}
              </p>
            )}
            {trocaResponsavel && (
              <p className="text-xs text-warning-foreground">
                As {carteira?.contas ?? 0} conta(s) da carteira passam para a nova pessoa.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cart-desc">
              Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="cart-desc"
              rows={3}
              maxLength={500}
              value={descricao}
              placeholder="Critério da carteira, região, combinados com as contas…"
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="min-h-11 sm:min-h-9" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="min-h-11 sm:min-h-9"
              disabled={salvar.isPending || !nomeOk || !responsavel}
            >
              {salvar.isPending ? "Salvando…" : carteira ? "Salvar alterações" : "Criar carteira"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
