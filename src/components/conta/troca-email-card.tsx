import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AtSign, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icone3D } from "@/components/ui/icone-3d";
import { minhaTrocaDeEmail, pedirTrocaDeEmail } from "@/lib/conta/trocar-email.functions";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function dataHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Trocar o e-mail de ACESSO (login) pela própria pessoa. O link de confirmação vai para o
 * endereço novo e o atual recebe um aviso; nada muda até o link ser aberto — e, depois dele,
 * todas as sessões são encerradas (o e-mail sai pela fila da plataforma, não pelo Auth).
 */
export function TrocaEmailCard({ emailAtual }: { emailAtual: string }) {
  const pedirFn = useServerFn(pedirTrocaDeEmail);
  const pendenteFn = useServerFn(minhaTrocaDeEmail);
  const [novo, setNovo] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resposta, setResposta] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const [pendente, setPendente] = useState<{ pendentePara: string; expiraEm: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    pendenteFn()
      .then((p) => vivo && setPendente(p))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [pendenteFn, resposta]);

  const novoNormal = novo.trim().toLowerCase();
  const formatoRuim = novo.length > 0 && !EMAIL.test(novoNormal);
  const igual = novoNormal.length > 0 && novoNormal === emailAtual.toLowerCase();
  const podeEnviar = EMAIL.test(novoNormal) && !igual && senha.length > 0 && !enviando;

  async function enviar() {
    if (!podeEnviar) return;
    setEnviando(true);
    setResposta(null);
    try {
      const r = await pedirFn({ data: { email: novoNormal, senha } });
      setResposta(r);
      if (r.ok) {
        toast.success("Link enviado para o e-mail novo.");
        setNovo("");
        setSenha("");
      }
    } catch (e) {
      setResposta({
        ok: false,
        mensagem:
          e instanceof Error && e.message ? e.message : "Não foi possível pedir a troca agora.",
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card data-tour="seguranca-email" className="lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-3 text-sm">
          <Icone3D icone={AtSign} tom="marca" tamanho="md" />
          E-mail de acesso
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
          <span className="text-xs text-muted-foreground">Atual</span>
          <strong className="min-w-0 break-all font-medium text-foreground">{emailAtual}</strong>
        </div>

        {pendente && !resposta?.ok && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs"
          >
            <MailCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Aguardando confirmação.</span> Enviamos
              o link para <strong className="break-all">{pendente.pendentePara}</strong>, que vale
              até {dataHora(pendente.expiraEm)}. Um pedido novo substitui este.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="troca-email-novo">Novo e-mail de acesso</Label>
            <Input
              id="troca-email-novo"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              placeholder="nome@exemplo.com.br"
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              aria-invalid={formatoRuim || igual}
            />
            {formatoRuim && <p className="text-xs text-destructive">Informe um e-mail válido.</p>}
            {igual && <p className="text-xs text-destructive">Este já é o seu e-mail de acesso.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="troca-email-senha">Senha atual</Label>
            <Input
              id="troca-email-senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
        </div>

        {resposta && (
          <p
            role={resposta.ok ? "status" : "alert"}
            className={
              resposta.ok
                ? "rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-xs text-emerald-700 dark:text-emerald-400"
                : "rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive"
            }
          >
            {resposta.mensagem}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <ul className="list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
            <li>O e-mail atual recebe um aviso do pedido.</li>
            <li>Ao confirmar, todos os aparelhos são desconectados.</li>
            <li>Papel, nível e permissões não mudam.</li>
          </ul>
          <Button onClick={enviar} disabled={!podeEnviar} className="w-full sm:w-auto">
            {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar link de confirmação
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
