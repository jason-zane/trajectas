export type Surface = "public" | "assess" | "admin" | "partner" | "client";

export type WorkspaceSurface = Extract<Surface, "admin" | "partner" | "client">;

export const surfaceLabels: Record<Surface, string> = {
  public: "Public Site",
  assess: "Assessment Runtime",
  admin: "Platform Admin",
  partner: "Partner Portal",
  client: "Client Portal",
};

export const workspaceSurfaceLabels: Record<WorkspaceSurface, string> = {
  admin: surfaceLabels.admin,
  partner: surfaceLabels.partner,
  client: surfaceLabels.client,
};

export const surfaceDescriptions: Record<Surface, string> = {
  public: "Marketing and public entry flows",
  assess: "Participant runtime and gated report access",
  admin: "Platform primitives, psychometrics, and global operations",
  partner: "Partner-scoped client operations",
  client: "Client-scoped campaigns, participants, and reports",
};

export function isSurface(value: string | null | undefined): value is Surface {
  return (
    value === "public" ||
    value === "assess" ||
    value === "admin" ||
    value === "partner" ||
    value === "client"
  );
}

export function isWorkspaceSurface(
  value: string | null | undefined
): value is WorkspaceSurface {
  return value === "admin" || value === "partner" || value === "client";
}

export function coerceSurface(
  value: string | null | undefined,
  fallback: Surface = "admin"
): Surface {
  return isSurface(value) ? value : fallback;
}

export function coerceWorkspaceSurface(
  value: string | null | undefined,
  fallback: WorkspaceSurface = "admin"
): WorkspaceSurface {
  return isWorkspaceSurface(value) ? value : fallback;
}

export function toWorkspaceSurface(surface: Surface): WorkspaceSurface {
  return surface === "partner" || surface === "client" ? surface : "admin";
}

export function applyRoutePrefix(routePrefix: string, href: string): string {
  if (!routePrefix) {
    return href;
  }

  if (href === "/") {
    return routePrefix;
  }

  return `${routePrefix}${href.startsWith("/") ? href : `/${href}`}`;
}

export function getBuildRoutePrefixForPortal(portal: WorkspaceSurface): string {
  return portal === "admin" ? "" : `/${portal}`;
}
