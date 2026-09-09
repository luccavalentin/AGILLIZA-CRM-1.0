import { useEffect, useState } from "react";
import { BellRing, Smartphone, AlertTriangle, Play } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  motivoSemSuporte,
  mostrarNotificacaoSistema,
  notificacoesSistemaLigadas,
  pedirPermissaoNotificacoes,
  permissaoNotificacoes,
  setNotificacoesSistemaLigadas,
  suporteNotificacoes,
  type EstadoPermissao,
} from "@/lib/pwa/notificacoes-sistema";

/**
 * Liga/desliga o popup do sistema operacional (o aviso que aparece fora do
 * app, igual ao de app nativo). A permissão é do navegador e por aparelho.
 */
export function NotificacoesSistemaCard() {
  const [suporte, setSuporte] = useState(true);
  const [permissao, setPermissao] = useState<EstadoPermissao>("default");
  const [ligado, setLigado] = useState(false);
  const [pedindo, setPedindo] = useState(false);

  useEffect(() => {
    setSuporte(suporteNotificacoes());
    setPermissao(permissaoNotificacoes());
    setLigado(notificacoesSistemaLigadas());
  }, []);

  async function alternar(valor: boolean) {
    if (!valor) {
      setLigado(false);
      setNotificacoesSistemaLigadas(false);
      return;
    }

    setPedindo(true);
    try {
      const resultado =
        permissaoNotificacoes() === "granted" ? "granted" : await pedirPermissaoNotificacoes();
      setPermissao(resultado);

      if (resultado !== "granted") {
        setLigado(false);
        setNotificacoesSistemaLigadas(false);
        toast.error(
          resultado === "denied"
            ? "As notificações estão bloqueadas para este site. Libere nas permissões do navegador e tente de novo."
            : "Permissão não concedida.",
        );
        return;
      }

      setLigado(true);
      setNotificacoesSistemaLigadas(true);
      toast.success("Notificações do sistema ativadas neste aparelho.");
    } finally {
      setPedindo(false);
    }
  }

  async function testar() {
    const ok = await mostrarNotificacaoSistema({
      titulo: "Tudo certo por aqui",
      corpo: "Notificação de teste. É assim que o retorno do banco vai chegar neste aparelho.",
      link: "/visao-geral/painel",
      tag: "teste",
      acao: "Abrir",
    });
    if (!ok) toast.error("Não foi possível exibir a notificação de teste.");
  }

  const motivo = motivoSemSuporte();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Smartphone className="h-4 w-4 text-muted-foreground" />
          Notificações do sistema
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="notif-sistema" className="text-sm font-medium">
              Avisar fora do app
            </Label>
            <p className="text-xs text-muted-foreground">
              Mostra o aviso na tela do celular ou do computador quando o app está em segundo plano
              — do mesmo jeito que um aplicativo instalado.
            </p>
          </div>
          <Switch
            id="notif-sistema"
            checked={ligado}
            disabled={!suporte || pedindo}
            onCheckedChange={(v) => void alternar(v)}
          />
        </div>

        {!suporte && motivo && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{motivo}</span>
          </div>
        )}

        {suporte && permissao === "denied" && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Este site está bloqueado para notificações. Abra as permissões do navegador (ícone do
              cadeado na barra de endereço) e libere "Notificações".
            </span>
          </div>
        )}

        {ligado && permissao === "granted" && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void testar()}>
              <Play className="mr-2 h-3.5 w-3.5" /> Enviar teste
            </Button>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <BellRing className="h-3.5 w-3.5" />
              Vale só para este aparelho e este navegador.
            </span>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Com o app totalmente fechado o aviso ainda não chega: isso depende de um servidor de push,
          que é o próximo passo. Com o app aberto ou em segundo plano, funciona.
        </p>
      </CardContent>
    </Card>
  );
}
