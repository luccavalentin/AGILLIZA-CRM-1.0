import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sun, Moon, Monitor, Download, Trash2, UserRound } from "lucide-react";
import { setTheme } from "@/lib/theme";
import { clienteBaixarMeusDados, clienteExcluirDadosApp } from "@/lib/portal/cliente.functions";
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
import { ChatSoundSetting } from "@/components/shared/chat-sound-setting";
import { CabecalhoPagina } from "@/components/cliente/cabecalho-pagina";

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
  const navigate = useNavigate();

  const baixar = useMutation({
    mutationFn: () => clienteBaixarMeusDados(),
    onSuccess: async (dados) => {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margem = 40;
      const larguraUtil = doc.internal.pageSize.getWidth() - margem * 2;
      let y = margem;

      const quebraPagina = (altura: number) => {
        if (y + altura > doc.internal.pageSize.getHeight() - margem) {
          doc.addPage();
          y = margem;
        }
      };
      const titulo = (t: string) => {
        quebraPagina(28);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(t, margem, y);
        y += 20;
      };
      const linha = (label: string, valor: string) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        const texto = `${label}: ${valor}`;
        const linhas = doc.splitTextToSize(texto, larguraUtil) as string[];
        quebraPagina(linhas.length * 15);
        doc.text(linhas, margem, y);
        y += linhas.length * 15;
      };

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Meus dados", margem, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, margem, y);
      y += 22;

      const c = dados.cliente ?? {};
      titulo("Cadastro");
      linha("Nome", c.nome ?? "—");
      linha("Tipo", c.tipo_pessoa ?? "—");
      linha("E-mail", c.email ?? "—");
      linha("Telefone", c.telefone_celular ?? "—");
      linha("UF de interesse", c.uf_interesse ?? "—");
      if (c.created_at)
        linha(
          "Cliente desde",
          new Date(c.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        );
      y += 8;

      titulo("Documentos");
      if ((dados.documentos ?? []).length === 0) {
        linha("", "Nenhum documento.");
      } else {
        (dados.documentos as any[]).forEach((d) =>
          linha(d.tipo_documento ?? d.nome_arquivo ?? "Documento", d.status ?? "—"),
        );
      }
      y += 8;

      titulo("Mensagens");
      if ((dados.mensagens ?? []).length === 0) {
        linha("", "Nenhuma mensagem.");
      } else {
        (dados.mensagens as any[]).forEach((m) => {
          const quem =
            m.remetente_tipo === "cliente"
              ? "Você"
              : (m.remetente_nome && String(m.remetente_nome).trim()) || "Atendente";
          const quando = m.criada_em ? new Date(m.criada_em).toLocaleString("pt-BR") : "";
          linha(`${quem} (${quando})`, m.mensagem ?? "");
        });
      }

      doc.save("meus-dados.pdf");
      toast.success("Seus dados foram baixados em PDF.");
    },
    onError: () => toast.error("Falha de conexão. Tente novamente."),
  });

  const excluir = useMutation({
    mutationFn: () => clienteExcluirDadosApp(),
    onSuccess: () => {
      toast.success("Seus dados do aplicativo foram excluídos.");
      navigate({ to: "/cliente/logout" });
    },
    onError: () => toast.error("Falha de conexão. Tente novamente."),
  });

  const opcoes: { valor: Modo; label: string; icone: typeof Sun }[] = [
    { valor: "light", label: "Claro", icone: Sun },
    { valor: "dark", label: "Escuro", icone: Moon },
    { valor: "system", label: "Sistema", icone: Monitor },
  ];

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        icon={UserRound}
        titulo="Meu perfil"
        subtitulo="Preferências de aparência, som e privacidade dos seus dados"
      />
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

      <ChatSoundSetting />

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Privacidade e meus dados (LGPD)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Baixe uma cópia dos seus dados em PDF ou exclua seus dados do aplicativo. A exclusão
            remove suas mensagens, notificações e histórico de acesso e desativa o acesso a este
            aplicativo — seu cadastro na empresa não é afetado.
          </p>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            disabled={baixar.isPending}
            onClick={() => baixar.mutate()}
          >
            <Download className="mr-2 h-5 w-5" /> Baixar meus dados (PDF)
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="lg"
                className="w-full"
                disabled={excluir.isPending}
              >
                <Trash2 className="mr-2 h-5 w-5" /> Excluir meus dados do aplicativo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir dados do aplicativo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Seus dados do aplicativo (mensagens, notificações e histórico de acesso) serão
                  apagados e o acesso a este aplicativo será desativado. Seu cadastro na empresa
                  permanece intacto. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => excluir.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
