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
  Braces,
  MessageSquare,
  Settings2,
  Home,
  Dna,
  LayoutGrid,
  BarChart3,
  Megaphone,
  Palette,
  Users,
  Wand2,
  LayoutTemplate,
  ListFilter,
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
import { usePortal, type PortalType } from "@/components/portal-context";
import {
  BuildPortalSwitcher,
  portalConfig,
} from "@/components/build-portal-switcher";

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
      { title: "Item Generator", href: "/generate", icon: Wand2 },
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
      { title: "Participants", href: "/participants", icon: Users },
    ],
  },
  {
    label: "Reports",
    items: [
      { title: "Report Templates", href: "/settings/reports", icon: LayoutTemplate },
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
    label: "Clients",
    items: [
      {
        title: "Manage Clients",
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
    label: "AI Tools",
    items: [
      { title: "Chat", href: "/chat", icon: MessageSquare },
      { title: "Matching Engine", href: "/matching", icon: Sparkles },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Brand", href: "/settings/brand", icon: Palette },
      { title: "Experience", href: "/settings/experience", icon: Users },
      { title: "Users", href: "/settings/users", icon: Users },
      { title: "Item Selection", href: "/settings/item-selection", icon: ListFilter },
      { title: "AI Models", href: "/settings/models", icon: Cpu },
      { title: "AI Prompts", href: "/settings/prompts", icon: Braces },
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
      { title: "Clients", href: "/organizations", icon: Building2 },
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
    label: "AI Tools",
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
    label: "Assessments",
    items: [
      { title: "Assessments", href: "/assessments", icon: ClipboardList },
      {
        title: "Assessment Results",
        href: "/results",
        icon: BarChart3,
      },
      { title: "Campaigns", href: "/campaigns", icon: Megaphone },
    ],
  },
  {
    label: "Diagnostics",
    items: [
      { title: "Complete Diagnostic", href: "/diagnostics", icon: Layers },
      { title: "Results", href: "/diagnostic-results", icon: BarChart3 },
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
  const { portal, canSwitchPortal, href } = usePortal();
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
        {canSwitchPortal ? (
          <BuildPortalSwitcher />
        ) : (
          <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm">
            <PortalIcon className="size-3.5 text-sidebar-primary" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs font-medium text-sidebar-foreground">
                {config.label}
              </span>
              <span className="truncate text-[11px] text-sidebar-foreground/60">
                {config.description}
              </span>
            </div>
          </div>
        )}
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
                  const resolvedHref = href(item.href);
                  const isActive =
                    resolvedHref === "/"
                      ? pathname === "/"
                      : pathname === resolvedHref || pathname.startsWith(`${resolvedHref}/`);
                  return (
                    <SidebarMenuItem key={resolvedHref} className="relative">
                      {isActive && (
                        <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-sidebar-primary transition-all" />
                      )}
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.title}
                        render={<Link href={resolvedHref} />}
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

      <SidebarFooter />
    </Sidebar>
  );
}
