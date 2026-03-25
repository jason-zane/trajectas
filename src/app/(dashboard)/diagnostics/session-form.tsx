"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { createDiagnosticSession } from "@/app/actions/diagnostics";
import type { SelectOption } from "@/app/actions/diagnostics";

interface SessionFormProps {
  organizations: SelectOption[];
  templates: SelectOption[];
}

export function SessionForm({ organizations, templates }: SessionFormProps) {
  const [title, setTitle] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createDiagnosticSession(formData);
    if (result?.error) {
      const errors = result.error;
      const msg =
        typeof errors === "object" && "_form" in errors
          ? (errors as Record<string, string[]>)._form?.[0]
          : Object.values(errors).flat().join(", ");
      setError(msg ?? "Validation failed");
      setPending(false);
    }
  }

  const canSubmit = title.trim() && organizationId && templateId;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <Breadcrumbs className="mb-4" />
        <PageHeader
          title="New Diagnostic Session"
          description="Create a new diagnostic session for a client organisation."
        />
      </div>

      <form action={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Session Details</CardTitle>
            <CardDescription>
              Provide the basic information for this diagnostic session. You can
              configure respondents and dimensions after creation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="session-title">Title</Label>
              <Input
                id="session-title"
                name="title"
                placeholder="e.g. Q1 2026 Leadership Assessment"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                A descriptive title that identifies this session.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Organisation</Label>
              <Select
                name="organizationId"
                value={organizationId}
                onValueChange={(v) => setOrganizationId(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an organisation...">
                    {(value: string) =>
                      organizations.find((o) => o.id === value)?.name ?? value
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {organizations.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No active organisations found.{" "}
                  <Link
                    href="/organizations"
                    className="text-primary underline underline-offset-2"
                  >
                    Create one first
                  </Link>
                  .
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Template</Label>
              <Select
                name="templateId"
                value={templateId}
                onValueChange={(v) => setTemplateId(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a template...">
                    {(value: string) =>
                      templates.find((t) => t.id === value)?.name ?? value
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tmpl) => (
                    <SelectItem key={tmpl.id} value={tmpl.id}>
                      {tmpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No active templates found.{" "}
                  <Link
                    href="/diagnostics/templates/create"
                    className="text-primary underline underline-offset-2"
                  >
                    Create one first
                  </Link>
                  .
                </p>
              )}
            </div>

            <input type="hidden" name="status" value="draft" />
          </CardContent>
        </Card>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 py-4 mt-6 bg-background/80 backdrop-blur-sm -mx-4 px-4 border-t border-border/50">
          <Link href="/diagnostics">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={!canSubmit || pending}>
            {pending ? "Creating..." : "Create Session"}
          </Button>
        </div>
      </form>
    </div>
  );
}
