import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { redefinirSenhaLicenca, type PessoaLicenca } from "@/lib/plataforma/licencas.functions";

/*
 * "Redefinir senha de acesso" (0591 do Corretor, pedido do dono de 26/10/2026): a senha da
 * pessoa volta a ser o próprio e-mail e, no próximo acesso, ela cria uma nova. Decisão do
 * dono: login e senha do assinante são sempre o e-mail. As sessões abertas dela caem.
 */
export function RedefinirSenhaPessoa({
  licencaId,
  pessoa,
}: {
  licencaId: string;
  pessoa: PessoaLicenca;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(redefinirSenhaLicenca);
  const [aberto, setAberto] = useState(false);
  const primeiroNome = pessoa.nome.split(/\s+/)[0] || pessoa.nome;

  const m = useMutation({
    mutationFn: () => fn({ data: { id: licencaId, usuarioId: pessoa.id } }),
    onSuccess: () => {
      toast.success(
        `Senha de ${primeiroNome} redefinida: agora é o e-mail dele, até ele criar uma nova.`,
      );
      setAberto(false);
      qc.invalidateQueries({ queryKey: ["plataforma-licenca", licencaId] });
    },
    onError: (e) => {
      setAberto(false);
      toast.error(mensagemDeErro(e, "Não foi possível redefinir a senha."));
    },
  });

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="min-h-11 gap-1.5 px-2 text-xs sm:min-h-8"
        onClick={() => setAberto(true)}
        aria-label={`Redefinir senha de acesso de ${pessoa.nome}`}
      >
        <KeyRound className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Redefinir senha</span>
      </Button>
      <AlertDialog open={aberto} onOpenChange={(v) => !m.isPending && setAberto(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogIcon>
              <KeyRound className="size-6" />
            </AlertDialogIcon>
            <AlertDialogTitle>Redefinir senha de acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              A senha de {pessoa.nome} voltará a ser o e-mail dele; no próximo acesso ele cria uma
              nova. As sessões abertas dele serão encerradas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11 sm:min-h-9" disabled={m.isPending}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 sm:min-h-9"
              disabled={m.isPending}
              onClick={(e) => {
                e.preventDefault();
                m.mutate();
              }}
            >
              {m.isPending ? "Redefinindo…" : "Redefinir senha"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
