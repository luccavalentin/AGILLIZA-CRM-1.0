import { useState } from "react";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { ChevronRight, Monitor, Moon, ShieldCheck, Sun, UserRound } from "lucide-react";
import { setTheme } from "@/lib/theme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ChatSoundSetting } from "@/components/shared/chat-sound-setting";
import { CabecalhoPagina } from "@/components/cliente/cabecalho-pagina";

export const Route = createFileRoute("/cliente/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — Meu Financiamento" }] }),
  component: Perfil,
});

const layoutCliente = getRouteApi("/cliente");

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
  const { cliente } = layoutCliente.useLoaderData();

  const opcoes: { valor: Modo; label: string; icone: typeof Sun }[] = [
    { valor: "light", label: "Claro", icone: Sun },
    { valor: "dark", label: "Escuro", icone: Moon },
    { valor: "system", label: "Sistema", icone: Monitor },
  ];

  return (
    <div className="space-y-4">
      <CabecalhoPagina icon={UserRound} titulo="Meu perfil" subtitulo="Seus dados, aparência e som das mensagens" />

      <Card className="border-border">
        <CardContent className="flex items-center gap-4 p-4 sm:p-5">
          <Avatar className="size-14">
            {cliente.foto_url ? <AvatarImage src={cliente.foto_url} alt={cliente.nome} /> : null}
            <AvatarFallback className="bg-primary text-lg text-primary-foreground">
              {cliente.nome.trim()[0]?.toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{cliente.nome}</p>
            <p className="text-sm text-muted-foreground">
              {cliente.tipo_pessoa === "PJ" ? "Pessoa jurídica" : "Pessoa física"} · para corrigir algum
              dado, fale com a equipe pelo chat.
            </p>
          </div>
        </CardContent>
      </Card>

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
                  type="button"
                  aria-pressed={ativo}
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

      {/* LGPD mudou para a tela própria (C15): consentimento, baixar dados e pedidos. */}
      <Link
        to="/cliente/privacidade"
        className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">Privacidade e meus dados (LGPD)</p>
          <p className="text-sm text-muted-foreground">Consentimento, baixar dados, portabilidade e exclusão.</p>
        </div>
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
