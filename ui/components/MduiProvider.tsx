"use client";

import { useEffect } from "react";

export function MduiProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let mounted = true;
    import("mdui").then(({ setColorScheme, setTheme }) => {
      if (!mounted) return;
      // Google Blue Material 3 dynamic palette
      setColorScheme("#1a73e8");
      const savedTheme = localStorage.getItem("jellypull_theme") as
        | "light"
        | "dark"
        | "auto"
        | null;
      if (savedTheme) {
        setTheme(savedTheme);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return <>{children}</>;
}
