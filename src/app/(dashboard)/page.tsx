import Link from "next/link";
import { Brain, ClipboardList, Layers, Building2, Sparkles, Plus, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const stats = [
  {
    title: "Total Competencies",
    value: "0",
    icon: Brain,
    description: "In your competency library",
  },
  {
    title: "Active Assessments",
    value: "0",
    icon: ClipboardList,
    description: "Currently published",
  },
  {
    title: "Diagnostic Sessions",
    value: "0",
    icon: Layers,
    description: "Across all organisations",
  },
  {
    title: "Organisations",
    value: "0",
    icon: Building2,
    description: "Client organisations",
  },
];

const quickActions = [
  {
    title: "Create New Competency",
    href: "/(dashboard)/competencies",
    icon: Plus,
    description: "Add a competency to your library",
  },
  {
    title: "Build Assessment",
    href: "/(dashboard)/assessments",
    icon: ClipboardList,
    description: "Design a new psychometric assessment",
  },
  {
    title: "Start Diagnostic Session",
    href: "/(dashboard)/diagnostics",
    icon: Play,
    description: "Launch an organisational diagnostic",
  },
  {
    title: "Run AI Matching",
    href: "/(dashboard)/matching",
    icon: Sparkles,
    description: "Match competencies using AI",
  },
];

export default function DashboardPage() {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{today}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Quick Actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="h-full transition-colors hover:bg-muted/50 cursor-pointer">
                <CardContent className="pt-0">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <action.icon className="size-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{action.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {action.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
