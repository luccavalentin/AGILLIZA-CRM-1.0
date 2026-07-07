import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sun, Moon, Monitor, Download, Trash2 } from "lucide-react";
import { setTheme } from "@/lib/theme";
import {
  clienteBaixarMeusDados,
  clienteExcluirDadosApp,
} from "@/lib/portal/cliente.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cliente/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — Meu Financiamento" }] }),
  component: Perfil,
});

const STORAGE_KEY = "agilliza-theme";
type Modo = "light" | "dark" | "system";

function modoAtual(): Modo {
  if (typeof window === "undefined") return "system";
  const salvo = window.localStorage.getItem(STORAGE_KEY);
  return salvo === "light" || salvo === "dark" ? salvo : "system";
}

function aplicarModo(modo: Modo) {
  if (modo === "system") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } else {
    setTheme(modo);
  }
}

function Perfil() {
  const [modo, setModo] = useState<Modo>(modoAtual);

  const baixar = useMutation({
    mutationFn: () => clienteBaixarMeusDados(),
    onSuccess: (dados) => {
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "meus-dados.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Seus dados foram baixados.");
    },
    onError: () => toast.error("Falha de conexão. Tente novamente."),
  });

  const excluir = useMutation({
    mutationFn: () => clienteSolicitarLGPD({ data: { acao: "exclusao" } }),
    onSuccess: () => toast.success("Solicitação registrada. Nossa equipe entrará em contato."),
    onError: () => toast.error("Falha de conexão. Tente novamente."),
  });

  const opcoes: { valor: Modo; label: string; icone: typeof Sun }[] = [
    { valor: "light", label: "Claro", icone: Sun },
    { valor: "dark", label: "Escuro", icone: Moon },
    { valor: "system", label: "Sistema", icone: Monitor },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Aparência</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {opcoes.map((o) => {
              const Icone = o.icone;
              const ativo = modo === o.valor;
              return (
                <button
                  key={o.valor}
                  onClick={() => {
                    setModo(o.valor);
                    aplicarModo(o.valor);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors",
                    ativo
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icone className="h-5 w-5" />
                  {o.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Privacidade e meus dados (LGPD)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Você pode baixar uma cópia dos seus dados ou solicitar a exclusão. A exclusão será
            avaliada pela nossa equipe responsável.
          </p>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            disabled={baixar.isPending}
            onClick={() => baixar.mutate()}
          >
            <Download className="mr-2 h-5 w-5" /> Baixar meus dados
          </Button>
          <Button
            variant="destructive"
            size="lg"
            className="w-full"
            disabled={excluir.isPending}
            onClick={() => excluir.mutate()}
          >
            <Trash2 className="mr-2 h-5 w-5" /> Solicitar exclusão de dados
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
