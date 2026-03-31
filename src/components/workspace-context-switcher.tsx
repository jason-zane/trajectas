"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Briefcase,
  Building2,
  ChevronDown,
  Layers3,
} from "lucide-react";
import { setActiveWorkspaceContext } from "@/app/actions/workspace-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WorkspaceContextOption } from "@/lib/auth/workspace-access";
import type { WorkspaceSurface } from "@/lib/surfaces";

interface WorkspaceContextSwitcherProps {
  surface: Extract<WorkspaceSurface, "partner" | "client">;
  options: WorkspaceContextOption[];
}

function ContextOptionIcon({
  kind,
  className,
}: {
  kind: WorkspaceContextOption["kind"];
  className?: string;
}) {
  if (kind === "partner") {
    return <Briefcase className={className} />;
  }

  if (kind === "client") {
    return <Building2 className={className} />;
  }

  return <Layers3 className={className} />;
}

export function WorkspaceContextSwitcher({
  surface,
  options,
}: WorkspaceContextSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (options.length === 0) {
    return null;
  }

  const selected = options.find((option) => option.selected) ?? options[0];
  const groupedOptions = {
    all: options.filter((option) => option.kind === "all"),
    partner: options.filter((option) => option.kind === "partner"),
    client: options.filter((option) => option.kind === "client"),
  };

  const handleSelect = (option: WorkspaceContextOption) => {
    startTransition(async () => {
      const result = await setActiveWorkspaceContext({
        surface,
        tenantType: option.tenantType,
        tenantId: option.tenantId,
        membershipId: option.membershipId,
      });

      if ("error" in result) {
        console.error(result.error);
        return;
      }

      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="hidden min-w-52 justify-between sm:inline-flex"
            disabled={isPending}
          />
        }
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <ContextOptionIcon kind={selected.kind} className="size-3.5" />
          <span className="truncate">
            {isPending ? "Switching scope…" : selected.label}
          </span>
        </span>
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {groupedOptions.all.length > 0 ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Scope</DropdownMenuLabel>
            {groupedOptions.all.map((option) => {
              return (
                <DropdownMenuItem
                  key={option.key}
                  onClick={() => handleSelect(option)}
                  className={option.selected ? "bg-accent" : ""}
                >
                  <ContextOptionIcon kind={option.kind} className="size-4" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm">{option.label}</span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {option.description}
                    </span>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        ) : null}

        {groupedOptions.partner.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Partners</DropdownMenuLabel>
              {groupedOptions.partner.map((option) => {
                return (
                  <DropdownMenuItem
                    key={option.key}
                    onClick={() => handleSelect(option)}
                    className={option.selected ? "bg-accent" : ""}
                  >
                    <ContextOptionIcon kind={option.kind} className="size-4" />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{option.label}</span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {option.description}
                      </span>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </>
        ) : null}

        {groupedOptions.client.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Clients</DropdownMenuLabel>
              {groupedOptions.client.map((option) => {
                return (
                  <DropdownMenuItem
                    key={option.key}
                    onClick={() => handleSelect(option)}
                    className={option.selected ? "bg-accent" : ""}
                  >
                    <ContextOptionIcon kind={option.kind} className="size-4" />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{option.label}</span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {option.description}
                      </span>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
