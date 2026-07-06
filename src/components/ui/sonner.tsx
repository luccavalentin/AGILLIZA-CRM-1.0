import { Toaster as Sonner } from "sonner";
import symbol from "@/assets/brand/agilliza-symbol-oficial.png";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const BrandIcon = () => (
  <img src={symbol} alt="Agilliza" className="h-5 w-5 shrink-0 rounded-sm object-contain" />
);

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="top-center"
      gap={10}
      icons={{
        success: <BrandIcon />,
        error: <BrandIcon />,
        warning: <BrandIcon />,
        info: <BrandIcon />,
        loading: <BrandIcon />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:rounded-2xl group-[.toaster]:px-4 group-[.toaster]:py-3.5 group-[.toaster]:gap-3 group-[.toaster]:items-center",
          title: "group-[.toast]:font-semibold group-[.toast]:text-[0.9rem]",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-[0.8rem]",
          icon: "group-[.toast]:m-0",
          success: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-emerald-500",
          error: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-destructive",
          warning: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-amber-500",
          info: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-primary",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
