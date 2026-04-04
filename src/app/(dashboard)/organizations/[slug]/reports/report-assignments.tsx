"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText } from "lucide-react";

import { toggleReportTemplateAssignment } from "@/app/actions/client-entitlements";
import type { ClientReportTemplateAssignment, ReportTemplate } from "@/types/database";

import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollReveal } from "@/components/scroll-reveal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DISPLAY_LEVEL_LABELS: Record<string, string> = {
  dimension: "Dimension",
  factor: "Factor",
  construct: "Construct",
};

const REPORT_TYPE_HEADINGS: Record<string, string> = {
  self_report: "Self-Report Templates",
  "360": "360 Templates",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReportAssignmentsProps {
  organizationId: string;
  partnerId: string | null;
  assignments: ClientReportTemplateAssignment[];
  allTemplates: ReportTemplate[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportAssignments({
  organizationId,
  partnerId,
  assignments,
  allTemplates,
}: ReportAssignmentsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Build a set of currently-assigned template IDs for quick lookup
  const assignedIds = new Set(assignments.map((a) => a.reportTemplateId));

  // Filter to only relevant templates:
  // - Platform-global (partnerId is undefined/null on the template)
  // - Belonging to the org's partner
  const visibleTemplates = allTemplates.filter((t) => {
    if (!t.isActive) return false;
    if (!t.partnerId) return true; // platform-global
    if (partnerId && t.partnerId === partnerId) return true; // org's partner
    return false;
  });

  // Group by reportType
  const grouped: Record<string, ReportTemplate[]> = {};
  for (const t of visibleTemplates) {
    const key = t.reportType;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  }

  // Ensure consistent section ordering
  const sectionOrder = ["self_report", "360"] as const;
  const sections = sectionOrder
    .filter((key) => grouped[key]?.length)
    .map((key) => ({
      key,
      heading: REPORT_TYPE_HEADINGS[key] ?? key,
      templates: grouped[key],
    }));

  // ----- Handler -----

  function handleToggle(templateId: string, currentlyAssigned: boolean) {
    const newState = !currentlyAssigned;
    startTransition(async () => {
      const result = await toggleReportTemplateAssignment(
        organizationId,
        templateId,
        newState,
      );

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(
        newState
          ? "Report template assigned"
          : "Report template removed",
      );
      router.refresh();
    });
  }

  // ----- Render -----

  const isEmpty = visibleTemplates.length === 0;

  let itemIndex = 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-section">Report Templates</h2>
        <p className="text-caption mt-0.5">
          Choose which report templates are available for this client&apos;s
          campaigns.
        </p>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              No report templates available. Create templates in the Report
              Templates section first.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.key} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground tracking-wide">
            {section.heading}
          </h3>

          {section.templates.map((template) => {
            const isAssigned = assignedIds.has(template.id);
            const idx = itemIndex++;

            return (
              <ScrollReveal key={template.id} delay={idx * 60}>
                <label
                  className="block cursor-pointer"
                  htmlFor={`template-${template.id}`}
                >
                  <Card
                    className={`transition-colors ${
                      isAssigned
                        ? "ring-primary/30 bg-primary/[0.03]"
                        : ""
                    }`}
                  >
                    <CardContent className="flex items-start gap-3 py-4">
                      <Checkbox
                        id={`template-${template.id}`}
                        checked={isAssigned}
                        onCheckedChange={() =>
                          handleToggle(template.id, isAssigned)
                        }
                        disabled={isPending}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm leading-tight">
                          {template.name}
                        </p>
                        <p className="text-caption mt-0.5">
                          {DISPLAY_LEVEL_LABELS[template.displayLevel] ??
                            template.displayLevel}{" "}
                          level
                          {template.partnerId && (
                            <span className="ml-1.5 text-xs text-muted-foreground/60">
                              &middot; Partner template
                            </span>
                          )}
                        </p>
                        {template.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {template.description}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </label>
              </ScrollReveal>
            );
          })}
        </div>
      ))}
    </div>
  );
}
