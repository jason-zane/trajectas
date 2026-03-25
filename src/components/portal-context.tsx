"use client";

import { createContext, useContext, useState, useCallback } from "react";

export type PortalType = "admin" | "partner" | "client";

interface PortalContextValue {
  portal: PortalType;
  setPortal: (portal: PortalType) => void;
  portalLabel: string;
}

const portalLabels: Record<PortalType, string> = {
  admin: "Platform Admin",
  partner: "Partner Console",
  client: "Organisation",
};

const PortalContext = createContext<PortalContextValue>({
  portal: "admin",
  setPortal: () => {},
  portalLabel: portalLabels.admin,
});

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [portal, setPortalState] = useState<PortalType>("admin");

  const setPortal = useCallback((p: PortalType) => {
    setPortalState(p);
    document.documentElement.setAttribute("data-portal", p);
  }, []);

  return (
    <PortalContext.Provider
      value={{ portal, setPortal, portalLabel: portalLabels[portal] }}
    >
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  return useContext(PortalContext);
}
