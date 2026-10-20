import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";
type ResolvedTheme = Exclude<Theme, "system">;
const storageKey = "numdock.theme";
export const isTheme = (value: unknown): value is Theme =>
  value === "light" || value === "dark" || value === "system";

// App-owned preferences; the installed beUI hook owns view transitions.
export const themeScript = `(()=>{let t="system";try{const s=localStorage.getItem("${storageKey}");if(["light","dark","system"].includes(s))t=s}catch{}document.documentElement.dataset.theme=t==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t})()`;

const ThemeContext = createContext<{
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setPreference] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const preference = useRef<Theme>("system");

  const apply = useCallback((next: Theme) => {
    const resolved =
      next === "system"
        ? matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : next;
    document.documentElement.dataset.theme = resolved;
    preference.current = next;
    setPreference(next);
    setResolvedTheme(resolved);
  }, []);

  useEffect(() => {
    function sync(value: string | null) {
      apply(isTheme(value) ? value : "system");
    }
    try {
      sync(localStorage.getItem(storageKey));
    } catch {
      sync(null);
    }
    const media = matchMedia("(prefers-color-scheme: dark)");
    const systemChanged = () => {
      if (preference.current === "system") apply("system");
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) sync(event.newValue);
    };
    media.addEventListener("change", systemChanged);
    window.addEventListener("storage", storageChanged);
    return () => {
      media.removeEventListener("change", systemChanged);
      window.removeEventListener("storage", storageChanged);
    };
  }, [apply]);

  const setTheme = useCallback(
    (next: Theme) => {
      apply(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        /* In-memory preferences still work. */
      }
    },
    [apply],
  );

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
