import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import type { NotifyType } from "modern-dt-pro";
import { Documentation } from "./Documentation";
import { Examples } from "./Examples";
import { Playground } from "./Playground";

type Tab = "examples" | "playground" | "docs";
type ThemePref = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

type ToastItem = {
  id: number;
  type: NotifyType;
  message: string;
};

const THEME_STORAGE_KEY = "dtp-demo-theme";
const THEME_ORDER: ThemePref[] = ["system", "light", "dark"];
const GITHUB_URL = "https://github.com/Deneshiqua/modern-dt-pro";
const NPM_URL = "https://www.npmjs.com/package/modern-dt-pro";

function readStoredTheme(): ThemePref {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    // localStorage yoksa varsayilan koyu
  }
  return "dark";
}

function subscribeSystemTheme(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getSystemThemeSnapshot(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function nextTheme(current: ThemePref): ThemePref {
  const idx = THEME_ORDER.indexOf(current);
  return THEME_ORDER[(idx + 1) % THEME_ORDER.length];
}

function themeTitle(pref: ThemePref): string {
  if (pref === "system") return "Tema: Sistem — açık için tıkla";
  if (pref === "light") return "Tema: Açık — koyu için tıkla";
  return "Tema: Koyu — sistem için tıkla";
}

export default function App() {
  const [tab, setTab] = useState<Tab>("examples");
  const [themePref, setThemePref] = useState<ThemePref>("dark");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemThemeSnapshot,
    () => "dark" as ResolvedTheme,
  );

  useEffect(() => {
    setThemePref(readStoredTheme());
  }, []);

  const resolvedTheme: ResolvedTheme = themePref === "system" ? systemTheme : themePref;

  useEffect(() => {
    document.documentElement.dataset.pageTheme = resolvedTheme;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  const cycleTheme = useCallback(() => {
    setThemePref((prev) => {
      const next = nextTheme(prev);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // yazilamazsa sessizce gec
      }
      return next;
    });
  }, []);

  const themeIcon = useMemo(() => {
    if (themePref === "system") return <MonitorIcon />;
    if (themePref === "light") return <SunIcon />;
    return <MoonIcon />;
  }, [themePref]);

  const pushToast = (type: NotifyType, message: string) => {
    const id = Date.now();
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 2800);
  };

  return (
    <main className={tab === "playground" ? "page page--playground" : "page"}>
      <header className="page-header">
        <div className="page-header-left">
          <nav className="tabs" role="tablist" aria-label="Demo sekmeleri">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "examples"}
              className={tab === "examples" ? "tab-btn active" : "tab-btn"}
              onClick={() => setTab("examples")}
            >
              Örnekler
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "playground"}
              className={tab === "playground" ? "tab-btn active" : "tab-btn"}
              onClick={() => setTab("playground")}
            >
              Playground
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "docs"}
              className={tab === "docs" ? "tab-btn active" : "tab-btn"}
              onClick={() => setTab("docs")}
            >
              Dokümantasyon
            </button>
          </nav>
        </div>

        <div className="page-header-center">
          <h1>Modern DataTable Pro</h1>
          <span className="page-header-tagline">
            React için gruplama, filtre ve export destekli data table
          </span>
        </div>

        <div className="page-header-right">
          <button
            type="button"
            className="header-icon-btn"
            title={themeTitle(themePref)}
            aria-label="Tema değiştir"
            onClick={cycleTheme}
          >
            {themeIcon}
          </button>
          <a
            className="header-icon-btn"
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            title="GitHub"
            aria-label="GitHub"
          >
            <GitHubIcon />
          </a>
          <a
            className="header-icon-btn"
            href={NPM_URL}
            target="_blank"
            rel="noreferrer"
            title="npm"
            aria-label="npm"
          >
            <NpmIcon />
          </a>
        </div>
      </header>

      {tab === "examples" ? <Examples onNotify={pushToast} /> : null}
      {tab === "playground" ? <Playground onNotify={pushToast} /> : null}
      {tab === "docs" ? <Documentation /> : null}

      <footer className="footer">
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          GitHub'da görüntüle
        </a>
        <span className="footer-sep">·</span>
        <a href={NPM_URL} target="_blank" rel="noreferrer">
          npm
        </a>
      </footer>

      <div className="pointer-events-none fixed right-5 bottom-5 z-[20000] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} className="demo-toast pointer-events-auto">
            {toast.message}
          </div>
        ))}
      </div>
    </main>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 14.3A9 9 0 1 1 9.7 3 7 7 0 0 0 21 14.3z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function NpmIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L11.99 19.15H5.113z" />
    </svg>
  );
}
