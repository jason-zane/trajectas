"use client";

import { useCallback, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { createOrganization } from "@/app/actions/organizations";

const PLATFORM_OWNED_VALUE = "__platform__";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function OrganizationCreateForm({
  partnerOptions,
  canAssignPartner,
  fixedPartnerId = null,
  fixedPartnerName = null,
}: {
  partnerOptions: Array<{ id: string; name: string }>;
  canAssignPartner: boolean;
  fixedPartnerId?: string | null;
  fixedPartnerName?: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [industry, setIndustry] = useState("");
  const [sizeRange, setSizeRange] = useState("");
  const [partnerId, setPartnerId] = useState(
    fixedPartnerId ?? PLATFORM_OWNED_VALUE
  );
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

  const selectedPartnerLabel = useMemo(() => {
    if (partnerId === PLATFORM_OWNED_VALUE) {
      return "Talent Fit / platform-owned";
    }

    return (
      partnerOptions.find((option) => option.id === partnerId)?.name ??
      fixedPartnerName ??
      "Assigned partner"
    );
  }, [fixedPartnerName, partnerId, partnerOptions]);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createOrganization(formData);
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
      router.push("/directory?tab=clients");
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader
        title="Add Client"
        description="Register a new client and decide whether it belongs directly to Talent Fit or to a partner."
      />

      <form action={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Client Details</CardTitle>
            <CardDescription>
              Provide the basic information for this client. The slug is
              auto-generated from the name but can be customised.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {canAssignPartner ? (
              <div className="space-y-2">
                <Label htmlFor="partnerId">Ownership</Label>
                <Select
                  value={partnerId}
                  onValueChange={(value) => setPartnerId(value ?? PLATFORM_OWNED_VALUE)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PLATFORM_OWNED_VALUE}>
                      Talent Fit / platform-owned
                    </SelectItem>
                    {partnerOptions.map((partner) => (
                      <SelectItem key={partner.id} value={partner.id}>
                        {partner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Platform-owned clients can be assigned to a partner later.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                This client will be created under{" "}
                <span className="font-medium text-foreground">
                  {selectedPartnerLabel}
                </span>
                .
              </div>
            )}

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
              <p className="text-xs text-muted-foreground">
                The display name for this client.
              </p>
            </div>

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
                URL-safe identifier. Auto-generated from the name.
              </p>
            </div>

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

            <input
              type="hidden"
              name="partnerId"
              value={partnerId === PLATFORM_OWNED_VALUE ? "" : partnerId}
            />
            <input type="hidden" name="isActive" value="true" />
          </CardContent>
        </Card>

        <div className="sticky bottom-0 mt-6 flex items-center justify-end gap-3 border-t border-border/50 bg-background/80 px-4 py-4 backdrop-blur-sm -mx-4">
          <Link href="/directory?tab=clients">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={!name.trim() || pending}>
            {pending ? "Creating..." : "Add Client"}
          </Button>
        </div>
      </form>
    </div>
  );
}
