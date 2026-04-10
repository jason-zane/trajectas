"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  Briefcase,
  FileQuestion,
  ClipboardList,
  Layers,
  FileText,
  Building2,
  Shield,
  Sparkles,
  Cpu,
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
  Settings,
  ArrowLeft,
  Mail,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  comingSoon?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const adminNav: NavSection[] = [
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
      { title: "Item Generator", href: "/generate", icon: Wand2 },
      { title: "Response Formats", href: "/response-formats", icon: Settings2 },
      { title: "Psychometrics", href: "/psychometrics", icon: BarChart3 },
    ],
  },
  {
    label: "Assessments",
    items: [
      { title: "Assessment Builder", href: "/assessments", icon: ClipboardList },
      { title: "Report Templates", href: "/report-templates", icon: LayoutTemplate },
      { title: "Campaigns", href: "/campaigns", icon: Megaphone },
      { title: "Participants", href: "/participants", icon: Users },
    ],
  },
  {
    label: "Diagnostics",
    items: [
      { title: "Templates", href: "/diagnostic-templates", icon: FileText, comingSoon: true },
      { title: "Sessions", href: "/diagnostics", icon: Layers, comingSoon: true },
    ],
  },
  {
    label: "People",
    items: [
      { title: "Directory", href: "/directory", icon: Building2 },
      { title: "Users", href: "/users", icon: Users },
    ],
  },
  {
    label: "AI Tools",
    items: [
      { title: "Chat", href: "/chat", icon: MessageSquare },
      { title: "Matching Engine", href: "/matching", icon: Sparkles },
    ],
  },
];

const partnerNav: NavSection[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: Home }],
  },
  {
    label: "Clients",
    items: [
      { title: "Clients", href: "/clients", icon: Building2 },
    ],
  },
  {
    label: "Assessments",
    items: [
      { title: "Assessments", href: "/assessments", icon: ClipboardList },
      { title: "Report Templates", href: "/report-templates", icon: LayoutTemplate },
      { title: "Campaigns", href: "/campaigns", icon: Megaphone },
      { title: "Participants", href: "/participants", icon: Users },
    ],
  },
];

const clientNav: NavSection[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: Home }],
  },
  {
    label: "Assessments",
    items: [
      { title: "Assessments", href: "/assessments", icon: ClipboardList },
      { title: "Campaigns", href: "/campaigns", icon: Megaphone },
      { title: "Participants", href: "/participants", icon: Users },
    ],
  },
];

const settingsNav: NavSection[] = [
  {
    label: "Platform Settings",
    items: [
      { title: "Brand", href: "/settings/brand", icon: Palette },
      { title: "Experience", href: "/settings/experience", icon: Users },
      { title: "AI Configuration", href: "/settings/ai", icon: Cpu },
      { title: "Email Templates", href: "/settings/email-templates", icon: Mail },
    ],
  },
];

const clientSettingsNav: NavSection[] = [
  {
    label: "Settings",
    items: [{ title: "Brand", href: "/settings/brand/client", icon: Palette }],
  },
];

const partnerSettingsNav: NavSection[] = [
  {
    label: "Settings",
    items: [{ title: "Brand", href: "/settings/brand", icon: Palette }],
  },
];

const navByPortal: Record<PortalType, NavSection[]> = {
  admin: adminNav,
  partner: partnerNav,
  client: clientNav,
};

export function AppSidebar() {
  const pathname = usePathname();
  const { portal, href } = usePortal();
  const config = portalConfig[portal];
  const PortalIcon = config.icon;
  const navSections = navByPortal[portal];
  const settingsHref = href("/settings");
  const isSettingsArea =
    pathname === settingsHref || pathname.startsWith(`${settingsHref}/`);
  const displayNav = isSettingsArea
    ? portal === "admin"
      ? settingsNav
      : portal === "client"
        ? clientSettingsNav
        : portal === "partner"
          ? partnerSettingsNav
        : navSections
    : navSections;

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-3">
        <div className="flex items-center gap-2.5 px-1">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white shadow-sm">
            <Brain className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight tracking-tight text-sidebar-accent-foreground">
              Trajectas
            </span>
            <span className="text-[11px] text-sidebar-foreground leading-tight">
              Assessment Platform
            </span>
          </div>
        </div>
      </SidebarHeader>

      <div className="mx-3 mb-2 rounded-lg bg-white/5 px-1 py-1">
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
      </div>

      <SidebarContent>
        {isSettingsArea &&
          (portal === "admin" || portal === "client" || portal === "partner") && (
          <div className="px-3 py-2">
            <Link
              href={
                portal === "admin"
                  ? href("/")
                  : href("/dashboard")
              }
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <ArrowLeft className="size-4" />
              <span>{portal === "admin" ? "Back to platform" : "Back to dashboard"}</span>
            </Link>
          </div>
        )}
        {displayNav.map((section) => (
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
                  if (item.comingSoon) {
                    return (
                      <SidebarMenuItem key={resolvedHref} className="relative">
                        <SidebarMenuButton
                          isActive={false}
                          tooltip="This feature is coming soon"
                          className="opacity-40 cursor-default pointer-events-none"
                          render={<div />}
                        >
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                          <Badge
                            variant="outline"
                            className="ml-auto text-[10px] px-1.5 py-0"
                          >
                            Coming soon
                          </Badge>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }
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

      {portal === "admin" && !isSettingsArea && (
        <SidebarFooter className="px-3 pb-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/settings")}
                tooltip="Platform Settings"
                render={<Link href="/settings/brand" />}
              >
                <Settings className="size-4" />
                <span>Platform Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
      {portal === "client" && !isSettingsArea && (
        <SidebarFooter className="px-3 pb-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isSettingsArea}
                tooltip="Brand Settings"
                render={<Link href={href("/settings/brand/client")} />}
              >
                <Palette className="size-4" />
                <span>Brand Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
      {portal === "partner" && !isSettingsArea && (
        <SidebarFooter className="px-3 pb-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isSettingsArea}
                tooltip="Brand Settings"
                render={<Link href={href("/settings/brand")} />}
              >
                <Palette className="size-4" />
                <span>Brand Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
