import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, MailCheck, TriangleAlert } from "lucide-react";
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
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  redefinirSenhasProvisoriasAntigas,
  type ResultadoSenhasAntigas,
} from "@/lib/admin/pessoas.functions";

/**
 * Contas criadas antes de 26/10/2026 podem estar com a senha provisória igual ao próprio
 * e-mail. O administrador confere quantas ainda estão com a troca pendente e, se quiser,
 * manda uma senha nova sorteada a cada uma, só por e-mail (ninguém vê a senha aqui).
 */
export function SenhasProvisoriasAntigas() {
  const [aberto, setAberto] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSenhasAntigas | null>(null);
  const fn = useServerFn(redefinirSenhasProvisoriasAntigas);
  const contagem = useQuery({
    queryKey: ["senhas-provisorias-antigas"],
    queryFn: () => fn({ data: { confirmar: false } }),
    enabled: aberto && !resultado,
    staleTime: 0,
  });
  const enviar = useMutation({
    mutationFn: () => fn({ data: { confirmar: true } }),
    onSuccess: (r) => {
      setResultado(r);
      if (r.falhas.length === 0)
        toast.success(`${r.enviadas} senha(s) nova(s) enviada(s) por e-mail.`);
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível enviar as senhas.")),
  });

  function fechar() {
    setAberto(false);
    setResultado(null);
  }

  const n = contagem.data?.pendentes ?? 0;
  return (
    <>
      <Button variant="outline" onClick={() => setAberto(true)}>
        <KeyRound className="mr-2 h-4 w-4" /> Senhas provisórias antigas
      </Button>
      <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Senhas provisórias antigas</DialogTitle>
            <DialogDescription>
              Quem foi cadastrado antes de 26/10/2026 e ainda não trocou a senha pode estar com a
              senha igual ao próprio e-mail. Aqui cada uma recebe uma senha nova, sorteada e enviada
              só para o e-mail da pessoa.
            </DialogDescription>
          </DialogHeader>

          {resultado ? (
            <div className="space-y-3 text-sm">
              <p className="flex items-start gap-2">
                <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {resultado.enviadas} de {resultado.pendentes} senha(s) nova(s) foram para a fila
                  de e-mail.
                </span>
              </p>
              {resultado.falhas.length > 0 && (
                <div
                  role="alert"
                  className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40"
                >
                  <p className="flex items-center gap-2 font-medium">
                    <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    Não foi possível para {resultado.falhas.length} pessoa(s):
                  </p>
                  <ul className="mt-2 space-y-1">
                    {resultado.falhas.map((f) => (
                      <li key={f.nome} className="break-words text-muted-foreground">
                        <span className="font-medium text-foreground">{f.nome}</span>: {f.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : contagem.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Conferindo quem ainda está com a senha
              provisória…
            </p>
          ) : contagem.isError ? (
            <p className="text-sm text-destructive">
              {mensagemDeErro(contagem.error, "Não foi possível conferir agora.")}
            </p>
          ) : n === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ninguém está com a senha provisória pendente. Nada a fazer.
            </p>
          ) : (
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-semibold">{n}</span> pessoa(s) ainda com a troca de senha
                pendente:
              </p>
              <p className="break-words text-muted-foreground">
                {contagem.data!.nomes.join(", ")}
                {n > contagem.data!.nomes.length
                  ? ` e mais ${n - contagem.data!.nomes.length}`
                  : ""}
                .
              </p>
              <p className="text-muted-foreground">
                A senha antiga deixa de valer. No próximo acesso, cada pessoa entra com a senha do
                e-mail e define a dela.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="w-full sm:w-auto" onClick={fechar}>
              {resultado ? "Concluído" : "Cancelar"}
            </Button>
            {!resultado && n > 0 && (
              <Button
                className="w-full sm:w-auto"
                disabled={enviar.isPending}
                onClick={() => enviar.mutate()}
              >
                {enviar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar senha nova a {n} pessoa(s)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
