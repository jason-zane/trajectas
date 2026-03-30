"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  workspaceSurfaceLabels,
  applyRoutePrefix,
  type WorkspaceSurface,
} from "@/lib/surfaces";

export type PortalType = WorkspaceSurface;

interface PortalContextValue {
  portal: PortalType;
  setPortal: (portal: PortalType) => void;
  portalLabel: string;
  canSwitchPortal: boolean;
  routePrefix: string;
  href: (path: string) => string;
}

const PortalContext = createContext<PortalContextValue>({
  portal: "admin",
  setPortal: () => {},
  portalLabel: workspaceSurfaceLabels.admin,
  canSwitchPortal: false,
  routePrefix: "",
  href: (path) => path,
});

export function PortalProvider({
  children,
  initialPortal = "admin",
  routePrefix = "",
  canSwitchPortal = false,
}: {
  children: React.ReactNode;
  initialPortal?: PortalType;
  routePrefix?: string;
  canSwitchPortal?: boolean;
}) {
  const [portal, setPortalState] = useState<PortalType>(initialPortal);

  useEffect(() => {
    setPortalState(initialPortal);
  }, [initialPortal]);

  useEffect(() => {
    document.documentElement.setAttribute("data-portal", portal);
  }, [portal]);

  const setPortal = useCallback((p: PortalType) => {
    if (!canSwitchPortal) return;
    setPortalState(p);
  }, [canSwitchPortal]);

  return (
    <PortalContext.Provider
      value={{
        portal,
        setPortal,
        portalLabel: workspaceSurfaceLabels[portal],
        canSwitchPortal,
        routePrefix,
        href: (path) => applyRoutePrefix(routePrefix, path),
      }}
    >
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  return useContext(PortalContext);
}
