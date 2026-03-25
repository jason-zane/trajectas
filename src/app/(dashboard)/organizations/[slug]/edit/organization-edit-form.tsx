"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { updateOrganization, deleteOrganization } from "@/app/actions/organizations";
import type { Organization } from "@/types/database";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function OrganizationEditForm({ organization }: { organization: Organization }) {
  const [name, setName] = useState(organization.name);
  const [slug, setSlug] = useState(organization.slug);
  const [slugTouched, setSlugTouched] = useState(true);
  const [industry, setIndustry] = useState(organization.industry ?? "");
  const [sizeRange, setSizeRange] = useState(organization.sizeRange ?? "");
  const [isActive, setIsActive] = useState(organization.isActive);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setName(value);
      if (!slugTouched) {
        setSlug(slugify(value));
      }
    },
    [slugTouched]
  );

  const handleSlugChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSlugTouched(true);
      setSlug(slugify(e.target.value));
    },
    []
  );

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await updateOrganization(organization.id, formData);
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

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    await deleteOrganization(organization.id);
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <Link
          href="/organizations"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="size-3.5" />
          Back to Organisations
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit Organisation
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Update the details for &ldquo;{organization.name}&rdquo;.
        </p>
      </div>

      <Separator />

      {/* Form */}
      <form action={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Organisation Details</CardTitle>
            <CardDescription>
              Update the information for this organisation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Acme Corporation"
                value={name}
                onChange={handleNameChange}
                required
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                name="slug"
                placeholder="acme-corporation"
                value={slug}
                onChange={handleSlugChange}
                required
              />
              <p className="text-xs text-muted-foreground">
                URL-safe identifier.
              </p>
            </div>

            {/* Industry */}
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                name="industry"
                placeholder="e.g. Financial Services"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Optional industry vertical for benchmark grouping.
              </p>
            </div>

            {/* Size Range */}
            <div className="space-y-2">
              <Label htmlFor="sizeRange">Size Range</Label>
              <Input
                id="sizeRange"
                name="sizeRange"
                placeholder="e.g. 50-200"
                value={sizeRange}
                onChange={(e) => setSizeRange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Approximate headcount bracket.
              </p>
            </div>

            <Separator />

            {/* Active toggle */}
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive organisations are hidden from assessments and diagnostics.
                </p>
              </div>
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
            <input
              type="hidden"
              name="isActive"
              value={isActive ? "true" : "false"}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between mt-8">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="size-4" />
            {confirmDelete
              ? deleting
                ? "Deleting..."
                : "Confirm Delete"
              : "Delete Organisation"}
          </Button>
          <div className="flex items-center gap-3">
            <Link href="/organizations">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={!name.trim() || pending}>
              {pending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
