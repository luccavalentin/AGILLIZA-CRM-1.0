import { Toaster as Sonner } from "sonner";
import symbol from "@/assets/brand/agilliza-symbol-oficial.png";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const BrandIcon = () => (
  <img
    src={symbol}
    alt="Agilliza"
    className="h-5 w-5 shrink-0 rounded-sm object-contain"
  />
);

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
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
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
          title: "group-[.toast]:font-semibold",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
