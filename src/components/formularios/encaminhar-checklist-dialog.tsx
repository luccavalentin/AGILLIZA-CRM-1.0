import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Mail, MessageCircle, Send, Download } from "lucide-react";
import { toast } from "sonner";

interface EncaminharChecklistDialogProps {
  aberto: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (dados: { email: string; whatsapp: string; canal: "email" | "whatsapp" | "pdf" }) => void;
  bancoNome: string;
  clienteNome?: string;
}

export function EncaminharChecklistDialog({
  aberto,
  onOpenChange,
  onConfirm,
  bancoNome,
  clienteNome = "",
}: EncaminharChecklistDialogProps) {
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [canal, setCanal] = useState<"email" | "whatsapp" | "pdf">("pdf");

  const handleConfirm = () => {
    if (canal === "email" && !email) {
      toast.error("Por favor, preencha o e-mail.");
      return;
    }
    if (canal === "whatsapp" && !whatsapp) {
      toast.error("Por favor, preencha o número do WhatsApp.");
      return;
    }
    onConfirm({ email, whatsapp, canal });
    if (canal !== "pdf") {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Compartilhar Checklist
          </DialogTitle>
          <DialogDescription>
            Como deseja compartilhar o checklist do <strong>{bancoNome}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setCanal("pdf")}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                canal === "pdf" ? "bg-primary/5 border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"
              }`}
            >
              <div className="p-3 rounded-full bg-primary/10 text-primary">
                <Download className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">Baixar PDF</span>
            </button>
            <button
              onClick={() => setCanal("whatsapp")}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                canal === "whatsapp" ? "bg-[#25D366]/5 border-[#25D366] ring-1 ring-[#25D366]" : "border-border hover:border-[#25D366]/50"
              }`}
            >
              <div className="p-3 rounded-full bg-[#25D366]/10 text-[#25D366]">
                <MessageCircle className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">WhatsApp</span>
            </button>
            <button
              onClick={() => setCanal("email")}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                canal === "email" ? "bg-[#EA4335]/5 border-[#EA4335] ring-1 ring-[#EA4335]" : "border-border hover:border-[#EA4335]/50"
              }`}
            >
              <div className="p-3 rounded-full bg-[#EA4335]/10 text-[#EA4335]">
                <Mail className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">E-mail</span>
            </button>
          </div>

          {canal === "whatsapp" && (
            <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
              <Label htmlFor="whatsapp" className="font-bold text-[#25D366]">WhatsApp (com DDD)</Label>
              <Input
                id="whatsapp"
                placeholder="11999999999"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ""))}
                className="ring-2 ring-[#25D366]/20"
                autoFocus
              />
            </div>
          )}

          {canal === "email" && (
            <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
              <Label htmlFor="email" className="font-bold text-[#EA4335]">E-mail de destino</Label>
              <Input
                id="email"
                type="email"
                placeholder="exemplo@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="ring-2 ring-[#EA4335]/20"
                autoFocus
              />
            </div>
          )}

          {canal === "pdf" && (
            <p className="text-center text-xs text-muted-foreground px-4">
              O checklist será gerado em formato PDF oficial com a marca Agilliza.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            className={
              canal === "whatsapp" 
                ? "bg-[#25D366] hover:bg-[#20ba5a] text-white" 
                : canal === "pdf" 
                  ? "bg-primary" 
                  : "bg-[#EA4335] hover:bg-[#d93025] text-white"
            }
          >
            {canal === "pdf" ? (
              <>
                <Download className="mr-2 h-4 w-4" />
                Baixar agora
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Compartilhar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
