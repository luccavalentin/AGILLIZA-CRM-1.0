import { useEffect, useState } from "react";
import { Volume2, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  isChatSoundEnabled,
  setChatSoundEnabled,
  previewChatSound,
} from "@/lib/chat-sound";

/**
 * Cartão de configuração do som de chat. Salvo por navegador (localStorage),
 * válido em qualquer portal/acesso.
 */
export function ChatSoundSetting() {
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    setAtivo(isChatSoundEnabled());
  }, []);

  function alternar(v: boolean) {
    setAtivo(v);
    setChatSoundEnabled(v);
    if (v) previewChatSound();
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          Som de mensagens
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="chat-som" className="text-sm font-medium">
              Tocar som ao receber mensagens
            </Label>
            <p className="text-xs text-muted-foreground">
              Um alerta sonoro característico toca quando você recebe uma nova
              mensagem no chat, em qualquer tela.
            </p>
          </div>
          <Switch id="chat-som" checked={ativo} onCheckedChange={alternar} />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => previewChatSound()}
        >
          <Play className="mr-2 h-3.5 w-3.5" /> Ouvir o som
        </Button>
      </CardContent>
    </Card>
  );
}
