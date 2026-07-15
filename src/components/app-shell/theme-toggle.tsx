import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";

/** Botão de alternância de tema (sol em dark, lua em light). */
export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    setThemeState(getTheme());
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="min-h-11 min-w-11 sm:min-h-10 sm:min-w-10"
      aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
      onClick={() => setThemeState(toggleTheme())}
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
