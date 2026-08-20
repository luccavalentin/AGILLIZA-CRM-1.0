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
import { RealtimeAuthSync } from "@/components/shared/realtime-auth-sync";
import { PropostaRetornoWatcher } from "@/components/propostas/proposta-retorno-watcher";
import { PropostaPopupHost } from "@/components/propostas/proposta-popup-host";

import appCss from "../styles.css?url";
import { reportError } from "../lib/error-reporting";
import { iniciarLimpezaBadge } from "../lib/host-badge-cleaner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
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
          Ocorreu um erro ao processar os dados. Tente atualizar a página.
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
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
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
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
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

  useEffect(() => {
    return iniciarLimpezaBadge();
  }, []);

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
      if (isChunkError(msg)) tryReload();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

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
    </QueryClientProvider>
  );
}
