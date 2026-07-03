/**
 * Gerenciamento de tema (claro/escuro) sem dependência de bibliotecas.
 * Persiste em localStorage e aplica a classe `dark` no <html>.
 * Um script inline no __root aplica o tema antes da hidratação (sem flash).
 */
export type Theme = "light" | "dark";

const STORAGE_KEY = "agilliza-theme";

/** Lê o tema efetivo atual do DOM (fonte da verdade após hidratação). */
export function getTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Aplica e persiste o tema. */
export function setTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

/** Alterna entre claro e escuro e retorna o novo tema. */
export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

/**
 * Snippet executado no <head> antes da hidratação para evitar flash.
 * Usa preferência salva ou, na ausência, o `prefers-color-scheme`.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;
