"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  Briefcase,
  FlaskConical,
  FileQuestion,
  ClipboardList,
  Layers,
  FileText,
  Building2,
  Shield,
  Activity,
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
  LayoutTemplate,
  Settings,
  ArrowLeft,
  Mail,
  Tag,
  TrendingUp,
  Scale,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { TrajectasLogo } from "@/components/brand/trajectas-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroupCollapsible,
  SidebarGroupPanel,
  SidebarGroupTrigger,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { usePortal, type PortalType } from "@/components/portal-context";
import { useSidebarSections } from "@/hooks/use-sidebar-sections";

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
};

type NavSection = {
  label: string;
  items: NavItem[];
  /** Sections a user has never toggled start in this state. */
  defaultOpen?: boolean;
};

// Sections are grouped by what a page does to data: the Library holds it,
// Instrument Development manufactures and validates it, Assessments assembles
// it, Delivery runs it, Insights reads it back.
const adminNav: NavSection[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: Home }],
  },
  {
    label: "Library",
    items: [
      { title: "Dimensions", href: "/dimensions", icon: LayoutGrid },
      { title: "Factors", href: "/factors", icon: Brain },
      { title: "Constructs", href: "/constructs", icon: Dna },
      { title: "Items", href: "/items", icon: FileQuestion },
      { title: "Item Formats", href: "/response-formats", icon: Settings2 },
    ],
  },
  {
    label: "Instrument Development",
    defaultOpen: false,
    items: [
      { title: "Instruments", href: "/instruments", icon: FlaskConical },
      { title: "Cognitive Items", href: "/cognitive-items", icon: Layers },
      { title: "Psychometrics", href: "/psychometrics", icon: BarChart3 },
    ],
  },
  {
    label: "Assessments",
    items: [
      { title: "Assessment Builder", href: "/assessments", icon: ClipboardList },
      { title: "Report Templates", href: "/report-templates", icon: LayoutTemplate },
    ],
  },
  {
    label: "Delivery",
    items: [
      { title: "Campaigns", href: "/campaigns", icon: Megaphone },
      { title: "Participants", href: "/participants", icon: Users },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Compare", href: "/participants/compare", icon: Scale },
      { title: "Trajectory", href: "/participants/trajectory", icon: TrendingUp },
      { title: "Unified Trajectory", href: "/participants/unified", icon: Layers },
      { title: "Business Outcomes", href: "/business-outcomes", icon: BarChart3 },
      { title: "Reports", href: "/reports", icon: FileText },
    ],
  },
  {
    label: "Org Diagnostics",
    defaultOpen: false,
    items: [
      { title: "Sessions", href: "/diagnostics", icon: Layers },
      { title: "Templates", href: "/diagnostics/templates", icon: FileText },
      { title: "Matching Engine", href: "/matching", icon: Sparkles },
    ],
  },
  {
    label: "Clients & People",
    defaultOpen: false,
    items: [
      { title: "Directory", href: "/directory", icon: Building2 },
      { title: "Users", href: "/users", icon: Users },
    ],
  },
  {
    label: "Business",
    defaultOpen: false,
    items: [
      { title: "Overview", href: "/business", icon: Activity },
      { title: "Invoices", href: "/business/invoices", icon: Receipt },
      { title: "Usage", href: "/business/usage", icon: BarChart3 },
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
    label: "Delivery",
    items: [
      { title: "Campaigns", href: "/campaigns", icon: Megaphone },
      { title: "Participants", href: "/participants", icon: Users },
    ],
  },
  {
    label: "Assessments",
    items: [
      { title: "Assessments", href: "/assessments", icon: ClipboardList },
      { title: "Report Templates", href: "/report-templates", icon: LayoutTemplate },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Compare", href: "/participants/compare", icon: Scale },
      { title: "Trajectory", href: "/participants/trajectory", icon: TrendingUp },
      { title: "Unified Trajectory", href: "/participants/unified", icon: Layers },
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
  {
    label: "Insights",
    items: [
      { title: "Compare", href: "/participants/compare", icon: Scale },
      { title: "Trajectory", href: "/participants/trajectory", icon: TrendingUp },
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
      { title: "Band Scheme", href: "/settings/reports/band-scheme", icon: Scale },
      { title: "Email Templates", href: "/settings/email-templates", icon: Mail },
      { title: "Content Sources", href: "/settings/content-sources", icon: Tag },
      { title: "Audit log", href: "/settings/audit", icon: Shield },
      { title: "Observability", href: "/settings/observability", icon: Activity },
      { title: "Migrations", href: "/settings/migrations", icon: Layers },
    ],
  },
];

const clientSettingsNav: NavSection[] = [
  {
    label: "Settings",
    items: [
      { title: "Brand", href: "/settings/brand/client", icon: Palette },
      { title: "Team", href: "/settings/users", icon: Users },
    ],
  },
];

const partnerSettingsNav: NavSection[] = [
  {
    label: "Settings",
    items: [
      { title: "Brand", href: "/settings/brand", icon: Palette },
      { title: "Team", href: "/settings/users", icon: Users },
    ],
  },
];

const navByPortal: Record<PortalType, NavSection[]> = {
  admin: adminNav,
  partner: partnerNav,
  client: clientNav,
};

interface SidebarIdentity {
  tenantName: string | null;
  tenantLogomarkUrl: string | null;
  platformName: string;
  platformLogomarkUrl: string | null;
}

interface AppSidebarProps {
  identity?: SidebarIdentity;
}

export function AppSidebar({ identity }: AppSidebarProps = {}) {
  const pathname = usePathname();
  const { portal, href } = usePortal();
  const config = portalConfig[portal];
  const PortalIcon = config.icon;
  const navSections = navByPortal[portal];
  const { isSectionOpen, setSectionOpen } = useSidebarSections(portal);
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
          {identity?.platformLogomarkUrl ? (
            <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/15 text-white shadow-sm">
              <Image
                src={identity.platformLogomarkUrl}
                alt=""
                width={32}
                height={32}
                className="size-full object-contain p-1"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 shadow-sm">
              <TrajectasLogo variant="mark" light height={20} />
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight tracking-tight text-sidebar-accent-foreground">
              {identity?.platformName ?? "Trajectas"}
            </span>
            <span className="text-[11px] text-sidebar-foreground leading-tight">
              Assessment Platform
            </span>
          </div>
        </div>
      </SidebarHeader>

      <div className="mx-3 mb-2 rounded-lg bg-white/5 px-1 py-1">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm">
          {portal !== "admin" && identity?.tenantLogomarkUrl ? (
            <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/10">
              <Image
                src={identity.tenantLogomarkUrl}
                alt=""
                width={24}
                height={24}
                className="size-full object-contain p-0.5"
                unoptimized
              />
            </div>
          ) : (
            <PortalIcon className="size-3.5 text-sidebar-primary" />
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-xs font-medium text-sidebar-foreground">
              {portal !== "admin" && identity?.tenantName
                ? identity.tenantName
                : config.label}
            </span>
            <span className="truncate text-[11px] text-sidebar-foreground/60">
              {portal !== "admin" && identity?.tenantName
                ? config.label
                : config.description}
            </span>
          </div>
        </div>
      </div>

      <SidebarContent>
        {isSettingsArea &&
          (portal === "admin" || portal === "client" || portal === "partner") && (
          <div className="px-3 py-2">
            <Link
              href={href("/dashboard")}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <ArrowLeft className="size-4" />
              <span>Back to dashboard</span>
            </Link>
          </div>
        )}
        {displayNav.map((section) => {
          // Landing inside a section opens it even when it normally starts
          // closed — otherwise navigating there hides where you are. This only
          // raises the default, so an explicit collapse still wins and the
          // trigger never looks dead.
          const containsActive = section.items.some((item) => {
            const resolved = href(item.href);
            return pathname === resolved || pathname.startsWith(`${resolved}/`);
          });
          const open = isSectionOpen(
            section.label,
            (section.defaultOpen ?? true) || containsActive
          );
          return (
          <SidebarGroupCollapsible
            key={section.label}
            open={open}
            onOpenChange={(next) => setSectionOpen(section.label, next)}
          >
            <SidebarGroupTrigger className="text-overline text-sidebar-foreground/60">
              {section.label}
            </SidebarGroupTrigger>
            <SidebarGroupPanel>
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
            </SidebarGroupPanel>
          </SidebarGroupCollapsible>
          );
        })}
      </SidebarContent>

      {portal === "admin" && !isSettingsArea && (
        <SidebarFooter className="px-3 pb-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/chat" || pathname.startsWith("/chat/")}
                tooltip="Chat"
                render={<Link href="/chat" />}
              >
                <MessageSquare className="size-4" />
                <span>Chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
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
                tooltip="Settings"
                render={<Link href={href("/settings/brand/client")} />}
              >
                <Settings className="size-4" />
                <span>Settings</span>
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
                tooltip="Settings"
                render={<Link href={href("/settings/brand")} />}
              >
                <Settings className="size-4" />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
