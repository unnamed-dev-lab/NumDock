import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Laptop, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Theme = "light" | "dark" | "system";
const key = "numdock.theme";
const isTheme = (value: unknown): value is Theme => value === "light" || value === "dark" || value === "system";

// Runs before the first paint; storage failure must not prevent rendering.
export const themeScript = `(()=>{let t="system";try{const s=localStorage.getItem("${key}");if(["light","dark","system"].includes(s))t=s}catch{}document.documentElement.dataset.theme=t==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t})()`;

const ThemeContext = createContext<{ theme: Theme; busy: boolean; change: (value: string) => void }>({ theme: "system", busy: false, change: () => {} });

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [busy, setBusy] = useState(false);
  const switching = useRef(false);
  const preference = useRef<Theme>("system");

  useEffect(() => {
    function sync(value: string | null) {
      const next = isTheme(value) ? value : "system";
      preference.current = next;
      setTheme(next);
      applyTheme(next);
    }
    try { sync(localStorage.getItem(key)); } catch { sync(null); }
    const media = matchMedia("(prefers-color-scheme: dark)");
    const systemChanged = () => { if (preference.current === "system") applyTheme("system"); };
    const storageChanged = (event: StorageEvent) => { if (event.key === key || event.key === null) sync(event.newValue); };
    media.addEventListener("change", systemChanged);
    window.addEventListener("storage", storageChanged);
    return () => { media.removeEventListener("change", systemChanged); window.removeEventListener("storage", storageChanged); };
  }, []);

  async function change(value: string) {
    if (!isTheme(value) || value === preference.current || switching.current) return;
    switching.current = true;
    setBusy(true);
    let committed = false;
    const update = () => {
      preference.current = value;
      applyTheme(value);
      flushSync(() => setTheme(value));
      try { localStorage.setItem(key, value); } catch { /* The in-memory preference still works. */ }
      committed = true;
    };
    try {
      if (typeof document.startViewTransition === "function" && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        await document.startViewTransition(update).finished;
      } else { update(); }
    } catch { if (!committed) update(); }
    finally { switching.current = false; setBusy(false); }
  }

  return <ThemeContext.Provider value={{ theme, busy, change }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const { theme, busy, change } = useContext(ThemeContext);
  const Icon = theme === "system" ? Laptop : theme === "dark" ? Moon : Sun;
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Theme: ${theme}`} disabled={busy}><Icon className="size-4" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuLabel>Appearance</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup value={theme} onValueChange={change}>
        <DropdownMenuRadioItem value="light" disabled={busy}><Sun className="mr-2 size-4" />Light</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark" disabled={busy}><Moon className="mr-2 size-4" />Dark</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="system" disabled={busy}><Laptop className="mr-2 size-4" />System</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
