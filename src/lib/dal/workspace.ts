import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedPlatformBrand } from "@/app/actions/brand";
import { type WorkspaceBootstrap } from "@/lib/auth/types";

export interface SidebarIdentity {
  tenantName: string | null;
  tenantLogomarkUrl: string | null;
  platformName: string;
  platformLogomarkUrl: string | null;
}

/**
 * Resolve the tenant + platform branding shown in the sidebar for the current
 * workspace. Extracted out of WorkspaceShell so the component does not open a
 * database client directly. See src/lib/dal/README.md.
 */
export async function getSidebarIdentity(
  bootstrap: WorkspaceBootstrap,
): Promise<SidebarIdentity> {
  const platformBrand = await getCachedPlatformBrand();
  const platformName = platformBrand?.config.name ?? "Trajectas";
  const platformLogomarkUrl = platformBrand?.config.logomarkUrl ?? null;
  const empty: SidebarIdentity = {
    tenantName: null,
    tenantLogomarkUrl: null,
    platformName,
    platformLogomarkUrl,
  };

  if (bootstrap.portal === "admin") return empty;

  const selected =
    bootstrap.workspaceContextOptions.find((o) => o.selected) ??
    bootstrap.workspaceContextOptions[0];

  if (!selected?.tenantId || !selected?.tenantType) return empty;

  const db = createAdminClient();
  const [{ data: tenant }, { data: tenantBrand }] = await Promise.all([
    db
      .from(selected.tenantType === "partner" ? "partners" : "clients")
      .select("name")
      .eq("id", selected.tenantId)
      .maybeSingle(),
    db
      .from("brand_configs")
      .select("config")
      .eq("owner_type", selected.tenantType)
      .eq("owner_id", selected.tenantId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  const brandConfig = tenantBrand?.config as
    | { logomarkUrl?: string }
    | null
    | undefined;

  return {
    tenantName: (tenant?.name as string | undefined) ?? selected.label,
    tenantLogomarkUrl: brandConfig?.logomarkUrl ?? null,
    platformName,
    platformLogomarkUrl,
  };
}
