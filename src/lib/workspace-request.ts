import { headers } from "next/headers";
import { isLocalDevelopmentHost } from "@/lib/hosts";
import {
  getBuildRoutePrefixForPortal,
  type WorkspaceSurface,
} from "@/lib/surfaces";

export async function getWorkspaceRequestContext(
  workspaceSurface: WorkspaceSurface = "admin"
) {
  const headerStore = await headers();
  const host = headerStore.get("host");
  const isLocalDev = isLocalDevelopmentHost(host);
  const routePrefix = isLocalDev
    ? getBuildRoutePrefixForPortal(workspaceSurface)
    : "";

  return {
    surface: workspaceSurface,
    workspaceSurface,
    routePrefix,
    isLocalDev,
  };
}
