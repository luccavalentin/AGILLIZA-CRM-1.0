import { useEffect, useState } from "react";
import { Volume2, Play, BellRing } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { previewChatSound } from "@/lib/chat-sound";
import {
  TIPOS_NOTIFICACAO,
  getNotificationPrefs,
  setNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/notification-prefs";

/**
 * Configurações de notificação: chave-mestra + por tipo (exibir e som).
 * Salvo por navegador (localStorage), válido em qualquer portal.
 */
export function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => getNotificationPrefs());

  useEffect(() => {
    setPrefs(getNotificationPrefs());
  }, []);

  function salvar(next: NotificationPrefs) {
    setPrefs(next);
    setNotificationPrefs(next);
  }

  function alternarMestra(v: boolean) {
    salvar({ ...prefs, ativo: v });
  }

  function alternarTipo(id: (typeof TIPOS_NOTIFICACAO)[number]["id"], campo: "ativo" | "som", v: boolean) {
    const atual = prefs.tipos[id];
    const novoTipo = { ...atual, [campo]: v };
    // Ligar o som implica manter a notificação ativa.
    if (campo === "som" && v) novoTipo.ativo = true;
    salvar({ ...prefs, tipos: { ...prefs.tipos, [id]: novoTipo } });
    if (campo === "som" && v) previewChatSound();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BellRing className="h-4 w-4 text-muted-foreground" />
            Notificações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="notif-mestra" className="text-sm font-medium">
                Ativar notificações
              </Label>
              <p className="text-xs text-muted-foreground">
                Desligue para silenciar todos os alertas (menu piscando, sons e avisos).
              </p>
            </div>
            <Switch id="notif-mestra" checked={prefs.ativo} onCheckedChange={alternarMestra} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            Preferências por tipo
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {TIPOS_NOTIFICACAO.map((t) => {
            const p = prefs.tipos[t.id];
            const desativado = !prefs.ativo;
            return (
              <div
                key={t.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium text-foreground">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.descricao}</p>
                </div>
                <div className="flex shrink-0 items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`notif-${t.id}-ativo`}
                      className="text-xs text-muted-foreground"
                    >
                      Exibir
                    </Label>
                    <Switch
                      id={`notif-${t.id}-ativo`}
                      checked={p.ativo}
                      disabled={desativado}
                      onCheckedChange={(v) => alternarTipo(t.id, "ativo", v)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`notif-${t.id}-som`}
                      className="text-xs text-muted-foreground"
                    >
                      Som
                    </Label>
                    <Switch
                      id={`notif-${t.id}-som`}
                      checked={p.som}
                      disabled={desativado || !p.ativo}
                      onCheckedChange={(v) => alternarTipo(t.id, "som", v)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          <div className="pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => previewChatSound()}
            >
              <Play className="mr-2 h-3.5 w-3.5" /> Ouvir o som
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
