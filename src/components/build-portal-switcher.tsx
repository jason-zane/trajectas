"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Building2, Briefcase, Shield } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { usePortal, type PortalType } from "@/components/portal-context";
import {
  applyRoutePrefix,
  getBuildRoutePrefixForPortal,
} from "@/lib/surfaces";

export const portalConfig: Record<
  PortalType,
  { label: string; description: string; icon: typeof Shield }
> = {
  admin: {
    label: "Platform Admin",
    description: "Full platform control",
    icon: Shield,
  },
  partner: {
    label: "Partner Portal",
    description: "Partner-scoped operations",
    icon: Briefcase,
  },
  client: {
    label: "Client Portal",
    description: "Client-scoped operations",
    icon: Building2,
  },
};

const switchablePathsByPortal: Record<PortalType, Set<string>> = {
  admin: new Set([
    "/",
    "/assessments",
    "/campaigns",
    "/diagnostics",
    "/matching",
    "/organizations",
  ]),
  partner: new Set([
    "/",
    "/organizations",
    "/assessments",
    "/campaigns",
    "/diagnostics",
    "/results",
    "/matching",
  ]),
  client: new Set([
    "/",
    "/assessments",
    "/campaigns",
    "/diagnostics",
    "/diagnostic-results",
    "/results",
  ]),
};

type BuildPortalSwitcherVariant = "sidebar" | "header";

interface BuildPortalSwitcherProps {
  variant?: BuildPortalSwitcherVariant;
}

export function BuildPortalSwitcher({
  variant = "sidebar",
}: BuildPortalSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { portal, setPortal, canSwitchPortal, routePrefix } = usePortal();

  if (!canSwitchPortal) {
    return null;
  }

  const config = portalConfig[portal];
  const PortalIcon = config.icon;

  const currentRelativePath = (() => {
    if (routePrefix && pathname.startsWith(routePrefix)) {
      const stripped = pathname.slice(routePrefix.length);
      return stripped || "/";
    }
    return pathname || "/";
  })();

  const getPortalSwitchHref = (targetPortal: PortalType) => {
    const targetPrefix = getBuildRoutePrefixForPortal(targetPortal);
    const allowedPaths = switchablePathsByPortal[targetPortal];
    const targetPath = allowedPaths.has(currentRelativePath)
      ? currentRelativePath
      : "/";
    return applyRoutePrefix(targetPrefix, targetPath);
  };

  const handlePortalSelect = (targetPortal: PortalType) => {
    const targetHref = getPortalSwitchHref(targetPortal);
    setPortal(targetPortal);
    router.push(targetHref);
  };

  if (variant === "header") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="hidden min-w-44 justify-between sm:inline-flex"
            />
          }
        >
          <span className="inline-flex items-center gap-2">
            <PortalIcon className="size-3.5" />
            <span className="truncate">{config.label}</span>
          </span>
          <ChevronDown className="size-3.5 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {(Object.keys(portalConfig) as PortalType[]).map((key) => {
            const option = portalConfig[key];
            const Icon = option.icon;
            return (
              <DropdownMenuItem
                key={key}
                onClick={() => handlePortalSelect(key)}
                className={portal === key ? "bg-accent" : ""}
              >
                <Icon className="size-4" />
                <div className="flex flex-col">
                  <span className="text-sm">{option.label}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {option.description}
                  </span>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-white/10" />
        }
      >
        <PortalIcon className="size-3.5 text-sidebar-primary" />
        <span className="flex-1 truncate text-xs font-medium text-sidebar-foreground">
          {config.label}
        </span>
        <ChevronDown className="size-3 text-sidebar-foreground/60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {(Object.keys(portalConfig) as PortalType[]).map((key) => {
          const option = portalConfig[key];
          const Icon = option.icon;
          return (
            <DropdownMenuItem
              key={key}
              onClick={() => handlePortalSelect(key)}
              className={portal === key ? "bg-accent" : ""}
            >
              <Icon className="size-4" />
              <div className="flex flex-col">
                <span className="text-sm">{option.label}</span>
                <span className="text-[11px] text-muted-foreground">
                  {option.description}
                </span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
