import { createContext, useCallback, useContext, useRef, useState } from "react";

type OverlayContextType = {
  isOverlayOpenRef: React.RefObject<boolean | null>;
  open: () => void;
  close: () => void;
};

const OverlayContext = createContext<OverlayContextType | null>(null);

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const isOverlayOpenRef = useRef(false);
  const openCountRef = useRef(0);

  const open = useCallback(() => {
    openCountRef.current += 1;
    isOverlayOpenRef.current = true;
  }, []);

  const close = useCallback(() => {
    openCountRef.current = Math.max(0, openCountRef.current - 1);
    if (openCountRef.current === 0) {
      isOverlayOpenRef.current = false;
    }
  }, []);

  return (
    <OverlayContext.Provider value={{ isOverlayOpenRef, open, close }}>
      {children}
    </OverlayContext.Provider>
  );
}

export function useOverlayContext() {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error("useOverlayContext must be used within OverlayProvider");
  return ctx;
}
