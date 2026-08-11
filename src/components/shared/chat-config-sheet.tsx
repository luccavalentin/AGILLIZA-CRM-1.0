import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatSoundSetting } from "@/components/shared/chat-sound-setting";

/**
 * Painel de configurações exclusivo do chat, acessível diretamente do módulo.
 * Contém apenas preferências relacionadas ao chat (som das mensagens);
 * preferências gerais de notificação ficam no perfil do usuário.
 * Reutilizável no CRM e no portal do cliente.
 */
export function ChatConfigSheet({ className }: { className?: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={
            "shrink-0 gap-2 rounded-xl border-border/70 bg-background/60 backdrop-blur " +
            (className ?? "")
          }
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Configurações</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b bg-muted/30 p-5 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-primary" />
            Configurações do chat
          </SheetTitle>
          <SheetDescription>
            Ajuste o som das mensagens do chat. A preferência fica salva neste dispositivo.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 p-5">
            <ChatSoundSetting />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
