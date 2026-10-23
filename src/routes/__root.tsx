import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode, lazy, Suspense } from "react";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { CookieConsent } from "@/components/legal/cookie-consent";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { registrarSwApp } from "@/lib/pwa/registrar-sw";
import { RealtimeAuthSync } from "@/components/shared/realtime-auth-sync";
import { PropostaRetornoWatcher } from "@/components/propostas/proposta-retorno-watcher";
import { PropostaPopupHost } from "@/components/propostas/proposta-popup-host";
import { AgenciaBradescoDialogHost } from "@/components/proposta/dialogs/agencia-bradesco-dialog";

import appCss from "../styles.css?url";
import { reportError } from "../lib/error-reporting";
import { iniciarLimpezaBadge } from "../lib/host-badge-cleaner";
import { mensagemDeErro } from "../lib/erros/mensagem";
import { acompanharTelaVisivel } from "@/lib/tela-visivel";
import { instalarCapturaDeErros } from "@/lib/tecnologia/erros-cliente";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço não existe ou a página foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  const mensagem = error?.message || String(error);
  const stack = error?.stack;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {mensagem === "undefined" || mensagem.includes("undefined")
            ? "Erro de renderização (dado inesperado)"
            : "Não foi possível carregar esta página"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mensagemDeErro(
            error,
            "Ocorreu um erro ao processar os dados. Tente atualizar a página.",
          )}
        </p>
        <details className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-left text-xs">
          <summary className="cursor-pointer font-medium text-foreground">
            Detalhes técnicos
          </summary>
          <p className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] text-foreground/90">
            {mensagem}
          </p>
          {stack && (
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-background/60 p-2 text-[10px] leading-snug text-muted-foreground">
              {stack}
            </pre>
          )}
        </details>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      // Segurança: promove automaticamente qualquer recurso http:// para https://,
      // evitando "conteúdo misto" que faz o navegador exibir o site como "não seguro".
      {
        httpEquiv: "Content-Security-Policy",
        content: "upgrade-insecure-requests",
      },
      {
        name: "viewport",
        // `interactive-widget`: no Android o teclado encolhe a janela e o modal cabe acima dele.
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
      },
      { title: "Agilliza — Crédito Imobiliário e Home Equity" },
      {
        name: "description",
        content:
          "Plataforma do correspondente bancário para simulações, propostas, contratos e comissões de crédito imobiliário e home equity.",
      },
      { property: "og:title", content: "Agilliza — Crédito Imobiliário" },
      {
        property: "og:description",
        content:
          "Gestão completa da esteira de crédito imobiliário: simulações, propostas, financeiro e portais para clientes e parceiros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#000f9f" },
      // Instalado no iPhone: tela cheia e a tela de abertura da marca (links abaixo).
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Agilliza" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      // Ícone do iPhone e telas de abertura no azul da marca (21/10/2026).
      { rel: "apple-touch-icon", href: "/icons/app/apple-touch-icon.png" },
      {
        rel: "apple-touch-startup-image",
        href: "/icons/app/splash/splash-1290x2796.png",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/icons/app/splash/splash-1179x2556.png",
        media:
          "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/icons/app/splash/splash-1284x2778.png",
        media:
          "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/icons/app/splash/splash-1170x2532.png",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/icons/app/splash/splash-1125x2436.png",
        media:
          "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/icons/app/splash/splash-828x1792.png",
        media:
          "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      {
        rel: "apple-touch-startup-image",
        href: "/icons/app/splash/splash-750x1334.png",
        media:
          "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    return iniciarLimpezaBadge();
  }, []);

  useEffect(() => acompanharTelaVisivel(), []);

  // Erros que escapam da tela vão, resumidos e sem dado pessoal, à Gestão de Tecnologia.
  useEffect(() => instalarCapturaDeErros(), []);

  // Service worker do app: habilita as notificações do sistema (o popup que
  // app nativo mostra) e deixa o Web Push pronto para quando houver servidor.
  useEffect(() => {
    registrarSwApp();

    // Quando o usuário toca na notificação e o app já está aberto, o service
    // worker devolve o destino por mensagem (navegadores em que
    // `WindowClient.navigate` não está disponível).
    if (!("serviceWorker" in navigator)) return;
    const aoReceber = (e: MessageEvent) => {
      const dado = e.data as { tipo?: string; destino?: string } | null;
      if (!dado || dado.tipo !== "agilliza:navegar" || !dado.destino) return;
      router.navigate({ to: dado.destino, replace: false }).catch(() => {
        window.location.href = dado.destino as string;
      });
    };
    navigator.serviceWorker.addEventListener("message", aoReceber);
    return () => navigator.serviceWorker.removeEventListener("message", aoReceber);
  }, [router]);

  const userId = (queryClient.getQueryData(["auth-user"]) as any)?.id;

  useEffect(() => {
    // Recarrega uma única vez quando um chunk dinâmico antigo (deploy anterior)
    // falha ao carregar — evita a tela em branco após novos deploys.
    const RELOAD_KEY = "__chunk_reload_at";
    const isChunkError = (msg: string) =>
      /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically imported module/i.test(
        msg,
      );

    const tryReload = () => {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last < 15000) return; // não fica em loop
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
      } catch {
        window.location.reload();
      }
    };

    const onError = (e: ErrorEvent) => {
      if (isChunkError(e.message || "")) tryReload();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = (e.reason && (e.reason.message || String(e.reason))) || "";
      if (isChunkError(msg) || /server function info not found/i.test(msg)) tryReload();
    };

    // O Vite avisa por este evento sempre que um import() dinâmico falha —
    // inclusive quando quem chamou trata o erro. A carta de análise faz
    // exatamente isso: capturava a falha, mostrava "Não foi possível gerar a
    // carta" e a página nunca recarregava, porque "error"/"unhandledrejection"
    // só veem erro não tratado. Aba aberta antes de um deploy ficava com a
    // carta (e qualquer tela carregada sob demanda) quebrada até o F5.
    const onPreloadError = () => tryReload();

    // Função do servidor respondendo HTML: a aba é de uma versão anterior
    // (`mensagemDeErro` dispara este evento). Recarrega para pegar a nova.
    const onVersaoAntiga = () => tryReload();

    // Versão nova publicada com a aba aberta: compara a lista de arquivos com
    // hash que o servidor serve agora com a do momento em que a aba abriu. Se
    // mudou, recarrega na próxima vez que a pessoa voltar à aba ou trocar de
    // tela — nunca no meio de um formulário sendo digitado.
    let assinatura = "";
    let versaoNova = false;
    const lerAssinatura = async () => {
      try {
        const r = await fetch("/auth", { cache: "no-store", credentials: "omit" });
        if (!r.ok) return "";
        const html = await r.text();
        return Array.from(new Set(html.match(/\/assets\/[A-Za-z0-9_.-]+\.js/g) ?? []))
          .sort()
          .join("|");
      } catch {
        return "";
      }
    };
    const conferir = async () => {
      if (versaoNova) return;
      const agora = await lerAssinatura();
      if (!agora) return;
      if (!assinatura) assinatura = agora;
      else if (agora !== assinatura) versaoNova = true;
    };
    const digitando = () => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    };
    const aoVoltar = () => {
      if (document.visibilityState !== "visible") return;
      if (versaoNova && !digitando()) tryReload();
      else void conferir();
    };
    void conferir();
    const intervalo = window.setInterval(() => void conferir(), 5 * 60_000);
    const pararNavegacao = router.subscribe("onBeforeNavigate", () => {
      if (versaoNova) tryReload();
    });

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("vite:preloadError", onPreloadError);
    window.addEventListener("agilliza:versao-antiga", onVersaoAntiga);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("vite:preloadError", onPreloadError);
      window.removeEventListener("agilliza:versao-antiga", onVersaoAntiga);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.clearInterval(intervalo);
      pararNavegacao();
    };
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeAuthSync />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster closeButton />
      <CookieConsent />
      <InstallPrompt />
      <PropostaRetornoWatcher userId={userId} />
      <PropostaPopupHost />
      <AgenciaBradescoDialogHost />
    </QueryClientProvider>
  );
}
