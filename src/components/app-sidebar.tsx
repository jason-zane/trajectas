"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  FileQuestion,
  ClipboardList,
  ListChecks,
  LayoutGrid,
  Layers,
  FileText,
  Users,
  Building2,
  Sparkles,
  Cpu,
  MessageSquare,
  Settings,
  Home,
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
  SidebarSeparator,
} from "@/components/ui/sidebar";

const navSections = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/(dashboard)", icon: Home },
    ],
  },
  {
    label: "Library",
    items: [
      { title: "Competencies", href: "/(dashboard)/competencies", icon: Brain },
      { title: "Items", href: "/(dashboard)/items", icon: FileQuestion },
    ],
  },
  {
    label: "Assessments",
    items: [
      {
        title: "Assessment Builder",
        href: "/(dashboard)/assessments",
        icon: ClipboardList,
      },
      {
        title: "Item Selection Rules",
        href: "/(dashboard)/item-rules",
        icon: ListChecks,
      },
    ],
  },
  {
    label: "Diagnostics",
    items: [
      { title: "Dimensions", href: "/(dashboard)/dimensions", icon: LayoutGrid },
      { title: "Templates", href: "/(dashboard)/templates", icon: FileText },
      { title: "Sessions", href: "/(dashboard)/diagnostics", icon: Layers },
    ],
  },
  {
    label: "Organisations",
    items: [
      {
        title: "Manage Organisations",
        href: "/(dashboard)/organizations",
        icon: Building2,
      },
    ],
  },
  {
    label: "AI Matching",
    items: [
      {
        title: "Matching Engine",
        href: "/(dashboard)/matching",
        icon: Sparkles,
      },
      { title: "Model Config", href: "/(dashboard)/model-config", icon: Cpu },
      {
        title: "Prompts",
        href: "/(dashboard)/prompts",
        icon: MessageSquare,
      },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4">
        <Link href="/(dashboard)" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Brain className="size-4" />
          </div>
          <span className="text-base font-semibold tracking-tight">
            Talent Fit
          </span>
        </Link>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        {navSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
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
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/(dashboard)/settings"}
              tooltip="Settings"
              render={<Link href="/(dashboard)/settings" />}
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
