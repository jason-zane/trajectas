"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import { registerViaLink } from "@/app/actions/assess";

interface JoinFormProps {
  linkToken: string;
}

export function JoinForm({ linkToken }: JoinFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await registerViaLink(linkToken, {
      email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
    });

    setSubmitting(false);

    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }

    if (result.accessToken) {
      router.push(`/assess/${result.accessToken}`);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Join Assessment</h1>
        <p className="text-muted-foreground">
          Enter your details to begin the assessment.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-border bg-card p-6 space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="join-email">Email</Label>
          <Input
            id="join-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="join-first">First Name</Label>
            <Input
              id="join-first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="join-last">Last Name</Label>
            <Input
              id="join-last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          <ArrowRight className="size-4" />
          {submitting ? "Registering..." : "Continue"}
        </Button>
      </form>
    </div>
  );
}
