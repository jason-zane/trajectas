"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { createPartner } from "@/app/actions/partners";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function PartnerCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [pending, setPending] = useState(false);
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
    const result = await createPartner(formData);
    if (result?.error) {
      const errors = result.error;
      const msg =
        typeof errors === "object" && "_form" in errors
          ? (errors as Record<string, string[]>)._form?.[0]
          : Object.values(errors).flat().join(", ");
      setError(msg ?? "Validation failed");
      setPending(false);
      return;
    }

    if (result && "success" in result) {
      router.push("/directory?tab=partners");
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader
        title="Add Partner"
        description="Register a consulting partner that can own client accounts."
      />

      <form action={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Partner Details</CardTitle>
            <CardDescription>
              Provide the basic information for this partner.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Northstar Consulting"
                value={name}
                onChange={handleNameChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                name="slug"
                placeholder="northstar-consulting"
                value={slug}
                onChange={handleSlugChange}
                required
              />
            </div>

            <input type="hidden" name="isActive" value="true" />
          </CardContent>
        </Card>

        <div className="sticky bottom-0 mt-6 flex items-center justify-end gap-3 border-t border-border/50 bg-background/80 px-4 py-4 backdrop-blur-sm -mx-4">
          <Link href="/directory?tab=partners">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={!name.trim() || pending}>
            {pending ? "Creating..." : "Add Partner"}
          </Button>
        </div>
      </form>
    </div>
  );
}
