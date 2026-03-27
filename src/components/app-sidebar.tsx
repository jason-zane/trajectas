"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  FileQuestion,
  ClipboardList,
  Layers,
  FileText,
  Building2,
  Sparkles,
  Cpu,
  MessageSquare,
  Settings,
  Settings2,
  Home,
  ChevronDown,
  Dna,
  LayoutGrid,
  Shield,
  Briefcase,
  BarChart3,
  Megaphone,
  Palette,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePortal, type PortalType } from "@/components/portal-context";

const portalConfig: Record<
  PortalType,
  { label: string; description: string; icon: typeof Shield }
> = {
  admin: {
    label: "Platform Admin",
    description: "Full platform control",
    icon: Shield,
  },
  partner: {
    label: "Partner Console",
    description: "Consulting firm view",
    icon: Briefcase,
  },
  client: {
    label: "Organisation",
    description: "Client organisation view",
    icon: Building2,
  },
};

const adminNav = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/", icon: Home }],
  },
  {
    label: "Library",
    items: [
      { title: "Dimensions", href: "/dimensions", icon: LayoutGrid },
      { title: "Factors", href: "/factors", icon: Brain },
      { title: "Constructs", href: "/constructs", icon: Dna },
      { title: "Items", href: "/items", icon: FileQuestion },
      { title: "Response Formats", href: "/response-formats", icon: Settings2 },
    ],
  },
  {
    label: "Assessments",
    items: [
      {
        title: "Assessment Builder",
        href: "/assessments",
        icon: ClipboardList,
      },
      { title: "Campaigns", href: "/campaigns", icon: Megaphone },
    ],
  },
  {
    label: "Diagnostics",
    items: [
      { title: "Templates", href: "/diagnostic-templates", icon: FileText },
      { title: "Sessions", href: "/diagnostics", icon: Layers },
    ],
  },
  {
    label: "Organisations",
    items: [
      {
        title: "Manage Organisations",
        href: "/organizations",
        icon: Building2,
      },
    ],
  },
  {
    label: "Psychometrics",
    items: [
      { title: "Overview", href: "/psychometrics", icon: BarChart3 },
      { title: "Item Health", href: "/psychometrics/items", icon: FileQuestion },
      { title: "Reliability", href: "/psychometrics/reliability", icon: Dna },
      { title: "Norms", href: "/psychometrics/norms", icon: Layers },
    ],
  },
  {
    label: "AI Matching",
    items: [
      { title: "Matching Engine", href: "/matching", icon: Sparkles },
      { title: "Model Config", href: "/model-config", icon: Cpu },
      { title: "Prompts", href: "/prompts", icon: MessageSquare },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Brand", href: "/settings/brand", icon: Palette },
    ],
  },
];

const partnerNav = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/", icon: Home }],
  },
  {
    label: "Clients",
    items: [
      { title: "Organisations", href: "/organizations", icon: Building2 },
    ],
  },
  {
    label: "Assessments",
    items: [
      { title: "Assessments", href: "/assessments", icon: ClipboardList },
      { title: "Campaigns", href: "/campaigns", icon: Megaphone },
      { title: "Results", href: "/results", icon: BarChart3 },
    ],
  },
  {
    label: "Diagnostics",
    items: [{ title: "Sessions", href: "/diagnostics", icon: Layers }],
  },
  {
    label: "AI Matching",
    items: [
      { title: "Matching Results", href: "/matching", icon: Sparkles },
    ],
  },
];

const clientNav = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/", icon: Home }],
  },
  {
    label: "Diagnostics",
    items: [
      { title: "Complete Diagnostic", href: "/diagnostics", icon: Layers },
      { title: "Results", href: "/diagnostic-results", icon: BarChart3 },
    ],
  },
  {
    label: "Assessments",
    items: [
      {
        title: "Assessment Results",
        href: "/results",
        icon: ClipboardList,
      },
      { title: "Campaigns", href: "/campaigns", icon: Megaphone },
    ],
  },
];

const navByPortal: Record<PortalType, typeof adminNav> = {
  admin: adminNav,
  partner: partnerNav,
  client: clientNav,
};

export function AppSidebar() {
  const pathname = usePathname();
  const { portal, setPortal } = usePortal();
  const config = portalConfig[portal];
  const PortalIcon = config.icon;
  const navSections = navByPortal[portal];

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-3">
        <div className="flex items-center gap-2.5 px-1">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white shadow-sm">
            <Brain className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight tracking-tight text-sidebar-accent-foreground">
              Talent Fit
            </span>
            <span className="text-[11px] text-sidebar-foreground leading-tight">
              Assessment Platform
            </span>
          </div>
        </div>
      </SidebarHeader>

      <div className="mx-3 mb-2 rounded-lg bg-white/5 px-1 py-1">
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
              const p = portalConfig[key];
              const Icon = p.icon;
              return (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setPortal(key)}
                  className={portal === key ? "bg-accent" : ""}
                >
                  <Icon className="size-4" />
                  <div className="flex flex-col">
                    <span className="text-sm">{p.label}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {p.description}
                    </span>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SidebarContent>
        {navSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-overline text-sidebar-foreground/60">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href} className="relative">
                      {isActive && (
                        <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-sidebar-primary transition-all" />
                      )}
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.title}
                        render={<Link href={item.href} />}
                      >
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem className="relative">
            {pathname === "/settings" && (
              <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-sidebar-primary" />
            )}
            <SidebarMenuButton
              isActive={pathname === "/settings"}
              tooltip="Settings"
              render={<Link href="/settings" />}
              size="sm"
            >
              <Settings className="size-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
