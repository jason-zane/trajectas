import Link from "next/link";
import {
  Plus,
  FileText,
  Layers,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import { getDiagnosticTemplates } from "@/app/actions/diagnostics";

export default async function DiagnosticTemplatesPage() {
  const templates = await getDiagnosticTemplates();

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <Breadcrumbs className="mb-4" />
        <PageHeader
          title="Diagnostic Templates"
          description="Templates define the structure of a diagnostic survey — which dimensions are measured and how."
        >
          <Link href="/diagnostics/templates/create">
            <Button>
              <Plus className="size-4" />
              Create Template
            </Button>
          </Link>
        </PageHeader>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Templates define the dimensions and structure for your diagnostic sessions. Create your first template to get started."
          actionLabel="Create Template"
          actionHref="/diagnostics/templates/create"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((template, index) => (
            <Link
              key={template.id}
              href={`/diagnostics/templates/${template.id}/edit`}
            >
              <Card
                variant="interactive"
                className={`stagger-${index + 1} animate-fade-in-up`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted transition-colors">
                        <FileText className="size-5 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle>{template.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="dot">
                            <span
                              className={`size-1.5 rounded-full ${template.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                            />
                            {template.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity mt-1" />
                  </div>
                </CardHeader>
                <CardContent>
                  {template.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {template.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Layers className="size-3.5" />
                      <span>
                        {template.dimensionCount}{" "}
                        {template.dimensionCount === 1
                          ? "dimension"
                          : "dimensions"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ClipboardList className="size-3.5" />
                      <span>
                        {template.sessionCount}{" "}
                        {template.sessionCount === 1 ? "session" : "sessions"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
