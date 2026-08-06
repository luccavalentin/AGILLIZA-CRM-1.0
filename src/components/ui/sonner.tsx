import { Toaster as Sonner } from "sonner";
import { Loader2 } from "lucide-react";
import symbol from "@/assets/brand/agilliza-symbol-oficial.png";

type ToasterProps = React.ComponentProps<typeof Sonner>;

type Tone = "success" | "error" | "warning" | "info" | "loading";

const dotTone: Record<Tone, string> = {
  success: "bg-emerald-500",
  error: "bg-destructive",
  warning: "bg-amber-500",
  info: "bg-primary",
  loading: "bg-muted-foreground/60",
};

/**
 * Marca da Agilliza como identidade do toast: um único selo limpo com o
 * símbolo da marca e um ponto discreto indicando o tom da mensagem.
 */
const Marca = ({ tone }: { tone: Tone }) => (
  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background shadow-sm">
    {tone === "loading" ? (
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    ) : (
      <img src={symbol} alt="Agilliza" className="h-5 w-5 object-contain" />
    )}
    <span
      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background ${dotTone[tone]}`}
    />
  </span>
);

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="top-right"
      expand
      visibleToasts={3}
      gap={14}
      offset={24}
      duration={4500}
      icons={{
        success: <Marca tone="success" />,
        error: <Marca tone="error" />,
        warning: <Marca tone="warning" />,
        info: <Marca tone="info" />,
        loading: <Marca tone="loading" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast pointer-events-auto group-[.toaster]:w-full group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border/60 group-[.toaster]:shadow-[0_18px_40px_-24px_hsl(var(--foreground)/0.35)] group-[.toaster]:rounded-xl group-[.toaster]:px-4 group-[.toaster]:py-3.5 group-[.toaster]:gap-3.5 group-[.toaster]:items-center",
          content: "group-[.toast]:gap-1",
          title:
            "group-[.toast]:font-semibold group-[.toast]:text-[0.875rem] group-[.toast]:leading-snug group-[.toast]:tracking-[-0.01em]",
          description:
            "group-[.toast]:text-muted-foreground group-[.toast]:text-[0.8rem] group-[.toast]:leading-relaxed",
          icon: "group-[.toast]:!m-0 group-[.toast]:!h-10 group-[.toast]:!w-10 group-[.toast]:shrink-0 group-[.toast]:items-center group-[.toast]:justify-center",
          closeButton:
            "group-[.toast]:bg-background group-[.toast]:border-border group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
