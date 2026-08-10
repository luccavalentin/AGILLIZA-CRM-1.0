import { useEffect, useState } from "react";
import { Volume2, Play, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  isChatSoundEnabled,
  setChatSoundEnabled,
  previewChatSound,
  getChatSoundId,
  setChatSoundId,
  CHAT_SOUND_OPTIONS,
  type ChatSoundId,
} from "@/lib/chat-sound";

/**
 * Cartão de configuração do som de chat. Salvo por navegador (localStorage),
 * válido em qualquer portal/acesso. Permite ligar/desligar e escolher entre
 * várias opções de som.
 */
export function ChatSoundSetting() {
  const [ativo, setAtivo] = useState(true);
  const [somId, setSomId] = useState<ChatSoundId>("duo");

  useEffect(() => {
    setAtivo(isChatSoundEnabled());
    setSomId(getChatSoundId());
  }, []);

  function alternar(v: boolean) {
    setAtivo(v);
    setChatSoundEnabled(v);
    if (v) previewChatSound();
  }

  function escolher(id: ChatSoundId) {
    setSomId(id);
    setChatSoundId(id);
    previewChatSound(id);
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
              Um alerta sonoro toca quando você recebe uma nova mensagem no chat, em qualquer tela.
            </p>
          </div>
          <Switch id="chat-som" checked={ativo} onCheckedChange={alternar} />
        </div>

        {ativo && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Escolha o som</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CHAT_SOUND_OPTIONS.map((opt) => {
                const selecionado = opt.id === somId;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => escolher(opt.id)}
                    aria-pressed={selecionado}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                      selecionado
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                        selecionado
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40 text-transparent",
                      )}
                    >
                      {selecionado ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3 w-3 text-muted-foreground" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{opt.nome}</span>
                      <span className="block text-xs text-muted-foreground">{opt.descricao}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Toque em uma opção para ouvir e selecionar.
            </p>
          </div>
        )}

        <Button type="button" variant="outline" size="sm" onClick={() => previewChatSound()}>
          <Play className="mr-2 h-3.5 w-3.5" /> Ouvir o som selecionado
        </Button>
      </CardContent>
    </Card>
  );
}
